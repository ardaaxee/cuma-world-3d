import { EngineStore, Mesh, Ray, Vector3 } from "@babylonjs/core";
import "../cover.css";
import "./gadgets";

let coverActive = false;
let coverReady = false;

export function isInCover(): boolean {
  return coverActive && coverReady;
}

export function isCoverReady(): boolean {
  return coverReady;
}

class TacticalCoverSystem {
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private raf = 0;
  private lastPosition: Vector3 | null = null;
  private lastTime = performance.now();

  constructor() {
    this.button = document.createElement("button");
    this.button.id = "cover";
    this.button.className = "action action-move action-cover";
    this.button.type = "button";
    this.button.textContent = "SİPER";
    this.button.disabled = true;
    this.button.setAttribute("aria-label", "Sipere gir");
    this.button.setAttribute("aria-pressed", "false");

    const observe = document.querySelector<HTMLButtonElement>("#observe");
    const actions = document.querySelector<HTMLElement>(".actions");
    if (actions) actions.insertBefore(this.button, observe ?? null);

    this.status = document.createElement("div");
    this.status.className = "cover-status hidden";
    this.status.setAttribute("aria-live", "polite");
    document.body.appendChild(this.status);
    document.body.dataset.cover = "none";

    this.button.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (!coverReady) return;
      coverActive = !coverActive;
      if (typeof navigator.vibrate === "function") navigator.vibrate(coverActive ? 14 : 8);
      this.syncUi();
    });

    this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    const scene = EngineStore.LastCreatedScene;
    const player = scene?.getMeshByName("player-collider");
    const dt = Math.max(0.001, Math.min(0.1, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (!(player instanceof Mesh) || !scene) {
      coverReady = false;
      coverActive = false;
      this.lastPosition = null;
      this.syncUi();
      this.raf = requestAnimationFrame(this.tick);
      return;
    }

    const origin = player.position.add(new Vector3(0, 0.68, 0));
    const directions = [
      new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1),
      new Vector3(1, 0, 1).normalize(), new Vector3(1, 0, -1).normalize(),
      new Vector3(-1, 0, 1).normalize(), new Vector3(-1, 0, -1).normalize(),
    ];

    let nearest = 99;
    for (const direction of directions) {
      const hit = scene.pickWithRay(
        new Ray(origin, direction, 0.9),
        (mesh) => mesh instanceof Mesh && mesh !== player && mesh.checkCollisions && mesh.isEnabled(),
      );
      if (hit?.hit && typeof hit.distance === "number") nearest = Math.min(nearest, hit.distance);
    }

    coverReady = nearest <= 0.82;

    if (this.lastPosition) {
      const moved = Vector3.Distance(player.position, this.lastPosition);
      const speed = moved / dt;
      if (coverActive && speed > 2.15) coverActive = false;
    }
    this.lastPosition = player.position.clone();

    if (!coverReady) coverActive = false;
    this.syncUi();
    this.raf = requestAnimationFrame(this.tick);
  };

  private syncUi(): void {
    const active = isInCover();
    this.button.disabled = !coverReady;
    this.button.classList.toggle("available", coverReady && !active);
    this.button.classList.toggle("active", active);
    this.button.textContent = active ? "ÇIK" : "SİPER";
    this.button.setAttribute("aria-pressed", String(active));
    this.button.setAttribute("aria-label", active ? "Siperden çık" : "Sipere gir");

    document.body.dataset.cover = active ? "active" : coverReady ? "ready" : "none";
    document.body.classList.toggle("cover-active", active);

    if (active) {
      this.status.textContent = "SİPER · KORUNUYOR";
      this.status.classList.remove("hidden");
    } else if (coverReady) {
      this.status.textContent = "SİPER HAZIR";
      this.status.classList.remove("hidden");
    } else {
      this.status.classList.add("hidden");
    }
  }
}

export const tacticalCoverSystem = new TacticalCoverSystem();
void tacticalCoverSystem;
