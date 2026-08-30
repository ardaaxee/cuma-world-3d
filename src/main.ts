import "./styles.css";
import "./briefing.css";
import "./hud.css";
import "./debrief.css";
import "./mission-feedback.css";
import "./route-status.css";
import "./graphics-effects.css";
import { MissionDebrief } from "./game/debrief";
import { InteractionPromptGuard } from "./game/interaction-prompt-guard";
import { MissionFeedback } from "./game/mission-feedback";
import {
  DEFAULT_GRAPHICS,
  type AdaptiveQualitySetting,
  type BrightnessSetting,
  type ColorGradeSetting,
  type FilmGrainSetting,
  type FpsSetting,
  type GraphicsPreferences,
  type GraphicsTier,
  type PowerModeSetting,
  type ResolvedGraphicsProfile,
  type ResolutionSetting,
  type ShadowQualitySetting,
  type ShadowSetting,
  type ViewDistanceSetting,
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
const powerModeSelect = required<HTMLSelectElement>("#graphics-power-mode");
const adaptiveQualitySelect = required<HTMLSelectElement>("#graphics-adaptive-quality");
const resolutionSelect = required<HTMLSelectElement>("#graphics-resolution");
const fpsSelect = required<HTMLSelectElement>("#graphics-fps");
const shadowsSelect = required<HTMLSelectElement>("#graphics-shadows");
const shadowQualitySelect = required<HTMLSelectElement>("#graphics-shadow-quality");
const viewDistanceSelect = required<HTMLSelectElement>("#graphics-view-distance");
const colorGradeSelect = required<HTMLSelectElement>("#graphics-color-grade");
const brightnessSelect = required<HTMLSelectElement>("#graphics-brightness");
const filmGrainSelect = required<HTMLSelectElement>("#graphics-film-grain");
const vignetteToggle = required<HTMLInputElement>("#graphics-vignette");
const fpsCounterToggle = required<HTMLInputElement>("#graphics-fps-counter");
const reducedMotion = required<HTMLInputElement>("#reduced-motion");
const graphicsStatus = required<HTMLElement>("#graphics-status");
const graphicsCapabilities = required<HTMLElement>("#graphics-capabilities");
const graphicsReset = required<HTMLButtonElement>("#graphics-reset");
const performanceMeter = required<HTMLElement>("#performance-meter");
const lookSensitivitySelect = required<HTMLSelectElement>("#look-sensitivity");
const audioVolumeSelect = required<HTMLSelectElement>("#audio-volume");
const hudModeSelect = required<HTMLSelectElement>("#hud-mode");
const intelStatus = required<HTMLElement>("#intel");
const interactionStatus = required<HTMLElement>("#interaction");
const debriefOverlay = required<HTMLElement>("#mission-debrief");
const debriefRank = required<HTMLElement>("#debrief-rank");
const debriefScore = required<HTMLElement>("#debrief-score");
const debriefIntel = required<HTMLElement>("#debrief-intel");
const debriefClose = required<HTMLButtonElement>("#debrief-close");

const buildSha = (import.meta.env.VITE_BUILD_SHA || "dev").slice(0, 8);
buildLabel.textContent = `ANDROID PLAY RUNTIME 11 · ${buildSha.toUpperCase()} · PRE-RELEASE`;

let runtime: RuntimeApi | null = null;
let runtimeStarting = false;
let activeHudMode: HudMode = "COMPACT";
let hudQuietTimer: number | null = null;
let settingsPauseActive = false;
let debriefPauseActive = false;
let lifecyclePauseActive = document.hidden;
let graphicsContextPauseActive = false;
let performanceGuard: AdaptivePerformanceGuard | null = null;

function syncRuntimePause(): void {
  const shouldPause = settingsPauseActive || debriefPauseActive || lifecyclePauseActive || graphicsContextPauseActive;
  runtime?.setPaused(shouldPause);
  if (!shouldPause) void runtime?.unlockAudio();
}

// MissionFeedback consumes typed presentation cues; the audible half of those
// cues is owned by GameAudio inside the runtime, so there is one AudioContext
// and one volume owner for the whole game.
new InteractionPromptGuard(intelStatus, interactionStatus);
new MissionFeedback();
new MissionDebrief(
  debriefOverlay,
  debriefRank,
  debriefScore,
  debriefIntel,
  debriefClose,
  () => {
    debriefPauseActive = true;
    syncRuntimePause();
  },
  () => {
    debriefPauseActive = false;
    syncRuntimePause();
  },
  document.querySelector<HTMLElement>(".debrief-note"),
);

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
  powerModeSelect.value = preferences.powerMode;
  adaptiveQualitySelect.value = preferences.adaptiveQuality;
  fpsSelect.value = String(preferences.fps);
  resolutionSelect.value = String(preferences.resolution);
  shadowsSelect.value = preferences.shadows;
  shadowQualitySelect.value = preferences.shadowQuality;
  viewDistanceSelect.value = preferences.viewDistance;
  colorGradeSelect.value = preferences.colorGrade;
  brightnessSelect.value = String(preferences.brightness);
  filmGrainSelect.value = preferences.filmGrain;
  vignetteToggle.checked = preferences.vignette;
  fpsCounterToggle.checked = preferences.showFps;
  reducedMotion.checked = preferences.reducedMotion;
}

