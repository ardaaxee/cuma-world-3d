import { Vector3 } from "@babylonjs/core";
import "../cinematic.css";
import { CinematicTimeline, smoothstep } from "./cinematic-timeline";
import { publishPresentation } from "./presentation-events";

/**
 * The one mission-entry presentation owner.
 *
 * It temporarily drives the camera the runtime already owns — there is no
 * second render loop, no second camera controller and no timeline engine. The
 * runtime asks it for a camera pose each frame while it is active, and takes
 * ownership straight back the moment it finishes.
 *
 * Every shot position was validated against the real collision geometry: none
 * of them, nor the lines between them, pass through a wall, the market ceiling,
 * the loading canopy or any prop.
 */

/** Authored shots. Cached once — nothing here allocates per frame. */
interface CinematicShot {
  readonly position: Vector3;
  readonly target: Vector3;
}

/** Elevated establishing view from the plaza, looking north at the market. */
const SHOT_ESTABLISH: CinematicShot = {
  position: new Vector3(0, 7.2, -21),
  target: new Vector3(0, 2.4, 5),
};

/** Controlled move revealing the service / loading side of the operation. */
const SHOT_SERVICE: CinematicShot = {
  position: new Vector3(16.5, 6.4, 2.5),
  target: new Vector3(10.2, 1.6, 11),
};

/** Reduced Motion uses one near-static composition close to the play camera. */
const SHOT_STATIC: CinematicShot = {
  position: new Vector3(2.6, 3.4, -14.5),
  target: new Vector3(0, 1.6, -6.5),
};

/**
 * Segment durations in seconds.
 *
 * Normal: hold the establishing shot, move to the service reveal, settle into
 * the gameplay camera — 4.0 s total, inside the authored 3.0–4.5 s window.
 */
const SEGMENTS_NORMAL: readonly number[] = [1.5, 1.4, 1.1];
/** Reduced Motion: one static hold and a short blend. Clearly shorter. */
const SEGMENTS_REDUCED: readonly number[] = [0.85, 0.55];

const TITLE_LINES = {
  kicker: "CUMA WORLD · OPERASYON",
  title: "FRESH MARKET",
  subtitle: "SAHA GÖREVİ · GİZLİLİK ÖNCELİKLİ",
} as const;

export class CinematicPresentation {
  private readonly timeline = new CinematicTimeline();
  private readonly host: HTMLElement;
  private readonly skipButton: HTMLButtonElement;
  /** Scratch vectors, allocated once. */
  private readonly fromPosition = new Vector3();
  private readonly fromTarget = new Vector3();
  private reducedMotion = false;
  private resolveCompletion: (() => void) | null = null;

