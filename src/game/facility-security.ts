import { Vector3 } from "@babylonjs/core";

/**
 * The one facility-level security controller.
 *
 * Individual guards and the CCTV keep their own awareness meters; this sits
 * above them and decides how the building as a whole is behaving. It never
 * learns the player's live position — the strongest thing it can share is a
 * last-known incident anchor.
 */

export type FacilityState = "CALM" | "WATCH" | "SEARCH" | "HIGH_ALERT";

/**
 * What kind of evidence arrived. The ceiling attached to each kind is what
 * stops weak evidence from ever escalating the whole facility.
 */
export type IncidentKind = "noise" | "zone" | "decoy" | "suspicion" | "guard-alert" | "camera-alert";

export interface FacilitySnapshot {
  readonly state: FacilityState;
  /** Normalised security pressure, 0..1. */
  readonly heat: number;
  readonly hasAnchor: boolean;
  readonly secondsSinceContact: number;
  readonly escalating: boolean;
}

interface IncidentProfile {
  readonly gain: number;
  /** Evidence of this kind can never push heat past this value. */
  readonly ceiling: number;
  readonly setsAnchor: boolean;
  /** Only confirmed sightings unlock HIGH_ALERT. */
  readonly confirmsContact: boolean;
}

/**
 * Ceilings are the core safety rule:
 * - noise (footsteps, doors) stops below SEARCH_ENTER, so it can only ever reach WATCH
 * - a decoy or a merely suspicious guard stops below HIGH_ALERT_ENTER
 * - only a confirmed guard or camera sighting can reach the top
 */
const INCIDENTS: Record<IncidentKind, IncidentProfile> = {
  noise: { gain: 0.1, ceiling: 0.4, setsAnchor: true, confirmsContact: false },
  zone: { gain: 0.05, ceiling: 0.3, setsAnchor: false, confirmsContact: false },
  decoy: { gain: 0.5, ceiling: 0.6, setsAnchor: true, confirmsContact: false },
  suspicion: { gain: 0.28, ceiling: 0.66, setsAnchor: true, confirmsContact: false },
  "guard-alert": { gain: 0.8, ceiling: 1, setsAnchor: true, confirmsContact: true },
  "camera-alert": { gain: 0.75, ceiling: 1, setsAnchor: true, confirmsContact: true },
};

const HEAT_DECAY_PER_SECOND = 0.05;
/** Heat holds briefly after evidence, so repeated events actually accumulate. */
const HEAT_GRACE_SECONDS = 2;
/** HIGH_ALERT also needs a sighting this recent, so losing contact always helps. */
const CONTACT_MEMORY_SECONDS = 14;
/**
 * Minimum time before the facility may calm down again. Escalation is
 * immediate — a confirmed sighting must not wait — while de-escalation is
 * damped, which is what stops the readout flickering.
 */
const MIN_STATE_DWELL_SECONDS = 2.5;

const WATCH_ENTER = 0.18;
const SEARCH_ENTER = 0.45;
const HIGH_ALERT_ENTER = 0.78;
const WATCH_EXIT = 0.1;
const SEARCH_EXIT = 0.34;
const HIGH_ALERT_EXIT = 0.62;

/** The anchor is forgotten once the facility is calm enough to stop caring. */
const ANCHOR_FORGET_HEAT = 0.12;

const STATE_LABELS: Record<FacilityState, string> = {
  CALM: "TESİS · NORMAL",
  WATCH: "TESİS · İZLEME",
  SEARCH: "TESİS · ARAMA",
  HIGH_ALERT: "TESİS · YÜKSEK ALARM",
};

const anchor = new Vector3();
let hasAnchor = false;
let anchorVersion = 0;

let heat = 0;
let state: FacilityState = "CALM";
let stateDwell = 0;
let secondsSinceContact = CONTACT_MEMORY_SECONDS;
let escalating = false;
let graceTimer = 0;
let publishedState = "";

const snapshot: {
  state: FacilityState;
  heat: number;
  hasAnchor: boolean;
  secondsSinceContact: number;
  escalating: boolean;
} = {
  state: "CALM",
  heat: 0,
  hasAnchor: false,
  secondsSinceContact: CONTACT_MEMORY_SECONDS,
  escalating: false,
};

export function facilityStateLabel(value: FacilityState): string {
  return STATE_LABELS[value];
}

/**
 * Feed evidence in. Position is optional because some evidence (sustained zone
 * pressure) has no single point worth searching.
 */
