import {
  type AbstractMesh,
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Ray,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "../security-network.css";
import { coverDetectionScale, isInCover } from "./cover";
import { isCrouched } from "./input";
import {
  DECOY_AWARENESS_FLOOR,
  DECOY_NOISE_RADIUS,
  drainNoiseImpulses,
  samplePlayerNoise,
} from "./noise";
import {
  getAnchorVersion,
  getFacilityState,
  readSearchAnchor,
  reportIncident,
  type FacilityState,
} from "./facility-security";
import {
  ROUTINE_SETS,
  type RoutineSet,
  type RoutineVariant,
  type RoutineWaypoint,
  selectDwellScale,
  selectPhaseOffset,
  selectVariant,
} from "./npc-routines";
import {
  ZONE_AWARENESS_GAIN,
  ZONE_INVESTIGATE_FLOOR,
  ZONE_INVESTIGATE_THRESHOLD,
  getZoneSuspicion,
} from "./zones";

export type AwarenessState = "NORMAL" | "CURIOUS" | "SUSPICIOUS" | "ALERT";

/**
 * Hearing tuning. Every value is deliberately capped so sound alone can reach
 * CURIOUS/SUSPICIOUS but never ALERT — ordinary footsteps must not raise the
 * facility on their own.
 */
const HEARING_CEILING_BASE = 0.2;
const HEARING_CEILING_GAIN = 0.52;
/** Hard stop below the ALERT threshold (0.86); sound alone must never raise it. */
const HEARING_ABSOLUTE_CEILING = 0.84;
const HEARING_AWARENESS_RATE = 1.05;
/** Below this the player is treated as silent and no hearing work runs at all. */
const HEARING_MIN_LOUDNESS = 0.05;
/** Effective loudness below this is heard as ambience and never investigated. */
const HEARING_INVESTIGATE_EFFECTIVE = 0.34;
const HEARING_INVESTIGATE_PRESSURE = 0.42;
const HEARING_INVESTIGATE_COOLDOWN = 2.4;
const HEARING_PRESSURE_DECAY = 0.55;
const HEARING_INVESTIGATE_FLOOR_BASE = 0.24;
const HEARING_INVESTIGATE_FLOOR_GAIN = 0.16;
/** A wall muffles a sprint, it does not erase it. */
const HEARING_OCCLUSION_ATTENUATION = 0.5;
const HEARING_OCCLUSION_MIN_LOUDNESS = 0.3;
/** Cheap stand-in used when occlusion rays are disabled on the LOW tier. */
const HEARING_OCCLUSION_FALLBACK = 0.8;

const IMPULSE_AWARENESS_FLOOR_BASE = 0.2;
const IMPULSE_AWARENESS_FLOOR_GAIN = 0.14;

/** Sustained zone pressure re-checks are rare and never stack into an alert. */
const ZONE_INVESTIGATE_COOLDOWN = 9;

/** Facility posture multipliers applied to security units only. */
const POSTURE_AWARENESS_SCALE: Record<FacilityState, number> = {
  CALM: 1,
  WATCH: 1.12,
  SEARCH: 1.2,
  HIGH_ALERT: 1.3,
};

/**
 * Search presentation. The guard alternates between turning and holding so the
 * posture reads as inspecting; it changes nothing the guard knows or where it
 * goes.
 */
const SEARCH_CADENCE_HZ = 1.6;
const SEARCH_HOLD_THRESHOLD = -0.2;
/** Reduced Motion damps nonessential oscillation without hiding orientation. */
const REDUCED_PRESENTATION_SCALE = 0.55;

/** Coordinated search: guards fan out around the anchor instead of stacking. */
const SEARCH_RING_MIN = 2.4;
const SEARCH_RING_MAX = 5.2;
const SEARCH_POINT_REFRESH_SECONDS = 6.5;
const SEARCH_ASSIGN_FLOOR = 0.34;
/** Golden-angle spacing keeps consecutive assignments far apart. */
const SEARCH_ANGLE_STEP = 2.399963;

/** A guard counts as having eye contact for this long after it is lost. */
const SOCIAL_CONTACT_MEMORY = 1.3;
/** Above this the guard is too committed to accept a cover story. */
const SOCIAL_MAX_AWARENESS = 0.72;
const SOCIAL_RANGE = 6.5;
/** Bounded: a cover story calms a guard, it never blanks them. */
const SOCIAL_AWARENESS_DROP = 0.34;
const SOCIAL_AWARENESS_FLOOR = 0.08;

export interface AwarenessSnapshot {
  state: AwarenessState;
  meter: number;
  label: string;
}

type AgentConfig = {
  name: string;
  security: boolean;
  routines: RoutineSet;
  color: Color3;
};

/** How long the STAFF ROUTINE WINDOW keeps a worker on its alternate routine. */
export const STAFF_ROUTINE_WINDOW_SECONDS = 20;

type PendingBroadcast = {
  sourceIndex: number;
  point: Vector3;
  timer: number;
  severity: "SUSPICIOUS" | "ALERT";
};

/** Shared scratch state so hearing never allocates inside the sensing loop. */
const hearingPoint = new Vector3();
const hearingRay = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 1);
const searchAnchor = new Vector3();
const searchPoint = new Vector3();
const searchDirection = new Vector3();
const searchRay = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 1);
const occludesSound = (mesh: AbstractMesh): boolean =>
  mesh instanceof Mesh && mesh.checkCollisions && mesh.isEnabled();

