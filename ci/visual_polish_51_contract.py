#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"VISUAL51 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/world/production_home_builder.gd", [
        'VisualOverhaul51Sofa',
        'Layered duvet',
        'bath_fill.light_energy = 0.26',
        'entry_fill.light_energy = 0.24',
        'balcony_fill.light_energy = 0.28',
        'task.light_energy = 0.14',
    ])
    require(ROOT / "scripts/main.gd", [
        '_add_room_light("HallLight", Vector3(0.0, 2.65, 1.0), 6.8, 0.78)',
        '_add_room_light("LivingLight", Vector3(-6.1, 2.55, 5.7), 6.1, 0.78)',
        '_add_room_light("KitchenLight", Vector3(6.2, 2.55, 4.4), 5.4, 0.64)',
    ])
    require(ROOT / "scripts/mobile_controls.gd", [
        'utility_buttons: Array[Button]',
        'utility_tray_open = false',
        '_make_top_button("EK", -304.0)',
        'func _on_toggle_utility_tray() -> void:',
        'quality_button.offset_top = 50.0',
    ])
    print("CUMA WORLD VISUAL POLISH 5.1 CONTRACT: PASS")


if __name__ == "__main__":
    main()
