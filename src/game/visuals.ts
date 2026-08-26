import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  Scene,
  Vector3,
} from "@babylonjs/core";
import type { ResolvedGraphicsProfile } from "./graphics";

export class VisualPolish {
  private readonly mediumDetails: Mesh[] = [];
  private readonly highDetails: Mesh[] = [];
  private readonly practicalLights: PointLight[] = [];

  constructor(private readonly scene: Scene, private readonly addShadowCaster: (mesh: Mesh) => void) {
    this.buildMarketDetails();
    this.buildStreetDetails();
  }

  applyProfile(profile: ResolvedGraphicsProfile): void {
    const medium = profile.tier !== "LOW";
    const high = profile.tier === "HIGH" || profile.tier === "ULTRA";
    for (const mesh of this.mediumDetails) mesh.setEnabled(medium);
    for (const mesh of this.highDetails) mesh.setEnabled(high);
    this.practicalLights.forEach((light, index) => {
      const enabled = high || (medium && index < 3);
      light.setEnabled(enabled);
      light.intensity = profile.tier === "ULTRA" ? 0.72 : profile.tier === "HIGH" ? 0.62 : 0.48;
    });
  }

  private buildMarketDetails(): void {
    const darkMetal = this.material("polish-dark-metal", new Color3(0.07, 0.08, 0.09), 0.34, 0.72);
    const warmMetal = this.material("polish-warm-metal", new Color3(0.27, 0.2, 0.13), 0.44, 0.48);
    const warmPaint = this.material("polish-warm-paint", new Color3(0.58, 0.46, 0.31), 0.76, 0.02);
    const packageA = this.material("package-a", new Color3(0.34, 0.16, 0.08), 0.82, 0.0);
    const packageB = this.material("package-b", new Color3(0.12, 0.23, 0.28), 0.78, 0.0);
    const ceiling = this.material("market-ceiling", new Color3(0.14, 0.145, 0.15), 0.94, 0.0);

    const ceilingPanel = this.box("market-ceiling-polish", new Vector3(0, 4.0, 8.2), new Vector3(14.4, 0.12, 11.3), ceiling);
    this.mediumDetails.push(ceilingPanel);

    for (const x of [-5.0, 0, 5.0]) {
      const rail = this.box(`ceiling-rail-${x}`, new Vector3(x, 3.79, 8.2), new Vector3(0.08, 0.08, 10.4), darkMetal);
      this.mediumDetails.push(rail);
    }

    for (const z of [4.7, 8.2, 11.7]) {
      const fixture = this.box(`market-fixture-${z}`, new Vector3(0, 3.72, z), new Vector3(3.6, 0.07, 0.12), warmMetal);
      this.mediumDetails.push(fixture);
      const light = new PointLight(`market-practical-${z}`, new Vector3(0, 3.45, z), this.scene);
      light.diffuse = new Color3(1.0, 0.77, 0.52);
      light.range = 7.5;
      light.intensity = 0.5;
      this.practicalLights.push(light);
    }

    for (const x of [-5.55, -2.0, 2.0, 5.55]) {
      const mullion = this.box(`front-mullion-${x}`, new Vector3(x, 2.15, 1.7), new Vector3(0.07, 2.55, 0.08), darkMetal);
      this.mediumDetails.push(mullion);
    }

    for (const x of [-2.1, 2.1]) {
      const bollard = MeshBuilder.CreateCylinder(`entry-bollard-${x}`, { height: 0.78, diameter: 0.16, tessellation: 8 }, this.scene);
      bollard.position = new Vector3(x, 0.42, 0.7);
      bollard.material = darkMetal;
      this.mediumDetails.push(bollard);
      this.addShadowCaster(bollard);
    }

    for (const x of [-3.9, 0, 3.9]) {
      for (const z of [6.2, 8.5]) {
        for (let level = 0; level < 3; level += 1) {
          const shelfBoard = this.box(`shelf-board-${x}-${z}-${level}`, new Vector3(x, 0.42 + level * 0.62, z), new Vector3(2.05, 0.055, 0.62), darkMetal);
          this.mediumDetails.push(shelfBoard);
          for (let slot = -2; slot <= 2; slot += 1) {
            const pack = this.box(
              `stock-pack-${x}-${z}-${level}-${slot}`,
              new Vector3(x + slot * 0.34, 0.62 + level * 0.62, z),
              new Vector3(0.25, 0.32, 0.36),
              (slot + level) % 2 === 0 ? packageA : packageB,
            );
            this.highDetails.push(pack);
          }
        }
      }
    }

    for (const x of [-6.15, 6.15]) {
      const lowerTrim = this.box(`facade-base-${x}`, new Vector3(x, 0.32, 2.0), new Vector3(2.0, 0.18, 0.58), warmPaint);
      this.mediumDetails.push(lowerTrim);
    }
  }

