import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Material,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Ray,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { GameAudio } from "./audio";
import { resolveThirdPersonCameraCollision } from "./camera-collision";
import { PlayerCharacter } from "./character";
import { hasStaffCredential } from "./access-state";
import { type CoverState, getCoverState, isInCover, releaseCover, setCoverPaused } from "./cover";
import { closeSecurityDoors, doorPromptLabel, resetDoors, showDoorStatus, tryUseDoor, updateDoors } from "./doors";
import {
  type FacilityState,
  readSearchAnchor,
  relaxFacilityHeat,
  reportIncident,
  resetFacilitySecurity,
  updateFacilitySecurity,
} from "./facility-security";
import {
  type FieldFocusTarget,
  activateFieldFocus,
  isFieldFocusActive,
  resetFieldFocus,
  setFieldFocusQuality,
  updateFieldFocus,
} from "./field-focus";
import { publishWorldAudio } from "./audio-events";
import { CinematicPresentation } from "./cinematic-presentation";
import { MobileInput, consumeJumpPressed, isCrouched, isJumpQueued, isRunHeld } from "./input";
import { applyLookY } from "./mobile-ux";
import { hapticConfirm, hapticTap, setHapticsEnabled } from "./haptics";
import { publishPresentation } from "./presentation-events";
// Installs the staged ACCESS/MANIFEST terminals. It lives here rather than in
// mission.ts so the mission graph stays free of the Babylon world graph.
import "./operation-depth";
import { MissionDirector } from "./mission";
import { type MissionResolutionId, type OptionalObjectiveId, getResolution } from "./mission-graph";
import { type MissionObjectMetadata, buildMissionObjects } from "./mission-objects";
import {
  CART_NOISE_LOUDNESS,
  cartPosition,
  pushDeliveryCart,
  registerDeliveryCart,
  resetDeliveryCart,
  updateDeliveryCart,
} from "./delivery-cart";
import { DOOR_NOISE_LOUDNESS, reportEnvironmentNoise, reportPlayerMovement, resetPlayerNoise, samplePlayerNoise } from "./noise";
import { NpcSystem, STAFF_ROUTINE_WINDOW_SECONDS, type AwarenessSnapshot } from "./npc";
import { SecurityCameraSystem } from "./security";
import { StealthSignalsHud } from "./stealth-signals";
import { VisualPolish } from "./visuals";
import { type ZoneId, relaxZoneSuspicion, resetZonePresence, updateZonePresence } from "./zones";
import {
  type GraphicsPreferences,
  type ResolvedGraphicsProfile,
  loadGraphicsPreferences,
  resolveGraphicsProfile,
} from "./graphics";

/** Movement into the cover surface is damped hard; leaving it stays responsive. */
const COVER_INTO_SURFACE_DAMPING = 0.15;
const COVER_AWAY_FROM_SURFACE_DAMPING = 0.85;
/** Cover movement is deliberate without being a rail. */
const COVER_MOVE_SCALE = 0.82;
/** Dead zone that stops the shoulder from flipping while looking along a wall. */
const SHOULDER_FLIP_DEADZONE = 0.25;
const SHOULDER_SMOOTHING = 6.5;
const SHOULDER_SMOOTHING_REDUCED = 3.2;
/** Small, authored pull-in so cover framing reads without a FOV swing. */
const COVER_CAMERA_PULL_IN = 0.42;
const COVER_CAMERA_SMOOTHING = 5.5;
const COVER_CAMERA_SMOOTHING_REDUCED = 3;
const REDUCED_MOTION_CAMERA_SCALE = 0.4;

/** COVER STORY eligibility. Every one of these must hold. */
const SOCIAL_MAX_NOISE = 0.5;
const SOCIAL_COOLDOWN = 22;
/** Bounded relief, so a cover story is an opportunity and not invisibility. */
const SOCIAL_ZONE_RELIEF = 0.28;
const SOCIAL_FACILITY_RELIEF = 0.12;
const SOCIAL_LABEL = "PERSONEL KARTINI GÖSTER";

/** Doors are swung shut once per escalation, not continuously. */
const SECURITY_DOOR_STATES: readonly FacilityState[] = ["SEARCH", "HIGH_ALERT"];

/**
 * Sprint FOV needs real running, not a full joystick. Walking is input-limited
 * to 0.82 of full deflection (~3.4 m/s here), so this floor only has to reject
 * "RUN held while standing still" — `isRunHeld()` does the rest.
 */
const SPRINT_FOV_MIN_SPEED = 1.2;

/** Zone pressure only trickles into facility heat, never drives it. */
const ZONE_PRESSURE_INCIDENT = 0.6;
const ZONE_PRESSURE_INCIDENT_INTERVAL = 6;
/** How far FIELD FOCUS looks for known doors and opportunities. */
const FOCUS_RADIUS = 15;

type GameMetadata = {
  intelId?: string;
  label?: string;
  interaction?:
    | "route-main"
    | "route-side"
    | "objective"
    | "extract"
    | "camera-bypass"
    | "door"
    | MissionObjectMetadata["interaction"];
  doorId?: string;
};

/** Stage resolutions reachable from a world interactable. */
const RESOLUTION_INTERACTIONS: Partial<Record<string, MissionResolutionId>> = {
  objective: "verify_counter",
  "manifest-ledger": "manifest_ledger",
  "verify-monitoring": "verify_monitoring",
};

/** Optional objectives reachable from a world interactable. */
const OBJECTIVE_INTERACTIONS: Partial<Record<string, OptionalObjectiveId>> = {
  "objective-secondary-records": "secondary_records",
  "objective-shift-pattern": "shift_pattern",
};

export class GameRuntime {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly player: PlayerCharacter;
  private readonly visualPolish: VisualPolish;
  private readonly npcSystem: NpcSystem;
  private readonly securitySystem: SecurityCameraSystem;
  private readonly audio = new GameAudio();
  private readonly input = new MobileInput();
  private readonly mission = new MissionDirector();
  private readonly stealthSignals = new StealthSignalsHud();
  private readonly cinematic = new CinematicPresentation();
  private freshRun = false;
  private introPlayed = false;
  /** Previous mission snapshot values, so each cue fires exactly once. */
  private lastObjective = "";
  private lastIntelCount = 0;
  private lastOperationStep = "";
  private lastObjectivesCompleted = 0;
  private lastOpportunitiesUsed = 0;
  /** Scratch for the cinematic camera pose; allocated once. */
  private readonly cinematicPosition = new Vector3();
  private readonly cinematicTarget = new Vector3();
  private readonly gameplayCamPosition = new Vector3();
  private readonly gameplayCamTarget = new Vector3();
  /** The look point the third-person camera resolved this frame. */
  private readonly gameplayLookTarget = new Vector3();
  private shadowGenerator: ShadowGenerator | null = null;
  private readonly shadowCasters: Mesh[] = [];
  private graphicsPreferences = loadGraphicsPreferences();
  private activeProfile = resolveGraphicsProfile(this.graphicsPreferences);
  private observation = false;
  private observedMesh: Mesh | null = null;
  private analysisSeconds = 0;
  private yaw = 0;
  private pitch = -0.12;
  private velocity = Vector3.Zero();
  private running = false;
  private paused = false;
  private lastRenderedAt = 0;
  private lookSensitivity = 1;
  private invertLookY = false;
  private shoulderSide = 1;
  private shoulderBlend = 1;
  private coverCameraBlend = 0;
  private interactionLabel = "";
  private socialCooldown = 0;
  private lastSecurityState: FacilityState = "CALM";
  private readonly focusTargets: FieldFocusTarget[] = [];
  private readonly anchorScratch = Vector3.Zero();
  private zoneIncidentTimer = 0;
  private focusLabel = "";
  private readonly coverMoveScratch = Vector3.Zero();
  private readonly cameraDistance = 4.15;
  private readonly shoulderOffset = 0.42;

