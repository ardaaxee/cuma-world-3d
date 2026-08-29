import { hasStaffCredential, refreshStaffCredential, resetStaffCredential, setStaffCredentialOverride } from "./access-state";
import { isCrouched } from "./input";
import { isInCover } from "./cover";

/**
 * Reusable access-zone model.
 *
 * Zones are simple axis-aligned volumes over the existing world geometry — no
 * second map is built. The volume list is data, so later back-office / security
 * rooms only need another entry rather than another system.
 */

export type ZoneId = "PUBLIC" | "STAFF" | "RESTRICTED";

export interface ZoneSnapshot {
  readonly zone: ZoneId;
  readonly label: string;
  /** 0..1 pressure caused purely by standing somewhere the player does not belong. */
  readonly suspicion: number;
  readonly accessGranted: boolean;
}

interface ZoneVolume {
  readonly id: ZoneId;
  readonly label: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Ordered most specific first; the first containing volume wins. Coordinates
 * follow the market shell built in `runtime11.ts` and the service route added by
 * `world-expansion.ts`.
 */
const ZONE_VOLUMES: readonly ZoneVolume[] = [
  // Back-of-house records room holding the manifest terminal.
  { id: "RESTRICTED", label: "ARKA OFİS", minX: -8.1, maxX: -1.0, minY: -1.5, maxY: 5.2, minZ: 17.3, maxZ: 22.7 },
  // Monitoring room holding the CCTV control panel.
  { id: "RESTRICTED", label: "GÜVENLİK ODASI", minX: -1.0, maxX: 5.4, minY: -1.5, maxY: 5.2, minZ: 17.3, maxZ: 22.7 },
  // Narrow service nook linking the corridor to the service alley.
  { id: "STAFF", label: "TESİSAT NİŞİ", minX: 5.4, maxX: 7.5, minY: -1.5, maxY: 5.2, minZ: 17.3, maxZ: 22.7 },
  // Back-of-house spine.
  { id: "STAFF", label: "PERSONEL KORİDORU", minX: -8.1, maxX: 7.4, minY: -1.5, maxY: 5.2, minZ: 14.0, maxZ: 17.3 },
  // Delivery counter at the rear of the sales floor.
  { id: "STAFF", label: "TESLİMAT BANKOSU", minX: -7.2, maxX: 7.2, minY: -1.5, maxY: 5.2, minZ: 9.5, maxZ: 14.0 },
  // Loading bay pad and service alley.
  { id: "STAFF", label: "YÜKLEME SAHASI", minX: 7.3, maxX: 13.1, minY: -1.5, maxY: 5.2, minZ: 5.8, maxZ: 20.6 },
];

const PUBLIC_LABEL = "SATIŞ ALANI";

/** Suspicion gained per second simply by being present. */
const ZONE_PRESSURE_PER_SECOND: Record<ZoneId, number> = {
  PUBLIC: 0,
  STAFF: 0.085,
  RESTRICTED: 0.2,
};

/** Suspicion lost per second once the player is back somewhere they belong. */
const ZONE_RECOVERY_PER_SECOND = 0.155;
/** Grace before recovery starts, so stepping in and out is not a free reset. */
const ZONE_RECOVERY_DELAY = 1.1;

/** A staff credential makes the staff corridor mostly tolerable, never the back office. */
const ZONE_ACCESS_STAFF_SCALE = 0.32;
const ZONE_ACCESS_RESTRICTED_SCALE = 0.78;

/** Moving carefully draws less attention than walking around openly. */
const ZONE_CROUCH_SCALE = 0.72;
const ZONE_COVER_SCALE = 0.6;

/** How strongly zone pressure amplifies normal NPC awareness gain. */
export const ZONE_AWARENESS_GAIN = 0.55;

/** Sustained pressure at which nearby security starts checking the area. */
export const ZONE_INVESTIGATE_THRESHOLD = 0.72;
/** Kept below `DECOY_AWARENESS_FLOOR` so a decoy stays the stronger pull. */
export const ZONE_INVESTIGATE_FLOOR = 0.32;

let currentZone: ZoneId = "PUBLIC";
let currentLabel = PUBLIC_LABEL;
let suspicion = 0;
let recoveryDelay = 0;
let accessGranted = false;
let publishedZone = "";

const snapshot: { zone: ZoneId; label: string; suspicion: number; accessGranted: boolean } = {
  zone: "PUBLIC",
  label: PUBLIC_LABEL,
  suspicion: 0,
  accessGranted: false,
};

function resolveZone(x: number, y: number, z: number): ZoneVolume | null {
  for (const volume of ZONE_VOLUMES) {
    if (x < volume.minX || x > volume.maxX) continue;
    if (z < volume.minZ || z > volume.maxZ) continue;
    if (y < volume.minY || y > volume.maxY) continue;
    return volume;
  }
  return null;
}

export function classifyZone(x: number, y: number, z: number): ZoneId {
  return resolveZone(x, y, z)?.id ?? "PUBLIC";
}

/**
 * Explicitly grant or revoke staff access. Reserved for credential/intel driven
 * unlocks; passing `null` returns to deriving access from operation progress.
 */
export function setZoneAccessGranted(granted: boolean | null): void {
  setStaffCredentialOverride(granted);
}

function accessScale(zone: ZoneId): number {
  if (!accessGranted) return 1;
  if (zone === "STAFF") return ZONE_ACCESS_STAFF_SCALE;
  if (zone === "RESTRICTED") return ZONE_ACCESS_RESTRICTED_SCALE;
  return 1;
}

/**
 * Advance the zone model. `active` mirrors the runtime's awareness gate so
 * pressure only builds during an actual infiltration; recovery always runs.
 */
export function updateZonePresence(dt: number, x: number, y: number, z: number, active: boolean): ZoneSnapshot {
  const step = Math.max(0, Math.min(0.25, dt));
  refreshStaffCredential(step);
  accessGranted = hasStaffCredential();

  const volume = resolveZone(x, y, z);
  currentZone = volume?.id ?? "PUBLIC";
  currentLabel = volume?.label ?? PUBLIC_LABEL;

  const pressure = active ? ZONE_PRESSURE_PER_SECOND[currentZone] : 0;
  if (pressure > 0) {
    const stance = isCrouched() ? ZONE_CROUCH_SCALE : 1;
    const cover = isInCover() ? ZONE_COVER_SCALE : 1;
    suspicion = Math.min(1, suspicion + step * pressure * stance * cover * accessScale(currentZone));
    recoveryDelay = ZONE_RECOVERY_DELAY;
  } else {
    recoveryDelay = Math.max(0, recoveryDelay - step);
    if (recoveryDelay <= 0) suspicion = Math.max(0, suspicion - step * ZONE_RECOVERY_PER_SECOND);
  }

  if (publishedZone !== currentZone) {
    publishedZone = currentZone;
    document.body.dataset.zone = currentZone.toLowerCase();
  }

  snapshot.zone = currentZone;
  snapshot.label = currentLabel;
  snapshot.suspicion = suspicion;
  snapshot.accessGranted = accessGranted;
  return snapshot;
}

export function getPlayerZone(): ZoneId {
  return currentZone;
}

export function getZoneSuspicion(): number {
  return suspicion;
}

/**
 * Bounded relief from a successful cover story. It only applies while the
 * player is in a STAFF area, so it can never make a RESTRICTED room socially
 * safe, and it never drives suspicion negative.
 */
export function relaxZoneSuspicion(amount: number): boolean {
  if (currentZone !== "STAFF" || amount <= 0) return false;
  suspicion = Math.max(0, suspicion - amount);
  snapshot.suspicion = suspicion;
  return true;
}

export function resetZonePresence(): void {
  suspicion = 0;
  recoveryDelay = 0;
  resetStaffCredential();
  accessGranted = false;
  currentZone = "PUBLIC";
  currentLabel = PUBLIC_LABEL;
  publishedZone = "";
  document.body.dataset.zone = "public";
}
