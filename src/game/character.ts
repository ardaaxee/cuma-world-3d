import {
  type AbstractMesh,
  AnimationGroup,
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Ray,
  Scene,
  SceneLoader,
  ShadowLight,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { publishLocalAudio } from "./audio-events";
import { type CharacterAnimationState, hasRequiredStates, resolveAnimationGroups } from "./character-animation";
import { AnimationBlender } from "./character-blender";
import { FacialLifeLayer } from "./character-face";
import { consumeJumpPressed, CROUCH_SPEED_MULTIPLIER, isCrouched, isRunHeld, RUN_SPEED_MULTIPLIER } from "./input";
import { LANDING_NOISE_MIN_SPEED, reportPlayerLanding } from "./noise";

/** How long the take-off clip owns the pose before airborne takes over. */
const JUMP_START_SECONDS = 0.22;
/** How long the landing clip plays before normal locomotion resumes. */
const LANDING_ANIM_SECONDS = 0.28;
/** Below this the character is treated as standing still. */
const MOVING_SPEED = 0.25;
/** Matches the scene's own PBR materials so the hero sits in the same light. */
const CHARACTER_ENVIRONMENT_INTENSITY = 0.72;

/**
 * Standing turn-to-camera. The gap must exceed ENTER before the body starts
 * turning and must close to SETTLE before it stops, so looking around slightly
 * never rotates the character and the turn cannot chatter at the boundary.
 */
const IDLE_TURN_ENTER = 1.0;
const IDLE_TURN_SETTLE = 0.12;
/** Deliberately slower than the movement-facing rate — a turn, not a snap. */
const IDLE_TURN_RATE = 4.2;

function shortestAngle(angle: number): number {
  let delta = angle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export class PlayerCharacter {
  readonly collider: Mesh;
  readonly visualRoot: TransformNode;
  readonly cameraTarget: TransformNode;
  private readonly proceduralParts: Mesh[] = [];
  private readonly importedMeshes: Mesh[] = [];
  private readonly animation = new AnimationBlender();
  private readonly face = new FacialLifeLayer();
  private idleTurning = false;
  private jumpAnimTimer = 0;
  private landingAnimTimer = 0;
  private imported = false;
  private speed = 0;
  private stride = 0;
  private idlePhase = 0;
  private shadowRefreshClock = 0;
  private verticalVelocity = 0;
  private grounded = true;
  private groundGrace = 0.11;
  private landingCameraKick = 0;
  private torsoPivot: TransformNode | null = null;
  private headPivot: TransformNode | null = null;
  private leftArmPivot: TransformNode | null = null;
  private rightArmPivot: TransformNode | null = null;
  private leftLegPivot: TransformNode | null = null;
  private rightLegPivot: TransformNode | null = null;

  constructor(private readonly scene: Scene) {
    this.collider = MeshBuilder.CreateCapsule("player-collider", { height: 1.72, radius: 0.34, tessellation: 8 }, scene);
    this.collider.position = new Vector3(0, 0.9, -8);
    this.collider.isVisible = false;
    this.collider.isPickable = false;
    this.collider.checkCollisions = true;
    this.collider.ellipsoid = new Vector3(0.34, 0.82, 0.34);
    this.collider.ellipsoidOffset = new Vector3(0, 0, 0);

    this.visualRoot = new TransformNode("player-visual-root", scene);
    this.visualRoot.parent = this.collider;
    this.visualRoot.position = new Vector3(0, -0.86, 0);

    this.cameraTarget = new TransformNode("player-camera-target", scene);
    this.cameraTarget.parent = this.collider;
    this.cameraTarget.position = new Vector3(0, 0.62, 0);

    this.buildProceduralFallback();
    void this.tryLoadRuntimeModel();
  }

  get position(): Vector3 {
    return this.collider.position;
  }

  move(displacement: Vector3): void {
    const multiplier = isCrouched() ? CROUCH_SPEED_MULTIPLIER : isRunHeld() ? RUN_SPEED_MULTIPLIER : 1;
    this.collider.moveWithCollisions(new Vector3(
      displacement.x * multiplier,
      displacement.y,
      displacement.z * multiplier,
    ));
  }

  setFacing(yaw: number, dt: number): void {
    const current = this.visualRoot.rotation.y;
    this.visualRoot.rotation.y = current + shortestAngle(yaw - current) * (1 - Math.exp(-13 * dt));
    this.idleTurning = false;
  }

  /**
   * Presentation-only turn for a standing player.
   *
   * Small camera movement must not swing the body, so the turn only starts once
   * the gap is genuinely large and then runs until the body is nearly aligned —
   * a hysteresis band rather than a threshold, which is what stops it
   * stuttering on and off at the boundary. It eases rather than snapping.
   *
   * This writes nothing but the visual root's yaw: the capsule collider, the
   * player's position, the noise model and mission logic are all untouched.
   */
  setIdleFacing(yaw: number, dt: number, allowed: boolean): void {
    if (!allowed) {
      this.idleTurning = false;
      return;
    }
    const current = this.visualRoot.rotation.y;
    const delta = shortestAngle(yaw - current);
    const magnitude = Math.abs(delta);

    if (!this.idleTurning) {
      if (magnitude < IDLE_TURN_ENTER) return;
      this.idleTurning = true;
    } else if (magnitude < IDLE_TURN_SETTLE) {
      this.idleTurning = false;
      return;
    }
    this.visualRoot.rotation.y = current + delta * (1 - Math.exp(-IDLE_TURN_RATE * dt));
  }

  update(speed: number, dt: number, reducedMotion: boolean, inCover = false): void {
    this.applyJump(dt);
    this.jumpAnimTimer = Math.max(0, this.jumpAnimTimer - dt);
    this.landingAnimTimer = Math.max(0, this.landingAnimTimer - dt);
    this.landingCameraKick += (0 - this.landingCameraKick) * (1 - Math.exp(-15 * dt));
    const crouched = isCrouched();
    const baseCameraHeight = crouched ? 0.34 : 0.62;
    const cameraKick = this.landingCameraKick * (reducedMotion ? 0.22 : 1);
    this.cameraTarget.position.y += (baseCameraHeight + cameraKick - this.cameraTarget.position.y) * (1 - Math.exp(-11 * dt));
    const stanceScale = crouched ? 0.82 : 1;
    this.visualRoot.scaling.y += (stanceScale - this.visualRoot.scaling.y) * (1 - Math.exp(-10 * dt));

    const sprinting = isRunHeld() && !crouched && speed > 2.25;
    const movementScale = crouched ? CROUCH_SPEED_MULTIPLIER : sprinting ? RUN_SPEED_MULTIPLIER : 1;
    const effectiveSpeed = speed * movementScale;
    this.speed += (effectiveSpeed - this.speed) * (1 - Math.exp(-10 * dt));
    this.syncShadowCasters(dt);
    if (this.imported) {
      this.animation.play(this.resolveState(this.speed, sprinting, crouched, inCover));
      this.animation.update(dt);
      this.face.update(dt, reducedMotion);
      return;
    }

    this.idlePhase += dt * 1.6;
    const locomotion = Math.min(1, this.speed / 4.15);
    const running = sprinting ? Math.max(0, Math.min(1, (this.speed - 3.35) / 2.0)) : 0;
    const motionScale = reducedMotion ? 0.58 : 1;
    this.stride += Math.max(0.35, this.speed) * dt * (2.0 + running * 0.72);

    const cycle = Math.sin(this.stride);
    const swing = cycle * (0.36 + running * 0.16) * locomotion * motionScale;
    const legSwing = cycle * (0.48 + running * 0.12) * locomotion * motionScale;
    const bob = this.grounded ? Math.abs(Math.sin(this.stride)) * (0.022 + running * 0.013) * locomotion * motionScale : 0;
    const breathe = Math.sin(this.idlePhase) * 0.006 * (1 - locomotion) * motionScale;

    this.visualRoot.position.y = -0.86 + bob + breathe;

    if (this.grounded) {
      if (this.leftArmPivot) this.leftArmPivot.rotation.x = swing;
      if (this.rightArmPivot) this.rightArmPivot.rotation.x = -swing;
      if (this.leftLegPivot) this.leftLegPivot.rotation.x = -legSwing;
      if (this.rightLegPivot) this.rightLegPivot.rotation.x = legSwing;
    } else {
      if (this.leftArmPivot) this.leftArmPivot.rotation.x = 0.12 * motionScale;
      if (this.rightArmPivot) this.rightArmPivot.rotation.x = -0.12 * motionScale;
      if (this.leftLegPivot) this.leftLegPivot.rotation.x = -0.2 * motionScale;
      if (this.rightLegPivot) this.rightLegPivot.rotation.x = 0.3 * motionScale;
    }

    if (this.torsoPivot) {
      this.torsoPivot.rotation.x = crouched ? -0.16 * motionScale : -0.045 * running * motionScale;
      this.torsoPivot.rotation.z = this.grounded ? cycle * 0.018 * locomotion * motionScale : 0;
      this.torsoPivot.scaling.y = 1 + Math.sin(this.idlePhase) * 0.006 * (1 - locomotion) * motionScale;
    }
    if (this.headPivot) {
      this.headPivot.rotation.z = this.grounded ? -cycle * 0.014 * locomotion * motionScale : 0;
      this.headPivot.rotation.x = crouched ? 0.08 * motionScale : 0.018 * running * motionScale;
    }
  }

  private applyJump(dt: number): void {
    const wasGrounded = this.grounded;
    const groundedNow = this.detectGround();
    if (groundedNow && this.verticalVelocity <= 0) {
      if (!wasGrounded) this.onLanded(Math.abs(this.verticalVelocity));
      this.grounded = true;
      this.groundGrace = 0.11;
      this.verticalVelocity = 0;
    } else {
      this.grounded = false;
      this.groundGrace = Math.max(0, this.groundGrace - dt);
    }

    if (consumeJumpPressed() && this.groundGrace > 0 && !isCrouched()) {
      this.verticalVelocity = 5.35;
      this.grounded = false;
      this.groundGrace = 0;
      // Presentation only — the jump arc above is unchanged by animation state.
      this.jumpAnimTimer = JUMP_START_SECONDS;
      this.emitHaptic([14]);
    }

    if (this.grounded && this.verticalVelocity <= 0) return;
    this.verticalVelocity = Math.max(-10.5, this.verticalVelocity - 14.5 * dt);
    this.collider.moveWithCollisions(new Vector3(0, this.verticalVelocity * dt, 0));

    if (this.verticalVelocity < 0 && this.detectGround()) {
      const landingSpeed = Math.abs(this.verticalVelocity);
      this.verticalVelocity = 0;
      this.grounded = true;
      this.groundGrace = 0.11;
      this.onLanded(landingSpeed);
    }
  }

  private onLanded(landingSpeed: number): void {
    // Every touchdown gets the landing pose; only loud ones make noise.
    this.jumpAnimTimer = 0;
    this.landingAnimTimer = LANDING_ANIM_SECONDS;
    // Presentation only, from this same existing landing truth — there is no
    // second landing detector, and this never feeds the noise model. Every
    // touchdown is audible; the gameplay noise gate below is unchanged.
    publishLocalAudio("landing", Math.min(1, landingSpeed / 8.5));
    if (landingSpeed < LANDING_NOISE_MIN_SPEED) return;
    const position = this.collider.position;
    reportPlayerLanding(position.x, position.y, position.z, landingSpeed);
    const impact = Math.min(1, Math.max(0, (landingSpeed - LANDING_NOISE_MIN_SPEED) / 5.5));
    this.landingCameraKick = -0.035 - impact * 0.055;
    if (impact > 0.52) this.emitHaptic([18, 12, 24]);
    else this.emitHaptic([16]);
  }

  private emitHaptic(pattern: number[]): void {
    if (document.visibilityState !== "visible") return;
    if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  }

  private detectGround(): boolean {
    const ray = new Ray(this.collider.position, new Vector3(0, -1, 0), 0.94);
    const hit = this.scene.pickWithRay(
      ray,
      (mesh) => mesh !== this.collider && mesh.checkCollisions && mesh.isEnabled(),
    );
    return Boolean(hit?.hit && hit.distance <= 0.94);
  }

  /**
   * Swaps in the authored hero when one is packaged. The procedural fallback is
   * only switched off once the import has fully succeeded, so any failure — a
   * missing file, a corrupt GLB, a rig without the required clips — leaves the
   * player looking at a working character rather than nothing at all.
   */
  private async tryLoadRuntimeModel(): Promise<void> {
    if (import.meta.env.VITE_CUMA_MODEL_PACKAGED !== "true") return;
    // Held outside the try so a failure part-way through can still clean up
    // everything the loader put into the scene.
    let loadedMeshes: readonly AbstractMesh[] = [];
    let loadedGroups: readonly AnimationGroup[] = [];
    try {
      await import("@babylonjs/loaders/glTF");
      const result = await SceneLoader.ImportMeshAsync("", "./assets/characters/", "cuma_runtime.glb", this.scene);
      loadedMeshes = result.meshes;
      loadedGroups = result.animationGroups;

      // The glTF loader auto-plays the first group; take ownership of all of
      // them before deciding what should actually be running.
      for (const group of loadedGroups) group.stop();

      const root = result.meshes[0];
      if (!root) throw new Error("character GLB contained no meshes");

      const resolved = resolveAnimationGroups(loadedGroups);
      if (!hasRequiredStates(resolved)) {
        throw new Error(`character GLB is missing required animation states: ${loadedGroups.map((group) => group.name).join(",")}`);
      }

      this.adoptImportedMeshes(loadedMeshes);
      root.scaling = new Vector3(1, 1, 1);
      root.position = Vector3.Zero();
      this.animation.setGroups(resolved);
      this.face.attach(loadedMeshes);

      for (const part of this.proceduralParts) part.setEnabled(false);
      this.imported = true;
      this.shadowRefreshClock = 0;
      this.animation.play("idle");
    } catch {
      this.discardImportedModel(loadedMeshes, loadedGroups);
    }
  }

  private adoptImportedMeshes(meshes: readonly AbstractMesh[]): void {
    for (const mesh of meshes) {
      if (mesh.parent === null) mesh.parent = this.visualRoot;
      mesh.isPickable = false;
      this.harmonizeMaterial(mesh);
      if (mesh instanceof Mesh) {
        mesh.receiveShadows = true;
        this.importedMeshes.push(mesh);
      }
    }
  }

  /**
   * Imported glTF materials arrive at full environment intensity, which makes
   * the hero read brighter than the world around them. Nothing else about the
   * authored material is touched.
   */
  private harmonizeMaterial(mesh: AbstractMesh): void {
    if (mesh.material instanceof PBRMaterial) {
      mesh.material.environmentIntensity = CHARACTER_ENVIRONMENT_INTENSITY;
    }
  }

  /**
   * Full rollback to the procedural fallback after a failed or partial import.
   * Takes what the loader produced rather than only what was adopted, so a
   * failure before adoption cannot strand meshes in the scene.
   */
  private discardImportedModel(
    loadedMeshes: readonly AbstractMesh[],
    loadedGroups: readonly AnimationGroup[],
  ): void {
    this.imported = false;
    this.face.reset();
    this.animation.clear();
    for (const group of loadedGroups) {
      group.stop();
      group.dispose();
    }
    for (const mesh of loadedMeshes) {
      if (!mesh.isDisposed()) mesh.dispose();
    }
    this.importedMeshes.length = 0;
    for (const part of this.proceduralParts) part.setEnabled(true);
  }

  /**
   * Picks the locomotion state from physics and input only. Nothing here writes
   * back, so animation can never change how the character moves or collides.
   */
  private resolveState(
    speed: number,
    sprinting: boolean,
    crouched: boolean,
    inCover: boolean,
  ): CharacterAnimationState {
    const moving = speed >= MOVING_SPEED;
    if (!this.grounded) return this.jumpAnimTimer > 0 ? "jump_start" : "airborne";
    if (this.landingAnimTimer > 0) return "landing";
    if (inCover) return moving ? "cover_locomotion" : "cover_idle";
    if (crouched) return moving ? "crouch_walk" : "crouch_idle";
    if (!moving) return "idle";
    return sprinting ? "run" : "walk";
  }

  private syncShadowCasters(dt: number): void {
    this.shadowRefreshClock -= dt;
    if (this.shadowRefreshClock > 0) return;
    this.shadowRefreshClock = 0.5;

    const sun = this.scene.getLightByName("sun");
    if (!(sun instanceof ShadowLight)) return;
    const shadowMap = sun.getShadowGenerator()?.getShadowMap();
    const renderList = shadowMap?.renderList;
    if (!renderList || renderList.length === 0) return;

    const characterMeshes = this.imported ? this.importedMeshes : this.proceduralParts;
    for (const mesh of characterMeshes) {
      if (mesh.isDisposed() || renderList.includes(mesh)) continue;
      renderList.push(mesh);
    }
  }

  private buildProceduralFallback(): void {
    const jacket = this.material("player-jacket", new Color3(0.045, 0.052, 0.061), 0.64, 0.08);
    const jacketEdge = this.material("player-jacket-edge", new Color3(0.075, 0.082, 0.09), 0.58, 0.12);
    const shirt = this.material("player-shirt", new Color3(0.68, 0.69, 0.67), 0.82, 0.0);
    const tie = this.material("player-tie", new Color3(0.12, 0.035, 0.032), 0.66, 0.04);
    const trouser = this.material("player-trouser", new Color3(0.055, 0.06, 0.067), 0.76, 0.02);
    const skin = this.material("player-skin", new Color3(0.54, 0.39, 0.29), 0.68, 0.0);
    const hair = this.material("player-hair", new Color3(0.035, 0.027, 0.022), 0.88, 0.0);
    const shoe = this.material("player-shoe", new Color3(0.018, 0.021, 0.026), 0.42, 0.28);

    this.torsoPivot = new TransformNode("player-torso-pivot", this.scene);
    this.torsoPivot.parent = this.visualRoot;
    this.torsoPivot.position = new Vector3(0, 1.12, 0);

    const torso = MeshBuilder.CreateCapsule("player-torso", { height: 0.7, radius: 0.255, tessellation: 10 }, this.scene);
    torso.parent = this.torsoPivot;
    torso.position = new Vector3(0, 0.06, 0);
    torso.scaling = new Vector3(1.08, 1, 0.72);
    torso.material = jacket;
    this.proceduralParts.push(torso);

    const shirtFront = MeshBuilder.CreateBox("player-shirt-front", { width: 0.16, height: 0.48, depth: 0.035 }, this.scene);
    shirtFront.parent = this.torsoPivot;
    shirtFront.position = new Vector3(0, 0.11, 0.205);
    shirtFront.material = shirt;
    this.proceduralParts.push(shirtFront);

    const tieFront = MeshBuilder.CreateBox("player-tie-front", { width: 0.045, height: 0.34, depth: 0.018 }, this.scene);
    tieFront.parent = this.torsoPivot;
    tieFront.position = new Vector3(0, 0.1, 0.228);
    tieFront.material = tie;
    this.proceduralParts.push(tieFront);

    for (const x of [-0.15, 0.15]) {
      const lapel = MeshBuilder.CreateBox(`player-lapel-${x}`, { width: 0.085, height: 0.38, depth: 0.025 }, this.scene);
      lapel.parent = this.torsoPivot;
      lapel.position = new Vector3(x, 0.15, 0.224);
      lapel.rotation.z = x < 0 ? -0.24 : 0.24;
      lapel.material = jacketEdge;
      this.proceduralParts.push(lapel);
    }

    const belt = MeshBuilder.CreateBox("player-belt", { width: 0.46, height: 0.055, depth: 0.29 }, this.scene);
    belt.parent = this.visualRoot;
    belt.position = new Vector3(0, 0.79, 0);
    belt.material = jacketEdge;
    this.proceduralParts.push(belt);

    const neck = MeshBuilder.CreateCylinder("player-neck", { height: 0.14, diameter: 0.16, tessellation: 10 }, this.scene);
    neck.parent = this.visualRoot;
    neck.position = new Vector3(0, 1.52, 0);
    neck.material = skin;
    this.proceduralParts.push(neck);

    this.headPivot = new TransformNode("player-head-pivot", this.scene);
    this.headPivot.parent = this.visualRoot;
    this.headPivot.position = new Vector3(0, 1.67, 0);

    const head = MeshBuilder.CreateSphere("player-head", { diameter: 0.38, segments: 12 }, this.scene);
    head.parent = this.headPivot;
    head.scaling = new Vector3(0.92, 1.08, 0.88);
    head.material = skin;
    this.proceduralParts.push(head);

    const hairCap = MeshBuilder.CreateSphere("player-hair", { diameter: 0.39, segments: 10 }, this.scene);
    hairCap.parent = this.headPivot;
    hairCap.position = new Vector3(0, 0.085, -0.006);
    hairCap.scaling = new Vector3(0.94, 0.52, 0.9);
    hairCap.material = hair;
    this.proceduralParts.push(hairCap);

    this.leftArmPivot = this.buildArm("left", -0.285, jacket, skin);
    this.rightArmPivot = this.buildArm("right", 0.285, jacket, skin);
    this.leftLegPivot = this.buildLeg("left", -0.13, trouser, shoe);
    this.rightLegPivot = this.buildLeg("right", 0.13, trouser, shoe);

    for (const part of this.proceduralParts) {
      part.isPickable = false;
      part.receiveShadows = true;
    }
  }

  private buildArm(side: "left" | "right", x: number, sleeve: PBRMaterial, skin: PBRMaterial): TransformNode {
    const pivot = new TransformNode(`player-${side}-shoulder`, this.scene);
    pivot.parent = this.visualRoot;
    pivot.position = new Vector3(x, 1.38, 0);

    const upper = MeshBuilder.CreateCapsule(`player-${side}-arm`, { height: 0.56, radius: 0.082, tessellation: 8 }, this.scene);
    upper.parent = pivot;
    upper.position = new Vector3(0, -0.265, 0);
    upper.material = sleeve;
    this.proceduralParts.push(upper);

    const cuff = MeshBuilder.CreateCylinder(`player-${side}-cuff`, { height: 0.08, diameter: 0.15, tessellation: 8 }, this.scene);
    cuff.parent = pivot;
    cuff.position = new Vector3(0, -0.53, 0);
    cuff.material = sleeve;
    this.proceduralParts.push(cuff);

    const hand = MeshBuilder.CreateSphere(`player-${side}-hand`, { diameter: 0.145, segments: 8 }, this.scene);
    hand.parent = pivot;
    hand.position = new Vector3(0, -0.61, 0.015);
    hand.scaling = new Vector3(0.82, 1.12, 0.78);
    hand.material = skin;
    this.proceduralParts.push(hand);
    return pivot;
  }

  private buildLeg(side: "left" | "right", x: number, trouser: PBRMaterial, shoe: PBRMaterial): TransformNode {
    const pivot = new TransformNode(`player-${side}-hip`, this.scene);
    pivot.parent = this.visualRoot;
    pivot.position = new Vector3(x, 0.78, 0);

    const leg = MeshBuilder.CreateCapsule(`player-${side}-leg`, { height: 0.72, radius: 0.105, tessellation: 8 }, this.scene);
    leg.parent = pivot;
    leg.position = new Vector3(0, -0.35, 0);
    leg.material = trouser;
    this.proceduralParts.push(leg);

    const shoeMesh = MeshBuilder.CreateBox(`player-${side}-shoe`, { width: 0.19, height: 0.12, depth: 0.34 }, this.scene);
    shoeMesh.parent = pivot;
    shoeMesh.position = new Vector3(0, -0.735, 0.075);
    shoeMesh.material = shoe;
    this.proceduralParts.push(shoeMesh);
    return pivot;
  }

  private material(name: string, color: Color3, roughness: number, metallic: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = 0.72;
    return material;
  }
}
