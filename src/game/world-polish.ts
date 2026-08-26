import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { ResolvedGraphicsProfile } from "./graphics";

type ShadowRegistrar = (mesh: Mesh) => void;

export class WorldPolish {
  private readonly mediumRoot: TransformNode;
  private readonly highRoot: TransformNode;
  private readonly practicalLights: PointLight[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly registerShadowCaster: ShadowRegistrar,
  ) {
    this.mediumRoot = new TransformNode("world-polish-medium", scene);
    this.highRoot = new TransformNode("world-polish-high", scene);
    this.buildStreetLayer();
    this.buildMarketLayer();
    this.buildPracticalLighting();
  }

  applyProfile(profile: ResolvedGraphicsProfile): void {
    const mediumEnabled = profile.tier !== "LOW";
    const highEnabled = profile.tier === "HIGH" || profile.tier === "ULTRA";
    this.mediumRoot.setEnabled(mediumEnabled);
    this.highRoot.setEnabled(highEnabled);

    const lightStrength = profile.tier === "LOW" ? 0 : profile.tier === "MEDIUM" ? 0.55 : profile.tier === "HIGH" ? 0.82 : 1.02;
    for (const light of this.practicalLights) {
      light.setEnabled(lightStrength > 0);
      light.intensity = lightStrength;
    }

    this.scene.ambientColor = profile.tier === "LOW"
      ? new Color3(0.045, 0.05, 0.055)
      : new Color3(0.065, 0.07, 0.08);
  }

  private buildStreetLayer(): void {
    const concrete = this.material("polish-concrete", new Color3(0.34, 0.35, 0.34), 0.9, 0.0);
    const darkMetal = this.material("polish-dark-metal", new Color3(0.055, 0.065, 0.075), 0.38, 0.72);
    const paintedMetal = this.material("polish-painted-metal", new Color3(0.16, 0.19, 0.21), 0.58, 0.42);
    const wood = this.material("polish-street-wood", new Color3(0.32, 0.19, 0.09), 0.72, 0.02);
    const warning = this.material("polish-warning", new Color3(0.73, 0.48, 0.13), 0.6, 0.05);

    for (const x of [-8.3, -5.9, 5.9, 8.3]) {
      const bollard = MeshBuilder.CreateCylinder(`bollard-${x}`, { height: 0.76, diameter: 0.18, tessellation: 8 }, this.scene);
      bollard.parent = this.mediumRoot;
      bollard.position = new Vector3(x, 0.44, -1.3);
      bollard.material = darkMetal;
      bollard.isPickable = false;
    }

    for (const x of [-9.4, 9.4]) {
      const benchSeat = this.box(`bench-seat-${x}`, new Vector3(x, 0.48, -5.2), new Vector3(2.1, 0.12, 0.55), wood, this.mediumRoot);
      const benchBack = this.box(`bench-back-${x}`, new Vector3(x, 0.92, -5.43), new Vector3(2.1, 0.7, 0.1), wood, this.mediumRoot);
      for (const dx of [-0.78, 0.78]) {
        this.box(`bench-leg-${x}-${dx}`, new Vector3(x + dx, 0.24, -5.2), new Vector3(0.1, 0.48, 0.42), darkMetal, this.mediumRoot);
      }
      this.registerShadowCaster(benchSeat);
      this.registerShadowCaster(benchBack);
    }

    for (const [x, z] of [[-9.6, -8.4], [9.6, -8.4]] as const) {
      const bin = this.box(`street-bin-${x}`, new Vector3(x, 0.48, z), new Vector3(0.55, 0.9, 0.55), paintedMetal, this.mediumRoot);
      this.box(`street-bin-lid-${x}`, new Vector3(x, 0.96, z), new Vector3(0.62, 0.08, 0.62), darkMetal, this.mediumRoot);
      this.registerShadowCaster(bin);
    }

    for (const [x, z] of [[-9.8, -14.5], [9.8, -14.5], [-9.8, 1.2], [9.8, 1.2]] as const) {
      const pole = MeshBuilder.CreateCylinder(`street-pole-${x}-${z}`, { height: 4.8, diameter: 0.12, tessellation: 8 }, this.scene);
      pole.parent = this.mediumRoot;
      pole.position = new Vector3(x, 2.46, z);
      pole.material = darkMetal;
      pole.isPickable = false;
      const arm = this.box(`street-arm-${x}-${z}`, new Vector3(x + (x < 0 ? 0.3 : -0.3), 4.72, z), new Vector3(0.66, 0.08, 0.08), darkMetal, this.mediumRoot);
      arm.isPickable = false;
      const lamp = this.box(`street-lamp-${x}-${z}`, new Vector3(x + (x < 0 ? 0.58 : -0.58), 4.64, z), new Vector3(0.28, 0.12, 0.3), warning, this.mediumRoot);
      lamp.isPickable = false;
    }

    for (const z of [-25, -21, -17, -13]) {
      for (const x of [-7.2, 7.2]) {
        const reflector = this.box(`road-reflector-${x}-${z}`, new Vector3(x, 0.18, z), new Vector3(0.18, 0.04, 0.08), warning, this.highRoot);
        reflector.isPickable = false;
      }
    }

    const utility = this.box("utility-cabinet", new Vector3(-10.2, 0.78, 1.1), new Vector3(0.9, 1.45, 0.52), paintedMetal, this.highRoot);
    this.box("utility-door", new Vector3(-10.2, 0.8, 0.82), new Vector3(0.72, 1.18, 0.03), darkMetal, this.highRoot);
    this.registerShadowCaster(utility);

    const ramp = this.box("curb-ramp", new Vector3(0, 0.12, -9.65), new Vector3(3.6, 0.12, 1.25), concrete, this.mediumRoot);
    ramp.rotation.x = -0.035;
    ramp.isPickable = false;
  }

