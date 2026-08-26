export type LookSensitivity = 0.75 | 1 | 1.25 | 1.5;
export type AudioVolume = 0 | 0.5 | 0.75 | 1;
export type HudMode = "COMPACT" | "FULL";

export interface GameplayPreferences {
  lookSensitivity: LookSensitivity;
  audioVolume: AudioVolume;
  hudMode: HudMode;
}

const STORAGE_KEY = "cuma_world_gameplay_preferences_v1";

export const DEFAULT_GAMEPLAY_PREFERENCES: GameplayPreferences = {
  lookSensitivity: 1,
  audioVolume: 0.75,
  hudMode: "COMPACT",
};

export function loadGameplayPreferences(): GameplayPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAMEPLAY_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<GameplayPreferences>;
    const lookSensitivity = parsed.lookSensitivity === 0.75 || parsed.lookSensitivity === 1 || parsed.lookSensitivity === 1.25 || parsed.lookSensitivity === 1.5
      ? parsed.lookSensitivity
      : DEFAULT_GAMEPLAY_PREFERENCES.lookSensitivity;
    const audioVolume = parsed.audioVolume === 0 || parsed.audioVolume === 0.5 || parsed.audioVolume === 0.75 || parsed.audioVolume === 1
      ? parsed.audioVolume
      : DEFAULT_GAMEPLAY_PREFERENCES.audioVolume;
    const hudMode = parsed.hudMode === "FULL" || parsed.hudMode === "COMPACT" ? parsed.hudMode : DEFAULT_GAMEPLAY_PREFERENCES.hudMode;
    return { lookSensitivity, audioVolume, hudMode };
  } catch {
    return { ...DEFAULT_GAMEPLAY_PREFERENCES };
  }
}

export function saveGameplayPreferences(preferences: GameplayPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Restricted WebViews can reject localStorage; runtime settings still remain active for the session.
  }
}
