import type { Mesh } from "@babylonjs/core";
import { CART_POSITIONS } from "./mission-objects";

/**
 * The delivery cart.
 *
 * It moves between a small number of authored stops along the service alley —
 * no dragging, no physics engine, no freeform placement. Each push slides it to
 * the next stop, which changes a real sightline down the alley and leaves a
 * crate-height cover object wherever it stops.
 *
 * Collision stays on throughout: the cart is a solid object the directional
 * cover system can find, and the authored stops sit beside the route rather
 * than across it, so no path is ever closed.
 */

const SLIDE_SPEED = 1.35;
/** Cart movement is a real, audible event, but a much quieter one than a door. */
export const CART_NOISE_LOUDNESS = 0.34;

let cart: Mesh | null = null;
let stopIndex = 0;
let targetIndex = 0;
let moving = false;

export function registerDeliveryCart(mesh: Mesh): void {
  cart = mesh;
  stopIndex = 0;
  targetIndex = 0;
  moving = false;
  const start = CART_POSITIONS[0];
  if (start) mesh.position.copyFrom(start);
}

export function isCartMoving(): boolean {
  return moving;
}

/** Where the cart currently is, for the FIELD FOCUS marker. */
export function cartPosition(): { x: number; y: number; z: number } | null {
  if (!cart) return null;
  const position = cart.position;
  return { x: position.x, y: position.y, z: position.z };
}

/**
 * Starts a push to the next authored stop. Returns the point the movement
 * should be heard from, or null when the cart is already moving.
 */
export function pushDeliveryCart(): { x: number; y: number; z: number } | null {
  if (!cart || moving) return null;
  targetIndex = (stopIndex + 1) % CART_POSITIONS.length;
  moving = true;
  const position = cart.position;
  return { x: position.x, y: position.y, z: position.z };
}

/** Advances the slide. Does nothing at all while the cart is parked. */
export function updateDeliveryCart(dt: number): void {
  if (!cart || !moving) return;
  const destination = CART_POSITIONS[targetIndex];
  if (!destination) {
    moving = false;
    return;
  }

  const position = cart.position;
  const deltaZ = destination.z - position.z;
  const deltaX = destination.x - position.x;
  const distance = Math.hypot(deltaX, deltaZ);
  const step = SLIDE_SPEED * dt;

  if (distance <= step || distance <= 0.001) {
    position.copyFrom(destination);
    stopIndex = targetIndex;
    moving = false;
    return;
  }
  position.x += (deltaX / distance) * step;
  position.z += (deltaZ / distance) * step;
}

export function resetDeliveryCart(): void {
  stopIndex = 0;
  targetIndex = 0;
  moving = false;
  const start = CART_POSITIONS[0];
  if (cart && start) cart.position.copyFrom(start);
}
