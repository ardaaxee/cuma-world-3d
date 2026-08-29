/**
 * The typed presentation contract.
 *
 * Feedback used to be recovered by watching HUD elements with MutationObservers
 * and running regexes over Turkish prose, which broke whenever wording changed
 * and could never carry anything the HUD did not already print. Gameplay now
 * publishes a small typed cue instead, and the feedback layers only listen.
 *
 * This is deliberately a thin CustomEvent contract, not an event-bus framework,
 * and it is dependency-free so the presentation layers stay out of the world
 * graph.
 *
 * Single-fire is the publisher's responsibility: a cue is emitted when a state
 * genuinely transitions, never on every frame that state holds.
 */

export type PresentationCue =
  | "MISSION_INTRO"
  | "MISSION_OBJECTIVE"
  | "STAGE_RESOLVED"
  | "INTEL_DISCOVERED"
  | "OPTIONAL_COMPLETED"
  | "OPPORTUNITY_USED"
  | "FACILITY_WATCH"
  | "FACILITY_SEARCH"
  | "FACILITY_HIGH_ALERT"
  | "GADGET_READY";

export interface PresentationEvent {
  readonly cue: PresentationCue;
  /** Short heading, already display-ready. */
  readonly label: string;
  /** Body line. May be empty when the heading says everything. */
  readonly detail: string;
}

export const PRESENTATION_EVENT_NAME = "cuma-presentation-cue";

/** How loud each cue is allowed to be. Consumers map this onto their medium. */
export type PresentationWeight = "SUBTLE" | "NORMAL" | "STRONG" | "CRITICAL";

const CUE_WEIGHT: Record<PresentationCue, PresentationWeight> = {
  MISSION_INTRO: "NORMAL",
  MISSION_OBJECTIVE: "NORMAL",
  STAGE_RESOLVED: "NORMAL",
  INTEL_DISCOVERED: "SUBTLE",
  OPTIONAL_COMPLETED: "SUBTLE",
  OPPORTUNITY_USED: "SUBTLE",
  FACILITY_WATCH: "SUBTLE",
  FACILITY_SEARCH: "STRONG",
  FACILITY_HIGH_ALERT: "CRITICAL",
  GADGET_READY: "SUBTLE",
};

export function presentationWeight(cue: PresentationCue): PresentationWeight {
  return CUE_WEIGHT[cue];
}

export function publishPresentation(cue: PresentationCue, label: string, detail = ""): void {
  window.dispatchEvent(
    new CustomEvent<PresentationEvent>(PRESENTATION_EVENT_NAME, { detail: { cue, label, detail } }),
  );
}

export function onPresentation(handler: (event: PresentationEvent) => void): () => void {
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<PresentationEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(PRESENTATION_EVENT_NAME, listener);
  return () => window.removeEventListener(PRESENTATION_EVENT_NAME, listener);
}
