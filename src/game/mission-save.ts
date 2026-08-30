import type { MissionResolutionId, OperationStep, OptionalObjectiveId, OpportunityId } from "./mission-graph";
import type { StoredRunTelemetry } from "./run-telemetry";

/**
 * The one mission save.
 *
 * This module exists so the debrief overlay can reset a run without importing
 * `mission.ts`, which drags `operation-depth -> world-expansion -> doors` into
 * the boot chunk. The storage key and the reset logic live here and nowhere
 * else — `mission.ts` reads and writes through this module rather than keeping
 * its own copy.
 */

const SAVE_KEY = "cuma_world_android_save_v100";

export type MissionStateName = "BRIEFING" | "RECON" | "PLANNING" | "INFILTRATE" | "EXTRACT" | "COMPLETE";
export type RouteName = "" | "main" | "side";

/**
 * Fields added after the first release are optional, so a save written by an
 * older build still parses and simply reports nothing for them.
 */
export interface StoredMission {
  state: MissionStateName;
  intel: string[];
  selectedRoute: RouteName;
  alerts: number;
  opportunities?: string[];
  operationStep?: OperationStep;
  /** Milestone 05: per-run NPC routine variation seed. */
  runSeed?: number;
  /** Milestone 05: which resolution completed each stage. */
  resolutions?: Partial<Record<string, MissionResolutionId>>;
  /** Milestone 05: completed optional objectives. */
  objectives?: OptionalObjectiveId[];
  /**
   * Milestone 08: checkpointed run durations. Optional so every older save
   * still parses and simply reports no measured time.
   */
  telemetry?: StoredRunTelemetry;
}

export function readStoredMission(): Partial<StoredMission> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<StoredMission>;
  } catch {
    return null;
  }
}

export function writeStoredMission(payload: StoredMission): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // Storage failure must never stop gameplay.
  }
}

/**
 * Clears mission progress and the world signals derived from it. The next run
 * generates a fresh `runSeed`, which is what makes replay vary.
 */
export function resetMissionProgress(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage failure must never prevent returning to a fresh runtime.
  }
  document.body.dataset.route = "none";
  document.body.dataset.operationStep = "none";
  document.body.dataset.intel = "";
}

/**
 * A run seed is a plain 32-bit integer. It is generated once per run and then
 * persisted, so resuming a save reproduces the same NPC routine variation while
 * a replay gets a different one.
 */
export function createRunSeed(): number {
  const random = Math.floor(Math.random() * 0xffffffff);
  // Never 0: a zero seed would make the hash below degenerate.
  return random === 0 ? 0x9e3779b9 : random >>> 0;
}

export function isValidRunSeed(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export type { OpportunityId };
