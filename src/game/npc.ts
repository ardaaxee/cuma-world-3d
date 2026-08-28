import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Ray,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

export type AwarenessState = "NORMAL" | "CURIOUS" | "SUSPICIOUS" | "ALERT";

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
      this.lastSeenPosition = null;
      this.senseTimer = this.senseInterval;
    }
  }

  setSenseInterval(seconds: number): void {
    this.senseInterval = Math.max(0.08, Math.min(0.24, seconds));
    this.senseTimer = Math.min(this.senseTimer, this.senseInterval);
  }

  private updatePatrol(dt: number): void {
    if (this.state === "ALERT") return;

    if (this.lastSeenPosition && this.investigateTimer > 0 && (this.state === "CURIOUS" || this.state === "SUSPICIOUS")) {
      const investigateSpeed = this.state === "SUSPICIOUS" ? 0.82 : 0.62;
      if (this.moveToward(this.lastSeenPosition, investigateSpeed, dt) < 0.34) this.investigateTimer = 0;
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
      this.lastSeenPosition = null;
      this.refreshState();
      return;
    }

    const eye = this.root.position.add(new Vector3(0, 1.55, 0));
    const playerEye = playerPosition.add(new Vector3(0, 0.62, 0));
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

    const rateScale = Math.max(0.7, Math.min(1.4, awarenessRateScale));
    if (visible) {
      this.lastSeenPosition = playerPosition.clone();
      this.investigateTimer = this.config.security ? 3.4 : 2.4;
      const proximity = 1 - Math.min(1, distance / (this.config.security ? 9.0 : 6.2));
      const rate = this.config.security ? 0.52 + proximity * 1.05 : 0.28 + proximity * 0.62;
      this.awareness = Math.min(1, this.awareness + dt * rate * rateScale);
    } else {
      const decayScale = rateScale > 1 ? 0.88 : rateScale < 1 ? 1.12 : 1;
      this.awareness = Math.max(0, this.awareness - dt * (this.config.security ? 0.42 : 0.58) * decayScale);
      if (this.awareness < 0.18 && this.investigateTimer <= 0) this.lastSeenPosition = null;
    }

    this.refreshState();
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
  }

  update(dt: number, playerPosition: Vector3, playerCollider: Mesh, awarenessActive: boolean): AwarenessSnapshot {
    let strongest: AwarenessSnapshot = { state: "NORMAL", meter: 0, label: "" };
    const route = document.body.dataset.route;
    for (const [index, agent] of this.agents.entries()) {
      let routeRisk = 1;
      if (route === "main") routeRisk = index === 0 ? 1.08 : index === 1 ? 0.96 : 1;
      if (route === "side") routeRisk = index === 1 ? 1.28 : index === 0 ? 0.92 : 1;
      const snapshot = agent.update(dt, playerPosition, playerCollider, awarenessActive, routeRisk);
      if (snapshot.meter > strongest.meter) strongest = snapshot;
    }
    return strongest;
  }

  applyQuality(tier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA"): void {
    const senseInterval = tier === "LOW" ? 0.18 : tier === "MEDIUM" ? 0.14 : tier === "ULTRA" ? 0.09 : 0.11;
    this.agents.forEach((agent, index) => {
      agent.setSenseInterval(senseInterval);
      agent.setEnabled(tier !== "LOW" || index < 2);
    });
  }
}
