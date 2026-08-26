import { Mesh, Ray, Scene, Vector3 } from "@babylonjs/core";

export interface CameraCollisionResult {
  position: Vector3;
  blocked: boolean;
  distance: number;
}

const CAMERA_RADIUS = 0.22;
const SURFACE_MARGIN = 0.18;
const MIN_CAMERA_DISTANCE = 0.72;

export function resolveThirdPersonCameraCollision(
  scene: Scene,
  target: Vector3,
  desired: Vector3,
  cameraRight: Vector3,
  ignoreMesh: Mesh,
): CameraCollisionResult {
  const centerPath = desired.subtract(target);
  const centerDistance = centerPath.length();
  if (centerDistance <= 0.001) {
    return { position: desired.clone(), blocked: false, distance: 0 };
  }

  const right = cameraRight.lengthSquared() > 0.0001 ? cameraRight.normalize() : Vector3.Right();
  const up = Vector3.Up();
  const samples = [
    Vector3.Zero(),
    right.scale(CAMERA_RADIUS),
    right.scale(-CAMERA_RADIUS),
    up.scale(CAMERA_RADIUS * 0.82),
    up.scale(-CAMERA_RADIUS * 0.72),
  ];

  let allowedFraction = 1;
  for (const offset of samples) {
    const sampleTarget = desired.add(offset);
    const path = sampleTarget.subtract(target);
    const distance = path.length();
    if (distance <= 0.001) continue;
    const direction = path.scale(1 / distance);
    const hit = scene.pickWithRay(
      new Ray(target, direction, distance),
      (mesh) => mesh instanceof Mesh && mesh.checkCollisions && mesh !== ignoreMesh,
    );
    if (!hit?.hit || typeof hit.distance !== "number") continue;
    const safeHitDistance = Math.max(MIN_CAMERA_DISTANCE, hit.distance - SURFACE_MARGIN);
    allowedFraction = Math.min(allowedFraction, safeHitDistance / distance);
  }

  if (allowedFraction >= 0.999) {
    return { position: desired.clone(), blocked: false, distance: centerDistance };
  }

  const resolvedDistance = Math.max(MIN_CAMERA_DISTANCE, centerDistance * allowedFraction);
  const resolved = target.add(centerPath.scale(resolvedDistance / centerDistance));
  return { position: resolved, blocked: true, distance: resolvedDistance };
}
