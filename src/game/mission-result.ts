import type {
  IntelId,
  MissionResolutionId,
  MissionStageId,
  OptionalObjectiveId,
  OpportunityId,
} from "./mission-graph";
import type { TelemetryFacilityState } from "./run-telemetry";

/**
 * The immutable snapshot a finished run produces.
 *
 * Debrief used to reconstruct this by running regexes over the HUD objective
 * text, which broke whenever the prose changed and could never carry anything
 * the HUD did not already print. `MissionDirector` now publishes this typed
 * record once, and debrief only reads it.
 */

export type MissionRank = "GHOST" | "SHADOW" | "OPERATIVE";

export interface MissionResult {
  readonly rank: MissionRank;
  readonly score: number;
  readonly route: "" | "main" | "side";
  readonly intelFound: number;
  readonly intelTotal: number;
  readonly optionalIntel: readonly IntelId[];
  /**
   * Every intel id this run discovered. `intelFound` stays the count the HUD
   * shows; this is the same fact as ids, so progression never has to infer
   * which intel a run actually held.
   */
  readonly intelDiscovered: readonly IntelId[];
  /** Which resolution actually completed each required stage. */
  readonly resolutions: readonly { readonly stage: MissionStageId; readonly resolution: MissionResolutionId; readonly label: string }[];
  readonly objectivesCompleted: readonly OptionalObjectiveId[];
  readonly objectivesTotal: number;
  readonly opportunitiesUsed: readonly OpportunityId[];
  readonly alerts: number;
  readonly runSeed: number;
  /** One short pointer at something meaningful the player did not do. */
  readonly replayHint: string;
  /**
   * Milestone 08 run telemetry. Every field is optional together: a run
   * restored from a save written before telemetry existed reports none of them,
   * and the debrief must show that as unavailable rather than as zero seconds.
   */
  readonly operationSeconds?: number;
  readonly watchSeconds?: number;
  readonly searchSeconds?: number;
  readonly highAlertSeconds?: number;
  readonly maxFacilityState?: TelemetryFacilityState;
}

export const MISSION_RESULT_EVENT = "cuma-mission-result";

/**
 * Published exactly once when a run reaches COMPLETE, and again on load when a
 * finished save is restored, so an already-complete save still opens a valid
 * debrief.
 */
export function publishMissionResult(result: MissionResult): void {
  window.dispatchEvent(new CustomEvent<MissionResult>(MISSION_RESULT_EVENT, { detail: result }));
}

export function onMissionResult(handler: (result: MissionResult) => void): () => void {
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<MissionResult>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(MISSION_RESULT_EVENT, listener);
  return () => window.removeEventListener(MISSION_RESULT_EVENT, listener);
}
