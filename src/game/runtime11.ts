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
import { PlayerCharacter } from "./character";
import { MobileInput } from "./input";
import { MissionDirector } from "./mission";
import { NpcSystem, type AwarenessSnapshot } from "./npc";
import { SecurityCameraSystem } from "./security";
import { VisualPolish } from "./visuals";
import {
  type GraphicsPreferences,
  type ResolvedGraphicsProfile,
  loadGraphicsPreferences,
  resolveGraphicsProfile,
} from "./graphics";

type GameMetadata = {
  intelId?: string;
  label?: string;
  interaction?: "route-main" | "route-side" | "objective" | "extract" | "camera-bypass";
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
    this.npcSystem = new NpcSystem(
      this.scene,
      () => this.mission.reportAlert(),
      (mesh) => this.addShadowCaster(mesh),
    );
    this.securitySystem = new SecurityCameraSystem(this.scene, () => this.mission.reportAlert());
    this.securitySystem.bypassPanel.metadata = {
      label: "CCTV KONTROL PANELİ",
      interaction: "camera-bypass",
    } satisfies GameMetadata;
    this.updateThirdPersonCamera(0, true);
    this.applyGraphicsPreferences(this.graphicsPreferences);
    this.mission.acknowledgeBriefing();
    this.updateHud();
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
      if (!this.paused) this.update(dt);
      this.scene.render();
    });
    window.addEventListener("resize", () => this.engine.resize());
    window.addEventListener("orientationchange", () => window.setTimeout(() => this.engine.resize(), 120));
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.audio.setPaused(paused);
    if (paused) {
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
    this.npcSystem.applyQuality(profile.tier);
    this.securitySystem.applyQuality(profile.tier);
    document.body.classList.toggle("reduced-motion", preferences.reducedMotion);
    this.engine.resize();
    return { ...profile };
  }

  private update(dt: number): void {
    const frame = this.input.frame();
    this.yaw -= frame.lookX * 0.00235 * this.lookSensitivity;
    this.pitch = Math.max(-0.62, Math.min(0.48, this.pitch - frame.lookY * 0.00185 * this.lookSensitivity));

    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = forward.scale(frame.moveY).add(right.scale(frame.moveX));
    const strength = Math.min(1, desired.length());
    if (strength > 0.001) desired.normalize();
    const speed = 4.15 * strength;
    const targetVelocity = desired.scale(speed);
    const accel = strength > 0.01 ? 12.5 : 21.0;
    this.velocity = Vector3.Lerp(this.velocity, targetVelocity, 1 - Math.exp(-accel * dt));
    this.player.move(this.velocity.scale(dt));

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > 0.08) this.player.setFacing(Math.atan2(this.velocity.x, this.velocity.z), dt);
    this.player.update(horizontalSpeed, dt, this.graphicsPreferences.reducedMotion);
    this.audio.updateFootsteps(horizontalSpeed, dt);

    this.running = strength > 0.86;
    const runningFov = this.graphicsPreferences.reducedMotion ? 69.5 : 71.2;
    const targetFov = (this.running ? runningFov : 68) * Math.PI / 180;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5.5 * dt));
    this.updateThirdPersonCamera(dt, false);

    const missionState = this.mission.snapshot().state;
    const awarenessActive = missionState === "INFILTRATE" || missionState === "EXTRACT";
    const npcAwareness = this.npcSystem.update(dt, this.player.position, this.player.collider, awarenessActive);
    const cameraAwareness = this.securitySystem.update(dt, this.player.position, this.player.collider, awarenessActive);
    const strongestAwareness = cameraAwareness.meter > npcAwareness.meter ? cameraAwareness : npcAwareness;
    this.updateAwarenessHud(strongestAwareness, awarenessActive);

    if (frame.observePressed) {
      this.observation = !this.observation;
      this.analysisSeconds = 0;
      this.observedMesh = null;
      this.observationEl.classList.add("hidden");
      document.body.classList.toggle("recon-active", this.observation);
    }

    if (this.observation) this.updateObservation(dt);
    else this.updateInteraction(frame.interactPressed);
    this.updateHud();
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
    const desired = target.subtract(lookDirection.scale(this.cameraDistance)).add(right.scale(this.shoulderOffset));
    const cameraPath = desired.subtract(target);
    const distance = cameraPath.length();
    const direction = distance > 0.001 ? cameraPath.scale(1 / distance) : new Vector3(0, 0, -1);
    const hit = this.scene.pickWithRay(
      new Ray(target, direction, distance),
      (mesh) => mesh instanceof Mesh && mesh.checkCollisions && mesh !== this.player.collider,
    );

    let resolved = desired;
    let blocked = false;
    if (hit?.hit && typeof hit.distance === "number") {
      const safeDistance = Math.max(0.68, hit.distance - 0.24);
      resolved = target.add(direction.scale(safeDistance));
      blocked = safeDistance < distance - 0.08;
    }

    if (force || blocked || dt <= 0) this.camera.position.copyFrom(resolved);
    else this.camera.position.copyFrom(Vector3.Lerp(this.camera.position, resolved, 1 - Math.exp(-14 * dt)));
    this.camera.setTarget(target.add(lookDirection.scale(7)));
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

  private updateInteraction(interactPressed: boolean): void {
    const origin = this.player.cameraTarget.getAbsolutePosition();
    const ray = new Ray(origin, this.camera.getForwardRay().direction, 4.2);
    const hit = this.scene.pickWithRay(ray, (mesh) => Boolean((mesh.metadata as GameMetadata | null)?.interaction));
    const mesh = hit?.hit && hit.pickedMesh instanceof Mesh ? hit.pickedMesh : null;
    if (!mesh) {
      this.interactionEl.classList.add("hidden");
      return;
    }
    const meta = mesh.metadata as GameMetadata;
    const state = this.mission.snapshot();
    let label = "ETKİLEŞ";
    if (meta.interaction === "objective") label = "TESLİMAT KAYDINI DOĞRULA";
    if (meta.interaction === "extract") label = "BÖLGEDEN AYRIL";
    if (meta.interaction === "route-side") label = "YAN YAKLAŞIMI SEÇ";
    if (meta.interaction === "route-main") label = "ANA YAKLAŞIMI SEÇ";
    if (meta.interaction === "camera-bypass") {
      if (this.mission.hasOpportunity("camera_bypass")) label = "CCTV DEVRE DIŞI";
      else if (!this.mission.hasIntel("market_camera")) label = "ÖNCE CCTV'Yİ RECON İLE TANIMLA";
      else if (state.state !== "INFILTRATE" && state.state !== "EXTRACT") label = "CCTV FIRSATI HAZIR";
      else label = "CCTV BESLEMESİNİ DEVRE DIŞI BIRAK";
    }
    this.interactionEl.textContent = label;
    this.interactionEl.classList.remove("hidden");
    if (!interactPressed) return;

    if (meta.interaction === "route-main") this.mission.chooseRoute("main");
    if (meta.interaction === "route-side") this.mission.chooseRoute("side");
    if (meta.interaction === "objective") this.mission.completeObjective();
    if (meta.interaction === "extract") this.mission.extract();
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

  private updateHud(): void {
    const state = this.mission.snapshot();
    this.objectiveEl.textContent = state.objective;
    const result = state.state === "COMPLETE" ? ` · ${state.rank} · SKOR ${state.score}` : "";
    this.intelEl.textContent = `INTEL ${state.intelFound}/${state.intelTotal} · ${state.state}${result}`;
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
