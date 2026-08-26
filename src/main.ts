import "./styles.css";
import "./briefing.css";
import "./hud.css";
import { UiAudioFeedback } from "./game/ui-audio-feedback";
import {
  type FpsSetting,
  type GraphicsPreferences,
  type GraphicsTier,
  type ResolvedGraphicsProfile,
  type ResolutionSetting,
  type ShadowSetting,
  loadGraphicsPreferences,
  resolveGraphicsProfile,
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

type RuntimeApi = {
  start(): void;
  setPaused(paused: boolean): void;
  unlockAudio(): Promise<void>;
  setLookSensitivity(value: number): void;
  setAudioVolume(value: number): void;
  applyGraphicsPreferences(preferences: GraphicsPreferences): ResolvedGraphicsProfile;
};

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
const intelStatus = required<HTMLElement>("#intel");
const awarenessStatus = required<HTMLElement>("#awareness");

const buildSha = (import.meta.env.VITE_BUILD_SHA || "dev").slice(0, 8);
buildLabel.textContent = `ANDROID PLAY RUNTIME 11 · ${buildSha.toUpperCase()} · PRE-RELEASE`;

const uiAudioFeedback = new UiAudioFeedback(intelStatus, awarenessStatus);
let runtime: RuntimeApi | null = null;
let runtimeStarting = false;
let activeHudMode: HudMode = "COMPACT";
let hudQuietTimer: number | null = null;

function clearHudQuietTimer(): void {
  if (hudQuietTimer !== null) {
    window.clearTimeout(hudQuietTimer);
    hudQuietTimer = null;
  }
}

function wakeHud(): void {
  clearHudQuietTimer();
  document.body.classList.remove("hud-quiet");
}

function scheduleHudQuiet(): void {
  clearHudQuietTimer();
  if (activeHudMode !== "COMPACT" || !boot.classList.contains("hidden")) return;
  hudQuietTimer = window.setTimeout(() => {
    if (activeHudMode === "COMPACT" && settingsPanel.classList.contains("hidden")) {
      document.body.classList.add("hud-quiet");
    }
    hudQuietTimer = null;
  }, 4200);
}

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

function renderGraphicsStatus(profile: ResolvedGraphicsProfile): void {
  graphicsStatus.textContent = `${profile.tier} · RENDER %${Math.round(profile.renderScale * 100)} · ${profile.targetFps} FPS · GÖLGE ${profile.shadowsEnabled ? (profile.softShadows ? "YUMUŞAK" : "AÇIK") : "KAPALI"} · GÖRÜŞ ${profile.cameraFar}M`;
}

function applyGraphicsPreferences(): void {
  const preferences = readGraphicsPreferences();
  saveGraphicsPreferences(preferences);
  const profile = runtime ? runtime.applyGraphicsPreferences(preferences) : resolveGraphicsProfile(preferences);
  renderGraphicsStatus(profile);
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
  runtime?.setLookSensitivity(preferences.lookSensitivity);
  runtime?.setAudioVolume(preferences.audioVolume);
  uiAudioFeedback.setVolume(preferences.audioVolume);
  activeHudMode = preferences.hudMode;
  document.body.classList.toggle("hud-compact", activeHudMode === "COMPACT");
  wakeHud();
  scheduleHudQuiet();
}

function openSettings(): void {
  wakeHud();
  settingsPanel.classList.remove("hidden");
  document.body.classList.add("settings-open");
  runtime?.setPaused(true);
}

function closeSettings(): void {
  settingsPanel.classList.add("hidden");
  document.body.classList.remove("settings-open");
  runtime?.setPaused(false);
  scheduleHudQuiet();
}

syncGraphicsControls(loadGraphicsPreferences());
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

enter.addEventListener("click", async () => {
  if (runtimeStarting || runtime) return;
  runtimeStarting = true;
  const originalLabel = enter.textContent ?? "OPERASYONU BAŞLAT";
  enter.disabled = true;
  enter.textContent = "OPERASYON YÜKLENİYOR…";

  try {
    const { GameRuntime } = await import("./game/runtime11");
    const activeRuntime = new GameRuntime(canvas);
    runtime = activeRuntime;
    activeRuntime.applyGraphicsPreferences(readGraphicsPreferences());
    const gameplay = readGameplayPreferences();
    activeRuntime.setLookSensitivity(gameplay.lookSensitivity);
    activeRuntime.setAudioVolume(gameplay.audioVolume);
    activeRuntime.start();

    boot.classList.add("hidden");
    hud.classList.remove("hidden");
    controls.classList.remove("hidden");
    wakeHud();
    scheduleHudQuiet();
    await Promise.allSettled([activeRuntime.unlockAudio(), uiAudioFeedback.unlock()]);
  } catch (error) {
    console.error("CUMA WORLD runtime start failed", error);
    runtime = null;
    enter.disabled = false;
    enter.textContent = "TEKRAR DENE";
    runtimeStarting = false;
    return;
  }

  enter.textContent = originalLabel;
  runtimeStarting = false;
});
