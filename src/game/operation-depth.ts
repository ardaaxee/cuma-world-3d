import {
  Color3,
  EngineStore,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Ray,
  Scene,
  Vector3,
} from "@babylonjs/core";
import "../operation-depth.css";
import "./world-expansion";
import { hapticConfirm } from "./haptics";
import {
  MOBILE_CONTEXT_STATE_EVENT,
  publishMobileContextState,
  type MobileContextState,
} from "./input";

/** Matches the runtime interaction resolver's origin and reach. */
const TERMINAL_EYE_OFFSET = 0.62;
const TERMINAL_REACH = 3.4;
const terminalOrigin = new Vector3();
const terminalRay = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), TERMINAL_REACH);

type OperationAction = "access-terminal" | "manifest-terminal";

type OperationTarget = {
  mesh: Mesh;
  action: OperationAction;
  step: "access" | "manifest";
  label: string;
  material: PBRMaterial;
};

class OperationDepthSystem {
  private readonly interactButton = document.querySelector<HTMLButtonElement>("#interact");
  private readonly interaction = document.querySelector<HTMLElement>("#interaction");
  private readonly progress = document.createElement("div");
  private scene: Scene | null = null;
  private targets: OperationTarget[] = [];
  private currentAction: OperationAction | null = null;
  private ownsPrompt = false;
  private promptAvailable = false;
  private observationActive = false;
  private lastStep = "";

  constructor() {
    this.progress.className = "operation-progress hidden";
    this.progress.innerHTML = '<span data-step="access">ERİŞİM</span><i></i><span data-step="manifest">MANİFEST</span><i></i><span data-step="verify">DOĞRULA</span><i></i><span data-step="done">ÇIKIŞ</span>';
    document.body.appendChild(this.progress);

    this.interactButton?.addEventListener("pointerdown", this.onInteract, { capture: true });
    window.addEventListener(MOBILE_CONTEXT_STATE_EVENT, (event: Event) => {
      const state = (event as CustomEvent<MobileContextState>).detail;
      if (typeof state?.observationActive !== "boolean") return;
      this.observationActive = state.observationActive;
      if (!this.observationActive) return;
      this.currentAction = null;
      this.ownsPrompt = false;
      this.interaction?.classList.add("hidden");
      this.setPromptAvailable(false);
    });
    requestAnimationFrame(this.waitForScene);
  }

  private readonly waitForScene = (): void => {
    const scene = EngineStore.LastCreatedScene;
    if (!scene) {
      requestAnimationFrame(this.waitForScene);
      return;
    }
    this.scene = scene;
    this.buildTerminals(scene);
    scene.onAfterRenderObservable.add(this.afterRender);
  };

  private buildTerminals(scene: Scene): void {
    const frame = this.material(scene, "operation-terminal-frame", new Color3(0.055, 0.065, 0.075), new Color3(0.015, 0.02, 0.025));
    frame.metallic = 0.62;
    frame.roughness = 0.38;

    const accessMat = this.material(scene, "access-terminal-screen", new Color3(0.04, 0.08, 0.075), new Color3(0.08, 0.42, 0.3));
    const manifestMat = this.material(scene, "manifest-terminal-screen", new Color3(0.07, 0.065, 0.045), new Color3(0.46, 0.3, 0.08));

    // ACCESS sits at the public/staff transition beside the controlled staff
    // door; MANIFEST lives deep in the back-office records room.
    const accessBase = MeshBuilder.CreateBox("operation-access-base", { width: 0.78, height: 1.18, depth: 0.24 }, scene);
    accessBase.position = new Vector3(-6.0, 1.12, 13.65);
    accessBase.material = frame;
    accessBase.checkCollisions = false;

    const access = MeshBuilder.CreateBox("operation-access-terminal", { width: 0.58, height: 0.42, depth: 0.06 }, scene);
    access.position = new Vector3(-6.0, 1.35, 13.5);
    access.material = accessMat;
    access.checkCollisions = false;

    const manifestBase = MeshBuilder.CreateBox("operation-manifest-base", { width: 0.9, height: 1.05, depth: 0.28 }, scene);
    manifestBase.position = new Vector3(-3.6, 1.0, 22.25);
    manifestBase.material = frame;
    manifestBase.checkCollisions = false;

    const manifest = MeshBuilder.CreateBox("operation-manifest-terminal", { width: 0.62, height: 0.4, depth: 0.07 }, scene);
    manifest.position = new Vector3(-3.6, 1.23, 22.07);
    manifest.material = manifestMat;
    manifest.checkCollisions = false;

    this.targets = [
      { mesh: access, action: "access-terminal", step: "access", label: "TEK KULLANIMLIK ERİŞİM KODUNU AL", material: accessMat },
      { mesh: manifest, action: "manifest-terminal", step: "manifest", label: "TESLİMAT MANİFESTİNİ EŞLEŞTİR", material: manifestMat },
    ];
  }

