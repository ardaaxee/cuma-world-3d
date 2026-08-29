import type { AnimationGroup } from "@babylonjs/core";
import {
  type CharacterAnimationState,
  isLoopingState,
  playbackRateFor,
  selectPlayableGroup,
} from "./character-animation";

/**
 * Owns which animation group is playing and blends between them.
 *
 * Two rules drive the whole class:
 *   - a clip is only ever started when the state genuinely changes
 *   - at most two groups are ever live, the incoming and the outgoing one
 *
 * so nothing here scales with scene size and nothing allocates per frame.
 */

/** Blend time between locomotion states. Short enough to stay responsive. */
export const CROSSFADE_SECONDS = 0.18;

export class AnimationBlender {
  private groups: ReadonlyMap<CharacterAnimationState, AnimationGroup> = new Map();
  private state: CharacterAnimationState | "" = "";
  private active: AnimationGroup | null = null;
  private fading: AnimationGroup | null = null;
  private elapsed = 0;

  /** Installs the cache resolved once at GLB load. */
  setGroups(groups: ReadonlyMap<CharacterAnimationState, AnimationGroup>): void {
    this.groups = groups;
  }

  get currentState(): CharacterAnimationState | "" {
    return this.state;
  }

  /** True while a blend is in flight; used by tests and diagnostics. */
  get isBlending(): boolean {
    return this.fading !== null;
  }

  play(state: CharacterAnimationState): void {
    if (this.state === state) return;
    const group = selectPlayableGroup(this.groups, state);
    if (!group) return;
    this.state = state;

    const rate = playbackRateFor(state);
    // Several states can legitimately resolve to the same clip through the
    // fallback chain; that is a rate change, not a restart.
    if (group === this.active) {
      group.speedRatio = rate;
      return;
    }
    if (group === this.fading) {
      this.reverse(rate);
      return;
    }

    if (this.fading) this.fading.stop();
    this.fading = this.active;
    group.stop();
    group.start(isLoopingState(state), rate);
    group.setWeightForAllAnimatables(this.fading ? 0 : 1);
    this.active = group;
    this.elapsed = 0;
  }

  /** The clip on its way out was asked for again; blend it back, don't restart it. */
  private reverse(rate: number): void {
    const returning = this.fading;
    if (!returning) return;
    returning.speedRatio = rate;
    this.fading = this.active;
    this.active = returning;
    this.elapsed = Math.max(0, CROSSFADE_SECONDS - this.elapsed);
  }

  update(dt: number): void {
    const incoming = this.active;
    const outgoing = this.fading;
    if (!incoming || !outgoing) return;

    this.elapsed += dt;
    const blend = Math.min(1, this.elapsed / CROSSFADE_SECONDS);
    incoming.setWeightForAllAnimatables(blend);
    outgoing.setWeightForAllAnimatables(1 - blend);
    if (blend < 1) return;

    outgoing.stop();
    this.fading = null;
  }

  /** Stops everything and forgets the cache, for a rollback to the fallback. */
  clear(): void {
    this.groups = new Map();
    this.state = "";
    this.active = null;
    this.fading = null;
    this.elapsed = 0;
  }
}
