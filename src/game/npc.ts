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

  update(dt: number, playerPosition: Vector3, playerCollider: Mesh, awarenessActive: boolean): AwarenessSnapshot {
    this.updatePatrol(dt);
    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      this.senseTimer = 0.11;
      this.updateAwareness(0.11, playerPosition, playerCollider, awarenessActive);
    }
    return { state: this.state, meter: this.awareness, label: this.config.name };
  }

  setEnabled(enabled: boolean): void {
    this.root.setEnabled(enabled);
  }

  private updatePatrol(dt: number): void {
    if (this.route.length < 2 || this.state === "ALERT") return;
    const destination = this.route[this.routeIndex];
    if (!destination) return;
    const delta = destination.subtract(this.root.position);
    delta.y = 0;
    const distance = delta.length();
    if (distance < 0.18) {
      this.routeIndex = (this.routeIndex + 1) % this.route.length;
      return;
    }
    const direction = delta.scale(1 / Math.max(distance, 0.001));
    const speed = this.state === "SUSPICIOUS" ? 0.45 : this.state === "CURIOUS" ? 0.72 : 1.05;
    this.root.position.addInPlace(direction.scale(Math.min(distance, speed * dt)));
    const targetYaw = Math.atan2(direction.x, direction.z);
    let angle = targetYaw - this.root.rotation.y;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    this.root.rotation.y += angle * (1 - Math.exp(-8 * dt));
  }

  private updateAwareness(dt: number, playerPosition: Vector3, playerCollider: Mesh, active: boolean): void {
    if (!active) {
      this.awareness = Math.max(0, this.awareness - dt * 1.25);
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

    if (visible) {
      const proximity = 1 - Math.min(1, distance / (this.config.security ? 9.0 : 6.2));
      const rate = this.config.security ? 0.52 + proximity * 1.05 : 0.28 + proximity * 0.62;
      this.awareness = Math.min(1, this.awareness + dt * rate);
    } else {
      this.awareness = Math.max(0, this.awareness - dt * (this.config.security ? 0.42 : 0.58));
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
    for (const agent of this.agents) {
      const snapshot = agent.update(dt, playerPosition, playerCollider, awarenessActive);
      if (snapshot.meter > strongest.meter) strongest = snapshot;
    }
    return strongest;
  }

  applyQuality(tier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA"): void {
    this.agents.forEach((agent, index) => agent.setEnabled(tier !== "LOW" || index < 2));
  }
}
