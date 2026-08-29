/**
 * Deterministic per-run variation.
 *
 * Every routine choice, dwell length and sweep offset is derived from the
 * persisted `runSeed` plus a stable salt, so the same saved run always resumes
 * with the same behaviour while a replay — which gets a fresh seed — can differ.
 *
 * These are pure integer/float functions called a handful of times when a run
 * starts. Nothing here runs per frame, and there is no `Math.random` outside
 * seed creation itself.
 */

/** Standard 32-bit string hash, used to turn a salt into a number. */
function hashSalt(salt: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < salt.length; index += 1) {
    hash ^= salt.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mixes seed and salt into a well-distributed 32-bit value. */
function mix(seed: number, salt: string): number {
  let value = (seed ^ hashSalt(salt)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;
  return (value ^ (value >>> 15)) >>> 0;
}

/** Deterministic float in [0, 1) for this run and salt. */
export function seededUnit(seed: number, salt: string): number {
  return mix(seed, salt) / 0x100000000;
}

/** Deterministic integer in [0, count) for this run and salt. */
export function seededIndex(seed: number, salt: string, count: number): number {
  if (count <= 1) return 0;
  return mix(seed, salt) % count;
}

/** Deterministic float in [min, max) for this run and salt. */
export function seededRange(seed: number, salt: string, min: number, max: number): number {
  return min + seededUnit(seed, salt) * (max - min);
}
