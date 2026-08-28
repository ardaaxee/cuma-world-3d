import "../interaction-feedback.css";

type MissionUiState = "BRIEFING" | "RECON" | "PLANNING" | "INFILTRATE" | "EXTRACT" | "COMPLETE" | "UNKNOWN";

export class InteractionPromptGuard {
  private readonly observer: MutationObserver;

  constructor(
    private readonly missionStatus: HTMLElement,
    private readonly interaction: HTMLElement,
  ) {
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(missionStatus, { childList: true, characterData: true, subtree: true });
    this.observer.observe(interaction, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    this.observer.observe(document.body, { attributes: true, attributeFilter: ["data-operation-step"] });
    this.refresh();
  }

  private refresh(): void {
    const state = this.readState();
    const label = (this.interaction.textContent ?? "").trim();
    const actionable = this.isActionable(state, label);
    this.interaction.dataset.actionable = actionable ? "true" : "false";
    document.body.classList.toggle("interaction-ready", actionable);
    if (actionable) this.interaction.style.removeProperty("display");
    else this.interaction.style.display = "none";
  }

  private readState(): MissionUiState {
    const text = this.missionStatus.textContent ?? "";
    const match = text.match(/(?:^|·)\s*(BRIEFING|RECON|PLANNING|INFILTRATE|EXTRACT|COMPLETE)(?:\s*·|$)/i);
    const value = match?.[1]?.toUpperCase();
    if (value === "BRIEFING" || value === "RECON" || value === "PLANNING" || value === "INFILTRATE" || value === "EXTRACT" || value === "COMPLETE") return value;
    return "UNKNOWN";
  }

  private isActionable(state: MissionUiState, label: string): boolean {
    if (!label) return false;
    if (label === "ANA YAKLAŞIMI SEÇ" || label === "YAN YAKLAŞIMI SEÇ") return state === "PLANNING";
    if (label === "TESLİMAT KAYDINI DOĞRULA") return state === "INFILTRATE" && document.body.dataset.operationStep === "verify";
    if (label === "TEK KULLANIMLIK ERİŞİM KODUNU AL") return state === "INFILTRATE" && document.body.dataset.operationStep === "access";
    if (label === "TESLİMAT MANİFESTİNİ EŞLEŞTİR") return state === "INFILTRATE" && document.body.dataset.operationStep === "manifest";
    if (label === "BÖLGEDEN AYRIL") return state === "EXTRACT";
    if (label === "CCTV BESLEMESİNİ DEVRE DIŞI BIRAK") return state === "INFILTRATE" || state === "EXTRACT";
    if (label === "CCTV DEVRE DIŞI" || label.startsWith("ÖNCE CCTV") || label === "CCTV FIRSATI HAZIR") return false;
    return true;
  }
}
