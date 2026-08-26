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
    if (this.masterVolume <= 0) return;
    try {
      await this.ambience.play();
    } catch {
      // Optional source asset may not be packaged yet; gameplay must continue silently.
    }
  }

  setMasterVolume(volume: number): void {
    const wasMuted = this.masterVolume <= 0;
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumes(wasMuted && this.masterVolume > 0);
  }

  updateFootsteps(speed: number, dt: number): void {
    if (!this.unlocked || this.masterVolume <= 0 || speed < 0.55) {
      this.footstepClock = 0;
      return;
    }

    const pace = Math.max(0, Math.min(1, (speed - 0.55) / 3.6));
    const running = speed > 3.5;
    const interval = 0.49 - pace * 0.18;
    this.footstepClock += dt;
    if (this.footstepClock < interval) return;
    this.footstepClock %= interval;

    const sample = this.footsteps[this.footstepIndex % this.footsteps.length];
    this.footstepIndex += 1;
    if (!sample) return;

    const pitchPattern = [0.97, 1.01, 0.985, 1.025];
    const volumePattern = [0.96, 1.02, 0.98, 1.0];
    const pitch = pitchPattern[this.footstepIndex % pitchPattern.length] ?? 1;
    const variation = volumePattern[this.footstepIndex % volumePattern.length] ?? 1;
    try {
      sample.pause();
      sample.currentTime = 0;
      sample.playbackRate = pitch;
      sample.volume = Math.min(1, (running ? 0.44 : 0.32 + pace * 0.06) * variation * this.masterVolume);
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
