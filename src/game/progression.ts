import {
  type IntelId,
  type MissionResolutionId,
  type OptionalObjectiveId,
  type OpportunityId,
  allIntelIds,
  allOpportunityIds,
  allOptionalObjectiveIds,
  getOpportunity,
  getOptionalObjective,
  getResolution,
  isIntelId,
  isOpportunityId,
  isOptionalObjectiveId,
  isResolutionId,
  resolutionsForStage,
} from "./mission-graph";
import type { MissionRank, MissionResult } from "./mission-result";

/**
 * The operation record: what the player has accomplished across completed runs.
 *
 * This is deliberately NOT the mission save. `mission-save.ts` owns one active
 * run under `cuma_world_android_save_v100` and stays the only thing replay
 * clears; this module owns a separate, versioned career profile that replay
 * must preserve. Neither can corrupt the other — they are different keys, read
 * and written independently, and each falls back to its own safe default.
 *
 * Everything here is informational. Records are replay goals: no stealth buff,
 * no AI nerf, no gadget upgrade, no XP, no level, no unlockable power, and
 * nothing that leaves the device.
 *
 * The module is dependency-free apart from the typed mission tables, so it can
 * be read by the debrief without dragging the world graph into the boot chunk.
 */

export const PROGRESSION_KEY = "cuma_world_progression_v1";
export const PROGRESSION_VERSION = 1;

/** Only compact summaries are kept, and only this many of them. */
export const RECENT_RUN_CAP = 12;
/**
 * Completed-run ids remembered for dedupe. Only the *current* mission save can
 * ever be restored and re-published, so a handful is already generous.
 */
export const PROCESSED_RUN_CAP = 24;

const MAX_SCORE = 100;
const MAX_ALERTS = 999;
const MAX_COMPLETED_RUNS = 1_000_000;
const MAX_OPERATION_SECONDS = 12 * 60 * 60;

export type CompletedRoute = "main" | "side";
const COMPLETED_ROUTES: readonly CompletedRoute[] = ["main", "side"];

export type MasteryRecordId =
  | "clean_run"
  | "full_intel"
  | "full_optional"
  | "route_mastery"
  | "manifest_mastery"
  | "verify_mastery"
  | "opportunity_mastery"
  | "ghost_record";

export interface MasteryRecord {
  readonly id: MasteryRecordId;
  readonly label: string;
  readonly detail: string;
}

/**
 * Eight records, in a fixed display order. Four are single-run facts and four
 * accumulate across runs; both kinds are decided only by what a completed run
 * actually contained.
 */
const MASTERY_RECORDS: Record<MasteryRecordId, MasteryRecord> = {
  clean_run: {
    id: "clean_run",
    label: "TEMİZ OPERASYON",
    detail: "Tek alarm çıkarmadan tamamla.",
  },
  full_intel: {
    id: "full_intel",
    label: "TAM KEŞİF",
    detail: "Tek operasyonda tüm intel'i topla.",
  },
  full_optional: {
    id: "full_optional",
    label: "TAM DOSYA",
    detail: "Tek operasyonda iki opsiyonel hedefi de tamamla.",
  },
  route_mastery: {
    id: "route_mastery",
    label: "ROTA HAKİMİYETİ",
    detail: "Hem ANA hem YAN rotayı tamamla.",
  },
  manifest_mastery: {
    id: "manifest_mastery",
    label: "MANİFEST HAKİMİYETİ",
    detail: "İki manifest çözümünü de kullan.",
  },
  verify_mastery: {
    id: "verify_mastery",
    label: "DOĞRULAMA HAKİMİYETİ",
    detail: "İki doğrulama çözümünü de kullan.",
  },
  opportunity_mastery: {
    id: "opportunity_mastery",
    label: "FIRSAT HAKİMİYETİ",
    detail: "Üç çevresel fırsatı da kullan.",
  },
  ghost_record: {
    id: "ghost_record",
    label: "GHOST KAYDI",
    detail: "En az bir kez GHOST derecesine ulaş.",
  },
};

const MASTERY_ORDER: readonly MasteryRecordId[] = [
  "clean_run",
  "full_intel",
  "full_optional",
  "route_mastery",
  "manifest_mastery",
  "verify_mastery",
  "opportunity_mastery",
  "ghost_record",
];

