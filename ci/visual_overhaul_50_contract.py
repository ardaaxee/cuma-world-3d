#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"VISUAL50 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/world/production_home_builder.gd", [
        "func _soft_ellipsoid(",
        "func _bar_stool(",
        "shadow_opacity = 0.48",
        "task.light_energy = 0.14",
    ])
    require(ROOT / "scripts/player_controller.gd", [
        "camera_bob_time",
        "func _update_camera_motion(",
        "target_fov = 76.0",
        "is_reduced_motion",
    ])
    require(ROOT / "scripts/mobile_controls.gd", [
        "Color(0.018, 0.022, 0.028, 0.48)",
        "Color(0.19, 0.16, 0.12, 0.90)",
        "button.focus_mode = Control.FOCUS_NONE",
    ])
    require(ROOT / "scripts/main.gd", [
        'env.ambient_light_energy = 0.42',
        'sun.light_energy = 0.96',
        'sun.directional_shadow_max_distance = 70.0',
    ])
    print("CUMA WORLD VISUAL OVERHAUL 5.0 FOUNDATION CONTRACT: PASS")


if __name__ == "__main__":
    main()
