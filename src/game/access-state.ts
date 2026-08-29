/**
 * The operation's fictional staff credential.
 *
 * This is the single source of truth shared by the zone model and the door
 * system. It is derived from the saved operation step, so it survives the
 * existing mission save/restore untouched and defaults to "no credential" for
 * older saves that predate this milestone.
 *
 * Kept dependency-free on purpose: the door system reaches the boot chunk
 * through the world builder, and pulling the zone/cover/noise graph in behind
 * it would bloat startup.
 */

const REFRESH_SECONDS = 0.5;

let override: boolean | null = null;
let granted = false;
let clock = 0;

function readSignal(): boolean {
  const step = document.body.dataset.operationStep ?? "none";
  return step === "manifest" || step === "verify" || step === "done";
}

/**
 * Force the credential on or off. Reserved for future intel/credential
 * unlocks; `null` returns to deriving it from operation progress.
 */
export function setStaffCredentialOverride(value: boolean | null): void {
  override = value;
  clock = 0;
}

/** Throttled refresh so neither consumer reads the DOM every frame. */
export function refreshStaffCredential(dt: number): void {
  if (override !== null) {
    granted = override;
    return;
  }
  clock -= dt;
  if (clock > 0) return;
  clock = REFRESH_SECONDS;
  granted = readSignal();
}

export function hasStaffCredential(): boolean {
  return override !== null ? override : granted;
}

export function resetStaffCredential(): void {
  override = null;
  granted = false;
  clock = 0;
}
