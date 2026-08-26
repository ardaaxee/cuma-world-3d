import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export class PlayerCharacter {
  readonly collider: Mesh;
  readonly visualRoot: TransformNode;
  readonly cameraTarget: TransformNode;
  private readonly proceduralParts: Mesh[] = [];
  private imported = false;
  private speed = 0;
  private stride = 0;

  constructor(private readonly scene: Scene) {
    this.collider = MeshBuilder.CreateCapsule("player-collider", { height: 1.72, radius: 0.34, tessellation: 8 }, scene);
    this.collider.position = new Vector3(0, 0.9, -8);
    this.collider.isVisible = false;
    this.collider.isPickable = false;
    this.collider.checkCollisions = true;
    this.collider.ellipsoid = new Vector3(0.34, 0.82, 0.34);
    this.collider.ellipsoidOffset = new Vector3(0, 0, 0);

    this.visualRoot = new TransformNode("player-visual-root", scene);
    this.visualRoot.parent = this.collider;
    this.visualRoot.position = new Vector3(0, -0.86, 0);

    this.cameraTarget = new TransformNode("player-camera-target", scene);
    this.cameraTarget.parent = this.collider;
    this.cameraTarget.position = new Vector3(0, 0.62, 0);

    this.buildProceduralFallback();
    void this.tryLoadRuntimeModel();
  }

  get position(): Vector3 {
    return this.collider.position;
  }

  move(displacement: Vector3): void {
    this.collider.moveWithCollisions(displacement);
  }

  setFacing(yaw: number, dt: number): void {
    const current = this.visualRoot.rotation.y;
    let delta = yaw - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.visualRoot.rotation.y = current + delta * (1 - Math.exp(-13 * dt));
  }

  update(speed: number, dt: number, reducedMotion: boolean): void {
    this.speed += (speed - this.speed) * (1 - Math.exp(-10 * dt));
    if (this.imported || reducedMotion) return;
    this.stride += this.speed * dt * 2.15;
    const walk = Math.min(1, this.speed / 4.15);
    const swing = Math.sin(this.stride) * 0.42 * walk;
    const bob = Math.abs(Math.sin(this.stride * 0.5)) * 0.025 * walk;
    this.visualRoot.position.y = -0.86 + bob;
    const leftArm = this.proceduralParts.find((part) => part.name === "player-left-arm");
    const rightArm = this.proceduralParts.find((part) => part.name === "player-right-arm");
    const leftLeg = this.proceduralParts.find((part) => part.name === "player-left-leg");
    const rightLeg = this.proceduralParts.find((part) => part.name === "player-right-leg");
    if (leftArm) leftArm.rotation.x = swing;
    if (rightArm) rightArm.rotation.x = -swing;
    if (leftLeg) leftLeg.rotation.x = -swing * 0.72;
    if (rightLeg) rightLeg.rotation.x = swing * 0.72;
  }

  private async tryLoadRuntimeModel(): Promise<void> {
    try {
      const response = await fetch("./assets/characters/cuma_runtime.glb", { method: "HEAD", cache: "no-store" });
      if (!response.ok) return;
      const result = await SceneLoader.ImportMeshAsync("", "./assets/characters/", "cuma_runtime.glb", this.scene);
      const root = result.meshes[0];
      if (!root) return;
      for (const part of this.proceduralParts) part.setEnabled(false);
      for (const mesh of result.meshes) {
        if (mesh.parent === null) mesh.parent = this.visualRoot;
        mesh.isPickable = false;
        if (mesh instanceof Mesh) mesh.receiveShadows = true;
      }
      root.scaling = new Vector3(1, 1, 1);
      root.position = Vector3.Zero();
      this.imported = true;
      const idle = result.animationGroups.find((group) => /idle/i.test(group.name));
      idle?.start(true, 1.0);
    } catch {
      this.imported = false;
    }
  }

  private buildProceduralFallback(): void {
    const cloth = this.material("player-cloth", new Color3(0.055, 0.065, 0.075), 0.74, 0.03);
    const skin = this.material("player-skin", new Color3(0.54, 0.39, 0.29), 0.68, 0.0);
    const shoe = this.material("player-shoe", new Color3(0.025, 0.028, 0.032), 0.62, 0.12);

    const torso = MeshBuilder.CreateCapsule("player-torso", { height: 0.72, radius: 0.24, tessellation: 8 }, this.scene);
    torso.parent = this.visualRoot;
    torso.position = new Vector3(0, 1.18, 0);
    torso.scaling = new Vector3(1.0, 1.0, 0.72);
    torso.material = cloth;
    this.proceduralParts.push(torso);

    const head = MeshBuilder.CreateSphere("player-head", { diameter: 0.38, segments: 10 }, this.scene);
    head.parent = this.visualRoot;
    head.position = new Vector3(0, 1.69, 0);
    head.material = skin;
    this.proceduralParts.push(head);

    this.limb("player-left-arm", new Vector3(-0.31, 1.2, 0), 0.62, 0.09, cloth);
    this.limb("player-right-arm", new Vector3(0.31, 1.2, 0), 0.62, 0.09, cloth);
    this.limb("player-left-leg", new Vector3(-0.13, 0.56, 0), 0.9, 0.105, cloth);
    this.limb("player-right-leg", new Vector3(0.13, 0.56, 0), 0.9, 0.105, cloth);

    for (const x of [-0.13, 0.13]) {
      const foot = MeshBuilder.CreateBox(`player-foot-${x}`, { width: 0.19, height: 0.12, depth: 0.34 }, this.scene);
      foot.parent = this.visualRoot;
      foot.position = new Vector3(x, 0.08, 0.07);
      foot.material = shoe;
      this.proceduralParts.push(foot);
    }

    for (const part of this.proceduralParts) {
      part.isPickable = false;
      part.receiveShadows = true;
    }
  }

  private limb(name: string, position: Vector3, height: number, radius: number, material: PBRMaterial): void {
    const limb = MeshBuilder.CreateCapsule(name, { height, radius, tessellation: 8 }, this.scene);
    limb.parent = this.visualRoot;
    limb.position = position;
    limb.material = material;
    limb.isPickable = false;
    this.proceduralParts.push(limb);
  }

  private material(name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    return material;
  }
}