function readGraphicsPreferences(): GraphicsPreferences {
  return {
    tier: tierSelect.value as GraphicsTier,
    powerMode: powerModeSelect.value as PowerModeSetting,
    adaptiveQuality: adaptiveQualitySelect.value as AdaptiveQualitySetting,
    fps: (fpsSelect.value === "AUTO" ? "AUTO" : Number(fpsSelect.value)) as FpsSetting,
    resolution: (resolutionSelect.value === "AUTO" ? "AUTO" : Number(resolutionSelect.value)) as ResolutionSetting,
    shadows: shadowsSelect.value as ShadowSetting,
    shadowQuality: shadowQualitySelect.value as ShadowQualitySetting,
    viewDistance: viewDistanceSelect.value as ViewDistanceSetting,
    colorGrade: colorGradeSelect.value as ColorGradeSetting,
    brightness: Number(brightnessSelect.value) as BrightnessSetting,
    filmGrain: filmGrainSelect.value as FilmGrainSetting,
    vignette: vignetteToggle.checked,
    showFps: fpsCounterToggle.checked,
    reducedMotion: reducedMotion.checked,
  };
}

function applyVisualEffects(profile: ResolvedGraphicsProfile): void {
  document.body.classList.toggle("vignette-on", profile.vignette);
  document.body.classList.toggle("film-grain-low", profile.filmGrain === "LOW");
  document.body.classList.toggle("film-grain-high", profile.filmGrain === "HIGH");
  document.body.dataset.grade = profile.colorGrade.toLowerCase();
  document.body.dataset.power = profile.powerMode.toLowerCase();
  performanceMeter.classList.toggle("hidden", !profile.showFps);
}

function renderGraphicsStatus(profile: ResolvedGraphicsProfile, adaptive = false): void {
  const shadow = profile.shadowsEnabled ? (profile.softShadows ? "SOFT" : "HARD") : "OFF";
  const dynamic = adaptive ? " · DYNAMIC" : "";
  graphicsStatus.textContent = `${profile.tier} · ${profile.powerMode} · RENDER %${Math.round(profile.renderScale * 100)}${dynamic} · ${profile.targetFps} FPS · SHADOW ${shadow} · VIEW ${profile.cameraFar}M · ${profile.colorGrade}`;
}

function renderGraphicsCapabilities(): void {
  const probe = document.createElement("canvas");
  const webgl2 = Boolean(probe.getContext("webgl2"));
  const webgl1 = webgl2 || Boolean(probe.getContext("webgl"));
  const api = webgl2 ? "WEBGL2" : webgl1 ? "WEBGL1" : "WEBGL YOK";
  const cores = navigator.hardwareConcurrency || 0;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const memoryLabel = memory ? `${memory}GB RAM-IPUCU` : "RAM BİLİNMİYOR";
  graphicsCapabilities.textContent = `${api} · ${cores || "?"} THREAD · ${memoryLabel} · PBR/TONE MAPPING · HW AA · CONTEXT RECOVERY`;
}

function applyGraphicsPreferences(): void {
  const preferences = readGraphicsPreferences();
  saveGraphicsPreferences(preferences);
  const profile = runtime ? runtime.applyGraphicsPreferences(preferences) : resolveGraphicsProfile(preferences);
  applyVisualEffects(profile);
  renderGraphicsStatus(profile);
  performanceGuard?.configure(preferences, profile);
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
  activeHudMode = preferences.hudMode;
  document.body.classList.toggle("hud-compact", activeHudMode === "COMPACT");
  wakeHud();
  scheduleHudQuiet();
}

function openSettings(): void {
  wakeHud();
  settingsPanel.classList.remove("hidden");
  document.body.classList.add("settings-open");
  settingsPauseActive = true;
  syncRuntimePause();
}

function closeSettings(): void {
  settingsPanel.classList.add("hidden");
  document.body.classList.remove("settings-open");
  settingsPauseActive = false;
  syncRuntimePause();
  scheduleHudQuiet();
}

class AdaptivePerformanceGuard {
  private preferences = { ...DEFAULT_GRAPHICS };
  private baseProfile = resolveGraphicsProfile(this.preferences);
  private effectiveScale = this.baseProfile.renderScale;
  private frames = 0;
  private windowStarted = performance.now();
  private healthyWindows = 0;
  private running = true;

  constructor() {
    requestAnimationFrame((time) => this.sample(time));
  }

  configure(preferences: GraphicsPreferences, profile: ResolvedGraphicsProfile): void {
    this.preferences = { ...preferences };
    this.baseProfile = profile;
    this.effectiveScale = profile.renderScale;
    this.healthyWindows = 0;
    this.frames = 0;
    this.windowStarted = performance.now();
  }

