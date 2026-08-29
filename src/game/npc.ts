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
import { isInCover } from "./cover";
import { isCrouched } from "./input";
import {
  DECOY_AWARENESS_FLOOR,
  DECOY_NOISE_RADIUS,
  drainNoiseImpulses,
  samplePlayerNoise,
} from "./noise";
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

export interface AwarenessSnapshot {
  state: AwarenessState;
  meter: number;
  label: string;
}

type AgentConfig = {
  name: string;
  security: boolean;
  route: Vector3[];
  color: Color3;
};

type PendingBroadcast = {
  sourceIndex: number;
  point: Vector3;
  timer: number;
  severity: "SUSPICIOUS" | "ALERT";
};

/** Shared scratch state so hearing never allocates inside the sensing loop. */
const hearingPoint = new Vector3();
const hearingRay = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 1);
const occludesSound = (mesh: AbstractMesh): boolean =>
  mesh instanceof Mesh && mesh.checkCollisions && mesh.isEnabled();

class NpcAgent {
  readonly root: TransformNode;
  private readonly route: Vector3[];
  private routeIndex = 1;
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

  constructor(
    private readonly scene: Scene,
    private readonly config: AgentConfig,
    private readonly onAlert: (name: string) => void,
    addShadowCaster: (mesh: Mesh) => void,
  ) {
    this.route = config.route;
    this.root = new TransformNode(`npc-${config.name}`, scene);
    this.root.position.copyFrom(this.route[0] ?? Vector3.Zero());

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
    if (this.lastSeenPosition && this.investigateTimer > 0 && this.state !== "NORMAL") {
      const investigateSpeed = this.state === "ALERT" ? 1.18 : this.state === "SUSPICIOUS" ? 0.88 : 0.66;
      if (this.moveToward(this.lastSeenPosition, investigateSpeed, dt) < 0.34) {
        this.investigateTimer = 0;
        this.searchTimer = this.config.security ? 3.6 : 2.2;
        this.searchDirection *= -1;
      }
      return;
    }

    if (this.searchTimer > 0 && this.state !== "NORMAL") {
      const searchSpeed = this.config.security ? 0.86 : 0.62;
      this.root.rotation.y += dt * searchSpeed * this.searchDirection;
      return;
    }

    if (this.state === "ALERT") {
      this.root.rotation.y += dt * 0.72;
      return;
    }

    if (this.route.length < 2) return;
    const destination = this.route[this.routeIndex];
    if (!destination) return;
    const distance = this.moveToward(destination, this.state === "SUSPICIOUS" ? 0.45 : this.state === "CURIOUS" ? 0.72 : 1.05, dt);
    if (distance < 0.18) this.routeIndex = (this.routeIndex + 1) % this.route.length;
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
      this.lastSeenPosition = playerPosition.clone();
      this.investigateTimer = this.config.security ? 3.4 : 2.4;
      this.searchTimer = 0;
      const proximity = 1 - Math.min(1, distance / (this.config.security ? 9.0 : 6.2));
      const rate = this.config.security ? 0.52 + proximity * 1.05 : 0.28 + proximity * 0.62;
      this.awareness = Math.min(1, this.awareness + dt * rate * rateScale);
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

  constructor(scene: Scene, onAlert: (name: string) => void, addShadowCaster: (mesh: Mesh) => void) {
    this.agents = [
      new NpcAgent(scene, {
        name: "GÜVENLİK 01",
        security: true,
        route: [new Vector3(-4.8, 0, 4.2), new Vector3(-4.8, 0, 11.8), new Vector3(-1.2, 0, 11.8), new Vector3(-1.2, 0, 4.2)],
        color: new Color3(0.07, 0.1, 0.13),
      }, onAlert, addShadowCaster),
      new NpcAgent(scene, {
        name: "GÜVENLİK 02",
        security: true,
        route: [new Vector3(4.8, 0, 11.8), new Vector3(4.8, 0, 4.5), new Vector3(2.5, 0, 4.5), new Vector3(2.5, 0, 11.8)],
        color: new Color3(0.08, 0.105, 0.12),
      }, onAlert, addShadowCaster),
      new NpcAgent(scene, {
        name: "MARKET ÇALIŞANI",
        security: false,
        route: [new Vector3(-2.8, 0, 8.2), new Vector3(1.4, 0, 8.2), new Vector3(1.4, 0, 11.0), new Vector3(-2.8, 0, 11.0)],
        color: new Color3(0.31, 0.19, 0.09),
      }, onAlert, addShadowCaster),
    ];

    this.networkStatus = document.createElement("div");
    this.networkStatus.className = "security-network-status hidden";
    this.networkStatus.setAttribute("aria-live", "polite");
    document.body.appendChild(this.networkStatus);

    window.addEventListener("cuma-gadget-decoy", (event) => {
      const detail = (event as CustomEvent<{ x: number; y: number; z: number }>).detail;
      if (!detail || !Number.isFinite(detail.x) || !Number.isFinite(detail.y) || !Number.isFinite(detail.z)) return;
      const point = new Vector3(detail.x, detail.y, detail.z);
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
    const coverRisk = isInCover() ? 0.56 : 1;
    const zoneSuspicion = awarenessActive ? getZoneSuspicion() : 0;
    const zoneRisk = 1 + zoneSuspicion * ZONE_AWARENESS_GAIN;
    this.updateZonePressure(dt, playerPosition, zoneSuspicion);

    for (const [index, agent] of this.agents.entries()) {
      let routeRisk = 1;
      if (route === "main") routeRisk = index === 0 ? 1.08 : index === 1 ? 0.96 : 1;
      if (route === "side") routeRisk = index === 1 ? 1.28 : index === 0 ? 0.92 : 1;
      const snapshot = agent.update(dt, playerPosition, playerCollider, awarenessActive, routeRisk * stanceRisk * coverRisk * zoneRisk);
      if (snapshot.meter > strongest.meter) strongest = snapshot;

      const previous = this.securityStates[index] ?? "NORMAL";
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

  applyQuality(tier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA"): void {
    const senseInterval = tier === "LOW" ? 0.18 : tier === "MEDIUM" ? 0.14 : tier === "ULTRA" ? 0.09 : 0.11;
    this.agents.forEach((agent, index) => {
      agent.setSenseInterval(senseInterval);
      agent.setHearingOcclusion(tier !== "LOW");
      agent.setEnabled(tier !== "LOW" || index < 2);
    });
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