export function reportIncident(kind: IncidentKind, x?: number, y?: number, z?: number): void {
  const profile = INCIDENTS[kind];
  const raised = Math.min(1, heat + profile.gain);
  heat = Math.max(heat, Math.min(raised, profile.ceiling));

  graceTimer = HEAT_GRACE_SECONDS;
  if (profile.confirmsContact) secondsSinceContact = 0;
  if (profile.setsAnchor && x !== undefined && y !== undefined && z !== undefined) {
    anchor.copyFromFloats(x, y, z);
    hasAnchor = true;
    anchorVersion += 1;
  }
}

/**
 * Bounded relief from a successful social check. It can calm a watchful
 * facility but can never by itself clear an active search.
 */
export function relaxFacilityHeat(amount: number): void {
  const floor = state === "SEARCH" || state === "HIGH_ALERT" ? SEARCH_EXIT : 0;
  heat = Math.max(floor, heat - Math.max(0, amount));
}

export function updateFacilitySecurity(dt: number, active: boolean): FacilitySnapshot {
  const step = Math.max(0, Math.min(0.25, dt));

  graceTimer = Math.max(0, graceTimer - step);
  if (!active) {
    graceTimer = 0;
    heat = Math.max(0, heat - step * HEAT_DECAY_PER_SECOND * 3);
  } else if (graceTimer <= 0) {
    heat = Math.max(0, heat - step * HEAT_DECAY_PER_SECOND);
  }
  secondsSinceContact = Math.min(CONTACT_MEMORY_SECONDS * 2, secondsSinceContact + step);
  stateDwell += step;
  if (heat < ANCHOR_FORGET_HEAT) hasAnchor = false;

  const next = resolveState();
  const calming = rank(next) < rank(state);
  if (next !== state && (!calming || stateDwell >= MIN_STATE_DWELL_SECONDS)) {
    escalating = rank(next) > rank(state);
    state = next;
    stateDwell = 0;
    if (publishedState !== state) {
      publishedState = state;
      document.body.dataset.securityState = state.toLowerCase();
    }
  }

  snapshot.state = state;
  snapshot.heat = heat;
  snapshot.hasAnchor = hasAnchor;
  snapshot.secondsSinceContact = secondsSinceContact;
  snapshot.escalating = escalating;
  return snapshot;
}

function rank(value: FacilityState): number {
  return value === "HIGH_ALERT" ? 3 : value === "SEARCH" ? 2 : value === "WATCH" ? 1 : 0;
}

/** Rising and falling thresholds differ, which is what stops oscillation. */
function resolveState(): FacilityState {
  const contactFresh = secondsSinceContact < CONTACT_MEMORY_SECONDS;
  if (state === "HIGH_ALERT") {
    if (heat >= HIGH_ALERT_EXIT && contactFresh) return "HIGH_ALERT";
    if (heat >= SEARCH_EXIT) return "SEARCH";
    return heat >= WATCH_EXIT ? "WATCH" : "CALM";
  }
  if (heat >= HIGH_ALERT_ENTER && contactFresh) return "HIGH_ALERT";
  if (state === "SEARCH") {
    if (heat >= SEARCH_EXIT) return "SEARCH";
    return heat >= WATCH_EXIT ? "WATCH" : "CALM";
  }
  if (heat >= SEARCH_ENTER && hasAnchor) return "SEARCH";
  if (state === "WATCH") return heat >= WATCH_EXIT ? "WATCH" : "CALM";
  return heat >= WATCH_ENTER ? "WATCH" : "CALM";
}

export function getFacilitySnapshot(): FacilitySnapshot {
  return snapshot;
}

export function getFacilityState(): FacilityState {
  return state;
}

/** Copies the last-known incident point out. Returns false when there is none. */
export function readSearchAnchor(out: Vector3): boolean {
  if (!hasAnchor) return false;
  out.copyFrom(anchor);
  return true;
}

/** Changes whenever a new anchor is stored, so search points regenerate once. */
export function getAnchorVersion(): number {
  return anchorVersion;
}

export function resetFacilitySecurity(): void {
  heat = 0;
  state = "CALM";
  stateDwell = MIN_STATE_DWELL_SECONDS;
  secondsSinceContact = CONTACT_MEMORY_SECONDS;
  escalating = false;
  graceTimer = 0;
  hasAnchor = false;
  anchorVersion = 0;
  publishedState = "";
  document.body.dataset.securityState = "calm";
}
