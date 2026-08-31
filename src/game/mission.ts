import {
  type IntelId,
  type MissionResolutionId,
  type MissionStageId,
  type OperationStep,
  type OptionalObjectiveId,
  type OpportunityId,
  STAGE_ORDER,
  allOptionalObjectiveIds,
  firstBlockingStage,
  getOpportunity,
  getOptionalObjective,
  getResolution,
  getStage,
  isOptionalObjectiveId,
  isOpportunityId,
  isResolutionId,
  isStageId,
  legacyResolutionFor,
  resolutionsForStage,
  stagesImpliedByStep,
  stepForResolvedStages,
} from "./mission-graph";
import {
  type MissionStateName,
  type RouteName,
  type StoredMission,
  createRunSeed,
  isValidRunSeed,
  readStoredMission,
  resetMissionProgress,
  writeStoredMission,
} from "./mission-save";
import { type MissionRank, type MissionResult, publishMissionResult } from "./mission-result";
import { RunTelemetry, type TelemetryFacilityState } from "./run-telemetry";
import { SpycraftState, allSpycraftFactIds, isSpycraftFactId, opportunityForFact } from "./spycraft";
import { publishPresentation } from "./presentation-events";

export type MissionState = MissionStateName;
export type MissionInteraction = "route-main" | "route-side" | "objective" | "extract" | "camera-bypass";
export type { OperationStep };

/** Score weights, named so they can be tuned without hunting through arithmetic. */
const SCORE_BASE = 58;
const SCORE_ROUTE_CHOSEN = 6;
const SCORE_OPTIONAL_INTEL = 6;
const SCORE_ALERT_PENALTY = 18;

export interface MissionSnapshot {
  state: MissionState;
  objective: string;
  intelFound: number;
  intelTotal: number;
  optionalIntelFound: number;
  opportunitiesUsed: number;
  selectedRoute: RouteName;
  operationStep: OperationStep;
  rank: "" | MissionRank;
  score: number;
  /** Milestone 05 read-only additions. */
  objectivesCompleted: number;
  objectivesTotal: number;
  runSeed: number;
  spycraftFactsFound: number;
  fieldInstinctRemaining: number;
}

type OperationAction = "access-terminal" | "manifest-terminal";

/** Re-exported so existing callers keep working after the save/reset move. */
export { resetMissionProgress };

export class MissionDirector {
  private state: MissionState = "BRIEFING";
  private readonly intel = new Set<IntelId>();
  private readonly opportunities = new Set<OpportunityId>();
  private readonly objectives = new Set<OptionalObjectiveId>();
  /** Which resolution completed each stage. Presence == stage complete. */
  private readonly resolutions = new Map<MissionStageId, MissionResolutionId>();
  private selectedRoute: RouteName = "";
  private alerts = 0;
  private runSeed = 0;
  private publishedResult = false;
  private readonly telemetry = new RunTelemetry();
  private readonly spycraft = new SpycraftState();
  private readonly requiredIntel: IntelId[] = ["market_front_access", "market_side_access"];
  private readonly optionalIntel: IntelId[] = ["market_worker_route", "market_camera"];
  private readonly allIntel: IntelId[] = [...this.requiredIntel, ...this.optionalIntel];

  constructor() {
    this.restore();
    this.normalizeProgress();
    this.syncRouteSignal();
    this.syncOperationSignal();
    this.syncIntelSignal();
    this.syncSpycraftSignal();
    window.addEventListener("cuma-operation-action", this.onOperationAction as EventListener);
    // A save restored straight into COMPLETE must still produce a debrief.
    if (this.state === "COMPLETE") this.publishResult();
  }

  acknowledgeBriefing(): void {
    if (this.state === "BRIEFING") {
      this.state = "RECON";
      this.persist();
    }
  }

  discoverIntel(id: string): boolean {
    if (!this.isIntelId(id) || this.intel.has(id)) return false;
    this.intel.add(id);
    if ((this.state === "BRIEFING" || this.state === "RECON") && this.requiredIntel.every((key) => this.intel.has(key))) {
      this.state = "PLANNING";
    }
    this.syncIntelSignal();
    this.persist();
    return true;
  }

  discoverSpycraftFact(id: string): boolean {
    if (!this.spycraft.discoverFact(id)) return false;
    if (isSpycraftFactId(id)) {
      const opportunity = opportunityForFact(id);
      publishPresentation("SPYCRAFT_INTEL", "İSTİHBARAT DOĞRULANDI", id);
      publishPresentation("SPYCRAFT_OPPORTUNITY", "FIRSAT AÇILDI", opportunity);
    }
    this.syncSpycraftSignal();
    this.persist();
    return true;
  }

