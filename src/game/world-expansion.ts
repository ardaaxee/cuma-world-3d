import {
  Color3,
  EngineStore,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Vector3,
} from "@babylonjs/core";

class ServiceRouteExpansion {
  private built = false;

  constructor() {
    requestAnimationFrame(this.waitForWorld);
  }

  private readonly waitForWorld = (): void => {
    const scene = EngineStore.LastCreatedScene;
    const originalWall = scene?.getMeshByName("market-right");
    const floor = scene?.getMeshByName("market-floor");
    if (!scene || !(originalWall instanceof Mesh) || !(floor instanceof Mesh)) {
      requestAnimationFrame(this.waitForWorld);
      return;
    }
    if (this.built) return;
    this.built = true;
    this.build(scene, originalWall);
  };

  private build(scene: Scene, originalWall: Mesh): void {
    const wallMaterial = originalWall.material;
    originalWall.setEnabled(false);

    const wallFront = MeshBuilder.CreateBox("market-right-front-segment", {
      width: 0.45,
      height: 4.2,
      depth: 6.9,
    }, scene);
    wallFront.position = new Vector3(7.25, 2.1, 5.45);
    wallFront.material = wallMaterial;
    wallFront.checkCollisions = true;
    wallFront.receiveShadows = true;

    const wallBack = MeshBuilder.CreateBox("market-right-back-segment", {
      width: 0.45,
      height: 4.2,
      depth: 2.5,
    }, scene);
    wallBack.position = new Vector3(7.25, 2.1, 12.75);
    wallBack.material = wallMaterial;
    wallBack.checkCollisions = true;
    wallBack.receiveShadows = true;

    const oldDoor = scene.getMeshByName("side-door");
    if (oldDoor instanceof Mesh) oldDoor.setEnabled(false);

    const concrete = this.material(scene, "loading-bay-concrete", new Color3(0.28, 0.3, 0.3), 0.92, 0.0);
    const metal = this.material(scene, "loading-bay-metal", new Color3(0.055, 0.068, 0.078), 0.38, 0.7);
    const crate = this.material(scene, "loading-bay-crate", new Color3(0.34, 0.22, 0.11), 0.78, 0.02);
    const safety = this.material(scene, "loading-bay-safety", new Color3(0.62, 0.43, 0.11), 0.68, 0.08);

    const pad = this.box(scene, "loading-bay-pad", new Vector3(10.05, 0.1, 10.2), new Vector3(5.4, 0.16, 7.7), concrete, true);
    pad.receiveShadows = true;

    this.box(scene, "loading-bay-edge", new Vector3(12.7, 0.52, 10.2), new Vector3(0.22, 1.0, 7.7), metal, true);
    this.box(scene, "loading-bay-canopy", new Vector3(9.75, 3.45, 10.2), new Vector3(4.7, 0.18, 5.8), metal, false);
    this.box(scene, "loading-bay-beam-a", new Vector3(11.85, 1.72, 7.55), new Vector3(0.18, 3.35, 0.18), metal, true);
    this.box(scene, "loading-bay-beam-b", new Vector3(11.85, 1.72, 12.85), new Vector3(0.18, 3.35, 0.18), metal, true);

    const serviceStrip = this.box(scene, "service-alley-floor", new Vector3(10.1, 0.085, 17.1), new Vector3(5.2, 0.13, 6.0), concrete, true);
    serviceStrip.receiveShadows = true;
    this.box(scene, "service-alley-wall", new Vector3(12.65, 1.45, 17.1), new Vector3(0.22, 2.8, 6.0), metal, true);

    const coverCrates: Array<[number, number, number, number, number]> = [
      [9.2, 7.55, 1.25, 1.15, 1.05],
      [10.6, 8.15, 1.0, 0.78, 1.0],
      [9.5, 12.15, 1.4, 0.95, 1.1],
      [10.8, 15.7, 1.1, 1.2, 1.0],
      [9.1, 18.1, 1.35, 0.85, 1.0],
    ];
    for (const [x, z, width, height, depth] of coverCrates) {
      const box = this.box(scene, `service-cover-${x}-${z}`, new Vector3(x, height / 2 + 0.12, z), new Vector3(width, height, depth), crate, true);
      box.receiveShadows = true;
    }

    for (const [x, z] of [[8.25, 7.2], [8.25, 13.2], [11.65, 14.2]] as const) {
      const bollard = MeshBuilder.CreateCylinder(`service-bollard-${x}-${z}`, { height: 0.82, diameter: 0.16, tessellation: 10 }, scene);
      bollard.position = new Vector3(x, 0.47, z);
      bollard.material = safety;
      bollard.checkCollisions = true;
      bollard.receiveShadows = true;
    }

    const openDoor = MeshBuilder.CreateBox("side-door-open", { width: 0.11, height: 2.85, depth: 2.25 }, scene);
    openDoor.position = new Vector3(6.25, 1.52, 9.25);
    openDoor.rotation.y = -0.92;
    openDoor.material = metal;
    openDoor.checkCollisions = false;
    openDoor.receiveShadows = true;

    const bayLight = this.material(scene, "loading-bay-light", new Color3(0.18, 0.2, 0.18), 0.38, 0.2);
    bayLight.emissiveColor = new Color3(0.78, 0.68, 0.46);
    bayLight.emissiveIntensity = 0.8;
    for (const z of [8.2, 12.2, 16.0]) {
      this.box(scene, `loading-bay-light-${z}`, new Vector3(11.7, 2.65, z), new Vector3(0.12, 0.16, 0.75), bayLight, false);
    }
  }

  private box(scene: Scene, name: string, position: Vector3, size: Vector3, material: PBRMaterial, collision: boolean): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.checkCollisions = collision;
    mesh.receiveShadows = collision;
    return mesh;
  }

  private material(scene: Scene, name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = 0.66;
    return material;
  }
}

export const serviceRouteExpansion = new ServiceRouteExpansion();
void serviceRouteExpansion;
