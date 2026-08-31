/**
 * FIELD INSTINCT is a small information resource, not a combat or movement
 * buff. It is deliberately dependency-free so save migration and contract
 * tests can exercise its bounds without booting Babylon.
 */

export const FIELD_INSTINCT_MAX = 3;
export const FIELD_INSTINCT_START = 2;

export class FieldInstinct {
  private amount: number;

  constructor(initial = FIELD_INSTINCT_START) {
    this.amount = clamp(initial);
  }

  get remaining(): number {
    return this.amount;
  }

  canSpend(cost = 1): boolean {
    return Number.isFinite(cost) && cost > 0 && this.amount >= Math.ceil(cost);
  }

  spend(cost = 1): boolean {
    if (!this.canSpend(cost)) return false;
    this.amount = clamp(this.amount - Math.ceil(cost));
    return true;
  }

  /** Recovery is only called after meaningful earned information or progress. */
  recover(amount = 1): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.amount = clamp(this.amount + Math.floor(amount));
  }

  restore(value: unknown): void {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    this.amount = clamp(value);
  }

  reset(): void {
    this.amount = FIELD_INSTINCT_START;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(FIELD_INSTINCT_MAX, Math.trunc(value)));
}
