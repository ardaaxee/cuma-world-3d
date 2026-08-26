#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"
CHECKS = {
    "scripts/player_controller.gd": [
        "MOVE_DEAD_ZONE = 0.10",
        "GROUND_ACCEL = 17.5",
        "GROUND_DECEL = 23.0",
        "floor_snap_length = 0.28",
        "func _shape_move_input(value: Vector2)",
        "func _update_look_smoothing(delta: float)",
        "func _update_imported_idle_life(delta: float, horizontal_speed: float)",
        "target_horizontal = Vector2(direction.x, direction.z) * speed * input_strength",
    ],
    "scripts/virtual_joystick.gd": [
        "DEAD_ZONE := 0.14",
        "RESPONSE_POWER := 1.15",
        "func _shape_direction(value: Vector2)",
        "NOTIFICATION_APPLICATION_FOCUS_OUT",
        "func _release_pointer()",
    ],
    "scripts/look_pad.gd": [
        "DELTA_LIMIT := 72.0",
        "SMOOTH_WEIGHT := 0.72",
        "func _emit_delta(raw_delta: Vector2)",
        "NOTIFICATION_APPLICATION_FOCUS_OUT",
    ],
    "scripts/game_state.gd": [
        '["AUTO", "LOW", "MEDIUM", "HIGH", "ULTRA"]',
    ],
    "scripts/graphics_manager.gd": [
        'const PROFILES := ["AUTO", "LOW", "MEDIUM", "HIGH", "ULTRA"]',
        'return "MEDIUM" if OS.has_feature("mobile") else "HIGH"',
        '"ssao_enabled"',
    ],
    "scripts/world/production_home_builder.gd": [
        "func _build_aaa_architecture_details()",
        "func _apply_aaa_render_budget()",
        'add_to_group("aaa_practical_light")',
        "visibility_range_end = 28.0",
    ],
    "scripts/day_night.gd": [
        "last_weather",
        "func _update_practical_lights(daylight: float)",
        'get_nodes_in_group("aaa_practical_light")',
    ],
    "scripts/imported_character_bridge.gd": [
        '"Land": ["land", "landing"]',
        "land_until",
    ],
    "scripts/main.gd": [
        "material.cull_mode = BaseMaterial3D.CULL_DISABLED",
    ],
}

def main() -> None:
    failures = []
    for relative, tokens in CHECKS.items():
        path = ROOT / relative
        if not path.exists():
            failures.append(f"missing {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                failures.append(f"{relative}: missing {token}")
    if failures:
        raise SystemExit("AAA90 CONTRACT FAIL:\n" + "\n".join(failures))
    print("CUMA WORLD AAA POLISH 9.0 CONTRACT: PASS")

if __name__ == "__main__":
    main()
