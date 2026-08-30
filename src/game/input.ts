import "../movement.css";
import "../mobile-ux.css";
import { PointerOwnership } from "./mobile-ux";

export const MOBILE_CONTEXT_STATE_EVENT = "cuma-mobile-context-state";

export interface MobileContextState {
  interactionAvailable?: boolean;
  observationActive?: boolean;
}

export function publishMobileContextState(state: MobileContextState): void {
  window.dispatchEvent(new CustomEvent<MobileContextState>(MOBILE_CONTEXT_STATE_EVENT, { detail: state }));
}

export interface InputFrame {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  observePressed: boolean;
  interactPressed: boolean;
}

export const RUN_SPEED_MULTIPLIER = 1.42;
export const CROUCH_SPEED_MULTIPLIER = 0.62;
const WALK_INPUT_LIMIT = 0.82;

let runHeld = false;
let jumpQueued = false;
let crouched = false;

export function isRunHeld(): boolean {
  return runHeld && !crouched;
}

export function isCrouched(): boolean {
  return crouched;
}

export function consumeJumpPressed(): boolean {
  const pressed = jumpQueued;
  jumpQueued = false;
  return pressed;
}

/** Peek at a queued jump without consuming it, so cover can exit first. */
export function isJumpQueued(): boolean {
  return jumpQueued;
}

export class MobileInput {
  private moveX = 0;
  private moveY = 0;
  private lookX = 0;
  private lookY = 0;
  private observePressed = false;
  private interactPressed = false;
  private joystickPointer: number | null = null;
  private lookPointer: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private readonly ownership = new PointerOwnership();
  private readonly contextStateHandler: (event: Event) => void;
  private interactionAvailable = false;
  private observationActive = false;
  private runButton: HTMLButtonElement | null = null;
  private jumpButton: HTMLButtonElement | null = null;