  constructor() {
    this.host = document.createElement("div");
    this.host.className = "cinematic-card hidden";
    this.host.setAttribute("role", "status");
    this.host.setAttribute("aria-live", "polite");

    const kicker = document.createElement("span");
    kicker.className = "cinematic-kicker";
    kicker.textContent = TITLE_LINES.kicker;
    const title = document.createElement("strong");
    title.className = "cinematic-title";
    title.textContent = TITLE_LINES.title;
    const subtitle = document.createElement("span");
    subtitle.className = "cinematic-subtitle";
    subtitle.textContent = TITLE_LINES.subtitle;

    this.skipButton = document.createElement("button");
    this.skipButton.type = "button";
    this.skipButton.className = "cinematic-skip";
    this.skipButton.textContent = "ATLA";
    this.skipButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.skip();
    });

    this.host.append(kicker, title, subtitle, this.skipButton);
    document.body.append(this.host);
  }

  get isActive(): boolean {
    return this.timeline.isPlaying;
  }

  get progress(): number {
    return this.timeline.progress;
  }

  get wasSkipped(): boolean {
    return this.timeline.wasSkipped;
  }

  /**
   * Starts the intro and resolves when it finishes or is skipped. Calling it
   * while one is already running returns the same pending completion rather
   * than starting a second presentation.
   */
  begin(reducedMotion: boolean): Promise<void> {
    if (this.timeline.isPlaying) {
      return new Promise<void>((resolve) => {
        const previous = this.resolveCompletion;
        this.resolveCompletion = () => {
          previous?.();
          resolve();
        };
      });
    }
    this.reducedMotion = reducedMotion;
    this.timeline.start(reducedMotion ? SEGMENTS_REDUCED : SEGMENTS_NORMAL);
    this.host.classList.remove("hidden");
    this.host.classList.toggle("reduced", reducedMotion);
    // Any tap ends it, not just the button. Registered per run and removed on
    // completion, so listeners never accumulate across runtimes.
    window.addEventListener("pointerdown", this.onPointerSkip, { capture: true });
    // One frame later so the fade-in transition actually runs.
    requestAnimationFrame(() => this.host.classList.add("visible"));
    publishPresentation("MISSION_INTRO", "OPERASYON BAŞLIYOR", TITLE_LINES.title);
    return new Promise<void>((resolve) => {
      this.resolveCompletion = resolve;
    });
  }

  /** One tap ends it. Safe to call repeatedly and when nothing is playing. */
  skip(): void {
    this.timeline.skip();
  }

  private readonly onPointerSkip = (): void => {
    this.skip();
  };

  /**
   * Advances the presentation and writes the camera pose for this frame.
   *
   * `gameplayPosition` / `gameplayTarget` are the live third-person pose, so
   * the final beat blends into exactly where gameplay is about to take over —
   * there is no offset left behind and no separate settle path to keep in sync.
   *
   * Returns false once the presentation is over, after which the runtime owns
   * the camera again.
   */
  update(
    dt: number,
    gameplayPosition: Vector3,
    gameplayTarget: Vector3,
    outPosition: Vector3,
    outTarget: Vector3,
  ): boolean {
    if (!this.timeline.isPlaying) {
      this.finishIfNeeded();
      return false;
    }

    this.timeline.advance(dt);
    this.writePose(gameplayPosition, gameplayTarget, outPosition, outTarget);

    if (this.timeline.isFinished) {
      this.finishIfNeeded();
      return false;
    }
    return true;
  }

  private writePose(
    gameplayPosition: Vector3,
    gameplayTarget: Vector3,
    outPosition: Vector3,
    outTarget: Vector3,
  ): void {
    const sample = this.timeline.sample();
    if (this.reducedMotion) {
      // Hold the static composition, then one short blend to gameplay.
      if (sample.index === 0) {
        outPosition.copyFrom(SHOT_STATIC.position);
        outTarget.copyFrom(SHOT_STATIC.target);
        return;
      }
      this.blend(SHOT_STATIC, gameplayPosition, gameplayTarget, sample.t, outPosition, outTarget);
      return;
    }

    if (sample.index === 0) {
      // A slow push on the establishing shot, not a fly-through.
      const drift = smoothstep(sample.t) * 1.6;
      outPosition.copyFromFloats(
        SHOT_ESTABLISH.position.x,
        SHOT_ESTABLISH.position.y - drift * 0.22,
        SHOT_ESTABLISH.position.z + drift,
      );
      outTarget.copyFrom(SHOT_ESTABLISH.target);
      return;
    }
    if (sample.index === 1) {
      const eased = smoothstep(sample.t);
      Vector3.LerpToRef(SHOT_ESTABLISH.position, SHOT_SERVICE.position, eased, outPosition);
      Vector3.LerpToRef(SHOT_ESTABLISH.target, SHOT_SERVICE.target, eased, outTarget);
      return;
    }
    this.blend(SHOT_SERVICE, gameplayPosition, gameplayTarget, sample.t, outPosition, outTarget);
  }

  private blend(
    from: CinematicShot,
    gameplayPosition: Vector3,
    gameplayTarget: Vector3,
    t: number,
    outPosition: Vector3,
    outTarget: Vector3,
  ): void {
    const eased = smoothstep(t);
    this.fromPosition.copyFrom(from.position);
    this.fromTarget.copyFrom(from.target);
    Vector3.LerpToRef(this.fromPosition, gameplayPosition, eased, outPosition);
    Vector3.LerpToRef(this.fromTarget, gameplayTarget, eased, outTarget);
  }

  /** Resolves the completion promise exactly once, however the intro ended. */
  private finishIfNeeded(): void {
    if (!this.timeline.consumeCompletion()) return;
    window.removeEventListener("pointerdown", this.onPointerSkip, { capture: true });
    this.host.classList.remove("visible");
    this.host.classList.add("hidden");
    const resolve = this.resolveCompletion;
    this.resolveCompletion = null;
    resolve?.();
  }

  /** Tears the presentation down without leaving a promise pending forever. */
  dispose(): void {
    this.timeline.skip();
    this.finishIfNeeded();
    this.timeline.reset();
    this.host.remove();
  }
}
