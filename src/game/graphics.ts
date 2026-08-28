export type GraphicsTier = "AUTO" | "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
export type FpsSetting = "AUTO" | 30 | 45 | 60;
export type ResolutionSetting = "AUTO" | 0.6 | 0.65 | 0.7 | 0.75 | 0.8 | 0.85 | 0.9 | 0.95 | 1;
export type ShadowSetting = "AUTO" | "OFF" | "ON";
export type ShadowQualitySetting = "AUTO" | "HARD" | "SOFT";
export type ViewDistanceSetting = "AUTO" | "NEAR" | "MEDIUM" | "FAR" | "MAX";
export type ColorGradeSetting = "CINEMATIC" | "NEUTRAL" | "WARM" | "CRISP";
export type PowerModeSetting = "BATTERY" | "BALANCED" | "PERFORMANCE" | "QUALITY";
export type FilmGrainSetting = "OFF" | "LOW" | "HIGH";
export type AdaptiveQualitySetting = "OFF" | "BALANCED" | "AGGRESSIVE";
export type BrightnessSetting = 0.85 | 0.95 | 1 | 1.05 | 1.15;

export interface GraphicsPreferences {
  tier: GraphicsTier;
  fps: FpsSetting;
  resolution: ResolutionSetting;
  shadows: ShadowSetting;
  shadowQuality: ShadowQualitySetting;
  viewDistance: ViewDistanceSetting;
  colorGrade: ColorGradeSetting;
  powerMode: PowerModeSetting;
  filmGrain: FilmGrainSetting;
  adaptiveQuality: AdaptiveQualitySetting;
  brightness: BrightnessSetting;
  vignette: boolean;
  showFps: boolean;
  reducedMotion: boolean;
}

export interface ResolvedGraphicsProfile {
  tier: Exclude<GraphicsTier, "AUTO">;
  renderScale: number;
  targetFps: 30 | 45 | 60;
  shadowsEnabled: boolean;
  softShadows: boolean;
  fogEnd: number;
  exposure: number;
  contrast: number;
  cameraFar: number;
  colorGrade: ColorGradeSetting;
  powerMode: PowerModeSetting;
  filmGrain: FilmGrainSetting;
  adaptiveQuality: AdaptiveQualitySetting;
  brightness: BrightnessSetting;
  vignette: boolean;
  showFps: boolean;
}

type BaseProfile = Omit<ResolvedGraphicsProfile, "colorGrade" | "powerMode" | "filmGrain" | "adaptiveQuality" | "brightness" | "vignette" | "showFps">;

const STORAGE_KEY = "cuma_world_graphics_v1";

export const DEFAULT_GRAPHICS: GraphicsPreferences = {
  tier: "AUTO",
  fps: "AUTO",
  resolution: "AUTO",
  shadows: "AUTO",
  shadowQuality: "AUTO",
  viewDistance: "AUTO",
  colorGrade: "CINEMATIC",
  powerMode: "BALANCED",
  filmGrain: "LOW",
  adaptiveQuality: "BALANCED",
  brightness: 1,
  vignette: true,
  showFps: false,
  reducedMotion: false,
};

function isGraphicsTier(value: unknown): value is GraphicsTier {
  return value === "AUTO" || value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "ULTRA";
}

function isFpsSetting(value: unknown): value is FpsSetting {
  return value === "AUTO" || value === 30 || value === 45 || value === 60;
}

function isResolutionSetting(value: unknown): value is ResolutionSetting {
  return value === "AUTO" || value === 0.6 || value === 0.65 || value === 0.7 || value === 0.75 || value === 0.8 || value === 0.85 || value === 0.9 || value === 0.95 || value === 1;
}

function isShadowSetting(value: unknown): value is ShadowSetting {
  return value === "AUTO" || value === "OFF" || value === "ON";
}

function isShadowQualitySetting(value: unknown): value is ShadowQualitySetting {
  return value === "AUTO" || value === "HARD" || value === "SOFT";
}

