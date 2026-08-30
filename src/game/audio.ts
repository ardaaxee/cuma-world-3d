import { type WorldAudioCue, type WorldAudioEvent, onWorldAudio } from "./audio-events";
import {
  DUCK_AMOUNT,
  DUCK_SECONDS,
  type FacilitySignal,
  GaitScheduler,
  type LocomotionMode,
  MAX_SPATIAL_VOICES,
  MIX,
  SPATIAL_MAX_DISTANCE,
  SPATIAL_REF_DISTANCE,
  SPATIAL_ROLLOFF,
  clampVolume,
  isMuted,
  locomotionMode,
  selectVoiceSlot,
  tensionTargetFor,
} from "./audio-model";
import {
  type AcousticZone,
  acousticMixFor,
  classifyAcoustic,
  surfaceFor,
} from "./audio-surfaces";
import { isCrouched } from "./input";
import { type PresentationCue, onPresentation } from "./presentation-events";

/**
 * The one runtime audio owner.
 *
 * One AudioContext, one master gain, four category buses, one bounded spatial
 * voice pool and one listener update path. Milestone 06's `UiAudioFeedback` was
 * folded in here, so presentation blips and world audio now share a single
 * context and a single volume owner.
 *
 * It renders what the player hears. It never feeds the gameplay noise model:
 * `noise.ts` remains the sole authority on NPC hearing, and nothing in this
 * file is read by it. Muting the game therefore cannot make the player
 * stealthier, and a missing WAV cannot remove gameplay footstep noise.
 */

const AUDIO_BASE = "./assets/audio/";
const FOOTSTEP_FILES = ["footstep_a.wav", "footstep_b.wav"] as const;
const AMBIENCE_FILE = "city_ambience.wav";

/** Ambience/tension follow the space on a slow tick, not every frame. */
const MIX_TICK_SECONDS = 0.25;
const AMBIENCE_BLEND_RATE = 1.6;
const TENSION_BLEND_RATE = 1.1;

/** Short synthesised shapes for cues with no packaged sample. */
interface ToneShape {
  readonly startHz: number;
  readonly endHz: number;
  readonly duration: number;
  readonly gain: number;
  readonly type: OscillatorType;
}

