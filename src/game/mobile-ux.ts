export type ControlSize = "COMPACT" | "STANDARD" | "LARGE";
export type ControlHandedness = "RIGHT" | "LEFT";
export type PointerOwner = "joystick" | "look" | "run" | "jump" | "crouch" | "observe" | "interact";

export interface MobileControlLayout {
  joystickSize: number;
  knobSize: number;
  actionSize: number;
  actionGap: number;
  actionWidth: number;
  sideClearance: number;
  clamped: boolean;
}

const CONTROL_LAYOUTS: Record<ControlSize, Omit<MobileControlLayout, "clamped">> = {
  COMPACT: {
    joystickSize: 94,
    knobSize: 38,
    actionSize: 38,
    actionGap: 5,
    actionWidth: 184,
    sideClearance: 104,
  },
  STANDARD: {
    joystickSize: 112,
    knobSize: 44,
    actionSize: 44,
    actionGap: 7,
    actionWidth: 204,
    sideClearance: 116,
  },
  LARGE: {
    joystickSize: 132,
    knobSize: 52,
    actionSize: 50,
    actionGap: 9,
    actionWidth: 232,
    sideClearance: 132,
  },
};

/**
 * Resolve the physical control dimensions for a viewport without changing the
 * stored preference. Small landscape screens use a safe effective clamp rather
 * than allowing the joystick and action cluster to collide.
 */
export function resolveMobileControlLayout(
  size: ControlSize,
  viewportWidth: number,
  viewportHeight: number,
): MobileControlLayout {
  const requested = CONTROL_LAYOUTS[size];
  const heightLimit = Math.max(82, viewportHeight - 68);
  const widthLimit = viewportWidth <= 700
    ? Math.min(204, Math.max(168, Math.floor((viewportWidth - requested.sideClearance * 2) * 0.62)))
    : Math.max(168, Math.floor((viewportWidth - requested.sideClearance * 2) * 0.62));
  const joystickSize = Math.min(requested.joystickSize, heightLimit);
  const knobSize = Math.min(requested.knobSize, Math.max(32, joystickSize * 0.46));
  const actionSize = Math.min(requested.actionSize, Math.max(36, viewportHeight - 74));
  const actionWidth = Math.min(requested.actionWidth, widthLimit);
  const sideClearance = Math.min(
    requested.sideClearance,
    Math.max(88, Math.floor((viewportWidth - actionWidth) * 0.28)),
  );
  return {
    joystickSize,
    knobSize,
    actionSize,
    actionGap: requested.actionGap,
    actionWidth,
    sideClearance,
    clamped: joystickSize !== requested.joystickSize
      || knobSize !== requested.knobSize
      || actionSize !== requested.actionSize
      || actionWidth !== requested.actionWidth
      || sideClearance !== requested.sideClearance,
  };
}

/**
 * One pointer can own one control and each control can own one pointer. A
 * second touch is rejected without disturbing the first touch's state.
 */
export class PointerOwnership {
  private readonly owners = new Map<PointerOwner, number>();
  private readonly pointers = new Map<number, PointerOwner>();

  claim(owner: PointerOwner, pointerId: number): boolean {
    if (this.owners.has(owner) || this.pointers.has(pointerId)) return false;
    this.owners.set(owner, pointerId);
    this.pointers.set(pointerId, owner);
    return true;
  }

  release(owner: PointerOwner, pointerId: number): boolean {
    if (this.owners.get(owner) !== pointerId) return false;
    this.owners.delete(owner);
    this.pointers.delete(pointerId);
    return true;
  }

  owns(owner: PointerOwner, pointerId: number): boolean {
    return this.owners.get(owner) === pointerId;
  }

  ownerOf(pointerId: number): PointerOwner | null {
    return this.pointers.get(pointerId) ?? null;
  }

  clear(): void {
    this.owners.clear();
    this.pointers.clear();
  }

  get size(): number {
    return this.owners.size;
  }
}

/** Apply the vertical look preference once, at the input-to-camera boundary. */
export function applyLookY(value: number, invertLookY: boolean): number {
  return invertLookY ? -value : value;
}

export function controlLayoutFor(size: ControlSize): Omit<MobileControlLayout, "clamped"> {
  return { ...CONTROL_LAYOUTS[size] };
}