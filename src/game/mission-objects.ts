import { Color3, Mesh, MeshBuilder, PBRMaterial, type Scene, Vector3 } from "@babylonjs/core";

/**
 * The physical world objects Milestone 05 adds: two alternate stage solutions,
 * two optional objectives and the delivery cart.
 *
 * These are ordinary meshes carrying interaction metadata, so the runtime's one
 * existing interaction resolver picks them up exactly like doors and terminals.
 * There is no second interaction owner and no second quest manager.
 */

export type MissionObjectInteraction =
  | "manifest-ledger"
  | "verify-monitoring"
  | "objective-secondary-records"
  | "objective-shift-pattern"
  | "delivery-cart";

export interface MissionObjectMetadata {
  readonly label: string;
  readonly interaction: MissionObjectInteraction;
}

/**
 * Authored stops for the delivery cart, down the middle of the service alley.
 *
 * The alley runs x 7.5..12.7. A 1.15 m cart centred on x 9.6 leaves roughly
 * 1.5 m of clear floor on the wall side and 2.5 m on the open side, so no stop
 * can ever seal the route past it or the stock/utility doorways.
 */
export const CART_POSITIONS: readonly Vector3[] = [
  new Vector3(9.6, 0.75, 12.4),
  new Vector3(9.6, 0.75, 15.9),
  new Vector3(9.6, 0.75, 18.9),
];

/**
 * Deliberately crate height: the top lands at ~1.33 m, above the cover system's
 * 0.70 m contact probe but below its 1.45 m head probe, so it reads as low
 * cover that rewards crouching rather than a free wall.
 */
const CART_SIZE = new Vector3(1.15, 1.16, 0.78);

function material(scene: Scene, name: string, color: Color3, emissive: Color3, intensity: number): PBRMaterial {
  const created = new PBRMaterial(name, scene);
  created.albedoColor = color;
  created.emissiveColor = emissive;
  created.emissiveIntensity = intensity;
  created.roughness = 0.44;
  created.metallic = 0.22;
  return created;
}

function panel(
  scene: Scene,
  name: string,
  position: Vector3,
  size: Vector3,
  surface: PBRMaterial,
  meta: MissionObjectMetadata,
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position.copyFrom(position);
  mesh.material = surface;
  mesh.checkCollisions = false;
  mesh.metadata = meta;
  return mesh;
}

export interface MissionObjects {
  readonly ledger: Mesh;
  readonly monitoring: Mesh;
  readonly secondaryRecords: Mesh;
  readonly shiftPattern: Mesh;
  readonly cart: Mesh;
}

/**
 * Builds every Milestone 05 interactable. Positions are taken from the real
 * back-of-house and loading geometry rather than guessed, so each object sits
 * in the zone whose risk it is supposed to carry.
 */
export function buildMissionObjects(scene: Scene): MissionObjects {
  const frame = material(scene, "mission-object-frame", new Color3(0.06, 0.07, 0.08), new Color3(0.02, 0.025, 0.03), 0.2);
  const ledgerMat = material(scene, "manifest-ledger-face", new Color3(0.07, 0.065, 0.045), new Color3(0.44, 0.29, 0.09), 0.5);
  const monitorMat = material(scene, "verify-monitoring-face", new Color3(0.045, 0.07, 0.075), new Color3(0.12, 0.4, 0.44), 0.5);
  const archiveMat = material(scene, "secondary-records-face", new Color3(0.08, 0.07, 0.055), new Color3(0.36, 0.26, 0.12), 0.42);
  const boardMat = material(scene, "shift-pattern-face", new Color3(0.07, 0.075, 0.07), new Color3(0.22, 0.34, 0.2), 0.42);
  const cartMat = material(scene, "delivery-cart-body", new Color3(0.19, 0.2, 0.22), new Color3(0.03, 0.035, 0.04), 0.16);

  // MANIFEST resolution B — a stock ledger mounted on the loading bay's own
  // support post. It sits in the STAFF loading zone, so it trades back-office
  // time for service-route exposure rather than being strictly safer.
  const ledgerFrame = MeshBuilder.CreateBox("manifest-ledger-frame", { width: 0.05, height: 0.78, depth: 1.02 }, scene);
  ledgerFrame.position = new Vector3(11.755, 1.35, 12.85);
  ledgerFrame.material = frame;
  ledgerFrame.checkCollisions = false;
  const ledger = panel(
    scene,
    "manifest-ledger",
    new Vector3(11.70, 1.35, 12.85),
    new Vector3(0.09, 0.66, 0.9),
    ledgerMat,
    { label: "YÜKLEME STOK DEFTERİNİ EŞLEŞTİR", interaction: "manifest-ledger" },
  );

  // VERIFY resolution B — a read-only shipment cross-check on the monitoring
  // room's west divider, clear of the desk and monitor bank.
  const monitoring = panel(
    scene,
    "verify-monitoring",
    new Vector3(-0.78, 1.5, 20.5),
    new Vector3(0.09, 0.44, 0.68),
    monitorMat,
    { label: "SEVKİYAT ÇAPRAZ KONTROLÜNÜ OKU", interaction: "verify-monitoring" },
  );

  // Optional objective — secondary archive on the face of the records filing
  // run, just east of the cabinet so it is reachable from the room floor.
  const secondaryRecords = panel(
    scene,
    "objective-secondary-records",
    new Vector3(-6.82, 1.34, 21.4),
    new Vector3(0.2, 0.5, 0.72),
    archiveMat,
    { label: "İKİNCİL SEVKİYAT ARŞİVİNİ AL", interaction: "objective-secondary-records" },
  );

  // Optional objective — staff shift board on the corridor's west wall.
  const shiftPattern = panel(
    scene,
    "objective-shift-pattern",
    new Vector3(-7.62, 1.62, 15.4),
    new Vector3(0.12, 0.62, 1.1),
    boardMat,
    { label: "VARDİYA ÇİZELGESİNİ İNCELE", interaction: "objective-shift-pattern" },
  );

  // Delivery cart. Solid and collidable so the directional cover system finds
  // it, and short enough to read as crate-height cover that rewards crouching.
  const cart = MeshBuilder.CreateBox("delivery-cart", {
    width: CART_SIZE.x,
    height: CART_SIZE.y,
    depth: CART_SIZE.z,
  }, scene);
  cart.position.copyFrom(CART_POSITIONS[0] ?? Vector3.Zero());
  cart.material = cartMat;
  cart.checkCollisions = true;
  cart.receiveShadows = true;
  cart.metadata = { label: "SEVKİYAT ARABASINI İT", interaction: "delivery-cart" } satisfies MissionObjectMetadata;

  for (const mesh of [ledgerFrame, ledger, monitoring, secondaryRecords, shiftPattern]) {
    mesh.receiveShadows = true;
  }

  return { ledger, monitoring, secondaryRecords, shiftPattern, cart };
}
