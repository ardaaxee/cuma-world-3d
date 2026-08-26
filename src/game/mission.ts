export type MissionState = "BRIEFING" | "RECON" | "PLANNING" | "INFILTRATE" | "EXTRACT" | "COMPLETE";

export interface MissionSnapshot {
  state: MissionState;
  objective: string;
  intelFound: number;
  intelTotal: number;
  selectedRoute: "" | "main" | "side";
  rank: "" | "GHOST" | "SHADOW" | "OPERATIVE";
}

type StoredMission = {
  state: MissionState;
  intel: string[];
  selectedRoute: "" | "main" | "side";
  alerts: number;
};

const SAVE_KEY = "cuma_world_android_save_v100";

export class MissionDirector {
  private state: MissionState = "BRIEFING";
  private readonly intel = new Set<string>();
  private selectedRoute: "" | "main" | "side" = "";
  private alerts = 0;
  private readonly requiredIntel = ["market_front_access", "market_side_access"];
  private readonly allIntel = ["market_front_access", "market_side_access", "market_worker_route", "market_camera"];

  constructor() {
    this.restore();
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

  chooseRoute(route: "main" | "side"): boolean {
    if (this.state !== "PLANNING") return false;
    const required = route === "main" ? "market_front_access" : "market_side_access";
    if (!this.intel.has(required)) return false;
    this.selectedRoute = route;
    this.state = "INFILTRATE";
    this.persist();
    return true;
  }

  completeObjective(): boolean {
    if (this.state !== "INFILTRATE" || !this.selectedRoute) return false;
    this.state = "EXTRACT";
    this.persist();
    return true;
  }

  extract(): boolean {
    if (this.state !== "EXTRACT") return false;
    this.state = "COMPLETE";
    this.persist();
    return true;
  }

  reportAlert(): void {
    this.alerts += 1;
    this.persist();
  }

  snapshot(): MissionSnapshot {
    return {
      state: this.state,
      objective: this.objectiveText(),
      intelFound: this.intel.size,
      intelTotal: this.allIntel.length,
      selectedRoute: this.selectedRoute,
      rank: this.state === "COMPLETE" ? (this.alerts === 0 ? "GHOST" : this.alerts <= 2 ? "SHADOW" : "OPERATIVE") : "",
    };
  }

  hasIntel(id: string): boolean {
    return this.intel.has(id);
  }

  private objectiveText(): string {
    switch (this.state) {
      case "BRIEFING": return "Görev dosyasını aç ve Fresh Market bölgesini incele.";
      case "RECON": return "Recon Lens ile iki erişim noktasını analiz et.";
      case "PLANNING": return "Keşfettiğin ANA veya YAN yaklaşımı seç.";
      case "INFILTRATE": return "Seçtiğin rotadan görev alanına gir ve teslimat kaydını doğrula.";
      case "EXTRACT": return "Görev alanından ayrıl.";
      case "COMPLETE": return `Görev tamamlandı · ${this.alerts === 0 ? "GHOST" : this.alerts <= 2 ? "SHADOW" : "OPERATIVE"}`;
    }
  }

  private persist(): void {
    try {
      const payload: StoredMission = {
        state: this.state,
        intel: [...this.intel],
        selectedRoute: this.selectedRoute,
        alerts: this.alerts,
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
      if (data.selectedRoute === "main" || data.selectedRoute === "side" || data.selectedRoute === "") this.selectedRoute = data.selectedRoute;
      if (typeof data.alerts === "number" && Number.isFinite(data.alerts)) this.alerts = Math.max(0, Math.min(999, Math.trunc(data.alerts)));
    } catch {
      this.state = "BRIEFING";
      this.intel.clear();
      this.selectedRoute = "";
      this.alerts = 0;
    }
  }
}
