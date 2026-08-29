import { seededIndex, seededRange } from "./run-variation";

/**
 * Authored NPC routines.
 *
 * A routine is a short list of waypoints with optional dwell and look
 * behaviour. Security units have more than one authored variant where the
 * geometry supports it, and which variant an agent walks is chosen once per run
 * from the persisted `runSeed` — never per frame, and never from anything the
 * player is doing.
 *
 * Nothing here knows where the player is. Search behaviour is Milestone 04's
 * last-known anchor and stays that way.
 */

/**
 * Positions are plain ground coordinates rather than Vector3, so this stays a
 * dependency-free data module: it can be unit-checked without a scene, and it
 * allocates nothing at import time. `npc.ts` converts each routine once when an
 * agent adopts it.
 */
export interface RoutineWaypoint {
  readonly x: number;
  readonly z: number;
  /** Seconds to hold at this point before moving on. */
  readonly dwell?: number;
  /** Radians of yaw sweep performed while dwelling. */
  readonly sweep?: number;
}

export interface RoutineVariant {
  readonly id: string;
  readonly waypoints: readonly RoutineWaypoint[];
}

export interface RoutineSet {
  /** One or more authored base routines; a variant is picked per run. */
  readonly variants: readonly RoutineVariant[];
  /** Optional alternate routine used by the STAFF ROUTINE WINDOW opportunity. */
  readonly alternate?: RoutineVariant;
}

const point = (x: number, z: number, dwell?: number, sweep?: number): RoutineWaypoint => ({
  x,
  z,
  ...(dwell === undefined ? {} : { dwell }),
  ...(sweep === undefined ? {} : { sweep }),
});

/**
 * GÜVENLİK 01 — front-of-house sweep. The two variants differ in which side of
 * the sales floor is covered closely and where the unit pauses to look.
 */
const SECURITY_01: RoutineSet = {
  variants: [
    {
      id: "s1-floor-west",
      waypoints: [
        point(-4.8, 4.2, 1.6, 1.1),
        point(-4.8, 11.8, 1.2, 0.9),
        point(-1.2, 11.8, 0.8),
        point(-1.2, 4.2, 1.4, 1.2),
      ],
    },
    {
      id: "s1-counter-watch",
      waypoints: [
        point(-4.8, 4.2, 1.1, 0.8),
        point(-2.6, 9.4, 2.2, 1.5),
        point(-4.8, 12.4, 1.5, 1.0),
        point(-1.2, 8.0, 1.0),
      ],
    },
  ],
};

/**
 * GÜVENLİK 02 — east side and delivery approach. The second variant walks the
 * staff corridor mouth instead of holding the sales floor, which is what makes
 * the side route feel different between runs.
 */
const SECURITY_02: RoutineSet = {
  variants: [
    {
      id: "s2-floor-east",
      waypoints: [
        point(4.8, 11.8, 1.3, 1.0),
        point(4.8, 4.5, 1.6, 1.2),
        point(2.5, 4.5, 0.9),
        point(2.5, 11.8, 1.1, 0.8),
      ],
    },
    {
      id: "s2-corridor-mouth",
      waypoints: [
        point(4.8, 11.8, 1.0, 0.9),
        point(3.0, 13.2, 2.0, 1.6),
        point(4.8, 6.2, 1.4, 1.1),
        point(2.5, 9.0, 1.2),
      ],
    },
  ],
};

/**
 * MARKET ÇALIŞANI — ordinary shop-floor work. The alternate routine is the one
 * the STAFF ROUTINE WINDOW opportunity temporarily switches them onto: a
 * believable trip out to the loading bay that empties the corridor for a while.
 */
const WORKER: RoutineSet = {
  variants: [
    {
      id: "worker-floor",
      waypoints: [
        point(-2.8, 8.2, 2.4),
        point(1.4, 8.2, 1.6),
        point(1.4, 11.0, 2.0),
        point(-2.8, 11.0, 1.4),
      ],
    },
    {
      id: "worker-shelves",
      waypoints: [
        point(-2.8, 9.6, 3.0),
        point(0.6, 7.4, 1.8),
        point(1.4, 11.0, 2.6),
        point(-1.6, 11.4, 1.5),
      ],
    },
  ],
  /**
   * The trip out to the loading bay. It threads the delivery opening in the
   * market's right wall (x 7.25, clear between z 8.9 and 11.5) rather than
   * cutting the corner — NPC movement does not test collision, so an authored
   * route has to respect the walls itself.
   */
  alternate: {
    id: "worker-loading-run",
    waypoints: [
      point(1.4, 10.6, 0.6),
      point(5.4, 10.2, 0.5),
      point(8.8, 10.2, 0.8),
      point(10.2, 9.2, 3.4),
    ],
  },
};

export const ROUTINE_SETS: Record<string, RoutineSet> = {
  "GÜVENLİK 01": SECURITY_01,
  "GÜVENLİK 02": SECURITY_02,
  "MARKET ÇALIŞANI": WORKER,
};

/**
 * Picks this run's variant for one agent. Deterministic in (runSeed, agent), so
 * a resumed save always walks the same route.
 */
export function selectVariant(set: RoutineSet, runSeed: number, agentName: string): RoutineVariant {
  const index = seededIndex(runSeed, `variant:${agentName}`, set.variants.length);
  return set.variants[index] ?? set.variants[0] ?? { id: "empty", waypoints: [] };
}

/**
 * A small per-agent dwell multiplier. Guards would otherwise pause and turn in
 * lockstep, which reads as a machine rather than a shift.
 */
export function selectDwellScale(runSeed: number, agentName: string): number {
  return seededRange(runSeed, `dwell:${agentName}`, 0.78, 1.32);
}

/** Per-agent phase offset so sweeps never synchronise between units. */
export function selectPhaseOffset(runSeed: number, agentName: string): number {
  return seededRange(runSeed, `phase:${agentName}`, 0, Math.PI * 2);
}