export function allMasteryRecordIds(): readonly MasteryRecordId[] {
  return MASTERY_ORDER;
}

export function getMasteryRecord(id: MasteryRecordId): MasteryRecord {
  return MASTERY_RECORDS[id];
}

export function isMasteryRecordId(value: string): value is MasteryRecordId {
  return Object.prototype.hasOwnProperty.call(MASTERY_RECORDS, value);
}

/** One compact line per completed run. Never a world or NPC snapshot. */
export interface ProgressionRunSummary {
  readonly runId: string;
  readonly score: number;
  readonly rank: MissionRank;
  readonly route: CompletedRoute | "";
  readonly manifest: MissionResolutionId | null;
  readonly verify: MissionResolutionId | null;
  readonly optionalCount: number;
  readonly opportunityCount: number;
  readonly alerts: number;
  /** Null when the run predates telemetry — never a fabricated zero. */
  readonly operationSeconds: number | null;
}

export interface ProgressionProfile {
  readonly version: number;
  readonly completedRuns: number;
  readonly bestScore: number;
  readonly bestRank: MissionRank | null;
  readonly bestAlerts: number | null;
  readonly bestOperationSeconds: number | null;
  readonly routesCompleted: readonly CompletedRoute[];
  readonly manifestSolutions: readonly MissionResolutionId[];
  readonly verifySolutions: readonly MissionResolutionId[];
  readonly objectivesCompletedEver: readonly OptionalObjectiveId[];
  readonly opportunitiesUsedEver: readonly OpportunityId[];
  readonly intelDiscoveredEver: readonly IntelId[];
  readonly masteryRecords: readonly MasteryRecordId[];
  readonly processedRuns: readonly string[];
  readonly recentRuns: readonly ProgressionRunSummary[];
  /**
   * Set when the stored profile came from a newer schema than this build
   * understands. A sealed profile is never written back, so an older build can
   * read a newer save without destroying it.
   */
  readonly sealed: boolean;
}

export interface ProgressionUpdate {
  readonly profile: ProgressionProfile;
  /** False when this exact completed run was already recorded. */
  readonly isNewRun: boolean;
  readonly newBestScore: boolean;
  readonly newBestRank: boolean;
  readonly newBestAlerts: boolean;
  readonly newBestTime: boolean;
  readonly newlyUnlockedRecords: readonly MasteryRecordId[];
}

export function defaultProgression(): ProgressionProfile {
  return {
    version: PROGRESSION_VERSION,
    completedRuns: 0,
    bestScore: 0,
    bestRank: null,
    bestAlerts: null,
    bestOperationSeconds: null,
    routesCompleted: [],
    manifestSolutions: [],
    verifySolutions: [],
    objectivesCompletedEver: [],
    opportunitiesUsedEver: [],
    intelDiscoveredEver: [],
    masteryRecords: [],
    processedRuns: [],
    recentRuns: [],
    sealed: false,
  };
}

/**
 * GHOST beats SHADOW beats OPERATIVE. Explicit rather than alphabetical, so
 * "best rank" can never silently depend on string order.
 */
export function rankOrder(rank: MissionRank): number {
  if (rank === "GHOST") return 3;
  if (rank === "SHADOW") return 2;
  return 1;
}

function isRank(value: unknown): value is MissionRank {
  return value === "GHOST" || value === "SHADOW" || value === "OPERATIVE";
}

/**
 * The identity of a completed run.
 *
 * Derived from the persisted `runSeed`, which is immutable for the life of a
 * run — never from a random value and never from the clock. Restoring the same
 * COMPLETE save therefore produces the same id and is recognised as already
 * recorded, while a replay generates a fresh seed and counts as a new run.
 */
export function completedRunId(runSeed: number): string {
  if (!Number.isFinite(runSeed)) return "run:0";
  return `run:${Math.trunc(runSeed) >>> 0}`;
}

// --- storage ---------------------------------------------------------------

/**
 * Reads the profile. Any failure — missing, corrupt, unparsable, wrong shape —
 * yields a clean default. It never touches the mission save, so a broken
 * profile can never cost the player their active run.
 */
