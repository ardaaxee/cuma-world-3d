#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1] / "game"
GLB = ROOT / "assets" / "characters" / "cuma_high.glb"


def read_document(data: bytes) -> dict:
    if data[:4] != b"glTF" or int.from_bytes(data[4:8], "little") != 2:
        raise SystemExit("CUMA_HIGH_GLTF: invalid GLB")
    offset = 12
    while offset + 8 <= len(data):
        length = int.from_bytes(data[offset:offset + 4], "little")
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        if kind == b"JSON":
            return json.loads(payload.rstrip(b" \t\r\n\0").decode("utf-8"))
        offset += 8 + length
    raise SystemExit("CUMA_HIGH_GLTF: JSON chunk not found")


def main() -> None:
    if not GLB.is_file():
        raise SystemExit(f"CUMA_HIGH_GLTF: missing {GLB}")
    doc = read_document(GLB.read_bytes())
    materials = doc.get("materials", [])
    meshes = doc.get("meshes", [])
    skins = doc.get("skins", [])
    animations = doc.get("animations", [])
    images = doc.get("images", [])
    textures = doc.get("textures", [])

    print(
        "CUMA_HIGH_GLTF_COUNTS",
        f"materials={len(materials)} meshes={len(meshes)} skins={len(skins)} ",
        f"animations={len(animations)} images={len(images)} textures={len(textures)}",
    )
    if len(materials) < 3:
        raise SystemExit("CUMA_HIGH_GLTF: expected at least 3 material regions")
    if len(meshes) < 3:
        raise SystemExit("CUMA_HIGH_GLTF: expected at least 3 meshes for body/clothing/shoes")
    if len(skins) < 1:
        raise SystemExit("CUMA_HIGH_GLTF: missing skin")
    if len(animations) < 4:
        raise SystemExit("CUMA_HIGH_GLTF: expected idle/walk/run/wave animation library")
    if len(images) < 1 or len(textures) < 1:
        raise SystemExit("CUMA_HIGH_GLTF: expected embedded skin/clothing textures")

    animation_names = [str(a.get("name", "")).lower() for a in animations]
    print("CUMA_HIGH_ANIMATIONS", animation_names)
    for token in ("idle", "walk", "run", "wave"):
        if not any(token in name for name in animation_names):
            raise SystemExit(f"CUMA_HIGH_GLTF: missing animation token {token}")

    textured_materials = 0
    for idx, mat in enumerate(materials):
        pbr = mat.get("pbrMetallicRoughness", {})
        texture_index = pbr.get("baseColorTexture", {}).get("index")
        if texture_index is not None:
            textured_materials += 1
        print(
            "CUMA_HIGH_MATERIAL",
            f"index={idx}",
            f"name={mat.get('name', '')!r}",
            f"texture={texture_index if texture_index is not None else 'none'}",
            f"roughness={pbr.get('roughnessFactor', 1.0)}",
        )
    if textured_materials < 2:
        raise SystemExit("CUMA_HIGH_GLTF: too few textured material regions")

    primitive_count = 0
    for idx, mesh in enumerate(meshes):
        primitives = mesh.get("primitives", [])
        primitive_count += len(primitives)
        print(f"CUMA_HIGH_MESH index={idx} name={mesh.get('name','')!r} primitives={len(primitives)}")
    if primitive_count < 3:
        raise SystemExit("CUMA_HIGH_GLTF: expected multiple skinned primitives")

    print("CUMA HIGH CHARACTER INSPECTION: PASS")


if __name__ == "__main__":
    main()
