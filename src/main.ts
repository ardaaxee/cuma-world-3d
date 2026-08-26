import "./styles.css";
import { GameRuntime } from "./game/runtime";
import {
  type FpsSetting,
  type GraphicsPreferences,
  type GraphicsTier,
  type ResolutionSetting,
  type ShadowSetting,
  saveGraphicsPreferences,
} from "./game/graphics";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const enter = document.querySelector<HTMLButtonElement>("#enter-world");
const boot = document.querySelector<HTMLElement>("#boot");
const hud = document.querySelector<HTMLElement>("#hud");
const controls = document.querySelector<HTMLElement>("#mobile-controls");
const buildLabel = document.querySelector<HTMLElement>("#build-label");
const settingsOpen = document.querySelector<HTMLButtonElement>("#settings-open");
const settingsClose = document.querySelector<HTMLButtonElement>("#settings-close");
const settingsPanel = document.querySelector<HTMLElement>("#settings-panel");
const tierSelect = document.querySelector<HTMLSelectElement>("#graphics-tier");
const resolutionSelect = document.querySelector<HTMLSelectElement>("#graphics-resolution");
const fpsSelect = document.querySelector<HTMLSelectElement>("#graphics-fps");
const shadowsSelect = document.querySelector<HTMLSelectElement>("#graphics-shadows");
const reducedMotion = document.querySelector<HTMLInputElement>("#reduced-motion");
const graphicsStatus = document.querySelector<HTMLElement>("#graphics-status");

if (
  !canvas || !enter || !boot || !hud || !controls || !buildLabel || !settingsOpen || !settingsClose || !settingsPanel ||
  !tierSelect || !resolutionSelect || !fpsSelect || !shadowsSelect || !reducedMotion || !graphicsStatus
) {
  throw new Error("CUMA WORLD bootstrap DOM is incomplete");
}

const buildSha = (import.meta.env.VITE_BUILD_SHA || "dev").slice(0, 8);
buildLabel.textContent = `ANDROID PLAY RUNTIME · ${buildSha.toUpperCase()} · PRE-RELEASE`;

const runtime = new GameRuntime(canvas);
runtime.start();

function syncControls(preferences: GraphicsPreferences): void {
  tierSelect.value = preferences.tier;
  fpsSelect.value = String(preferences.fps);
  resolutionSelect.value = String(preferences.resolution);
  shadowsSelect.value = preferences.shadows;
  reducedMotion.checked = preferences.reducedMotion;
}

function readPreferences(): GraphicsPreferences {
  return {
    tier: tierSelect.value as GraphicsTier,
    fps: (fpsSelect.value === "AUTO" ? "AUTO" : Number(fpsSelect.value)) as FpsSetting,
    resolution: (resolutionSelect.value === "AUTO" ? "AUTO" : Number(resolutionSelect.value)) as ResolutionSetting,
    shadows: shadowsSelect.value as ShadowSetting,
    reducedMotion: reducedMotion.checked,
  };
}

function applyPreferences(): void {
  const preferences = readPreferences();
  saveGraphicsPreferences(preferences);
  const profile = runtime.applyGraphicsPreferences(preferences);
  graphicsStatus.textContent = `${profile.tier} · RENDER %${Math.round(profile.renderScale * 100)} · ${profile.targetFps} FPS · GÖLGE ${profile.shadowsEnabled ? (profile.softShadows ? "YUMUŞAK" : "AÇIK") : "KAPALI"} · GÖRÜŞ ${profile.cameraFar}M`;
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

syncControls(runtime.getGraphicsPreferences());
applyPreferences();

for (const element of [tierSelect, resolutionSelect, fpsSelect, shadowsSelect, reducedMotion]) {
  element.addEventListener("change", applyPreferences);
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
});
