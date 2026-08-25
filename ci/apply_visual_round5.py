#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL ROUND5 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL ROUND5 APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    production = ROOT / "scripts" / "world" / "production_home_builder.gd"

    # Visual Audit #57 ran at the game's default 17:30 world time and measured
    # bedroom mean luminance ~0.192. Round 5A reached 0.2288, only 0.0012 below
    # the 0.23 production guardrail, so keep the guardrail and add a small safety
    # margin locally rather than weakening the quality threshold or global exposure.
    replace_exact(
        production,
        'bedroom_light.light_color = Color("ffd7ad")',
        'bedroom_light.light_color = Color("ffe5cc")',
        "neutralize orange bedroom fill for better material separation",
    )
    replace_exact(
        production,
        'bedroom_light.light_energy = 0.66',
        'bedroom_light.light_energy = 0.88',
        "raise bedroom dusk fill with guardrail margin",
    )
    replace_exact(
        production,
        'bedroom_light.omni_range = 4.4',
        'bedroom_light.omni_range = 4.85',
        "spread bedroom fill across walls instead of one bright pool",
    )

    # The bedside bulbs were clipping almost white while the room stayed dark.
    # Lower visible emission; the Omni fill above carries the actual illumination.
    replace_exact(
        production,
        '_capsule(pos + Vector3(0.0, height * 0.76, 0.0), 0.11, 0.20, _emissive(Color("ffe1b4"), 1.25), Vector3.ZERO, Vector3(1.0, 1.0, 0.86))',
        '_capsule(pos + Vector3(0.0, height * 0.76, 0.0), 0.095, 0.18, _emissive(Color("ffe1b4"), 0.72), Vector3.ZERO, Vector3(1.0, 1.0, 0.82))',
        "reduce clipped bedside bulb emission and scale",
    )

    # Audit #57 still loses the headboard and wardrobe against the dark wall/floor.
    # Lift those bedroom-only surfaces without changing the whole home's palette.
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.26, 0.82, 0.12), p + Vector3(0.0, 1.12, 1.38), fabric_dark)',
        '\t\t_panel(Vector3(2.26, 0.82, 0.12), p + Vector3(0.0, 1.12, 1.38), _simple_material(Color("62666d"), 0.97, 0.0))',
        "lift bedroom headboard from dark wall value",
    )
    replace_exact(
        production,
        '_panel(Vector3(door_width, 2.28, 0.035), pos + Vector3(side * width * 0.245, 1.24, -0.36), _simple_material(Color("806048"), 0.74, 0.0))',
        '_panel(Vector3(door_width, 2.28, 0.035), pos + Vector3(side * width * 0.245, 1.24, -0.36), _simple_material(Color("98735a"), 0.78, 0.0))',
        "lift wardrobe fronts for dusk readability",
    )

    # Give the bed textile a warmer-but-lighter accent so mattress/duvet layers
    # remain distinct under the dusk fill without introducing glossy highlights.
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.06, 0.046, 0.42), p + Vector3(0.0, 0.63, -1.02), _simple_material(Color("a79484"), 0.98, 0.0))',
        '\t\t_panel(Vector3(2.06, 0.046, 0.42), p + Vector3(0.0, 0.63, -1.02), _simple_material(Color("b5a08e"), 0.98, 0.0))',
        "separate duvet accent from low-light bedding",
    )

    print("CUMA VISUAL ROUND5 PATCH: PASS")


if __name__ == "__main__":
    main()
