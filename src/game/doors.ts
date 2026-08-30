import { Mesh, MeshBuilder, type Scene, Vector3 } from "@babylonjs/core";
import "../doors.css";
import { hasStaffCredential, refreshStaffCredential } from "./access-state";

/**
 * The one door / access system.
 *
 * Every door in the facility is registered here — there is no per-room door
 * logic and no per-door animation loop. Doors animate from a single
 * system-level `updateDoors()` call driven by the runtime, and only doors that
 * are actually moving or waiting to auto-close are visited.
 *
 * Access requirements are fictional game states. Nothing here models or
 * describes a real lock, credential or security system.
 */

export type DoorAccess = "NONE" | "STAFF_CREDENTIAL" | "ACCESS_CODE" | "SECURITY_ACCESS";

export interface DoorDefinition {
  readonly id: string;
  readonly label: string;
  readonly access: DoorAccess;
  readonly position: Vector3;
  /** Span of the leaf along its wall. */
  readonly width: number;
  readonly height: number;
  readonly thickness: number;
  /** Which world axis the leaf slides along when opening. */
  readonly slideAxis: "x" | "z";
  readonly slideSign: 1 | -1;
  /** Set only where an automatic closer makes sense. */
  readonly autoCloseSeconds?: number;
  /** Whether an escalating facility may swing this door shut on its own. */
  readonly securityCloses?: boolean;
}

export interface DoorUseResult {
  readonly changed: boolean;
  readonly message: string;
  /** Where a worked door made a sound, for the runtime to feed the noise model. */
  readonly noiseAt: Vector3 | null;
  /**
   * Presentation cue for the audio owner. Deliberately separate from
   * `noiseAt`: a refused door is audible to the player but is not a gameplay
   * noise event, and an automatic security close is audible without ever
   * becoming one.
   */
  readonly audioCue: "door-open" | "door-locked" | null;
  readonly audioAt: Vector3 | null;
}

interface DoorRuntime {
  readonly def: DoorDefinition;
  readonly mesh: Mesh;
  readonly closed: Vector3;
  /** 0 closed .. 1 fully open. */
  open: number;
  target: number;
  autoCloseTimer: number;
  collides: boolean;
}

/**
 * A leaf still blocks the opening until it has slid past this fraction, so the
 * collision state never visibly disagrees with what the player sees.
 */
const COLLISION_OPEN_THRESHOLD = 0.5;
/** Full travel takes a little under half a second. */
const DOOR_SLIDE_SPEED = 2.3;
/** Intel that makes each fictional access category usable. */
const ACCESS_CODE_INTEL = "market_worker_route";
const SECURITY_ACCESS_INTEL = "market_camera";
const INTEL_REFRESH_SECONDS = 0.4;

const doors = new Map<string, DoorRuntime>();
/** Only doors that are moving or waiting to auto-close. Never a full scan. */
const active = new Set<DoorRuntime>();

let intelClock = 0;
let intelSignal = "";

let statusElement: HTMLElement | null = null;
let statusTimer = 0;
let statusText = "";

function statusNode(): HTMLElement {
  if (statusElement) return statusElement;
  const existing = document.querySelector<HTMLElement>("#door-status");
  if (existing) {
    statusElement = existing;
    return existing;
  }
  const node = document.createElement("div");
  node.id = "door-status";
  node.className = "door-status hidden";
  node.setAttribute("aria-live", "polite");
  document.body.appendChild(node);
  statusElement = node;
  return node;
}

/** Short toast for door results and fictional access requirements. */
export function showDoorStatus(text: string, seconds = 1.8): void {
  if (!text || text === statusText) {
    statusTimer = Math.max(statusTimer, seconds);
    return;
  }
  statusText = text;
  statusTimer = seconds;
  const node = statusNode();
  node.textContent = text;
  node.classList.remove("hidden");
}

function updateStatus(dt: number): void {
  if (statusTimer <= 0) return;
  statusTimer -= dt;
  if (statusTimer > 0) return;
  statusText = "";
  statusElement?.classList.add("hidden");
}

function refreshIntel(dt: number): void {
  intelClock -= dt;
  if (intelClock > 0) return;
  intelClock = INTEL_REFRESH_SECONDS;
  intelSignal = document.body.dataset.intel ?? "";
}

function hasIntel(id: string): boolean {
  if (!intelSignal) intelSignal = document.body.dataset.intel ?? "";
  return intelSignal.split(",").includes(id);
}

export function isAccessSatisfied(access: DoorAccess): boolean {
  if (access === "NONE") return true;
  if (access === "STAFF_CREDENTIAL") return hasStaffCredential();
  if (access === "ACCESS_CODE") return hasIntel(ACCESS_CODE_INTEL);
  return hasIntel(SECURITY_ACCESS_INTEL);
}

/** Short fictional requirement text shown when a door will not open. */
export function accessRequirementText(access: DoorAccess): string {
  if (access === "STAFF_CREDENTIAL") return "PERSONEL YETKİSİ GEREKLİ";
  if (access === "ACCESS_CODE") return "ÇALIŞAN RUTİNİ INTEL GEREKLİ";
  if (access === "SECURITY_ACCESS") return "GÜVENLİK KAMERA INTEL GEREKLİ";
  return "";
}

