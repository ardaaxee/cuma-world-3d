import { isCrouched, isRunHeld } from "./input";
import { isInCover } from "./cover";

/**
 * Authoritative player noise model.
 *
 * This is the single source of truth for "how loud is the player right now".
 * It deliberately reuses the existing locomotion state (`input.ts`) and the
 * existing cover state instead of tracking a second movement controller.
 *
 * Consumers (NPC hearing) read a shared sample object; nothing here allocates
 * per frame.
 */

export type NoiseKind = "movement" | "landing" | "decoy" | "environment";

export interface NoiseSample {
  /** Normalised loudness, 0 (silent) .. 1 (sprinting). */
  readonly loudness: number;
  /** World-space radius at which the sound is still perceptible at all. */
  readonly radius: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface NoiseImpulse {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly loudness: number;
  readonly radius: number;
  readonly kind: NoiseKind;
  /** Deliberate distractions (gadgets) outrank incidental movement noise. */
  readonly deliberate: boolean;
}

/** Sustained loudness per locomotion state. */
export const NOISE_LEVELS = {
  idle: 0.03,
  crouchMove: 0.14,
  walk: 0.44,
  run: 0.95,
} as const;

/** radius = BASE + loudness * GAIN. Sprinting stays just under the decoy reach. */
const NOISE_RADIUS_BASE = 1.8;
const NOISE_RADIUS_GAIN = 11.8;

/** Cover muffles incidental movement but never silences a sprint. */
const COVER_NOISE_SCALE = 0.82;

/** Speed (m/s) at which normal walking is considered fully loud. */
const WALK_REFERENCE_SPEED = 2.6;
const MOVE_SPEED_EPSILON = 0.12;

/** Smoothing so a single frame spike cannot flip the whole hearing system. */
const NOISE_ATTACK_PER_SECOND = 11.0;
const NOISE_RELEASE_PER_SECOND = 5.0;

/** Landing bursts. Mirrors the landing gate already used by the character. */
export const LANDING_NOISE_MIN_SPEED = 1.1;
const LANDING_NOISE_MAX_SPEED = 6.6;
const LANDING_LOUDNESS_MIN = 0.5;
const LANDING_LOUDNESS_MAX = 1.0;
const LANDING_RADIUS_SCALE = 0.85;
const LANDING_CROUCH_SCALE = 0.62;

/**
 * Deliberate decoy distraction. Kept above every incidental movement value so a
 * thrown decoy always outweighs footsteps, exactly as before this model existed.
 */
export const DECOY_NOISE_RADIUS = 13.5;
export const DECOY_AWARENESS_FLOOR = 0.46;

/**
 * Worked doors and similar one-shot world interactions. Deliberately quieter
 * and shorter-ranged than a decoy: a nearby guard may come and look, but the
 * facility can never be raised by a door alone.
 */
export const DOOR_NOISE_LOUDNESS = 0.55;
const ENVIRONMENT_RADIUS_SCALE = 0.8;

const MAX_PENDING_IMPULSES = 8;

type MutableSample = { loudness: number; radius: number; x: number; y: number; z: number };
type MutableImpulse = {
  x: number;
  y: number;
  z: number;
  loudness: number;
  radius: number;
  kind: NoiseKind;
  deliberate: boolean;
};

const sample: MutableSample = { loudness: 0, radius: NOISE_RADIUS_BASE, x: 0, y: 0, z: 0 };

const impulsePool: MutableImpulse[] = Array.from({ length: MAX_PENDING_IMPULSES }, () => ({
  x: 0,
  y: 0,
  z: 0,
  loudness: 0,
  radius: 0,
  kind: "movement" as NoiseKind,
  deliberate: false,
}));
let impulsePoolCursor = 0;
const pendingImpulses: MutableImpulse[] = [];
const drainedImpulses: MutableImpulse[] = [];

function radiusFor(loudness: number): number {
  return NOISE_RADIUS_BASE + loudness * NOISE_RADIUS_GAIN;
}

/** Loudness the player would generate at the given horizontal speed. */
function targetLoudness(horizontalSpeed: number): number {
  if (horizontalSpeed <= MOVE_SPEED_EPSILON) return NOISE_LEVELS.idle;
  const effort = Math.min(1, horizontalSpeed / WALK_REFERENCE_SPEED);
  if (isCrouched()) return NOISE_LEVELS.crouchMove * effort;
  const base = isRunHeld() ? NOISE_LEVELS.run : NOISE_LEVELS.walk;
  const level = NOISE_LEVELS.walk + (base - NOISE_LEVELS.walk) * effort;
  const scaled = Math.min(base, level * Math.max(0.55, effort));
  return isInCover() ? scaled * COVER_NOISE_SCALE : scaled;
}

/**
 * Feed the model from the gameplay loop. `horizontalSpeed` is the same value the
 * runtime already computes for locomotion and footstep audio.
 */
export function reportPlayerMovement(
  x: number,
  y: number,
  z: number,
  horizontalSpeed: number,
  dt: number,
): void {
  const target = targetLoudness(horizontalSpeed);
  const rate = target > sample.loudness ? NOISE_ATTACK_PER_SECOND : NOISE_RELEASE_PER_SECOND;
  sample.loudness += (target - sample.loudness) * (1 - Math.exp(-rate * Math.max(0, dt)));
  sample.radius = radiusFor(sample.loudness);
  sample.x = x;
  sample.y = y;
  sample.z = z;
}

/** Short burst emitted by a real landing. Ignored for soft steps off a curb. */
export function reportPlayerLanding(x: number, y: number, z: number, landingSpeed: number): void {
  if (landingSpeed < LANDING_NOISE_MIN_SPEED) return;
  const impact = Math.min(
    1,
    Math.max(0, (landingSpeed - LANDING_NOISE_MIN_SPEED) / (LANDING_NOISE_MAX_SPEED - LANDING_NOISE_MIN_SPEED)),
  );
  let loudness = LANDING_LOUDNESS_MIN + impact * (LANDING_LOUDNESS_MAX - LANDING_LOUDNESS_MIN);
  if (isCrouched()) loudness *= LANDING_CROUCH_SCALE;
  pushImpulse(x, y, z, loudness, radiusFor(loudness) * LANDING_RADIUS_SCALE, "landing", false);
}

/**
 * One-shot noise made by the world rather than the player's body — currently
 * doors. Same queue, same pooling, no second noise subsystem.
 */
export function reportEnvironmentNoise(x: number, y: number, z: number, loudness: number): void {
  const level = Math.max(0, Math.min(1, loudness));
  if (level <= 0) return;
  pushImpulse(x, y, z, level, radiusFor(level) * ENVIRONMENT_RADIUS_SCALE, "environment", false);
}

function pushImpulse(
  x: number,
  y: number,
  z: number,
  loudness: number,
  radius: number,
  kind: NoiseKind,
  deliberate: boolean,
): void {
  if (pendingImpulses.length >= MAX_PENDING_IMPULSES) return;
  const impulse = impulsePool[impulsePoolCursor] as MutableImpulse;
  impulsePoolCursor = (impulsePoolCursor + 1) % impulsePool.length;
  impulse.x = x;
  impulse.y = y;
  impulse.z = z;
  impulse.loudness = loudness;
  impulse.radius = radius;
  impulse.kind = kind;
  impulse.deliberate = deliberate;
  pendingImpulses.push(impulse);
}

/** Current sustained noise. The returned object is shared and mutated in place. */
export function samplePlayerNoise(): NoiseSample {
  return sample;
}

/**
 * Hand every queued burst to the caller and clear the queue. The returned array
 * is reused between calls, so consume it before the next frame.
 */
export function drainNoiseImpulses(): readonly NoiseImpulse[] {
  drainedImpulses.length = 0;
  for (const impulse of pendingImpulses) drainedImpulses.push(impulse);
  pendingImpulses.length = 0;
  return drainedImpulses;
}

/** Silence the model, e.g. while the game is paused or the runtime is reset. */
export function resetPlayerNoise(): void {
  sample.loudness = 0;
  sample.radius = NOISE_RADIUS_BASE;
  pendingImpulses.length = 0;
}
