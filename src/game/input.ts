import "../movement.css";

export interface InputFrame {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  observePressed: boolean;
  interactPressed: boolean;
}

export const RUN_SPEED_MULTIPLIER = 1.42;
const WALK_INPUT_LIMIT = 0.82;

let runHeld = false;
let jumpQueued = false;

export function isRunHeld(): boolean {
  return runHeld;
}

export function consumeJumpPressed(): boolean {
  const pressed = jumpQueued;
  jumpQueued = false;
  return pressed;
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
  private runButton: HTMLButtonElement | null = null;
  private jumpButton: HTMLButtonElement | null = null;

  constructor() {
    const joystick = document.querySelector<HTMLElement>("#joystick");
    const knob = document.querySelector<HTMLElement>("#joystick-knob");
    const look = document.querySelector<HTMLElement>("#look-zone");
    const run = document.querySelector<HTMLButtonElement>("#run");
    const jump = document.querySelector<HTMLButtonElement>("#jump");
    const observe = document.querySelector<HTMLButtonElement>("#observe");
    const interact = document.querySelector<HTMLButtonElement>("#interact");
    if (!joystick || !knob || !look || !run || !jump || !observe || !interact) throw new Error("Mobile controls missing");
    this.runButton = run;
    this.jumpButton = jump;

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
      if (event && this.joystickPointer !== event.pointerId) return;
      this.joystickPointer = null;
      this.moveX = 0;
      this.moveY = 0;
      knob.style.transform = "translate(0px,0px)";
    };

    joystick.addEventListener("pointerdown", (event) => {
      if (this.joystickPointer !== null) return;
      this.joystickPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.joystickPointer) updateStick(event);
    });
    joystick.addEventListener("pointerup", releaseStick);
    joystick.addEventListener("pointercancel", releaseStick);
    joystick.addEventListener("lostpointercapture", releaseStick);

    look.addEventListener("pointerdown", (event) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = event.pointerId;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      look.setPointerCapture(event.pointerId);
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
      if (event.pointerId !== this.lookPointer) return;
      this.lookPointer = null;
    };
    look.addEventListener("pointerup", releaseLook);
    look.addEventListener("pointercancel", releaseLook);
    look.addEventListener("lostpointercapture", releaseLook);

    const releaseRun = () => {
      runHeld = false;
      run.classList.remove("pressed");
    };
    run.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      runHeld = true;
      run.classList.add("pressed");
      run.setPointerCapture(event.pointerId);
    });
    run.addEventListener("pointerup", releaseRun);
    run.addEventListener("pointercancel", releaseRun);
    run.addEventListener("lostpointercapture", releaseRun);

    const releaseJump = () => jump.classList.remove("pressed");
    jump.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      jumpQueued = true;
      jump.classList.add("pressed");
      jump.setPointerCapture(event.pointerId);
    });
    jump.addEventListener("pointerup", releaseJump);
    jump.addEventListener("pointercancel", releaseJump);
    jump.addEventListener("lostpointercapture", releaseJump);

    observe.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      this.observePressed = true;
    });
    interact.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      this.interactPressed = true;
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        runHeld = true;
        run.classList.add("pressed");
      }
      if (event.code === "Space" && !event.repeat) jumpQueued = true;
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") releaseRun();
    });

    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.reset();
    });
  }

  frame(): InputFrame {
    let frameMoveX = this.moveX;
    let frameMoveY = this.moveY;
    if (!runHeld) {
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
    this.joystickPointer = null;
    this.lookPointer = null;
    runHeld = false;
    jumpQueued = false;
    this.runButton?.classList.remove("pressed");
    this.jumpButton?.classList.remove("pressed");
  }
}