export function registerDoor(scene: Scene, def: DoorDefinition): Mesh {
  const existing = doors.get(def.id);
  if (existing) return existing.mesh;

  const mesh = MeshBuilder.CreateBox(`door-${def.id}`, {
    width: def.slideAxis === "x" ? def.width : def.thickness,
    height: def.height,
    depth: def.slideAxis === "x" ? def.thickness : def.width,
  }, scene);
  mesh.position.copyFrom(def.position);
  mesh.checkCollisions = true;
  mesh.receiveShadows = true;
  mesh.metadata = { interaction: "door", doorId: def.id, label: def.label };

  doors.set(def.id, {
    def,
    mesh,
    closed: def.position.clone(),
    open: 0,
    target: 0,
    autoCloseTimer: 0,
    collides: true,
  });
  return mesh;
}

/** Prompt text for the door the player is currently aiming at. */
export function doorPromptLabel(id: string): string {
  const door = doors.get(id);
  if (!door) return "";
  if (door.open >= 1 || door.target > 0) return `${door.def.label} · KAPAT`;
  if (!isAccessSatisfied(door.def.access)) {
    return `${door.def.label} · ${accessRequirementText(door.def.access)}`;
  }
  return `${door.def.label} · AÇ`;
}

/**
 * Toggle a door. A locked door reports its fictional requirement instead of
 * silently refusing, and never changes collision.
 */
export function tryUseDoor(id: string): DoorUseResult {
  const door = doors.get(id);
  if (!door) return { changed: false, message: "", noiseAt: null, audioCue: null, audioAt: null };

  const opening = door.target <= 0;
  if (opening && !isAccessSatisfied(door.def.access)) {
    return {
      changed: false,
      message: `${door.def.label} · ${accessRequirementText(door.def.access)}`,
      noiseAt: null,
      audioCue: "door-locked",
      audioAt: door.mesh.position,
    };
  }

  door.target = opening ? 1 : 0;
  door.autoCloseTimer = 0;
  active.add(door);

  return {
    changed: true,
    message: opening ? `${door.def.label} · AÇILDI` : `${door.def.label} · KAPANDI`,
    // A worked door is a real sound event; the runtime routes it through the
    // single authoritative noise model. Automatic closing stays silent.
    noiseAt: door.mesh.position,
    audioCue: "door-open",
    audioAt: door.mesh.position,
  };
}

/**
 * System-level animation step. Visits only the doors that are moving or
 * counting down, so idle doors cost nothing.
 */
export function updateDoors(dt: number): void {
  refreshIntel(dt);
  refreshStaffCredential(dt);
  updateStatus(dt);
  if (active.size === 0) return;
  const step = Math.max(0, Math.min(0.1, dt));

  for (const door of active) {
    if (door.open !== door.target) {
      const delta = DOOR_SLIDE_SPEED * step;
      door.open = door.target > door.open
        ? Math.min(door.target, door.open + delta)
        : Math.max(door.target, door.open - delta);

      const travel = door.def.width * door.def.slideSign * door.open;
      if (door.def.slideAxis === "x") door.mesh.position.x = door.closed.x + travel;
      else door.mesh.position.z = door.closed.z + travel;

      const shouldCollide = door.open < COLLISION_OPEN_THRESHOLD;
      if (shouldCollide !== door.collides) {
        door.collides = shouldCollide;
        door.mesh.checkCollisions = shouldCollide;
      }
      continue;
    }

    if (door.open >= 1 && door.def.autoCloseSeconds) {
      door.autoCloseTimer += step;
      if (door.autoCloseTimer >= door.def.autoCloseSeconds) {
        door.autoCloseTimer = 0;
        door.target = 0;
      }
      continue;
    }

    active.delete(door);
  }
}

/**
 * Facility escalation shuts the controlled doors it is allowed to touch. This
 * is presentation and pressure only: access requirements are untouched, so any
 * door the player is entitled to open stays openable, and doors that are the
 * alternate routes' way in are never auto-closed.
 */
export function closeSecurityDoors(): number {
  let closed = 0;
  for (const door of doors.values()) {
    if (!door.def.securityCloses || door.target <= 0) continue;
    door.target = 0;
    door.autoCloseTimer = 0;
    active.add(door);
    closed += 1;
  }
  return closed;
}

/**
 * Return every door to closed and blocking. Used when a runtime is built so a
 * reloaded session never inherits a half-open leaf.
 */
export function resetDoors(): void {
  for (const door of doors.values()) {
    door.open = 0;
    door.target = 0;
    door.autoCloseTimer = 0;
    door.collides = true;
    door.mesh.position.copyFrom(door.closed);
    door.mesh.checkCollisions = true;
  }
  active.clear();
  statusTimer = 0;
  statusText = "";
  statusElement?.classList.add("hidden");
}
