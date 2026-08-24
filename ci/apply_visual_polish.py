#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL PATCH ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL PATCH APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    main_script = ROOT / "scripts" / "main.gd"
    production_home = ROOT / "scripts" / "world" / "production_home_builder.gd"
    public_transport = ROOT / "scripts" / "city" / "public_transport_vehicle.gd"
    patrol_vehicle = ROOT / "scripts" / "crime" / "patrol_vehicle.gd"

    # Visual Audit exposed a world-runtime defect: AnimatableBody3D vehicles were
    # being moved from idle _process() while sync_to_physics stayed enabled. Godot's
    # physics synchronization restored their transforms to the body origin, leaving
    # bus, taxi and patrol car stacked inside the house at (0, 0, 0). Keep manual
    # movement physics-ticked and opt these procedural vehicles out of transform sync.
    replace_exact(
        public_transport,
        '''func setup(id_value: String, title: String, points: Array[Vector3], speed_value: float, body_color: Color) -> void:
\tvehicle_id = id_value.strip_edges().left(48)''',
        '''func setup(id_value: String, title: String, points: Array[Vector3], speed_value: float, body_color: Color) -> void:
\tsync_to_physics = false
\tset_physics_process(true)
\tvehicle_id = id_value.strip_edges().left(48)''',
        "disable AnimatableBody3D transform resync for public transport",
    )
    replace_exact(
        public_transport,
        'func _process(delta: float) -> void:',
        'func _physics_process(delta: float) -> void:',
        "simulate public transport on physics ticks",
    )
    replace_exact(
        public_transport,
        '''func set_simulation_enabled(enabled: bool) -> void:
\tvisible = enabled
\tset_process(enabled)''',
        '''func set_simulation_enabled(enabled: bool) -> void:
\tvisible = enabled
\tset_physics_process(enabled)''',
        "toggle public transport physics simulation with quality state",
    )

    replace_exact(
        patrol_vehicle,
        '''func setup(points: Array[Vector3]) -> void:
\troute = points.duplicate()''',
        '''func setup(points: Array[Vector3]) -> void:
\tsync_to_physics = false
\tset_physics_process(true)
\troute = points.duplicate()''',
        "disable AnimatableBody3D transform resync for police patrol",
    )
    replace_exact(
        patrol_vehicle,
        'func _process(delta: float) -> void:',
        'func _physics_process(delta: float) -> void:',
        "simulate police patrol on physics ticks",
    )
    replace_exact(
        patrol_vehicle,
        '''func set_simulation_enabled(enabled: bool) -> void:
\tvisible = enabled
\tset_process(enabled)''',
        '''func set_simulation_enabled(enabled: bool) -> void:
\tvisible = enabled
\tset_physics_process(enabled)''',
        "toggle police patrol physics simulation with quality state",
    )

    # Corridor cleanup: the original prototype bench/board/decor collider placement
    # left gameplay geometry in the middle of the hallway even after its meshes were hidden.
    replace_exact(
        main_script,
        '\t_add_static_box("HallBench", Vector3(1.2, 0.48, 0.52), Vector3(0.0, 0.24, 4.9), Color("67503f"))',
        '\t# Keep the legacy collision aligned with the production entry bench instead of blocking the corridor center.\n'
        '\t_add_static_box("HallBench", Vector3(1.2, 0.48, 0.52), Vector3(-0.75, 0.24, 6.85), Color("67503f"))',
        "align legacy hall bench collider with production bench",
    )
    replace_exact(
        main_script,
        '\tboard.position = Vector3(0.0, 1.35, 4.35)',
        '\tboard.position = Vector3(-1.62, 1.42, 3.85)\n\tboard.rotation_degrees.y = 90.0',
        "mount shared plan board on corridor wall",
    )
    replace_exact(
        main_script,
        '\tdecor.position = Vector3(0.0, 1.0, 2.1)',
        '\tdecor.position = Vector3(1.62, 1.28, 2.10)\n\tdecor.rotation_degrees.y = 90.0',
        "mount decor station on corridor wall",
    )

    # These two interaction panels are now intentionally wall-mounted production props;
    # keep their visible faces instead of hiding them as obsolete prototype furniture.
    replace_exact(
        production_home,
        '\t\t"TogetherBoard", "GiftStation", "DecorStation"',
        '\t\t"GiftStation"',
        "keep wall-mounted board and decor panel visible",
    )

    old_sofa = '''\t# Soft modular sofa. Capsules and spheres break the primitive-box silhouette.
\tvar sofa_root = Node3D.new()
\tsofa_root.position = Vector3(-7.0, 0.0, 5.78)
\troot.add_child(sofa_root)
\t_capsule_on(sofa_root, Vector3(-1.30, 0.44, 0.0), 0.26, 1.55, fabric_dark, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 1.35))
\t_capsule_on(sofa_root, Vector3(0.0, 0.44, 0.0), 0.26, 1.55, fabric_dark, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 1.35))
\t_capsule_on(sofa_root, Vector3(1.30, 0.44, 0.0), 0.26, 1.55, fabric_dark, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 1.35))
\tfor x in [-1.32, 0.0, 1.32]:
\t\t_capsule_on(sofa_root, Vector3(x, 0.92, 0.42), 0.22, 1.35, fabric_dark, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 1.10))
\tfor x in [-1.0, 0.95]:
\t\t_sphere_on(sofa_root, Vector3(x, 0.94, -0.28), Vector3(0.42, 0.32, 0.16), fabric_light)'''
    new_sofa = '''\t# Production sofa: one low structural base, individual seat cushions and softer back cushions.
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
    replace_exact(
        production_home,
        old_sofa,
        new_sofa,
        "replace tube-like sofa with lower modular production silhouette",
    )

    old_bed = '''\t\t_panel(Vector3(3.04, 0.20, 4.02), p + Vector3(0.0, 0.18, 0.0), oak)
