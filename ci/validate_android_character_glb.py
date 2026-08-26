#!/usr/bin/env python3
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A


def load_glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != GLB_MAGIC:
        raise SystemExit(f"CHARACTER_GLB_INVALID: {path} is not a GLB file")

    version, declared_length = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise SystemExit(f"CHARACTER_GLB_INVALID: unsupported GLB version {version}")
    if declared_length != len(data):
        raise SystemExit(
            f"CHARACTER_GLB_INVALID: declared length {declared_length} != actual {len(data)}"
        )

    offset = 12
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk_end = offset + chunk_length
        if chunk_end > len(data):
            raise SystemExit("CHARACTER_GLB_INVALID: truncated chunk")
        if chunk_type == JSON_CHUNK:
            payload = data[offset:chunk_end].rstrip(b" \t\r\n\x00")
            try:
                parsed = json.loads(payload.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise SystemExit(f"CHARACTER_GLB_INVALID: malformed JSON chunk: {exc}") from exc
            if not isinstance(parsed, dict):
                raise SystemExit("CHARACTER_GLB_INVALID: JSON root is not an object")
            return parsed
        offset = chunk_end

    raise SystemExit("CHARACTER_GLB_INVALID: JSON chunk missing")


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets/characters/cuma_runtime.glb")
    if not path.is_file():
        raise SystemExit(f"CHARACTER_GLB_INVALID: missing {path}")

    doc = load_glb_json(path)
    meshes = doc.get("meshes") if isinstance(doc.get("meshes"), list) else []
    skins = doc.get("skins") if isinstance(doc.get("skins"), list) else []
    animations = doc.get("animations") if isinstance(doc.get("animations"), list) else []
    names = [str(item.get("name", "")) for item in animations if isinstance(item, dict)]
    normalized = " ".join(names).lower()

    if len(meshes) < 1:
        raise SystemExit("CHARACTER_GLB_INVALID: no mesh")
    if len(skins) < 1:
        raise SystemExit("CHARACTER_GLB_INVALID: no skin/rig")

    required = {
        "idle": ("idle",),
        "walk": ("walk", "locomotion"),
        "run": ("run", "sprint"),
    }
    missing = [label for label, aliases in required.items() if not any(alias in normalized for alias in aliases)]
    if missing:
        raise SystemExit(
            f"CHARACTER_GLB_INVALID: missing animation groups {','.join(missing)}; names={names}"
        )

    print(f"CHARACTER_GLB_OK path={path}")
    print(f"character_glb_bytes={path.stat().st_size}")
    print(f"character_meshes={len(meshes)}")
    print(f"character_skins={len(skins)}")
    print(f"character_animations={len(animations)}")
    print(f"character_animation_names={','.join(names)}")


if __name__ == "__main__":
    main()
