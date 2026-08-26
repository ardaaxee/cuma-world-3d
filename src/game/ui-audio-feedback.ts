type UiCue = "intel" | "curious" | "suspicious" | "alert";

type CueShape = {
  startHz: number;
  endHz: number;
  duration: number;
  gain: number;
  type: OscillatorType;
};

const CUES: Record<UiCue, CueShape> = {
  intel: { startHz: 620, endHz: 880, duration: 0.12, gain: 0.038, type: "sine" },
  curious: { startHz: 360, endHz: 430, duration: 0.09, gain: 0.022, type: "sine" },
  suspicious: { startHz: 315, endHz: 250, duration: 0.13, gain: 0.032, type: "triangle" },
  alert: { startHz: 220, endHz: 165, duration: 0.18, gain: 0.04, type: "triangle" },
};

export class UiAudioFeedback {
  private context: AudioContext | null = null;
  private unlocked = false;
  private volume = 0.75;
  private previousIntelCount = 0;
  private previousAwareness = "NORMAL";
  private readonly intelObserver: MutationObserver;
  private readonly awarenessObserver: MutationObserver;

  constructor(
    private readonly intelElement: HTMLElement,
    private readonly awarenessElement: HTMLElement,
  ) {
    this.previousIntelCount = this.readIntelCount();
    this.previousAwareness = awarenessElement.dataset.state ?? "NORMAL";

    this.intelObserver = new MutationObserver(() => this.onIntelChanged());
    this.intelObserver.observe(intelElement, { childList: true, characterData: true, subtree: true });

    this.awarenessObserver = new MutationObserver(() => this.onAwarenessChanged());
    this.awarenessObserver.observe(awarenessElement, {
      attributes: true,
      attributeFilter: ["data-state", "class"],
    });
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      this.context = new AudioContext({ latencyHint: "interactive" });
      if (this.context.state === "suspended") await this.context.resume();
    } catch {
      this.context = null;
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private onIntelChanged(): void {
    const next = this.readIntelCount();
    if (next > this.previousIntelCount) this.play("intel");
    this.previousIntelCount = next;
  }

  private onAwarenessChanged(): void {
    if (this.awarenessElement.classList.contains("hidden")) {
      this.previousAwareness = "NORMAL";
      return;
    }

    const next = this.awarenessElement.dataset.state ?? "NORMAL";
    if (next === this.previousAwareness) return;
    this.previousAwareness = next;

    if (next === "CURIOUS") this.play("curious");
    else if (next === "SUSPICIOUS") this.play("suspicious");
    else if (next === "ALERT") this.play("alert");
  }

  private readIntelCount(): number {
    const match = this.intelElement.textContent?.match(/INTEL\s+(\d+)/i);
    return match ? Number(match[1]) || 0 : 0;
  }

  private play(cue: UiCue): void {
    const context = this.context;
    if (!this.unlocked || !context || this.volume <= 0 || context.state !== "running") return;

    const shape = CUES[cue];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = shape.type;
    oscillator.frequency.setValueAtTime(shape.startHz, now);
    oscillator.frequency.exponentialRampToValueAtTime(shape.endHz, now + shape.duration);

    const peak = shape.gain * this.volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + shape.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + shape.duration + 0.01);
  }
}
