import {
  Color3,
  EngineStore,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Vector3,
} from "@babylonjs/core";
import "../gadgets.css";
import { publishLocalAudio, publishWorldAudio } from "./audio-events";
import { publishPresentation } from "./presentation-events";

type GadgetId = "scan" | "jam" | "decoy";

type GadgetConfig = {
  id: GadgetId;
  label: string;
  shortLabel: string;
  cooldownMs: number;
};

const GADGETS: GadgetConfig[] = [
  { id: "scan", label: "FIELD SCAN", shortLabel: "SCAN", cooldownMs: 8_000 },
  { id: "jam", label: "SIGNAL JAM", shortLabel: "JAM", cooldownMs: 18_000 },
  { id: "decoy", label: "DECOY PING", shortLabel: "DECOY", cooldownMs: 12_000 },
];

class GadgetToolkit {
  private readonly trigger: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly buttons = new Map<GadgetId, HTMLButtonElement>();
  private readonly readyAt = new Map<GadgetId, number>();
  /** Previous cycle's ready state, so only a real transition publishes a cue. */
  private readonly wasReady = new Map<GadgetId, boolean>();
  private refreshTimer = 0;

  constructor() {
    this.trigger = document.createElement("button");
    this.trigger.type = "button";
    this.trigger.id = "gadget-toggle";
    this.trigger.className = "action action-move gadget-toggle";
    this.trigger.textContent = "GADGET";
    this.trigger.setAttribute("aria-label", "Saha araçlarını aç");
    this.trigger.setAttribute("aria-expanded", "false");

    const cover = document.querySelector<HTMLButtonElement>("#cover");
    const observe = document.querySelector<HTMLButtonElement>("#observe");
    const actions = document.querySelector<HTMLElement>(".actions");
    if (actions) actions.insertBefore(this.trigger, cover ?? observe ?? null);

    this.panel = document.createElement("section");
    this.panel.className = "gadget-panel hidden";
    this.panel.setAttribute("aria-label", "Saha araçları");
    this.panel.innerHTML = '<div class="gadget-panel-head"><b>FIELD KIT</b><span>STEALTH TOOLS</span></div><div class="gadget-options"></div>';
    document.body.appendChild(this.panel);

    const options = this.panel.querySelector<HTMLElement>(".gadget-options");
    for (const config of GADGETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gadget-option";
      button.dataset.gadget = config.id;
      button.innerHTML = `<b>${config.label}</b><small>${this.description(config.id)}</small><i>HAZIR</i>`;
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        this.activate(config);
      });
      options?.appendChild(button);
      this.buttons.set(config.id, button);
      this.readyAt.set(config.id, 0);
    }

    this.status = document.createElement("div");
    this.status.className = "gadget-status hidden";
    this.status.setAttribute("aria-live", "polite");
    document.body.appendChild(this.status);

    this.trigger.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      const opening = this.panel.classList.contains("hidden");
      this.panel.classList.toggle("hidden", !opening);
      this.trigger.classList.toggle("active", opening);
      this.trigger.setAttribute("aria-expanded", String(opening));
      if (typeof navigator.vibrate === "function") navigator.vibrate(7);
    });

    document.addEventListener("pointerdown", (event) => {
      const target = event.target as Node | null;
      if (target && (this.panel.contains(target) || this.trigger.contains(target))) return;
      this.closePanel();
    });

    this.refreshTimer = window.setInterval(() => this.refresh(), 250);
    this.refresh();
  }

  private activate(config: GadgetConfig): void {
    const now = performance.now();
    if ((this.readyAt.get(config.id) ?? 0) > now) return;

    const scene = EngineStore.LastCreatedScene;
    const player = scene?.getMeshByName("player-collider");
    if (!scene || !(player instanceof Mesh)) {
      this.showStatus("FIELD KIT · RUNTIME HAZIR DEĞİL", 1500);
      return;
    }

    let used = false;
    if (config.id === "scan") used = this.activateScan(player);
    if (config.id === "jam") used = this.activateJam();
    if (config.id === "decoy") used = this.activateDecoy(player);
    if (!used) return;

    this.readyAt.set(config.id, now + config.cooldownMs);
    if (typeof navigator.vibrate === "function") navigator.vibrate(config.id === "jam" ? [16, 20, 16] : 12);
    this.closePanel();
    this.refresh();
  }

  private activateScan(player: Mesh): boolean {
    const scene = player.getScene();
    const targets = scene.meshes.filter((mesh) => {
      const metadata = mesh.metadata as { intelId?: string } | null;
      return mesh instanceof Mesh
        && mesh !== player
        && Boolean(metadata?.intelId)
        && mesh.isEnabled()
        && Vector3.Distance(mesh.getAbsolutePosition(), player.position) <= 18;
    });

    const markerMaterial = new PBRMaterial(`field-scan-${performance.now()}`, scene);
    markerMaterial.albedoColor = new Color3(0.12, 0.32, 0.29);
    markerMaterial.emissiveColor = new Color3(0.18, 0.88, 0.66);
    markerMaterial.emissiveIntensity = 1.25;
    markerMaterial.roughness = 0.35;
    markerMaterial.metallic = 0.18;

    const markers: Mesh[] = [];
    for (const [index, target] of targets.entries()) {
      const marker = MeshBuilder.CreateTorus(`field-scan-marker-${index}-${performance.now()}`, {
        diameter: 0.62,
        thickness: 0.035,
        tessellation: 20,
      }, scene);
      marker.position.copyFrom(target.getAbsolutePosition()).addInPlace(new Vector3(0, 0.62, 0));
      marker.rotation.x = Math.PI / 2;
      marker.material = markerMaterial;
      marker.isPickable = false;
      markers.push(marker);
    }

    document.body.classList.add("field-scan-active");
    publishLocalAudio("scan", 0.7);
    this.showStatus(`FIELD SCAN · ${targets.length} SİNYAL`, 2800);
    window.setTimeout(() => {
      document.body.classList.remove("field-scan-active");
      for (const marker of markers) marker.dispose();
      markerMaterial.dispose();
    }, 2800);
    return true;
  }

  private activateJam(): boolean {
    window.dispatchEvent(new CustomEvent("cuma-gadget-jam", { detail: { duration: 5.5 } }));
    document.body.classList.add("signal-jam-active");
    publishLocalAudio("jam", 0.8);
    this.showStatus("SIGNAL JAM · CCTV BASKILANIYOR", 5500);
    window.setTimeout(() => document.body.classList.remove("signal-jam-active"), 5500);
    return true;
  }

  private activateDecoy(player: Mesh): boolean {
    const scene = player.getScene();
    const camera = scene.activeCamera;
    if (!camera) return false;

    const forward3d = camera.getForwardRay().direction;
    const forward = new Vector3(forward3d.x, 0, forward3d.z);
    if (forward.lengthSquared() < 0.001) forward.set(0, 0, 1);
    else forward.normalize();
    const point = player.position.add(forward.scale(6.5));
    point.y = 0.12;

    window.dispatchEvent(new CustomEvent("cuma-gadget-decoy", {
      detail: { x: point.x, y: point.y, z: point.z },
    }));
    // Presentation only, at the same point the gameplay decoy uses. NPC
    // investigation still follows the authoritative gameplay event above.
    publishWorldAudio("decoy", point.x, point.y, point.z, 1);

    const pulseMaterial = new PBRMaterial(`decoy-pulse-${performance.now()}`, scene);
    pulseMaterial.albedoColor = new Color3(0.34, 0.21, 0.08);
    pulseMaterial.emissiveColor = new Color3(0.92, 0.52, 0.12);
    pulseMaterial.emissiveIntensity = 1.2;
    pulseMaterial.alpha = 0.72;

    const pulse = MeshBuilder.CreateTorus(`decoy-pulse-${performance.now()}`, {
      diameter: 0.85,
      thickness: 0.04,
      tessellation: 20,
    }, scene);
    pulse.position.copyFrom(point).addInPlace(new Vector3(0, 0.08, 0));
    pulse.material = pulseMaterial;
    pulse.isPickable = false;

    const started = performance.now();
    const observer = scene.onBeforeRenderObservable.add(() => {
      const progress = Math.min(1, (performance.now() - started) / 1400);
      pulse.scaling.setAll(1 + progress * 2.8);
      pulse.visibility = 1 - progress;
      if (progress >= 1) {
        scene.onBeforeRenderObservable.remove(observer);
        pulse.dispose();
        pulseMaterial.dispose();
      }
    });

    this.showStatus("DECOY PING · DEVRİYE YÖNLENDİRİLDİ", 2200);
    return true;
  }

  /**
   * Runs on the existing 250 ms UI refresh — this milestone adds no timer.
   *
   * A gadget that crosses from cooling down to ready publishes exactly one
   * typed cue. Gadgets that were already ready when the panel first refreshed
   * are recorded silently, so nothing announces itself at boot, and the state
   * is only compared against the previous cycle, so an open panel never spams.
   */
  private refresh(): void {
    const now = performance.now();
    const runtimeReady = EngineStore.LastCreatedScene?.getMeshByName("player-collider") instanceof Mesh;
    this.trigger.disabled = !runtimeReady;
    this.trigger.classList.toggle("available", runtimeReady);

    for (const config of GADGETS) {
      const button = this.buttons.get(config.id);
      if (!button) continue;
      const remaining = Math.max(0, (this.readyAt.get(config.id) ?? 0) - now);
      const ready = remaining <= 0;
      button.disabled = !runtimeReady || !ready;
      button.classList.toggle("cooldown", !ready);
      const indicator = button.querySelector<HTMLElement>("i");
      if (indicator) indicator.textContent = ready ? "HAZIR" : `${Math.ceil(remaining / 1000)} sn`;

      const wasReady = this.wasReady.get(config.id);
      if (wasReady === false && ready && runtimeReady) {
        publishPresentation("GADGET_READY", "HAZIR", `${config.label} YENİDEN KULLANILABİLİR`);
      }
      this.wasReady.set(config.id, ready);
    }
  }

  private showStatus(text: string, durationMs: number): void {
    this.status.textContent = text;
    this.status.classList.remove("hidden");
    window.setTimeout(() => {
      if (this.status.textContent === text) this.status.classList.add("hidden");
    }, durationMs);
  }

  private closePanel(): void {
    this.panel.classList.add("hidden");
    this.trigger.classList.remove("active");
    this.trigger.setAttribute("aria-expanded", "false");
  }

  private description(id: GadgetId): string {
    if (id === "scan") return "Yakındaki intel izlerini kısa süre işaretler";
    if (id === "jam") return "CCTV algısını geçici olarak baskılar";
    return "Yakın devriyeyi seçilen noktaya araştırmaya çeker";
  }
}

export const gadgetToolkit = new GadgetToolkit();
void gadgetToolkit;