  private buildMarketLayer(): void {
    const charcoal = this.material("polish-charcoal", new Color3(0.075, 0.085, 0.095), 0.48, 0.48);
    const wood = this.material("polish-crate-wood", new Color3(0.42, 0.25, 0.11), 0.76, 0.01);
    const cardboard = this.material("polish-cardboard", new Color3(0.46, 0.34, 0.2), 0.88, 0.0);
    const fridge = this.material("polish-fridge", new Color3(0.11, 0.14, 0.16), 0.3, 0.58);
    const white = this.material("polish-ceiling", new Color3(0.72, 0.71, 0.66), 0.83, 0.0);
    const red = this.material("polish-sign-accent", new Color3(0.52, 0.105, 0.075), 0.52, 0.04);
    const emissive = this.material("polish-emissive", new Color3(0.8, 0.71, 0.49), 0.48, 0.0);
    emissive.emissiveColor = new Color3(0.78, 0.66, 0.42);
    emissive.emissiveIntensity = 0.8;

    this.box("market-ceiling", new Vector3(0, 4.12, 8.2), new Vector3(14.4, 0.12, 11.5), white, this.mediumRoot).isPickable = false;

    for (const z of [4.6, 7.8, 11]) {
      for (const x of [-3.6, 0, 3.6]) {
        const panel = this.box(`ceiling-panel-${x}-${z}`, new Vector3(x, 4.02, z), new Vector3(2.1, 0.035, 0.46), emissive, this.mediumRoot);
        panel.isPickable = false;
      }
    }

    for (const x of [-6.15, 6.15]) {
      this.box(`facade-pillar-${x}`, new Vector3(x, 2.1, 1.73), new Vector3(0.32, 4.0, 0.3), charcoal, this.mediumRoot);
      this.box(`facade-base-${x}`, new Vector3(x, 0.3, 1.68), new Vector3(1.1, 0.36, 0.44), charcoal, this.mediumRoot);
    }

    for (const x of [-4.8, -2.4, 2.4, 4.8]) {
      this.box(`awning-rib-${x}`, new Vector3(x, 3.42, 0.7), new Vector3(0.08, 0.11, 1.4), charcoal, this.highRoot).isPickable = false;
    }

    this.box("market-sign-backplate", new Vector3(0, 3.58, 0.91), new Vector3(5.4, 0.94, 0.08), charcoal, this.mediumRoot).isPickable = false;
    const signCore = this.box("market-sign-core", new Vector3(0, 3.58, 0.84), new Vector3(4.55, 0.56, 0.04), red, this.mediumRoot);
    signCore.isPickable = false;
    signCore.material = red;
    red.emissiveColor = new Color3(0.16, 0.015, 0.01);

    for (const [x, z, stack] of [[5.4, 12.8, 3], [4.5, 12.9, 2], [-5.25, 12.65, 2]] as const) {
      const pallet = this.box(`pallet-${x}-${z}`, new Vector3(x, 0.18, z), new Vector3(1.3, 0.16, 1.0), wood, this.mediumRoot);
      this.registerShadowCaster(pallet);
      for (let i = 0; i < stack; i++) {
        const crate = this.box(`crate-${x}-${z}-${i}`, new Vector3(x, 0.48 + i * 0.46, z), new Vector3(1.05, 0.42, 0.78), cardboard, this.mediumRoot);
        this.registerShadowCaster(crate);
      }
    }

    for (const x of [-5.8, 5.8]) {
      const cooler = this.box(`cooler-${x}`, new Vector3(x, 1.15, 10.7), new Vector3(1.45, 2.2, 0.7), fridge, this.mediumRoot);
      this.box(`cooler-glow-${x}`, new Vector3(x, 1.2, 10.31), new Vector3(1.12, 1.72, 0.03), emissive, this.mediumRoot).isPickable = false;
      this.registerShadowCaster(cooler);
    }

    for (const x of [-2.9, 0, 2.9]) {
      const checkout = this.box(`checkout-${x}`, new Vector3(x, 0.52, 4.35), new Vector3(2.1, 0.92, 0.72), charcoal, this.highRoot);
      this.box(`checkout-top-${x}`, new Vector3(x, 1.02, 4.35), new Vector3(2.2, 0.08, 0.8), fridge, this.highRoot);
      this.registerShadowCaster(checkout);
    }

    const loadingHeader = this.box("loading-header", new Vector3(6.84, 3.35, 10.2), new Vector3(0.13, 0.28, 3.2), red, this.highRoot);
    loadingHeader.isPickable = false;
  }

