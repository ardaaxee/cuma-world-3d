#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL ROUND4 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL ROUND4 APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    main_script = ROOT / "scripts" / "main.gd"
    production = ROOT / "scripts" / "world" / "production_home_builder.gd"
    ultra = ROOT / "scripts" / "world" / "ultra_home_builder.gd"

    # Living room: TV was overpowering the wall and the two sphere cushions read
    # like eggs in the real render. Keep the gameplay TV, only rebalance its art.
    replace_exact(
        main_script,
        'tv.setup(Vector3(3.2, 1.65, 0.12))',
        'tv.setup(Vector3(2.72, 1.42, 0.10))',
        "reduce interactive TV to apartment scale",
    )
    replace_exact(
        production,
        '_panel(Vector3(4.05, 1.90, 0.06), Vector3(-7.0, 1.35, 3.02), _simple_material(Color("55473e"), 0.84, 0.0))',
        '_panel(Vector3(3.62, 1.72, 0.055), Vector3(-7.0, 1.31, 3.02), _simple_material(Color("6a574a"), 0.86, 0.0))',
        "rebalance living media backing panel",
    )
    replace_exact(
        production,
        '\tfor x in [-2.02, 2.02]:\n\t\t_panel_on(sofa_root, Vector3(0.18, 0.62, 1.18), Vector3(x, 0.54, 0.0), fabric_dark)',
        '\tfor x in [-2.00, 2.00]:\n\t\t_panel_on(sofa_root, Vector3(0.15, 0.50, 1.06), Vector3(x, 0.48, -0.02), fabric_dark)',
        "lower sofa arms",
    )
    replace_exact(
        production,
        '\t_sphere_on(sofa_root, Vector3(-0.94, 0.78, -0.43), Vector3(0.26, 0.20, 0.11), sofa_accent)\n\t_sphere_on(sofa_root, Vector3(0.92, 0.78, -0.43), Vector3(0.26, 0.20, 0.11), fabric_light)',
        '\t_panel_on(sofa_root, Vector3(0.48, 0.38, 0.14), Vector3(-0.94, 0.73, -0.43), sofa_accent, Vector3(-8.0, 10.0, 0.0))\n\t_panel_on(sofa_root, Vector3(0.48, 0.38, 0.14), Vector3(0.92, 0.73, -0.43), fabric_light, Vector3(-8.0, -10.0, 0.0))',
        "replace egg-like sofa cushions with compact pillows",
    )
    replace_exact(
        production,
        '_plant(Vector3(-4.75, 0.0, 6.65), 1.10)',
        '_plant(Vector3(-4.55, 0.0, 3.72), 0.82)',
        "move living plant out of camera/circulation path",
    )
    replace_exact(
        production,
        'living_fill.light_energy = 0.48',
        'living_fill.light_energy = 0.56',
        "lift living upholstery separation",
    )

    # Corridor: preserve readable warm pools without a continuous white ceiling line.
    replace_exact(
        production,
        'mesh.top_radius = 0.10\n\t\tmesh.bottom_radius = 0.10',
        'mesh.top_radius = 0.075\n\t\tmesh.bottom_radius = 0.075',
        "shrink corridor recessed fixture discs",
    )
    replace_exact(
        production,
        'fixture.material_override = _emissive(Color("ffe2bd"), 0.82)',
        'fixture.material_override = _emissive(Color("ffe2bd"), 0.58)',
        "soften corridor fixture emission further",
    )
    replace_exact(
        production,
        '\t\tlight.light_energy = 0.34\n\t\tlight.omni_range = 3.15',
        '\t\tlight.light_energy = 0.27\n\t\tlight.omni_range = 2.80',
        "tighten corridor warm light pools",
    )

    # Bedrooms: one more scale pass after Audit #8. The room should read first,
    # then the bed, instead of the bed occupying most of the visual volume.
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.50, 0.18, 3.38), p + Vector3(0.0, 0.17, 0.0), oak)',
        '\t\t_panel(Vector3(2.34, 0.17, 3.12), p + Vector3(0.0, 0.16, 0.0), oak)',
        "reduce bed frame round4",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.38, 0.25, 3.18), p + Vector3(0.0, 0.40, 0.0), fabric_light)',
        '\t\t_panel(Vector3(2.22, 0.23, 2.96), p + Vector3(0.0, 0.38, 0.0), fabric_light)',
        "reduce mattress round4",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.22, 0.12, 2.36), p + Vector3(0.0, 0.59, -0.28), fabric_light)',
        '\t\t_panel(Vector3(2.06, 0.11, 2.18), p + Vector3(0.0, 0.56, -0.25), fabric_light)',
        "reduce duvet round4",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.22, 0.050, 0.46), p + Vector3(0.0, 0.66, -1.12), _simple_material(Color("a79484"), 0.98, 0.0))',
        '\t\t_panel(Vector3(2.06, 0.046, 0.42), p + Vector3(0.0, 0.63, -1.02), _simple_material(Color("a79484"), 0.98, 0.0))',
        "reduce duvet accent round4",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.42, 0.92, 0.13), p + Vector3(0.0, 1.18, 1.48), fabric_dark)',
        '\t\t_panel(Vector3(2.26, 0.82, 0.12), p + Vector3(0.0, 1.12, 1.38), fabric_dark)',
        "reduce headboard round4",
    )
    replace_exact(
        production,
        '\t\t_bedside_table(p + Vector3(-1.48, 0.0, 0.84), idx)\n\t\t_bedside_table(p + Vector3(1.48, 0.0, 0.84), idx + 10)',
        '\t\t_bedside_table(p + Vector3(-1.38, 0.0, 0.78), idx)\n\t\t_bedside_table(p + Vector3(1.38, 0.0, 0.78), idx + 10)',
        "tighten bedside composition round4",
    )

    # Kitchen: the long narrow galley still felt blocked in Audit #8. Keep all
    # cabinet interactions but make the island and pendants visually lighter.
    replace_exact(
        ultra,
        '_panel(root,Vector3(2.16,0.08,0.82),Vector3(6.3,0.98,4.95),Vector3.ZERO,marble)',
        '_panel(root,Vector3(1.92,0.075,0.72),Vector3(6.3,0.97,4.95),Vector3.ZERO,marble)',
        "narrow kitchen island top round4",
    )
    replace_exact(
        ultra,
        '_panel(root,Vector3(1.88,0.58,0.58),Vector3(6.3,0.54,4.95),Vector3.ZERO,_mat(Color("3f4247"),0.90))',
        '_panel(root,Vector3(1.62,0.54,0.50),Vector3(6.3,0.52,4.95),Vector3.ZERO,_mat(Color("45494d"),0.90))',
        "narrow kitchen island carcass round4",
    )
    replace_exact(
        ultra,
        'for x in [-0.88,-0.59,-0.30,0.0,0.30,0.59,0.88]:\n\t\t_panel(root,Vector3(0.035,0.52,0.76),Vector3(6.3+x,0.58,4.95),Vector3.ZERO,walnut)',
        'for x in [-0.70,-0.47,-0.24,0.0,0.24,0.47,0.70]:\n\t\t_panel(root,Vector3(0.030,0.46,0.54),Vector3(6.3+x,0.56,4.95),Vector3.ZERO,walnut)',
        "fit island slats to narrower carcass",
    )
    replace_exact(
        ultra,
        'for x in [5.24,7.36]:\n\t\t_panel(root,Vector3(0.07,0.88,0.78),Vector3(x,0.48,4.95),Vector3.ZERO,marble)',
        'for x in [5.36,7.24]:\n\t\t_panel(root,Vector3(0.06,0.82,0.66),Vector3(x,0.45,4.95),Vector3.ZERO,marble)',
        "tighten island waterfall sides round4",
    )
    replace_exact(
        ultra,
        '_cylinder(root,pos,0.23,0.28,_mat(Color("4a4d50"),0.38,0.58),Vector3.ZERO,Vector3(1.0,1.0,0.78))',
        '_cylinder(root,pos,0.16,0.20,_mat(Color("4a4d50"),0.38,0.58),Vector3.ZERO,Vector3(1.0,1.0,0.80))',
        "reduce pendant shade mass",
    )
    replace_exact(
        ultra,
        '_sphere(root,pos-Vector3(0,0.10,0),Vector3(0.08,0.08,0.08),_emissive(Color("ffdca7"),1.8))',
        '_sphere(root,pos-Vector3(0,0.08,0),Vector3(0.065,0.065,0.065),_emissive(Color("ffdca7"),1.35))',
        "reduce pendant bulb bloom",
    )
    replace_exact(
        ultra,
        'light.light_energy = 0.62\n\tlight.omni_range = 3.2',
        'light.light_energy = 0.48\n\tlight.omni_range = 2.7',
        "soften kitchen pendant pools",
    )

    print("CUMA VISUAL ROUND4 PATCH: PASS")


if __name__ == "__main__":
    main()