  private readonly objectiveEl = document.querySelector<HTMLElement>("#objective")!;
  private readonly intelEl = document.querySelector<HTMLElement>("#intel")!;
  private readonly observationEl = document.querySelector<HTMLElement>("#observation-readout")!;
  private readonly interactionEl = document.querySelector<HTMLElement>("#interaction")!;
  private readonly awarenessEl = document.querySelector<HTMLElement>("#awareness")!;
  private readonly awarenessLabelEl = document.querySelector<HTMLElement>("#awareness-label")!;
  private readonly awarenessFillEl = document.querySelector<HTMLElement>("#awareness-fill")!;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: false,
      powerPreference: "high-performance",
    });
    this.engine.setHardwareScalingLevel(1 / this.activeProfile.renderScale);

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.27, 0.34, 0.42, 1);
    this.scene.collisionsEnabled = true;
    this.scene.gravity = new Vector3(0, -0.28, 0);
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(0.32, 0.38, 0.44);
    this.scene.fogStart = 36;
    this.scene.fogEnd = this.activeProfile.fogEnd;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.exposure = this.activeProfile.exposure;
    this.scene.imageProcessingConfiguration.contrast = this.activeProfile.contrast;

    this.camera = new UniversalCamera("player-camera", new Vector3(0.42, 2.05, -12.1), this.scene);
    this.camera.fov = 68 * Math.PI / 180;
    this.camera.minZ = 0.08;
    this.camera.maxZ = this.activeProfile.cameraFar;
    this.camera.inputs.clear();
    this.camera.checkCollisions = false;
    this.camera.applyGravity = false;

    this.buildWorld();
    this.visualPolish = new VisualPolish(this.scene, (mesh) => this.addShadowCaster(mesh));
    this.player = new PlayerCharacter(this.scene);
    // The seed is persisted with the run, so resuming a save reproduces the
    // same routine variation and a replay gets a different one.
    this.npcSystem = new NpcSystem(
      this.scene,
      () => this.mission.reportAlert(),
      (mesh) => this.addShadowCaster(mesh),
      this.mission.getRunSeed(),
    );
    this.securitySystem = new SecurityCameraSystem(this.scene, () => this.mission.reportAlert());
    this.securitySystem.bypassPanel.metadata = {
      label: "CCTV KONTROL PANELİ",
      interaction: "camera-bypass",
    } satisfies GameMetadata;
    this.updateThirdPersonCamera(0, true);
    resetPlayerNoise();
    resetZonePresence();
    resetDoors();
    resetFacilitySecurity();
    resetFieldFocus();
    resetDeliveryCart();
    this.applyGraphicsPreferences(this.graphicsPreferences);
    // Captured before acknowledgeBriefing() moves BRIEFING -> RECON, so the
    // intro plays for a genuinely fresh run and never for a restored save.
    // This needs no save-schema field: the existing state already says it.
    this.freshRun = this.mission.snapshot().state === "BRIEFING";
    this.mission.acknowledgeBriefing();
    // Seed the cue baseline from the state we start in, so restoring a save
    // mid-operation does not replay every transition the player already saw.
    const initial = this.mission.snapshot();
    this.lastObjective = initial.objective;
    this.lastIntelCount = initial.intelFound;
    this.lastOperationStep = initial.operationStep;
    this.lastObjectivesCompleted = initial.objectivesCompleted;
    this.lastOpportunitiesUsed = initial.opportunitiesUsed;
    this.updateHud();
  }

  /**
   * Plays the fresh-run mission intro and resolves when it ends or is skipped.
   * A no-op for a restored save, so `main.ts` can always await it.
   */
  playMissionIntro(): Promise<void> {
    if (!this.freshRun || this.introPlayed) return Promise.resolve();
    this.introPlayed = true;
    return this.cinematic.begin(this.graphicsPreferences.reducedMotion);
  }

  /** True while the camera belongs to the intro rather than to gameplay. */
  isCinematicActive(): boolean {
    return this.cinematic.isActive;
  }

  skipMissionIntro(): void {
    this.cinematic.skip();
  }

  start(): void {
    let last = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const frameBudget = 1000 / this.activeProfile.targetFps;
      if (this.lastRenderedAt > 0 && now - this.lastRenderedAt < frameBudget - 1.5) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.lastRenderedAt = now;
      // Pausing simply stops advancing either path, so backgrounding freezes
      // the intro exactly like it freezes gameplay — no separate timer to
      // suspend and nothing to restart on resume.
      if (!this.paused) {
        if (this.cinematic.isActive) this.updateCinematicFrame(dt);
        else this.update(dt);
      }
      this.scene.render();
    });
    window.addEventListener("resize", () => this.engine.resize());
    window.addEventListener("orientationchange", () => {
      this.input.reset();
      window.requestAnimationFrame(() => this.engine.resize());
    });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.audio.setPaused(paused);
    setCoverPaused(paused);
    if (paused) {
      this.input.reset();
      this.velocity.setAll(0);
      this.input.setInteractionAvailable(false);
      this.input.setObservationActive(false);
      this.observation = false;
      document.body.classList.remove("recon-active");
      // Backgrounding is the one moment measured time could be lost, so the
      // checkpoint is flushed here rather than waiting for the next cadence.
      this.mission.flushRunTime();
      resetPlayerNoise();
      resetFieldFocus();
      this.focusLabel = "";
      this.stealthSignals.setHidden(true);
      this.interactionLabel = "";
      this.interactionEl.classList.add("hidden");
      this.observationEl.classList.add("hidden");
    }
  }

  async unlockAudio(): Promise<void> {
    await this.audio.unlock();
  }

  setLookSensitivity(value: number): void {
    this.lookSensitivity = Math.max(0.55, Math.min(1.7, value));
  }

  setAudioVolume(value: number): void {
    this.audio.setMasterVolume(value);
  }

  setHapticsEnabled(value: boolean): void {
    setHapticsEnabled(value);
  }

  setInvertLookY(value: boolean): void {
    this.invertLookY = value;
  }

  resetTransientInput(): void {
    this.input.reset();
  }

  getGraphicsPreferences(): GraphicsPreferences {
    return { ...this.graphicsPreferences };
  }

  getGraphicsProfile(): ResolvedGraphicsProfile {
    return { ...this.activeProfile };
  }

  applyGraphicsPreferences(preferences: GraphicsPreferences): ResolvedGraphicsProfile {
    this.graphicsPreferences = { ...preferences };
    this.activeProfile = resolveGraphicsProfile(this.graphicsPreferences);
    const profile = this.activeProfile;

    this.engine.setHardwareScalingLevel(1 / profile.renderScale);
    this.scene.fogEnd = profile.fogEnd;
    this.scene.imageProcessingConfiguration.exposure = profile.exposure;
    this.scene.imageProcessingConfiguration.contrast = profile.contrast;
    this.camera.maxZ = profile.cameraFar;

    if (this.shadowGenerator) {
      this.shadowGenerator.usePercentageCloserFiltering = profile.shadowsEnabled && profile.softShadows;
      this.shadowGenerator.usePoissonSampling = profile.shadowsEnabled && !profile.softShadows;
      this.shadowGenerator.bias = profile.softShadows ? 0.0007 : 0.0012;
      this.shadowGenerator.normalBias = profile.softShadows ? 0.025 : 0.04;
      const map = this.shadowGenerator.getShadowMap();
      if (map) map.renderList = profile.shadowsEnabled ? [...this.shadowCasters] : [];
    }

    for (const mesh of this.scene.meshes) {
      if (mesh instanceof Mesh && mesh.checkCollisions) mesh.receiveShadows = profile.shadowsEnabled;
    }

    this.visualPolish.applyProfile(profile);
    setFieldFocusQuality(profile.tier, preferences.reducedMotion);
    this.npcSystem.applyQuality(profile.tier, preferences.reducedMotion);
    this.securitySystem.applyQuality(profile.tier);
    document.body.classList.toggle("reduced-motion", preferences.reducedMotion);
    this.engine.resize();
    return { ...profile };
  }

  /**
   * The intro frame. Gameplay simulation is deliberately not run: mission
   * progress, facility heat, NPC knowledge, zones and routes cannot move
   * because nothing that changes them is called.
   *
   * Input is drained every frame rather than ignored, so a tap or a hidden
   * keyboard press during the intro neither moves the player now nor leaks
   * into the first gameplay frame as a queued jump or interact.
   */
  private updateCinematicFrame(dt: number): void {
    this.input.frame();
    consumeJumpPressed();
    // Gameplay is frozen, so no distance accumulates; clearing the gait makes
    // certain the handover frame cannot fire a banked footstep.
    this.audio.resetLocomotion();

    // Resolve where gameplay would put the camera right now, so the closing
    // beat blends into the real pose instead of an approximation of it.
    this.updateThirdPersonCamera(0, true);
    this.gameplayCamPosition.copyFrom(this.camera.position);
    this.gameplayCamTarget.copyFrom(this.gameplayLookTarget);

    const active = this.cinematic.update(
      dt,
      this.gameplayCamPosition,
      this.gameplayCamTarget,
      this.cinematicPosition,
      this.cinematicTarget,
    );
    this.camera.position.copyFrom(this.cinematicPosition);
    this.camera.setTarget(this.cinematicTarget);

    if (active) return;
    // Hand the camera back with a forced settle so it lands collision-resolved,
    // and drain input once more so the handover frame starts clean.
    this.input.frame();
    consumeJumpPressed();
    this.updateThirdPersonCamera(0, true);
  }

  private update(dt: number): void {
    const frame = this.input.frame();
    this.yaw -= frame.lookX * 0.00235 * this.lookSensitivity;
    this.pitch = Math.max(
      -0.62,
      Math.min(0.48, this.pitch - applyLookY(frame.lookY, this.invertLookY) * 0.00185 * this.lookSensitivity),
    );

    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = forward.scale(frame.moveY).add(right.scale(frame.moveX));
    const strength = Math.min(1, desired.length());
    if (strength > 0.001) desired.normalize();

    // Sprinting or jumping leaves cover before that movement is applied, so the
    // player never sprints or jumps while still flagged as protected.
    const cover = getCoverState();
    if (cover.active && (isRunHeld() || isJumpQueued())) releaseCover();
    const guided = cover.active && cover.contact;
    if (guided && strength > 0.001) this.applyCoverGuidance(desired, cover);
    const speed = 4.15 * strength * (guided ? COVER_MOVE_SCALE : 1);
    const targetVelocity = desired.scale(speed);
    const accel = strength > 0.01 ? 12.5 : 21.0;
    this.velocity = Vector3.Lerp(this.velocity, targetVelocity, 1 - Math.exp(-accel * dt));
    this.player.move(this.velocity.scale(dt));

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > 0.08) {
      this.player.setFacing(Math.atan2(this.velocity.x, this.velocity.z), dt);
    } else {
      // Standing still: let the body catch up to a large camera/body yaw gap
      // instead of staying permanently side-on to the shoulder camera. Cover
      // stays authoritative, so the body is never turned into the surface.
      this.player.setIdleFacing(this.yaw, dt, !guided);
    }
    this.player.update(horizontalSpeed, dt, this.graphicsPreferences.reducedMotion, isInCover());

    // Sprint FOV follows the actual run state, not joystick magnitude. A full
    // joystick without RUN, and RUN while stationary, both stay at base FOV.
    this.running = isRunHeld()
      && !isCrouched()
      && horizontalSpeed > SPRINT_FOV_MIN_SPEED
      && !this.cinematic.isActive;
    const runningFov = this.graphicsPreferences.reducedMotion ? 69.5 : 71.2;
    const targetFov = (this.running ? runningFov : 68) * Math.PI / 180;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5.5 * dt));
    this.updateThirdPersonCamera(dt, false);

    const missionState = this.mission.snapshot().state;
    const awarenessActive = missionState === "INFILTRATE" || missionState === "EXTRACT";

    const playerPosition = this.player.position;
    // One audio update per frame: listener, distance-based gait and the slow
    // acoustic mix tick. This renders what the player hears and is completely
    // independent of the authoritative noise report on the next line.
    this.audio.update(
      dt,
      playerPosition.x,
      playerPosition.y,
      playerPosition.z,
      this.yaw,
      horizontalSpeed,
      this.running,
      this.lastSecurityState,
    );
    reportPlayerMovement(playerPosition.x, playerPosition.y, playerPosition.z, horizontalSpeed, dt);
    const zone = updateZonePresence(dt, playerPosition.x, playerPosition.y, playerPosition.z, awarenessActive);
    this.stealthSignals.update(dt, samplePlayerNoise(), zone, awarenessActive);

    updateDoors(dt);
    updateDeliveryCart(dt);
    updateFieldFocus(dt);
    this.socialCooldown = Math.max(0, this.socialCooldown - dt);

    // Sustained zone pressure is only ever a weak contributor.
    if (awarenessActive && zone.suspicion >= ZONE_PRESSURE_INCIDENT) {
      this.zoneIncidentTimer -= dt;
      if (this.zoneIncidentTimer <= 0) {
        this.zoneIncidentTimer = ZONE_PRESSURE_INCIDENT_INTERVAL;
        reportIncident("zone");
      }
    }

    const facility = updateFacilitySecurity(dt, awarenessActive);
    if (facility.state !== this.lastSecurityState) {
      const escalated = SECURITY_DOOR_STATES.includes(facility.state)
        && !SECURITY_DOOR_STATES.includes(this.lastSecurityState);
      const previousState = this.lastSecurityState;
      this.lastSecurityState = facility.state;
      // Escalation swings the controlled doors shut once. Access requirements
      // are untouched, so anything the player may open stays openable.
      if (escalated && closeSecurityDoors() > 0) {
        // Audible to the player at their own position. Deliberately NOT a
        // reportEnvironmentNoise call: automatic closure stays silent to the
        // hearing model, exactly as the door design specifies.
        publishWorldAudio("door-security-close", playerPosition.x, playerPosition.y, playerPosition.z, 0.9);
      }
      if (awarenessActive) this.publishFacilityCue(facility.state, previousState);
    }

    // Run telemetry. This update is never reached while paused or during the
    // cinematic, so neither is counted; the accumulator only touches storage on
    // its own ~5 second checkpoint.
    this.mission.recordRunTime(dt, awarenessActive, facility.state);

    const npcAwareness = this.npcSystem.update(dt, this.player.position, this.player.collider, awarenessActive);
    const cameraAwareness = this.securitySystem.update(dt, this.player.position, this.player.collider, awarenessActive);
    const strongestAwareness = cameraAwareness.meter > npcAwareness.meter ? cameraAwareness : npcAwareness;
    this.updateAwarenessHud(strongestAwareness, awarenessActive);
    this.stealthSignals.setFacility(facility.state, awarenessActive);

    // Before infiltration the control is recon, exactly as before. During
    // infiltration the same control becomes FIELD FOCUS.
    if (frame.observePressed) {
      if (awarenessActive) this.triggerFieldFocus();
      else {
        this.observation = !this.observation;
        this.analysisSeconds = 0;
        this.observedMesh = null;
        this.observationEl.classList.add("hidden");
        document.body.classList.toggle("recon-active", this.observation);
        this.input.setObservationActive(this.observation);
        if (this.observation) this.setInteractionLabel("");
      }
    }
    if (awarenessActive && this.observation) {
      this.observation = false;
      this.observedMesh = null;
      this.observationEl.classList.add("hidden");
      document.body.classList.remove("recon-active");
      this.input.setObservationActive(false);
      this.setInteractionLabel("");
    }

    if (this.observation) this.updateObservation(dt);
    else this.updateInteraction(frame.interactPressed, awarenessActive, zone.zone, facility.state);
    this.updateFieldFocusReadout(awarenessActive);
    this.publishMissionCues();
    this.updateHud();
  }

  /**
   * Steer movement along the cover surface. The tangent and normal span the
   * horizontal plane, so this only rescales the component pushing into or away
   * from the wall — the along-surface component is preserved exactly, which
   * keeps the joystick responsive instead of snapping onto a rail.
   */
  private applyCoverGuidance(desired: Vector3, cover: CoverState): void {
    const along = Vector3.Dot(desired, cover.tangent);
    const away = Vector3.Dot(desired, cover.normal);
    const outward = away >= 0
      ? away * COVER_AWAY_FROM_SURFACE_DAMPING
      : away * COVER_INTO_SURFACE_DAMPING;
    this.coverMoveScratch.copyFrom(cover.normal).scaleInPlace(outward);
    desired.copyFrom(cover.tangent).scaleInPlace(along).addInPlace(this.coverMoveScratch);
    if (desired.lengthSquared() > 0.000001) desired.normalize();
  }

  private updateThirdPersonCamera(dt: number, force: boolean): void {
    const target = this.player.cameraTarget.getAbsolutePosition();
    const cosPitch = Math.cos(this.pitch);
    const lookDirection = new Vector3(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch,
    ).normalize();
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const cover = getCoverState();
    const inCover = cover.active && cover.contact;
    const reduced = this.graphicsPreferences.reducedMotion;
    if (inCover) {
      // The cover normal points into open space, so the shoulder that agrees
      // with it is the side that is not buried in the surface.
      const bias = Vector3.Dot(right, cover.normal);
      if (Math.abs(bias) > SHOULDER_FLIP_DEADZONE) this.shoulderSide = bias >= 0 ? 1 : -1;
    } else {
      this.shoulderSide = 1;
    }

    const step = Math.max(0, dt);
    const shoulderRate = reduced ? SHOULDER_SMOOTHING_REDUCED : SHOULDER_SMOOTHING;
    const coverRate = reduced ? COVER_CAMERA_SMOOTHING_REDUCED : COVER_CAMERA_SMOOTHING;
    const coverTarget = inCover ? 1 : 0;
    if (force) {
      this.shoulderBlend = this.shoulderSide;
      this.coverCameraBlend = coverTarget;
    } else {
      this.shoulderBlend += (this.shoulderSide - this.shoulderBlend) * (1 - Math.exp(-shoulderRate * step));
      this.coverCameraBlend += (coverTarget - this.coverCameraBlend) * (1 - Math.exp(-coverRate * step));
    }

    const pullIn = COVER_CAMERA_PULL_IN * (reduced ? REDUCED_MOTION_CAMERA_SCALE : 1);
    const distance = this.cameraDistance - this.coverCameraBlend * pullIn;
    const desired = target
      .subtract(lookDirection.scale(distance))
      .add(right.scale(this.shoulderOffset * this.shoulderBlend));
    const collision = resolveThirdPersonCameraCollision(
      this.scene,
      target,
      desired,
      right,
      this.player.collider,
    );

    if (force || collision.blocked || dt <= 0) this.camera.position.copyFrom(collision.position);
    else this.camera.position.copyFrom(Vector3.Lerp(this.camera.position, collision.position, 1 - Math.exp(-14 * dt)));
    // Kept so the cinematic can blend into the exact pose gameplay resolved,
    // rather than recomputing this math in a second place.
    this.gameplayLookTarget.copyFrom(target).addInPlace(lookDirection.scale(7));
    this.camera.setTarget(this.gameplayLookTarget);
  }

  private updateObservation(dt: number): void {
    const ray = new Ray(this.camera.position, this.camera.getForwardRay().direction, 18);
    const hit = this.scene.pickWithRay(ray, (mesh) => Boolean((mesh.metadata as GameMetadata | null)?.intelId));
    const mesh = hit?.hit && hit.pickedMesh instanceof Mesh ? hit.pickedMesh : null;
    if (!mesh) {
      this.observedMesh = null;
      this.analysisSeconds = Math.max(0, this.analysisSeconds - dt * 2.2);
      this.observationEl.classList.add("hidden");
      return;
    }
    this.observationEl.classList.remove("hidden");
    if (mesh !== this.observedMesh) {
      this.observedMesh = mesh;
      this.analysisSeconds = 0;
    }
    const meta = mesh.metadata as GameMetadata;
    if (this.mission.hasIntel(meta.intelId ?? "")) {
      this.observationEl.textContent = `TANIMLANDI · ${meta.label ?? "INTEL"}`;
      return;
    }
    this.analysisSeconds += dt;
    const progress = Math.min(100, Math.round((this.analysisSeconds / 0.7) * 100));
    this.observationEl.textContent = `ANALİZ ${progress}% · ${meta.label ?? "INTEL"}`;
    if (this.analysisSeconds >= 0.7 && meta.intelId) {
      this.mission.discoverIntel(meta.intelId);
      this.observationEl.textContent = `TANIMLANDI · ${meta.label ?? "INTEL"}`;
    }
  }

  private updateInteraction(
    interactPressed: boolean,
    awarenessActive: boolean,
    zone: ZoneId,
    facilityState: FacilityState,
  ): void {
    const origin = this.player.cameraTarget.getAbsolutePosition();
    const ray = new Ray(origin, this.camera.getForwardRay().direction, 4.2);
    const hit = this.scene.pickWithRay(ray, (mesh) => Boolean((mesh.metadata as GameMetadata | null)?.interaction));
    const mesh = hit?.hit && hit.pickedMesh instanceof Mesh ? hit.pickedMesh : null;
    if (!mesh) {
      // Nothing physical is targeted, so the contextual social opportunity may
      // claim the prompt. World interactables always outrank it.
      this.updateSocialPrompt(interactPressed, awarenessActive, zone, facilityState);
      return;
    }
    const meta = mesh.metadata as GameMetadata;

    // Doors resolve through this same ray, so there is one owner and the
    // nearest interactable always wins. Staged operation terminals keep their
    // existing higher priority because they publish after this pass.
    if (meta.interaction === "door" && meta.doorId) {
      this.setInteractionLabel(doorPromptLabel(meta.doorId));
      if (!interactPressed) return;
      const result = tryUseDoor(meta.doorId);
      showDoorStatus(result.message);
      // Gameplay noise and presentation audio are reported separately and from
      // different fields: a refused door is audible to the player but is not a
      // noise event, so it never reaches the hearing model.
      if (result.noiseAt) {
        const at = result.noiseAt;
        reportEnvironmentNoise(at.x, at.y, at.z, DOOR_NOISE_LOUDNESS);
      }
      if (result.audioCue && result.audioAt) {
        const at = result.audioAt;
        publishWorldAudio(result.audioCue, at.x, at.y, at.z, 1);
      }
      if (result.changed) hapticTap();
      return;
    }

    const state = this.mission.snapshot();
    this.setInteractionLabel(this.labelFor(meta, state.state));
    if (!interactPressed) return;

    if (meta.interaction === "route-main") this.mission.chooseRoute("main");
    if (meta.interaction === "route-side") this.mission.chooseRoute("side");
    if (meta.interaction === "extract") this.mission.extract();

    // One stage resolution per interactable. The director rejects the call
    // outright when the stage is already resolved, which is what stops an
    // alternate solution completing a stage its sibling already finished.
    const resolution = RESOLUTION_INTERACTIONS[meta.interaction ?? ""];
    if (resolution && this.mission.resolveStage(resolution)) {
      hapticConfirm();
      return;
    }

    const objective = OBJECTIVE_INTERACTIONS[meta.interaction ?? ""];
    if (objective && this.mission.completeOptionalObjective(objective)) {
      showDoorStatus(objective === "shift_pattern" ? "VARDİYA ÇİZELGESİ ALINDI" : "İKİNCİL ARŞİV ALINDI", 2.2);
      hapticConfirm();
      return;
    }

    if (meta.interaction === "delivery-cart") this.pushCart();
    if (meta.interaction === "camera-bypass") {
      const active = state.state === "INFILTRATE" || state.state === "EXTRACT";
      if (
        this.securitySystem.canBypass(this.mission.hasIntel("market_camera"), active)
        && this.mission.useOpportunity("camera_bypass")
      ) {
        this.securitySystem.bypass();
      }
    }
  }

  /** Prompt text for a targeted interactable, including why it is unavailable. */
  private labelFor(meta: GameMetadata, missionState: string): string {
    if (meta.interaction === "extract") return "BÖLGEDEN AYRIL";
    if (meta.interaction === "route-side") return "YAN YAKLAŞIMI SEÇ";
    if (meta.interaction === "route-main") return "ANA YAKLAŞIMI SEÇ";

    const resolution = RESOLUTION_INTERACTIONS[meta.interaction ?? ""];
    if (resolution) return this.resolutionLabel(resolution, meta);

    const objective = OBJECTIVE_INTERACTIONS[meta.interaction ?? ""];
    if (objective) {
      return this.mission.hasObjective(objective) ? "KAYIT ALINDI" : meta.label ?? "ETKİLEŞ";
    }

    if (meta.interaction === "delivery-cart") {
      if (!this.mission.hasIntel("market_worker_route")) return "ÇALIŞAN ROTASI BİLİNMİYOR";
      return "SEVKİYAT ARABASINI İT";
    }

    if (meta.interaction === "camera-bypass") {
      if (this.mission.hasOpportunity("camera_bypass")) return "CCTV DEVRE DIŞI";
      if (!this.mission.hasIntel("market_camera")) return "ÖNCE CCTV'Yİ RECON İLE TANIMLA";
      if (missionState !== "INFILTRATE" && missionState !== "EXTRACT") return "CCTV FIRSATI HAZIR";
      return "CCTV BESLEMESİNİ DEVRE DIŞI BIRAK";
    }
    return meta.label ?? "ETKİLEŞ";
  }

  /**
   * Explains an alternate solution rather than silently doing nothing: already
   * solved, missing intel, or out of order all read differently.
   */
  private resolutionLabel(resolution: MissionResolutionId, meta: GameMetadata): string {
    const stage = getResolution(resolution).stage;
    if (this.mission.isStageResolved(stage)) return "BU AŞAMA TAMAMLANDI";
    if (this.mission.canResolve(resolution)) {
      return meta.interaction === "objective" ? "TESLİMAT KAYDINI DOĞRULA" : meta.label ?? "ETKİLEŞ";
    }
    const required = getResolution(resolution).requiresIntel;
    if (required && !this.mission.hasIntel(required)) {
      return required === "market_camera" ? "ÖNCE CCTV'Yİ RECON İLE TANIMLA" : "ÖNCE ÇALIŞAN ROTASINI ÖĞREN";
    }
    return "ÖNCEKİ AŞAMA TAMAMLANMADI";
  }

  /** Pushes the cart to its next authored stop and makes the move audible. */
  private pushCart(): void {
    if (!this.mission.canUseOpportunity("delivery_cart") && !this.mission.hasOpportunity("delivery_cart")) return;
    const at = pushDeliveryCart();
    if (!at) return;
    this.mission.useOpportunity("delivery_cart");
    reportEnvironmentNoise(at.x, at.y, at.z, CART_NOISE_LOUDNESS);
    hapticTap();
  }

  /**
   * COVER STORY. Every condition must hold: an infiltration in progress, a
   * STAFF area (never RESTRICTED), a valid credential, a calm facility, a
   * relaxed stance, quiet movement, an off-cooldown check, and a nearby guard
   * who can see the player and is unsettled but not committed.
   */
  private updateSocialPrompt(
    interactPressed: boolean,
    awarenessActive: boolean,
    zone: ZoneId,
    facilityState: FacilityState,
  ): void {
    if (!awarenessActive || zone !== "STAFF" || facilityState === "HIGH_ALERT") {
      this.setInteractionLabel("");
      return;
    }
    // The routine window is earned knowledge, so it outranks the bluff in the
    // same contextual slot while it is still unused.
    if (this.updateRoutineWindowPrompt(interactPressed)) return;
    if (this.socialCooldown > 0 || !hasStaffCredential()) {
      this.setInteractionLabel("");
      return;
    }
    if (isCrouched() || isInCover() || isRunHeld()) {
      this.setInteractionLabel("");
      return;
    }
    if (samplePlayerNoise().loudness > SOCIAL_MAX_NOISE) {
      this.setInteractionLabel("");
      return;
    }

    const target = this.npcSystem.socialCheckTarget(this.player.position);
    if (!target) {
      this.setInteractionLabel("");
      return;
    }

    this.setInteractionLabel(SOCIAL_LABEL);
    if (!interactPressed) return;

    if (!this.npcSystem.resolveSocialCheck(target.index)) return;
    relaxZoneSuspicion(SOCIAL_ZONE_RELIEF);
    relaxFacilityHeat(SOCIAL_FACILITY_RELIEF);
    this.socialCooldown = SOCIAL_COOLDOWN;
    this.setInteractionLabel("");
    hapticConfirm();
  }

  /**
   * STAFF ROUTINE WINDOW. Unlocked by the shift-pattern objective, used once,
   * and deliberately narrow: it sends one worker off on an authored task and
   * changes nothing about facility heat or what security knows.
   */
  private updateRoutineWindowPrompt(interactPressed: boolean): boolean {
    if (!this.mission.canUseOpportunity("staff_routine_window")) return false;
    this.setInteractionLabel("PERSONEL RUTİN ARALIĞINI KULLAN");
    if (!interactPressed) return true;
    if (!this.npcSystem.openStaffRoutineWindow(STAFF_ROUTINE_WINDOW_SECONDS)) return true;
    this.mission.useOpportunity("staff_routine_window");
    this.setInteractionLabel("");
    hapticConfirm();
    return true;
  }

  /**
   * Collects only information the player has already earned, then starts a
   * focus window. NPCs are never candidates, so this cannot become a wallhack.
   */
  private triggerFieldFocus(): void {
    const state = this.mission.snapshot();
    const targets = this.focusTargets;
    targets.length = 0;
    const player = this.player.position;

    const objectiveName = state.state === "EXTRACT"
      ? "extraction"
      : state.operationStep === "ACCESS"
        ? "operation-access-terminal"
        : state.operationStep === "MANIFEST"
          ? "operation-manifest-terminal"
          : "dispatch-record";
    this.pushFocusTarget(objectiveName, "objective", Infinity);

    // Known physical access points near the player.
    for (const mesh of this.scene.meshes) {
      if (targets.length >= 8) break;
      const meta = mesh.metadata as GameMetadata | null;
      if (meta?.interaction !== "door" || !(mesh instanceof Mesh)) continue;
      this.pushFocusMesh(mesh, "access", FOCUS_RADIUS, player);
    }

    // Intel the player actually discovered, plus the CCTV opportunity.
    for (const mesh of this.scene.meshes) {
      if (targets.length >= 8) break;
      const meta = mesh.metadata as GameMetadata | null;
      if (!meta?.intelId || !this.mission.hasIntel(meta.intelId)) continue;
      if (!(mesh instanceof Mesh)) continue;
      this.pushFocusMesh(mesh, "intel", FOCUS_RADIUS, player);
    }
    if (this.mission.hasIntel("market_camera") && !this.mission.hasOpportunity("camera_bypass")) {
      this.pushFocusMesh(this.securitySystem.bypassPanel, "intel", Infinity, player);
    }

    this.pushEarnedSolutions();

    // Abstract last-known incident context, never the player's live position.
    if (readSearchAnchor(this.anchorScratch)) {
      targets.push({ x: this.anchorScratch.x, y: this.anchorScratch.y, z: this.anchorScratch.z, kind: "incident" });
    }

    if (!activateFieldFocus(this.scene, targets)) return;
    hapticTap();
  }

  /**
   * Marks alternate solutions and opportunities the player has actually earned
   * and not yet spent. Nothing unknown is ever revealed: each entry is gated on
   * the same director check that would let the player use it.
   */
  private pushEarnedSolutions(): void {
    const player = this.player.position;
    if (this.mission.canResolve("manifest_ledger")) {
      this.pushFocusTarget("manifest-ledger", "objective", Infinity);
    }
    if (this.mission.canResolve("verify_monitoring")) {
      this.pushFocusTarget("verify-monitoring", "objective", Infinity);
    }
    if (this.mission.canCompleteObjective("secondary_records")) {
      this.pushFocusTarget("objective-secondary-records", "intel", FOCUS_RADIUS);
    }
    if (this.mission.canCompleteObjective("shift_pattern")) {
      this.pushFocusTarget("objective-shift-pattern", "intel", FOCUS_RADIUS);
    }
    if (this.mission.canUseOpportunity("delivery_cart")) {
      const at = cartPosition();
      if (at && Vector3.Distance(new Vector3(at.x, at.y, at.z), player) <= FOCUS_RADIUS) {
        this.focusTargets.push({ x: at.x, y: at.y, z: at.z, kind: "access" });
      }
    }
  }

  private pushFocusTarget(meshName: string, kind: FieldFocusTarget["kind"], radius: number): void {
    const mesh = this.scene.getMeshByName(meshName);
    if (mesh instanceof Mesh) this.pushFocusMesh(mesh, kind, radius, this.player.position);
  }

  private pushFocusMesh(mesh: Mesh, kind: FieldFocusTarget["kind"], radius: number, player: Vector3): void {
    if (!mesh.isEnabled()) return;
    const position = mesh.getAbsolutePosition();
    if (radius !== Infinity && Vector3.Distance(position, player) > radius) return;
    this.focusTargets.push({ x: position.x, y: position.y, z: position.z, kind });
  }

  /** Reuses the recon readout line; writes only when the text changes. */
  private updateFieldFocusReadout(awarenessActive: boolean): void {
    if (!awarenessActive) return;
    const label = isFieldFocusActive() ? "SAHA ODAĞI" : "";
    if (label === this.focusLabel) return;
    this.focusLabel = label;
    if (!label) {
      this.observationEl.classList.add("hidden");
      return;
    }
    this.observationEl.textContent = label;
    this.observationEl.classList.remove("hidden");
  }

  /** Writes the prompt only when the text actually changes. */
  private setInteractionLabel(label: string): void {
    if (label === this.interactionLabel) return;
    this.interactionLabel = label;
    this.input.setInteractionAvailable(Boolean(label));
    if (!label) {
      this.interactionEl.classList.add("hidden");
      return;
    }
    this.interactionEl.textContent = label;
    this.interactionEl.classList.remove("hidden");
  }

  private updateAwarenessHud(snapshot: AwarenessSnapshot, active: boolean): void {
    if (!active || snapshot.meter < 0.04) {
      this.awarenessEl.classList.add("hidden");
      return;
    }
    this.awarenessEl.classList.remove("hidden");
    this.awarenessEl.dataset.state = snapshot.state;
    const source = snapshot.label === "CCTV" ? "CCTV · " : "";
    this.awarenessLabelEl.textContent = `${source}${snapshot.state === "NORMAL" ? "GÖRÜNMEZ" : snapshot.state === "CURIOUS" ? "MERAK" : snapshot.state === "SUSPICIOUS" ? "ŞÜPHE" : "ALARM"}`;
    this.awarenessFillEl.style.width = `${Math.round(snapshot.meter * 100)}%`;
  }

  /**
   * One cue per genuine escalation. De-escalation is deliberately silent: the
   * facility calming down is not something the player needs shouting about.
   */
  private publishFacilityCue(state: FacilityState, previous: FacilityState): void {
    const rank = (value: FacilityState): number =>
      value === "HIGH_ALERT" ? 3 : value === "SEARCH" ? 2 : value === "WATCH" ? 1 : 0;
    if (rank(state) <= rank(previous)) return;
    if (state === "WATCH") publishPresentation("FACILITY_WATCH", "İZLEME", "TESİS DİKKAT KESİLDİ");
    else if (state === "SEARCH") publishPresentation("FACILITY_SEARCH", "ARAMA", "GÜVENLİK BÖLGEYİ TARIYOR");
    else if (state === "HIGH_ALERT") publishPresentation("FACILITY_HIGH_ALERT", "YÜKSEK ALARM", "KONUMUN AÇIĞA ÇIKTI");
  }

  /**
   * Watches the mission snapshot for the transitions worth announcing and
   * publishes at most one typed cue for each. Comparing against the previous
   * snapshot is what makes every cue single-fire.
   */
  private publishMissionCues(): void {
    const state = this.mission.snapshot();

    if (state.objective !== this.lastObjective) {
      const hadPrevious = this.lastObjective !== "";
      this.lastObjective = state.objective;
      if (hadPrevious) publishPresentation("MISSION_OBJECTIVE", "YENİ HEDEF", state.objective);
    }
    if (state.intelFound > this.lastIntelCount) {
      this.lastIntelCount = state.intelFound;
      publishPresentation("INTEL_DISCOVERED", "INTEL GÜNCELLENDİ", `${state.intelFound}/${state.intelTotal} INTEL`);
    } else {
      this.lastIntelCount = state.intelFound;
    }
    if (state.operationStep !== this.lastOperationStep) {
      const advanced = this.lastOperationStep !== "";
      this.lastOperationStep = state.operationStep;
      if (advanced && state.operationStep) {
        publishPresentation("STAGE_RESOLVED", "AŞAMA TAMAMLANDI", this.stageLabel(state.operationStep));
      }
    }
    if (state.objectivesCompleted > this.lastObjectivesCompleted) {
      this.lastObjectivesCompleted = state.objectivesCompleted;
      publishPresentation(
        "OPTIONAL_COMPLETED",
        "EK HEDEF",
        `${state.objectivesCompleted}/${state.objectivesTotal} TAMAMLANDI`,
      );
    } else {
      this.lastObjectivesCompleted = state.objectivesCompleted;
    }
    if (state.opportunitiesUsed > this.lastOpportunitiesUsed) {
      this.lastOpportunitiesUsed = state.opportunitiesUsed;
      publishPresentation("OPPORTUNITY_USED", "FIRSAT KULLANILDI", "TAKTİK AVANTAJ AKTİF");
    } else {
      this.lastOpportunitiesUsed = state.opportunitiesUsed;
    }
  }

  private stageLabel(step: string): string {
    if (step === "MANIFEST") return "ERİŞİM SAĞLANDI";
    if (step === "VERIFY") return "MANİFEST EŞLEŞTİ";
    if (step === "DONE") return "DOĞRULAMA TAMAM";
    return "OPERASYON İLERLEDİ";
  }

  private updateHud(): void {
    const state = this.mission.snapshot();
    this.objectiveEl.textContent = state.objective;
    const result = state.state === "COMPLETE" ? ` · ${state.rank} · SKOR ${state.score}` : "";
    const optional = state.objectivesCompleted > 0 ? ` · EK ${state.objectivesCompleted}/${state.objectivesTotal}` : "";
    this.intelEl.textContent = `INTEL ${state.intelFound}/${state.intelTotal}${optional} · ${state.state}${result}`;
  }

  private buildWorld(): void {
    this.buildSky();

    const hemi = new HemisphericLight("sky-light", new Vector3(0.12, 1, 0.08), this.scene);
    hemi.intensity = 0.72;
    hemi.diffuse = new Color3(0.86, 0.91, 1.0);
    hemi.groundColor = new Color3(0.18, 0.15, 0.12);

    const sun = new DirectionalLight("sun", new Vector3(-0.42, -0.86, 0.34), this.scene);
    sun.position = new Vector3(22, 31, -20);
    sun.intensity = 2.15;
    sun.diffuse = new Color3(1.0, 0.88, 0.72);
    this.shadowGenerator = new ShadowGenerator(1024, sun);

    const asphalt = this.material("asphalt", new Color3(0.085, 0.098, 0.108), 0.97, 0.0);
    const concrete = this.material("sidewalk", new Color3(0.38, 0.39, 0.37), 0.91, 0.0);
    const interiorFloor = this.material("interior-floor", new Color3(0.34, 0.285, 0.22), 0.76, 0.02);
    const plaster = this.material("warm-plaster", new Color3(0.66, 0.6, 0.49), 0.91, 0.0);
    const trim = this.material("trim", new Color3(0.09, 0.105, 0.12), 0.58, 0.28);
    const metal = this.material("metal", new Color3(0.075, 0.09, 0.105), 0.32, 0.74);
    const wood = this.material("wood", new Color3(0.35, 0.19, 0.085), 0.67, 0.03);
    const accent = this.material("accent", new Color3(0.58, 0.39, 0.16), 0.58, 0.06);
    const green = this.material("plant", new Color3(0.075, 0.21, 0.095), 0.92, 0.0);
    const lane = this.material("lane", new Color3(0.82, 0.78, 0.67), 0.82, 0.0);
    const darkPlaster = this.material("city-plaster", new Color3(0.2, 0.22, 0.24), 0.9, 0.0);
    const glass = this.material("glass", new Color3(0.12, 0.22, 0.29), 0.14, 0.12);
    glass.alpha = 0.3;
    glass.transparencyMode = Material.MATERIAL_ALPHABLEND;
    glass.environmentIntensity = 0.82;

    const ground = MeshBuilder.CreateGround("world-ground", { width: 90, height: 110 }, this.scene);
    ground.position.z = 10;
    ground.material = asphalt;
    ground.checkCollisions = true;
    ground.receiveShadows = true;

    const plaza = this.box("market-plaza", new Vector3(0, 0.045, 3.5), new Vector3(22, 0.09, 22), concrete, true);
    plaza.receiveShadows = true;
    const road = this.box("street", new Vector3(0, 0.07, -19), new Vector3(38, 0.12, 18), asphalt, true);
    road.receiveShadows = true;
    this.box("curb-left", new Vector3(-10.9, 0.15, -3), new Vector3(0.24, 0.3, 22), concrete, true);
    this.box("curb-right", new Vector3(10.9, 0.15, -3), new Vector3(0.24, 0.3, 22), concrete, true);

    for (let z = -27; z <= -11; z += 4) {
      this.box(`road-mark-${z}`, new Vector3(0, 0.145, z), new Vector3(0.16, 0.018, 2.1), lane, false);
    }
    for (const x of [-2.7, 0, 2.7]) {
      this.box(`crosswalk-${x}`, new Vector3(x, 0.148, -10.6), new Vector3(1.7, 0.018, 0.34), lane, false);
    }

    for (const [x, z, width, height] of [
      [-16, 5, 8, 8], [16, 7, 9, 10], [-17, -15, 8, 7], [17, -17, 9, 9], [-15, 25, 10, 12], [15, 27, 8, 8],
    ] as const) {
      const block = this.box(`city-block-${x}-${z}`, new Vector3(x, height / 2, z), new Vector3(width, height, 8), darkPlaster, true);
      this.addShadowCaster(block);
      for (let level = 1.5; level < height - 0.7; level += 2) {
        const windows = this.box(`city-window-${x}-${z}-${level}`, new Vector3(x > 0 ? x - width / 2 - 0.04 : x + width / 2 + 0.04, level, z), new Vector3(0.07, 0.7, 4.8), glass, false);
        windows.isPickable = false;
      }
    }

    const floor = this.box("market-floor", new Vector3(0, 0.1, 8.1), new Vector3(14.4, 0.18, 11.6), interiorFloor, true);
    floor.receiveShadows = true;
    this.box("market-back", new Vector3(0, 2.1, 14), new Vector3(15, 4.2, 0.45), plaster, true);
    this.box("market-left", new Vector3(-7.25, 2.1, 8), new Vector3(0.45, 4.2, 12), plaster, true);
    this.box("market-right", new Vector3(7.25, 2.1, 8), new Vector3(0.45, 4.2, 12), plaster, true);
    this.box("front-a", new Vector3(-4.9, 2.1, 2), new Vector3(4.7, 4.2, 0.45), plaster, true);
    this.box("front-b", new Vector3(4.9, 2.1, 2), new Vector3(4.7, 4.2, 0.45), plaster, true);

    this.box("facade-trim-top", new Vector3(0, 4.05, 2.05), new Vector3(15.2, 0.28, 0.62), trim, false);
    this.box("entry-frame-left", new Vector3(-2.55, 2.05, 2), new Vector3(0.18, 4.1, 0.64), trim, false);
    this.box("entry-frame-right", new Vector3(2.55, 2.05, 2), new Vector3(0.18, 4.1, 0.64), trim, false);
    this.box("entry-frame-top", new Vector3(0, 3.96, 2), new Vector3(5.25, 0.18, 0.64), trim, false);
    this.box("glass-left", new Vector3(-1.3, 2.05, 2.05), new Vector3(2.25, 3.62, 0.09), glass, false);
    this.box("glass-right", new Vector3(1.3, 2.05, 2.05), new Vector3(2.25, 3.62, 0.09), glass, false);
    this.box("canopy", new Vector3(0, 3.55, 1.25), new Vector3(7.2, 0.18, 1.35), trim, false);
    this.box("market-sign", new Vector3(0, 3.55, 1.05), new Vector3(4.4, 0.62, 0.12), accent, false);

    for (const x of [-5.4, -3.9, 3.9, 5.4]) {
      this.box(`window-${x}`, new Vector3(x, 2.15, 1.76), new Vector3(1.18, 2.45, 0.08), glass, false);
      this.box(`window-sill-${x}`, new Vector3(x, 0.88, 1.65), new Vector3(1.35, 0.12, 0.32), trim, false);
    }

    const front = this.box("front-route", new Vector3(0, 1.35, 2.2), new Vector3(3.8, 2.7, 0.08), accent, false);
    front.visibility = 0.02;
    front.metadata = { intelId: "market_front_access", label: "ANA GİRİŞ", interaction: "route-main" } satisfies GameMetadata;

    const side = this.box("side-route", new Vector3(7.02, 1.35, 10.2), new Vector3(0.08, 2.7, 2.5), accent, false);
    side.visibility = 0.02;
    side.metadata = { intelId: "market_side_access", label: "TESLİMAT GİRİŞİ", interaction: "route-side" } satisfies GameMetadata;
    this.box("side-door-frame", new Vector3(7.01, 1.55, 10.2), new Vector3(0.22, 3.1, 2.75), trim, false);
    this.box("side-door", new Vector3(6.92, 1.52, 10.2), new Vector3(0.12, 2.85, 2.25), metal, false);

    const desk = this.box("dispatch-desk", new Vector3(1.4, 0.62, 11.2), new Vector3(3.1, 1.18, 1.1), wood, true);
    this.addShadowCaster(desk);
    this.box("desk-top", new Vector3(1.4, 1.24, 11.2), new Vector3(3.28, 0.12, 1.2), trim, false);
    const record = this.box("dispatch-record", new Vector3(1.4, 1.34, 11.2), new Vector3(0.65, 0.07, 0.45), accent, false);
    record.metadata = { label: "TESLİMAT KAYDI", interaction: "objective" } satisfies GameMetadata;

    for (const x of [-3.9, 0, 3.9]) {
      for (const z of [6.2, 8.5]) {
        this.box(`shelf-${x}-${z}`, new Vector3(x, 1.05, z), new Vector3(2.15, 2.05, 0.5), trim, true);
        this.box(`stock-${x}-${z}`, new Vector3(x, 1.4, z), new Vector3(1.72, 0.48, 0.62), accent, false);
      }
    }

    const cctv = MeshBuilder.CreateCylinder("fictional-camera", { height: 0.55, diameter: 0.22 }, this.scene);
    cctv.position = new Vector3(-3.5, 3.25, 2.4);
    cctv.rotation.z = Math.PI / 2;
    cctv.material = metal;
    cctv.metadata = { intelId: "market_camera", label: "GÜVENLİK KAMERASI" } satisfies GameMetadata;
    this.addShadowCaster(cctv);

    const workerMarker = this.box("worker-route-intel", new Vector3(-2.8, 1.1, 8.2), new Vector3(0.3, 2.1, 0.3), metal, false);
    workerMarker.visibility = 0.02;
    workerMarker.metadata = { intelId: "market_worker_route", label: "ÇALIŞAN RUTİNİ" } satisfies GameMetadata;

    for (const x of [-8.5, 8.5]) {
      const planter = this.box(`planter-${x}`, new Vector3(x, 0.38, -0.5), new Vector3(1.35, 0.72, 1.35), concrete, true);
      this.addShadowCaster(planter);
      const plant = MeshBuilder.CreateSphere(`plant-${x}`, { diameter: 1.35, segments: 8 }, this.scene);
      plant.position = new Vector3(x, 1.25, -0.5);
      plant.scaling.y = 1.35;
      plant.material = green;
      this.addShadowCaster(plant);
    }

    const extraction = this.box("extraction", new Vector3(0, 1, -12), new Vector3(5, 2, 0.12), accent, false);
    extraction.visibility = 0.015;
    extraction.metadata = { label: "EXTRACTION", interaction: "extract" } satisfies GameMetadata;

    // Alternate stage solutions, optional objectives and the delivery cart.
    // They carry ordinary interaction metadata, so the resolver above owns them
    // exactly like doors and terminals.
    const missionObjects = buildMissionObjects(this.scene);
    registerDeliveryCart(missionObjects.cart);
    this.addShadowCaster(missionObjects.cart);
  }

  private buildSky(): void {
    const sky = MeshBuilder.CreateSphere("sky-dome", { diameter: 220, segments: 16 }, this.scene);
    const skyMaterial = new StandardMaterial("sky-material", this.scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;
    skyMaterial.emissiveColor = new Color3(0.31, 0.42, 0.55);
    sky.material = skyMaterial;
    sky.isPickable = false;
    sky.infiniteDistance = true;
  }

  private addShadowCaster(mesh: Mesh): void {
    this.shadowCasters.push(mesh);
    if (this.activeProfile.shadowsEnabled) this.shadowGenerator?.addShadowCaster(mesh);
  }

  private box(name: string, position: Vector3, size: Vector3, material: PBRMaterial, collision: boolean): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.checkCollisions = collision;
    mesh.receiveShadows = collision && this.activeProfile.shadowsEnabled;
    return mesh;
  }

  private material(name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = 0.68;
    return material;
  }
}
