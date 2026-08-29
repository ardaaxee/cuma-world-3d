/**
 * The Fresh Market operation, as data.
 *
 * This replaces the hard-coded ACCESS -> MANIFEST -> VERIFY transitions with a
 * small typed graph. It is deliberately game-specific rather than a generic
 * workflow engine: three required stages, a handful of resolutions, two
 * optional objectives and three opportunities.
 *
 * The module is dependency-free on purpose. `MissionDirector` owns the live
 * state; debrief and FIELD FOCUS read the same tables without pulling the world
 * graph into the boot chunk.
 */

export type MissionStageId = "ACCESS" | "MANIFEST" | "VERIFY";

/** Kept as-is so `document.body.dataset.operationStep` stays compatible. */
export type OperationStep = "" | "ACCESS" | "MANIFEST" | "VERIFY" | "DONE";

export type IntelId = "market_front_access" | "market_side_access" | "market_worker_route" | "market_camera";

export type MissionResolutionId =
  | "access_terminal"
  | "manifest_records"
  | "manifest_ledger"
  | "verify_counter"
  | "verify_monitoring";

export type OptionalObjectiveId = "secondary_records" | "shift_pattern";

export type OpportunityId = "camera_bypass" | "staff_routine_window" | "delivery_cart";

export interface MissionResolution {
  readonly id: MissionResolutionId;
  readonly stage: MissionStageId;
  /** Shown in the debrief so the player can see how they solved the stage. */
  readonly label: string;
  /** Earned intel that makes this resolution valid at all. */
  readonly requiresIntel?: IntelId;
}

export interface MissionStage {
  readonly id: MissionStageId;
  /** Every stage in this operation is required; optional work lives below. */
  readonly required: boolean;
  readonly prerequisite: MissionStageId | null;
  /** Extraction stays locked while an unresolved blocking stage remains. */
  readonly blocksExtraction: boolean;
  readonly score: number;
  /** The operation step the run moves to once this stage resolves. */
  readonly nextStep: OperationStep;
}

export interface OptionalObjective {
  readonly id: OptionalObjectiveId;
  readonly label: string;
  readonly score: number;
  /** Completing the objective makes this opportunity available. */
  readonly unlocks?: OpportunityId;
}

export interface Opportunity {
  readonly id: OpportunityId;
  readonly label: string;
  readonly score: number;
  readonly requiresIntel?: IntelId;
  readonly requiresObjective?: OptionalObjectiveId;
  /** False for repeatable opportunities; all three are currently one-shot. */
  readonly oncePerRun: boolean;
}

export const STAGE_ORDER: readonly MissionStageId[] = ["ACCESS", "MANIFEST", "VERIFY"];

const STAGES: Record<MissionStageId, MissionStage> = {
  ACCESS: {
    id: "ACCESS",
    required: true,
    prerequisite: null,
    blocksExtraction: true,
    score: 4,
    nextStep: "MANIFEST",
  },
  MANIFEST: {
    id: "MANIFEST",
    required: true,
    prerequisite: "ACCESS",
    blocksExtraction: true,
    score: 4,
    nextStep: "VERIFY",
  },
  VERIFY: {
    id: "VERIFY",
    required: true,
    prerequisite: "MANIFEST",
    blocksExtraction: true,
    score: 4,
    nextStep: "DONE",
  },
};

/**
 * Every way a stage can be solved. ACCESS keeps its single credential
 * resolution; MANIFEST and VERIFY each gained an intel-gated alternative that
 * trades back-office time for service-route or monitoring-room exposure.
 */
const RESOLUTIONS: Record<MissionResolutionId, MissionResolution> = {
  access_terminal: {
    id: "access_terminal",
    stage: "ACCESS",
    label: "PERSONEL ERİŞİM TERMİNALİ",
  },
  manifest_records: {
    id: "manifest_records",
    stage: "MANIFEST",
    label: "ARKA OFİS MANİFEST TERMİNALİ",
  },
  manifest_ledger: {
    id: "manifest_ledger",
    stage: "MANIFEST",
    label: "YÜKLEME STOK DEFTERİ",
    requiresIntel: "market_worker_route",
  },
  verify_counter: {
    id: "verify_counter",
    stage: "VERIFY",
    label: "TESLİMAT BANKOSU FİZİKSEL KAYIT",
  },
  verify_monitoring: {
    id: "verify_monitoring",
    stage: "VERIFY",
    label: "GÜVENLİK ODASI ÇAPRAZ KONTROL",
    requiresIntel: "market_camera",
  },
};

