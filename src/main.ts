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
