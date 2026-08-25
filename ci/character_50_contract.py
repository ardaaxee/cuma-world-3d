#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    if not path.is_file():
        raise SystemExit(f"CHARACTER50 CONTRACT missing file: {path.relative_to(ROOT)}")
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"CHARACTER50 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    high_asset = ROOT / "assets/characters/cuma_high.glb"
    if not high_asset.is_file() or high_asset.stat().st_size < 6_000_000:
        raise SystemExit("CHARACTER50 CONTRACT high-detail GLB missing or unexpectedly small")

    shared = [
        'res://assets/characters/cuma_high.glb',
        'res://assets/characters/cuma.glb',
        'Vector3.ONE * 1.002724',
        '-0.000444',
        'rotation_degrees.y = 180.0',
        'Vector3.ONE * 0.340030',
    ]
    require(ROOT / "scripts/player_controller.gd", shared + ['ImportedCumaGLB'])
    require(ROOT / "scripts/together/remote_avatar.gd", shared + ['ImportedPartnerGLB'])
    require(ROOT / "scripts/ui/menu_character.gd", shared + ['ImportedCumaGLB'])

    print("CUMA CHARACTER 5.0 CONTRACT: PASS")


if __name__ == "__main__":
    main()