const OPTIONAL_OBJECTIVES: Record<OptionalObjectiveId, OptionalObjective> = {
  secondary_records: {
    id: "secondary_records",
    label: "İKİNCİL SEVKİYAT ARŞİVİ",
    score: 7,
  },
  shift_pattern: {
    id: "shift_pattern",
    label: "VARDİYA ÇİZELGESİ",
    score: 7,
    unlocks: "staff_routine_window",
  },
};

const OPPORTUNITIES: Record<OpportunityId, Opportunity> = {
  camera_bypass: {
    id: "camera_bypass",
    label: "CCTV BESLEMESİ DEVRE DIŞI",
    score: 6,
    requiresIntel: "market_camera",
    oncePerRun: true,
  },
  staff_routine_window: {
    id: "staff_routine_window",
    label: "PERSONEL RUTİN ARALIĞI",
    score: 6,
    requiresObjective: "shift_pattern",
    oncePerRun: true,
  },
  delivery_cart: {
    id: "delivery_cart",
    label: "SEVKİYAT ARABASI SİPERİ",
    score: 6,
    requiresIntel: "market_worker_route",
    oncePerRun: true,
  },
};

export function getStage(id: MissionStageId): MissionStage {
  return STAGES[id];
}

export function getResolution(id: MissionResolutionId): MissionResolution {
  return RESOLUTIONS[id];
}

export function getOptionalObjective(id: OptionalObjectiveId): OptionalObjective {
  return OPTIONAL_OBJECTIVES[id];
}

export function getOpportunity(id: OpportunityId): Opportunity {
  return OPPORTUNITIES[id];
}

export function allOptionalObjectiveIds(): readonly OptionalObjectiveId[] {
  return Object.keys(OPTIONAL_OBJECTIVES) as OptionalObjectiveId[];
}

export function allOpportunityIds(): readonly OpportunityId[] {
  return Object.keys(OPPORTUNITIES) as OpportunityId[];
}

export function resolutionsForStage(stage: MissionStageId): readonly MissionResolution[] {
  return Object.values(RESOLUTIONS).filter((resolution) => resolution.stage === stage);
}

export function isResolutionId(value: string): value is MissionResolutionId {
  return Object.prototype.hasOwnProperty.call(RESOLUTIONS, value);
}

export function isOptionalObjectiveId(value: string): value is OptionalObjectiveId {
  return Object.prototype.hasOwnProperty.call(OPTIONAL_OBJECTIVES, value);
}

export function isOpportunityId(value: string): value is OpportunityId {
  return Object.prototype.hasOwnProperty.call(OPPORTUNITIES, value);
}

export function isStageId(value: string): value is MissionStageId {
  return Object.prototype.hasOwnProperty.call(STAGES, value);
}

/**
 * The operation step implied by a set of resolved stages. This is what keeps
 * the credential and door systems working off `dataset.operationStep` without
 * knowing anything about resolutions.
 */
export function stepForResolvedStages(resolved: ReadonlySet<MissionStageId>): OperationStep {
  let step: OperationStep = "ACCESS";
  for (const id of STAGE_ORDER) {
    if (!resolved.has(id)) return step;
    step = STAGES[id].nextStep;
  }
  return step;
}

/** The first blocking stage still unresolved, or null when extraction is open. */
export function firstBlockingStage(resolved: ReadonlySet<MissionStageId>): MissionStageId | null {
  for (const id of STAGE_ORDER) {
    if (STAGES[id].blocksExtraction && !resolved.has(id)) return id;
  }
  return null;
}

/**
 * Old saves carry only `operationStep`. This reconstructs which stages that
 * step implies were finished, so pre-Milestone-05 progress stays completable.
 */
export function stagesImpliedByStep(step: OperationStep): readonly MissionStageId[] {
  if (step === "MANIFEST") return ["ACCESS"];
  if (step === "VERIFY") return ["ACCESS", "MANIFEST"];
  if (step === "DONE") return ["ACCESS", "MANIFEST", "VERIFY"];
  return [];
}

/** The resolution an old save is assumed to have used for a migrated stage. */
export function legacyResolutionFor(stage: MissionStageId): MissionResolutionId {
  if (stage === "ACCESS") return "access_terminal";
  if (stage === "MANIFEST") return "manifest_records";
  return "verify_counter";
}