export function readProgression(): ProgressionProfile {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PROGRESSION_KEY);
  } catch {
    return defaultProgression();
  }
  if (!raw) return defaultProgression();
  try {
    return validateProgression(JSON.parse(raw) as unknown);
  } catch {
    return defaultProgression();
  }
}

/**
 * Writes the profile, dropping the runtime-only `sealed` flag and refusing to
 * overwrite a profile written by a newer build.
 */
export function writeProgression(profile: ProgressionProfile): void {
  if (profile.sealed) return;
  try {
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify({
      version: PROGRESSION_VERSION,
      completedRuns: profile.completedRuns,
      bestScore: profile.bestScore,
      bestRank: profile.bestRank,
      bestAlerts: profile.bestAlerts,
      bestOperationSeconds: profile.bestOperationSeconds,
      routesCompleted: profile.routesCompleted,
      manifestSolutions: profile.manifestSolutions,
      verifySolutions: profile.verifySolutions,
      objectivesCompletedEver: profile.objectivesCompletedEver,
      opportunitiesUsedEver: profile.opportunitiesUsedEver,
      intelDiscoveredEver: profile.intelDiscoveredEver,
      masteryRecords: profile.masteryRecords,
      processedRuns: profile.processedRuns,
      recentRuns: profile.recentRuns,
    }));
  } catch {
    // Storage failure must never stop gameplay. The run still finishes; only
    // the career record is lost.
  }
}

/**
 * Turns unknown parsed JSON into a profile that is safe to use.
 *
 * A newer schema version is sealed rather than reinterpreted: the fields are
 * not trusted, and the profile is never written back over the newer one.
 */
export function validateProgression(raw: unknown): ProgressionProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultProgression();
  const source = raw as Record<string, unknown>;

  const version = typeof source.version === "number" && Number.isFinite(source.version)
    ? Math.trunc(source.version)
    : 0;
  if (version > PROGRESSION_VERSION) return { ...defaultProgression(), sealed: true };

  const routesCompleted = filterIds(source.routesCompleted, isCompletedRoute, COMPLETED_ROUTES.length);
  const manifestSolutions = filterIds(source.manifestSolutions, isManifestResolution, stageResolutionCount("MANIFEST"));
  const verifySolutions = filterIds(source.verifySolutions, isVerifyResolution, stageResolutionCount("VERIFY"));

  return {
    version: PROGRESSION_VERSION,
    completedRuns: clampInteger(source.completedRuns, 0, MAX_COMPLETED_RUNS, 0),
    bestScore: clampInteger(source.bestScore, 0, MAX_SCORE, 0),
    bestRank: isRank(source.bestRank) ? source.bestRank : null,
    bestAlerts: optionalInteger(source.bestAlerts, 0, MAX_ALERTS),
    bestOperationSeconds: optionalSeconds(source.bestOperationSeconds),
    routesCompleted,
    manifestSolutions,
    verifySolutions,
    objectivesCompletedEver: filterIds(
      source.objectivesCompletedEver,
      isOptionalObjectiveId,
      allOptionalObjectiveIds().length,
    ),
    opportunitiesUsedEver: filterIds(source.opportunitiesUsedEver, isOpportunityId, allOpportunityIds().length),
    intelDiscoveredEver: filterIds(source.intelDiscoveredEver, isIntelId, allIntelIds().length),
    masteryRecords: filterIds(source.masteryRecords, isMasteryRecordId, MASTERY_ORDER.length),
    processedRuns: filterRunIds(source.processedRuns),
    recentRuns: filterRunSummaries(source.recentRuns),
    sealed: false,
  };
}

// --- recording -------------------------------------------------------------

/**
 * Records a finished run and persists the result.
 *
 * Safe to call more than once with the same result: `applyCompletedRun` is
 * idempotent on the run id, which is what stops a restored COMPLETE save from
 * counting twice.
 */
export function recordCompletedRun(result: MissionResult): ProgressionUpdate {
  const update = applyCompletedRun(readProgression(), result);
  if (update.isNewRun) writeProgression(update.profile);
  return update;
}

/**
 * The pure half: profile in, profile out. Nothing is mutated, so a caller can
 * compare before and after, and the whole thing is directly testable.
 */
