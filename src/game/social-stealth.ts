import type { FacilityState } from "./facility-security";
import type { ZoneId } from "./zones";

export interface SocialPressureContext {
  readonly zone: ZoneId;
  readonly speed: number;
  readonly running: boolean;
  readonly erraticMotion: boolean;
  readonly controlledDoorApproach: boolean;
  readonly guardedAreaLingering: boolean;
}

export interface SocialPressureResult {
  /** Bounded contextual risk; this is not a second suspicion meter. */
  readonly pressure: number;
  /** How quickly an ordinary return to a safe context should recover. */
  readonly recovery: number;
  readonly reason: "staff-linger" | "controlled-door" | "erratic-motion" | "guarded-area" | "none";
}

export interface BluffContext {
  readonly facilityState: FacilityState;
  readonly zone: ZoneId;
  readonly hasStaffCredential: boolean;
  readonly knowsStaffBreakWindow: boolean;
  readonly targetId: string;
  readonly targetAwareness: number;
  readonly recentContact: boolean;
  readonly crouched: boolean;
  readonly inCover: boolean;
  readonly running: boolean;
  readonly noise: number;
}

export interface BluffOutcome {
  readonly eligible: boolean;
  readonly accepted: boolean;
  readonly relief: number;
  readonly reason: string;
}

/**
 * Social pressure feeds the existing zone/facility pathways. One harmless
 * action never alerts: runtime must sustain this bounded value before calling
 * reportIncident("zone").
 */
export function socialPressure(context: SocialPressureContext): SocialPressureResult {
  let pressure = 0;
  let reason: SocialPressureResult["reason"] = "none";

  if (context.zone === "STAFF" && context.speed < 0.18) {
    pressure += 0.34;
    reason = "staff-linger";
  }
  if (context.controlledDoorApproach) {
    pressure += 0.28;
    reason = "controlled-door";
  }
  if (context.running || context.erraticMotion) {
    pressure += context.running ? 0.2 : 0.16;
    reason = "erratic-motion";
  }
  if (context.guardedAreaLingering) {
    pressure += 0.22;
    reason = "guarded-area";
  }

  return {
    pressure: Math.max(0, Math.min(1, pressure)),
    recovery: context.zone === "PUBLIC" ? 0.26 : 0.12,
    reason,
  };
}

export function bluffEligibility(context: BluffContext): { eligible: boolean; reason: string } {
  if (context.facilityState === "HIGH_ALERT") return { eligible: false, reason: "high-alert" };
  if (context.zone !== "STAFF") return { eligible: false, reason: "wrong-zone" };
  if (!context.hasStaffCredential) return { eligible: false, reason: "no-credential" };
  if (!context.knowsStaffBreakWindow) return { eligible: false, reason: "no-earned-context" };
  if (!context.recentContact) return { eligible: false, reason: "no-eye-contact" };
  if (context.targetAwareness < 0.22 || context.targetAwareness > 0.72) return { eligible: false, reason: "awareness-window" };
  if (context.crouched || context.inCover || context.running) return { eligible: false, reason: "stance" };
  if (context.noise > 0.5) return { eligible: false, reason: "too-loud" };
  return { eligible: true, reason: "contextual" };
}

/** Deterministic bluff: no random roll, no instant alert, bounded relief only. */
export function resolveBluff(seed: number, context: BluffContext): BluffOutcome {
  const eligibility = bluffEligibility(context);
  if (!eligibility.eligible) {
    return { eligible: false, accepted: false, relief: 0, reason: eligibility.reason };
  }
  const roll = stableUnit(seed, context.targetId);
  const accepted = roll >= 0.18;
  return {
    eligible: true,
    accepted,
    relief: accepted ? 0.34 : 0,
    reason: accepted ? "accepted" : "unconvincing",
  };
}

function stableUnit(seed: number, key: string): number {
  let hash = (seed >>> 0) ^ 0x9e3779b9;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x45d9f3b) >>> 0;
    hash ^= hash >>> 16;
  }
  return (hash >>> 0) / 0x100000000;
}
