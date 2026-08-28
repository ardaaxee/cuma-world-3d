import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { ResolvedGraphicsProfile } from "./graphics";
import { applyProceduralSurfaceDetails } from "./surface-detail";

export class VisualPolish {
  private readonly mediumDetails: Mesh[] = [];
  private readonly highDetails: Mesh[] = [];
  private readonly practicalLights: PointLight[] = [];

  constructor(private readonly scene: Scene, private readonly addShadowCaster: (mesh: Mesh) => void) {
    this.buildMarketDetails();
    this.buildStreetDetails();
    applyProceduralSurfaceDetails(this.scene);
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
    const coolerMaterial = this.material("market-cooler", new Color3(0.09, 0.12, 0.14), 0.3, 0.58);
    const crateWood = this.material("market-crate", new Color3(0.39, 0.22, 0.09), 0.79, 0.01);
    const cardboard = this.material("market-cardboard", new Color3(0.45, 0.32, 0.18), 0.9, 0.0);
    const redAccent = this.material("market-red-accent", new Color3(0.48, 0.085, 0.06), 0.54, 0.04);
    const lightPanel = this.material("market-light-panel", new Color3(0.82, 0.73, 0.55), 0.48, 0.0);
    const produceGreen = this.material("market-produce-green", new Color3(0.18, 0.38, 0.11), 0.88, 0.0);
    const produceOrange = this.material("market-produce-orange", new Color3(0.68, 0.28, 0.055), 0.82, 0.0);
    lightPanel.emissiveColor = new Color3(0.68, 0.52, 0.29);

    const ceilingPanel = this.box("market-ceiling-polish", new Vector3(0, 4.0, 8.2), new Vector3(14.4, 0.12, 11.3), ceiling);
    this.mediumDetails.push(ceilingPanel);

    for (const x of [-5.0, 0, 5.0]) {
      const rail = this.box(`ceiling-rail-${x}`, new Vector3(x, 3.79, 8.2), new Vector3(0.08, 0.08, 10.4), darkMetal);
      this.mediumDetails.push(rail);
    }

    for (const z of [4.7, 8.2, 11.7]) {
      const fixture = this.box(`market-fixture-${z}`, new Vector3(0, 3.72, z), new Vector3(3.6, 0.07, 0.12), lightPanel);
      this.mediumDetails.push(fixture);
      const light = new PointLight(`market-practical-${z}`, new Vector3(0, 3.45, z), this.scene);
      light.diffuse = new Color3(1.0, 0.77, 0.52);
      light.specular = new Color3(0.34, 0.27, 0.2);
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
      bollard.isPickable = false;
      bollard.freezeWorldMatrix();
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

    const signBack = this.box("market-sign-polish-back", new Vector3(0, 3.56, 0.9), new Vector3(5.2, 0.9, 0.08), darkMetal);
    const signCore = this.box("market-sign-polish-core", new Vector3(0, 3.56, 0.84), new Vector3(4.45, 0.53, 0.04), redAccent);
    redAccent.emissiveColor = new Color3(0.13, 0.012, 0.008);
    const wordmark = this.labelPlane(
      "market-wordmark",
      "FRESH MARKET",
      new Vector3(0, 3.56, 0.805),
      4.1,
      0.42,
      88,
      "#f5ead7",
      "transparent",
    );
    this.mediumDetails.push(signBack, signCore, wordmark);

    const address = this.labelPlane(
      "market-address",
      "27",
      new Vector3(-2.72, 2.86, 1.72),
      0.38,
      0.28,
      82,
      "#e9ddc5",
      "#15191f",
    );
    this.mediumDetails.push(address);

    const openSign = this.labelPlane(
      "market-open-sign",
      "OPEN",
      new Vector3(1.55, 2.35, 1.69),
      0.92,
      0.36,
      76,
      "#f5e7ce",
      "#7b1914",
    );
    this.highDetails.push(openSign);

    const deliverySign = this.labelPlane(
      "market-delivery-sign",
      "DELIVERY",
      new Vector3(6.995, 2.45, 10.2),
      1.35,
      0.38,
      64,
      "#ede3d0",
      "#171b20",
      Math.PI / 2,
    );
    this.highDetails.push(deliverySign);

    for (const x of [-4.8, -2.4, 2.4, 4.8]) {
      const awningRib = this.box(`awning-rib-${x}`, new Vector3(x, 3.43, 0.72), new Vector3(0.07, 0.1, 1.25), darkMetal);
      this.highDetails.push(awningRib);
    }

    for (const x of [-5.75, 5.75]) {
      const cooler = this.box(`market-cooler-${x}`, new Vector3(x, 1.18, 10.75), new Vector3(1.38, 2.18, 0.72), coolerMaterial);
      const coolerGlow = this.box(`market-cooler-glow-${x}`, new Vector3(x, 1.22, 10.37), new Vector3(1.08, 1.7, 0.025), lightPanel);
      this.mediumDetails.push(cooler, coolerGlow);
      this.addShadowCaster(cooler);
    }

    for (const x of [-2.85, 0, 2.85]) {
      const checkout = this.box(`checkout-${x}`, new Vector3(x, 0.54, 4.35), new Vector3(2.05, 0.94, 0.7), darkMetal);
      const checkoutTop = this.box(`checkout-top-${x}`, new Vector3(x, 1.04, 4.35), new Vector3(2.14, 0.08, 0.78), warmMetal);
      this.highDetails.push(checkout, checkoutTop);
      this.addShadowCaster(checkout);
    }

    for (const [x, z, levels] of [[5.2, 12.75, 3], [4.15, 12.8, 2], [-5.15, 12.65, 2]] as const) {
      const pallet = this.box(`loading-pallet-${x}-${z}`, new Vector3(x, 0.18, z), new Vector3(1.25, 0.15, 0.95), crateWood);
      this.mediumDetails.push(pallet);
      this.addShadowCaster(pallet);
      for (let level = 0; level < levels; level += 1) {
        const crate = this.box(`loading-crate-${x}-${z}-${level}`, new Vector3(x, 0.46 + level * 0.44, z), new Vector3(1.0, 0.4, 0.74), cardboard);
        this.mediumDetails.push(crate);
        this.addShadowCaster(crate);
      }
    }

    for (const [standX, material] of [[-4.9, produceGreen], [-3.7, produceOrange]] as const) {
      const stand = this.box(`produce-stand-${standX}`, new Vector3(standX, 0.56, 4.15), new Vector3(0.95, 0.82, 1.0), crateWood);
      this.highDetails.push(stand);
      this.addShadowCaster(stand);
      for (let row = 0; row < 2; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          const produce = MeshBuilder.CreateSphere(`produce-${standX}-${row}-${column}`, { diameter: 0.18, segments: 6 }, this.scene);
          produce.position = new Vector3(standX - 0.27 + column * 0.27, 1.04 + row * 0.16, 3.93 + row * 0.22);
          produce.material = material;
          produce.isPickable = false;
          produce.freezeWorldMatrix();
          this.highDetails.push(produce);
        }
      }
    }

    const entranceMat = this.box("market-entrance-mat", new Vector3(0, 0.13, 1.15), new Vector3(3.2, 0.025, 1.0), darkMetal);
    this.mediumDetails.push(entranceMat);

    const loadingHeader = this.box("loading-door-header", new Vector3(6.84, 3.35, 10.2), new Vector3(0.12, 0.26, 3.15), redAccent);
    this.highDetails.push(loadingHeader);
  }

