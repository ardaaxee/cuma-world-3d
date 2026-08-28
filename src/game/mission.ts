export type MissionState = "BRIEFING" | "RECON" | "PLANNING" | "INFILTRATE" | "EXTRACT" | "COMPLETE";
export type MissionInteraction = "route-main" | "route-side" | "objective" | "extract" | "camera-bypass";

export interface MissionSnapshot {
  state: MissionState;
  objective: string;
  intelFound: number;
  intelTotal: number;
  optionalIntelFound: number;
  opportunitiesUsed: number;
  selectedRoute: "" | "main" | "side";
  rank: "" | "GHOST" | "SHADOW" | "OPERATIVE";
  score: number;
}

type StoredMission = {
  state: MissionState;
  intel: string[];
  selectedRoute: "" | "main" | "side";
  alerts: number;
  opportunities?: string[];
};

const SAVE_KEY = "cuma_world_android_save_v100";

export function resetMissionProgress(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage failure must never prevent returning to a fresh runtime.
  }
  document.body.dataset.route = "none";
}

export class MissionDirector {
  private state: MissionState = "BRIEFING";
  private readonly intel = new Set<string>();
  private readonly opportunities = new Set<string>();
  private selectedRoute: "" | "main" | "side" = "";
  private alerts = 0;
  private readonly requiredIntel = ["market_front_access", "market_side_access"];
  private readonly optionalIntel = ["market_worker_route", "market_camera"];
  private readonly allIntel = [...this.requiredIntel, ...this.optionalIntel];

  constructor() {
    this.restore();
    this.syncRouteSignal();
  }

  acknowledgeBriefing(): void {
    if (this.state === "BRIEFING") {
      this.state = "RECON";
      this.persist();
    }
  }

  discoverIntel(id: string): boolean {
    if (!this.allIntel.includes(id) || this.intel.has(id)) return false;
    this.intel.add(id);
    if ((this.state === "BRIEFING" || this.state === "RECON") && this.requiredIntel.every((key) => this.intel.has(key))) {
      this.state = "PLANNING";
    }
    this.persist();
    return true;
  }

  canInteract(interaction: MissionInteraction): boolean {
    if (interaction === "route-main") return this.state === "PLANNING" && this.intel.has("market_front_access");
    if (interaction === "route-side") return this.state === "PLANNING" && this.intel.has("market_side_access");
    if (interaction === "objective") return this.state === "INFILTRATE" && Boolean(this.selectedRoute);
    if (interaction === "extract") return this.state === "EXTRACT";
    if (interaction === "camera-bypass") {
      return (this.state === "INFILTRATE" || this.state === "EXTRACT")
        && this.intel.has("market_camera")
        && !this.opportunities.has("camera_bypass");
    }
    return false;
  }

  chooseRoute(route: "main" | "side"): boolean {
    const interaction: MissionInteraction = route === "main" ? "route-main" : "route-side";
    if (!this.canInteract(interaction)) return false;
    this.selectedRoute = route;
    this.state = "INFILTRATE";
    this.syncRouteSignal();
    this.persist();
    return true;
  }

  useOpportunity(id: "camera_bypass"): boolean {
    if (!this.canInteract("camera-bypass")) return false;
    this.opportunities.add(id);
    this.persist();
    return true;
  }

  completeObjective(): boolean {
    if (!this.canInteract("objective")) return false;
    this.state = "EXTRACT";
    this.persist();
    return true;
  }

  extract(): boolean {
    if (!this.canInteract("extract")) return false;
    this.state = "COMPLETE";
    this.persist();
    return true;
  }

  reportAlert(): void {
    this.alerts += 1;
    this.persist();
  }

  snapshot(): MissionSnapshot {
    const rank = this.state === "COMPLETE" ? (this.alerts === 0 ? "GHOST" : this.alerts <= 2 ? "SHADOW" : "OPERATIVE") : "";
    return {
      state: this.state,
      objective: this.objectiveText(),
      intelFound: this.intel.size,
      intelTotal: this.allIntel.length,
      optionalIntelFound: this.optionalIntel.filter((id) => this.intel.has(id)).length,
      opportunitiesUsed: this.opportunities.size,
      selectedRoute: this.selectedRoute,
      rank,
      score: this.computeScore(),
    };
  }

  hasIntel(id: string): boolean {
    return this.intel.has(id);
  }

  hasOpportunity(id: string): boolean {
    return this.opportunities.has(id);
  }

  private computeScore(): number {
    const optional = this.optionalIntel.filter((id) => this.intel.has(id)).length;
    const routeBonus = this.selectedRoute ? 6 : 0;
    const raw = 70 + optional * 8 + this.opportunities.size * 8 + routeBonus - this.alerts * 18;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  private objectiveText(): string {
    switch (this.state) {
      case "BRIEFING": return "Görev dosyasını aç ve Fresh Market bölgesini incele.";
      case "RECON": return "Recon Lens ile iki erişim noktasını analiz et. Ek intel daha yüksek görev skoru sağlar.";
      case "PLANNING": return "Keşfettiğin ANA veya YAN yaklaşımı seç. ANA rota CCTV'ye, YAN rota arka devriyeye daha açık.";
      case "INFILTRATE": return this.selectedRoute === "side"
        ? "YAN ROTA · Teslimat girişinden ilerle. CCTV kör noktası daha güçlü; arka güvenlik devriyesi daha tetikte."
        : "ANA ROTA · Ön cepheden ilerle. Güvenlik devriyesi dengeli; CCTV seni daha hızlı fark eder.";
      case "EXTRACT": return "Görev alanından ayrıl.";
      case "COMPLETE": return `Görev tamamlandı · ${this.alerts === 0 ? "GHOST" : this.alerts <= 2 ? "SHADOW" : "OPERATIVE"} · SKOR ${this.computeScore()}`;
    }
  }

  private syncRouteSignal(): void {
    document.body.dataset.route = this.selectedRoute || "none";
  }

  private persist(): void {
    try {
      const payload: StoredMission = {
        state: this.state,
        intel: [...this.intel],
        selectedRoute: this.selectedRoute,
        alerts: this.alerts,
        opportunities: [...this.opportunities],
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // Storage failure must never stop gameplay.
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<StoredMission>;
      const validStates: MissionState[] = ["BRIEFING", "RECON", "PLANNING", "INFILTRATE", "EXTRACT", "COMPLETE"];
      if (data.state && validStates.includes(data.state)) this.state = data.state;
      if (Array.isArray(data.intel)) {
        for (const id of data.intel) if (this.allIntel.includes(id)) this.intel.add(id);
      }
      if (Array.isArray(data.opportunities)) {
        for (const id of data.opportunities) if (id === "camera_bypass") this.opportunities.add(id);
      }
      if (data.selectedRoute === "main" || data.selectedRoute === "side" || data.selectedRoute === "") this.selectedRoute = data.selectedRoute;
      if (typeof data.alerts === "number" && Number.isFinite(data.alerts)) this.alerts = Math.max(0, Math.min(999, Math.trunc(data.alerts)));
    } catch {
      this.state = "BRIEFING";
      this.intel.clear();
      this.opportunities.clear();
      this.selectedRoute = "";
      this.alerts = 0;
    }
  }
}
