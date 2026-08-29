import {
  Color3,
  EngineStore,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { registerDoor } from "./doors";

/** Back-of-house shell. Chosen from the real market geometry, not guessed. */
const BOH_MIN_X = -8.0;
const BOH_MAX_X = 7.4;
const BOH_MIN_Z = 14.0;
const BOH_MAX_Z = 22.6;
const BOH_WALL_HEIGHT = 3.6;
const BOH_WALL_Y = BOH_WALL_HEIGHT / 2;
/** Partition between the staff corridor and the back-of-house rooms. */
const PARTITION_Z = 17.3;
const DOOR_WIDTH = 1.8;
const DOOR_HEIGHT = 2.6;
const DOOR_THICKNESS = 0.12;
const DOOR_Y = DOOR_HEIGHT / 2;

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

    this.buildBackOfHouse(scene, metal, crate, bayLight);
  }

  /**
   * Connected back-of-house: staff corridor spine, records room, monitoring
   * room and a utility nook that links the service alley back into the
   * corridor. Materials are reused across the whole block and every static
   * mesh is frozen.
   */
  private buildBackOfHouse(
    scene: Scene,
    metal: PBRMaterial,
    crate: PBRMaterial,
    fixture: PBRMaterial,
  ): void {
    const wall = this.material(scene, "boh-wall", new Color3(0.42, 0.41, 0.38), 0.9, 0.0);
    const floorMaterial = this.material(scene, "boh-floor", new Color3(0.26, 0.25, 0.23), 0.86, 0.02);
    const screen = this.material(scene, "boh-screen", new Color3(0.05, 0.07, 0.08), 0.4, 0.2);
    screen.emissiveColor = new Color3(0.16, 0.42, 0.44);
    screen.emissiveIntensity = 0.95;

    const centerX = (BOH_MIN_X + BOH_MAX_X + 0.1) / 2;
    const centerZ = (BOH_MIN_Z + BOH_MAX_Z) / 2;
    const spanX = BOH_MAX_X + 0.1 - BOH_MIN_X;
    const spanZ = BOH_MAX_Z - BOH_MIN_Z;

    // The slab deliberately overruns south into the market floor and east into
    // the service alley so no 0.1 m seam can catch the player capsule.
    const floorMinX = BOH_MIN_X;
    const floorMaxX = 7.6;
    const floorMinZ = 13.5;
    const floor = this.box(
      scene,
      "boh-floor-slab",
      new Vector3((floorMinX + floorMaxX) / 2, 0.1, (floorMinZ + BOH_MAX_Z) / 2),
      new Vector3(floorMaxX - floorMinX, 0.18, BOH_MAX_Z - floorMinZ),
      floorMaterial,
      true,
    );
    floor.receiveShadows = true;
    this.box(scene, "boh-ceiling", new Vector3(centerX, BOH_WALL_HEIGHT + 0.02, centerZ), new Vector3(spanX, 0.24, spanZ), wall, false);

    // Shell.
    this.box(scene, "boh-north-wall", new Vector3(centerX, BOH_WALL_Y, BOH_MAX_Z), new Vector3(spanX, BOH_WALL_HEIGHT, 0.4), wall, true);
    this.box(scene, "boh-west-wall", new Vector3(BOH_MIN_X + 0.1, BOH_WALL_Y, centerZ), new Vector3(0.4, BOH_WALL_HEIGHT, spanZ), wall, true);

    // East wall with the stock and utility openings onto the service alley.
    this.box(scene, "boh-east-a", new Vector3(BOH_MAX_X - 0.2, BOH_WALL_Y, 14.35), new Vector3(0.4, BOH_WALL_HEIGHT, 0.7), wall, true);
    this.box(scene, "boh-east-b", new Vector3(BOH_MAX_X - 0.2, BOH_WALL_Y, 17.4), new Vector3(0.4, BOH_WALL_HEIGHT, 1.8), wall, true);
    this.box(scene, "boh-east-c", new Vector3(BOH_MAX_X - 0.2, BOH_WALL_Y, 21.35), new Vector3(0.4, BOH_WALL_HEIGHT, 2.5), wall, true);

    // Corridor / room partition with the back-office and security openings and
    // an open utility passage that closes the internal loop.
    this.box(scene, "boh-partition-a", new Vector3(-6.8, BOH_WALL_Y, PARTITION_Z), new Vector3(2.4, BOH_WALL_HEIGHT, 0.35), wall, true);
    this.box(scene, "boh-partition-b", new Vector3(-1.3, BOH_WALL_Y, PARTITION_Z), new Vector3(5.0, BOH_WALL_HEIGHT, 0.35), wall, true);
    this.box(scene, "boh-partition-c", new Vector3(4.3, BOH_WALL_Y, PARTITION_Z), new Vector3(2.6, BOH_WALL_HEIGHT, 0.35), wall, true);

    // Room dividers.
    this.box(scene, "boh-divider-office", new Vector3(-1.0, BOH_WALL_Y, 19.95), new Vector3(0.35, BOH_WALL_HEIGHT, 5.3), wall, true);
    this.box(scene, "boh-divider-utility", new Vector3(5.4, BOH_WALL_Y, 19.95), new Vector3(0.35, BOH_WALL_HEIGHT, 5.3), wall, true);

    // Corridor sightline break, plus cover that suits the directional SİPER system.
    this.box(scene, "boh-corridor-stub", new Vector3(-0.4, BOH_WALL_Y, 14.85), new Vector3(0.35, BOH_WALL_HEIGHT, 1.7), wall, true);
    this.box(scene, "boh-corridor-pallet", new Vector3(3.4, 0.65, 15.9), new Vector3(1.3, 1.05, 1.0), crate, true);
    this.box(scene, "boh-corridor-crate", new Vector3(-3.6, 0.7, 16.4), new Vector3(1.2, 1.15, 1.0), crate, true);

    // Records room: desk, filing runs and document crates.
    this.box(scene, "boh-records-desk", new Vector3(-5.4, 0.62, 20.6), new Vector3(2.8, 1.18, 1.1), crate, true);
    this.box(scene, "boh-records-desktop", new Vector3(-5.4, 1.24, 20.6), new Vector3(2.96, 0.12, 1.2), metal, false);
    this.box(scene, "boh-records-filing-a", new Vector3(-7.4, 1.05, 18.8), new Vector3(0.9, 2.05, 1.4), metal, true);
    this.box(scene, "boh-records-filing-b", new Vector3(-7.4, 1.05, 21.4), new Vector3(0.9, 2.05, 1.4), metal, true);
    this.box(scene, "boh-records-shelf", new Vector3(-1.4, 1.05, 19.2), new Vector3(0.5, 2.05, 1.8), metal, true);
    this.box(scene, "boh-records-crate", new Vector3(-3.0, 0.62, 18.4), new Vector3(1.1, 1.0, 0.9), crate, true);

    // Monitoring room: desk, monitor bank and a cabinet that works as cover.
    this.box(scene, "boh-security-desk", new Vector3(2.2, 0.62, 21.8), new Vector3(3.6, 1.18, 0.9), metal, true);
    this.box(scene, "boh-security-monitors", new Vector3(2.2, 1.75, 22.25), new Vector3(3.2, 0.9, 0.1), screen, false);
    this.box(scene, "boh-security-cabinet", new Vector3(4.6, 1.05, 19.0), new Vector3(0.8, 2.05, 1.6), metal, true);

    // Utility nook.
    this.box(scene, "boh-utility-cabinet-a", new Vector3(6.9, 1.1, 17.9), new Vector3(0.55, 2.0, 0.9), metal, true);
    this.box(scene, "boh-utility-cabinet-b", new Vector3(6.9, 1.1, 21.4), new Vector3(0.55, 2.0, 0.9), metal, true);

    // Emissive fixtures only; the block adds no dynamic lights.
    for (const [x, z] of [[-4.5, 15.6], [1.6, 15.6], [-4.5, 20.0], [2.2, 20.0], [6.4, 19.5]] as const) {
      this.box(scene, `boh-fixture-${x}-${z}`, new Vector3(x, BOH_WALL_HEIGHT - 0.22, z), new Vector3(1.1, 0.1, 0.16), fixture, false);
    }

    // Headers over every opening so no doorway leaves a hole in the wall above.
    this.box(scene, "boh-lintel-stock", new Vector3(BOH_MAX_X - 0.2, 3.1, 15.6), new Vector3(0.4, 1.0, 1.8), wall, true);
    this.box(scene, "boh-lintel-utility", new Vector3(BOH_MAX_X - 0.2, 3.1, 19.2), new Vector3(0.4, 1.0, 1.8), wall, true);
    this.box(scene, "boh-lintel-office", new Vector3(-4.7, 3.1, PARTITION_Z), new Vector3(1.8, 1.0, 0.35), wall, true);
    this.box(scene, "boh-lintel-security", new Vector3(2.1, 3.1, PARTITION_Z), new Vector3(1.8, 1.0, 0.35), wall, true);
    this.box(scene, "boh-lintel-passage", new Vector3(6.4, 3.1, PARTITION_Z), new Vector3(1.6, 1.0, 0.35), wall, true);

    this.replaceMarketBackWall(scene);
    this.registerFacilityDoors(scene, metal);
  }

  /** Splits the market rear wall so the controlled staff opening can exist. */
  private replaceMarketBackWall(scene: Scene): void {
    const original = scene.getMeshByName("market-back");
    if (!(original instanceof Mesh)) return;
    const material = original.material;
    original.setEnabled(false);

    for (const [name, centerX, width, centerY, height] of [
      ["market-back-west", -5.2, 4.6, 2.1, 4.2],
      ["market-back-east", 3.2, 8.6, 2.1, 4.2],
      // Header over the controlled staff opening.
      ["market-back-lintel", -2.0, 1.8, 3.4, 1.6],
    ] as const) {
      const segment = MeshBuilder.CreateBox(name, { width, height, depth: 0.45 }, scene);
      segment.position = new Vector3(centerX, centerY, 14);
      segment.material = material;
      segment.checkCollisions = true;
      segment.receiveShadows = true;
      segment.freezeWorldMatrix();
    }
  }

  private registerFacilityDoors(scene: Scene, material: PBRMaterial): void {
    const doors = [
      {
        id: "staff-market", label: "PERSONEL KAPISI", access: "STAFF_CREDENTIAL" as const,
        position: new Vector3(-2.0, DOOR_Y, 14), slideAxis: "x" as const, slideSign: -1 as const,
        autoCloseSeconds: 8,
      },
      {
        id: "stock-service", label: "STOK KAPISI", access: "NONE" as const,
        position: new Vector3(BOH_MAX_X - 0.2, DOOR_Y, 15.6), slideAxis: "z" as const, slideSign: 1 as const,
      },
      {
        id: "utility-service", label: "TESİSAT KAPISI", access: "ACCESS_CODE" as const,
        position: new Vector3(BOH_MAX_X - 0.2, DOOR_Y, 19.2), slideAxis: "z" as const, slideSign: 1 as const,
      },
      {
        id: "back-office", label: "ARKA OFİS KAPISI", access: "NONE" as const,
        position: new Vector3(-4.7, DOOR_Y, PARTITION_Z), slideAxis: "x" as const, slideSign: -1 as const,
      },
      {
        id: "security-room", label: "GÜVENLİK ODASI KAPISI", access: "SECURITY_ACCESS" as const,
        position: new Vector3(2.1, DOOR_Y, PARTITION_Z), slideAxis: "x" as const, slideSign: -1 as const,
      },
    ];

    for (const door of doors) {
      const mesh = registerDoor(scene, {
        id: door.id,
        label: door.label,
        access: door.access,
        position: door.position,
        width: DOOR_WIDTH,
        height: DOOR_HEIGHT,
        thickness: DOOR_THICKNESS,
        slideAxis: door.slideAxis,
        slideSign: door.slideSign,
        autoCloseSeconds: door.autoCloseSeconds,
      });
      mesh.material = material;
    }
  }

  /** Every mesh built here is static structural geometry, so freeze it. */
  private box(scene: Scene, name: string, position: Vector3, size: Vector3, material: PBRMaterial, collision: boolean): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.checkCollisions = collision;
    mesh.receiveShadows = collision;
    mesh.freezeWorldMatrix();
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
