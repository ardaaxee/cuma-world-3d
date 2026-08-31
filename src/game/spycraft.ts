import type { FacilityState } from "./facility-security";
import { isOpportunityId, type OpportunityId } from "./mission-graph";
import { FieldInstinct } from "./field-instinct";
import { publishSpycraftEvent } from "./spycraft-events";

export type SpycraftFactId =
  | "staff_break_window"
  | "delivery_rotation"
  | "monitoring_shift_gap"
  | "service_access_pattern";

export interface StoredSpycraft {
  readonly facts: string[];
  readonly fieldInstinct?: number;
}

export interface SpycraftSummary {
  readonly facts: readonly SpycraftFactId[];
  readonly knownOpportunities: readonly OpportunityId[];
  readonly fieldInstinctRemaining: number;
}

export type SpycraftUnlockId = OpportunityId | "manifest_ledger";

const FACTS: readonly SpycraftFactId[] = [
  "staff_break_window",
  "delivery_rotation",
  "monitoring_shift_gap",
  "service_access_pattern",
];

const FACT_TO_OPPORTUNITY: Readonly<Record<SpycraftFactId, SpycraftUnlockId>> = {
  staff_break_window: "staff_routine_window",
  delivery_rotation: "delivery_cart",
  monitoring_shift_gap: "camera_bypass",
  service_access_pattern: "manifest_ledger",
};

export function allSpycraftFactIds(): readonly SpycraftFactId[] {
  return FACTS;
}

export function isSpycraftFactId(value: string): value is SpycraftFactId {
  return (FACTS as readonly string[]).includes(value);
}

export function opportunityForFact(factId: SpycraftFactId): SpycraftUnlockId {
  return FACT_TO_OPPORTUNITY[factId];
}

export interface SpycraftFocusHint {
  readonly factId: SpycraftFactId;
  readonly label: string;
}

/** FIELD FOCUS may consume only facts already held by the current run. */
export function knownFocusHints(
  facts: ReadonlySet<SpycraftFactId>,
  hints: readonly SpycraftFocusHint[],
): readonly SpycraftFocusHint[] {
  return hints.filter((hint) => facts.has(hint.factId));
}

export class SpycraftState {
  private readonly facts = new Set<SpycraftFactId>();
  readonly fieldInstinct = new FieldInstinct();

  discoverFact(factId: string): boolean {
    if (!isSpycraftFactId(factId) || this.facts.has(factId)) return false;
    this.facts.add(factId);
    this.fieldInstinct.recover(1);
    publishSpycraftEvent({
      kind: "intel-discovered",
      factId,
      detail: factId,
    });
    const unlock = opportunityForFact(factId);
    if (isOpportunityId(unlock)) {
      publishSpycraftEvent({
        kind: "opportunity-unlocked",
        factId,
        opportunityId: unlock,
        detail: unlock,
      });
    }
    return true;
  }

  hasFact(factId: string): boolean {
    return isSpycraftFactId(factId) && this.facts.has(factId);
  }

  /** The fact is an alternate gate; the original M05 gate remains valid too. */
  supportsOpportunity(opportunityId: OpportunityId): boolean {
    for (const fact of this.facts) {
      if (FACT_TO_OPPORTUNITY[fact] === opportunityId) return true;
    }
    return false;
  }

  supportsResolution(resolutionId: string): boolean {
    return resolutionId === "manifest_ledger" && this.hasFact("service_access_pattern");
  }

  canSpendFieldInstinct(facilityState: FacilityState): boolean {
    return facilityState !== "HIGH_ALERT" && this.fieldInstinct.canSpend();
  }

  spendFieldInstinct(facilityState: FacilityState): boolean {
    if (!this.canSpendFieldInstinct(facilityState)) return false;
    return this.fieldInstinct.spend();
  }

  restore(stored: StoredSpycraft | undefined): void {
    if (!stored || typeof stored !== "object") return;
    if (Array.isArray(stored.facts)) {
      for (const fact of stored.facts) if (isSpycraftFactId(fact)) this.facts.add(fact);
    }
    this.fieldInstinct.restore(stored.fieldInstinct);
  }

  reset(): void {
    this.facts.clear();
    this.fieldInstinct.reset();
  }

  serialize(): StoredSpycraft {
    return {
      facts: [...this.facts],
      fieldInstinct: this.fieldInstinct.remaining,
    };
  }

  summary(): SpycraftSummary {
    const knownOpportunities = FACTS
      .filter((fact) => this.facts.has(fact))
      .map((fact) => FACT_TO_OPPORTUNITY[fact]);
    const opportunities = knownOpportunities.filter((id): id is OpportunityId => isOpportunityId(id));
    return {
      facts: [...this.facts],
      knownOpportunities: opportunities,
      fieldInstinctRemaining: this.fieldInstinct.remaining,
    };
  }
}