  hasSpycraftFact(id: string): boolean {
    return this.spycraft.hasFact(id);
  }

  canSpendFieldInstinct(state: TelemetryFacilityState): boolean {
    return this.spycraft.canSpendFieldInstinct(state);
  }

  spendFieldInstinct(state: TelemetryFacilityState): boolean {
    const spent = this.spycraft.spendFieldInstinct(state);
    if (spent) this.persist();
    return spent;
  }

  canInteract(interaction: MissionInteraction): boolean {
    if (interaction === "route-main") return this.state === "PLANNING" && this.intel.has("market_front_access");
    if (interaction === "route-side") return this.state === "PLANNING" && this.intel.has("market_side_access");
    if (interaction === "objective") return this.canResolve("verify_counter");
    if (interaction === "extract") return this.state === "EXTRACT";
    if (interaction === "camera-bypass") return this.canUseOpportunity("camera_bypass");
    return false;
  }

  chooseRoute(route: "main" | "side"): boolean {
    const interaction: MissionInteraction = route === "main" ? "route-main" : "route-side";
    if (!this.canInteract(interaction)) return false;
    this.selectedRoute = route;
    this.state = "INFILTRATE";
    this.syncRouteSignal();
    this.syncOperationSignal();
    this.persist();
    return true;
  }

  // --- mission graph ------------------------------------------------------

  /**
   * True when this exact resolution could be used right now. The stage-already
   * resolved check is what stops an alternate solution double-completing a
   * stage that its sibling already finished.
   */
  canResolve(id: MissionResolutionId): boolean {
    if (this.state !== "INFILTRATE" || !this.selectedRoute) return false;
    const resolution = getResolution(id);
    if (this.resolutions.has(resolution.stage)) return false;
    const stage = getStage(resolution.stage);
    if (stage.prerequisite && !this.resolutions.has(stage.prerequisite)) return false;
    if (
      resolution.requiresIntel
      && !this.intel.has(resolution.requiresIntel)
      && !(resolution.spycraftFact && this.spycraft.hasFact(resolution.spycraftFact))
    ) return false;
    return true;
  }

  /** Completes a stage through one specific resolution, exactly once. */
  resolveStage(id: MissionResolutionId): boolean {
    if (!this.canResolve(id)) return false;
    const resolution = getResolution(id);
    this.resolutions.set(resolution.stage, id);
    if (!firstBlockingStage(this.resolvedStages())) this.state = "EXTRACT";
    this.syncOperationSignal();
    this.persist();
    return true;
  }

  /** Whether a stage is already finished, for prompts and FIELD FOCUS. */
  isStageResolved(stage: MissionStageId): boolean {
    return this.resolutions.has(stage);
  }

  resolutionFor(stage: MissionStageId): MissionResolutionId | null {
    return this.resolutions.get(stage) ?? null;
  }

  // --- optional objectives ------------------------------------------------

  canCompleteObjective(id: OptionalObjectiveId): boolean {
    if (this.state !== "INFILTRATE" && this.state !== "EXTRACT") return false;
    return !this.objectives.has(id);
  }

  /** Optional work never gates extraction; it only adds score and debrief credit. */
  completeOptionalObjective(id: OptionalObjectiveId): boolean {
    if (!this.canCompleteObjective(id)) return false;
    this.objectives.add(id);
    this.persist();
    return true;
  }

  hasObjective(id: OptionalObjectiveId): boolean {
    return this.objectives.has(id);
  }

  // --- opportunities ------------------------------------------------------

  canUseOpportunity(id: OpportunityId): boolean {
    if (this.state !== "INFILTRATE" && this.state !== "EXTRACT") return false;
    const opportunity = getOpportunity(id);
    if (opportunity.oncePerRun && this.opportunities.has(id)) return false;
    if (
      opportunity.requiresIntel
      && !this.intel.has(opportunity.requiresIntel)
      && !(opportunity.spycraftFact && this.spycraft.hasFact(opportunity.spycraftFact))
    ) return false;
    if (opportunity.requiresObjective && !this.objectives.has(opportunity.requiresObjective)) return false;
    return true;
  }

