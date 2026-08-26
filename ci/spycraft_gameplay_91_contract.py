#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"SPY91 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/stealth/awareness_system.gd", [
        "func get_global_suspicion() -> float:",
        "func apply_social_bluff(",
        "func apply_sensor_cooldown(",
        '"SOCIAL_BLUFF"',
    ])
    require(ROOT / "scripts/intelligence/spycraft_mission_director.gd", [
        'add_to_group("spycraft_mission_director")',
        "func attempt_social_bluff(",
        "func use_context_gadget(",
        "func _creative_score(",
        '"READ THE ROOM"',
        '"CHOOSE APPROACH"',
        '"EXFILTRATE"',
    ])
    require(ROOT / "scripts/ui/field_ops_runtime.gd", [
        'get_first_node_in_group("spycraft_mission_director")',
        'director.call("attempt_social_bluff", 0.34)',
        'director.call("use_context_gadget", gadget)',
    ])
    require(ROOT / "scripts/intelligence/intelligence_stealth_builder.gd", [
        'SpycraftMissionDirectorScript = preload("res://scripts/intelligence/spycraft_mission_director.gd")',
        'director.name = "SpycraftMissionDirector91"',
    ])
    print("CUMA WORLD SPYCRAFT GAMEPLAY 9.1 CONTRACT: PASS")


if __name__ == "__main__":
    main()
