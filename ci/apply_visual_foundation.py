#!/usr/bin/env python3
"""Apply the portable visual foundation after the existing production patches."""
from pathlib import Path
import shutil

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE / "game"


def replace(path, old, new):
    source = path.read_text()
    if new in source:
        return
    if source.count(old) != 1:
        raise RuntimeError(f"Unexpected source in {path}: {old!r}")
    path.write_text(source.replace(old, new, 1))


def main():
    state = ROOT / "scripts/game_state.gd"
    replace(state, 'if normalized not in ["LOW", "MEDIUM", "HIGH"]:',
            'if normalized not in ["LOW", "MEDIUM", "HIGH", "ULTRA"]:')
    replace(state, 'loaded_quality in ["LOW", "MEDIUM", "HIGH"] else "MEDIUM"',
            'loaded_quality in ["LOW", "MEDIUM", "HIGH", "ULTRA"] else "MEDIUM"')
    replace(state, '\t\t"MEDIUM": set_quality("HIGH")\n\t\t_: set_quality("LOW")',
            '\t\t"MEDIUM": set_quality("HIGH")\n\t\t"HIGH": set_quality("ULTRA")\n\t\t_: set_quality("LOW")')
    shutil.copyfile(BASE / "ci/overlays/visual/graphics_manager.gd",
                    ROOT / "scripts/graphics_manager.gd")
    shutil.copyfile(BASE / "ci/overlays/visual/beveled_box.gd",
                    ROOT / "scripts/world/beveled_box.gd")
    material = ROOT / "scripts/world/production_home_builder.gd"
    replace(material, "extends Node\n", 'extends Node\n\nconst BeveledBox = preload("res://scripts/world/beveled_box.gd")\n')
    replace(material, '\tvar mesh = BoxMesh.new()\n\tmesh.size = size\n\tmi.mesh = mesh',
            '\t# Keep thin trim/rugs cheap; furniture gets a small light-catching bevel.\n\tif minf(size.x, minf(size.y, size.z)) >= 0.07:\n\t\tmi.mesh = BeveledBox.create(size)\n\telse:\n\t\tvar mesh = BoxMesh.new()\n\t\tmesh.size = size\n\t\tmi.mesh = mesh')
    replace(material,
            '\tmat.uv1_scale = Vector3(uv_scale, uv_scale, uv_scale)\n\treturn mat',
            '''\t# Static home surfaces use metre-based projection instead of stretched box UVs.
\tmat.uv1_triplanar = true
\tmat.uv1_world_triplanar = true
\tmat.uv1_triplanar_sharpness = 8.0
\tmat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
\tmat.uv1_scale = Vector3(uv_scale, uv_scale, uv_scale)
\treturn mat''')
    print("VISUAL FOUNDATION: PASS")


if __name__ == "__main__":
    main()