/** A routine with its waypoint positions realised as Vector3, built once. */
interface LiveRoutine {
  readonly id: string;
  readonly waypoints: readonly { readonly position: Vector3; readonly dwell?: number; readonly sweep?: number }[];
}

function toLiveRoutine(variant: RoutineVariant): LiveRoutine {
  return {
    id: variant.id,
    waypoints: variant.waypoints.map((waypoint: RoutineWaypoint) => ({
      position: new Vector3(waypoint.x, 0, waypoint.z),
      ...(waypoint.dwell === undefined ? {} : { dwell: waypoint.dwell }),
      ...(waypoint.sweep === undefined ? {} : { sweep: waypoint.sweep }),
    })),
  };
}

class NpcAgent {
  readonly root: TransformNode;
  /** The authored routine this run picked; chosen once, never per frame. */
  private routine: LiveRoutine;
  private readonly baseRoutine: LiveRoutine;
  private readonly alternateRoutine: LiveRoutine | null;
  private readonly dwellScale: number;
  private readonly phaseOffset: number;
  private routeIndex = 1;
  private dwellRemaining = 0;
  private sweepPhase = 0;
  private alternateTimer = 0;
  private routineInterrupted = false;
  private awareness = 0;
  private state: AwarenessState = "NORMAL";
  private alertedCycle = false;
  private senseTimer = 0;
  private senseInterval = 0.11;
  private enabled = true;
  private lastSeenPosition: Vector3 | null = null;
  private investigateTimer = 0;
  private searchTimer = 0;
  private searchDirection = 1;
  private hearingPressure = 0;
  private hearingCooldown = 0;
  private occlusionRays = true;
  private contactMemory = 0;
  private posture: FacilityState = "CALM";
  private scanPhase = 0;
  /** Scales nonessential presentation motion only; never speed or knowledge. */
  private presentationScale = 1;

  constructor(
    private readonly scene: Scene,
    private readonly config: AgentConfig,
    private readonly onAlert: (name: string) => void,
    addShadowCaster: (mesh: Mesh) => void,
    runSeed: number,
  ) {
    this.baseRoutine = toLiveRoutine(selectVariant(config.routines, runSeed, config.name));
    this.alternateRoutine = config.routines.alternate ? toLiveRoutine(config.routines.alternate) : null;
    this.routine = this.baseRoutine;
    this.dwellScale = selectDwellScale(runSeed, config.name);
    this.phaseOffset = selectPhaseOffset(runSeed, config.name);
    this.sweepPhase = this.phaseOffset;
    this.root = new TransformNode(`npc-${config.name}`, scene);
    this.root.position.copyFrom(this.waypointAt(0)?.position ?? Vector3.Zero());

    const uniform = this.material(`npc-${config.name}-uniform`, config.color, 0.76, 0.03);
    const skin = this.material(`npc-${config.name}-skin`, new Color3(0.5, 0.36, 0.27), 0.7, 0.0);
    const dark = this.material(`npc-${config.name}-dark`, new Color3(0.035, 0.04, 0.045), 0.62, 0.14);

    const torso = MeshBuilder.CreateCapsule(`npc-${config.name}-torso`, { height: 0.72, radius: 0.23, tessellation: 8 }, scene);
    torso.parent = this.root;
    torso.position = new Vector3(0, 1.17, 0);
    torso.scaling = new Vector3(1, 1, 0.72);
    torso.material = uniform;
    torso.isPickable = false;
    addShadowCaster(torso);

    const head = MeshBuilder.CreateSphere(`npc-${config.name}-head`, { diameter: 0.36, segments: 8 }, scene);
    head.parent = this.root;
    head.position = new Vector3(0, 1.68, 0);
    head.material = skin;
    head.isPickable = false;
    addShadowCaster(head);

    for (const x of [-0.29, 0.29]) {
      const arm = MeshBuilder.CreateCapsule(`npc-${config.name}-arm-${x}`, { height: 0.6, radius: 0.085, tessellation: 7 }, scene);
      arm.parent = this.root;
      arm.position = new Vector3(x, 1.14, 0);
      arm.material = uniform;
      arm.isPickable = false;
    }
    for (const x of [-0.12, 0.12]) {
      const leg = MeshBuilder.CreateCapsule(`npc-${config.name}-leg-${x}`, { height: 0.84, radius: 0.1, tessellation: 7 }, scene);
      leg.parent = this.root;
      leg.position = new Vector3(x, 0.52, 0);
      leg.material = dark;
      leg.isPickable = false;
    }
  }

