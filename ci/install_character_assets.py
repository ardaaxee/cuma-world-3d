#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import hashlib
import json
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / "game"
SOURCE_COMMIT = "728f23ab5eb9d6cb2c8fb39acb3440bd81db0d3e"
SOURCE_BLOB_SHA1 = "de56d83cdcd5d741955fe6acd983a61e50e367c3"
EXPECTED_SIZE = 698560
SOURCE_URL = (
    "https://raw.githubusercontent.com/UMRAM-Bilkent/supine-human-model/"
    + SOURCE_COMMIT
    + "/assets/human.glb"
)


def git_blob_sha1(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def animation_names(data: bytes) -> list[str]:
    offset = 12
    while offset + 8 <= len(data):
        chunk_length = int.from_bytes(data[offset : offset + 4], "little")
        chunk_type = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + chunk_length]
        if chunk_type == b"JSON":
            document = json.loads(payload.rstrip(b" \t\r\n\x00").decode("utf-8"))
            return [str(item.get("name", "")) for item in document.get("animations", [])]
        offset += 8 + chunk_length
    raise SystemExit("character GLB is missing its JSON metadata chunk")


def validate_glb(data: bytes) -> list[str]:
    if len(data) != EXPECTED_SIZE:
        raise SystemExit(f"character asset size mismatch: {len(data)} != {EXPECTED_SIZE}")
    if data[:4] != b"glTF":
        raise SystemExit("character asset is not a binary glTF (GLB)")
    if int.from_bytes(data[4:8], "little") != 2:
        raise SystemExit("character asset is not glTF 2.0")
    actual_blob = git_blob_sha1(data)
    if actual_blob != SOURCE_BLOB_SHA1:
        raise SystemExit(
            f"character source integrity mismatch: {actual_blob} != {SOURCE_BLOB_SHA1}"
        )
    names = animation_names(data)
    lower = [name.lower() for name in names]
    if not any("idle" in name for name in lower):
        raise SystemExit(f"character asset has no idle animation: {names}")
    if not any("walk" in name for name in lower):
        raise SystemExit(f"character asset has no walk animation: {names}")
    if len(names) < 2:
        raise SystemExit(f"character asset animation set is unexpectedly small: {names}")
    print("CHARACTER ANIMATIONS:", ", ".join(names))
    return names


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    target_dir = ROOT / "assets" / "characters"
    target_dir.mkdir(parents=True, exist_ok=True)
    cache = target_dir / ".cc0_human_source.glb"

    if cache.is_file():
        data = cache.read_bytes()
        names = validate_glb(data)
        print("CHARACTER ASSET: verified cached source")
    else:
        request = urllib.request.Request(
            SOURCE_URL,
            headers={"User-Agent": "CUMA-WORLD-3D-CI/3.0"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read(EXPECTED_SIZE + 1)
        names = validate_glb(data)
        cache.write_bytes(data)
        print("CHARACTER ASSET: downloaded and verified pinned CC0 source")

    for filename in ("cuma.glb", "partner.glb"):
        target = target_dir / filename
        shutil.copyfile(cache, target)
        if git_blob_sha1(target.read_bytes()) != SOURCE_BLOB_SHA1:
            raise SystemExit(f"failed to verify installed {filename}")

    third_party = target_dir / "THIRD_PARTY.md"
    third_party.write_text(
        "# Character asset\n\n"
        "- Model: `human.glb` from UMRAM-Bilkent/supine-human-model\n"
        f"- Pinned source commit: `{SOURCE_COMMIT}`\n"
        f"- Git blob SHA-1: `{SOURCE_BLOB_SHA1}`\n"
        "- Original character source: Quaternius\n"
        "- License: CC0 1.0 Universal / public domain\n"
        "- Use in CUMA WORLD: locomotion/social character base only.\n"
        f"- Verified animation clips: {', '.join(names)}\n",
        encoding="utf-8",
    )
    print("CHARACTER ASSET INSTALL: PASS")


if __name__ == "__main__":
    main()
