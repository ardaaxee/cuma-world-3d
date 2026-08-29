#!/usr/bin/env python3
"""Audit and validate the packaged CUMA hero character GLB.

This is deliberately dependency-free: it parses the glTF 2.0 binary container
directly (JSON chunk + BIN chunk) and reads PNG/JPEG headers by hand so CI does
not need Pillow or a glTF library.

It reports a full CHARACTER REPORT and then enforces two separate contracts:

  1. hard requirements  -> non-zero exit, CI fails, asset must not ship
  2. capability notes   -> printed, never fatal; the runtime degrades gracefully

The runtime (`src/game/character.ts`) resolves animation groups by name using
the same alias table below. Keep the two in sync.
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path
from typing import Any, Iterable, Sequence

GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942

# Canonical animation contract, mirroring `src/game/character-animation.ts`.
# Change both together.
#
# Resolution runs most-specific-first and each clip may only be claimed once.
# That ordering is load-bearing: "crouch_walk" contains "walk", so if the
# generic states resolved first they would steal the specific clips.
RESOLUTION_ORDER: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("optional", "cover_locomotion", ("cover_locomotion", "cover_walk", "cover_move", "wall_walk")),
    ("optional", "cover_idle", ("cover_idle", "coveridle", "cover", "wall_idle")),
    ("optional", "turn_look", ("turn", "look", "aim_offset", "additive")),
    ("supported", "crouch_walk", ("crouch_walk", "crouchwalk", "crouch_locomotion", "sneak_walk", "sneak")),
    ("supported", "crouch_idle", ("crouch_idle", "crouchidle", "crouch", "sneak_idle")),
    ("supported", "jump_start", ("jump_start", "jumpstart", "takeoff", "jump")),
    ("supported", "landing", ("landing", "land", "touchdown")),
    ("supported", "airborne", ("airborne", "falling", "fall", "inair", "air")),
    ("required", "run", ("run", "sprint", "jog")),
    ("required", "walk", ("walk", "locomotion")),
    ("required", "idle", ("idle", "stand", "breath", "rest")),
)

REQUIRED_STATES: tuple[str, ...] = tuple(
    state for tier, state, _ in RESOLUTION_ORDER if tier == "required"
)

# Facial-life morph contract. Absent targets are a capability note, never fatal.
FACIAL_MORPHS: dict[str, tuple[str, ...]] = {
    "blink": ("blink", "eyesclosed", "eyes_closed", "eyeblink"),
    "blink_left": ("blink_l", "blinkleft", "eyeblinkleft", "eyeblink_l"),
    "blink_right": ("blink_r", "blinkright", "eyeblinkright", "eyeblink_r"),
    "eye_look": ("eyelook", "eye_look", "eyesup", "eyesdown", "eyeslookin", "eyeslookout"),
}

# --- Android budgets -------------------------------------------------------
# Derived from the measured baseline of the pinned CC0 fallback (audited
# 2026-08-29, MakeHuman/MPFB `suited.glb`):
#
#   6,675,064 B | 3 meshes | 3 primitives | 19,166 verts | 35,492 tris
#   1 skin | 53 joints | 3 materials | 5 images, all 1024x1024 PNG
#
# Each ceiling is roughly 2-3x that baseline: enough headroom for an authored
# hero with finger bones, hair cards, eyes and separate wardrobe pieces, while
# still refusing a desktop-class asset on an Android-first runtime.
MAX_GLB_BYTES = 24 * 1024 * 1024
MAX_TRIANGLES = 120_000
MAX_VERTICES = 90_000
MAX_MESHES = 16
MAX_PRIMITIVES = 32
# Material count drives skinned draw calls, so it stays the tightest budget.
MAX_MATERIALS = 12
MAX_IMAGES = 24
MAX_JOINTS = 120
# 8K is forbidden outright and 4K is an error: Android has no reason to pay for
# it here. Above 1K is a visible warning so texture creep never lands silently.
MAX_TEXTURE_EDGE = 2048
WARN_TEXTURE_EDGE = 1024

TRIANGLE_MODES = (4, 5, 6)


class GlbError(SystemExit):
    def __init__(self, message: str) -> None:
        super().__init__(f"CHARACTER_GLB_INVALID: {message}")


def parse_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    """Returns (json document, BIN chunk bytes)."""
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != GLB_MAGIC:
        raise GlbError(f"{path} is not a GLB file")

    version, declared_length = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise GlbError(f"unsupported GLB version {version}")
    if declared_length != len(data):
        raise GlbError(f"declared length {declared_length} != actual {len(data)}")

    document: dict[str, Any] | None = None
    binary = b""
    offset = 12
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk_end = offset + chunk_length
        if chunk_end > len(data):
            raise GlbError("truncated chunk")
        if chunk_type == JSON_CHUNK and document is None:
            document = decode_json_chunk(data[offset:chunk_end])
        elif chunk_type == BIN_CHUNK and not binary:
            binary = data[offset:chunk_end]
        offset = chunk_end

    if document is None:
        raise GlbError("JSON chunk missing")
    return document, binary


def decode_json_chunk(payload: bytes) -> dict[str, Any]:
    trimmed = payload.rstrip(b" \t\r\n\x00")
    try:
        parsed = json.loads(trimmed.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GlbError(f"malformed JSON chunk: {exc}") from exc
    if not isinstance(parsed, dict):
        raise GlbError("JSON root is not an object")
    return parsed


def as_list(document: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = document.get(key)
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def accessor_count(accessors: Sequence[dict[str, Any]], index: Any) -> int:
    if not isinstance(index, int) or not 0 <= index < len(accessors):
        return 0
    count = accessors[index].get("count")
    return count if isinstance(count, int) and count > 0 else 0


def triangles_for(mode: int, indices: int, vertices: int) -> int:
    elements = indices if indices > 0 else vertices
    if mode == 4:
        return elements // 3
    if mode in (5, 6):
        return max(0, elements - 2)
    return 0


class GeometryStats:
    def __init__(self) -> None:
        self.primitives = 0
        self.vertices = 0
        self.indices = 0
        self.triangles = 0
        self.non_triangle_primitives = 0
        self.max_morph_targets = 0
        self.morph_names: list[str] = []


def measure_geometry(document: dict[str, Any]) -> GeometryStats:
    stats = GeometryStats()
    accessors = as_list(document, "accessors")
    for mesh in as_list(document, "meshes"):
        collect_morph_names(mesh, stats)
        primitives = mesh.get("primitives")
        if not isinstance(primitives, list):
            continue
        for primitive in primitives:
            if not isinstance(primitive, dict):
                continue
            measure_primitive(primitive, accessors, stats)
    return stats


def collect_morph_names(mesh: dict[str, Any], stats: GeometryStats) -> None:
    extras = mesh.get("extras")
    if not isinstance(extras, dict):
        return
    names = extras.get("targetNames")
    if not isinstance(names, list):
        return
    for name in names:
        if isinstance(name, str) and name not in stats.morph_names:
            stats.morph_names.append(name)


def measure_primitive(
    primitive: dict[str, Any],
    accessors: Sequence[dict[str, Any]],
    stats: GeometryStats,
) -> None:
    stats.primitives += 1
    attributes = primitive.get("attributes")
    position = attributes.get("POSITION") if isinstance(attributes, dict) else None
    vertices = accessor_count(accessors, position)
    indices = accessor_count(accessors, primitive.get("indices"))
    mode = primitive.get("mode")
    mode = mode if isinstance(mode, int) else 4

    stats.vertices += vertices
    stats.indices += indices
    if mode in TRIANGLE_MODES:
        stats.triangles += triangles_for(mode, indices, vertices)
    else:
        stats.non_triangle_primitives += 1

    targets = primitive.get("targets")
    if isinstance(targets, list):
        stats.max_morph_targets = max(stats.max_morph_targets, len(targets))


def image_bytes(document: dict[str, Any], binary: bytes, image: dict[str, Any]) -> bytes:
    index = image.get("bufferView")
    views = as_list(document, "bufferViews")
    if not isinstance(index, int) or not 0 <= index < len(views):
        return b""
    view = views[index]
    offset = view.get("byteOffset", 0)
    length = view.get("byteLength", 0)
    if not isinstance(offset, int) or not isinstance(length, int):
        return b""
    if offset < 0 or length <= 0 or offset + length > len(binary):
        return b""
    return binary[offset : offset + length]


def png_size(payload: bytes) -> tuple[int, int] | None:
    if len(payload) < 24 or payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[12:16] != b"IHDR":
        return None
    width, height = struct.unpack_from(">II", payload, 16)
    return width, height


def jpeg_size(payload: bytes) -> tuple[int, int] | None:
    if len(payload) < 4 or payload[:2] != b"\xff\xd8":
        return None
    offset = 2
    while offset + 9 < len(payload):
        if payload[offset] != 0xFF:
            offset += 1
            continue
        marker = payload[offset + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            offset += 2
            continue
        segment = struct.unpack_from(">H", payload, offset + 2)[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            height, width = struct.unpack_from(">HH", payload, offset + 5)
            return width, height
        offset += 2 + segment
    return None


def describe_image(document: dict[str, Any], binary: bytes, image: dict[str, Any]) -> dict[str, Any]:
    payload = image_bytes(document, binary, image)
    dimensions = png_size(payload) or jpeg_size(payload)
    mime = image.get("mimeType")
    return {
        "name": str(image.get("name", "")) or "(unnamed)",
        "mime": str(mime) if isinstance(mime, str) else ("external" if image.get("uri") else "unknown"),
        "bytes": len(payload),
        "width": dimensions[0] if dimensions else 0,
        "height": dimensions[1] if dimensions else 0,
        "external": bool(image.get("uri")),
    }


def normalize_clip(value: str) -> str:
    return re.sub(r"[\s.|-]+", "_", value.lower())


def score_alias(name: str, alias: str) -> int:
    """Exact names beat token boundaries, which beat a bare substring."""
    if name == alias:
        return 3
    if name.startswith(f"{alias}_") or name.endswith(f"_{alias}") or f"_{alias}_" in name:
        return 2
    return 1 if alias in name else 0


def resolve_states(names: Sequence[str]) -> dict[str, str]:
    """Maps canonical state -> matched clip name, mirroring the runtime resolver."""
    candidates = [(name, normalize_clip(name)) for name in names]
    resolved: dict[str, str] = {}
    claimed: set[str] = set()

    for _tier, state, aliases in RESOLUTION_ORDER:
        best: str | None = None
        best_score = 0
        for name, key in candidates:
            if name in claimed:
                continue
            for alias in aliases:
                score = score_alias(key, normalize_clip(alias))
                if score > best_score:
                    best_score = score
                    best = name
        if best is not None:
            resolved[state] = best
            claimed.add(best)
    return resolved


def match_morphs(morph_names: Sequence[str]) -> dict[str, str]:
    lowered = [(name, name.lower().replace(" ", "")) for name in morph_names]
    found: dict[str, str] = {}
    for label, aliases in FACIAL_MORPHS.items():
        for alias in aliases:
            match = next((name for name, low in lowered if alias in low), None)
            if match is not None:
                found[label] = match
                break
    return found


def joined(values: Iterable[str]) -> str:
    items = [value for value in values]
    return ",".join(items) if items else "(none)"


def print_report(path: Path, document: dict[str, Any], binary: bytes) -> dict[str, Any]:
    asset = document.get("asset") if isinstance(document.get("asset"), dict) else {}
    meshes = as_list(document, "meshes")
    skins = as_list(document, "skins")
    materials = as_list(document, "materials")
    textures = as_list(document, "textures")
    images = as_list(document, "images")
    animations = as_list(document, "animations")
    nodes = as_list(document, "nodes")

    geometry = measure_geometry(document)
    image_info = [describe_image(document, binary, image) for image in images]
    joints = {j for skin in skins for j in skin.get("joints", []) if isinstance(j, int)}
    names = [str(item.get("name", "")) or f"clip_{i}" for i, item in enumerate(animations)]
    channels = sum(len(item.get("channels", []) or []) for item in animations)

    resolved = resolve_states(names)
    morphs = match_morphs(geometry.morph_names)
    max_edge = max((info["width"] for info in image_info), default=0)
    max_edge = max(max_edge, max((info["height"] for info in image_info), default=0))

    print("=== CHARACTER REPORT ===")
    print(f"character_path={path}")
    print(f"character_glb_bytes={path.stat().st_size}")
    print(f"character_bin_bytes={len(binary)}")
    print(f"character_gltf_version={asset.get('version', 'unknown')}")
    print(f"character_generator={asset.get('generator', 'unknown')}")
    print(f"character_nodes={len(nodes)}")
    print(f"character_meshes={len(meshes)}")
    print(f"character_primitives={geometry.primitives}")
    print(f"character_vertices={geometry.vertices}")
    print(f"character_indices={geometry.indices}")
    print(f"character_triangles={geometry.triangles}")
    print(f"character_non_triangle_primitives={geometry.non_triangle_primitives}")
    print(f"character_skins={len(skins)}")
    print(f"character_joints={len(joints)}")
    print(f"character_materials={len(materials)}")
    print(f"character_textures={len(textures)}")
    print(f"character_images={len(images)}")
    print(f"character_image_bytes={sum(info['bytes'] for info in image_info)}")
    print(f"character_max_texture_edge={max_edge}")
    for index, info in enumerate(image_info):
        size = f"{info['width']}x{info['height']}" if info["width"] else "unknown"
        print(
            f"character_image[{index}] name={info['name']} mime={info['mime']} "
            f"size={size} bytes={info['bytes']}"
        )
    print(f"character_animations={len(animations)}")
    print(f"character_animation_channels={channels}")
    print(f"character_animation_names={joined(names)}")
    print(f"character_max_morph_targets={geometry.max_morph_targets}")
    print(f"character_morph_names={joined(geometry.morph_names)}")
    print("--- animation contract ---")
    for tier, state, _aliases in RESOLUTION_ORDER:
        print(f"character_anim_{tier}_{state}={resolved.get(state, '(missing)')}")
    print("--- facial life contract ---")
    for label in FACIAL_MORPHS:
        print(f"character_morph_{label}={morphs.get(label, '(missing)')}")
    print("=== END CHARACTER REPORT ===")

    return {
        "geometry": geometry,
        "meshes": len(meshes),
        "skins": len(skins),
        "materials": len(materials),
        "images": image_info,
        "joints": len(joints),
        "animations": names,
        "resolved": resolved,
        "max_edge": max_edge,
    }


def check_budgets(path: Path, summary: dict[str, Any]) -> tuple[list[str], list[str]]:
    geometry: GeometryStats = summary["geometry"]
    errors: list[str] = []
    warnings: list[str] = []

    def limit(label: str, value: int, ceiling: int) -> None:
        if value > ceiling:
            errors.append(f"{label} {value} exceeds Android budget {ceiling}")

    limit("glb bytes", path.stat().st_size, MAX_GLB_BYTES)
    limit("triangles", geometry.triangles, MAX_TRIANGLES)
    limit("vertices", geometry.vertices, MAX_VERTICES)
    limit("meshes", summary["meshes"], MAX_MESHES)
    limit("primitives", geometry.primitives, MAX_PRIMITIVES)
    limit("materials", summary["materials"], MAX_MATERIALS)
    limit("images", len(summary["images"]), MAX_IMAGES)
    limit("joints", summary["joints"], MAX_JOINTS)

    for info in summary["images"]:
        edge = max(info["width"], info["height"])
        if edge > MAX_TEXTURE_EDGE:
            errors.append(f"texture {info['name']} is {info['width']}x{info['height']} (max edge {MAX_TEXTURE_EDGE})")
        elif edge > WARN_TEXTURE_EDGE:
            warnings.append(f"texture {info['name']} is {info['width']}x{info['height']} (mobile target {WARN_TEXTURE_EDGE})")
        if info["external"]:
            warnings.append(f"image {info['name']} references an external URI and may not be packaged")
    return errors, warnings


def check_requirements(summary: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    geometry: GeometryStats = summary["geometry"]
    if summary["meshes"] < 1:
        errors.append("no mesh")
    if summary["skins"] < 1:
        errors.append("no skin/rig")
    if summary["joints"] < 1:
        errors.append("skin declares no joints")
    if geometry.triangles < 1:
        errors.append("no triangle geometry")
    missing = [state for state in REQUIRED_STATES if state not in summary["resolved"]]
    if missing:
        errors.append(f"missing required animation states {','.join(missing)}; names={summary['animations']}")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit the packaged CUMA character GLB")
    parser.add_argument("path", nargs="?", default="public/assets/characters/cuma_runtime.glb")
    parser.add_argument(
        "--no-budget",
        action="store_true",
        help="report only; skip Android budget enforcement (used for baseline audits)",
    )
    args = parser.parse_args()

    path = Path(args.path)
    if not path.is_file():
        raise GlbError(f"missing {path}")

    document, binary = parse_glb(path)
    summary = print_report(path, document, binary)

    errors = check_requirements(summary)
    if not args.no_budget:
        budget_errors, warnings = check_budgets(path, summary)
        errors.extend(budget_errors)
        for warning in warnings:
            print(f"CHARACTER_GLB_WARN: {warning}")

    if errors:
        for error in errors:
            print(f"CHARACTER_GLB_ERROR: {error}", file=sys.stderr)
        raise SystemExit("CHARACTER_GLB_INVALID: character contract not satisfied")

    print(f"CHARACTER_GLB_OK path={path}")


if __name__ == "__main__":
    main()
