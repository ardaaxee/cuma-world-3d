#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"TEST CONTRACT ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"TEST CONTRACT APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    production_test = ROOT / "tests" / "production_rebuild_smoke.py"
    replace_exact(
        production_test,
        "assert 'first_person = true' in player",
        "assert 'first_person = true' in player\n"
        "assert 'res://assets/characters/cuma_high.glb' in player\n"
        "assert 'Vector3.ONE * 1.002724' in player\n"
        "assert 'Vector3.ONE * 0.340030' in player\n"
        "assert 'rotation_degrees.y = 180.0' in player",
        "keep first-person default and add Character 5.0 high/fallback rig contracts",
    )

    visual_test = ROOT / "tests" / "visual_rebuild_smoke.py"
    replace_exact(
        visual_test,
        "assert 'camera_spring.spring_length = 4.85' in player",
        "assert 'camera_spring.spring_length = 4.25' in player\n"
        "assert 'camera.position = Vector3(0.48, 0.08, 0.0)' in player\n"
        "assert 'camera.fov = 60.0' in player",
        "upgrade legacy third-person camera contract to Character 3.0 shoulder framing",
    )
    replace_exact(
        visual_test,
        "assert 'Vector3(0.175, 0.225, 0.17)' in hum",
        "assert 'Vector3(0.157, 0.218, 0.158)' in hum\n"
        "assert 'var cadence = lerp(6.0, 9.7, run_blend)' in hum\n"
        "assert 'turn_rate: float = 0.0' in hum",
        "upgrade legacy head proportions to Character 3.0 anatomy and locomotion contract",
    )

    crime_test = ROOT / "tests" / "crime_justice_smoke.py"
    replace_exact(
        crime_test,
        "assert 'SAVE_PATH := \"user://cuma_world_save_v19.cfg\"' in gs",
        "assert 'SAVE_PATH := \"user://cuma_world_save_v70.cfg\"' in gs\n"
        "assert '\"user://cuma_world_save_v19.cfg\"' in gs",
        "upgrade Crime 1.9 save contract to active v70 with v19 migration retained",
    )

    print("CUMA TEST CONTRACT UPDATE: PASS")


if __name__ == "__main__":
    main()