  private buildPracticalLighting(): void {
    const entrance = new PointLight("market-entrance-practical", new Vector3(0, 3.2, 0.55), this.scene);
    entrance.diffuse = new Color3(1.0, 0.76, 0.5);
    entrance.specular = new Color3(0.55, 0.42, 0.3);
    entrance.range = 13;
    entrance.intensity = 0;
    this.practicalLights.push(entrance);

    const interior = new PointLight("market-interior-practical", new Vector3(0, 3.45, 8.2), this.scene);
    interior.diffuse = new Color3(1.0, 0.86, 0.66);
    interior.specular = new Color3(0.38, 0.34, 0.3);
    interior.range = 12;
    interior.intensity = 0;
    this.practicalLights.push(interior);

    const loading = new PointLight("market-loading-practical", new Vector3(6.25, 2.65, 10.2), this.scene);
    loading.diffuse = new Color3(0.88, 0.72, 0.55);
    loading.specular = new Color3(0.3, 0.28, 0.26);
    loading.range = 9;
    loading.intensity = 0;
    this.practicalLights.push(loading);
  }

  private box(name: string, position: Vector3, size: Vector3, material: PBRMaterial, parent: TransformNode): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    mesh.parent = parent;
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    return mesh;
  }

  private material(name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = 0.68;
    return material;
  }
}
