import type { SpycraftFactId } from "./spycraft";

export interface ObservationPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ObservationNode {
  readonly id: string;
  readonly factId: SpycraftFactId;
  readonly label: string;
  readonly position: ObservationPoint;
  readonly radius: number;
  readonly minimumFacingDot: number;
  readonly duration: number;
  readonly hint: string;
}

export interface ObservationView {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly forwardX: number;
  readonly forwardY: number;
  readonly forwardZ: number;
}

export interface ObservationEligibility {
  readonly eligible: boolean;
  readonly reason: "eligible" | "out-of-range" | "wrong-facing" | "occluded";
  readonly distance: number;
  readonly facingDot: number;
}

export const OBSERVATION_NODES: readonly ObservationNode[] = [
  {
    id: "market-break-window",
    factId: "staff_break_window",
    label: "PERSONEL MOLASI",
    position: { x: -2.8, y: 1.1, z: 8.2 },
    radius: 7.2,
    minimumFacingDot: 0.56,
    duration: 0.82,
    hint: "Personel koridorunda kısa bir boşluk oluşuyor.",
  },
  {
    id: "delivery-rotation",
    factId: "delivery_rotation",
    label: "SEVKİYAT DÖNGÜSÜ",
    position: { x: 9.6, y: 1.1, z: 15.9 },
    radius: 7.4,
    minimumFacingDot: 0.5,
    duration: 0.9,
    hint: "Araba, yükleme hattını kesmeden iki durak arasında ilerliyor.",
  },
  {
    id: "monitoring-shift-gap",
    factId: "monitoring_shift_gap",
    label: "KAMERA VARDİYA AÇIĞI",
    position: { x: -3.5, y: 3.25, z: 2.4 },
    radius: 8.4,
    minimumFacingDot: 0.58,
    duration: 0.86,
    hint: "İzleme ekranında kısa bir kör vardiya aralığı görünüyor.",
  },
  {
    id: "service-access-pattern",
    factId: "service_access_pattern",
    label: "SERVİS ERİŞİM DESENİ",
    position: { x: 6.15, y: 1.35, z: 17.2 },
    radius: 7.3,
    minimumFacingDot: 0.52,
    duration: 0.94,
    hint: "Servis nişi arka ofis defterine daha sakin bir geçiş veriyor.",
  },
];

export function observationEligibility(
  node: ObservationNode,
  viewer: ObservationPoint,
  view: ObservationView,
  wallClear: boolean,
): ObservationEligibility {
  const dx = node.position.x - viewer.x;
  const dy = node.position.y - viewer.y;
  const dz = node.position.z - viewer.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance > node.radius) {
    return { eligible: false, reason: "out-of-range", distance, facingDot: -1 };
  }

  const length = Math.hypot(dx, dz) || 1;
  const forwardLength = Math.hypot(view.forwardX, view.forwardZ) || 1;
  const facingDot = (dx / length) * (view.forwardX / forwardLength) + (dz / length) * (view.forwardZ / forwardLength);
  if (facingDot < node.minimumFacingDot) {
    return { eligible: false, reason: "wrong-facing", distance, facingDot };
  }
  if (!wallClear) {
    return { eligible: false, reason: "occluded", distance, facingDot };
  }
  return { eligible: true, reason: "eligible", distance, facingDot };
}

export function advanceObservationProgress(
  current: { readonly nodeId: string | null; readonly seconds: number },
  nodeId: string,
  dt: number,
  eligible: boolean,
  duration: number,
): { readonly nodeId: string; readonly seconds: number; readonly discovered: boolean } {
  const safeDt = Math.max(0, Math.min(0.25, dt));
  const seconds = current.nodeId === nodeId ? current.seconds : 0;
  if (!eligible) return { nodeId, seconds, discovered: false };
  const next = Math.min(Math.max(0, duration), seconds + safeDt);
  return { nodeId, seconds: next, discovered: next >= duration };
}

export function resetObservationProgress(): { readonly nodeId: null; readonly seconds: 0 } {
  return { nodeId: null, seconds: 0 };
}
