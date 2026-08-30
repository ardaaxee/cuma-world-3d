/**
 * The typed world-audio cue contract.
 *
 * Gameplay systems publish *what happened and where*; the audio owner decides
 * what that sounds like. This exists so `doors.ts`, `gadgets.ts` and the
 * character never import an audio engine, and so a presentation sound can never
 * accidentally become a gameplay event.
 *
 * Critically, this is NOT the gameplay noise model. `noise.ts` remains the sole
 * authority on what NPCs can hear. A cue published here is heard by the human
 * player and by nobody in the fiction.
 */

export type WorldAudioCue =
  | "door-open"
  | "door-locked"
  | "door-security-close"
  | "cart-start"
  | "cart-stop"
  | "decoy"
  | "scan"
  | "jam"
  | "landing";

export interface WorldAudioEvent {
  readonly cue: WorldAudioCue;
  /** World position. Ignored when `local` is true. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** 0..1 intensity — landing impact, cart speed, and so on. */
  readonly strength: number;
  /** True for player-local cues that should not be spatialised. */
  readonly local: boolean;
}

export const WORLD_AUDIO_EVENT_NAME = "cuma-world-audio";

/** Publishes a cue at a world position. */
export function publishWorldAudio(
  cue: WorldAudioCue,
  x: number,
  y: number,
  z: number,
  strength = 1,
): void {
  dispatch({ cue, x, y, z, strength: clamp01(strength), local: false });
}

/** Publishes a cue with no world position, played at the listener. */
export function publishLocalAudio(cue: WorldAudioCue, strength = 1): void {
  dispatch({ cue, x: 0, y: 0, z: 0, strength: clamp01(strength), local: true });
}

export function onWorldAudio(handler: (event: WorldAudioEvent) => void): () => void {
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<WorldAudioEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(WORLD_AUDIO_EVENT_NAME, listener);
  return () => window.removeEventListener(WORLD_AUDIO_EVENT_NAME, listener);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function dispatch(detail: WorldAudioEvent): void {
  window.dispatchEvent(new CustomEvent<WorldAudioEvent>(WORLD_AUDIO_EVENT_NAME, { detail }));
}
