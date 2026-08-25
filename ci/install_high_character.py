#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import hashlib
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / "game"
TARGET = ROOT / "assets" / "characters" / "cuma_high.glb"
LICENSE = ROOT / "assets" / "characters" / "CUMA_HIGH_LICENSE.txt"

PINNED_COMMIT = "3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91"
SOURCE_PATH = "packages/assets/library/suited.glb"
SOURCE_URL = f"https://raw.githubusercontent.com/kunalkushwaha/vsim/{PINNED_COMMIT}/{SOURCE_PATH}"
EXPECTED_SIZE = 6_675_064
EXPECTED_GIT_BLOB_SHA1 = "9548ee77781f96f3579dd41c21e0c4c2b092486c"


def git_blob_sha1(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def main() -> None:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    print(f"CUMA_HIGH_DOWNLOAD source={SOURCE_URL}")
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "CUMA-WORLD-CI/3.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read()

    if len(data) != EXPECTED_SIZE:
        raise SystemExit(f"CUMA_HIGH_INSTALL: unexpected size {len(data)} != {EXPECTED_SIZE}")
    blob_sha = git_blob_sha1(data)
    if blob_sha != EXPECTED_GIT_BLOB_SHA1:
        raise SystemExit(f"CUMA_HIGH_INSTALL: git blob SHA mismatch {blob_sha}")
    if data[:4] != b"glTF":
        raise SystemExit("CUMA_HIGH_INSTALL: downloaded file is not GLB")

    TARGET.write_bytes(data)
    LICENSE.write_text(
        "CUMA WORLD high-detail character candidate\n"
        "Asset: suited.glb (MakeHuman / MPFB 2)\n"
        "Source repository: https://github.com/kunalkushwaha/vsim\n"
        f"Pinned source commit: {PINNED_COMMIT}\n"
        f"Source path: {SOURCE_PATH}\n"
        "License/provenance: MakeHuman output and referenced skin/clothing assets are CC0/public domain, "
        "as documented in packages/assets/library/CREDITS.md at the pinned source commit.\n"
        "The bundled walk clip is documented by the source project as retargeted CMU Graphics Lab motion capture, "
        "free for all uses; run/idle/wave are source-project authored.\n"
        "This candidate is audited before becoming gameplay LOD0.\n",
        encoding="utf-8",
    )
    print(f"CUMA_HIGH_INSTALL_OK path={TARGET} bytes={len(data)} blob={blob_sha}")


if __name__ == "__main__":
    main()
