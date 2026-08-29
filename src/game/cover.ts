import { type AbstractMesh, EngineStore, Mesh, Ray, type Scene, Vector3 } from "@babylonjs/core";
import "../cover.css";
import "./gadgets";
import { isCrouched } from "./input";

/**
 * Tactical cover.
 *
 * This is the single cover system. It keeps the original contextual SİPER
 * button and body dataset signal, but tracks a real dominant surface — normal,
 * tangent, distance and whether the surface is tall enough to hide behind — so
 * observers can ask for directional protection instead of receiving a flat
 * bonus whenever cover happens to be toggled on.
 */

export type CoverStatus = "NONE" | "READY" | "PROTECTED" | "EXPOSED";

export interface CoverState {
  readonly status: CoverStatus;
  readonly ready: boolean;
  readonly active: boolean;
  /** Cover is active AND the player is still behind the surface. */
  readonly contact: boolean;
  /** Surface is crate height: it only hides a crouched player. */
  readonly lowProfile: boolean;
  readonly distance: number;
  /** Horizontal unit vector pointing from the surface toward the player. */
  readonly normal: Vector3;
  /** Horizontal unit vector along the surface. */
  readonly tangent: Vector3;
}

/** Best-case detection reduction. Cover never makes the player invisible. */
export const COVER_MAX_DETECTION_REDUCTION = 0.62;

const SEARCH_RANGE = 0.95;
const ATTACH_DISTANCE = 0.82;
/** Losing the surface past this distance drops cover immediately. */
const BREAK_DISTANCE = 1.15;
/**
 * Offsets from the player collider origin, which sits at world y ~0.9 and does
 * not move when crouching.
 *
 * The contact probe is deliberately low (world ~0.70) so the service-route
 * crates, whose tops sit between 0.90 and 1.32, are found as cover at all. The
 * head probe (world ~1.45) clears every crate but is well inside wall height,
 * which is what separates crate-height cover from full-height cover.
 */
const CONTACT_PROBE_OFFSET = -0.2;
const HEAD_PROBE_OFFSET = 0.55;
/** Above this the surface is a floor or ceiling and can never be cover. */
const MAX_SURFACE_TILT = 0.5;
/** Observer alignment at which the cover bonus has already collapsed. */
const EDGE_ALIGN_MIN = -0.15;
/** Standing behind crate-height cover leaves most of the torso showing. */
const LOW_COVER_STANDING_PROTECTION = 0.35;

/** Sweeping for a surface is cheaper than tracking one, so it runs slower. */
const SEARCH_INTERVAL_MS = 66;
const TRACK_INTERVAL_MS = 33;

const UP = Vector3.Up();

/** Preallocated horizontal sweep directions; never rebuilt per frame. */
const SEARCH_DIRECTIONS: readonly Vector3[] = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
  new Vector3(1, 0, 1).normalize(),
  new Vector3(1, 0, -1).normalize(),
  new Vector3(-1, 0, 1).normalize(),
  new Vector3(-1, 0, -1).normalize(),
];

/** Shared scratch: the tick allocates nothing. */
const probe = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), SEARCH_RANGE);
const scanOrigin = new Vector3();
const playerPoint = new Vector3();
const toObserver = new Vector3();
const scratchNormal = new Vector3();

/** Rebuilt whenever the runtime supplies a new collider, never per frame. */
let solidPredicate: ((mesh: AbstractMesh) => boolean) | null = null;
let solidPredicateOwner: Mesh | null = null;

function solidFilter(player: Mesh): (mesh: AbstractMesh) => boolean {
  if (solidPredicateOwner !== player || !solidPredicate) {
    solidPredicateOwner = player;
    solidPredicate = (mesh: AbstractMesh): boolean =>
      mesh instanceof Mesh && mesh !== player && mesh.checkCollisions && mesh.isEnabled();
  }
  return solidPredicate;
}

const state = {
  status: "NONE" as CoverStatus,
  ready: false,
  active: false,
  contact: false,
  lowProfile: false,
  distance: Infinity,
  normal: new Vector3(0, 0, 1),
  tangent: new Vector3(1, 0, 0),
};

let paused = false;

export function isInCover(): boolean {
  return state.active;
}

export function isCoverReady(): boolean {
  return state.ready;
}

export function getCoverState(): CoverState {
  return state;
}

/** Drop cover now. Used by RUN/JUMP exits and by pause cleanup. */
export function releaseCover(): void {
  state.active = false;
  state.contact = false;
}

