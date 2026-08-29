import { Color3, Mesh, MeshBuilder, PBRMaterial, type Scene, Vector3 } from "@babylonjs/core";

/**
 * FIELD FOCUS — a short contextual readability window bound to the existing
 * OBSERVE control during infiltration.
 *
 * It only ever marks things the player has already earned or can plainly see:
 * the current operation target, nearby doors, discovered intel, a discovered
 * CCTV opportunity, extraction, and an abstract last-known incident point.
 * It never marks an NPC, so it can never become a wallhack.
 */

export type FieldFocusKind = "objective" | "access" | "intel" | "incident";

export interface FieldFocusTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly kind: FieldFocusKind;
}

export const FIELD_FOCUS_DURATION = 3;
export const FIELD_FOCUS_COOLDOWN = 9;
/** Hard bound on markers so a busy area can never spike the frame. */
const MAX_MARKERS = 6;
const MAX_MARKERS_LOW = 3;
const MARKER_DIAMETER = 0.72;

const KIND_COLORS: Record<FieldFocusKind, Color3> = {
  objective: new Color3(0.95, 0.78, 0.36),
  access: new Color3(0.42, 0.78, 0.92),
  intel: new Color3(0.36, 0.9, 0.62),
  incident: new Color3(0.92, 0.5, 0.36),
};

const pool: Mesh[] = [];
const materials = new Map<FieldFocusKind, PBRMaterial>();

let active = 0;
let cooldown = 0;
let phase = 0;
let visibleCount = 0;
let markerBudget = MAX_MARKERS;
let reducedMotion = false;
let builtScene: Scene | null = null;

function materialFor(scene: Scene, kind: FieldFocusKind): PBRMaterial {
  const existing = materials.get(kind);
  if (existing) return existing;
  const material = new PBRMaterial(`field-focus-${kind}`, scene);
  material.albedoColor = new Color3(0.04, 0.05, 0.06);
  material.emissiveColor = KIND_COLORS[kind];
  material.emissiveIntensity = 1.2;
  material.roughness = 0.4;
  material.metallic = 0.1;
  material.alpha = 0.86;
  materials.set(kind, material);
  return material;
}

function ensurePool(scene: Scene): void {
  if (builtScene === scene && pool.length > 0) return;
  pool.length = 0;
  materials.clear();
  builtScene = scene;
  for (let index = 0; index < MAX_MARKERS; index += 1) {
    const marker = MeshBuilder.CreateTorus(`field-focus-marker-${index}`, {
      diameter: MARKER_DIAMETER,
      thickness: 0.045,
      tessellation: 18,
    }, scene);
    marker.rotation.x = Math.PI / 2;
    marker.isPickable = false;
    marker.setEnabled(false);
    pool.push(marker);
  }
}

/** LOW shows fewer markers; Reduced Motion drops the pulse, not the mechanic. */
export function setFieldFocusQuality(tier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA", reduced: boolean): void {
  markerBudget = tier === "LOW" ? MAX_MARKERS_LOW : MAX_MARKERS;
  reducedMotion = reduced;
}

export function isFieldFocusActive(): boolean {
  return active > 0;
}

export function fieldFocusCooldownRemaining(): number {
  return cooldown;
}

/**
 * Start a focus window. Returns false while cooling down, so the control stays
 * an opportunity rather than a toggle.
 */
export function activateFieldFocus(scene: Scene, targets: readonly FieldFocusTarget[]): boolean {
  if (active > 0 || cooldown > 0) return false;
  ensurePool(scene);

  visibleCount = Math.min(targets.length, markerBudget, pool.length);
  for (let index = 0; index < pool.length; index += 1) {
    const marker = pool[index];
    if (!marker) continue;
    if (index >= visibleCount) {
      marker.setEnabled(false);
      continue;
    }
    const target = targets[index];
    if (!target) continue;
    marker.position.copyFromFloats(target.x, target.y + 0.55, target.z);
    marker.material = materialFor(scene, target.kind);
    marker.scaling.setAll(1);
    marker.visibility = 1;
    marker.setEnabled(true);
  }

  active = FIELD_FOCUS_DURATION;
  phase = 0;
  return true;
}

export function updateFieldFocus(dt: number): void {
  if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
  if (active <= 0) return;

  active = Math.max(0, active - dt);
  if (active <= 0) {
    hideMarkers();
    cooldown = FIELD_FOCUS_COOLDOWN;
    return;
  }

  if (reducedMotion) return;
  phase += dt * 2.4;
  const pulse = 1 + Math.sin(phase) * 0.06;
  const fade = Math.min(1, active / 0.6);
  for (let index = 0; index < visibleCount; index += 1) {
    const marker = pool[index];
    if (!marker) continue;
    marker.scaling.setAll(pulse);
    marker.visibility = fade;
  }
}

function hideMarkers(): void {
  for (const marker of pool) marker.setEnabled(false);
  visibleCount = 0;
}

/** Clears markers and timers, e.g. on pause or when a runtime is built. */
export function resetFieldFocus(): void {
  hideMarkers();
  active = 0;
  cooldown = 0;
  phase = 0;
}