export function applyCompletedRun(profile: ProgressionProfile, result: MissionResult): ProgressionUpdate {
  const runId = completedRunId(result.runSeed);
  if (profile.processedRuns.includes(runId)) {
    return {
      profile,
      isNewRun: false,
      newBestScore: false,
      newBestRank: false,
      newBestAlerts: false,
      newBestTime: false,
      newlyUnlockedRecords: [],
    };
  }

  const score = clampInteger(result.score, 0, MAX_SCORE, 0);
  const alerts = clampInteger(result.alerts, 0, MAX_ALERTS, 0);
  const rank: MissionRank = isRank(result.rank) ? result.rank : "OPERATIVE";
  const operationSeconds = optionalSeconds(result.operationSeconds);

  const newBestScore = score > profile.bestScore;
  const newBestRank = profile.bestRank === null || rankOrder(rank) > rankOrder(profile.bestRank);
  const newBestAlerts = profile.bestAlerts === null || alerts < profile.bestAlerts;
  const newBestTime = operationSeconds !== null
    && (profile.bestOperationSeconds === null || operationSeconds < profile.bestOperationSeconds);

  const manifest = resolutionOf(result, "MANIFEST");
  const verify = resolutionOf(result, "VERIFY");
  const route = isCompletedRoute(result.route) ? result.route : "";

  const routesCompleted = route === "" ? profile.routesCompleted : addId(profile.routesCompleted, route);
  const manifestSolutions = manifest === null
    ? profile.manifestSolutions
    : addId(profile.manifestSolutions, manifest);
  const verifySolutions = verify === null ? profile.verifySolutions : addId(profile.verifySolutions, verify);
  const objectivesCompletedEver = mergeIds(
    profile.objectivesCompletedEver,
    result.objectivesCompleted,
    isOptionalObjectiveId,
  );
  const opportunitiesUsedEver = mergeIds(profile.opportunitiesUsedEver, result.opportunitiesUsed, isOpportunityId);
  const intelDiscoveredEver = mergeIds(profile.intelDiscoveredEver, result.intelDiscovered ?? [], isIntelId);

  const summary: ProgressionRunSummary = {
    runId,
    score,
    rank,
    route,
    manifest,
    verify,
    optionalCount: countValid(result.objectivesCompleted, isOptionalObjectiveId),
    opportunityCount: countValid(result.opportunitiesUsed, isOpportunityId),
    alerts,
    operationSeconds,
  };

  const grown: ProgressionProfile = {
    ...profile,
    version: PROGRESSION_VERSION,
    completedRuns: Math.min(MAX_COMPLETED_RUNS, profile.completedRuns + 1),
    bestScore: newBestScore ? score : profile.bestScore,
    bestRank: newBestRank ? rank : profile.bestRank,
    bestAlerts: newBestAlerts ? alerts : profile.bestAlerts,
    bestOperationSeconds: newBestTime ? operationSeconds : profile.bestOperationSeconds,
    routesCompleted,
    manifestSolutions,
    verifySolutions,
    objectivesCompletedEver,
    opportunitiesUsedEver,
    intelDiscoveredEver,
    // Newest first, and never longer than the cap.
    recentRuns: [summary, ...profile.recentRuns].slice(0, RECENT_RUN_CAP),
    processedRuns: [...profile.processedRuns, runId].slice(-PROCESSED_RUN_CAP),
  };

  const earned = evaluateMastery(grown, result);
  const newlyUnlockedRecords = earned.filter((id) => !profile.masteryRecords.includes(id));

  return {
    profile: { ...grown, masteryRecords: earned },
    isNewRun: true,
    newBestScore,
    newBestRank,
    newBestAlerts,
    newBestTime,
    newlyUnlockedRecords,
  };
}

/**
 * Which records the profile has earned once this run is folded in.
 *
 * Cumulative records are recomputed from the profile's own sets, so they stay
 * correct however the profile was reached. Single-run records are decided by
 * the run in hand and then kept, because the run that earned them is not
 * retained in full.
 */