  private buildStreetDetails(): void {
    const poleMaterial = this.material("street-pole", new Color3(0.075, 0.085, 0.095), 0.36, 0.68);
    const concrete = this.material("street-detail-concrete", new Color3(0.34, 0.35, 0.34), 0.92, 0.0);
    const foliage = this.material("street-foliage", new Color3(0.08, 0.19, 0.09), 0.94, 0.0);
    const lampMaterial = this.material("street-lamp", new Color3(0.72, 0.56, 0.32), 0.5, 0.2);
    const utilityMaterial = this.material("street-utility", new Color3(0.14, 0.17, 0.19), 0.56, 0.38);
    lampMaterial.emissiveColor = new Color3(0.28, 0.18, 0.07);

    let lightIndex = 0;
    for (const z of [-5, -16, -27]) {
      for (const x of [-9.3, 9.3]) {
        const pole = MeshBuilder.CreateCylinder(`streetlight-pole-${x}-${z}`, { height: 4.2, diameter: 0.13, tessellation: 8 }, this.scene);
        pole.position = new Vector3(x, 2.1, z);
        pole.material = poleMaterial;
        pole.isPickable = false;
        pole.freezeWorldMatrix();
        this.mediumDetails.push(pole);
        this.addShadowCaster(pole);

        const head = this.box(`streetlight-head-${x}-${z}`, new Vector3(x, 4.12, z), new Vector3(0.6, 0.12, 0.24), lampMaterial);
        this.mediumDetails.push(head);

        if (lightIndex < 4) {
          const light = new PointLight(`street-practical-${lightIndex}`, new Vector3(x, 3.75, z), this.scene);
          light.diffuse = new Color3(1.0, 0.69, 0.39);
          light.specular = new Color3(0.24, 0.19, 0.14);
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
      trunk.isPickable = false;
      trunk.freezeWorldMatrix();
      this.mediumDetails.push(trunk);
      const crown = MeshBuilder.CreateSphere(`tree-crown-${x}`, { diameter: 2.2, segments: 8 }, this.scene);
      crown.position = new Vector3(x, 3.1, -6.0);
      crown.scaling = new Vector3(0.9, 1.25, 0.9);
      crown.material = foliage;
      crown.isPickable = false;
      crown.freezeWorldMatrix();
      this.mediumDetails.push(crown);
      this.addShadowCaster(crown);
    }

    for (const [x, z] of [[-12.2, 5], [12.4, 8], [-13.0, -14], [13.1, -17]] as const) {
      const ac = this.box(`building-ac-${x}-${z}`, new Vector3(x, 3.4, z), new Vector3(0.58, 0.48, 0.82), concrete);
      this.highDetails.push(ac);
      const grille = this.box(`building-ac-grille-${x}-${z}`, new Vector3(x + (x < 0 ? 0.3 : -0.3), 3.4, z), new Vector3(0.03, 0.34, 0.5), poleMaterial);
      this.highDetails.push(grille);
    }

    for (const [x, z] of [[-9.7, -8.3], [9.7, -8.3]] as const) {
      const bin = this.box(`street-bin-${x}`, new Vector3(x, 0.48, z), new Vector3(0.54, 0.88, 0.54), utilityMaterial);
      const lid = this.box(`street-bin-lid-${x}`, new Vector3(x, 0.95, z), new Vector3(0.61, 0.07, 0.61), poleMaterial);
      this.mediumDetails.push(bin, lid);
      this.addShadowCaster(bin);
    }

    const utility = this.box("street-utility-cabinet", new Vector3(-10.15, 0.78, 1.05), new Vector3(0.86, 1.42, 0.5), utilityMaterial);
    const utilityDoor = this.box("street-utility-door", new Vector3(-10.15, 0.8, 0.78), new Vector3(0.68, 1.16, 0.03), poleMaterial);
    this.highDetails.push(utility, utilityDoor);
    this.addShadowCaster(utility);
  }

  private labelPlane(
    name: string,
    text: string,
    position: Vector3,
    width: number,
    height: number,
    fontSize: number,
    color: string,
    background: string,
    rotationY = 0,
  ): Mesh {
    const texture = new DynamicTexture(`${name}-texture`, { width: 1024, height: 256 }, this.scene, false);
    texture.hasAlpha = true;
    texture.drawText(text, null, 170, `700 ${fontSize}px Arial`, color, background, true, true);

    const material = new StandardMaterial(`${name}-material`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.backFaceCulling = false;
    material.disableLighting = true;

    const plane = MeshBuilder.CreatePlane(name, { width, height }, this.scene);
    plane.position.copyFrom(position);
    plane.rotation.y = rotationY;
    plane.material = material;
    plane.isPickable = false;
    plane.freezeWorldMatrix();
    return plane;
  }

  private box(name: string, position: Vector3, size: Vector3, material: PBRMaterial): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.checkCollisions = false;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
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
