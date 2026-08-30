/**
 * Acoustic classification of the Fresh Market map.
 *
 * This is deliberately separate from `zones.ts`. That module answers "should
 * the player be here?" for gameplay suspicion; this one answers "what does this
 * space sound like?". The plaza is PUBLIC and the market floor is PUBLIC too,
 * but one is open air and the other is a hard-floored room with a ceiling —
 * acoustically they are nothing alike.
 *
 * Four broad contexts, all taken from the real geometry, classified from a
 * position with plain box tests. There is no material engine and no per-frame
 * raycast: the runtime asks for a zone only when a footstep actually fires and
 * on a slow ambience tick.
 */

export type AcousticZone = "OUTDOOR" | "MARKET" | "BACK_OFFICE" | "LOADING";

/**
 * How a footstep is rendered in a space. With only two short samples packaged,
 * this is what makes surfaces read differently: playback rate, level, and how
 * much high end survives.
 */
export interface AudioSurface {
  readonly zone: AcousticZone;
  readonly label: string;
  readonly stepGain: number;
  /** Deterministic playback-rate window; the gait index picks within it. */
  readonly stepRateMin: number;
  readonly stepRateMax: number;
  /** Low-pass applied to footsteps. A closed room keeps less high end. */
  readonly stepFilterHz: number;
}

/** Ambience treatment for a space. */
export interface AcousticMix {
  /** Gain applied to the packaged city bed. */
  readonly cityGain: number;
  /** Low-pass on the city bed — how muffled the outside world sounds. */
  readonly cityFilterHz: number;
  /** Gain of the synthesised interior room tone. */
  readonly roomToneGain: number;
}

interface AcousticVolume {
  readonly zone: AcousticZone;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Ordered most-specific-first. The back of house and loading areas are tested
 * before the market shell, and anything unmatched is open air.
 */
const VOLUMES: readonly AcousticVolume[] = [
  // Connected back-of-house block: corridor, records, monitoring, utility.
  { zone: "BACK_OFFICE", minX: -8.1, maxX: 7.5, minY: -1.5, maxY: 3.7, minZ: 14.0, maxZ: 22.7 },
  // Covered loading bay and the semi-open service alley beside it.
  { zone: "LOADING", minX: 7.3, maxX: 13.1, minY: -1.5, maxY: 4.0, minZ: 5.8, maxZ: 20.6 },
  // Market sales floor, under the interior ceiling at y 4.0.
  { zone: "MARKET", minX: -7.3, maxX: 7.3, minY: -1.5, maxY: 4.1, minZ: 2.2, maxZ: 14.0 },
];

const SURFACES: Record<AcousticZone, AudioSurface> = {
  // Open concrete: brightest and driest, nothing to reflect off.
  OUTDOOR: {
    zone: "OUTDOOR",
    label: "DIŞ ALAN",
    stepGain: 0.9,
    stepRateMin: 0.98,
    stepRateMax: 1.06,
    stepFilterHz: 9000,
    },
  // Hard interior floor: slightly louder and a touch darker than open air.
  MARKET: {
    zone: "MARKET",
    label: "SATIŞ ALANI",
    stepGain: 1.0,
    stepRateMin: 0.96,
    stepRateMax: 1.03,
    stepFilterHz: 6200,
  },
  // Enclosed rooms and a narrow corridor: dullest and most contained.
  BACK_OFFICE: {
    zone: "BACK_OFFICE",
    label: "ARKA BÖLGE",
    stepGain: 0.86,
    stepRateMin: 0.92,
    stepRateMax: 0.99,
    stepFilterHz: 4200,
  },
  // Industrial concrete under a canopy: heavier, with some high end back.
  LOADING: {
    zone: "LOADING",
    label: "YÜKLEME",
    stepGain: 1.04,
    stepRateMin: 0.94,
    stepRateMax: 1.01,
    stepFilterHz: 7000,
  },
};

const MIXES: Record<AcousticZone, AcousticMix> = {
  // Full city bed, wide open.
  OUTDOOR: { cityGain: 1.0, cityFilterHz: 18000, roomToneGain: 0.0 },
  // The city is outside now: quieter and rolled off, with a little room.
  MARKET: { cityGain: 0.46, cityFilterHz: 1100, roomToneGain: 0.22 },
  // Deepest interior: the street is barely present.
  BACK_OFFICE: { cityGain: 0.2, cityFilterHz: 520, roomToneGain: 0.32 },
  // Half outside: most of the city survives, with an industrial floor under it.
  LOADING: { cityGain: 0.74, cityFilterHz: 4200, roomToneGain: 0.14 },
};

export function classifyAcoustic(x: number, y: number, z: number): AcousticZone {
  for (const volume of VOLUMES) {
    if (x < volume.minX || x > volume.maxX) continue;
    if (z < volume.minZ || z > volume.maxZ) continue;
    if (y < volume.minY || y > volume.maxY) continue;
    return volume.zone;
  }
  return "OUTDOOR";
}

export function surfaceFor(zone: AcousticZone): AudioSurface {
  return SURFACES[zone];
}

export function acousticMixFor(zone: AcousticZone): AcousticMix {
  return MIXES[zone];
}

export function allAcousticZones(): readonly AcousticZone[] {
  return ["OUTDOOR", "MARKET", "BACK_OFFICE", "LOADING"];
}