  useOpportunity(id: OpportunityId): boolean {
    if (!this.canUseOpportunity(id)) return false;
    this.opportunities.add(id);
    this.persist();
    return true;
  }

  hasOpportunity(id: string): boolean {
    return isOpportunityId(id) && this.opportunities.has(id);
  }

  // --- completion ---------------------------------------------------------

  /** Kept for the existing delivery-counter interactable. */
  completeObjective(): boolean {
    return this.resolveStage("verify_counter");
  }

  extract(): boolean {
    if (!this.canInteract("extract")) return false;
    this.state = "COMPLETE";
    this.syncOperationSignal();
    this.persist();
    this.publishResult();
    return true;
  }

  reportAlert(): void {
    this.alerts += 1;
    this.persist();
  }

  /**
   * One call per gameplay frame from the runtime.
   *
   * The runtime's update never runs while paused or during the cinematic, so
   * neither can reach this. Storage is touched only when the accumulator says a
   * checkpoint is due — roughly every five seconds of measured operation, never
   * per frame.
   */
  recordRunTime(dt: number, active: boolean, facilityState: TelemetryFacilityState): void {
    if (!this.telemetry.accumulate(dt, active, facilityState)) return;
    this.persist();
  }

  /** Lifecycle flush: keeps a backgrounded run's measured time from being lost. */
  flushRunTime(): void {
    if (!this.telemetry.hasData) return;
    this.telemetry.markFlushed();
    this.persist();
  }

  snapshot(): MissionSnapshot {
    return {
      state: this.state,
      objective: this.objectiveText(),
      intelFound: this.intel.size,
      intelTotal: this.allIntel.length,
      optionalIntelFound: this.optionalIntel.filter((id) => this.intel.has(id)).length,
      opportunitiesUsed: this.opportunities.size,
      selectedRoute: this.selectedRoute,
      operationStep: this.operationStep(),
      rank: this.state === "COMPLETE" ? this.rank() : "",
      score: this.computeScore(),
      objectivesCompleted: this.objectives.size,
      objectivesTotal: allOptionalObjectiveIds().length,
      runSeed: this.runSeed,
      spycraftFactsFound: this.spycraft.summary().facts.length,
      fieldInstinctRemaining: this.spycraft.summary().fieldInstinctRemaining,
    };
  }

  hasIntel(id: string): boolean {
    return this.isIntelId(id) && this.intel.has(id);
  }

  getRunSeed(): number {
    return this.runSeed;
  }

  // --- internals ----------------------------------------------------------

  private isIntelId(id: string): id is IntelId {
    return (this.allIntel as string[]).includes(id);
  }

  private resolvedStages(): ReadonlySet<MissionStageId> {
    return new Set(this.resolutions.keys());
  }

  private operationStep(): OperationStep {
    if (this.state === "EXTRACT" || this.state === "COMPLETE") return "DONE";
    if (this.state !== "INFILTRATE") return "";
    return stepForResolvedStages(this.resolvedStages());
  }

  private readonly onOperationAction = (event: CustomEvent<OperationAction>): void => {
    if (event.detail === "access-terminal") this.resolveStage("access_terminal");
    else if (event.detail === "manifest-terminal") this.resolveStage("manifest_records");
  };

  private rank(): MissionRank {
    return this.alerts === 0 ? "GHOST" : this.alerts <= 2 ? "SHADOW" : "OPERATIVE";
  }

