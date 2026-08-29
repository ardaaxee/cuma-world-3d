import "../stealth-signals.css";
import type { NoiseSample } from "./noise";
import type { FacilityState } from "./facility-security";
import { facilityStateLabel } from "./facility-security";
import type { ZoneSnapshot } from "./zones";

/**
 * Compact readout for the two systemic signals the player cannot otherwise see:
 * how loud they currently are, and how much pressure the current zone is
 * building. It sits under the existing awareness pill and writes to the DOM only
 * when a displayed bucket actually changes.
 */

const NOISE_LABELS = ["SESSİZ", "DÜŞÜK", "ORTA", "YÜKSEK"] as const;
const NOISE_AUDIBLE = 0.09;
const NOISE_BUCKET_EDGES = [NOISE_AUDIBLE, 0.3, 0.62] as const;
const ZONE_LABELS: Record<ZoneSnapshot["zone"], string> = {
  PUBLIC: "SATIŞ ALANI",
  STAFF: "PERSONEL",
  RESTRICTED: "KISITLI",
};

const REFRESH_SECONDS = 0.12;
const SUSPICION_STEPS = 20;

function noiseBucket(loudness: number): number {
  let bucket = 0;
  for (const edge of NOISE_BUCKET_EDGES) {
    if (loudness >= edge) bucket += 1;
  }
  return bucket;
}

export class StealthSignalsHud {
  private readonly root: HTMLElement;
  private readonly noiseFill: HTMLElement;
  private readonly noiseLabel: HTMLElement;
  private readonly zoneChip: HTMLElement;
  private readonly zoneFill: HTMLElement;
  private readonly facilityChip: HTMLElement;
  private readonly facilityLabel: HTMLElement;
  private publishedFacility = "";
  private clock = 0;
  private lastNoiseBucket = -1;
  private lastZoneKey = "";
  private lastSuspicionStep = -1;
  private lastVisible: boolean | null = null;

  constructor() {
    const existing = document.querySelector<HTMLElement>("#stealth-signals");
    if (existing) {
      this.root = existing;
    } else {
      this.root = document.createElement("div");
      this.root.id = "stealth-signals";
      this.root.className = "stealth-signals hidden";
      this.root.innerHTML = [
        '<span class="stealth-noise"><b data-role="noise-label">SESSİZ</b><i><b data-role="noise-fill"></b></i></span>',
        '<span class="stealth-zone hidden" data-role="zone"><b data-role="zone-label">SATIŞ ALANI</b><i><b data-role="zone-fill"></b></i></span>',
        '<span class="stealth-facility hidden" data-role="facility"><b data-role="facility-label">TESİS · NORMAL</b></span>',
      ].join("");
      document.body.appendChild(this.root);
    }

    this.noiseLabel = this.root.querySelector<HTMLElement>('[data-role="noise-label"]')!;
    this.noiseFill = this.root.querySelector<HTMLElement>('[data-role="noise-fill"]')!;
    this.zoneChip = this.root.querySelector<HTMLElement>('[data-role="zone"]')!;
    this.zoneFill = this.root.querySelector<HTMLElement>('[data-role="zone-fill"]')!;
    this.facilityChip = this.root.querySelector<HTMLElement>('[data-role="facility"]')!;
    this.facilityLabel = this.root.querySelector<HTMLElement>('[data-role="facility-label"]')!;
  }

  update(dt: number, noise: NoiseSample, zone: ZoneSnapshot, active: boolean): void {
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = REFRESH_SECONDS;

    const showZone = zone.zone !== "PUBLIC" || zone.suspicion > 0.01;
    const showFacility = this.publishedFacility !== "" && this.publishedFacility !== "CALM";
    const visible = active && (noise.loudness > NOISE_AUDIBLE || showZone || showFacility);
    if (visible !== this.lastVisible) {
      this.lastVisible = visible;
      this.root.classList.toggle("hidden", !visible);
    }
    if (!visible) return;

    const bucket = noiseBucket(noise.loudness);
    if (bucket !== this.lastNoiseBucket) {
      this.lastNoiseBucket = bucket;
      this.noiseLabel.textContent = NOISE_LABELS[bucket] ?? NOISE_LABELS[0];
      this.noiseFill.style.width = `${bucket * 33}%`;
      this.root.dataset.noise = String(bucket);
    }

    const zoneKey = `${zone.zone}|${zone.accessGranted}|${showZone}`;
    if (this.lastZoneKey !== zoneKey) {
      this.lastZoneKey = zoneKey;
      this.zoneChip.classList.toggle("hidden", !showZone);
      this.root.dataset.zone = zone.zone.toLowerCase();
      const label = this.zoneChip.querySelector<HTMLElement>('[data-role="zone-label"]');
      if (label) label.textContent = `${ZONE_LABELS[zone.zone]}${zone.accessGranted ? " · YETKİLİ" : ""}`;
    }

    const step = Math.round(zone.suspicion * SUSPICION_STEPS);
    if (step !== this.lastSuspicionStep) {
      this.lastSuspicionStep = step;
      this.zoneFill.style.width = `${(step / SUSPICION_STEPS) * 100}%`;
    }
  }

  /** Facility state shares this pill instead of adding another meter. */
  setFacility(state: FacilityState, active: boolean): void {
    const key = active ? state : "";
    if (key === this.publishedFacility) return;
    this.publishedFacility = key;
    this.facilityChip.classList.toggle("hidden", !key);
    this.root.dataset.facility = key ? state.toLowerCase() : "";
    if (key) this.facilityLabel.textContent = facilityStateLabel(state);
  }

  setHidden(hidden: boolean): void {
    if (!hidden) return;
    this.lastVisible = false;
    this.root.classList.add("hidden");
  }
}
