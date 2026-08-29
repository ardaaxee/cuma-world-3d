/**
 * The mission intro's timing and state, with no camera or Babylon dependency.
 *
 * It is split out from the presentation owner so the awkward parts — skip
 * idempotence, single-fire completion, pause-safe advancement — can be checked
 * directly rather than trusted.
 *
 * The timeline is driven by the runtime's `dt`, never by a wall-clock timeout
 * chain, which is what makes pausing and backgrounding safe: a paused runtime
 * simply stops calling `advance`.
 */

export type CinematicPhase = "IDLE" | "PLAYING" | "FINISHED";

export interface TimelineSample {
  /** Index of the active segment. */
  readonly index: number;
  /** Normalised progress within that segment, 0..1. */
  readonly t: number;
}

/** Guards against a wildly long frame (a resumed tab) skipping a whole beat. */
const MAX_STEP_SECONDS = 0.1;

export class CinematicTimeline {
  private segments: readonly number[] = [];
  private elapsedSeconds = 0;
  private phase: CinematicPhase = "IDLE";
  private completionFired = false;
  private skipped = false;

  /** Arms the timeline with a fresh set of segment durations. */
  start(segments: readonly number[]): void {
    this.segments = segments.filter((seconds) => seconds > 0);
    this.elapsedSeconds = 0;
    this.completionFired = false;
    this.skipped = false;
    this.phase = this.totalSeconds > 0 ? "PLAYING" : "FINISHED";
  }

  get totalSeconds(): number {
    let total = 0;
    for (const seconds of this.segments) total += seconds;
    return total;
  }

  get elapsed(): number {
    return this.elapsedSeconds;
  }

  get isPlaying(): boolean {
    return this.phase === "PLAYING";
  }

  get isFinished(): boolean {
    return this.phase === "FINISHED";
  }

  get wasSkipped(): boolean {
    return this.skipped;
  }

  /** Overall progress, 0..1. Returns 1 once finished. */
  get progress(): number {
    const total = this.totalSeconds;
    if (total <= 0) return 1;
    return Math.min(1, this.elapsedSeconds / total);
  }

  advance(dt: number): void {
    if (this.phase !== "PLAYING") return;
    const step = Math.max(0, Math.min(MAX_STEP_SECONDS, dt));
    this.elapsedSeconds += step;
    if (this.elapsedSeconds >= this.totalSeconds) {
      this.elapsedSeconds = this.totalSeconds;
      this.phase = "FINISHED";
    }
  }

  /**
   * Jumps to the end. Idempotent: pressing skip twice, or skipping something
   * that already finished on its own, changes nothing and never produces a
   * second completion.
   */
  skip(): void {
    if (this.phase !== "PLAYING") return;
    this.skipped = true;
    this.elapsedSeconds = this.totalSeconds;
    this.phase = "FINISHED";
  }

  /**
   * Returns true exactly once, on the first call after the timeline finished.
   * The caller uses this to resolve its promise and hand control back.
   */
  consumeCompletion(): boolean {
    if (this.phase !== "FINISHED" || this.completionFired) return false;
    this.completionFired = true;
    return true;
  }

  /** Which segment is active and how far into it, for camera interpolation. */
  sample(): TimelineSample {
    if (this.segments.length === 0) return { index: 0, t: 1 };
    let remaining = this.elapsedSeconds;
    for (let index = 0; index < this.segments.length; index += 1) {
      const seconds = this.segments[index] ?? 0;
      if (remaining < seconds || index === this.segments.length - 1) {
        return { index, t: seconds > 0 ? Math.min(1, remaining / seconds) : 1 };
      }
      remaining -= seconds;
    }
    return { index: this.segments.length - 1, t: 1 };
  }

  reset(): void {
    this.segments = [];
    this.elapsedSeconds = 0;
    this.phase = "IDLE";
    this.completionFired = false;
    this.skipped = false;
  }
}

/** Smoothstep. Restrained easing — no overshoot, no bounce. */
export function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}
