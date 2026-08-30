export type LookSensitivity = 0.75 | 1 | 1.25 | 1.5;
export type AudioVolume = 0 | 0.5 | 0.75 | 1;
export type HudMode = "COMPACT" | "FULL";
export type ControlSize = "COMPACT" | "STANDARD" | "LARGE";
export type ControlHandedness = "RIGHT" | "LEFT";

export interface GameplayPreferences {
  lookSensitivity: LookSensitivity;
  audioVolume: AudioVolume;
  hudMode: HudMode;
  hapticsEnabled: boolean;
  controlSize: ControlSize;
  controlHandedness: ControlHandedness;
  invertLookY: boolean;
}

export const GAMEPLAY_PREFERENCES_KEY = "cuma_world_gameplay_preferences_v1";

export const DEFAULT_GAMEPLAY_PREFERENCES: GameplayPreferences = {
  lookSensitivity: 1,
  audioVolume: 0.75,
  hudMode: "COMPACT",
  hapticsEnabled: true,
  controlSize: "STANDARD",
  controlHandedness: "RIGHT",
  invertLookY: false,
};

export function loadGameplayPreferences(): GameplayPreferences {
  try {
    const raw = localStorage.getItem(GAMEPLAY_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_GAMEPLAY_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<GameplayPreferences>;
    const lookSensitivity = parsed.lookSensitivity === 0.75 || parsed.lookSensitivity === 1 || parsed.lookSensitivity === 1.25 || parsed.lookSensitivity === 1.5
      ? parsed.lookSensitivity
      : DEFAULT_GAMEPLAY_PREFERENCES.lookSensitivity;
    const audioVolume = parsed.audioVolume === 0 || parsed.audioVolume === 0.5 || parsed.audioVolume === 0.75 || parsed.audioVolume === 1
      ? parsed.audioVolume
      : DEFAULT_GAMEPLAY_PREFERENCES.audioVolume;
    const hudMode = parsed.hudMode === "FULL" || parsed.hudMode === "COMPACT" ? parsed.hudMode : DEFAULT_GAMEPLAY_PREFERENCES.hudMode;
    const hapticsEnabled = typeof parsed.hapticsEnabled === "boolean"
      ? parsed.hapticsEnabled
      : DEFAULT_GAMEPLAY_PREFERENCES.hapticsEnabled;
    const controlSize = parsed.controlSize === "COMPACT" || parsed.controlSize === "STANDARD" || parsed.controlSize === "LARGE"
      ? parsed.controlSize
      : DEFAULT_GAMEPLAY_PREFERENCES.controlSize;
    const controlHandedness = parsed.controlHandedness === "LEFT" || parsed.controlHandedness === "RIGHT"
      ? parsed.controlHandedness
      : DEFAULT_GAMEPLAY_PREFERENCES.controlHandedness;
    const invertLookY = typeof parsed.invertLookY === "boolean"
      ? parsed.invertLookY
      : DEFAULT_GAMEPLAY_PREFERENCES.invertLookY;
    return { lookSensitivity, audioVolume, hudMode, hapticsEnabled, controlSize, controlHandedness, invertLookY };
  } catch {
    return { ...DEFAULT_GAMEPLAY_PREFERENCES };
  }
}

export function saveGameplayPreferences(preferences: GameplayPreferences): void {
  try {
    localStorage.setItem(GAMEPLAY_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Restricted WebViews can reject localStorage; runtime settings still remain active for the session.
  }
}
