export class GameAudio {
  private readonly ambience = new Audio("./assets/audio/city_ambience.wav");
  private readonly footsteps = [
    new Audio("./assets/audio/footstep_a.wav"),
    new Audio("./assets/audio/footstep_b.wav"),
  ];
  private unlocked = false;
  private footstepClock = 0;
  private footstepIndex = 0;
  private masterVolume = 0.75;

  constructor() {
    this.ambience.loop = true;
    this.ambience.preload = "auto";
    for (const sample of this.footsteps) sample.preload = "auto";
    this.applyVolumes(false);
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      await this.ambience.play();
    } catch {
      // Optional source asset may not be packaged yet; gameplay must continue silently.
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumes(false);
  }

  updateFootsteps(speed: number, dt: number): void {
    if (!this.unlocked || this.masterVolume <= 0 || speed < 0.55) {
      this.footstepClock = 0;
      return;
    }
    const running = speed > 3.5;
    const interval = running ? 0.31 : 0.46;
    this.footstepClock += dt;
    if (this.footstepClock < interval) return;
    this.footstepClock %= interval;

    const sample = this.footsteps[this.footstepIndex % this.footsteps.length];
    this.footstepIndex += 1;
    if (!sample) return;
    try {
      sample.pause();
      sample.currentTime = 0;
      sample.playbackRate = 0.97 + (this.footstepIndex % 4) * 0.018;
      sample.volume = (running ? 0.44 : 0.34) * this.masterVolume;
      void sample.play().catch(() => undefined);
    } catch {
      // Missing/unsupported audio must never break movement.
    }
  }

  setPaused(paused: boolean): void {
    if (!this.unlocked) return;
    if (paused) this.ambience.pause();
    else if (this.masterVolume > 0) void this.ambience.play().catch(() => undefined);
  }

  private applyVolumes(resume: boolean): void {
    this.ambience.volume = 0.18 * this.masterVolume;
    for (const sample of this.footsteps) sample.volume = 0.38 * this.masterVolume;
    if (this.masterVolume <= 0) this.ambience.pause();
    else if (resume && this.unlocked) void this.ambience.play().catch(() => undefined);
  }
}
