import type { AnimationGroup } from "@babylonjs/core";

/**
 * The canonical hero-animation contract.
 *
 * Authored GLB clips are named by artists, not by this codebase, so every state
 * is resolved through an alias table exactly once at load time. Nothing here
 * runs per frame — `resolveAnimationGroups` returns a plain Map that the
 * character holds for the life of the scene.
 *
 * `ci/validate_android_character_glb.py` mirrors this table. Change both.
 */

export type CharacterAnimationState =
  | "idle"
  | "walk"
  | "run"
  | "crouch_idle"
  | "crouch_walk"
  | "jump_start"
  | "airborne"
  | "landing"
  | "cover_idle"
  | "cover_locomotion";

/** Only these three make a GLB usable at all; everything else degrades. */
export const REQUIRED_STATES: readonly CharacterAnimationState[] = ["idle", "walk", "run"];

interface StateAliases {
  readonly state: CharacterAnimationState;
  readonly aliases: readonly string[];
}

/**
 * Resolution runs most-specific-first and each clip may only be claimed once.
 * That ordering is load-bearing: "crouch_walk" contains "walk", so if the
 * generic states resolved first they would steal the specific clips.
 */
const RESOLUTION_ORDER: readonly StateAliases[] = [
  { state: "cover_locomotion", aliases: ["cover_locomotion", "cover_walk", "cover_move", "wall_walk"] },
  { state: "cover_idle", aliases: ["cover_idle", "coveridle", "cover", "wall_idle"] },
  { state: "crouch_walk", aliases: ["crouch_walk", "crouchwalk", "crouch_locomotion", "sneak_walk", "sneak"] },
  { state: "crouch_idle", aliases: ["crouch_idle", "crouchidle", "crouch", "sneak_idle"] },
  { state: "jump_start", aliases: ["jump_start", "jumpstart", "takeoff", "jump"] },
  { state: "landing", aliases: ["landing", "land", "touchdown"] },
  { state: "airborne", aliases: ["airborne", "falling", "fall", "inair", "air"] },
  { state: "run", aliases: ["run", "sprint", "jog"] },
  { state: "walk", aliases: ["walk", "locomotion"] },
  { state: "idle", aliases: ["idle", "stand", "breath", "rest"] },
];

/**
 * What to play when a state has no authored clip. Every chain ends at "idle",
 * which is why a GLB without idle is rejected outright.
 */
const FALLBACK_CHAIN: Record<CharacterAnimationState, readonly CharacterAnimationState[]> = {
  idle: [],
  walk: ["idle"],
  run: ["walk", "idle"],
  crouch_idle: ["idle"],
  crouch_walk: ["crouch_idle", "walk", "idle"],
  jump_start: ["airborne", "idle"],
  airborne: ["jump_start", "idle"],
  landing: ["crouch_idle", "idle"],
  cover_idle: ["crouch_idle", "idle"],
  cover_locomotion: ["crouch_walk", "walk", "idle"],
};

/** Jump take-off and landing are one-shots; everything else cycles. */
const ONE_SHOT_STATES: readonly CharacterAnimationState[] = ["jump_start", "landing"];

/**
 * Playback rate per state. Only "run" is nudged, to take the edge off foot
 * skate when a walk clip is reused as the run fallback.
 */
const PLAYBACK_RATES: Partial<Record<CharacterAnimationState, number>> = {
  run: 1.08,
};

export function isLoopingState(state: CharacterAnimationState): boolean {
  return !ONE_SHOT_STATES.includes(state);
}

export function playbackRateFor(state: CharacterAnimationState): number {
  return PLAYBACK_RATES[state] ?? 1;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s.|-]+/g, "_");
}

/**
 * Higher is a better match. Exact names beat token boundaries, which beat a
 * bare substring, so `walk` prefers a clip literally called "Walk" over
 * "walk_backwards_unused".
 */
function scoreAlias(name: string, alias: string): number {
  if (name === alias) return 3;
  if (name.startsWith(`${alias}_`) || name.endsWith(`_${alias}`) || name.includes(`_${alias}_`)) return 2;
  return name.includes(alias) ? 1 : 0;
}

function bestMatch(
  entry: StateAliases,
  candidates: readonly { readonly group: AnimationGroup; readonly key: string }[],
  claimed: ReadonlySet<AnimationGroup>,
): AnimationGroup | null {
  let best: AnimationGroup | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (claimed.has(candidate.group)) continue;
    for (const alias of entry.aliases) {
      const score = scoreAlias(candidate.key, normalize(alias));
      if (score > bestScore) {
        bestScore = score;
        best = candidate.group;
      }
    }
  }
  return best;
}

/**
 * Maps every authored clip onto the canonical contract. Called once, right
 * after the GLB finishes importing.
 */
export function resolveAnimationGroups(
  groups: readonly AnimationGroup[],
): Map<CharacterAnimationState, AnimationGroup> {
  const candidates = groups.map((group) => ({ group, key: normalize(group.name) }));
  const resolved = new Map<CharacterAnimationState, AnimationGroup>();
  const claimed = new Set<AnimationGroup>();

  for (const entry of RESOLUTION_ORDER) {
    const match = bestMatch(entry, candidates, claimed);
    if (!match) continue;
    resolved.set(entry.state, match);
    claimed.add(match);
  }
  return resolved;
}

/**
 * Walks the fallback chain until it finds a clip that actually exists.
 * Returns null only when the GLB has no usable animation at all.
 */
export function selectPlayableGroup(
  resolved: ReadonlyMap<CharacterAnimationState, AnimationGroup>,
  state: CharacterAnimationState,
): AnimationGroup | null {
  const direct = resolved.get(state);
  if (direct) return direct;
  for (const fallback of FALLBACK_CHAIN[state]) {
    const group = resolved.get(fallback);
    if (group) return group;
  }
  return null;
}

export function hasRequiredStates(resolved: ReadonlyMap<CharacterAnimationState, AnimationGroup>): boolean {
  return REQUIRED_STATES.every((state) => resolved.has(state));
}
