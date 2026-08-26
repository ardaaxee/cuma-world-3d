export type GraphicsTier = "AUTO" | "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
export type FpsSetting = "AUTO" | 30 | 45 | 60;
export type ResolutionSetting = "AUTO" | 0.7 | 0.85 | 1;
export type ShadowSetting = "AUTO" | "OFF" | "ON";

export interface GraphicsPreferences {
  tier: GraphicsTier;
  fps: FpsSetting;
  resolution: ResolutionSetting;
  shadows: ShadowSetting;
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
}

const STORAGE_KEY = "cuma_world_graphics_v1";

export const DEFAULT_GRAPHICS: GraphicsPreferences = {
  tier: "AUTO",
  fps: "AUTO",
  resolution: "AUTO",
  shadows: "AUTO",
  reducedMotion: false,
};

function isGraphicsTier(value: unknown): value is GraphicsTier {
  return value === "AUTO" || value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "ULTRA";
}

function isFpsSetting(value: unknown): value is FpsSetting {
  return value === "AUTO" || value === 30 || value === 45 || value === 60;
}

function isResolutionSetting(value: unknown): value is ResolutionSetting {
  return value === "AUTO" || value === 0.7 || value === 0.85 || value === 1;
}

function isShadowSetting(value: unknown): value is ShadowSetting {
  return value === "AUTO" || value === "OFF" || value === "ON";
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

const BASE_PROFILES: Record<Exclude<GraphicsTier, "AUTO">, ResolvedGraphicsProfile> = {
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

export function resolveGraphicsProfile(preferences: GraphicsPreferences): ResolvedGraphicsProfile {
  const tier = preferences.tier === "AUTO" ? resolveAutoTier() : preferences.tier;
  const base = BASE_PROFILES[tier];
  return {
    ...base,
    renderScale: preferences.resolution === "AUTO" ? base.renderScale : preferences.resolution,
    targetFps: preferences.fps === "AUTO" ? base.targetFps : preferences.fps,
    shadowsEnabled: preferences.shadows === "AUTO" ? base.shadowsEnabled : preferences.shadows === "ON",
  };
}