/** Stop all cover raycasts while the runtime is paused, and clear the state. */
export function setCoverPaused(value: boolean): void {
  paused = value;
  if (value) releaseCover();
}

/**
 * How much this observer's view of the player is blocked by the active cover
 * surface, 0 (no help at all) .. 1 (fully behind it). Allocation-free.
 */
export function coverProtection(observer: Vector3): number {
  if (!state.active || !state.contact) return 0;
  toObserver.copyFrom(observer).subtractInPlace(playerPoint);
  toObserver.y = 0;
  const length = toObserver.length();
  if (length < 0.001) return 0;
  toObserver.scaleInPlace(1 / length);

  // normal points surface -> player, so an observer behind the surface scores -1.
  const facing = Vector3.Dot(state.normal, toObserver);
  const alignment = Math.max(0, Math.min(1, (-facing - EDGE_ALIGN_MIN) / (1 - EDGE_ALIGN_MIN)));
  const posture = state.lowProfile && !isCrouched() ? LOW_COVER_STANDING_PROTECTION : 1;
  return alignment * posture;
}

/** Detection multiplier for an observer, folding in the directional protection. */
export function coverDetectionScale(observer: Vector3): number {
  return 1 - coverProtection(observer) * COVER_MAX_DETECTION_REDUCTION;
}

function orientNormal(hitNormal: Vector3, hitDistance: number, direction: Vector3): boolean {
  scratchNormal.copyFrom(hitNormal);
  if (Math.abs(scratchNormal.y) > MAX_SURFACE_TILT) return false;
  scratchNormal.y = 0;
  if (scratchNormal.lengthSquared() < 0.0001) return false;
  scratchNormal.normalize();
  // The probe travels player -> surface, so a surface-to-player normal opposes it.
  if (Vector3.Dot(scratchNormal, direction) > 0) scratchNormal.scaleInPlace(-1);
  state.normal.copyFrom(scratchNormal);
  Vector3.CrossToRef(state.normal, UP, state.tangent);
  if (state.tangent.lengthSquared() < 0.0001) return false;
  state.tangent.normalize();
  state.distance = hitDistance;
  return true;
}

class TacticalCoverSystem {
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private lastProbeAt = 0;
  private publishedStatus: CoverStatus | null = null;
  private publishedCrouchHint = false;
  private publishedReady: boolean | null = null;

