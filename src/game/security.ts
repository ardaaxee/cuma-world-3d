import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Ray,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { coverProtection, COVER_MAX_DETECTION_REDUCTION, isInCover } from "./cover";
import { getFacilityState, reportIncident } from "./facility-security";
import { isCrouched } from "./input";
import type { AwarenessSnapshot } from "./npc";

export class SecurityCameraSystem {
  readonly bypassPanel: Mesh;
  private readonly cameraMesh: Mesh | null;
  private awareness = 0;
  private bypassed = false;
  private alertedCycle = false;
  private senseTimer = 0;
  private jamTimer = 0;

  constructor(private readonly scene: Scene, private readonly onAlert: () => void) {
    this.cameraMesh = scene.getMeshByName("fictional-camera") as Mesh | null;
    const panelMaterial = new PBRMaterial("cctv-bypass-panel-material", scene);
    panelMaterial.albedoColor = new Color3(0.055, 0.07, 0.08);
    panelMaterial.emissiveColor = new Color3(0.08, 0.14, 0.13);
    panelMaterial.roughness = 0.52;
    panelMaterial.metallic = 0.48;
    this.bypassPanel = MeshBuilder.CreateBox("cctv-bypass-panel", { width: 0.34, height: 0.52, depth: 0.12 }, scene);
    // Moved into the monitoring room: disabling CCTV now costs a RESTRICTED entry.
    this.bypassPanel.position = new Vector3(-0.4, 1.28, 22.3);
    this.bypassPanel.material = panelMaterial;
    this.bypassPanel.checkCollisions = false;

    window.addEventListener("cuma-gadget-jam", (event) => {
      const detail = (event as CustomEvent<{ duration?: number }>).detail;
      const duration = typeof detail?.duration === "number" && Number.isFinite(detail.duration)
        ? Math.max(1, Math.min(8, detail.duration))
        : 5.5;
      this.jamTimer = Math.max(this.jamTimer, duration);
      this.awareness = Math.max(0, this.awareness - 0.34);
    });
  }

  update(dt: number, playerPosition: Vector3, playerCollider: Mesh, active: boolean): AwarenessSnapshot {
    this.jamTimer = Math.max(0, this.jamTimer - dt);
    if (this.jamTimer > 0 && !this.bypassed) {
      this.awareness = Math.max(0, this.awareness - dt * 1.65);
      this.alertedCycle = this.awareness >= 0.35 && this.alertedCycle;
      return { state: this.state(), meter: this.awareness, label: "CCTV" };
    }

    if (this.bypassed || !active || !this.cameraMesh) {
      this.awareness = Math.max(0, this.awareness - dt * 1.8);
      return { state: this.state(), meter: this.awareness, label: "CCTV" };
    }
    this.senseTimer -= dt;
    if (this.senseTimer > 0) return { state: this.state(), meter: this.awareness, label: "CCTV" };
    this.senseTimer = 0.09;

    const route = document.body.dataset.route;
    const covered = isInCover();
    const stanceScale = isCrouched() ? 0.72 : 1;
    // Directional: the camera only loses sight of the player when the cover
    // surface is actually between the lens and the player.
    const protection = coverProtection(this.cameraMesh.position);
    const coverScale = 1 - protection * COVER_MAX_DETECTION_REDUCTION;
    // A searching facility watches its cameras harder, but jamming and the
    // permanent bypass are untouched and still defeat them outright.
    const facility = getFacilityState();
    const facilityScale = facility === "HIGH_ALERT" ? 1.3 : facility === "SEARCH" ? 1.15 : 1;
    const detectionScale = (route === "main" ? 1.12 : route === "side" ? 0.72 : 1) * stanceScale * coverScale * facilityScale;
    const decayScale = (route === "main" ? 0.9 : route === "side" ? 1.18 : 1) * (1 + protection * 0.18);
    const origin = this.cameraMesh.position.add(new Vector3(0, 0.02, 0));
    const playerEye = playerPosition.add(new Vector3(0, isCrouched() ? 0.3 : covered ? 0.44 : 0.55, 0));
    const toPlayer = playerEye.subtract(origin);
    const distance = toPlayer.length();
    let visible = false;
    if (distance > 0.001 && distance <= 11.5) {
      const direction = toPlayer.scale(1 / distance);
      const cameraForward = new Vector3(0.08, -0.2, 0.977).normalize();
      if (Vector3.Dot(cameraForward, direction) > 0.73) {
        const occluder = this.scene.pickWithRay(
          new Ray(origin, direction, distance),
          (mesh) => mesh instanceof Mesh && mesh.checkCollisions && mesh !== playerCollider,
        );
        visible = !occluder?.hit || (occluder.distance ?? distance) >= distance - 0.25;
      }
    }

    if (visible) this.awareness = Math.min(1, this.awareness + 0.09 * 0.95 * detectionScale);
    else this.awareness = Math.max(0, this.awareness - 0.09 * 0.62 * decayScale * (isCrouched() ? 1.08 : 1));

    if (this.awareness >= 0.98 && !this.alertedCycle) {
      this.alertedCycle = true;
      reportIncident("camera-alert", playerPosition.x, playerPosition.y, playerPosition.z);
      this.onAlert();
    }
    if (this.awareness < 0.35) this.alertedCycle = false;
    return { state: this.state(), meter: this.awareness, label: "CCTV" };
  }

  canBypass(cameraIntelDiscovered: boolean, active: boolean): boolean {
    return !this.bypassed && cameraIntelDiscovered && active;
  }

  bypass(): boolean {
    if (this.bypassed) return false;
    this.bypassed = true;
    this.awareness = 0;
    const material = this.bypassPanel.material;
    if (material instanceof PBRMaterial) material.emissiveColor = new Color3(0.06, 0.24, 0.12);
    return true;
  }

  applyQuality(tier: "LOW" | "MEDIUM" | "HIGH" | "ULTRA"): void {
    this.bypassPanel.setEnabled(true);
    if (this.cameraMesh) this.cameraMesh.setEnabled(true);
    if (tier === "LOW") this.senseTimer = Math.max(this.senseTimer, 0.14);
  }

  private state(): AwarenessSnapshot["state"] {
    return this.awareness >= 0.86 ? "ALERT" : this.awareness >= 0.56 ? "SUSPICIOUS" : this.awareness >= 0.22 ? "CURIOUS" : "NORMAL";
  }
}