  update(
    dt: number,
    playerPosition: Vector3,
    playerCollider: Mesh,
    awarenessActive: boolean,
    awarenessRateScale = 1,
  ): AwarenessSnapshot {
    if (!this.enabled) return { state: "NORMAL", meter: 0, label: this.config.name };

    this.investigateTimer = Math.max(0, this.investigateTimer - dt);
    this.searchTimer = Math.max(0, this.searchTimer - dt);
    this.hearingCooldown = Math.max(0, this.hearingCooldown - dt);
    this.contactMemory = Math.max(0, this.contactMemory - dt);
    this.updatePatrol(dt);
    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      const step = this.senseInterval;
      this.senseTimer = step;
      this.updateAwareness(step, playerPosition, playerCollider, awarenessActive, awarenessRateScale);
    }
    return { state: this.state, meter: this.awareness, label: this.config.name };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.root.setEnabled(enabled);
    if (!enabled) {
      this.awareness = 0;
      this.state = "NORMAL";
      this.alertedCycle = false;
      this.investigateTimer = 0;
      this.searchTimer = 0;
      this.lastSeenPosition = null;
      this.senseTimer = this.senseInterval;
      this.hearingPressure = 0;
      this.hearingCooldown = 0;
      this.contactMemory = 0;
      // Drop back to the authored base routine so a re-enabled agent never
      // resumes mid-window with a stale alternate timer.
      this.routine = this.baseRoutine;
      this.alternateTimer = 0;
      this.dwellRemaining = 0;
      this.routineInterrupted = false;
      this.routeIndex = this.nearestWaypointIndex();
    }
  }

  setSenseInterval(seconds: number): void {
    this.senseInterval = Math.max(0.08, Math.min(0.24, seconds));
    this.senseTimer = Math.min(this.senseTimer, this.senseInterval);
  }

  /** LOW tier drops the occlusion ray and falls back to a flat attenuation. */
  setHearingOcclusion(enabled: boolean): void {
    this.occlusionRays = enabled;
  }

  /** Reduced Motion damps look/sweep amplitude; routes and timing are untouched. */
  setPresentationScale(scale: number): void {
    this.presentationScale = Math.max(0.2, Math.min(1, scale));
  }

  /**
   * React to a one-shot sound (landing, decoy). Reuses the existing
   * investigation/last-known-position behaviour instead of adding a second
   * state machine.
   */
  hearImpulse(point: Vector3, loudness: number, deliberate: boolean): void {
    if (!this.enabled) return;
    const floor = deliberate
      ? DECOY_AWARENESS_FLOOR
      : IMPULSE_AWARENESS_FLOOR_BASE + loudness * IMPULSE_AWARENESS_FLOOR_GAIN;
    this.investigate(point, floor);
    this.hearingCooldown = Math.max(this.hearingCooldown, HEARING_INVESTIGATE_COOLDOWN * 0.5);
  }

  isSecurity(): boolean {
    return this.config.security;
  }

  /** Facility posture only changes how security units behave, never workers. */
  setPosture(value: FacilityState): void {
    this.posture = this.config.security ? value : "CALM";
  }

  awarenessMeter(): number {
    return this.awareness;
  }

  awarenessState(): AwarenessState {
    return this.state;
  }

  name(): string {
    return this.config.name;
  }

  /** True while this guard still has (or just had) eye contact with the player. */
  hasRecentContact(): boolean {
    return this.contactMemory > 0;
  }

  /**
   * Bounded de-escalation from a successful cover story. It lowers this one
   * guard and nothing else, and never drops them to zero.
   */
  acceptCoverStory(): boolean {
    if (!this.enabled || this.state === "ALERT") return false;
    this.awareness = Math.max(SOCIAL_AWARENESS_FLOOR, this.awareness - SOCIAL_AWARENESS_DROP);
    this.investigateTimer = 0;
    this.searchTimer = 0;
    this.lastSeenPosition = null;
    this.hearingPressure = 0;
    this.contactMemory = 0;
    this.refreshState();
    return true;
  }

  /** Sends this guard to its own assigned search point around the anchor. */
  assignSearchPoint(point: Vector3): void {
    if (!this.enabled || !this.config.security) return;
    this.lastSeenPosition = point.clone();
    this.investigateTimer = this.posture === "HIGH_ALERT" ? 6.4 : 5.2;
    this.searchTimer = 0;
    this.awareness = Math.max(this.awareness, SEARCH_ASSIGN_FLOOR);
    this.refreshState();
  }

  lastKnownPosition(): Vector3 | null {
    return this.lastSeenPosition?.clone() ?? null;
  }

  investigate(position: Vector3, awarenessFloor?: number): void {
    if (!this.enabled || this.state === "ALERT") return;
    this.lastSeenPosition = position.clone();
    this.investigateTimer = this.config.security ? 4.6 : 3.1;
    this.searchTimer = 0;
    const floor = awarenessFloor ?? (this.config.security ? 0.3 : 0.24);
    this.awareness = Math.max(this.awareness, Math.max(0.22, Math.min(0.68, floor)));
    this.refreshState();
  }

  private updatePatrol(dt: number): void {
    // Facility posture makes security units move with more urgency; it never
    // tells them where the player is.
    const urgency = this.posture === "HIGH_ALERT" ? 1.35 : this.posture === "SEARCH" ? 1.18 : 1;
    this.updateAlternateRoutine(dt);

    if (this.lastSeenPosition && this.investigateTimer > 0 && this.state !== "NORMAL") {
      this.routineInterrupted = true;
      const investigateSpeed = (this.state === "ALERT" ? 1.18 : this.state === "SUSPICIOUS" ? 0.88 : 0.66) * urgency;
      if (this.moveToward(this.lastSeenPosition, investigateSpeed, dt) < 0.34) {
        this.investigateTimer = 0;
        this.searchTimer = this.config.security ? 3.6 : 2.2;
        this.searchDirection *= -1;
      }
      return;
    }

    if (this.searchTimer > 0 && this.state !== "NORMAL") {
      this.routineInterrupted = true;
      // Presentation only: a stepped turn/pause cadence reads as inspecting a
      // spot rather than spinning on it. The cadence comes from this agent's
      // seeded phase offset, so it is deterministic, desynchronised between
      // units, and tells the guard nothing new.
      this.sweepPhase += dt;
      const cadence = Math.sin(this.sweepPhase * SEARCH_CADENCE_HZ + this.phaseOffset);
      const inspecting = cadence < SEARCH_HOLD_THRESHOLD ? 0 : 1;
      const searchSpeed = (this.config.security ? 0.86 : 0.62) * urgency * this.presentationScale;
      this.root.rotation.y += dt * searchSpeed * this.searchDirection * inspecting;
      return;
    }

    if (this.state === "ALERT") {
      this.routineInterrupted = true;
      this.root.rotation.y += dt * 0.72 * urgency * this.presentationScale;
      return;
    }

    // Coming back from a search: resume the authored routine at the nearest
    // waypoint rather than walking back to wherever the loop happened to be.
    if (this.routineInterrupted) {
      this.routineInterrupted = false;
      this.routeIndex = this.nearestWaypointIndex();
      this.dwellRemaining = 0;
    }

    this.updateRoutine(dt);
  }

  /** Walks the authored waypoint list, holding and sweeping where authored. */
  private updateRoutine(dt: number): void {
    const waypoints = this.routine.waypoints;
    if (waypoints.length < 2) return;

    const watching = this.posture === "WATCH" && this.state === "NORMAL";
    const target = this.waypointAt(this.routeIndex);
    if (!target) return;

    if (this.dwellRemaining > 0) {
      this.dwellRemaining -= dt;
      const sweep = target.sweep ?? 0;
      if (sweep > 0) {
        // A slow authored look-around while held at the point. The per-agent
        // phase offset is what stops units sweeping in unison.
        this.sweepPhase += dt * 1.1;
        this.root.rotation.y += Math.sin(this.sweepPhase) * dt * sweep * this.presentationScale;
      }
      if (watching) {
        this.scanPhase += dt * 0.9;
        this.root.rotation.y += Math.sin(this.scanPhase) * dt * 0.55 * this.presentationScale;
      }
      if (this.dwellRemaining <= 0) this.advanceWaypoint();
      return;
    }

    const patrolSpeed = this.state === "SUSPICIOUS" ? 0.45 : this.state === "CURIOUS" ? 0.72 : 1.05;
    const distance = this.moveToward(target.position, watching ? patrolSpeed * 0.82 : patrolSpeed, dt);
    if (watching) {
      this.scanPhase += dt * 0.9;
      this.root.rotation.y += Math.sin(this.scanPhase) * dt * 0.55 * this.presentationScale;
    }
    if (distance >= 0.18) return;

    const dwell = (target.dwell ?? 0) * this.dwellScale;
    if (dwell > 0) this.dwellRemaining = dwell;
    else this.advanceWaypoint();
  }

  private advanceWaypoint(): void {
    const count = this.routine.waypoints.length;
    if (count === 0) return;
    this.routeIndex = (this.routeIndex + 1) % count;
    this.dwellRemaining = 0;
  }

  private waypointAt(index: number): LiveRoutine["waypoints"][number] | undefined {
    return this.routine.waypoints[index];
  }

  private nearestWaypointIndex(): number {
    let best = 0;
    let bestDistance = Infinity;
    this.routine.waypoints.forEach((waypoint, index) => {
      const distance = Vector3.DistanceSquared(waypoint.position, this.root.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  /** Runs down the STAFF ROUTINE WINDOW and restores the base routine after. */
  private updateAlternateRoutine(dt: number): void {
    if (this.alternateTimer <= 0) return;
    this.alternateTimer -= dt;
    if (this.alternateTimer > 0) return;
    this.routine = this.baseRoutine;
    this.routeIndex = this.nearestWaypointIndex();
    this.dwellRemaining = 0;
  }

  /**
   * Temporarily switches a worker onto its authored alternate task. Security
   * units never accept this, and it changes nothing about what anyone knows.
   */
  startAlternateRoutine(seconds: number): boolean {
    const alternate = this.alternateRoutine;
    if (!this.enabled || this.config.security || !alternate) return false;
    this.routine = alternate;
    this.routeIndex = 0;
    this.dwellRemaining = 0;
    this.alternateTimer = seconds;
    return true;
  }

  private moveToward(destination: Vector3, speed: number, dt: number): number {
    const delta = destination.subtract(this.root.position);
    delta.y = 0;
    const distance = delta.length();
    if (distance <= 0.001) return distance;
    const direction = delta.scale(1 / distance);
    this.root.position.addInPlace(direction.scale(Math.min(distance, speed * dt)));
    const targetYaw = Math.atan2(direction.x, direction.z);
    let angle = targetYaw - this.root.rotation.y;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    this.root.rotation.y += angle * (1 - Math.exp(-8 * dt));
    return distance;
  }

  private updateAwareness(
    dt: number,
    playerPosition: Vector3,
    playerCollider: Mesh,
    active: boolean,
    awarenessRateScale: number,
  ): void {
    if (!active) {
      this.awareness = Math.max(0, this.awareness - dt * 1.25);
      this.investigateTimer = 0;
      this.searchTimer = 0;
      this.lastSeenPosition = null;
      this.hearingPressure = 0;
      this.refreshState();
      return;
    }

    const covered = isInCover();
    const eye = this.root.position.add(new Vector3(0, 1.55, 0));
    const playerEye = playerPosition.add(new Vector3(0, isCrouched() ? 0.32 : covered ? 0.46 : 0.62, 0));
    const toPlayer = playerEye.subtract(eye);
    const distance = toPlayer.length();
    let visible = false;

    if (distance <= (this.config.security ? 9.0 : 6.2) && distance > 0.001) {
      const direction = toPlayer.scale(1 / distance);
      const facing = new Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
      const flatDirection = new Vector3(direction.x, 0, direction.z).normalize();
      const fovDot = Vector3.Dot(facing, flatDirection);
      const threshold = this.config.security ? 0.43 : 0.28;
      if (fovDot >= threshold) {
        const occluder = this.scene.pickWithRay(
          new Ray(eye, direction, distance),
          (mesh) => mesh instanceof Mesh && mesh.checkCollisions && mesh !== playerCollider,
        );
        visible = !occluder?.hit || (occluder.distance ?? distance) >= distance - 0.3;
      }
    }

    const rateScale = Math.max(0.42, Math.min(1.4, awarenessRateScale));
    if (visible) {
      this.contactMemory = SOCIAL_CONTACT_MEMORY;
      // Directional: cover only helps when this guard is actually on the far
      // side of the surface, so an exposed edge reads as no cover at all.
      const coverScale = coverDetectionScale(this.root.position);
      this.lastSeenPosition = playerPosition.clone();
      this.investigateTimer = this.config.security ? 3.4 : 2.4;
      this.searchTimer = 0;
      const proximity = 1 - Math.min(1, distance / (this.config.security ? 9.0 : 6.2));
      const rate = this.config.security ? 0.52 + proximity * 1.05 : 0.28 + proximity * 0.62;
      const posture = POSTURE_AWARENESS_SCALE[this.posture];
      this.awareness = Math.min(1, this.awareness + dt * rate * rateScale * coverScale * posture);
    } else {
      const decayScale = rateScale > 1 ? 0.88 : rateScale < 1 ? 1.2 : 1;
      const searchHold = this.searchTimer > 0 ? 0.62 : 1;
      this.awareness = Math.max(0, this.awareness - dt * (this.config.security ? 0.42 : 0.58) * decayScale * searchHold);
      if (this.awareness < 0.18 && this.investigateTimer <= 0 && this.searchTimer <= 0) this.lastSeenPosition = null;
    }

    this.updateHearing(dt, rateScale);
    this.refreshState();
  }

  /**
   * Hearing runs independently of the vision cone, so a guard facing away still
   * reacts to a sprint behind them. It can only ever push awareness up to a
   * loudness-derived ceiling that stays below ALERT.
   */
  private updateHearing(dt: number, rateScale: number): void {
    const noise = samplePlayerNoise();
    let effective = 0;

    if (noise.loudness > HEARING_MIN_LOUDNESS) {
      hearingPoint.copyFromFloats(noise.x, noise.y, noise.z);
      const distance = Vector3.Distance(this.root.position, hearingPoint);
      if (distance < noise.radius) {
        let attenuation = 1 - distance / noise.radius;
        if (noise.loudness >= HEARING_OCCLUSION_MIN_LOUDNESS) {
          attenuation *= this.occlusionFactor(hearingPoint, distance);
        }
        effective = noise.loudness * attenuation;
      }
    }

    if (effective >= HEARING_INVESTIGATE_EFFECTIVE) {
      this.hearingPressure = Math.min(1.5, this.hearingPressure + dt * effective);
    } else {
      this.hearingPressure = Math.max(0, this.hearingPressure - dt * HEARING_PRESSURE_DECAY);
    }

    if (effective <= 0) return;

    const ceiling = Math.min(HEARING_ABSOLUTE_CEILING, HEARING_CEILING_BASE + effective * HEARING_CEILING_GAIN);
    if (this.awareness < ceiling) {
      this.awareness = Math.min(ceiling, this.awareness + dt * effective * HEARING_AWARENESS_RATE * rateScale);
    }

    if (this.hearingPressure >= HEARING_INVESTIGATE_PRESSURE && this.hearingCooldown <= 0) {
      this.hearingCooldown = HEARING_INVESTIGATE_COOLDOWN;
      this.hearingPressure = 0;
      this.investigate(hearingPoint, HEARING_INVESTIGATE_FLOOR_BASE + effective * HEARING_INVESTIGATE_FLOOR_GAIN);
    }
  }

  private occlusionFactor(target: Vector3, distance: number): number {
    if (!this.occlusionRays) return HEARING_OCCLUSION_FALLBACK;
    if (distance <= 0.001) return 1;
    hearingRay.origin.copyFrom(this.root.position);
    hearingRay.origin.y += 1.55;
    hearingRay.direction.copyFrom(target).subtractInPlace(hearingRay.origin).normalize();
    hearingRay.length = distance;
    const blocker = this.scene.pickWithRay(hearingRay, occludesSound);
    const hitDistance = blocker?.hit ? blocker.distance ?? distance : distance;
    return hitDistance < distance - 0.35 ? HEARING_OCCLUSION_ATTENUATION : 1;
  }

  private refreshState(): void {
    const previous = this.state;
    this.state = this.awareness >= 0.86 ? "ALERT" : this.awareness >= 0.56 ? "SUSPICIOUS" : this.awareness >= 0.22 ? "CURIOUS" : "NORMAL";
    if (this.state === "ALERT" && previous !== "ALERT" && !this.alertedCycle) {
      this.alertedCycle = true;
      if (this.config.security) this.onAlert(this.config.name);
    }
    if (this.awareness < 0.32) this.alertedCycle = false;
  }

  private material(name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    return material;
  }
}

export class NpcSystem {
  private readonly agents: NpcAgent[];
  private readonly securityStates: AwarenessState[] = ["NORMAL", "NORMAL", "NORMAL"];
  private readonly networkStatus: HTMLElement;
  private pendingBroadcast: PendingBroadcast | null = null;
  private broadcastCooldown = 0;
  private networkStatusTimer = 0;
  private zoneCheckCooldown = 0;
  private searchAnchorVersion = -1;
  private searchRefreshTimer = 0;
  private searchedState: FacilityState = "CALM";

  constructor(
    private readonly scene: Scene,
    onAlert: (name: string) => void,
    addShadowCaster: (mesh: Mesh) => void,
    runSeed: number,
  ) {
    const named = (name: keyof typeof ROUTINE_SETS): RoutineSet => ROUTINE_SETS[name] ?? { variants: [] };
    this.agents = [
      new NpcAgent(scene, {
        name: "GÜVENLİK 01",
        security: true,
        routines: named("GÜVENLİK 01"),
        color: new Color3(0.07, 0.1, 0.13),
      }, onAlert, addShadowCaster, runSeed),
      new NpcAgent(scene, {
        name: "GÜVENLİK 02",
        security: true,
        routines: named("GÜVENLİK 02"),
        color: new Color3(0.08, 0.105, 0.12),
      }, onAlert, addShadowCaster, runSeed),
      new NpcAgent(scene, {
        name: "MARKET ÇALIŞANI",
        security: false,
        routines: named("MARKET ÇALIŞANI"),
        color: new Color3(0.31, 0.19, 0.09),
      }, onAlert, addShadowCaster, runSeed),
    ];

    this.networkStatus = document.createElement("div");
    this.networkStatus.className = "security-network-status hidden";
    this.networkStatus.setAttribute("aria-live", "polite");
    document.body.appendChild(this.networkStatus);

    window.addEventListener("cuma-gadget-decoy", (event) => {
      const detail = (event as CustomEvent<{ x: number; y: number; z: number }>).detail;
      if (!detail || !Number.isFinite(detail.x) || !Number.isFinite(detail.y) || !Number.isFinite(detail.z)) return;
      const point = new Vector3(detail.x, detail.y, detail.z);
      // A decoy is a believable false incident: it can seed a local search but
      // its ceiling keeps it well below a facility emergency.
      reportIncident("decoy", point.x, point.y, point.z);
      for (const agent of this.agents) {
        if (Vector3.Distance(agent.root.position, point) <= DECOY_NOISE_RADIUS) {
          agent.hearImpulse(point, 1, true);
        }
      }
    });
  }

  update(dt: number, playerPosition: Vector3, playerCollider: Mesh, awarenessActive: boolean): AwarenessSnapshot {
    this.updateSecurityNetwork(dt);
    this.dispatchNoiseImpulses(awarenessActive);
    let strongest: AwarenessSnapshot = { state: "NORMAL", meter: 0, label: "" };
    const route = document.body.dataset.route;
    const stanceRisk = isCrouched() ? 0.7 : 1;
    const zoneSuspicion = awarenessActive ? getZoneSuspicion() : 0;
    const zoneRisk = 1 + zoneSuspicion * ZONE_AWARENESS_GAIN;
    this.updateZonePressure(dt, playerPosition, zoneSuspicion);

    const facilityState = getFacilityState();
    for (const agent of this.agents) agent.setPosture(facilityState);
    this.updateCoordinatedSearch(dt, facilityState);

    for (const [index, agent] of this.agents.entries()) {
      let routeRisk = 1;
      if (route === "main") routeRisk = index === 0 ? 1.08 : index === 1 ? 0.96 : 1;
      if (route === "side") routeRisk = index === 1 ? 1.28 : index === 0 ? 0.92 : 1;
      const snapshot = agent.update(dt, playerPosition, playerCollider, awarenessActive, routeRisk * stanceRisk * zoneRisk);
      if (snapshot.meter > strongest.meter) strongest = snapshot;

      const previous = this.securityStates[index] ?? "NORMAL";
      if (awarenessActive && agent.isSecurity()) this.reportStateChange(previous, snapshot.state, agent);
      if (agent.isSecurity() && this.shouldBroadcast(previous, snapshot.state) && !this.pendingBroadcast && this.broadcastCooldown <= 0) {
        const point = agent.lastKnownPosition();
        if (point) {
          const severity = snapshot.state === "ALERT" ? "ALERT" : "SUSPICIOUS";
          this.pendingBroadcast = {
            sourceIndex: index,
            point,
            timer: severity === "ALERT" ? 0.38 : 0.9,
            severity,
          };
          this.showNetworkStatus(severity === "ALERT" ? "GÜVENLİK AĞI · ACİL KONUM AKTARIMI" : "GÜVENLİK AĞI · ŞÜPHELİ KONUM PAYLAŞILIYOR", 1.25);
        }
      }
      this.securityStates[index] = snapshot.state;
    }
    return strongest;
  }

  applyQuality(tier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA", reducedMotion = false): void {
    const senseInterval = tier === "LOW" ? 0.18 : tier === "MEDIUM" ? 0.14 : tier === "ULTRA" ? 0.09 : 0.11;
    const presentationScale = reducedMotion ? REDUCED_PRESENTATION_SCALE : 1;
    this.agents.forEach((agent, index) => {
      agent.setSenseInterval(senseInterval);
      agent.setHearingOcclusion(tier !== "LOW");
      agent.setPresentationScale(presentationScale);
      agent.setEnabled(tier !== "LOW" || index < 2);
    });
  }

  /** Feeds confirmed guard evidence up to the facility controller, once each. */
  private reportStateChange(previous: AwarenessState, current: AwarenessState, agent: NpcAgent): void {
    if (current === previous) return;
    const point = agent.root.position;
    if (current === "ALERT" && previous !== "ALERT") {
      reportIncident("guard-alert", point.x, point.y, point.z);
      return;
    }
    if (current === "SUSPICIOUS" && previous !== "SUSPICIOUS" && previous !== "ALERT") {
      reportIncident("suspicion", point.x, point.y, point.z);
      return;
    }
    // A guard turning curious — from a door, a footstep, anything — is weak
    // evidence. Its ceiling sits below the search threshold, so any number of
    // these can raise WATCH and never more.
    if (current === "CURIOUS" && previous === "NORMAL") {
      reportIncident("noise", point.x, point.y, point.z);
    }
  }

  /**
   * Fans security units out over distinct points around the facility's
   * last-known incident anchor. Points are produced only when the anchor or the
   * facility state changes, or after a refresh interval — never per frame — and
   * each candidate is rejected if a wall sits between it and the anchor.
   */
  private updateCoordinatedSearch(dt: number, facilityState: FacilityState): void {
    this.searchRefreshTimer = Math.max(0, this.searchRefreshTimer - dt);
    const searching = facilityState === "SEARCH" || facilityState === "HIGH_ALERT";
    if (!searching) {
      this.searchAnchorVersion = -1;
      this.searchedState = facilityState;
      return;
    }

    const version = getAnchorVersion();
    const stateChanged = this.searchedState !== facilityState;
    if (version === this.searchAnchorVersion && !stateChanged && this.searchRefreshTimer > 0) return;
    if (!readSearchAnchor(searchAnchor)) return;

    this.searchAnchorVersion = version;
    this.searchedState = facilityState;
    this.searchRefreshTimer = SEARCH_POINT_REFRESH_SECONDS;

    const spread = facilityState === "HIGH_ALERT" ? SEARCH_RING_MAX : SEARCH_RING_MIN + 1.2;
    let slot = 0;
    for (const agent of this.agents) {
      if (!agent.isSecurity()) continue;
      const angle = (version + slot) * SEARCH_ANGLE_STEP;
      const radius = SEARCH_RING_MIN + ((slot % 2) * 0.5 + 0.25) * (spread - SEARCH_RING_MIN);
      this.resolveSearchPoint(angle, radius);
      agent.assignSearchPoint(searchPoint);
      slot += 1;
    }
  }

  /**
   * Places one candidate on the ring and pulls it back toward the anchor if a
   * wall is in the way, so guards do not walk at a point through a wall.
   */
  private resolveSearchPoint(angle: number, radius: number): void {
    searchDirection.copyFromFloats(Math.sin(angle), 0, Math.cos(angle));
    searchRay.origin.copyFrom(searchAnchor);
    searchRay.origin.y += 0.9;
    searchRay.direction.copyFrom(searchDirection);
    searchRay.length = radius;
    const blocker = this.scene.pickWithRay(searchRay, occludesSound);
    const reach = blocker?.hit ? Math.max(0.9, (blocker.distance ?? radius) - 0.6) : radius;
    searchPoint.copyFrom(searchAnchor);
    searchPoint.addInPlace(searchDirection.scaleInPlace(reach));
    searchPoint.y = searchAnchor.y;
  }

  /**
   * The guard a cover story could currently be told to: close, looking at the
   * player, and unsettled but not committed. Returns null when nobody
   * qualifies. Reuses the sensing results already computed this frame.
   */
  socialCheckTarget(playerPosition: Vector3): { index: number; name: string; awareness: number; recentContact: boolean } | null {
    let best: { index: number; name: string; awareness: number; recentContact: boolean } | null = null;
    let bestDistance = SOCIAL_RANGE;
    for (const [index, agent] of this.agents.entries()) {
      if (!agent.isSecurity() || !agent.hasRecentContact()) continue;
      const state = agent.awarenessState();
      if (state !== "CURIOUS" && state !== "SUSPICIOUS") continue;
      if (agent.awarenessMeter() > SOCIAL_MAX_AWARENESS) continue;
      const distance = Vector3.Distance(agent.root.position, playerPosition);
      if (distance > bestDistance) continue;
      bestDistance = distance;
      best = { index, name: agent.name(), awareness: agent.awarenessMeter(), recentContact: agent.hasRecentContact() };
    }
    return best;
  }

  /**
   * STAFF ROUTINE WINDOW. Sends a worker off on an authored alternate task for
   * a bounded window, opening a gap in the staff corridor.
   *
   * It deliberately does nothing to security units, to facility heat or to what
   * anybody knows — it only changes where one worker happens to be standing.
   */
  openStaffRoutineWindow(seconds: number): boolean {
    for (const agent of this.agents) {
      if (agent.isSecurity()) continue;
      if (!agent.startAlternateRoutine(seconds)) continue;
      this.showNetworkStatus("PERSONEL RUTİNİ · KORİDOR BOŞALIYOR", 2.2);
      return true;
    }
    return false;
  }

  /** Applies the bounded de-escalation to exactly one guard. */
  resolveSocialCheck(index: number): boolean {
    const agent = this.agents[index];
    if (!agent) return false;
    if (!agent.acceptCoverStory()) return false;
    this.showNetworkStatus("PERSONEL KAYDI DOĞRULANDI", 1.6);
    return true;
  }

  /**
   * Landing bursts and other one-shot sounds reach every agent in range once.
   * The queue is always drained so nothing is replayed later, but sounds made
   * before the infiltration begins are discarded rather than acted on.
   */
  private dispatchNoiseImpulses(awarenessActive: boolean): void {
    const impulses = drainNoiseImpulses();
    if (!awarenessActive || impulses.length === 0) return;
    for (const impulse of impulses) {
      hearingPoint.copyFromFloats(impulse.x, impulse.y, impulse.z);
      for (const agent of this.agents) {
        if (Vector3.Distance(agent.root.position, hearingPoint) > impulse.radius) continue;
        agent.hearImpulse(hearingPoint, impulse.loudness, impulse.deliberate);
      }
    }
  }

  /**
   * Standing somewhere the player does not belong eventually draws a check from
   * the nearest security unit. It reuses investigation, so leaving the zone and
   * letting the pressure decay ends it.
   */
  private updateZonePressure(dt: number, playerPosition: Vector3, zoneSuspicion: number): void {
    this.zoneCheckCooldown = Math.max(0, this.zoneCheckCooldown - dt);
    if (zoneSuspicion < ZONE_INVESTIGATE_THRESHOLD || this.zoneCheckCooldown > 0) return;

    let nearest: NpcAgent | null = null;
    let nearestDistance = Infinity;
    for (const agent of this.agents) {
      if (!agent.isSecurity()) continue;
      const distance = Vector3.Distance(agent.root.position, playerPosition);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = agent;
      }
    }
    if (!nearest) return;

    this.zoneCheckCooldown = ZONE_INVESTIGATE_COOLDOWN;
    nearest.investigate(playerPosition, ZONE_INVESTIGATE_FLOOR);
    this.showNetworkStatus("GÜVENLİK · YETKİSİZ BÖLGE KONTROLÜ", 1.8);
  }

  private updateSecurityNetwork(dt: number): void {
    this.broadcastCooldown = Math.max(0, this.broadcastCooldown - dt);
    this.networkStatusTimer = Math.max(0, this.networkStatusTimer - dt);
    if (this.networkStatusTimer <= 0) {
      this.networkStatus.classList.add("hidden");
      document.body.classList.remove("security-network-active");
    }

    if (!this.pendingBroadcast) return;
    this.pendingBroadcast.timer -= dt;
    if (this.pendingBroadcast.timer > 0) return;

    const pending = this.pendingBroadcast;
    this.pendingBroadcast = null;
    const awarenessFloor = pending.severity === "ALERT" ? 0.48 : 0.34;
    let receivers = 0;
    for (const [index, agent] of this.agents.entries()) {
      if (index === pending.sourceIndex) continue;
      if (Vector3.Distance(agent.root.position, pending.point) > 17) continue;
      agent.investigate(pending.point, awarenessFloor);
      receivers += 1;
    }
    this.broadcastCooldown = pending.severity === "ALERT" ? 4.2 : 5.8;
    this.showNetworkStatus(receivers > 0 ? `GÜVENLİK AĞI · ${receivers} BİRİM ARAMAYA GEÇTİ` : "GÜVENLİK AĞI · YAKIN BİRİM YOK", 2.2);
  }

  private shouldBroadcast(previous: AwarenessState, current: AwarenessState): boolean {
    const rank = (state: AwarenessState): number => state === "ALERT" ? 3 : state === "SUSPICIOUS" ? 2 : state === "CURIOUS" ? 1 : 0;
    return rank(current) >= 2 && rank(previous) < rank(current);
  }

  private showNetworkStatus(text: string, duration: number): void {
    this.networkStatus.textContent = text;
    this.networkStatus.classList.remove("hidden");
    document.body.classList.add("security-network-active");
    this.networkStatusTimer = Math.max(this.networkStatusTimer, duration);
  }
}
