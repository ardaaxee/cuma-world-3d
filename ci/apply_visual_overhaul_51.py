#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL51 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"VISUAL51 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL51 APPLIED: {label}")


def patch_home() -> None:
    path = ROOT / "scripts/world/production_home_builder.gd"

    replace_once(
        path,
        '\t# Herb pot near the sink.\n\t_plant(Vector3(9.72, 1.01, 3.38), 0.28)',
        '''\t# Herb pot near the sink plus cabinet fronts, toe-kick and small prep props.
\t_plant(Vector3(9.72, 1.01, 3.38), 0.28)
\t_panel(Vector3(4.86, 0.09, 0.035), Vector3(8.48, 0.10, 2.99), metal_dark)
\tfor x in [6.45, 7.55, 8.65, 9.75]:
\t\t_panel(Vector3(0.98, 0.72, 0.035), Vector3(x, 0.54, 3.015), _simple_material(Color("82705f"), 0.86, 0.0))
\t\t_cylinder(Vector3(x + 0.34, 0.55, 2.975), 0.009, 0.18, metal_dark)
\t_panel(Vector3(0.48, 0.035, 0.32), Vector3(7.50, 1.055, 3.48), _pbr_material("oak", Color("a27a55"), 0.82, 0.0, 3.6, 0.34), Vector3(0.0, 8.0, 0.0))
\tfor i in range(3):
\t\t_cylinder(Vector3(9.18 + float(i) * 0.16, 1.11, 3.40), 0.035, 0.10 + float(i) * 0.025, _simple_material(Color("d5c9b8"), 0.76, 0.0))''',
        "add kitchen cabinetry and lived-in prep details",
    )

    replace_once(
        path,
        '\t_cylinder(Vector3(9.65, 1.55, 8.50), 0.015, 0.44, metal_dark, Vector3(90.0, 0.0, 0.0))',
        '''\t_cylinder(Vector3(9.65, 1.55, 8.50), 0.015, 0.44, metal_dark, Vector3(90.0, 0.0, 0.0))
\t# Countertop basin, tap, shelf and rolled towel details make the bathroom read immediately.
\t_soft_ellipsoid(Vector3(4.30, 0.83, 7.16), Vector3(0.36, 0.10, 0.24), warm_white)
\t_cylinder(Vector3(4.30, 1.03, 7.34), 0.014, 0.26, metal_dark)
\t_cylinder(Vector3(4.30, 1.14, 7.22), 0.014, 0.22, metal_dark, Vector3(90.0, 0.0, 0.0))
\t_panel(Vector3(0.82, 0.055, 0.22), Vector3(5.42, 1.53, 8.72), oak)
\tfor x in [5.22, 5.42, 5.62]:
\t\t_cylinder(Vector3(x, 1.62, 8.66), 0.065, 0.18, _pbr_material("fabric", Color("ded8cf"), 0.99, 0.0, 2.7, 0.16), Vector3(90.0, 0.0, 0.0))''',
        "finish bathroom vanity and shelf details",
    )

    replace_once(
        path,
        '\t_panel(Vector3(1.45, 0.065, 0.38), Vector3(-0.78, 0.16, 7.45), oak)',
        '''\t_panel(Vector3(1.45, 0.065, 0.38), Vector3(-0.78, 0.16, 7.45), oak)
\t# Floating mirror halo and key tray give the entrance a deliberate focal point.
\t_panel(Vector3(0.82, 1.56, 0.018), Vector3(1.58, 1.55, 8.785), _emissive(Color("ffd9b2"), 0.32))
\t_panel(Vector3(0.36, 0.035, 0.22), Vector3(0.34, 0.89, 7.74), _simple_material(Color("34383c"), 0.78, 0.0))''',
        "add entry mirror halo and key tray",
    )

    replace_once(
        path,
        '\t_wardrobe_visual(Vector3(10.0, 0.0, 1.65), 3.1)',
        '''\t_wardrobe_visual(Vector3(10.0, 0.0, 1.65), 3.1)
\t# Restrained wall art breaks up the large bedroom plaster surfaces without clutter.
\t_panel(Vector3(1.28, 0.82, 0.035), Vector3(-9.82, 1.62, -5.15), _simple_material(Color("4f4037"), 0.82, 0.0), Vector3(0.0, 90.0, 0.0))
\t_panel(Vector3(1.12, 0.68, 0.040), Vector3(-9.79, 1.62, -5.15), _simple_material(Color("8f8175"), 0.94, 0.0), Vector3(0.0, 90.0, 0.0))
\t_panel(Vector3(1.28, 0.82, 0.035), Vector3(9.82, 1.62, -5.05), _simple_material(Color("4f4037"), 0.82, 0.0), Vector3(0.0, 90.0, 0.0))
\t_panel(Vector3(1.12, 0.68, 0.040), Vector3(9.79, 1.62, -5.05), _simple_material(Color("71808a"), 0.94, 0.0), Vector3(0.0, 90.0, 0.0))''',
        "add bedroom wall-art focal points",
    )

    replace_once(
        path,
        '''\tfor i in range(7):
\t\tvar bx = -10.4 + float(i) * 1.45
\t\t_sphere(Vector3(bx, 2.55 + sin(float(i) * 0.7) * 0.12, 13.45), Vector3(0.055, 0.055, 0.055), _emissive(Color("ffd59d"), 1.10))''',
        '''\tfor i in range(7):
\t\tvar bx = -10.4 + float(i) * 1.45
\t\t_sphere(Vector3(bx, 2.55 + sin(float(i) * 0.7) * 0.12, 13.45), Vector3(0.055, 0.055, 0.055), _emissive(Color("ffd59d"), 1.10))
\t# Second lounge chair, outdoor rug and low planter complete the social balcony zone.
\t_soft_ellipsoid(Vector3(-4.15, 0.45, 10.55), Vector3(0.72, 0.20, 0.42), fabric_dark, Vector3(0.0, -18.0, 0.0))
\t_soft_ellipsoid(Vector3(-4.05, 0.84, 10.84), Vector3(0.70, 0.27, 0.12), fabric_dark, Vector3(-8.0, -18.0, 0.0))
\t_panel(Vector3(5.20, 0.012, 2.20), Vector3(-6.25, 0.040, 11.12), _pbr_material("fabric", Color("77736e"), 0.99, 0.0, 3.2, 0.18))
\t_panel(Vector3(2.10, 0.36, 0.42), Vector3(-6.25, 0.20, 13.08), _simple_material(Color("655448"), 0.90, 0.0))
\tfor x in [-6.95, -6.25, -5.55]:
\t\t_plant(Vector3(x, 0.34, 12.94), 0.42)''',
        "complete balcony lounge composition",
    )

    replace_once(
        path,
        '''\t\tkey.add_to_group("quality_shadow")
\t\troot.add_child(key)''',
        '''\t\tkey.add_to_group("quality_shadow")
\t\troot.add_child(key)
\t# Small room-specific fills improve readability without adding shadow cost.
\tfor data in [
\t\t{"p": Vector3(5.0, 2.35, 7.55), "c": Color("e6f0f2"), "e": 0.24, "r": 3.6},
\t\t{"p": Vector3(0.0, 2.35, 7.65), "c": Color("ffe2bd"), "e": 0.22, "r": 3.0},
\t\t{"p": Vector3(-6.4, 2.28, 11.15), "c": Color("ffd29a"), "e": 0.30, "r": 4.2},
\t]:
\t\tvar accent_fill = OmniLight3D.new()
\t\taccent_fill.position = data["p"]
\t\taccent_fill.light_color = data["c"]
\t\taccent_fill.light_energy = float(data["e"])
\t\taccent_fill.omni_range = float(data["r"])
\t\taccent_fill.shadow_enabled = false
\t\taccent_fill.add_to_group("quality_extra_light")
\t\troot.add_child(accent_fill)''',
        "add bathroom entry and balcony readability fills",
    )


def normalize() -> None:
    path = ROOT / "scripts/world/production_home_builder.gd"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    if not (ROOT / "project.godot").is_file():
        raise SystemExit("VISUAL51: game/project.godot missing")
    patch_home()
    normalize()
    print("CUMA WORLD VISUAL OVERHAUL 5.1 POLISH: PASS")


if __name__ == "__main__":
    main()
