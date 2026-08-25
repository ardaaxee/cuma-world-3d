#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1] / "game"
GLB = ROOT / "assets" / "characters" / "cuma.glb"


def read_document(data: bytes) -> dict:
    if data[:4] != b"glTF" or int.from_bytes(data[4:8], "little") != 2:
        raise SystemExit("CUMA_CHARACTER_GLTF: invalid GLB")
    offset = 12
    while offset + 8 <= len(data):
        length = int.from_bytes(data[offset:offset + 4], "little")
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        if kind == b"JSON":
            return json.loads(payload.rstrip(b" \t\r\n\0").decode("utf-8"))
        offset += 8 + length
    raise SystemExit("CUMA_CHARACTER_GLTF: JSON chunk not found")


def main() -> None:
    if not GLB.is_file():
        raise SystemExit(f"CUMA_CHARACTER_GLTF: missing {GLB}")
    doc = read_document(GLB.read_bytes())
    materials = doc.get("materials", [])
    meshes = doc.get("meshes", [])
    nodes = doc.get("nodes", [])

    print(f"CUMA_CHARACTER_GLTF_COUNTS materials={len(materials)} meshes={len(meshes)} nodes={len(nodes)} skins={len(doc.get('skins', []))}")
    for idx, mat in enumerate(materials):
        pbr = mat.get("pbrMetallicRoughness", {})
        factor = pbr.get("baseColorFactor", [1, 1, 1, 1])
        print(
            "CUMA_CHARACTER_MATERIAL",
            f"index={idx}",
            f"name={mat.get('name', '')!r}",
            f"base={factor}",
            f"metallic={pbr.get('metallicFactor', 1.0)}",
            f"roughness={pbr.get('roughnessFactor', 1.0)}",
            f"texture={pbr.get('baseColorTexture', {}).get('index', 'none')}",
        )

    material_use: dict[int, list[str]] = {}
    for mesh_idx, mesh in enumerate(meshes):
        primitives = mesh.get("primitives", [])
        print(f"CUMA_CHARACTER_MESH index={mesh_idx} name={mesh.get('name', '')!r} primitives={len(primitives)}")
        for primitive_idx, primitive in enumerate(primitives):
            mat_idx = int(primitive.get("material", -1))
            attrs = sorted(primitive.get("attributes", {}).keys())
            print(
                "CUMA_CHARACTER_PRIMITIVE",
                f"mesh={mesh_idx}",
                f"primitive={primitive_idx}",
                f"material={mat_idx}",
                f"attrs={attrs}",
            )
            material_use.setdefault(mat_idx, []).append(f"mesh{mesh_idx}/prim{primitive_idx}")

    for node_idx, node in enumerate(nodes):
        if "mesh" in node:
            print(
                "CUMA_CHARACTER_NODE_MESH",
                f"node={node_idx}",
                f"name={node.get('name', '')!r}",
                f"mesh={node.get('mesh')}",
                f"skin={node.get('skin', 'none')}",
            )

    for mat_idx, uses in sorted(material_use.items()):
        print(f"CUMA_CHARACTER_MATERIAL_USE material={mat_idx} uses={','.join(uses)}")

    print("CUMA CHARACTER GLTF INSPECTION: PASS")


if __name__ == "__main__":
    main()
