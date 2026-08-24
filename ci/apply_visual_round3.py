#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL ROUND3 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL ROUND3 APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    production = ROOT / "scripts" / "world" / "production_home_builder.gd"
    ultra = ROOT / "scripts" / "world" / "ultra_home_builder.gd"

    # Round 3 is deliberately small and only targets defects still visible in
    # Visual Audit #7. It runs after apply_visual_finish.py.
    replace_exact(
        production,
        'fixture.material_override = _emissive(Color("ffe2bd"), 1.12)',
        'fixture.material_override = _emissive(Color("ffe2bd"), 0.82)',
        "reduce corridor fixture bloom line",
    )
    replace_exact(
        production,
        '''\t\tlight.light_energy = 0.46
\t\tlight.omni_range = 3.55''',
        '''\t\tlight.light_energy = 0.34
\t\tlight.omni_range = 3.15''',
        "reduce corridor ceiling hotspot intensity",
    )

    # Bedroom furniture still dominates the room in the real render. Keep the
    # same composition but bring it closer to believable apartment proportions.
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.78, 0.18, 3.72), p + Vector3(0.0, 0.17, 0.0), oak)',
        '\t\t_panel(Vector3(2.50, 0.18, 3.38), p + Vector3(0.0, 0.17, 0.0), oak)',
        "reduce bed frame footprint",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.64, 0.27, 3.52), p + Vector3(0.0, 0.41, 0.0), fabric_light)',
        '\t\t_panel(Vector3(2.38, 0.25, 3.18), p + Vector3(0.0, 0.40, 0.0), fabric_light)',
        "reduce mattress footprint",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.48, 0.13, 2.72), p + Vector3(0.0, 0.61, -0.30), fabric_light)',
        '\t\t_panel(Vector3(2.22, 0.12, 2.36), p + Vector3(0.0, 0.59, -0.28), fabric_light)',
        "reduce duvet mass",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.50, 0.055, 0.54), p + Vector3(0.0, 0.69, -1.26), _simple_material(Color("a79484"), 0.98, 0.0))',
        '\t\t_panel(Vector3(2.22, 0.050, 0.46), p + Vector3(0.0, 0.66, -1.12), _simple_material(Color("a79484"), 0.98, 0.0))',
        "reduce duvet accent strip",
    )
    replace_exact(
        production,
        '\t\t_panel(Vector3(2.68, 1.02, 0.14), p + Vector3(0.0, 1.23, 1.64), fabric_dark)',
        '\t\t_panel(Vector3(2.42, 0.92, 0.13), p + Vector3(0.0, 1.18, 1.48), fabric_dark)',
        "scale down headboard",
    )
    replace_exact(
        production,
        '\t\t_bedside_table(p + Vector3(-1.68, 0.0, 0.92), idx)\n\t\t_bedside_table(p + Vector3(1.68, 0.0, 0.92), idx + 10)',
        '\t\t_bedside_table(p + Vector3(-1.48, 0.0, 0.84), idx)\n\t\t_bedside_table(p + Vector3(1.48, 0.0, 0.84), idx + 10)',
        "bring bedside tables into scaled bedroom composition",
    )
    replace_exact(
        production,
        'bedroom_light.light_energy = 0.60',
        'bedroom_light.light_energy = 0.66',
        "recover bedroom detail after furniture scaling",
    )

    # The #7 galley render still has too little circulation. Narrow the sole
    # interactive island while preserving its slatted production face.
    replace_exact(
        ultra,
        '_panel(root,Vector3(2.45,0.08,0.98),Vector3(6.3,0.98,4.95),Vector3.ZERO,marble)',
        '_panel(root,Vector3(2.16,0.08,0.82),Vector3(6.3,0.98,4.95),Vector3.ZERO,marble)',
        "narrow kitchen island top further",
    )
    replace_exact(
        ultra,
        '_panel(root,Vector3(2.18,0.62,0.72),Vector3(6.3,0.56,4.95),Vector3.ZERO,_mat(Color("3f4247"),0.90))',
        '_panel(root,Vector3(1.88,0.58,0.58),Vector3(6.3,0.54,4.95),Vector3.ZERO,_mat(Color("3f4247"),0.90))',
        "narrow kitchen island carcass",
    )
    replace_exact(
        ultra,
        'for x in [5.11,7.49]:\n\t\t_panel(root,Vector3(0.08,0.92,0.92),Vector3(x,0.50,4.95),Vector3.ZERO,marble)',
        'for x in [5.24,7.36]:\n\t\t_panel(root,Vector3(0.07,0.88,0.78),Vector3(x,0.48,4.95),Vector3.ZERO,marble)',
        "narrow kitchen waterfall sides",
    )

    # Replace the remaining bar-like curtain silhouette with broad cloth panels.
    # The LeftFabric/RightFabric nodes still move exactly as before, so networking
    # and curtain interactions remain intact.
    old_folds = '''\tfor i in range(11):
\t\tvar off = float(i) * 0.058
\t\t_capsule(left, Vector3(-width * 0.24 + off, 0, 0), 0.036, height, cloth, Vector3.ZERO, Vector3(1.0, 1.0, 0.34))
\t\t_capsule(right, Vector3(width * 0.24 - off, 0, 0), 0.036, height, cloth, Vector3.ZERO, Vector3(1.0, 1.0, 0.34))'''
    new_folds = '''\t_panel(left, Vector3(width * 0.46, height, 0.035), Vector3(-width * 0.23, 0, 0), Vector3.ZERO, cloth)
\t_panel(right, Vector3(width * 0.46, height, 0.035), Vector3(width * 0.23, 0, 0), Vector3.ZERO, cloth)
\tvar fold_mat = _mat(Color("c8c1b6"), 0.99, 0.0, linen_tex)
\tfor i in range(6):
\t\tvar fold_x = -width * 0.41 + float(i) * width * 0.075
\t\t_panel(left, Vector3(0.026, height * 0.96, 0.026), Vector3(fold_x, 0, -0.028), Vector3.ZERO, fold_mat)
\t\t_panel(right, Vector3(0.026, height * 0.96, 0.026), Vector3(-fold_x, 0, -0.028), Vector3.ZERO, fold_mat)'''
    replace_exact(
        ultra,
        old_folds,
        new_folds,
        "replace curtain bars with cloth panels and subtle folds",
    )

    print("CUMA VISUAL ROUND3 PATCH: PASS")


if __name__ == "__main__":
    main()
