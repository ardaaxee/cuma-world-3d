import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Ray,
  Scene,
  ShadowGenerator,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { MobileInput } from "./input";
import { MissionDirector } from "./mission";

type GameMetadata = {
  intelId?: string;
  label?: string;
  interaction?: "route-main" | "route-side" | "objective" | "extract";
};

export class GameRuntime {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly input = new MobileInput();
  private readonly mission = new MissionDirector();
  private observation = false;
  private observedMesh: Mesh | null = null;
  private analysisSeconds = 0;
  private yaw = 0;
  private pitch = -0.04;
  private velocity = Vector3.Zero();
  private running = false;

  private readonly objectiveEl = document.querySelector<HTMLElement>("#objective")!;
  private readonly intelEl = document.querySelector<HTMLElement>("#intel")!;
  private readonly observationEl = document.querySelector<HTMLElement>("#observation-readout")!;
  private readonly interactionEl = document.querySelector<HTMLElement>("#interaction")!;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: false,
      powerPreference: "high-performance",
    });
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.engine.setHardwareScalingLevel(mobile ? 1.35 : Math.max(1, window.devicePixelRatio / 1.5));

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.035, 0.045, 0.06, 1);
    this.scene.collisionsEnabled = true;
    this.scene.gravity = new Vector3(0, -0.28, 0);

    this.camera = new UniversalCamera("player-camera", new Vector3(0, 1.72, -8), this.scene);
    this.camera.fov = 70 * Math.PI / 180;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 140;
    this.camera.inputs.clear();
    this.camera.checkCollisions = true;
    this.camera.applyGravity = true;
    this.camera.ellipsoid = new Vector3(0.34, 0.82, 0.34);
    this.camera.ellipsoidOffset = new Vector3(0, -0.78, 0);

    this.buildWorld();
    this.mission.acknowledgeBriefing();
    this.updateHud();
  }

  start(): void {
    let last = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.scene.render();
    });
    window.addEventListener("resize", () => this.engine.resize());
  }

  private update(dt: number): void {
    const frame = this.input.frame();
    this.yaw -= frame.lookX * 0.00255;
    this.pitch = Math.max(-1.12, Math.min(1.02, this.pitch - frame.lookY * 0.0022));
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = forward.scale(frame.moveY).add(right.scale(frame.moveX));
    const strength = Math.min(1, desired.length());
    if (strength > 0.001) desired.normalize();
    const speed = 4.25 * strength;
    const target = desired.scale(speed);
    const accel = strength > 0.01 ? 13.5 : 20.0;
    this.velocity = Vector3.Lerp(this.velocity, target, 1 - Math.exp(-accel * dt));
    this.camera.cameraDirection.addInPlace(this.velocity.scale(dt));
    this.running = strength > 0.86;
    const targetFov = (this.running ? 73.5 : 70) * Math.PI / 180;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5.5 * dt));

    if (frame.observePressed) {
      this.observation = !this.observation;
      this.analysisSeconds = 0;
      this.observedMesh = null;
      this.observationEl.classList.toggle("hidden", !this.observation);
    }

    if (this.observation) this.updateObservation(dt);
    else this.updateInteraction(frame.interactPressed);
    this.updateHud();
  }

  private updateObservation(dt: number): void {
    const ray = new Ray(this.camera.position, this.camera.getForwardRay().direction, 18);
    const hit = this.scene.pickWithRay(ray, (mesh) => Boolean((mesh.metadata as GameMetadata | null)?.intelId));
    const mesh = hit?.hit && hit.pickedMesh instanceof Mesh ? hit.pickedMesh : null;
    if (!mesh) {
      this.observedMesh = null;
      this.analysisSeconds = Math.max(0, this.analysisSeconds - dt * 2.2);
      this.observationEl.textContent = "RECON LENS · HEDEF YOK";
      return;
    }
    if (mesh !== this.observedMesh) {
      this.observedMesh = mesh;
      this.analysisSeconds = 0;
    }
    const meta = mesh.metadata as GameMetadata;
    if (this.mission.hasIntel(meta.intelId ?? "")) {
      this.observationEl.textContent = `IDENTIFIED · ${meta.label ?? "INTEL"}`;
      return;
    }
    this.analysisSeconds += dt;
    const progress = Math.min(100, Math.round((this.analysisSeconds / 0.7) * 100));
    this.observationEl.textContent = `ANALYZING ${progress}% · ${meta.label ?? "INTEL"}`;
    if (this.analysisSeconds >= 0.7 && meta.intelId) {
      this.mission.discoverIntel(meta.intelId);
      this.observationEl.textContent = `IDENTIFIED · ${meta.label ?? "INTEL"}`;
    }
  }

  private updateInteraction(interactPressed: boolean): void {
    const ray = new Ray(this.camera.position, this.camera.getForwardRay().direction, 3.4);
    const hit = this.scene.pickWithRay(ray, (mesh) => Boolean((mesh.metadata as GameMetadata | null)?.interaction));
    const mesh = hit?.hit && hit.pickedMesh instanceof Mesh ? hit.pickedMesh : null;
    if (!mesh) {
      this.interactionEl.classList.add("hidden");
      return;
    }
    const meta = mesh.metadata as GameMetadata;
    const label = meta.interaction === "objective" ? "TESLİMAT KAYDINI DOĞRULA" : meta.interaction === "extract" ? "BÖLGEDEN AYRIL" : meta.interaction === "route-side" ? "YAN YAKLAŞIMI SEÇ" : "ANA YAKLAŞIMI SEÇ";
    this.interactionEl.textContent = label;
    this.interactionEl.classList.remove("hidden");
    if (!interactPressed) return;

    if (meta.interaction === "route-main") this.mission.chooseRoute("main");
    if (meta.interaction === "route-side") this.mission.chooseRoute("side");
    if (meta.interaction === "objective") this.mission.completeObjective();
    if (meta.interaction === "extract") this.mission.extract();
  }

  private updateHud(): void {
    const state = this.mission.snapshot();
    this.objectiveEl.textContent = state.objective;
    this.intelEl.textContent = `INTEL ${state.intelFound}/${state.intelTotal} · ${state.state}${state.rank ? ` · ${state.rank}` : ""}`;
  }

  private buildWorld(): void {
    const hemi = new HemisphericLight("sky", new Vector3(0.15, 1, 0.1), this.scene);
    hemi.intensity = 0.58;
    hemi.diffuse = new Color3(0.72, 0.78, 0.9);
    hemi.groundColor = new Color3(0.12, 0.11, 0.1);
    const sun = new DirectionalLight("sun", new Vector3(-0.35, -0.9, 0.42), this.scene);
    sun.position = new Vector3(18, 28, -15);
    sun.intensity = 2.2;
    const shadows = new ShadowGenerator(1024, sun);
    shadows.usePercentageCloserFiltering = true;

    const concrete = this.material("concrete", new Color3(0.22, 0.24, 0.25), 0.88, 0.0);
    const plaster = this.material("plaster", new Color3(0.52, 0.5, 0.45), 0.92, 0.0);
    const metal = this.material("metal", new Color3(0.12, 0.14, 0.16), 0.34, 0.72);
    const accent = this.material("accent", new Color3(0.46, 0.34, 0.19), 0.62, 0.05);

    const ground = MeshBuilder.CreateGround("ground", { width: 70, height: 70 }, this.scene);
    ground.material = concrete;
    ground.checkCollisions = true;
    ground.receiveShadows = true;

    this.box("market-back", new Vector3(0, 2.1, 14), new Vector3(15, 4.2, 0.45), plaster, true);
    this.box("market-left", new Vector3(-7.25, 2.1, 8), new Vector3(0.45, 4.2, 12), plaster, true);
    this.box("market-right", new Vector3(7.25, 2.1, 8), new Vector3(0.45, 4.2, 12), plaster, true);
    this.box("front-a", new Vector3(-4.9, 2.1, 2), new Vector3(4.7, 4.2, 0.45), plaster, true);
    this.box("front-b", new Vector3(4.9, 2.1, 2), new Vector3(4.7, 4.2, 0.45), plaster, true);

    const front = this.box("front-route", new Vector3(0, 1.35, 2.15), new Vector3(3.8, 2.7, 0.12), accent, false);
    front.visibility = 0.08;
    front.metadata = { intelId: "market_front_access", label: "ANA GİRİŞ", interaction: "route-main" } satisfies GameMetadata;

    const side = this.box("side-route", new Vector3(7.05, 1.35, 10.2), new Vector3(0.12, 2.7, 2.5), accent, false);
    side.visibility = 0.08;
    side.metadata = { intelId: "market_side_access", label: "TESLİMAT GİRİŞİ", interaction: "route-side" } satisfies GameMetadata;

    const desk = this.box("dispatch-desk", new Vector3(1.4, 0.55, 11.2), new Vector3(2.8, 1.1, 1.0), accent, true);
    shadows.addShadowCaster(desk);
    const record = this.box("dispatch-record", new Vector3(1.4, 1.18, 11.2), new Vector3(0.65, 0.08, 0.45), metal, false);
    record.metadata = { label: "TESLİMAT KAYDI", interaction: "objective" } satisfies GameMetadata;

    const camera = MeshBuilder.CreateCylinder("fictional-camera", { height: 0.55, diameter: 0.22 }, this.scene);
    camera.position = new Vector3(-3.5, 3.25, 2.4);
    camera.rotation.z = Math.PI / 2;
    camera.material = metal;
    camera.metadata = { intelId: "market_camera", label: "GÜVENLİK KAMERASI" } satisfies GameMetadata;
    shadows.addShadowCaster(camera);

    const workerMarker = this.box("worker-route-intel", new Vector3(-2.8, 1.1, 8.2), new Vector3(0.3, 2.1, 0.3), metal, false);
    workerMarker.visibility = 0.04;
    workerMarker.metadata = { intelId: "market_worker_route", label: "ÇALIŞAN RUTİNİ" } satisfies GameMetadata;

    const extraction = this.box("extraction", new Vector3(0, 1, -12), new Vector3(5, 2, 0.2), accent, false);
    extraction.visibility = 0.025;
    extraction.metadata = { label: "EXTRACTION", interaction: "extract" } satisfies GameMetadata;
  }

  private box(name: string, position: Vector3, size: Vector3, material: PBRMaterial, collision: boolean): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, this.scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.checkCollisions = collision;
    mesh.receiveShadows = collision;
    return mesh;
  }

  private material(name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = 0.55;
    return material;
  }
}
