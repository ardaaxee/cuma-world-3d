#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from apply_intelligence_stealth_70_base import main as apply_intelligence_base

ROOT = Path(__file__).resolve().parents[1] / "game"


def _adapt_character_30_camera_for_legacy_patch() -> None:
    """Bridge Character 3.0's standing pivot to the older intelligence patch input."""
    path = ROOT / "scripts/player_controller.gd"
    text = path.read_text(encoding="utf-8")
    current = '\t\tcamera_pivot.position = Vector3(0.0, 1.54, 0.0)'
    legacy = '\t\tcamera_pivot.position = Vector3(0.0, 1.58, 0.0)'
    if current in text:
        path.write_text(text.replace(current, legacy, 1), encoding="utf-8")
        print("INTEL70 COMPAT: adapted Character 3.0 standing camera for stealth patch")


def _restore_character_30_standing_camera() -> None:
    path = ROOT / "scripts/player_controller.gd"
    text = path.read_text(encoding="utf-8")
    legacy_result = '\t\tcamera_pivot.position = Vector3(0.0, 1.16 if crouched else 1.58, 0.0)'
    character_30_result = '\t\tcamera_pivot.position = Vector3(0.0, 1.16 if crouched else 1.54, 0.0)'
    if legacy_result not in text:
        raise SystemExit("INTEL70 COMPAT: crouch camera result missing after base patch")
    path.write_text(text.replace(legacy_result, character_30_result, 1), encoding="utf-8")
    print("INTEL70 COMPAT: restored Character 3.0 standing camera with crouch support")


def main() -> None:
    _adapt_character_30_camera_for_legacy_patch()
    apply_intelligence_base()
    _restore_character_30_standing_camera()


if __name__ == "__main__":
    main()
