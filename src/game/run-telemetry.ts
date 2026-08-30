/**
 * Run telemetry: the few durations a finished run can honestly report.
 *
 * This is a plain numeric accumulator with no WebAudio, Babylon, DOM or storage
 * of its own, so "a background gap is not operation time" and "a resumed tab
 * does not add a giant frame" are properties that can be tested directly rather
 * than trusted.
 *
 * It measures only what the runtime already knows and hands it. It never scans
 * the scene, and it deliberately records nothing about live NPCs, facility
 * heat, the last-known anchor, audio or the camera — those stay runtime-only.
 */

/**
 * Facility states, mirrored locally so this module stays dependency-free.
 * `facility-security.ts` imports Babylon; the mission save must not.
 */
export type TelemetryFacilityState = "CALM" | "WATCH" | "SEARCH" | "HIGH_ALERT";

/**
 * The largest slice a single frame may contribute. The render loop already
 * clamps `dt`, but a resumed tab must not be able to bank an hour of "operation
 * time" even if that clamp ever changes, so the accumulator clamps again.
 */
export const MAX_TELEMETRY_FRAME_SECONDS = 0.25;

/** Checkpoint cadence, driven by accumulated `dt` rather than a timer. */
export const TELEMETRY_CHECKPOINT_SECONDS = 5;

/** Ceiling on any single tracked duration, so a corrupt save cannot poison it. */
export const MAX_TELEMETRY_SECONDS = 12 * 60 * 60;

/** Optional on purpose: a save written before this milestone simply has none. */
export interface StoredRunTelemetry {
  operationSeconds?: number;
  watchSeconds?: number;
  searchSeconds?: number;
  highAlertSeconds?: number;
  maxFacilityState?: TelemetryFacilityState;
}

export interface RunTelemetrySnapshot {
  readonly operationSeconds: number;
  readonly watchSeconds: number;
  readonly searchSeconds: number;
  readonly highAlertSeconds: number;
  readonly maxFacilityState: TelemetryFacilityState;
}

const PRESSURE_RANK: Record<TelemetryFacilityState, number> = {
  CALM: 0,
  WATCH: 1,
  SEARCH: 2,
  HIGH_ALERT: 3,
};

export function isTelemetryFacilityState(value: unknown): value is TelemetryFacilityState {
  return value === "CALM" || value === "WATCH" || value === "SEARCH" || value === "HIGH_ALERT";
}

export function facilityPressureRank(state: TelemetryFacilityState): number {
  return PRESSURE_RANK[state];
}

/** Clamps a stored duration into a sane range; anything unusable becomes 0. */
export function sanitizeSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_TELEMETRY_SECONDS, value);
}

export class RunTelemetry {
  private operationSeconds = 0;
  private watchSeconds = 0;
  private searchSeconds = 0;
  private highAlertSeconds = 0;
  private maxFacilityState: TelemetryFacilityState = "CALM";
  private sinceCheckpoint = 0;
  /**
   * False until this run has actually measured (or restored) something. An old
   * COMPLETE save leaves it false, which is what lets the debrief say the time
   * is unavailable instead of claiming the run took zero seconds.
   */
  private measured = false;

  get hasData(): boolean {
    return this.measured;
  }

  /**
   * Advances the accumulator by one gameplay frame.
   *
   * `active` is the caller's authoritative "the operation is running" flag —
   * the runtime only calls this from its normal update, which never runs while
   * paused or during the cinematic, so neither can be counted here.
   *
   * Returns true when enough time has accumulated that the caller should
   * checkpoint to storage. There is no timer and no allocation.
   */
  accumulate(dt: number, active: boolean, state: TelemetryFacilityState): boolean {
    if (!active || !Number.isFinite(dt) || dt <= 0) return false;

    const step = Math.min(MAX_TELEMETRY_FRAME_SECONDS, dt);
    this.measured = true;
    this.operationSeconds = Math.min(MAX_TELEMETRY_SECONDS, this.operationSeconds + step);
    if (state === "WATCH") this.watchSeconds = Math.min(MAX_TELEMETRY_SECONDS, this.watchSeconds + step);
    else if (state === "SEARCH") this.searchSeconds = Math.min(MAX_TELEMETRY_SECONDS, this.searchSeconds + step);
    else if (state === "HIGH_ALERT") {
      this.highAlertSeconds = Math.min(MAX_TELEMETRY_SECONDS, this.highAlertSeconds + step);
    }
    if (PRESSURE_RANK[state] > PRESSURE_RANK[this.maxFacilityState]) this.maxFacilityState = state;

    this.sinceCheckpoint += step;
    if (this.sinceCheckpoint < TELEMETRY_CHECKPOINT_SECONDS) return false;
    this.sinceCheckpoint = 0;
    return true;
  }

  /** Clears the checkpoint debt after the caller has persisted. */
  markFlushed(): void {
    this.sinceCheckpoint = 0;
  }

  snapshot(): RunTelemetrySnapshot {
    return {
      operationSeconds: this.operationSeconds,
      watchSeconds: this.watchSeconds,
      searchSeconds: this.searchSeconds,
      highAlertSeconds: this.highAlertSeconds,
      maxFacilityState: this.maxFacilityState,
    };
  }

  /** What goes into the run save. Undefined when nothing was ever measured. */
  toStored(): StoredRunTelemetry | undefined {
    if (!this.measured) return undefined;
    return {
      operationSeconds: this.operationSeconds,
      watchSeconds: this.watchSeconds,
      searchSeconds: this.searchSeconds,
      highAlertSeconds: this.highAlertSeconds,
      maxFacilityState: this.maxFacilityState,
    };
  }

  /**
   * Restores a checkpointed run. An absent or unusable block leaves the
   * accumulator empty and unmeasured, which is exactly how a pre-Milestone-08
   * save must behave.
   */
  restore(stored: StoredRunTelemetry | undefined): void {
    if (!stored || typeof stored !== "object") return;
    const operation = sanitizeSeconds(stored.operationSeconds);
    const watch = sanitizeSeconds(stored.watchSeconds);
    const search = sanitizeSeconds(stored.searchSeconds);
    const highAlert = sanitizeSeconds(stored.highAlertSeconds);
    const state = isTelemetryFacilityState(stored.maxFacilityState) ? stored.maxFacilityState : "CALM";
    // A block with no usable duration and no pressure is indistinguishable from
    // an old save, so it must not claim to be measured.
    if (operation <= 0 && watch <= 0 && search <= 0 && highAlert <= 0 && state === "CALM") return;
    this.operationSeconds = operation;
    // The parts can never exceed the whole, however the save was edited.
    this.watchSeconds = Math.min(watch, operation);
    this.searchSeconds = Math.min(search, operation);
    this.highAlertSeconds = Math.min(highAlert, operation);
    this.maxFacilityState = state;
    this.measured = true;
  }
}
