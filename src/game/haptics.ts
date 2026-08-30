export type HapticPattern = number | readonly number[];

let enabled = true;

/**
 * The only vibration owner. Haptics are feedback only: they never affect
 * mission, stealth, movement or AI state, and there is no polling/timer path.
 */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function areHapticsEnabled(): boolean {
  return enabled;
}

export function emitHaptic(pattern: HapticPattern): void {
  if (!enabled || document.visibilityState !== "visible") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
  } catch {
    // Some WebViews expose vibrate but reject it outside a user gesture.
  }
}

export function hapticTap(): void {
  emitHaptic(8);
}

export function hapticConfirm(): void {
  emitHaptic([12, 22, 12]);
}

export function hapticWarning(): void {
  emitHaptic([24, 28, 24]);
}

export function hapticCritical(): void {
  emitHaptic([44, 30, 66]);
}