\t\t_panel(Vector3(2.88, 0.32, 3.82), p + Vector3(0.0, 0.46, 0.0), fabric_light)
\t\t# Duvet is a rounded scaled capsule, not a slab.
\t\t_capsule(p + Vector3(0.0, 0.72, -0.15), 0.25, 2.55, fabric_light, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 6.8))
\t\t_sphere(p + Vector3(-0.67, 0.79, 1.30), Vector3(0.58, 0.18, 0.38), warm_white)
\t\t_sphere(p + Vector3(0.67, 0.79, 1.30), Vector3(0.58, 0.18, 0.38), warm_white)
\t\t# Upholstered headboard with vertical channels.
\t\tfor x in range(6):
\t\t\t_capsule(p + Vector3(-1.0 + float(x) * 0.40, 1.48, 1.78), 0.13, 1.05, fabric_dark, Vector3.ZERO, Vector3(1.0, 1.0, 0.34))
\t\t_bedside_table(p + Vector3(-1.92, 0.0, 1.0), idx)
\t\t_bedside_table(p + Vector3(1.92, 0.0, 1.0), idx + 10)'''
    new_bed = '''\t\t_panel(Vector3(2.78, 0.18, 3.72), p + Vector3(0.0, 0.17, 0.0), oak)
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
    replace_exact(
        production_home,
        old_bed,
        new_bed,
        "rebalance bed, duvet, pillow and headboard proportions",
    )

    old_light_block = '''\tfor z in [-5.5, 0.0, 5.6]:
\t\tvar light = OmniLight3D.new()
\t\tlight.position = Vector3(0.0, 2.65, z)
\t\tlight.light_color = Color("ffd9ad")
\t\tlight.light_energy = 0.62
\t\tlight.omni_range = 3.8
\t\tlight.shadow_enabled = false
\t\tlight.add_to_group("quality_extra_light")
\t\troot.add_child(light)'''
    new_light_block = '''\tfor z in [-5.5, 0.0, 5.6]:
\t\tvar light = OmniLight3D.new()
\t\tlight.position = Vector3(0.0, 2.65, z)
\t\tlight.light_color = Color("ffd9ad")
\t\tlight.light_energy = 0.62
\t\tlight.omni_range = 3.8
\t\tlight.shadow_enabled = false
\t\tlight.add_to_group("quality_extra_light")
\t\troot.add_child(light)
\t# Bedroom-local fill lights fix the dusk audit without adding shadow cost.
\tfor p in [Vector3(-7.2, 2.35, -5.9), Vector3(-7.0, 2.35, 0.2), Vector3(7.0, 2.35, -5.7), Vector3(7.2, 2.35, 0.2)]:
\t\tvar bedroom_light = OmniLight3D.new()
\t\tbedroom_light.position = p
\t\tbedroom_light.light_color = Color("ffd7ad")
\t\tbedroom_light.light_energy = 0.48
\t\tbedroom_light.omni_range = 4.4
\t\tbedroom_light.shadow_enabled = false
\t\tbedroom_light.add_to_group("quality_extra_light")
\t\troot.add_child(bedroom_light)'''
    replace_exact(
        production_home,
        old_light_block,
        new_light_block,
        "add low-cost bedroom-local warm fill lights",
    )

    print("CUMA VISUAL POLISH PATCH: PASS")


if __name__ == "__main__":
    main()