  /**
   * Required completion, optional work and clean operation all contribute.
   * An alternate resolution is worth exactly what its sibling is worth — the
   * player is not paid extra for taking the scenic route.
   */
  private computeScore(): number {
    let raw = SCORE_BASE;
    for (const stage of STAGE_ORDER) {
      if (this.resolutions.has(stage)) raw += getStage(stage).score;
    }
    for (const id of this.objectives) raw += getOptionalObjective(id).score;
    for (const id of this.opportunities) raw += getOpportunity(id).score;
    raw += this.optionalIntel.filter((id) => this.intel.has(id)).length * SCORE_OPTIONAL_INTEL;
    if (this.selectedRoute) raw += SCORE_ROUTE_CHOSEN;
    raw -= this.alerts * SCORE_ALERT_PENALTY;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  private publishResult(): void {
    if (this.publishedResult) return;
    this.publishedResult = true;
    publishMissionResult(this.buildResult());
  }

  private buildResult(): MissionResult {
    const resolutions = STAGE_ORDER.flatMap((stage) => {
      const id = this.resolutions.get(stage);
      if (!id) return [];
      return [{ stage, resolution: id, label: getResolution(id).label }];
    });
    // Telemetry is spread in only when the run actually measured it, so a save
    // written before Milestone 08 produces a valid result with no durations at
    // all rather than a run that claims to have taken zero seconds.
    const measured = this.telemetry.hasData ? this.telemetry.snapshot() : null;
    return {
      ...(measured
        ? {
          operationSeconds: measured.operationSeconds,
          watchSeconds: measured.watchSeconds,
          searchSeconds: measured.searchSeconds,
          highAlertSeconds: measured.highAlertSeconds,
          maxFacilityState: measured.maxFacilityState,
        }
        : {}),
      rank: this.rank(),
      score: this.computeScore(),
      route: this.selectedRoute,
      intelFound: this.intel.size,
      intelTotal: this.allIntel.length,
      optionalIntel: this.optionalIntel.filter((id) => this.intel.has(id)),
      intelDiscovered: [...this.intel],
      resolutions,
      objectivesCompleted: [...this.objectives],
      objectivesTotal: allOptionalObjectiveIds().length,
      opportunitiesUsed: [...this.opportunities],
      alerts: this.alerts,
      runSeed: this.runSeed,
      replayHint: this.replayHint(),
      spycraftFacts: this.spycraft.summary().facts,
      fieldInstinctRemaining: this.spycraft.summary().fieldInstinctRemaining,
    };
  }

  /** Points at one meaningful thing this run did not do, for replay value. */
  private replayHint(): string {
    for (const stage of STAGE_ORDER) {
      const used = this.resolutions.get(stage);
      const alternate = resolutionsForStage(stage).find((candidate) => candidate.id !== used);
      if (used && alternate) return `Alternatif çözüm: ${alternate.label}`;
    }
    const missingObjective = allOptionalObjectiveIds().find((id) => !this.objectives.has(id));
    if (missingObjective) return `Kaçırılan opsiyonel hedef: ${getOptionalObjective(missingObjective).label}`;
    const missingIntel = this.optionalIntel.find((id) => !this.intel.has(id));
    if (missingIntel) return "Kaçırılan opsiyonel intel bir sonraki denemede yeni çözüm açar.";
    const missingSpycraft = allSpycraftFactIds().find((id) => !this.spycraft.hasFact(id));
    if (missingSpycraft) return `Kaçırılan saha gözlemi: ${missingSpycraft}`;
    return "Farklı rota ve fırsat kombinasyonlarını dene.";
  }

  private objectiveText(): string {
    switch (this.state) {
      case "BRIEFING": return "Görev dosyasını aç ve Fresh Market bölgesini incele.";
      case "RECON": return "Recon Lens ile iki erişim noktasını analiz et. Ek intel daha yüksek görev skoru sağlar.";
      case "PLANNING": return "Keşfettiğin ANA veya YAN yaklaşımı seç. ANA rota CCTV'ye, YAN rota arka devriyeye daha açık.";
      case "INFILTRATE": {
        const route = this.selectedRoute === "side" ? "YAN ROTA" : "ANA ROTA";
        const step = this.operationStep();
        if (step === "ACCESS") return `${route} · Personel erişim terminalini bul ve tek kullanımlık operasyon kodunu al.`;
        if (step === "MANIFEST") {
          return this.intel.has("market_worker_route")
            ? `${route} · Manifesti arka ofis terminalinden veya yükleme stok defterinden eşleştir.`
            : `${route} · Erişim kodu alındı. Arka ofis manifest terminalindeki teslimat kaydını eşleştir.`;
        }
        if (step === "VERIFY") {
          return this.intel.has("market_camera")
            ? `${route} · Kaydı teslimat bankosunda veya güvenlik odası çapraz kontrolünde doğrula.`
            : `${route} · Manifest eşleşti. Teslimat masasındaki fiziksel kaydı doğrula.`;
        }
        return `${route} · İç bölgede ilerle ve operasyon hedefini tamamla.`;
      }
      case "EXTRACT": return "Doğrulama tamamlandı. Görev alanından fark edilmeden ayrıl.";
      case "COMPLETE": return `Görev tamamlandı · ${this.rank()} · SKOR ${this.computeScore()}`;
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
    const step = this.operationStep();
    document.body.dataset.operationStep = step ? step.toLowerCase() : "none";
  }

  /** Publishes discovered intel so world affordances (doors) can react to it. */
  private syncIntelSignal(): void {
    document.body.dataset.intel = [...this.intel].join(",");
  }

  private syncSpycraftSignal(): void {
    document.body.dataset.spycraft = this.spycraft.summary().facts.join(",");
  }

  /**
   * Reconciles a restored save. Old saves carry only `operationStep`, so the
   * stages that step implies are backfilled with their original resolutions and
   * the run stays completable from wherever it left off.
   */
  private normalizeProgress(): void {
    if (!isValidRunSeed(this.runSeed)) this.runSeed = createRunSeed();

    if (this.state === "INFILTRATE" && this.resolutions.size === 0) {
      // Nothing to backfill for a fresh infiltration; ACCESS is simply next.
    }
    if (this.state === "EXTRACT" || this.state === "COMPLETE") {
      for (const stage of STAGE_ORDER) {
        if (!this.resolutions.has(stage)) this.resolutions.set(stage, legacyResolutionFor(stage));
      }
    }
    if (this.state !== "INFILTRATE" && this.state !== "EXTRACT" && this.state !== "COMPLETE") {
      this.resolutions.clear();
      this.objectives.clear();
    }
    if (this.state === "INFILTRATE" && !this.selectedRoute) this.selectedRoute = "main";
    if (this.state === "INFILTRATE" && !firstBlockingStage(this.resolvedStages())) this.state = "EXTRACT";
  }

  private persist(): void {
    const resolutions: Partial<Record<string, MissionResolutionId>> = {};
    for (const [stage, id] of this.resolutions) resolutions[stage] = id;
    const payload: StoredMission = {
      state: this.state,
      intel: [...this.intel],
      selectedRoute: this.selectedRoute,
      alerts: this.alerts,
      opportunities: [...this.opportunities],
      operationStep: this.operationStep(),
      runSeed: this.runSeed,
      resolutions,
      objectives: [...this.objectives],
      telemetry: this.telemetry.toStored(),
      spycraft: this.spycraft.serialize(),
    };
    writeStoredMission(payload);
  }

  private restore(): void {
    const data = readStoredMission();
    if (!data) return;
    try {
      const validStates: MissionState[] = ["BRIEFING", "RECON", "PLANNING", "INFILTRATE", "EXTRACT", "COMPLETE"];
      if (data.state && validStates.includes(data.state)) this.state = data.state;
      if (Array.isArray(data.intel)) {
        for (const id of data.intel) if (this.isIntelId(id)) this.intel.add(id);
      }
      if (Array.isArray(data.opportunities)) {
        for (const id of data.opportunities) if (isOpportunityId(id)) this.opportunities.add(id);
      }
      if (Array.isArray(data.objectives)) {
        for (const id of data.objectives) if (isOptionalObjectiveId(id)) this.objectives.add(id);
      }
      if (data.selectedRoute === "main" || data.selectedRoute === "side" || data.selectedRoute === "") {
        this.selectedRoute = data.selectedRoute;
      }
      if (isValidRunSeed(data.runSeed)) this.runSeed = data.runSeed;
      this.telemetry.restore(data.telemetry);
      this.spycraft.restore(data.spycraft);
      this.restoreResolutions(data.resolutions, data.operationStep);
      if (typeof data.alerts === "number" && Number.isFinite(data.alerts)) {
        this.alerts = Math.max(0, Math.min(999, Math.trunc(data.alerts)));
      }
    } catch {
      this.state = "BRIEFING";
      this.intel.clear();
      this.opportunities.clear();
      this.objectives.clear();
      this.resolutions.clear();
      this.selectedRoute = "";
      this.alerts = 0;
      this.runSeed = 0;
      this.spycraft.reset();
    }
  }

  /**
   * Prefers explicit resolution ids and falls back to the stages an old save's
   * `operationStep` implies, so pre-Milestone-05 progress is never lost.
   */
  private restoreResolutions(
    stored: Partial<Record<string, MissionResolutionId>> | undefined,
    step: OperationStep | undefined,
  ): void {
    if (stored && typeof stored === "object") {
      for (const [stage, id] of Object.entries(stored)) {
        if (!isStageId(stage) || typeof id !== "string" || !isResolutionId(id)) continue;
        if (getResolution(id).stage !== stage) continue;
        this.resolutions.set(stage, id);
      }
    }
    if (this.resolutions.size > 0 || !step) return;
    for (const stage of stagesImpliedByStep(step)) {
      this.resolutions.set(stage, legacyResolutionFor(stage));
    }
  }
}
