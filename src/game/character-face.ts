import type { AbstractMesh, MorphTarget } from "@babylonjs/core";

/**
 * Optional facial-life layer for the imported hero.
 *
 * This is deliberately the smallest thing that stops the face reading as a
 * mannequin: blinks, and a slow gaze drift when the asset authors eye targets.
 * There is no dialogue, no lip-sync and no per-frame randomness — every value
 * comes from a deterministic clock, so the same second of gameplay always
 * produces the same face.
 *
 * If the GLB has no compatible morph targets the layer simply stays inactive.
 * That is the expected case for the current CC0 fallback and must never error.
 */

/** Blink cadence, cycled in order. Deterministic, but long enough to not read as a metronome. */
const BLINK_INTERVALS: readonly number[] = [3.4, 5.1, 4.2, 6.3, 3.8, 4.9];
const BLINK_DURATION = 0.13;
const REDUCED_MOTION_BLINK_SCALE = 1.6;
/** Gaze drift stays well under a full look so it never fights the camera. */
const EYE_MAX_INFLUENCE = 0.22;

interface EyeAxis {
  positive: MorphTarget | null;
  negative: MorphTarget | null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function matchesAny(name: string, needles: readonly string[]): boolean {
  return needles.some((needle) => name.includes(needle));
}

export class FacialLifeLayer {
  private readonly blinkTargets: MorphTarget[] = [];
  private readonly horizontal: EyeAxis = { positive: null, negative: null };
  private readonly vertical: EyeAxis = { positive: null, negative: null };
  private clock = 0;
  private blinkCountdown = BLINK_INTERVALS[0] ?? 4;
  private blinkElapsed = -1;
  private intervalIndex = 0;

  /** Caches morph-target references once, straight after the GLB import. */
  attach(meshes: readonly AbstractMesh[]): void {
    this.reset();
    for (const mesh of meshes) {
      const manager = mesh.morphTargetManager;
      if (!manager) continue;
      for (let index = 0; index < manager.numTargets; index += 1) {
        const target = manager.getTarget(index);
        if (target) this.classify(target);
      }
    }
  }

  private classify(target: MorphTarget): void {
    const name = normalize(target.name);
    if (matchesAny(name, ["blink", "eyesclosed", "eyeclose"])) {
      this.blinkTargets.push(target);
      return;
    }
    if (!name.includes("eye") && !name.includes("look")) return;
    if (matchesAny(name, ["lookup", "eyesup"])) this.vertical.positive = target;
    else if (matchesAny(name, ["lookdown", "eyesdown"])) this.vertical.negative = target;
    else if (matchesAny(name, ["lookleft", "eyesleft", "lookin"])) this.horizontal.positive = target;
    else if (matchesAny(name, ["lookright", "eyesright", "lookout"])) this.horizontal.negative = target;
  }

  /** False when the asset carries no compatible targets, which is not an error. */
  get isActive(): boolean {
    return this.blinkTargets.length > 0 || this.hasGaze;
  }

  private get hasGaze(): boolean {
    return Boolean(
      this.horizontal.positive ?? this.horizontal.negative ?? this.vertical.positive ?? this.vertical.negative,
    );
  }

  update(dt: number, reducedMotion: boolean): void {
    if (!this.isActive) return;
    this.clock += dt;
    this.updateBlink(dt, reducedMotion);
    if (reducedMotion) this.clearGaze();
    else this.updateGaze();
  }

  private updateBlink(dt: number, reducedMotion: boolean): void {
    if (this.blinkTargets.length === 0) return;

    if (this.blinkElapsed >= 0) {
      this.blinkElapsed += dt;
      if (this.blinkElapsed >= BLINK_DURATION) {
        this.blinkElapsed = -1;
        this.applyBlink(0);
        this.scheduleNextBlink(reducedMotion);
      } else {
        // Smooth close-then-open; no easing library, no allocation.
        this.applyBlink(Math.sin((this.blinkElapsed / BLINK_DURATION) * Math.PI));
      }
      return;
    }

    this.blinkCountdown -= dt;
    if (this.blinkCountdown <= 0) this.blinkElapsed = 0;
  }

  private scheduleNextBlink(reducedMotion: boolean): void {
    this.intervalIndex = (this.intervalIndex + 1) % BLINK_INTERVALS.length;
    const interval = BLINK_INTERVALS[this.intervalIndex] ?? 4;
    this.blinkCountdown = reducedMotion ? interval * REDUCED_MOTION_BLINK_SCALE : interval;
  }

  private applyBlink(influence: number): void {
    for (const target of this.blinkTargets) target.influence = influence;
  }

  /**
   * Two slow sines at unrelated frequencies. It never repeats on a period a
   * player would notice, and it costs two trig calls a frame.
   */
  private updateGaze(): void {
    const horizontal = Math.sin(this.clock * 0.37) * Math.sin(this.clock * 0.11);
    const vertical = Math.sin(this.clock * 0.23 + 1.3) * 0.6;
    this.applyAxis(this.horizontal, horizontal);
    this.applyAxis(this.vertical, vertical);
  }

  private applyAxis(axis: EyeAxis, value: number): void {
    const scaled = value * EYE_MAX_INFLUENCE;
    if (axis.positive) axis.positive.influence = Math.max(0, scaled);
    if (axis.negative) axis.negative.influence = Math.max(0, -scaled);
  }

  private clearGaze(): void {
    this.applyAxis(this.horizontal, 0);
    this.applyAxis(this.vertical, 0);
  }

  reset(): void {
    this.applyBlink(0);
    this.clearGaze();
    this.blinkTargets.length = 0;
    this.horizontal.positive = null;
    this.horizontal.negative = null;
    this.vertical.positive = null;
    this.vertical.negative = null;
    this.clock = 0;
    this.intervalIndex = 0;
    this.blinkCountdown = BLINK_INTERVALS[0] ?? 4;
    this.blinkElapsed = -1;
  }
}
