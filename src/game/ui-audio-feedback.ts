import { type PresentationCue, onPresentation } from "./presentation-events";

/**
 * Short synthetic UI cues.
 *
 * Like `MissionFeedback`, this used to watch HUD elements for DOM mutations and
 * parse text to guess what happened; it now listens to the same typed
 * presentation cues. The WebAudio approach is unchanged.
 *
 * These are deliberately tiny sine/triangle blips — full environmental audio
 * belongs to a later milestone. There is no siren layer, nothing loops, and a
 * missing or blocked AudioContext silently costs nothing.
 */

type CueShape = {
  startHz: number;
  endHz: number;
  duration: number;
  gain: number;
  type: OscillatorType;
};

/**
 * One shape per cue. Rising intervals read as confirmations, falling ones as
 * pressure, and gains stay low so nothing here competes with gameplay audio.
 */
const CUES: Record<PresentationCue, CueShape> = {
  MISSION_INTRO: { startHz: 262, endHz: 392, duration: 0.42, gain: 0.03, type: "sine" },
  MISSION_OBJECTIVE: { startHz: 494, endHz: 659, duration: 0.16, gain: 0.032, type: "sine" },
  STAGE_RESOLVED: { startHz: 523, endHz: 784, duration: 0.2, gain: 0.034, type: "sine" },
  INTEL_DISCOVERED: { startHz: 620, endHz: 880, duration: 0.12, gain: 0.038, type: "sine" },
  OPTIONAL_COMPLETED: { startHz: 587, endHz: 784, duration: 0.14, gain: 0.03, type: "sine" },
  OPPORTUNITY_USED: { startHz: 440, endHz: 587, duration: 0.13, gain: 0.03, type: "triangle" },
  FACILITY_WATCH: { startHz: 360, endHz: 430, duration: 0.09, gain: 0.022, type: "sine" },
  FACILITY_SEARCH: { startHz: 315, endHz: 250, duration: 0.13, gain: 0.032, type: "triangle" },
  FACILITY_HIGH_ALERT: { startHz: 220, endHz: 165, duration: 0.18, gain: 0.04, type: "triangle" },
  GADGET_READY: { startHz: 700, endHz: 932, duration: 0.09, gain: 0.026, type: "sine" },
};

export class UiAudioFeedback {
  private context: AudioContext | null = null;
  private unlocked = false;
  private volume = 0.75;
  private readonly stop: () => void;

  constructor() {
    this.stop = onPresentation((event) => this.play(event.cue));
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

  private play(cue: PresentationCue): void {
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

  dispose(): void {
    this.stop();
  }
}
