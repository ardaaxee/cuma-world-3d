import { resetMissionProgress } from "./mission";

export class MissionDebrief {
  private shownForResult = "";
  private readonly observer: MutationObserver;

  constructor(
    private readonly intelElement: HTMLElement,
    private readonly overlay: HTMLElement,
    private readonly rankElement: HTMLElement,
    private readonly scoreElement: HTMLElement,
    private readonly intelResultElement: HTMLElement,
    closeButton: HTMLButtonElement,
    private readonly onOpen: () => void = () => undefined,
    private readonly onClose: () => void = () => undefined,
  ) {
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(intelElement, { childList: true, characterData: true, subtree: true });
    closeButton.addEventListener("click", () => {
      this.overlay.classList.add("hidden");
      this.onClose();
    });

    const replayButton = document.querySelector<HTMLButtonElement>("#debrief-replay");
    if (!replayButton) throw new Error("CUMA WORLD missing mission replay button");
    replayButton.addEventListener("click", () => {
      replayButton.disabled = true;
      replayButton.textContent = "YENİDEN BAŞLATILIYOR…";
      resetMissionProgress();
      window.location.reload();
    });
    this.refresh();
  }

  private refresh(): void {
    const text = this.intelElement.textContent ?? "";
    if (!text.includes("COMPLETE")) return;

    const intelMatch = text.match(/INTEL\s+(\d+)\/(\d+)/i);
    const resultMatch = text.match(/COMPLETE\s*·\s*(GHOST|SHADOW|OPERATIVE)\s*·\s*SKOR\s+(\d+)/i);
    if (!resultMatch) return;

    const rank = resultMatch[1] ?? "OPERATIVE";
    const score = Math.max(0, Math.min(100, Number(resultMatch[2] ?? "0") || 0));
    const found = intelMatch ? Number(intelMatch[1] ?? "0") || 0 : 0;
    const total = intelMatch ? Number(intelMatch[2] ?? "0") || 0 : 0;
    const signature = `${rank}:${score}:${found}:${total}`;
    if (this.shownForResult === signature) return;
    this.shownForResult = signature;

    this.rankElement.textContent = rank;
    this.scoreElement.textContent = String(score).padStart(2, "0");
    this.intelResultElement.textContent = `${found}/${total} INTEL`;
    this.overlay.dataset.rank = rank;
    this.overlay.classList.remove("hidden");
    this.onOpen();
  }
}