function isViewDistanceSetting(value: unknown): value is ViewDistanceSetting {
  return value === "AUTO" || value === "NEAR" || value === "MEDIUM" || value === "FAR" || value === "MAX";
}

function isColorGradeSetting(value: unknown): value is ColorGradeSetting {
  return value === "CINEMATIC" || value === "NEUTRAL" || value === "WARM" || value === "CRISP";
}

function isPowerModeSetting(value: unknown): value is PowerModeSetting {
  return value === "BATTERY" || value === "BALANCED" || value === "PERFORMANCE" || value === "QUALITY";
}

function isFilmGrainSetting(value: unknown): value is FilmGrainSetting {
  return value === "OFF" || value === "LOW" || value === "HIGH";
}

function isAdaptiveQualitySetting(value: unknown): value is AdaptiveQualitySetting {
  return value === "OFF" || value === "BALANCED" || value === "AGGRESSIVE";
}

function isBrightnessSetting(value: unknown): value is BrightnessSetting {
  return value === 0.85 || value === 0.95 || value === 1 || value === 1.05 || value === 1.15;
}

export function loadGraphicsPreferences(): GraphicsPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GRAPHICS };
    const value = JSON.parse(raw) as Partial<GraphicsPreferences>;
    return {
      tier: isGraphicsTier(value.tier) ? value.tier : DEFAULT_GRAPHICS.tier,
      fps: isFpsSetting(value.fps) ? value.fps : DEFAULT_GRAPHICS.fps,
      resolution: isResolutionSetting(value.resolution) ? value.resolution : DEFAULT_GRAPHICS.resolution,
      shadows: isShadowSetting(value.shadows) ? value.shadows : DEFAULT_GRAPHICS.shadows,
      shadowQuality: isShadowQualitySetting(value.shadowQuality) ? value.shadowQuality : DEFAULT_GRAPHICS.shadowQuality,
      viewDistance: isViewDistanceSetting(value.viewDistance) ? value.viewDistance : DEFAULT_GRAPHICS.viewDistance,
      colorGrade: isColorGradeSetting(value.colorGrade) ? value.colorGrade : DEFAULT_GRAPHICS.colorGrade,
      powerMode: isPowerModeSetting(value.powerMode) ? value.powerMode : DEFAULT_GRAPHICS.powerMode,
      filmGrain: isFilmGrainSetting(value.filmGrain) ? value.filmGrain : DEFAULT_GRAPHICS.filmGrain,
      adaptiveQuality: isAdaptiveQualitySetting(value.adaptiveQuality) ? value.adaptiveQuality : DEFAULT_GRAPHICS.adaptiveQuality,
      brightness: isBrightnessSetting(value.brightness) ? value.brightness : DEFAULT_GRAPHICS.brightness,
      vignette: typeof value.vignette === "boolean" ? value.vignette : DEFAULT_GRAPHICS.vignette,
      showFps: typeof value.showFps === "boolean" ? value.showFps : DEFAULT_GRAPHICS.showFps,
      reducedMotion: typeof value.reducedMotion === "boolean" ? value.reducedMotion : DEFAULT_GRAPHICS.reducedMotion,
    };
  } catch {
    return { ...DEFAULT_GRAPHICS };
  }
}

export function saveGraphicsPreferences(preferences: GraphicsPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable in restricted WebViews. Runtime settings still work for this session.
  }
}

function resolveAutoTier(): Exclude<GraphicsTier, "AUTO"> {
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency || 4;
  const pixels = Math.max(1, window.screen.width * window.screen.height * window.devicePixelRatio * window.devicePixelRatio);

  if (mobile) {
    if (memory <= 3 || cores <= 4 || pixels > 7_500_000) return "LOW";
    return "MEDIUM";
  }
  if (memory >= 12 && cores >= 8) return "HIGH";
  return "MEDIUM";
}