  private readonly afterRender = (): void => {
    const scene = this.scene;
    const camera = scene?.activeCamera;
    if (!scene || !camera || !this.interaction) return;

    const step = document.body.dataset.operationStep ?? "none";
    if (step !== this.lastStep) {
      this.lastStep = step;
      this.updateProgress(step);
      this.updateTerminalLights(step);
    }

    if (step !== "access" && step !== "manifest") {
      this.currentAction = null;
      this.ownsPrompt = false;
      this.setPromptAvailable(false);
      return;
    }
    if (this.observationActive) {
      this.currentAction = null;
      this.ownsPrompt = false;
      this.setPromptAvailable(false);
      return;
    }

    const target = this.targets.find((candidate) => candidate.step === step);
    if (!target) return;

    // Cast from the player looking along the camera, matching the runtime's
    // interaction resolver. Casting from the camera made a terminal mounted on
    // a far room wall fall outside range once the player was close to it.
    const player = scene.getMeshByName("player-collider");
    if (!(player instanceof Mesh)) return;
    terminalOrigin.copyFrom(player.position);
    terminalOrigin.y += TERMINAL_EYE_OFFSET;
    terminalRay.origin.copyFrom(terminalOrigin);
    terminalRay.direction.copyFrom(camera.getForwardRay().direction);
    terminalRay.length = TERMINAL_REACH;
    const hit = scene.pickWithRay(terminalRay, (mesh) => mesh === target.mesh);
    if (!hit?.hit) {
      this.currentAction = null;
      this.ownsPrompt = false;
      this.setPromptAvailable(false);
      return;
    }

    this.currentAction = target.action;
    this.ownsPrompt = true;
    this.interaction.textContent = target.label;
    this.interaction.classList.remove("hidden");
    this.interaction.style.removeProperty("display");
    this.setPromptAvailable(true);
  };

  private readonly onInteract = (event: PointerEvent): void => {
    if (!this.currentAction || !this.ownsPrompt) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.dispatchEvent(new CustomEvent<OperationAction>("cuma-operation-action", { detail: this.currentAction }));
    hapticConfirm();
    this.currentAction = null;
    this.ownsPrompt = false;
    this.setPromptAvailable(false);
  };

  private setPromptAvailable(available: boolean): void {
    if (this.promptAvailable === available) return;
    this.promptAvailable = available;
    publishMobileContextState({ interactionAvailable: available });
  }

  private updateProgress(step: string): void {
    const activeMission = step === "access" || step === "manifest" || step === "verify" || step === "done";
    this.progress.classList.toggle("hidden", !activeMission);
    const order = ["access", "manifest", "verify", "done"];
    const activeIndex = order.indexOf(step);
    for (const element of this.progress.querySelectorAll<HTMLElement>("span[data-step]")) {
      const index = order.indexOf(element.dataset.step ?? "");
      element.classList.toggle("complete", activeIndex > index || step === "done");
      element.classList.toggle("active", activeIndex === index && step !== "done");
    }
  }

  private updateTerminalLights(step: string): void {
    for (const target of this.targets) {
      const active = target.step === step;
      target.material.emissiveIntensity = active ? 1.35 : 0.32;
      target.mesh.scaling.setAll(active ? 1.035 : 1);
    }
  }

  private material(scene: Scene, name: string, color: Color3, emissive: Color3): PBRMaterial {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = color;
    material.emissiveColor = emissive;
    material.emissiveIntensity = 0.32;
    material.roughness = 0.42;
    material.metallic = 0.2;
    return material;
  }
}

export const operationDepthSystem = new OperationDepthSystem();
void operationDepthSystem;
