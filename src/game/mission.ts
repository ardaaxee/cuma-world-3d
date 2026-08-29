import "./operation-depth";

export type MissionState = "BRIEFING" | "RECON" | "PLANNING" | "INFILTRATE" | "EXTRACT" | "COMPLETE";
export type MissionInteraction = "route-main" | "route-side" | "objective" | "extract" | "camera-bypass";
export type OperationStep = "" | "ACCESS" | "MANIFEST" | "VERIFY" | "DONE";

export interface MissionSnapshot {
  state: MissionState;
  objective: string;
  intelFound: number;
  intelTotal: number;
  optionalIntelFound: number;
  opportunitiesUsed: number;
  selectedRoute: "" | "main" | "side";
  operationStep: OperationStep;
  rank: "" | "GHOST" | "SHADOW" | "OPERATIVE";
  score: number;
}

type StoredMission = {
  state: MissionState;
  intel: string[];
  selectedRoute: "" | "main" | "side";
  alerts: number;
  opportunities?: string[];
  operationStep?: OperationStep;
};

type OperationAction = "access-terminal" | "manifest-terminal";

const SAVE_KEY = "cuma_world_android_save_v100";

export function resetMissionProgress(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage failure must never prevent returning to a fresh runtime.
  }
  document.body.dataset.route = "none";
  document.body.dataset.operationStep = "none";
  document.body.dataset.intel = "";
}

export class MissionDirector {
  private state: MissionState = "BRIEFING";
  private readonly intel = new Set<string>();
  private readonly opportunities = new Set<string>();
  private selectedRoute: "" | "main" | "side" = "";
  private operationStep: OperationStep = "";
  private alerts = 0;
  private readonly requiredIntel = ["market_front_access", "market_side_access"];
  private readonly optionalIntel = ["market_worker_route", "market_camera"];
  private readonly allIntel = [...this.requiredIntel, ...this.optionalIntel];

  constructor() {
    this.restore();
    this.normalizeOperationStep();
    this.syncRouteSignal();
    this.syncOperationSignal();
    this.syncIntelSignal();
    window.addEventListener("cuma-operation-action", this.onOperationAction as EventListener);
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
    this.syncIntelSignal();
    this.persist();
    return true;
  }

  canInteract(interaction: MissionInteraction): boolean {
    if (interaction === "route-main") return this.state === "PLANNING" && this.intel.has("market_front_access");
    if (interaction === "route-side") return this.state === "PLANNING" && this.intel.has("market_side_access");
    if (interaction === "objective") return this.state === "INFILTRATE" && Boolean(this.selectedRoute) && this.operationStep === "VERIFY";
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
    this.operationStep = "ACCESS";
    this.syncRouteSignal();
    this.syncOperationSignal();
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
    this.operationStep = "DONE";
    this.state = "EXTRACT";
    this.syncOperationSignal();
    this.persist();
    return true;
  }