  private buildStreetDetails(): void {
    const poleMaterial = this.material("street-pole", new Color3(0.075, 0.085, 0.095), 0.36, 0.68);
    const concrete = this.material("street-detail-concrete", new Color3(0.34, 0.35, 0.34), 0.92, 0.0);
    const foliage = this.material("street-foliage", new Color3(0.08, 0.19, 0.09), 0.94, 0.0);
    const lampMaterial = this.material("street-lamp", new Color3(0.72, 0.56, 0.32), 0.5, 0.2);

    let lightIndex = 0;
    for (const z of [-5, -16, -27]) {
      for (const x of [-9.3, 9.3]) {
        const pole = MeshBuilder.CreateCylinder(`streetlight-pole-${x}-${z}`, { height: 4.2, diameter: 0.13, tessellation: 8 }, this.scene);
        pole.position = new Vector3(x, 2.1, z);
        pole.material = poleMaterial;
        this.mediumDetails.push(pole);
        this.addShadowCaster(pole);

        const head = this.box(`streetlight-head-${x}-${z}`, new Vector3(x, 4.12, z), new Vector3(0.6, 0.12, 0.24), lampMaterial);
        this.mediumDetails.push(head);

        if (lightIndex < 4) {
          const light = new PointLight(`street-practical-${lightIndex}`, new Vector3(x, 3.75, z), this.scene);
          light.diffuse = new Color3(1.0, 0.69, 0.39);
          light.range = 9;
          light.intensity = 0.45;
          this.practicalLights.push(light);
          lightIndex += 1;
        }
      }
    }

    for (const x of [-7.6, 7.6]) {
      const benchSeat = this.box(`bench-seat-${x}`, new Vector3(x, 0.48, -2.3), new Vector3(2.0, 0.12, 0.48), concrete);
      const benchBack = this.box(`bench-back-${x}`, new Vector3(x, 0.9, -2.52), new Vector3(2.0, 0.72, 0.1), concrete);
      this.mediumDetails.push(benchSeat, benchBack);
      this.addShadowCaster(benchSeat);

      const trunk = MeshBuilder.CreateCylinder(`tree-trunk-${x}`, { height: 2.6, diameter: 0.28, tessellation: 8 }, this.scene);
      trunk.position = new Vector3(x, 1.3, -6.0);
      trunk.material = poleMaterial;
      this.mediumDetails.push(trunk);
      const crown = MeshBuilder.CreateSphere(`tree-crown-${x}`, { diameter: 2.2, segments: 8 }, this.scene);
      crown.position = new Vector3(x, 3.1, -6.0);
      crown.scaling = new Vector3(0.9, 1.25, 0.9);
      crown.material = foliage;
      this.mediumDetails.push(crown);
      this.addShadowCaster(crown);
    }

    for (const [x, z] of [[-12.2, 5], [12.4, 8], [-13.0, -14], [13.1, -17]] as const) {
      const ac = this.box(`building-ac-${x}-${z}`, new Vector3(x, 3.4, z), new Vector3(0.58, 0.48, 0.82), concrete);
      this.highDetails.push(ac);
      const grille = this.box(`building-ac-grille-${x}-${z}`, new Vector3(x + (x < 0 ? 0.3 : -0.3), 3.4, z), new Vector3(0.03, 0.34, 0.5), poleMaterial);
      this.highDetails.push(grille);
    }
  }

  private box(name: string, position: Vector3, size: Vector3, material: PBRMaterial): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.checkCollisions = false;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    return mesh;
  }

  private material(name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = 0.7;
    return material;
  }
}
