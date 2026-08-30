import {
  type PresentationCue,
  type PresentationEvent,
  type PresentationWeight,
  onPresentation,
  presentationWeight,
} from "./presentation-events";
import { emitHaptic } from "./haptics";

/**
 * The transient mission feedback line.
 *
 * This used to run three MutationObservers over HUD elements and recover
 * gameplay state with regexes over Turkish prose. It now consumes the typed
 * presentation cues gameplay publishes, so it reacts to what actually happened
 * rather than to what the HUD happened to print.
 *
 * It stays deliberately small: one line, no banner, no screen flash, no camera
 * shake, and it never duplicates the permanent HUD meters.
 */

/** How long each weight stays on screen. */
const HOLD_SECONDS: Record<PresentationWeight, number> = {
  SUBTLE: 1.9,
  NORMAL: 2.6,
  STRONG: 2.2,
  CRITICAL: 2.4,
};

/**
 * Haptics escalate with weight and nothing more. Each pattern fires once, on a
 * real transition — never per frame and never repeated while a state holds.
 */
const HAPTICS: Record<PresentationWeight, readonly number[]> = {
  SUBTLE: [16],
  NORMAL: [26],
  STRONG: [24, 28, 24],
  CRITICAL: [44, 30, 66],
};

/** Cues that should not interrupt a louder one already on screen. */
const PRIORITY: Record<PresentationWeight, number> = {
  SUBTLE: 0,
  NORMAL: 1,
  STRONG: 2,
  CRITICAL: 3,
};

export class MissionFeedback {
  private readonly host: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private hideTimer: number | null = null;
  private activePriority = -1;
  private readonly stop: () => void;

  constructor() {
    this.host = document.createElement("div");
    this.host.className = "mission-feedback";
    this.host.setAttribute("role", "status");
    this.host.setAttribute("aria-live", "polite");
    this.host.setAttribute("aria-atomic", "true");

    this.labelEl = document.createElement("span");
    this.labelEl.className = "mission-feedback-label";
    this.detailEl = document.createElement("strong");
    this.detailEl.className = "mission-feedback-detail";
    this.host.append(this.labelEl, this.detailEl);
    document.body.append(this.host);

    this.stop = onPresentation((event) => this.present(event));
  }

  private present(event: PresentationEvent): void {
    // The intro already has the title card; a feedback line would double it.
    if (event.cue === "MISSION_INTRO") return;
    if (!this.gameplayVisible()) return;
    const weight = presentationWeight(event.cue);
    const priority = PRIORITY[weight];
    // A quiet cue never wipes a louder one that is still showing.
    if (this.hideTimer !== null && priority < this.activePriority) return;

    this.activePriority = priority;
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.host.dataset.kind = this.kindFor(event.cue);
    this.host.dataset.weight = weight;
    this.labelEl.textContent = event.label;
    this.detailEl.textContent = event.detail;

    // Restart the entry transition without a layout-thrashing reflow loop.
    this.host.classList.remove("visible");
    void this.host.offsetWidth;
    this.host.classList.add("visible");
    this.vibrate(HAPTICS[weight]);

    this.hideTimer = window.setTimeout(() => {
      this.host.classList.remove("visible");
      this.hideTimer = null;
      this.activePriority = -1;
    }, HOLD_SECONDS[weight] * 1000);
  }

  /** Styling hook, kept coarse so the CSS does not need one rule per cue. */
  private kindFor(cue: PresentationCue): string {
    if (cue === "FACILITY_SEARCH" || cue === "FACILITY_HIGH_ALERT" || cue === "FACILITY_WATCH") return "AWARENESS";
    if (cue === "INTEL_DISCOVERED" || cue === "OPTIONAL_COMPLETED") return "INTEL";
    if (cue === "OPPORTUNITY_USED" || cue === "GADGET_READY") return "OPPORTUNITY";
    return "OBJECTIVE";
  }

  private gameplayVisible(): boolean {
    return document.querySelector("#boot")?.classList.contains("hidden") ?? false;
  }

  private vibrate(pattern: readonly number[]): void {
    emitHaptic(pattern);
  }

  dispose(): void {
    this.stop();
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.host.remove();
  }
}