  constructor() {
    this.button = document.createElement("button");
    this.button.id = "cover";
    this.button.className = "action action-move action-cover";
    this.button.type = "button";
    this.button.textContent = "SİPER";
    this.button.disabled = true;
    this.button.setAttribute("aria-label", "Sipere gir");
    this.button.setAttribute("aria-pressed", "false");

    const observe = document.querySelector<HTMLButtonElement>("#observe");
    const actions = document.querySelector<HTMLElement>(".actions");
    if (actions) actions.insertBefore(this.button, observe ?? null);

    this.status = document.createElement("div");
    this.status.className = "cover-status hidden";
    this.status.setAttribute("aria-live", "polite");
    document.body.appendChild(this.status);
    document.body.dataset.cover = "none";

    this.button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (!state.ready) return;
      state.active = !state.active;
      if (state.active) this.lastProbeAt = 0;
      else state.contact = false;
      if (typeof navigator.vibrate === "function") navigator.vibrate(state.active ? 14 : 8);
      this.syncUi();
    });

    requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    requestAnimationFrame(this.tick);

    const scene = EngineStore.LastCreatedScene;
    const player = scene?.getMeshByName("player-collider");
    if (!scene || !(player instanceof Mesh) || paused) {
      if (state.ready || state.active) this.reset();
      return;
    }

    playerPoint.copyFrom(player.position);

    const interval = state.active ? TRACK_INTERVAL_MS : SEARCH_INTERVAL_MS;
    if (now - this.lastProbeAt >= interval) {
      this.lastProbeAt = now;
      const filter = solidFilter(player);
      if (state.active) this.trackSurface(scene, filter);
      else this.searchSurface(scene, filter);
    }

    this.syncUi();
  };

  /**
   * Cover is held: only re-check the surface we are already using. Losing it
   * (walking past the edge) drops cover the moment the probe misses.
   */
  private trackSurface(scene: Scene, filter: (mesh: AbstractMesh) => boolean): void {
    scanOrigin.copyFrom(playerPoint);
    scanOrigin.y += CONTACT_PROBE_OFFSET;
    probe.origin.copyFrom(scanOrigin);
    probe.direction.copyFrom(state.normal).scaleInPlace(-1);
    probe.length = BREAK_DISTANCE;

    const hit = scene.pickWithRay(probe, filter);
    const normal = hit?.hit ? hit.getNormal(true) : null;
    if (!hit?.hit || !normal || !orientNormal(normal, hit.distance, probe.direction)) {
      state.contact = false;
      state.ready = false;
      state.active = false;
      return;
    }

    state.contact = true;
    state.ready = true;
    state.lowProfile = !this.blocksAt(scene, filter, HEAD_PROBE_OFFSET);
  }

  /** No cover held: sweep for the nearest usable vertical surface. */
  private searchSurface(scene: Scene, filter: (mesh: AbstractMesh) => boolean): void {
    scanOrigin.copyFrom(playerPoint);
    scanOrigin.y += CONTACT_PROBE_OFFSET;
    probe.origin.copyFrom(scanOrigin);
    probe.length = SEARCH_RANGE;

    let bestDistance = Infinity;
    let bestDirection: Vector3 | null = null;
    let bestNormal: Vector3 | null = null;

    for (const direction of SEARCH_DIRECTIONS) {
      probe.direction.copyFrom(direction);
      const hit = scene.pickWithRay(probe, filter);
      if (!hit?.hit || hit.distance >= bestDistance) continue;
      const normal = hit.getNormal(true);
      if (!normal || Math.abs(normal.y) > MAX_SURFACE_TILT) continue;
      bestDistance = hit.distance;
      bestDirection = direction;
      bestNormal = normal;
    }

    if (!bestDirection || !bestNormal || bestDistance > ATTACH_DISTANCE) {
      state.ready = false;
      state.contact = false;
      state.distance = Infinity;
      return;
    }

    probe.direction.copyFrom(bestDirection);
    if (!orientNormal(bestNormal, bestDistance, bestDirection)) {
      state.ready = false;
      state.contact = false;
      return;
    }
    state.ready = true;
    state.contact = false;
    state.lowProfile = !this.blocksAt(scene, filter, HEAD_PROBE_OFFSET);
  }

  /** One extra probe telling wall-height cover apart from crate-height cover. */
  private blocksAt(scene: Scene, filter: (mesh: AbstractMesh) => boolean, height: number): boolean {
    probe.origin.copyFrom(playerPoint);
    probe.origin.y += height;
    probe.direction.copyFrom(state.normal).scaleInPlace(-1);
    probe.length = BREAK_DISTANCE;
    const hit = scene.pickWithRay(probe, filter);
    return Boolean(hit?.hit);
  }

  private reset(): void {
    state.ready = false;
    state.active = false;
    state.contact = false;
    state.distance = Infinity;
    state.lowProfile = false;
    this.syncUi();
  }

  private syncUi(): void {
    const status: CoverStatus = state.active
      ? state.contact ? "PROTECTED" : "EXPOSED"
      : state.ready ? "READY" : "NONE";
    state.status = status;

    if (this.publishedReady !== state.ready) {
      this.publishedReady = state.ready;
      this.button.disabled = !state.ready;
    }

    // The crouch hint is part of what is displayed, so it gates the write too.
    const needsCrouch = state.lowProfile && !isCrouched();
    if (this.publishedStatus === status && this.publishedCrouchHint === needsCrouch) return;
    this.publishedStatus = status;
    this.publishedCrouchHint = needsCrouch;

    const active = status === "PROTECTED" || status === "EXPOSED";
    this.button.classList.toggle("available", status === "READY");
    this.button.classList.toggle("active", active);
    this.button.classList.toggle("exposed", status === "EXPOSED");
    this.button.textContent = active ? "ÇIK" : "SİPER";
    this.button.setAttribute("aria-pressed", String(active));
    this.button.setAttribute("aria-label", active ? "Siperden çık" : "Sipere gir");

    document.body.dataset.cover = status.toLowerCase();
    document.body.classList.toggle("cover-active", active);

    if (status === "PROTECTED") {
      this.status.textContent = needsCrouch ? "SİPER · ÇÖMEL" : "SİPER · KORUNUYOR";
      this.status.classList.remove("hidden");
      return;
    }
    if (status === "EXPOSED") {
      this.status.textContent = "SİPER · AÇIKTA";
      this.status.classList.remove("hidden");
      return;
    }
    if (status === "READY") {
      this.status.textContent = "SİPER HAZIR";
      this.status.classList.remove("hidden");
      return;
    }
    this.status.classList.add("hidden");
  }
}

export const tacticalCoverSystem = new TacticalCoverSystem();
void tacticalCoverSystem;