  constructor() {
    const joystick = document.querySelector<HTMLElement>("#joystick");
    const knob = document.querySelector<HTMLElement>("#joystick-knob");
    const look = document.querySelector<HTMLElement>("#look-zone");
    const run = document.querySelector<HTMLButtonElement>("#run");
    const jump = document.querySelector<HTMLButtonElement>("#jump");
    const crouch = document.querySelector<HTMLButtonElement>("#crouch");
    const observe = document.querySelector<HTMLButtonElement>("#observe");
    const interact = document.querySelector<HTMLButtonElement>("#interact");
    if (!joystick || !knob || !look || !run || !jump || !crouch || !observe || !interact) {
      throw new Error("Mobile controls missing");
    }
    this.runButton = run;
    this.jumpButton = jump;
    document.body.dataset.stance = "standing";
    crouch.setAttribute("aria-pressed", "false");

    const updateStick = (event: PointerEvent) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxRadius = rect.width * 0.34;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > maxRadius) {
        dx = (dx / len) * maxRadius;
        dy = (dy / len) * maxRadius;
      }
      const nx = dx / maxRadius;
      const ny = dy / maxRadius;
      const magnitude = Math.hypot(nx, ny);
      const deadZone = 0.12;
      if (magnitude <= deadZone) {
        this.moveX = 0;
        this.moveY = 0;
        knob.style.transform = "translate(0px,0px)";
        return;
      }
      const remapped = Math.min(1, (magnitude - deadZone) / (1 - deadZone));
      this.moveX = (nx / magnitude) * remapped;
      this.moveY = -(ny / magnitude) * remapped;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    };

    const releaseStick = (event?: PointerEvent) => {
      if (event && !this.ownership.release("joystick", event.pointerId)) return;
      this.joystickPointer = null;
      this.moveX = 0;
      this.moveY = 0;
      knob.style.transform = "translate(0px,0px)";
    };

    joystick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!this.ownership.claim("joystick", event.pointerId)) return;
      this.joystickPointer = event.pointerId;
      this.capture(joystick, event.pointerId);
      updateStick(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.joystickPointer) updateStick(event);
    });
    joystick.addEventListener("pointerup", releaseStick);
    joystick.addEventListener("pointercancel", releaseStick);
    joystick.addEventListener("lostpointercapture", releaseStick);

    look.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!this.ownership.claim("look", event.pointerId)) return;
      this.lookPointer = event.pointerId;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      this.capture(look, event.pointerId);
    });
    look.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.lookPointer) return;
      const dx = Math.max(-48, Math.min(48, event.clientX - this.lastLookX));
      const dy = Math.max(-48, Math.min(48, event.clientY - this.lastLookY));
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      this.lookX += dx;
      this.lookY += dy;
    });
    const releaseLook = (event: PointerEvent) => {
      if (!this.ownership.release("look", event.pointerId)) return;
      this.lookPointer = null;
    };
    look.addEventListener("pointerup", releaseLook);
    look.addEventListener("pointercancel", releaseLook);
    look.addEventListener("lostpointercapture", releaseLook);

    const releaseRun = (event?: PointerEvent) => {
      if (event && !this.ownership.release("run", event.pointerId)) return;
      runHeld = false;
      run.classList.remove("pressed");
    };
    run.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.ownership.claim("run", event.pointerId)) return;
      runHeld = true;
      run.classList.toggle("pressed", isRunHeld());
      this.capture(run, event.pointerId);
    });
    run.addEventListener("pointerup", releaseRun);
    run.addEventListener("pointercancel", releaseRun);
    run.addEventListener("lostpointercapture", releaseRun);

    const releaseJump = (event?: PointerEvent) => {
      if (event && !this.ownership.release("jump", event.pointerId)) return;
      jump.classList.remove("pressed");
    };
    jump.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.ownership.claim("jump", event.pointerId)) return;
      jumpQueued = true;
      jump.classList.add("pressed");
      this.capture(jump, event.pointerId);
    });
    jump.addEventListener("pointerup", releaseJump);
    jump.addEventListener("pointercancel", releaseJump);
    jump.addEventListener("lostpointercapture", releaseJump);

    crouch.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.ownership.claim("crouch", event.pointerId)) return;
      this.toggleCrouch(crouch, run);
      this.capture(crouch, event.pointerId);
    });
    const releaseCrouch = (event: PointerEvent) => {
      this.ownership.release("crouch", event.pointerId);
    };
    crouch.addEventListener("pointerup", releaseCrouch);
    crouch.addEventListener("pointercancel", releaseCrouch);
    crouch.addEventListener("lostpointercapture", releaseCrouch);

    observe.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.ownership.claim("observe", event.pointerId)) return;
      this.observePressed = true;
      this.capture(observe, event.pointerId);
    });
    const releaseObserve = (event: PointerEvent) => {
      this.ownership.release("observe", event.pointerId);
    };
    observe.addEventListener("pointerup", releaseObserve);
    observe.addEventListener("pointercancel", releaseObserve);
    observe.addEventListener("lostpointercapture", releaseObserve);

    interact.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.ownership.claim("interact", event.pointerId)) return;
      this.interactPressed = true;
      this.capture(interact, event.pointerId);
    });
    const releaseInteract = (event: PointerEvent) => {
      this.ownership.release("interact", event.pointerId);
    };
    interact.addEventListener("pointerup", releaseInteract);
    interact.addEventListener("pointercancel", releaseInteract);
    interact.addEventListener("lostpointercapture", releaseInteract);

    this.contextStateHandler = (event: Event) => {
      const state = (event as CustomEvent<MobileContextState>).detail;
      if (typeof state?.interactionAvailable === "boolean") this.setInteractionAvailable(state.interactionAvailable);
      if (typeof state?.observationActive === "boolean") this.setObservationActive(state.observationActive);
    };
    window.addEventListener(MOBILE_CONTEXT_STATE_EVENT, this.contextStateHandler);
    this.syncInteractionButton(interact);
    this.syncObservationButton(observe);

    window.addEventListener("keydown", (event) => {
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        runHeld = true;
        run.classList.toggle("pressed", isRunHeld());
      }
      if (event.code === "Space" && !event.repeat) jumpQueued = true;
      if (event.code === "KeyC" && !event.repeat) this.toggleCrouch(crouch, run);
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") releaseRun();
    });

    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.reset();
    });
    window.addEventListener("pagehide", () => this.reset());
    window.addEventListener("orientationchange", () => this.reset());
  }

  frame(): InputFrame {
    let frameMoveX = this.moveX;
    let frameMoveY = this.moveY;
    if (!isRunHeld()) {
      const magnitude = Math.hypot(frameMoveX, frameMoveY);
      if (magnitude > WALK_INPUT_LIMIT) {
        const scale = WALK_INPUT_LIMIT / magnitude;
        frameMoveX *= scale;
        frameMoveY *= scale;
      }
    }

    const frame = {
      moveX: frameMoveX,
      moveY: frameMoveY,
      lookX: this.lookX,
      lookY: this.lookY,
      observePressed: this.observePressed,
      interactPressed: this.interactPressed,
    };
    this.lookX = 0;
    this.lookY = 0;
    this.observePressed = false;
    this.interactPressed = false;
    return frame;
  }

  reset(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.observePressed = false;
    this.interactPressed = false;
    this.ownership.clear();
    this.joystickPointer = null;
    this.lookPointer = null;
    runHeld = false;
    jumpQueued = false;
    this.runButton?.classList.remove("pressed");
    this.jumpButton?.classList.remove("pressed");
  }

  setInteractionAvailable(available: boolean): void {
    if (this.interactionAvailable === available) return;
    this.interactionAvailable = available;
    const interact = document.querySelector<HTMLButtonElement>("#interact");
    if (interact) this.syncInteractionButton(interact);
    document.body.classList.toggle("interaction-ready", available);
  }

  setObservationActive(active: boolean): void {
    if (this.observationActive === active) return;
    this.observationActive = active;
    publishMobileContextState({ observationActive: active });
    const observe = document.querySelector<HTMLButtonElement>("#observe");
    if (observe) this.syncObservationButton(observe);
  }

  private syncInteractionButton(button: HTMLButtonElement): void {
    button.disabled = !this.interactionAvailable;
    button.classList.toggle("available", this.interactionAvailable);
    button.setAttribute("aria-disabled", String(!this.interactionAvailable));
  }

  private syncObservationButton(button: HTMLButtonElement): void {
    button.classList.toggle("active", this.observationActive);
    button.setAttribute("aria-pressed", String(this.observationActive));
  }

  private toggleCrouch(button: HTMLButtonElement, run: HTMLButtonElement): void {
    crouched = !crouched;
    document.body.dataset.stance = crouched ? "crouched" : "standing";
    document.body.classList.toggle("crouched", crouched);
    button.classList.toggle("active", crouched);
    button.setAttribute("aria-pressed", String(crouched));
    run.classList.toggle("pressed", isRunHeld());
  }

  private capture(element: HTMLElement, pointerId: number): void {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Pointer capture can race with a cancelled Android touch; ownership
      // still remains explicit and blur/orientation will release it.
    }
  }
}