function evaluateMastery(profile: ProgressionProfile, result: MissionResult): MasteryRecordId[] {
  const earned = new Set<MasteryRecordId>(profile.masteryRecords);

  if (clampInteger(result.alerts, 0, MAX_ALERTS, 0) === 0) earned.add("clean_run");
  if (result.intelTotal > 0 && result.intelFound >= result.intelTotal) earned.add("full_intel");
  if (result.objectivesTotal > 0 && countValid(result.objectivesCompleted, isOptionalObjectiveId) >= result.objectivesTotal) {
    earned.add("full_optional");
  }
  if (result.rank === "GHOST") earned.add("ghost_record");

  if (COMPLETED_ROUTES.every((id) => profile.routesCompleted.includes(id))) earned.add("route_mastery");
  if (stageResolutionIds("MANIFEST").every((id) => profile.manifestSolutions.includes(id))) {
    earned.add("manifest_mastery");
  }
  if (stageResolutionIds("VERIFY").every((id) => profile.verifySolutions.includes(id))) {
    earned.add("verify_mastery");
  }
  if (allOpportunityIds().every((id) => profile.opportunitiesUsedEver.includes(id))) {
    earned.add("opportunity_mastery");
  }

  // Fixed display order rather than insertion order, so the set is deterministic.
  return MASTERY_ORDER.filter((id) => earned.has(id));
}

export function masteryProgress(profile: ProgressionProfile): { readonly earned: number; readonly total: number } {
  return { earned: profile.masteryRecords.length, total: MASTERY_ORDER.length };
}

// --- next replay target ----------------------------------------------------

export type ReplayTargetId =
  | "route"
  | "manifest"
  | "verify"
  | "objective"
  | "opportunity"
  | "intel"
  | "clean"
  | "personal-best";

export interface ReplayTarget {
  readonly id: ReplayTargetId;
  readonly label: string;
}

const ROUTE_TARGET_LABELS: Record<CompletedRoute, string> = {
  main: "ANA ROTA İLE TAMAMLA",
  side: "YAN ROTA İLE TAMAMLA",
};

/**
 * One next thing worth doing, chosen by fixed priority.
 *
 * Never random, never time-limited, and never sourced from live NPC state — it
 * reads only what the profile already records about completed runs.
 */
export function nextReplayTarget(profile: ProgressionProfile): ReplayTarget {
  const missingRoute = COMPLETED_ROUTES.find((id) => !profile.routesCompleted.includes(id));
  if (missingRoute) return { id: "route", label: ROUTE_TARGET_LABELS[missingRoute] };

  const missingManifest = stageResolutionIds("MANIFEST").find((id) => !profile.manifestSolutions.includes(id));
  if (missingManifest) return { id: "manifest", label: `${getResolution(missingManifest).label} İLE ÇÖZ` };

  const missingVerify = stageResolutionIds("VERIFY").find((id) => !profile.verifySolutions.includes(id));
  if (missingVerify) return { id: "verify", label: `${getResolution(missingVerify).label} İLE DOĞRULA` };

  const missingObjective = allOptionalObjectiveIds().find((id) => !profile.objectivesCompletedEver.includes(id));
  if (missingObjective) return { id: "objective", label: `${getOptionalObjective(missingObjective).label} KAYDINI AL` };

  const missingOpportunity = allOpportunityIds().find((id) => !profile.opportunitiesUsedEver.includes(id));
  if (missingOpportunity) return { id: "opportunity", label: `${getOpportunity(missingOpportunity).label} FIRSATINI KULLAN` };

  if (!profile.masteryRecords.includes("full_intel")) {
    return { id: "intel", label: "TEK OPERASYONDA TÜM INTEL'İ TOPLA" };
  }
  if (!profile.masteryRecords.includes("clean_run")) {
    return { id: "clean", label: "HİÇ ALARM ÇIKARMADAN TAMAMLA" };
  }
  if (!profile.masteryRecords.includes("ghost_record")) {
    return { id: "clean", label: "GHOST DERECESİNE ULAŞ" };
  }

  if (profile.bestOperationSeconds !== null) {
    return { id: "personal-best", label: `KENDİ SÜRENİ GEÇ · ${formatOperationTime(profile.bestOperationSeconds)}` };
  }
  return { id: "personal-best", label: `KENDİ SKORUNU GEÇ · ${profile.bestScore}` };
}

// --- formatting ------------------------------------------------------------