/** Presentation cues, inherited from Milestone 06's UiAudioFeedback. */
const PRESENTATION_TONES: Record<PresentationCue, ToneShape> = {
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

/** Which cues duck the ambience bed briefly. */
const DUCKING_CUES: readonly PresentationCue[] = ["FACILITY_SEARCH", "FACILITY_HIGH_ALERT", "MISSION_INTRO"];

/** World cues are synthesised: no packaged samples exist for them yet. */
const WORLD_TONES: Record<WorldAudioCue, ToneShape> = {
  "door-open": { startHz: 190, endHz: 128, duration: 0.2, gain: 0.5, type: "triangle" },
  "door-locked": { startHz: 128, endHz: 96, duration: 0.13, gain: 0.42, type: "square" },
  "door-security-close": { startHz: 156, endHz: 88, duration: 0.3, gain: 0.55, type: "triangle" },
  "cart-start": { startHz: 92, endHz: 132, duration: 0.26, gain: 0.34, type: "sawtooth" },
  "cart-stop": { startHz: 128, endHz: 74, duration: 0.22, gain: 0.4, type: "triangle" },
  decoy: { startHz: 520, endHz: 300, duration: 0.26, gain: 0.62, type: "square" },
  scan: { startHz: 880, endHz: 1320, duration: 0.18, gain: 0.4, type: "sine" },
  jam: { startHz: 240, endHz: 150, duration: 0.34, gain: 0.36, type: "sawtooth" },
  landing: { startHz: 150, endHz: 62, duration: 0.17, gain: 0.7, type: "triangle" },
};

interface SpatialVoice {
  readonly panner: PannerNode;
  readonly gain: GainNode;
  startedAt: number | null;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private tensionBus: GainNode | null = null;
  private worldBus: GainNode | null = null;
  private playerBus: GainNode | null = null;
  private presentationBus: GainNode | null = null;

  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private ambienceGain: GainNode | null = null;
  private roomToneSource: AudioBufferSourceNode | null = null;
  private roomToneGain: GainNode | null = null;
  private tensionSource: AudioBufferSourceNode | null = null;

  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly voices: SpatialVoice[] = [];
  private readonly gait = new GaitScheduler();

  private unlocked = false;
  private starting: Promise<void> | null = null;
  private masterVolume = 0.75;
  private paused = false;
  private zone: AcousticZone = "OUTDOOR";
  private facility: FacilitySignal = "CALM";
  private mixClock = 0;
  private cityLevel = 1;
  private roomLevel = 0;
  private tensionLevel = 0;
  private duckUntil = 0;
  private stopPresentation: (() => void) | null = null;
  private stopWorldAudio: (() => void) | null = null;

  /**
   * Creates the context after a user gesture. Idempotent: repeated calls, from
   * repeated boot attempts or a second unlock path, return the same in-flight
   * promise and never build a second context or a second ambience loop.
   */
  async unlock(): Promise<void> {
    if (this.unlocked) return;
    if (this.starting) return this.starting;
    this.starting = this.start();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async start(): Promise<void> {
    try {
      const context = new AudioContext({ latencyHint: "interactive" });
      if (context.state === "suspended") await context.resume();
      this.context = context;
      this.buildGraph(context);
      this.subscribe();
      this.unlocked = true;
      await this.loadBuffers(context);
      this.startAmbience();
    } catch {
      // A blocked or unavailable AudioContext must never stop gameplay.
      this.context = null;
      this.unlocked = false;
    }
  }

  private buildGraph(context: AudioContext): void {
    const master = context.createGain();
    master.gain.value = this.masterVolume;
    master.connect(context.destination);
    this.master = master;

    this.ambienceBus = this.bus(context, master, MIX.ambience);
    this.tensionBus = this.bus(context, master, MIX.tension);
    this.worldBus = this.bus(context, master, MIX.world);
    this.playerBus = this.bus(context, master, MIX.player);
    this.presentationBus = this.bus(context, master, MIX.presentation);

    // Bounded voice pool, allocated once. Nodes are reused for the life of the
    // context; nothing is created per sound.
    for (let index = 0; index < MAX_SPATIAL_VOICES; index += 1) {
      const panner = context.createPanner();
      panner.panningModel = "equalpower";
      panner.distanceModel = "inverse";
      panner.refDistance = SPATIAL_REF_DISTANCE;
      panner.maxDistance = SPATIAL_MAX_DISTANCE;
      panner.rolloffFactor = SPATIAL_ROLLOFF;
      const gain = context.createGain();
      gain.gain.value = 1;
      gain.connect(panner);
      panner.connect(this.worldBus);
      this.voices.push({ panner, gain, startedAt: null });
    }
  }

  private bus(context: AudioContext, master: GainNode, level: number): GainNode {
    const node = context.createGain();
    node.gain.value = level;
    node.connect(master);
    return node;
  }

  /** Subscribed once, on the first successful unlock. */
  private subscribe(): void {
    if (!this.stopPresentation) this.stopPresentation = onPresentation((event) => this.playPresentation(event.cue));
    if (!this.stopWorldAudio) this.stopWorldAudio = onWorldAudio((event) => this.playWorld(event));
  }

  private async loadBuffers(context: AudioContext): Promise<void> {
    const files = [AMBIENCE_FILE, ...FOOTSTEP_FILES];
    await Promise.all(files.map(async (name) => {
      try {
        const response = await fetch(`${AUDIO_BASE}${name}`);
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        this.buffers.set(name, await context.decodeAudioData(bytes));
      } catch {
        // A missing or undecodable optional asset falls back to synthesis.
      }
    }));
  }

  // --- ambience ------------------------------------------------------------

  private startAmbience(): void {
    const context = this.context;
    const bus = this.ambienceBus;
    if (!context || !bus || this.ambienceSource) return;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 18000;
    const gain = context.createGain();
    gain.gain.value = 1;
    filter.connect(gain);
    gain.connect(bus);
    this.ambienceFilter = filter;
    this.ambienceGain = gain;

    const buffer = this.buffers.get(AMBIENCE_FILE);
    if (buffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(filter);
      source.start();
      this.ambienceSource = source;
    }

    // Interior room tone: one reusable noise buffer, generated once.
    const toneGain = context.createGain();
    toneGain.gain.value = 0;
    toneGain.connect(bus);
    const toneSource = context.createBufferSource();
    toneSource.buffer = this.noiseBuffer(context, 2.2);
    toneSource.loop = true;
    const toneFilter = context.createBiquadFilter();
    toneFilter.type = "lowpass";
    toneFilter.frequency.value = 380;
    toneSource.connect(toneFilter);
    toneFilter.connect(toneGain);
    toneSource.start();
    this.roomToneSource = toneSource;
    this.roomToneGain = toneGain;

    // Tension bed: the same reusable noise, filtered low and normally silent.
    const tension = context.createBufferSource();
    tension.buffer = this.noiseBuffer(context, 2.2);
    tension.loop = true;
    const tensionFilter = context.createBiquadFilter();
    tensionFilter.type = "bandpass";
    tensionFilter.frequency.value = 120;
    tensionFilter.Q.value = 0.7;
    tension.connect(tensionFilter);
    tensionFilter.connect(this.tensionBus as GainNode);
    tension.start();
    this.tensionSource = tension;
    if (this.tensionBus) this.tensionBus.gain.value = 0;
  }

  /** One short noise buffer, reused by every bed. Never regenerated. */
  private noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
    const frames = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic value noise; no Math.random, and generated exactly once.
    let state = 0x9e3779b9;
    for (let index = 0; index < frames; index += 1) {
      state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
      data[index] = ((state >>> 8) / 0x800000 - 1) * 0.5;
    }
    return buffer;
  }

  // --- per-frame -----------------------------------------------------------

  /**
   * Called once per gameplay frame. Updates the listener, the gait and, on a
   * slow tick, the ambience mix. No allocation, no scene scan, no raycast.
   */
  update(
    dt: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    horizontalSpeed: number,
    running: boolean,
    facility: FacilitySignal,
  ): void {
    if (!this.ready()) return;
    this.facility = facility;
    this.updateListener(x, y, z, yaw);
    this.updateFootsteps(dt, x, y, z, horizontalSpeed, running);

    this.mixClock -= dt;
    if (this.mixClock <= 0) {
      this.mixClock = MIX_TICK_SECONDS;
      this.zone = classifyAcoustic(x, y, z);
    }
    this.updateMix(dt);
  }

  /** Cached scalar writes only — no vector or array allocation per frame. */
  private updateListener(x: number, y: number, z: number, yaw: number): void {
    const context = this.context;
    if (!context) return;
    const listener = context.listener;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    if (listener.positionX) {
      listener.positionX.value = x;
      listener.positionY.value = y;
      listener.positionZ.value = z;
      listener.forwardX.value = forwardX;
      listener.forwardY.value = 0;
      listener.forwardZ.value = forwardZ;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
      return;
    }
    // Older Safari/WebKit path.
    listener.setPosition?.(x, y, z);
    listener.setOrientation?.(forwardX, 0, forwardZ, 0, 1, 0);
  }

  /**
   * Distance-based gait. The scheduler decides when a foot lands; this only
   * renders it. Gameplay footstep noise is reported separately by the runtime
   * and is completely unaffected by anything here.
   */
  private updateFootsteps(
    dt: number,
    x: number,
    y: number,
    z: number,
    horizontalSpeed: number,
    running: boolean,
  ): void {
    const mode: LocomotionMode = locomotionMode(isCrouched(), running);
    const distance = Math.max(0, horizontalSpeed) * Math.max(0, dt);
    const step = this.gait.update(distance, horizontalSpeed, mode);
    if (!step) return;

    const surface = surfaceFor(classifyAcoustic(x, y, z));
    const buffer = this.buffers.get(FOOTSTEP_FILES[step.sampleIndex % FOOTSTEP_FILES.length] ?? FOOTSTEP_FILES[0]);
    const rate = surface.stepRateMin + step.rateBias * (surface.stepRateMax - surface.stepRateMin);
    const gain = surface.stepGain * step.gain;

    if (buffer) this.playBuffer(buffer, this.playerBus, gain, rate, surface.stepFilterHz);
    else this.playTone({ startHz: 168, endHz: 96, duration: 0.09, gain: gain * 0.5, type: "triangle" }, this.playerBus, 1);
  }

  private updateMix(dt: number): void {
    const mix = acousticMixFor(this.zone);
    const blend = 1 - Math.exp(-AMBIENCE_BLEND_RATE * dt);
    this.cityLevel += (mix.cityGain - this.cityLevel) * blend;
    this.roomLevel += (mix.roomToneGain - this.roomLevel) * blend;

    const tensionTarget = tensionTargetFor(this.facility);
    this.tensionLevel += (tensionTarget - this.tensionLevel) * (1 - Math.exp(-TENSION_BLEND_RATE * dt));

    const context = this.context;
    if (!context) return;
    const ducking = context.currentTime < this.duckUntil ? DUCK_AMOUNT : 1;
    if (this.ambienceGain) this.ambienceGain.gain.value = this.cityLevel * ducking;
    if (this.ambienceFilter) {
      const target = mix.cityFilterHz;
      const current = this.ambienceFilter.frequency.value;
      this.ambienceFilter.frequency.value = current + (target - current) * blend;
    }
    if (this.roomToneGain) this.roomToneGain.gain.value = this.roomLevel * ducking;
    if (this.tensionBus) this.tensionBus.gain.value = MIX.tension * this.tensionLevel * ducking;
  }

  // --- cues ----------------------------------------------------------------

  private playPresentation(cue: PresentationCue): void {
    if (!this.ready()) return;
    if (DUCKING_CUES.includes(cue)) this.duck();
    this.playTone(PRESENTATION_TONES[cue], this.presentationBus, 1);
  }

  private playWorld(event: WorldAudioEvent): void {
    if (!this.ready()) return;
    const shape = WORLD_TONES[event.cue];
    const strength = 0.55 + event.strength * 0.45;
    if (event.local) {
      this.playTone(shape, event.cue === "landing" ? this.playerBus : this.worldBus, strength);
      return;
    }
    this.playSpatialTone(shape, event.x, event.y, event.z, strength);
  }

  private duck(): void {
    const context = this.context;
    if (!context) return;
    this.duckUntil = context.currentTime + DUCK_SECONDS;
  }

  // --- voices --------------------------------------------------------------

  private playBuffer(
    buffer: AudioBuffer,
    destination: AudioNode | null,
    gain: number,
    rate: number,
    filterHz: number,
  ): void {
    const context = this.context;
    if (!context || !destination) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterHz;
    const level = context.createGain();
    level.gain.value = gain;
    source.connect(filter);
    filter.connect(level);
    level.connect(destination);
    source.start();
    // One-shots free themselves; nothing is polled or timed externally.
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      level.disconnect();
    };
  }

  private playTone(shape: ToneShape, destination: AudioNode | null, strength: number): void {
    const context = this.context;
    if (!context || !destination) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.type = shape.type;
    oscillator.frequency.setValueAtTime(shape.startHz, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, shape.endHz), now + shape.duration);
    const peak = Math.max(0.0002, shape.gain * strength);
    level.gain.setValueAtTime(0.0001, now);
    level.gain.exponentialRampToValueAtTime(peak, now + 0.014);
    level.gain.exponentialRampToValueAtTime(0.0001, now + shape.duration);
    oscillator.connect(level);
    level.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + shape.duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      level.disconnect();
    };
  }

  /** Plays through the bounded pool, stealing the oldest voice when full. */
  private playSpatialTone(shape: ToneShape, x: number, y: number, z: number, strength: number): void {
    const context = this.context;
    if (!context || this.voices.length === 0) return;
    const now = context.currentTime;
    const slot = selectVoiceSlot(this.voices.map((voice) => voice.startedAt), now);
    const voice = this.voices[slot];
    if (!voice) return;

    if (voice.panner.positionX) {
      voice.panner.positionX.value = x;
      voice.panner.positionY.value = y;
      voice.panner.positionZ.value = z;
    } else {
      voice.panner.setPosition?.(x, y, z);
    }
    voice.startedAt = now;

    const oscillator = context.createOscillator();
    oscillator.type = shape.type;
    oscillator.frequency.setValueAtTime(shape.startHz, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, shape.endHz), now + shape.duration);
    const level = context.createGain();
    const peak = Math.max(0.0002, shape.gain * strength);
    level.gain.setValueAtTime(0.0001, now);
    level.gain.exponentialRampToValueAtTime(peak, now + 0.014);
    level.gain.exponentialRampToValueAtTime(0.0001, now + shape.duration);
    oscillator.connect(level);
    level.connect(voice.gain);
    oscillator.start(now);
    oscillator.stop(now + shape.duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      level.disconnect();
      voice.startedAt = null;
    };
  }

  // --- lifecycle -----------------------------------------------------------

  private ready(): boolean {
    return this.unlocked && !this.paused && this.context !== null && !isMuted(this.masterVolume);
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = clampVolume(volume);
    if (this.master) this.master.gain.value = this.masterVolume;
    // Muting is a speaker-level change only. Nothing about NPC hearing, the
    // noise model or stealth rules reads this value.
    void this.resumeIfNeeded();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Suspends the whole context rather than stopping loops, so resume restores
   * exactly the loops that were running with no chance of a duplicate.
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.gait.reset();
    const context = this.context;
    if (!context) return;
    if (paused) void context.suspend().catch(() => undefined);
    else void this.resumeIfNeeded();
  }

  private async resumeIfNeeded(): Promise<void> {
    const context = this.context;
    if (!context || this.paused || isMuted(this.masterVolume)) return;
    if (context.state === "suspended") await context.resume().catch(() => undefined);
  }

  /** Clears banked gait so a cinematic cannot produce a delayed burst. */
  resetLocomotion(): void {
    this.gait.reset();
  }

  /** Diagnostics for the audio contract tests and the handoff report. */
  describe(): { context: number; voices: number; buffers: number; zone: AcousticZone } {
    return {
      context: this.context ? 1 : 0,
      voices: this.voices.length,
      buffers: this.buffers.size,
      zone: this.zone,
    };
  }

  dispose(): void {
    this.stopPresentation?.();
    this.stopWorldAudio?.();
    this.stopPresentation = null;
    this.stopWorldAudio = null;
    this.ambienceSource?.stop();
    this.roomToneSource?.stop();
    this.tensionSource?.stop();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.unlocked = false;
  }
}
