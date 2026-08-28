type FeedbackKind = "OBJECTIVE" | "INTEL" | "AWARENESS";

export class MissionFeedback {
  private readonly host: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private hideTimer: number | null = null;
  private previousObjective: string;
  private previousIntel: number;
  private previousAwareness: string;

  constructor(
    private readonly objectiveEl: HTMLElement,
    private readonly intelEl: HTMLElement,
    private readonly awarenessEl: HTMLElement,
  ) {
    this.host = document.createElement("div");
    this.host.className = "mission-feedback";
    this.host.setAttribute("role", "status");
    this.host.setAttribute("aria-live", "polite");
    this.host.setAttribute("aria-atomic", "true");

    this.labelEl = document.createElement("span");
    this.labelEl.className = "mission-feedback-label";
    this.detailEl = document.createElement("strong");
    this.detailEl.className = "mission-feedback-detail";
    this.host.append(this.labelEl, this.detailEl);
    document.body.append(this.host);

    this.previousObjective = this.readObjective();
    this.previousIntel = this.readIntelCount();
    this.previousAwareness = this.awarenessEl.dataset.state ?? "NORMAL";

    new MutationObserver(() => this.onObjectiveChanged()).observe(this.objectiveEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    new MutationObserver(() => this.onIntelChanged()).observe(this.intelEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    new MutationObserver(() => this.onAwarenessChanged()).observe(this.awarenessEl, {
      attributes: true,
      attributeFilter: ["data-state"],
    });
  }

  private onObjectiveChanged(): void {
    const next = this.readObjective();
    if (!next || next === this.previousObjective) return;
    const hadPrevious = Boolean(this.previousObjective);
    this.previousObjective = next;
    if (!hadPrevious || !this.gameplayActive()) return;
    this.show("OBJECTIVE", "YENİ HEDEF", next, [28]);
  }

  private onIntelChanged(): void {
    const next = this.readIntelCount();
    if (next <= this.previousIntel) {
      this.previousIntel = next;
      return;
    }
    this.previousIntel = next;
    if (!this.gameplayActive()) return;
    this.show("INTEL", "INTEL GÜNCELLENDİ", this.intelEl.textContent?.trim() ?? `INTEL ${next}`, [18]);
  }

  private onAwarenessChanged(): void {
    const next = this.awarenessEl.dataset.state ?? "NORMAL";
    if (next === this.previousAwareness) return;
    this.previousAwareness = next;
    if (!this.gameplayActive()) return;

    if (next === "SUSPICIOUS") {
      this.show("AWARENESS", "DİKKAT", "ŞÜPHE ARTIYOR", [24, 24, 24]);
      return;
    }
    if (next === "ALERT") {
      this.show("AWARENESS", "ALARM", "KONUMUN AÇIĞA ÇIKTI", [45, 32, 70]);
    }
  }

  private show(kind: FeedbackKind, label: string, detail: string, vibration: number[]): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.host.dataset.kind = kind;
    this.labelEl.textContent = label;
    this.detailEl.textContent = detail;
    this.host.classList.remove("visible");
    void this.host.offsetWidth;
    this.host.classList.add("visible");
    this.vibrate(vibration);
    this.hideTimer = window.setTimeout(() => {
      this.host.classList.remove("visible");
      this.hideTimer = null;
    }, kind === "AWARENESS" ? 1800 : 2600);
  }

  private gameplayActive(): boolean {
    return document.querySelector("#boot")?.classList.contains("hidden") ?? false;
  }

  private readObjective(): string {
    return this.objectiveEl.textContent?.trim() ?? "";
  }

  private readIntelCount(): number {
    const match = this.intelEl.textContent?.match(/INTEL\s+(\d+)\/(\d+)/i);
    return match ? Number(match[1]) : 0;
  }

  private vibrate(pattern: number[]): void {
    if (document.visibilityState !== "visible") return;
    if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  }
}
