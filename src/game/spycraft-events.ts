import type { OpportunityId } from "./mission-graph";
import type { SpycraftFactId } from "./spycraft";

export type SpycraftEventKind = "intel-discovered" | "opportunity-unlocked" | "social-pressure" | "bluff-outcome";

export interface SpycraftEvent {
  readonly kind: SpycraftEventKind;
  readonly factId?: SpycraftFactId;
  readonly opportunityId?: OpportunityId;
  readonly pressure?: number;
  readonly accepted?: boolean;
  readonly detail: string;
}

export const SPYCRAFT_EVENT_NAME = "cuma-spycraft-event";

export function publishSpycraftEvent(event: SpycraftEvent): void {
  window.dispatchEvent(new CustomEvent<SpycraftEvent>(SPYCRAFT_EVENT_NAME, { detail: event }));
}

export function onSpycraftEvent(handler: (event: SpycraftEvent) => void): () => void {
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<SpycraftEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(SPYCRAFT_EVENT_NAME, listener);
  return () => window.removeEventListener(SPYCRAFT_EVENT_NAME, listener);
}