  extract(): boolean {
    if (!this.canInteract("extract")) return false;
    this.state = "COMPLETE";
    this.operationStep = "DONE";
    this.syncOperationSignal();
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
      operationStep: this.operationStep,
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

  private readonly onOperationAction = (event: CustomEvent<OperationAction>): void => {
    if (this.state !== "INFILTRATE") return;
    if (event.detail === "access-terminal" && this.operationStep === "ACCESS") {
      this.operationStep = "MANIFEST";
      this.syncOperationSignal();
      this.persist();
      return;
    }
    if (event.detail === "manifest-terminal" && this.operationStep === "MANIFEST") {
      this.operationStep = "VERIFY";
      this.syncOperationSignal();
      this.persist();
    }
  };

  private computeScore(): number {
    const optional = this.optionalIntel.filter((id) => this.intel.has(id)).length;
    const routeBonus = this.selectedRoute ? 6 : 0;
    const operationBonus = this.operationStep === "DONE" ? 6 : this.operationStep === "VERIFY" ? 4 : this.operationStep === "MANIFEST" ? 2 : 0;
    const raw = 64 + optional * 8 + this.opportunities.size * 8 + routeBonus + operationBonus - this.alerts * 18;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  private objectiveText(): string {
    switch (this.state) {
      case "BRIEFING": return "Görev dosyasını aç ve Fresh Market bölgesini incele.";
      case "RECON": return "Recon Lens ile iki erişim noktasını analiz et. Ek intel daha yüksek görev skoru sağlar.";
      case "PLANNING": return "Keşfettiğin ANA veya YAN yaklaşımı seç. ANA rota CCTV'ye, YAN rota arka devriyeye daha açık.";
      case "INFILTRATE": {
        const route = this.selectedRoute === "side" ? "YAN ROTA" : "ANA ROTA";
        if (this.operationStep === "ACCESS") return `${route} · Personel erişim terminalini bul ve tek kullanımlık operasyon kodunu al.`;
        if (this.operationStep === "MANIFEST") return `${route} · Erişim kodu alındı. Arka ofis manifest terminalindeki teslimat kaydını eşleştir.`;
        if (this.operationStep === "VERIFY") return `${route} · Manifest eşleşti. Teslimat masasındaki fiziksel kaydı doğrula.`;
        return `${route} · İç bölgede ilerle ve operasyon hedefini tamamla.`;
      }
      case "EXTRACT": return "Doğrulama tamamlandı. Görev alanından fark edilmeden ayrıl.";
      case "COMPLETE": return `Görev tamamlandı · ${this.alerts === 0 ? "GHOST" : this.alerts <= 2 ? "SHADOW" : "OPERATIVE"} · SKOR ${this.computeScore()}`;
    }
  }

  private syncRouteSignal(): void {
    const route = this.selectedRoute || "none";
    document.body.dataset.route = route;
    const status = document.querySelector<HTMLElement>("#route-status");
    if (!status) return;
    if (this.selectedRoute === "main") {
      status.textContent = "ANA ROTA · CCTV RİSKİ";
      status.dataset.route = "main";
      status.classList.remove("hidden");
      return;
    }
    if (this.selectedRoute === "side") {
      status.textContent = "YAN ROTA · ARKA DEVRİYE";
      status.dataset.route = "side";
      status.classList.remove("hidden");
      return;
    }
    status.textContent = "";
    status.dataset.route = "none";
    status.classList.add("hidden");
  }

  private syncOperationSignal(): void {
    document.body.dataset.operationStep = this.operationStep ? this.operationStep.toLowerCase() : "none";
  }

  /** Publishes discovered intel so world affordances (doors) can react to it. */
  private syncIntelSignal(): void {
    document.body.dataset.intel = [...this.intel].join(",");
  }

  private normalizeOperationStep(): void {
    if (this.state === "INFILTRATE" && !this.operationStep) this.operationStep = "ACCESS";
    if ((this.state === "EXTRACT" || this.state === "COMPLETE") && this.operationStep !== "DONE") this.operationStep = "DONE";
    if (this.state !== "INFILTRATE" && this.state !== "EXTRACT" && this.state !== "COMPLETE") this.operationStep = "";
  }

  private persist(): void {
    try {
      const payload: StoredMission = {
        state: this.state,
        intel: [...this.intel],
        selectedRoute: this.selectedRoute,
        alerts: this.alerts,
        opportunities: [...this.opportunities],
        operationStep: this.operationStep,
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
      const validSteps: OperationStep[] = ["", "ACCESS", "MANIFEST", "VERIFY", "DONE"];
      if (data.state && validStates.includes(data.state)) this.state = data.state;
      if (Array.isArray(data.intel)) {
        for (const id of data.intel) if (this.allIntel.includes(id)) this.intel.add(id);
      }
      if (Array.isArray(data.opportunities)) {
        for (const id of data.opportunities) if (id === "camera_bypass") this.opportunities.add(id);
      }
      if (data.selectedRoute === "main" || data.selectedRoute === "side" || data.selectedRoute === "") this.selectedRoute = data.selectedRoute;
      if (data.operationStep && validSteps.includes(data.operationStep)) this.operationStep = data.operationStep;
      if (typeof data.alerts === "number" && Number.isFinite(data.alerts)) this.alerts = Math.max(0, Math.min(999, Math.trunc(data.alerts)));
    } catch {
      this.state = "BRIEFING";
      this.intel.clear();
      this.opportunities.clear();
      this.selectedRoute = "";
      this.operationStep = "";
      this.alerts = 0;
    }
  }
}
