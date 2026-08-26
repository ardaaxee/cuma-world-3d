import "./styles.css";
import "./briefing.css";
import { GameRuntime } from "./game/runtime11";
import {
  type FpsSetting,
  type GraphicsPreferences,
  type GraphicsTier,
  type ResolutionSetting,
  type ShadowSetting,
  saveGraphicsPreferences,
} from "./game/graphics";
import {
  type AudioVolume,
  type GameplayPreferences,
  type HudMode,
  type LookSensitivity,
  loadGameplayPreferences,
  saveGameplayPreferences,
} from "./game/preferences";

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`CUMA WORLD missing required element: ${selector}`);
  return element;
}

const canvas = required<HTMLCanvasElement>("#game");
const enter = required<HTMLButtonElement>("#enter-world");
const boot = required<HTMLElement>("#boot");
const hud = required<HTMLElement>("#hud");
const controls = required<HTMLElement>("#mobile-controls");
const buildLabel = required<HTMLElement>("#build-label");
const settingsOpen = required<HTMLButtonElement>("#settings-open");
const settingsClose = required<HTMLButtonElement>("#settings-close");
const settingsPanel = required<HTMLElement>("#settings-panel");
const tierSelect = required<HTMLSelectElement>("#graphics-tier");
const resolutionSelect = required<HTMLSelectElement>("#graphics-resolution");
const fpsSelect = required<HTMLSelectElement>("#graphics-fps");
const shadowsSelect = required<HTMLSelectElement>("#graphics-shadows");
const reducedMotion = required<HTMLInputElement>("#reduced-motion");
const graphicsStatus = required<HTMLElement>("#graphics-status");
const lookSensitivitySelect = required<HTMLSelectElement>("#look-sensitivity");
const audioVolumeSelect = required<HTMLSelectElement>("#audio-volume");
const hudModeSelect = required<HTMLSelectElement>("#hud-mode");

const buildSha = (import.meta.env.VITE_BUILD_SHA || "dev").slice(0, 8);
buildLabel.textContent = `ANDROID PLAY RUNTIME 11 · ${buildSha.toUpperCase()} · PRE-RELEASE`;

const runtime = new GameRuntime(canvas);
runtime.start();

function syncGraphicsControls(preferences: GraphicsPreferences): void {
  tierSelect.value = preferences.tier;
  fpsSelect.value = String(preferences.fps);
  resolutionSelect.value = String(preferences.resolution);
  shadowsSelect.value = preferences.shadows;
  reducedMotion.checked = preferences.reducedMotion;
}

function readGraphicsPreferences(): GraphicsPreferences {
  return {
    tier: tierSelect.value as GraphicsTier,
    fps: (fpsSelect.value === "AUTO" ? "AUTO" : Number(fpsSelect.value)) as FpsSetting,
    resolution: (resolutionSelect.value === "AUTO" ? "AUTO" : Number(resolutionSelect.value)) as ResolutionSetting,
    shadows: shadowsSelect.value as ShadowSetting,
    reducedMotion: reducedMotion.checked,
  };
}

function applyGraphicsPreferences(): void {
  const preferences = readGraphicsPreferences();
  saveGraphicsPreferences(preferences);
  const profile = runtime.applyGraphicsPreferences(preferences);
  graphicsStatus.textContent = `${profile.tier} · RENDER %${Math.round(profile.renderScale * 100)} · ${profile.targetFps} FPS · GÖLGE ${profile.shadowsEnabled ? (profile.softShadows ? "YUMUŞAK" : "AÇIK") : "KAPALI"} · GÖRÜŞ ${profile.cameraFar}M`;
}

function syncGameplayControls(preferences: GameplayPreferences): void {
  lookSensitivitySelect.value = String(preferences.lookSensitivity);
  audioVolumeSelect.value = String(preferences.audioVolume);
  hudModeSelect.value = preferences.hudMode;
}

function readGameplayPreferences(): GameplayPreferences {
  return {
    lookSensitivity: Number(lookSensitivitySelect.value) as LookSensitivity,
    audioVolume: Number(audioVolumeSelect.value) as AudioVolume,
    hudMode: hudModeSelect.value as HudMode,
  };
}

function applyGameplayPreferences(): void {
  const preferences = readGameplayPreferences();
  saveGameplayPreferences(preferences);
  runtime.setLookSensitivity(preferences.lookSensitivity);
  runtime.setAudioVolume(preferences.audioVolume);
  document.body.classList.toggle("hud-compact", preferences.hudMode === "COMPACT");
}

function openSettings(): void {
  settingsPanel.classList.remove("hidden");
  document.body.classList.add("settings-open");
  runtime.setPaused(true);
}

function closeSettings(): void {
  settingsPanel.classList.add("hidden");
  document.body.classList.remove("settings-open");
  runtime.setPaused(false);
}

syncGraphicsControls(runtime.getGraphicsPreferences());
applyGraphicsPreferences();
const gameplayPreferences = loadGameplayPreferences();
syncGameplayControls(gameplayPreferences);
applyGameplayPreferences();

for (const element of [tierSelect, resolutionSelect, fpsSelect, shadowsSelect, reducedMotion]) {
  element.addEventListener("change", applyGraphicsPreferences);
}
for (const element of [lookSensitivitySelect, audioVolumeSelect, hudModeSelect]) {
  element.addEventListener("change", applyGameplayPreferences);
}

settingsOpen.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsPanel.classList.contains("hidden")) closeSettings();
});

enter.addEventListener("click", () => {
  boot.classList.add("hidden");
  hud.classList.remove("hidden");
  controls.classList.remove("hidden");
  void runtime.unlockAudio();
});
