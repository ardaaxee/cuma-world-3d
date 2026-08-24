#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL FINISH ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL FINISH APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    production = ROOT / "scripts" / "world" / "production_home_builder.gd"
    ultra = ROOT / "scripts" / "world" / "ultra_home_builder.gd"

    # Raise the darkest upholstery floor so fabric detail survives dusk/mobile displays.
    replace_exact(
        production,
        'fabric_dark = _pbr_material("fabric", Color("343a42"), 0.96, 0.0, 2.1, 0.24)',
        'fabric_dark = _pbr_material("fabric", Color("4b5057"), 0.96, 0.0, 2.1, 0.24)',
        "lift dark upholstery without making it glossy",
    )

    old_sofa = '''\t# Production sofa: one low structural base, individual seat cushions and softer back cushions.
\t# This removes the oversized tube/sausage silhouette visible in the first render audit.
\tvar sofa_root = Node3D.new()
\tsofa_root.position = Vector3(-7.0, 0.0, 5.78)
\troot.add_child(sofa_root)
\t_panel_on(sofa_root, Vector3(4.35, 0.24, 1.48), Vector3(0.0, 0.29, 0.0), fabric_dark)
\tfor x in [-1.34, 0.0, 1.34]:
\t\t_panel_on(sofa_root, Vector3(1.26, 0.16, 1.18), Vector3(x, 0.49, -0.08), fabric_dark)
\t\t_capsule_on(sofa_root, Vector3(x, 0.92, 0.49), 0.17, 1.14, fabric_dark, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 0.86))
\tfor x in [-2.06, 2.06]:
\t\t_capsule_on(sofa_root, Vector3(x, 0.58, 0.02), 0.16, 0.78, fabric_dark, Vector3.ZERO, Vector3(1.0, 1.0, 2.55))
\tfor x in [-0.98, 0.92]:
\t\t_sphere_on(sofa_root, Vector3(x, 0.84, -0.42), Vector3(0.34, 0.25, 0.13), fabric_light)'''
    new_sofa = '''\t# Production sofa uses restrained upholstered slabs instead of capsule tubes.
\tvar sofa_root = Node3D.new()
\tsofa_root.position = Vector3(-7.0, 0.0, 5.78)
\troot.add_child(sofa_root)
\tvar sofa_cushion = _simple_material(Color("5b6066"), 0.96, 0.0)
\tvar sofa_accent = _simple_material(Color("9a897b"), 0.98, 0.0)
\t_panel_on(sofa_root, Vector3(4.20, 0.22, 1.34), Vector3(0.0, 0.28, 0.0), fabric_dark)
\tfor x in [-1.30, 0.0, 1.30]:
\t\t_panel_on(sofa_root, Vector3(1.20, 0.16, 1.02), Vector3(x, 0.48, -0.10), sofa_cushion)
\t\t_panel_on(sofa_root, Vector3(1.16, 0.72, 0.18), Vector3(x, 0.88, 0.51), sofa_cushion, Vector3(-8.0, 0.0, 0.0))
\tfor x in [-2.02, 2.02]:
\t\t_panel_on(sofa_root, Vector3(0.18, 0.62, 1.18), Vector3(x, 0.54, 0.0), fabric_dark)
\t_sphere_on(sofa_root, Vector3(-0.94, 0.78, -0.43), Vector3(0.26, 0.20, 0.11), sofa_accent)
\t_sphere_on(sofa_root, Vector3(0.92, 0.78, -0.43), Vector3(0.26, 0.20, 0.11), fabric_light)'''
    replace_exact(
        production,
        old_sofa,
        new_sofa,
        "replace remaining capsule sofa backs with upholstered panels",
    )

    old_bed = '''\t\t_panel(Vector3(2.78, 0.18, 3.72), p + Vector3(0.0, 0.17, 0.0), oak)
\t\t_panel(Vector3(2.64, 0.27, 3.52), p + Vector3(0.0, 0.41, 0.0), fabric_light)
\t\t# A restrained rounded duvet keeps a soft silhouette without becoming a giant oval blob.
\t\t_capsule(p + Vector3(0.0, 0.63, -0.18), 0.17, 2.24, fabric_light, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 5.8))
\t\t_sphere(p + Vector3(-0.55, 0.70, 1.20), Vector3(0.48, 0.14, 0.30), warm_white)
\t\t_sphere(p + Vector3(0.55, 0.70, 1.20), Vector3(0.48, 0.14, 0.30), warm_white)
\t\t# Lower, narrower upholstered headboard channels improve room scale.
\t\tfor x in range(6):
\t\t\t_capsule(p + Vector3(-0.875 + float(x) * 0.35, 1.28, 1.64), 0.105, 0.92, fabric_dark, Vector3.ZERO, Vector3(1.0, 1.0, 0.28))
\t\t_bedside_table(p + Vector3(-1.68, 0.0, 0.92), idx)
\t\t_bedside_table(p + Vector3(1.68, 0.0, 0.92), idx + 10)'''
    new_bed = '''\t\t_panel(Vector3(2.78, 0.18, 3.72), p + Vector3(0.0, 0.17, 0.0), oak)
\t\t_panel(Vector3(2.64, 0.27, 3.52), p + Vector3(0.0, 0.41, 0.0), fabric_light)
\t\t# Layered bedding reads as a duvet instead of a stretched capsule/blob.
\t\t_panel(Vector3(2.48, 0.13, 2.72), p + Vector3(0.0, 0.61, -0.30), fabric_light)
\t\t_panel(Vector3(2.50, 0.055, 0.54), p + Vector3(0.0, 0.69, -1.26), _simple_material(Color("a79484"), 0.98, 0.0))
\t\t_sphere(p + Vector3(-0.55, 0.67, 1.17), Vector3(0.46, 0.13, 0.28), warm_white)
\t\t_sphere(p + Vector3(0.55, 0.67, 1.17), Vector3(0.46, 0.13, 0.28), warm_white)
\t\t# One upholstered headboard with subtle vertical seams replaces pipe-like channels.
\t\t_panel(Vector3(2.68, 1.02, 0.14), p + Vector3(0.0, 1.23, 1.64), fabric_dark)
\t\tfor x in [-0.88, -0.44, 0.0, 0.44, 0.88]:
\t\t\t_panel(Vector3(0.018, 0.82, 0.025), p + Vector3(x, 1.23, 1.56), metal_dark)
\t\t_bedside_table(p + Vector3(-1.68, 0.0, 0.92), idx)
\t\t_bedside_table(p + Vector3(1.68, 0.0, 0.92), idx + 10)'''
    replace_exact(
        production,
        old_bed,
        new_bed,
        "replace capsule duvet and pipe headboard with layered bedding",
    )

    replace_exact(
        production,
        '''\t\tbedroom_light.add_to_group("quality_extra_light")
\t\troot.add_child(bedroom_light)''',
        '''\t\tbedroom_light.add_to_group("quality_extra_light")
\t\troot.add_child(bedroom_light)
\t# Living-room fill preserves fabric/wood separation at dusk without shadow cost.
\tvar living_fill = OmniLight3D.new()
\tliving_fill.position = Vector3(-7.0, 2.35, 5.35)
\tliving_fill.light_color = Color("ffd4aa")
\tliving_fill.light_energy = 0.40
\tliving_fill.omni_range = 4.8
\tliving_fill.shadow_enabled = false
\tliving_fill.add_to_group("quality_extra_light")
\troot.add_child(living_fill)''',
        "add low-cost dusk fill for living-room upholstery",
    )

    # Give the narrow galley more circulation around the interactive island.
    replace_exact(
        ultra,
        '_panel(root,Vector3(2.75,0.08,1.15),Vector3(6.3,0.98,4.95),Vector3.ZERO,marble)',
        '_panel(root,Vector3(2.45,0.08,0.98),Vector3(6.3,0.98,4.95),Vector3.ZERO,marble)',
        "reduce kitchen island top footprint",
    )
    replace_exact(
        ultra,
        'for x in [4.96,7.64]:\n\t\t_panel(root,Vector3(0.08,0.92,1.08),Vector3(x,0.50,4.95),Vector3.ZERO,marble)',
        'for x in [5.11,7.49]:\n\t\t_panel(root,Vector3(0.08,0.92,0.92),Vector3(x,0.50,4.95),Vector3.ZERO,marble)',
        "tighten waterfall island sides for wider passages",
    )

    print("CUMA VISUAL FINISH PATCH: PASS")


if __name__ == "__main__":
    main()