/** `—` for an unmeasured run. A missing time is never rendered as 0:00. */
export function formatOperationTime(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(Math.min(MAX_OPERATION_SECONDS, seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

// --- helpers ---------------------------------------------------------------

function isCompletedRoute(value: unknown): value is CompletedRoute {
  return value === "main" || value === "side";
}

function stageResolutionIds(stage: "MANIFEST" | "VERIFY"): readonly MissionResolutionId[] {
  return resolutionsForStage(stage).map((resolution) => resolution.id);
}

function stageResolutionCount(stage: "MANIFEST" | "VERIFY"): number {
  return resolutionsForStage(stage).length;
}

function isManifestResolution(value: string): value is MissionResolutionId {
  return isResolutionId(value) && getResolution(value).stage === "MANIFEST";
}

function isVerifyResolution(value: string): value is MissionResolutionId {
  return isResolutionId(value) && getResolution(value).stage === "VERIFY";
}

function resolutionOf(result: MissionResult, stage: "MANIFEST" | "VERIFY"): MissionResolutionId | null {
  for (const entry of result.resolutions) {
    if (entry.stage !== stage || typeof entry.resolution !== "string") continue;
    if (!isResolutionId(entry.resolution)) continue;
    if (getResolution(entry.resolution).stage !== stage) continue;
    return entry.resolution;
  }
  return null;
}

function addId<T extends string>(existing: readonly T[], id: T): readonly T[] {
  return existing.includes(id) ? existing : [...existing, id];
}

/** Union of two id lists, unknown ids dropped, order stable, no duplicates. */
function mergeIds<T extends string>(
  existing: readonly T[],
  additions: readonly string[],
  valid: (value: string) => value is T,
): readonly T[] {
  if (!Array.isArray(additions)) return existing;
  let merged = existing;
  for (const id of additions) {
    if (typeof id !== "string" || !valid(id)) continue;
    merged = addId(merged, id);
  }
  return merged;
}

function countValid<T extends string>(values: readonly string[], valid: (value: string) => value is T): number {
  if (!Array.isArray(values)) return 0;
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value === "string" && valid(value)) seen.add(value);
  }
  return seen.size;
}

/** Validated, deduplicated and length-capped id array from unknown input. */
function filterIds<T extends string>(
  value: unknown,
  valid: (candidate: string) => candidate is T,
  cap: number,
): readonly T[] {
  if (!Array.isArray(value)) return [];
  const seen: T[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !valid(entry)) continue;
    if (seen.includes(entry)) continue;
    seen.push(entry);
    if (seen.length >= cap) break;
  }
  return seen;
}

function filterRunIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !/^run:\d+$/.test(entry)) continue;
    if (ids.includes(entry)) continue;
    ids.push(entry);
  }
  return ids.slice(-PROCESSED_RUN_CAP);
}

function filterRunSummaries(value: unknown): readonly ProgressionRunSummary[] {
  if (!Array.isArray(value)) return [];
  const summaries: ProgressionRunSummary[] = [];
  for (const entry of value) {
    if (summaries.length >= RECENT_RUN_CAP) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const source = entry as Record<string, unknown>;
    if (typeof source.runId !== "string" || !/^run:\d+$/.test(source.runId)) continue;
    if (!isRank(source.rank)) continue;
    const manifest = typeof source.manifest === "string" && isManifestResolution(source.manifest)
      ? source.manifest
      : null;
    const verify = typeof source.verify === "string" && isVerifyResolution(source.verify) ? source.verify : null;
    summaries.push({
      runId: source.runId,
      score: clampInteger(source.score, 0, MAX_SCORE, 0),
      rank: source.rank,
      route: isCompletedRoute(source.route) ? source.route : "",
      manifest,
      verify,
      optionalCount: clampInteger(source.optionalCount, 0, allOptionalObjectiveIds().length, 0),
      opportunityCount: clampInteger(source.opportunityCount, 0, allOpportunityIds().length, 0),
      alerts: clampInteger(source.alerts, 0, MAX_ALERTS, 0),
      operationSeconds: optionalSeconds(source.operationSeconds),
    });
  }
  return summaries;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function optionalInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

/** A duration is kept only when it is a real positive measurement. */
function optionalSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(MAX_OPERATION_SECONDS, value);
}