const BASE_PROFILES: Record<Exclude<GraphicsTier, "AUTO">, BaseProfile> = {
  LOW: {
    tier: "LOW",
    renderScale: 0.68,
    targetFps: 30,
    shadowsEnabled: false,
    softShadows: false,
    fogEnd: 66,
    exposure: 1.01,
    contrast: 1.03,
    cameraFar: 95,
  },
  MEDIUM: {
    tier: "MEDIUM",
    renderScale: 0.8,
    targetFps: 45,
    shadowsEnabled: true,
    softShadows: false,
    fogEnd: 90,
    exposure: 1.04,
    contrast: 1.06,
    cameraFar: 120,
  },
  HIGH: {
    tier: "HIGH",
    renderScale: 0.92,
    targetFps: 60,
    shadowsEnabled: true,
    softShadows: true,
    fogEnd: 112,
    exposure: 1.06,
    contrast: 1.08,
    cameraFar: 145,
  },
  ULTRA: {
    tier: "ULTRA",
    renderScale: 1,
    targetFps: 60,
    shadowsEnabled: true,
    softShadows: true,
    fogEnd: 132,
    exposure: 1.07,
    contrast: 1.09,
    cameraFar: 165,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveGraphicsProfile(preferences: GraphicsPreferences): ResolvedGraphicsProfile {
  const tier = preferences.tier === "AUTO" ? resolveAutoTier() : preferences.tier;
  const base = BASE_PROFILES[tier];
  let renderScale = base.renderScale;
  let targetFps: 30 | 45 | 60 = base.targetFps;
  let fogEnd = base.fogEnd;
  let cameraFar = base.cameraFar;
  let exposure = base.exposure;
  let contrast = base.contrast;

  if (preferences.powerMode === "BATTERY") {
    renderScale -= 0.12;
    targetFps = 30;
    fogEnd *= 0.88;
    cameraFar *= 0.86;
  } else if (preferences.powerMode === "PERFORMANCE") {
    renderScale -= 0.06;
    targetFps = 60;
  } else if (preferences.powerMode === "QUALITY") {
    renderScale += 0.04;
    fogEnd += 8;
    cameraFar += 10;
  }

  if (preferences.resolution !== "AUTO") renderScale = preferences.resolution;
  if (preferences.fps !== "AUTO") targetFps = preferences.fps;

  if (preferences.viewDistance === "NEAR") {
    fogEnd = 68;
    cameraFar = 95;
  } else if (preferences.viewDistance === "MEDIUM") {
    fogEnd = 90;
    cameraFar = 120;
  } else if (preferences.viewDistance === "FAR") {
    fogEnd = 118;
    cameraFar = 150;
  } else if (preferences.viewDistance === "MAX") {
    fogEnd = 145;
    cameraFar = 180;
  }

  if (preferences.colorGrade === "NEUTRAL") {
    exposure = 1;
    contrast = 1.02;
  } else if (preferences.colorGrade === "WARM") {
    exposure = base.exposure + 0.03;
    contrast = base.contrast + 0.01;
  } else if (preferences.colorGrade === "CRISP") {
    exposure = base.exposure + 0.01;
    contrast = Math.max(base.contrast, 1.12);
  }
  exposure *= preferences.brightness;

  const shadowsEnabled = preferences.shadows === "AUTO" ? base.shadowsEnabled : preferences.shadows === "ON";
  const softShadows = shadowsEnabled && (preferences.shadowQuality === "AUTO" ? base.softShadows : preferences.shadowQuality === "SOFT");

  return {
    tier,
    renderScale: Math.round(clamp(renderScale, 0.6, 1) * 100) / 100,
    targetFps,
    shadowsEnabled,
    softShadows,
    fogEnd: Math.round(fogEnd),
    exposure: Math.round(clamp(exposure, 0.82, 1.28) * 100) / 100,
    contrast: Math.round(contrast * 100) / 100,
    cameraFar: Math.round(cameraFar),
    colorGrade: preferences.colorGrade,
    powerMode: preferences.powerMode,
    filmGrain: preferences.filmGrain,
    adaptiveQuality: preferences.adaptiveQuality,
    brightness: preferences.brightness,
    vignette: preferences.vignette,
    showFps: preferences.showFps,
  };
}
