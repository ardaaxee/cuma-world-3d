import { getOptionalObjective, getOpportunity } from "./mission-graph";
import { resetMissionProgress } from "./mission-save";
import { type MissionResult, onMissionResult } from "./mission-result";
import {
  type ProgressionUpdate,
  formatOperationTime,
  getMasteryRecord,
  masteryProgress,
  nextReplayTarget,
  recordCompletedRun,
} from "./progression";

/**
 * The mission debrief.
 *
 * This used to watch the HUD objective line with a MutationObserver and recover
 * the result with regexes over Turkish prose. It now consumes the typed
 * `MissionResult` the director publishes, so the panel can report how the run
 * was actually solved and nothing breaks when HUD wording changes.
 *
 * It deliberately imports only the dependency-free save/graph/progression
 * modules — pulling `mission.ts` in here would drag
 * `operation-depth -> world-expansion -> doors` into the boot chunk.
 *
 * Milestone 08 adds the career sections. Recording is idempotent on the run id,
 * so the republished result of a restored COMPLETE save opens the same debrief
 * without counting a second completion.
 */

export class MissionDebrief {
  private shownForResult = "";

  constructor(
    private readonly overlay: HTMLElement,
    private readonly rankElement: HTMLElement,
    private readonly scoreElement: HTMLElement,
    private readonly intelResultElement: HTMLElement,
    closeButton: HTMLButtonElement,
    private readonly onOpen: () => void = () => undefined,
    private readonly onClose: () => void = () => undefined,
    private readonly noteElement: HTMLElement | null = null,
    private readonly recordElement: HTMLElement | null = null,
    private readonly masteryElement: HTMLElement | null = null,
    private readonly targetElement: HTMLElement | null = null,
  ) {
    closeButton.addEventListener("click", () => {
      this.overlay.classList.add("hidden");
      this.onClose();
    });

    const replayButton = document.querySelector<HTMLButtonElement>("#debrief-replay");
    if (!replayButton) throw new Error("CUMA WORLD missing mission replay button");
    replayButton.addEventListener("click", () => {
      replayButton.disabled = true;
      replayButton.textContent = "YENİDEN BAŞLATILIYOR…";
      // Clearing the save is what makes the next run pick a fresh runSeed. It
      // touches only the active mission key: the progression profile and every
      // stored preference survive a replay untouched.
      resetMissionProgress();
      window.location.reload();
    });

    onMissionResult((result) => this.present(result));
  }

  private present(result: MissionResult): void {
    const signature = `${result.rank}:${result.score}:${result.runSeed}:${result.objectivesCompleted.length}`;
    if (this.shownForResult === signature) return;
    this.shownForResult = signature;

    // Recording happens before rendering so the panel shows the profile that
    // includes this run. A restored COMPLETE save returns isNewRun false here
    // and changes nothing.
    const progression = recordCompletedRun(result);

    this.rankElement.textContent = result.rank;
    this.scoreElement.textContent = String(result.score).padStart(2, "0");
    this.intelResultElement.textContent = `${result.intelFound}/${result.intelTotal} INTEL`;
    if (this.noteElement) this.noteElement.textContent = this.summarize(result);
    if (this.recordElement) this.recordElement.textContent = this.personalRecord(progression);
    if (this.masteryElement) this.masteryElement.textContent = this.fieldMastery(progression);
    if (this.targetElement) {
      this.targetElement.textContent = `SONRAKİ KAYIT · ${nextReplayTarget(progression.profile).label}`;
    }
    this.overlay.dataset.rank = result.rank;
    this.overlay.classList.remove("hidden");
    this.onOpen();
  }

  /** CURRENT RUN: how this run was solved, and what it cost. */
  private summarize(result: MissionResult): string {
    const lines: string[] = [];
    const route = result.route === "side" ? "YAN ROTA" : "ANA ROTA";
    lines.push(
      `${route} · OPSİYONEL ${result.objectivesCompleted.length}/${result.objectivesTotal}`
      + ` · INTEL ${result.intelFound}/${result.intelTotal}`,
    );

    for (const entry of result.resolutions) {
      if (entry.stage === "MANIFEST") lines.push(`MANİFEST · ${entry.label}`);
      if (entry.stage === "VERIFY") lines.push(`DOĞRULAMA · ${entry.label}`);
    }

    if (result.objectivesCompleted.length > 0) {
      lines.push(`HEDEF · ${result.objectivesCompleted.map((id) => getOptionalObjective(id).label).join(" · ")}`);
    }
    lines.push(
      result.opportunitiesUsed.length > 0
        ? `FIRSAT · ${result.opportunitiesUsed.map((id) => getOpportunity(id).label).join(" · ")}`
        : "FIRSAT KULLANILMADI",
    );

    const alerts = result.alerts === 0 ? "HİÇ ALARM YOK" : `${result.alerts} ALARM`;
    lines.push(`GÜVENLİK · ${alerts} · SÜRE ${formatOperationTime(result.operationSeconds ?? null)}`);
    lines.push(this.securityPressure(result));
    return lines.join("\n");
  }

  /**
   * How hard the facility pushed back. An old save carries no telemetry at all,
   * so it says so rather than claiming the facility stayed calm.
   */
  private securityPressure(result: MissionResult): string {
    if (result.maxFacilityState === undefined) return "BASKI · KAYIT YOK";
    const parts: string[] = [];
    if ((result.watchSeconds ?? 0) > 0) parts.push(`İZLEME ${formatOperationTime(result.watchSeconds ?? 0)}`);
    if ((result.searchSeconds ?? 0) > 0) parts.push(`ARAMA ${formatOperationTime(result.searchSeconds ?? 0)}`);
    if ((result.highAlertSeconds ?? 0) > 0) {
      parts.push(`YÜKSEK ALARM ${formatOperationTime(result.highAlertSeconds ?? 0)}`);
    }
    if (parts.length === 0) return "BASKI · TESİS SAKİN KALDI";
    return `BASKI · ${parts.join(" · ")}`;
  }

  /** PERSONAL RECORD: the player's own bests, with this run's new ones marked. */
  private personalRecord(update: ProgressionUpdate): string {
    const profile = update.profile;
    const mark = (isNew: boolean): string => (isNew && update.isNewRun ? " · YENİ" : "");
    return [
      `SKOR ${profile.bestScore}${mark(update.newBestScore)}`,
      `DERECE ${profile.bestRank ?? "—"}${mark(update.newBestRank)}`,
      `EN AZ ALARM ${profile.bestAlerts ?? "—"}${mark(update.newBestAlerts)}`,
      `EN İYİ SÜRE ${formatOperationTime(profile.bestOperationSeconds)}${mark(update.newBestTime)}`,
    ].join("\n");
  }

  /** FIELD MASTERY: the count, plus anything this run just earned. */
  private fieldMastery(update: ProgressionUpdate): string {
    const { earned, total } = masteryProgress(update.profile);
    const lines = [
      `KAYIT ${earned}/${total}`,
      `TAMAMLANAN OPERASYON ${update.profile.completedRuns}`,
    ];
    if (update.newlyUnlockedRecords.length > 0) {
      lines.push(`YENİ · ${update.newlyUnlockedRecords.map((id) => getMasteryRecord(id).label).join(" · ")}`);
    }
    return lines.join("\n");
  }
}