  private sample(now: number): void {
    if (!this.running) return;
    this.frames += 1;
    const elapsed = now - this.windowStarted;
    if (elapsed >= 2500) {
      const observedFps = Math.max(1, Math.round((this.frames * 1000) / elapsed));
      this.frames = 0;
      this.windowStarted = now;
      performanceMeter.textContent = `${observedFps} FPS · RENDER %${Math.round(this.effectiveScale * 100)}`;
      this.adjust(observedFps);
    }
    requestAnimationFrame((time) => this.sample(time));
  }

  private adjust(observedFps: number): void {
    if (!runtime || document.hidden || settingsPauseActive || this.preferences.resolution !== "AUTO" || this.preferences.adaptiveQuality === "OFF") return;
    const target = this.baseProfile.targetFps;
    const aggressive = this.preferences.adaptiveQuality === "AGGRESSIVE";
    const lowThreshold = target * (aggressive ? 0.9 : 0.8);
    const healthyThreshold = target * 0.97;
    let nextScale = this.effectiveScale;

    if (observedFps < lowThreshold) {
      this.healthyWindows = 0;
      nextScale = Math.max(0.6, Math.round((this.effectiveScale - (aggressive ? 0.1 : 0.05)) * 20) / 20);
    } else if (observedFps >= healthyThreshold) {
      this.healthyWindows += 1;
      const windowsNeeded = aggressive ? 2 : 3;
      if (this.healthyWindows >= windowsNeeded) {
        this.healthyWindows = 0;
        nextScale = Math.min(this.baseProfile.renderScale, Math.round((this.effectiveScale + 0.05) * 20) / 20);
      }
    } else {
      this.healthyWindows = 0;
    }

    if (Math.abs(nextScale - this.effectiveScale) < 0.001) return;
    this.effectiveScale = nextScale;
    const transient = { ...this.preferences, resolution: nextScale as ResolutionSetting };
    const profile = runtime.applyGraphicsPreferences(transient);
    renderGraphicsStatus(profile, true);
  }
}

const initialGraphics = loadGraphicsPreferences();
syncGraphicsControls(initialGraphics);
renderGraphicsCapabilities();
applyGraphicsPreferences();
performanceGuard = new AdaptivePerformanceGuard();
performanceGuard.configure(initialGraphics, resolveGraphicsProfile(initialGraphics));
const gameplayPreferences = loadGameplayPreferences();
syncGameplayControls(gameplayPreferences);
applyGameplayPreferences();

for (const element of [
  tierSelect,
  powerModeSelect,
  adaptiveQualitySelect,
  resolutionSelect,
  fpsSelect,
  shadowsSelect,
  shadowQualitySelect,
  viewDistanceSelect,
  colorGradeSelect,
  brightnessSelect,
  filmGrainSelect,
  vignetteToggle,
  fpsCounterToggle,
  reducedMotion,
]) {
  element.addEventListener("change", applyGraphicsPreferences);
}
for (const element of [lookSensitivitySelect, audioVolumeSelect, hudModeSelect]) {
  element.addEventListener("change", applyGameplayPreferences);
}

graphicsReset.addEventListener("click", () => {
  syncGraphicsControls({ ...DEFAULT_GRAPHICS });
  applyGraphicsPreferences();
  if (typeof navigator.vibrate === "function") navigator.vibrate(12);
});

settingsOpen.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsPanel.classList.contains("hidden")) closeSettings();
});

document.addEventListener("visibilitychange", () => {
  lifecyclePauseActive = document.hidden;
  syncRuntimePause();
});
window.addEventListener("pagehide", () => {
  lifecyclePauseActive = true;
  syncRuntimePause();
});
window.addEventListener("pageshow", () => {
  lifecyclePauseActive = document.hidden;
  syncRuntimePause();
});
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  graphicsContextPauseActive = true;
  performanceMeter.textContent = "GPU CONTEXT LOST";
  graphicsStatus.textContent = "GPU CONTEXT KAYBI · TOPARLANMA BEKLENİYOR";
  syncRuntimePause();
});
canvas.addEventListener("webglcontextrestored", () => {
  graphicsContextPauseActive = false;
  const preferences = readGraphicsPreferences();
  const profile = runtime ? runtime.applyGraphicsPreferences(preferences) : resolveGraphicsProfile(preferences);
  applyVisualEffects(profile);
  renderGraphicsStatus(profile);
  performanceGuard?.configure(preferences, profile);
  syncRuntimePause();
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
    const graphics = readGraphicsPreferences();
    const profile = activeRuntime.applyGraphicsPreferences(graphics);
    performanceGuard?.configure(graphics, profile);
    const gameplay = readGameplayPreferences();
    activeRuntime.setLookSensitivity(gameplay.lookSensitivity);
    activeRuntime.setAudioVolume(gameplay.audioVolume);
    activeRuntime.start();
    syncRuntimePause();

    // Unlock audio from the user's original button gesture, before the wait.
    await activeRuntime.unlockAudio();

    boot.classList.add("hidden");
    // HUD and mobile controls stay hidden through the mission intro; on a
    // restored save playMissionIntro() resolves immediately and this reads
    // exactly like the old flow.
    await activeRuntime.playMissionIntro();

    hud.classList.remove("hidden");
    controls.classList.remove("hidden");
    wakeHud();
    scheduleHudQuiet();
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
