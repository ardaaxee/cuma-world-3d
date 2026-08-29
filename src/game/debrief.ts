import { getOptionalObjective, getOpportunity } from "./mission-graph";
import { resetMissionProgress } from "./mission-save";
import { type MissionResult, onMissionResult } from "./mission-result";

/**
 * The mission debrief.
 *
 * This used to watch the HUD objective line with a MutationObserver and recover
 * the result with regexes over Turkish prose. It now consumes the typed
 * `MissionResult` the director publishes, so the panel can report how the run
 * was actually solved and nothing breaks when HUD wording changes.
 *
 * It deliberately imports only the dependency-free save/graph modules — pulling
 * `mission.ts` in here would drag `operation-depth -> world-expansion -> doors`
 * into the boot chunk.
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
      // Clearing the save is what makes the next run pick a fresh runSeed.
      resetMissionProgress();
      window.location.reload();
    });

    onMissionResult((result) => this.present(result));
  }

  private present(result: MissionResult): void {
    const signature = `${result.rank}:${result.score}:${result.runSeed}:${result.objectivesCompleted.length}`;
    if (this.shownForResult === signature) return;
    this.shownForResult = signature;

    this.rankElement.textContent = result.rank;
    this.scoreElement.textContent = String(result.score).padStart(2, "0");
    this.intelResultElement.textContent = `${result.intelFound}/${result.intelTotal} INTEL`;
    if (this.noteElement) this.noteElement.textContent = this.summarize(result);
    this.overlay.dataset.rank = result.rank;
    this.overlay.classList.remove("hidden");
    this.onOpen();
  }

  /** One compact paragraph: how the run was solved, and what it left behind. */
  private summarize(result: MissionResult): string {
    const lines: string[] = [];
    lines.push(result.route === "side" ? "YAN ROTA" : "ANA ROTA");

    for (const entry of result.resolutions) {
      if (entry.stage === "MANIFEST") lines.push(`MANİFEST · ${entry.label}`);
      if (entry.stage === "VERIFY") lines.push(`DOĞRULAMA · ${entry.label}`);
    }

    lines.push(`OPSİYONEL HEDEF ${result.objectivesCompleted.length}/${result.objectivesTotal}`);
    if (result.objectivesCompleted.length > 0) {
      lines.push(result.objectivesCompleted.map((id) => getOptionalObjective(id).label).join(" · "));
    }
    lines.push(
      result.opportunitiesUsed.length > 0
        ? `FIRSAT · ${result.opportunitiesUsed.map((id) => getOpportunity(id).label).join(" · ")}`
        : "FIRSAT KULLANILMADI",
    );
    lines.push(result.alerts === 0 ? "GÜVENLİK · HİÇ ALARM YOK" : `GÜVENLİK · ${result.alerts} ALARM`);
    lines.push(result.replayHint);
    return lines.join("\n");
  }
}
