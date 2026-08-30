/**
 * Pure locomotion-audio and mix logic.
 *
 * No WebAudio, no Babylon, no DOM — so the awkward parts (gait phase across a
 * walk/run change, no giant delayed step after a pause, deterministic variation)
 * can be checked directly instead of trusted.
 *
 * None of this touches the gameplay noise model. Stride lengths here decide when
 * the player *hears* a footstep; `noise.ts` independently decides what an NPC
 * can hear, and the two never read each other.
 */

export type LocomotionMode = "CROUCH" | "WALK" | "RUN";

/** Facility states, mirrored locally so this module stays dependency-free. */
export type FacilitySignal = "CALM" | "WATCH" | "SEARCH" | "HIGH_ALERT";

/**
 * Stride length in metres — how far the player travels between footfalls.
 * Distance-based rather than clock-based, so a step lands where the foot lands
 * however the speed is changing.
 */
const STRIDE_METRES: Record<LocomotionMode, number> = {
  CROUCH: 0.62,
  WALK: 0.78,
  RUN: 1.12,
};

/** Below this speed the player is standing; jitter must never emit a step. */
export const MIN_STEP_SPEED = 0.45;

/**
 * Never bank more than this many strides. Without it, a long frame or a
 * resumed tab could dump a burst of footsteps in one update.
 */
const MAX_BANKED_STRIDES = 1;

/** Per-step gain by mode, before surface treatment. */
const STEP_GAIN: Record<LocomotionMode, number> = {
  CROUCH: 0.42,
  WALK: 0.82,
  RUN: 1.0,
};

/**
 * Deterministic variation. Two co-prime-length tables read with the step index
 * give a long non-repeating-sounding pattern with no RNG anywhere.
 */
const RATE_PATTERN: readonly number[] = [0.0, 0.62, 0.24, 0.86, 0.44];
const GAIN_PATTERN: readonly number[] = [1.0, 0.94, 1.03, 0.97];

export interface FootstepEmission {
  /** Which of the packaged samples to use; alternates feet. */
  readonly sampleIndex: number;
  /** 0..1 position inside the surface's playback-rate window. */
  readonly rateBias: number;
  /** Multiplier applied to the surface gain. */
  readonly gain: number;
  readonly mode: LocomotionMode;
}

/**
 * Distance-based gait scheduler.
 *
 * Emits at most one footstep per update. Changing mode rescales the banked
 * distance so gait phase is preserved — that is what stops a WALK->RUN change
 * double-firing or swallowing a step.
 */
export class GaitScheduler {
  private banked = 0;
  private stepIndex = 0;
  private mode: LocomotionMode = "WALK";

  get currentMode(): LocomotionMode {
    return this.mode;
  }

  get bankedDistance(): number {
    return this.banked;
  }

  get steps(): number {
    return this.stepIndex;
  }

  /**
   * Advances the gait. `distance` is the horizontal metres travelled this
   * frame; `speed` decides whether the player counts as moving at all.
   * Returns the step to play, or null.
   */
  update(distance: number, speed: number, mode: LocomotionMode): FootstepEmission | null {
    this.setMode(mode);

    if (!Number.isFinite(distance) || !Number.isFinite(speed) || speed < MIN_STEP_SPEED) {
      // Standing still, or joystick jitter below the movement threshold.
      // Bleed the bank away so stopping and starting does not fire instantly.
      this.banked = Math.max(0, this.banked - Math.max(0, distance));
      return null;
    }

    const stride = STRIDE_METRES[this.mode];
    this.banked += Math.max(0, distance);
    if (this.banked < stride) return null;

    this.banked = Math.min(this.banked - stride, stride * MAX_BANKED_STRIDES);
    const index = this.stepIndex;
    this.stepIndex += 1;
    return {
      sampleIndex: index % 2,
      rateBias: RATE_PATTERN[index % RATE_PATTERN.length] ?? 0.5,
      gain: STEP_GAIN[this.mode] * (GAIN_PATTERN[index % GAIN_PATTERN.length] ?? 1),
      mode: this.mode,
    };
  }

  /**
   * Switching mode rescales banked distance into the new stride so the gait
   * keeps its phase instead of jumping.
   */
  private setMode(mode: LocomotionMode): void {
    if (mode === this.mode) return;
    const previous = STRIDE_METRES[this.mode];
    const next = STRIDE_METRES[mode];
    this.banked = previous > 0 ? (this.banked / previous) * next : 0;
    this.mode = mode;
  }

  /** Clears banked distance. Used on pause, cinematic and teleports. */
  reset(): void {
    this.banked = 0;
  }
}

export function strideFor(mode: LocomotionMode): number {
  return STRIDE_METRES[mode];
}

// --- mix model -------------------------------------------------------------

/** Category levels. Interaction and footsteps sit above the ambience bed. */
export const MIX = {
  world: 0.9,
  player: 0.72,
  presentation: 0.6,
  ambience: 0.34,
  tension: 0.3,
} as const;

/** A strong cue dips the bed briefly so it never masks gameplay. */
export const DUCK_AMOUNT = 0.55;
export const DUCK_SECONDS = 0.35;

/**
 * Non-musical tension bed level per facility state. It only tracks what the
 * HUD already shows, so it can never leak hidden information, and even
 * HIGH_ALERT stays well below the level where footsteps stop being readable.
 */
const TENSION_GAIN: Record<FacilitySignal, number> = {
  CALM: 0,
  WATCH: 0.28,
  SEARCH: 0.62,
  HIGH_ALERT: 1.0,
};

export function tensionTargetFor(state: FacilitySignal): number {
  return TENSION_GAIN[state];
}

/** Bounded spatial polyphony. Chosen for mobile after auditing the cue set. */
export const MAX_SPATIAL_VOICES = 6;

/**
 * Conservative attenuation for a small market map: audible nearby, gone across
 * the facility.
 */
export const SPATIAL_REF_DISTANCE = 2.5;
export const SPATIAL_MAX_DISTANCE = 26;
export const SPATIAL_ROLLOFF = 1.35;

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Master volume 0 means silent — and nothing else. */
export function isMuted(masterVolume: number): boolean {
  return clampVolume(masterVolume) <= 0;
}

/**
 * Voice-pool policy: reuse a free slot, otherwise steal the oldest. Returning
 * an index rather than mutating keeps this testable.
 */
export function selectVoiceSlot(
  activeStartTimes: readonly (number | null)[],
  now: number,
): number {
  let oldestIndex = 0;
  let oldestStart = Infinity;
  for (let index = 0; index < activeStartTimes.length; index += 1) {
    const start = activeStartTimes[index];
    if (start === null || start === undefined) return index;
    if (start < oldestStart) {
      oldestStart = start;
      oldestIndex = index;
    }
  }
  void now;
  return oldestIndex;
}

/** Locomotion mode from the authoritative input/movement state. */
export function locomotionMode(crouched: boolean, running: boolean): LocomotionMode {
  if (crouched) return "CROUCH";
  return running ? "RUN" : "WALK";
}
