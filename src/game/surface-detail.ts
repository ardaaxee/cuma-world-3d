import {
  DynamicTexture,
  PBRMaterial,
  Scene,
  Texture,
} from "@babylonjs/core";

type SurfaceKind = "mineral" | "asphalt" | "wood" | "cardboard" | "foliage";

type SurfaceRule = {
  kind: SurfaceKind;
  scale: number;
};

const TEXTURE_SIZE = 64;

export function applyProceduralSurfaceDetails(scene: Scene): number {
  let applied = 0;
  for (const material of scene.materials) {
    if (!(material instanceof PBRMaterial) || material.albedoTexture) continue;
    const rule = classify(material.name);
    if (!rule) continue;

    const texture = buildDetailTexture(scene, material.name, rule.kind);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.uScale = rule.scale;
    texture.vScale = rule.scale;
    material.albedoTexture = texture;
    applied += 1;
  }
  return applied;
}

function classify(name: string): SurfaceRule | null {
  const value = name.toLowerCase();
  if (/glass|light|lamp|sign|emissive|player|npc|skin|hair|shirt|tie|shoe/.test(value)) return null;
  if (/asphalt/.test(value)) return { kind: "asphalt", scale: 10 };
  if (/wood|crate/.test(value)) return { kind: "wood", scale: 4.5 };
  if (/cardboard|package/.test(value)) return { kind: "cardboard", scale: 5.5 };
  if (/foliage|plant/.test(value)) return { kind: "foliage", scale: 7 };
  if (/concrete|sidewalk|plaster|floor|ceiling/.test(value)) return { kind: "mineral", scale: 6 };
  return null;
}

function buildDetailTexture(scene: Scene, name: string, kind: SurfaceKind): DynamicTexture {
  const texture = new DynamicTexture(
    `surface-detail-${name}`,
    { width: TEXTURE_SIZE, height: TEXTURE_SIZE },
    scene,
    false,
  );
  const context = texture.getContext();
  const seed = hash(name);
  const random = mulberry32(seed);

  context.fillStyle = "rgb(224,224,224)";
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  if (kind === "wood") drawWood(context, random);
  else if (kind === "asphalt") drawAsphalt(context, random);
  else if (kind === "cardboard") drawCardboard(context, random);
  else if (kind === "foliage") drawFoliage(context, random);
  else drawMineral(context, random);

  texture.update(false);
  return texture;
}

function drawMineral(context: CanvasRenderingContext2D, random: () => number): void {
  for (let i = 0; i < 360; i += 1) {
    const value = Math.round(195 + random() * 48);
    const alpha = 0.08 + random() * 0.13;
    context.fillStyle = `rgba(${value},${value},${value},${alpha})`;
    const size = random() > 0.88 ? 2 : 1;
    context.fillRect(
      Math.floor(random() * TEXTURE_SIZE),
      Math.floor(random() * TEXTURE_SIZE),
      size,
      size,
    );
  }
}

function drawAsphalt(context: CanvasRenderingContext2D, random: () => number): void {
  for (let i = 0; i < 520; i += 1) {
    const light = random() > 0.56;
    const value = light ? 228 : 178;
    context.fillStyle = `rgba(${value},${value},${value},${0.08 + random() * 0.16})`;
    const size = random() > 0.95 ? 2 : 1;
    context.fillRect(
      Math.floor(random() * TEXTURE_SIZE),
      Math.floor(random() * TEXTURE_SIZE),
      size,
      size,
    );
  }
}

function drawWood(context: CanvasRenderingContext2D, random: () => number): void {
  for (let y = 3; y < TEXTURE_SIZE; y += 7) {
    const offset = Math.floor(random() * 4) - 2;
    context.fillStyle = "rgba(112,112,112,0.13)";
    context.fillRect(0, y + offset, TEXTURE_SIZE, 1);
  }
  for (let i = 0; i < 70; i += 1) {
    const y = Math.floor(random() * TEXTURE_SIZE);
    const width = 3 + Math.floor(random() * 13);
    const x = Math.floor(random() * Math.max(1, TEXTURE_SIZE - width));
    context.fillStyle = `rgba(245,245,245,${0.025 + random() * 0.055})`;
    context.fillRect(x, y, width, 1);
  }
}

function drawCardboard(context: CanvasRenderingContext2D, random: () => number): void {
  for (let i = 0; i < 150; i += 1) {
    const y = Math.floor(random() * TEXTURE_SIZE);
    context.fillStyle = `rgba(175,175,175,${0.03 + random() * 0.08})`;
    context.fillRect(0, y, TEXTURE_SIZE, 1);
  }
}

function drawFoliage(context: CanvasRenderingContext2D, random: () => number): void {
  for (let i = 0; i < 260; i += 1) {
    const value = Math.round(185 + random() * 65);
    context.fillStyle = `rgba(${value},${value},${value},${0.05 + random() * 0.12})`;
    const size = 1 + Math.floor(random() * 2);
    context.fillRect(
      Math.floor(random() * TEXTURE_SIZE),
      Math.floor(random() * TEXTURE_SIZE),
      size,
      size,
    );
  }
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
