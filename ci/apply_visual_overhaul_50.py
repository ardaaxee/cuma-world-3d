#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_function(path: Path, name: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    start_token = f"func {name}"
    start = text.find(start_token)
    if start < 0:
        raise SystemExit(f"VISUAL50: function not found: {path.name}:{name}")
    end = text.find("\nfunc ", start + len(start_token))
    if end < 0:
        end = len(text)
    current = text[start:end].rstrip()
    normalized = replacement.strip()
    if current == normalized:
        print(f"VISUAL50 ALREADY APPLIED: {path.name}:{name}")
        return
    text = text[:start] + normalized + "\n" + text[end:]
    path.write_text(text, encoding="utf-8")
    print(f"VISUAL50 APPLIED: {path.name}:{name}")


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL50 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"VISUAL50 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL50 APPLIED: {label}")


def patch_home() -> None:
    path = ROOT / "scripts/world/production_home_builder.gd"

    replace_function(path, "_build_materials() -> void:", r'''func _build_materials() -> void:
	# Visual Overhaul 5.0 keeps the existing texture set but moves the palette
	# toward a calmer premium residential look with stronger material separation.
	plaster = _pbr_material("plaster", Color("e3dfd8"), 0.90, 0.0, 2.65, 0.40)
	oak = _pbr_material("oak", Color("795a42"), 0.66, 0.0, 3.35, 0.52)
	fabric_dark = _pbr_material("fabric", Color("454a50"), 0.98, 0.0, 2.35, 0.30)
	fabric_light = _pbr_material("fabric", Color("c9c1b7"), 0.99, 0.0, 2.35, 0.26)
	stone = _pbr_material("stone", Color("c4c1ba"), 0.40, 0.0, 2.35, 0.52)
	tile = _pbr_material("tile", Color("ddd9d1"), 0.46, 0.0, 2.80, 0.42)
	metal_dark = _simple_material(Color("20252a"), 0.22, 0.82)
	warm_white = _simple_material(Color("f3eee5"), 0.82, 0.0)
	glass_mat = _simple_material(Color(0.66, 0.78, 0.84, 0.16), 0.06, 0.18)
	glass_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA''')

    replace_function(path, "_build_corridor_architecture() -> void:", r'''func _build_corridor_architecture() -> void:
	# Continuous baseboards, crown reveals and warm cove light remove the flat
	# prototype-corridor look while staying cheap enough for Android.
	_panel(Vector3(0.045, 0.13, 17.15), Vector3(-1.685, 0.065, 0.0), warm_white)
	_panel(Vector3(0.045, 0.13, 17.15), Vector3(1.685, 0.065, 0.0), warm_white)
	_panel(Vector3(0.045, 0.055, 16.25), Vector3(-1.61, 3.07, -0.05), warm_white)
	_panel(Vector3(0.045, 0.055, 16.25), Vector3(1.61, 3.07, -0.05), warm_white)
	_panel(Vector3(0.026, 0.020, 15.9), Vector3(-1.54, 3.035, -0.05), _emissive(Color("ffd9b2"), 0.52))
	_panel(Vector3(0.026, 0.020, 15.9), Vector3(1.54, 3.035, -0.05), _emissive(Color("ffd9b2"), 0.52))

	var left_doors: Array[float] = [-5.3, 0.7, 6.5]
	var right_doors: Array[float] = [-5.3, 0.7, 5.0, 8.2]
	for z in left_doors:
		_door_trim(Vector3(-1.79, 1.18, z), 90.0, 1.4)
	for z in right_doors:
		_door_trim(Vector3(1.79, 1.18, z), 90.0, 1.4)
	_door_trim(Vector3(-1.25, 1.18, 8.99), 0.0, 2.5)

	var runner = _pbr_material("fabric", Color("817a72"), 0.99, 0.0, 3.0, 0.18)
	_panel(Vector3(1.52, 0.018, 14.7), Vector3(0.0, 0.025, -0.2), runner)
	_panel(Vector3(0.018, 0.022, 14.7), Vector3(-0.745, 0.029, -0.2), _simple_material(Color("34373a"), 0.80, 0.0))
	_panel(Vector3(0.018, 0.022, 14.7), Vector3(0.745, 0.029, -0.2), _simple_material(Color("34373a"), 0.80, 0.0))
	for z in [-6.0, -1.6, 3.0, 7.0]:
		_panel(Vector3(0.028, 0.22, 0.14), Vector3(-1.665, 1.88, z), metal_dark)
		_panel(Vector3(0.032, 0.13, 0.09), Vector3(-1.64, 1.88, z), _emissive(Color("ffd8ae"), 0.62))
	_wall_art(Vector3(-1.675, 1.60, -7.6), true, Color("71838a"))
	_wall_art(Vector3(1.675, 1.60, -3.7), false, Color("a27e66"))
	_wall_art(Vector3(-1.675, 1.60, 2.0), true, Color("79846f"))''')

    replace_function(path, "_build_living_room() -> void:", r'''func _build_living_room() -> void:
	# 5.0 sofa: low visual plinth + rounded seat/back cushions. This keeps a clean
	# silhouette but removes the stacked-box appearance visible in previous audits.
	var sofa_root = Node3D.new()
	sofa_root.name = "VisualOverhaul50Sofa"
	sofa_root.position = Vector3(-7.0, 0.0, 5.78)
	root.add_child(sofa_root)
	var cushion = _pbr_material("fabric", Color("5e646b"), 0.99, 0.0, 2.6, 0.27)
	var cushion_dark = _pbr_material("fabric", Color("40464d"), 0.99, 0.0, 2.6, 0.27)
	var accent = _pbr_material("fabric", Color("a78f7c"), 0.99, 0.0, 2.8, 0.22)
	_panel_on(sofa_root, Vector3(4.22, 0.16, 1.28), Vector3(0.0, 0.22, 0.0), cushion_dark)
	for x in [-1.30, 0.0, 1.30]:
		_soft_ellipsoid_on(sofa_root, Vector3(x, 0.46, -0.10), Vector3(0.60, 0.115, 0.49), cushion)
		_soft_ellipsoid_on(sofa_root, Vector3(x, 0.91, 0.48), Vector3(0.57, 0.35, 0.11), cushion, Vector3(-7.0, 0.0, 0.0))
	for x in [-2.02, 2.02]:
		_capsule_on(sofa_root, Vector3(x, 0.49, -0.01), 0.18, 0.72, cushion_dark, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 1.20))
	_soft_ellipsoid_on(sofa_root, Vector3(-0.93, 0.76, -0.39), Vector3(0.26, 0.20, 0.08), accent, Vector3(-7.0, 11.0, 0.0))
	_soft_ellipsoid_on(sofa_root, Vector3(0.93, 0.76, -0.39), Vector3(0.26, 0.20, 0.08), fabric_light, Vector3(-7.0, -11.0, 0.0))
	for x in [-1.78, 1.78]:
		_panel_on(sofa_root, Vector3(0.10, 0.14, 0.10), Vector3(x, 0.07, -0.38), metal_dark)
		_panel_on(sofa_root, Vector3(0.10, 0.14, 0.10), Vector3(x, 0.07, 0.38), metal_dark)

	# Coffee table with thinner stone and recessed black frame.
	_panel(Vector3(2.10, 0.060, 1.04), Vector3(-7.0, 0.61, 4.10), stone)
	_panel(Vector3(1.88, 0.035, 0.035), Vector3(-7.0, 0.46, 3.63), metal_dark)
	_panel(Vector3(1.88, 0.035, 0.035), Vector3(-7.0, 0.46, 4.57), metal_dark)
	for x in [-0.86, 0.86]:
		for z in [-0.39, 0.39]:
			_cylinder(Vector3(-7.0 + x, 0.31, 4.10 + z), 0.016, 0.54, metal_dark)
	_panel(Vector3(4.95, 0.014, 3.30), Vector3(-7.0, 0.022, 4.88), _pbr_material("fabric", Color("aaa39a"), 0.99, 0.0, 3.1, 0.20))

	# Walnut media wall + acoustic slats + actual television face + backlight.
	var media_wood = _pbr_material("oak", Color("6b4e3b"), 0.72, 0.0, 3.6, 0.45)
	_panel(Vector3(4.15, 1.96, 0.055), Vector3(-7.0, 1.38, 3.02), media_wood)
	for x in range(13):
		_panel(Vector3(0.050, 1.92, 0.028), Vector3(-8.92 + float(x) * 0.32, 1.38, 2.975), oak)
	_panel(Vector3(3.48, 1.55, 0.026), Vector3(-7.0, 1.48, 2.925), _emissive(Color("d9c29e"), 0.26))
	_panel(Vector3(3.30, 1.38, 0.050), Vector3(-7.0, 1.48, 2.885), _simple_material(Color("090b0d"), 0.10, 0.10))
	_panel(Vector3(3.16, 1.24, 0.014), Vector3(-7.0, 1.48, 2.852), _simple_material(Color("111820"), 0.16, 0.18))
	_panel(Vector3(3.82, 0.15, 0.44), Vector3(-7.0, 0.40, 3.16), stone)
	for x in [-1.25, 0.0, 1.25]:
		_panel(Vector3(1.15, 0.34, 0.36), Vector3(-7.0 + x, 0.23, 3.16), _simple_material(Color("373c41"), 0.74, 0.12))
	_panel(Vector3(1.35, 0.075, 0.075), Vector3(-7.0, 0.61, 3.03), metal_dark)
	_cylinder(Vector3(-9.05, 0.69, 3.28), 0.10, 0.42, metal_dark)
	_cylinder(Vector3(-4.95, 0.69, 3.28), 0.10, 0.42, metal_dark)

	# Small lived-in details.
	_panel(Vector3(0.36, 0.035, 0.24), Vector3(-7.35, 0.66, 4.00), _simple_material(Color("3f4851"), 0.76, 0.0), Vector3(0.0, 16.0, 0.0))
	_panel(Vector3(0.28, 0.025, 0.12), Vector3(-6.62, 0.66, 4.18), metal_dark, Vector3(0.0, -12.0, 0.0))
	_floor_lamp(Vector3(-9.35, 0.0, 5.62))
	_plant(Vector3(-4.55, 0.0, 3.72), 0.88)''')

    replace_function(path, "_build_bedrooms() -> void:", r'''func _build_bedrooms() -> void:
	var beds: Array[Vector3] = [Vector3(-7.2, 0.0, -6.4), Vector3(-7.0, 0.0, -0.1), Vector3(7.0, 0.0, -6.2), Vector3(7.2, 0.0, -0.2)]
	var accent_colors: Array[Color] = [Color("8b7567"), Color("697884"), Color("80786c"), Color("856f79")]
	for idx in range(beds.size()):
		var p: Vector3 = beds[idx]
		_panel(Vector3(3.65, 0.013, 4.15), p + Vector3(0.0, 0.020, -0.10), _pbr_material("fabric", Color("a9a198"), 0.99, 0.0, 3.0, 0.18))
		_panel(Vector3(2.38, 0.16, 3.16), p + Vector3(0.0, 0.16, 0.0), oak)
		_panel(Vector3(2.24, 0.21, 2.98), p + Vector3(0.0, 0.38, 0.0), fabric_light)
		# Rounded duvet and pillows create soft silhouettes instead of layered slabs.
		_soft_ellipsoid(p + Vector3(0.0, 0.59, -0.25), Vector3(1.04, 0.105, 1.04), fabric_light)
		_panel(Vector3(2.08, 0.045, 0.42), p + Vector3(0.0, 0.67, -1.02), _simple_material(accent_colors[idx], 0.98, 0.0))
		_soft_ellipsoid(p + Vector3(-0.55, 0.70, 1.12), Vector3(0.46, 0.13, 0.28), warm_white, Vector3(0.0, 8.0, 0.0))
		_soft_ellipsoid(p + Vector3(0.55, 0.70, 1.12), Vector3(0.46, 0.13, 0.28), warm_white, Vector3(0.0, -8.0, 0.0))
		_panel(Vector3(2.55, 1.08, 0.045), p + Vector3(0.0, 1.28, 1.46), _pbr_material("oak", Color("70523e"), 0.76, 0.0, 3.1, 0.42))
		_panel(Vector3(2.28, 0.79, 0.105), p + Vector3(0.0, 1.23, 1.40), _pbr_material("fabric", Color("656a70"), 0.99, 0.0, 2.5, 0.24))
		for x in [-0.84, -0.42, 0.0, 0.42, 0.84]:
			_panel(Vector3(0.012, 0.72, 0.020), p + Vector3(x, 1.23, 1.335), _simple_material(Color("555b61"), 0.95, 0.0))
		_panel(Vector3(2.26, 0.018, 0.025), p + Vector3(0.0, 1.68, 1.365), _emissive(Color("ffd7b1"), 0.46))
		_bedside_table(p + Vector3(-1.38, 0.0, 0.78), idx)
		_bedside_table(p + Vector3(1.38, 0.0, 0.78), idx + 10)
		# Upholstered bench at the foot of each bed.
		_soft_ellipsoid(p + Vector3(0.0, 0.39, -1.92), Vector3(0.86, 0.18, 0.28), _pbr_material("fabric", accent_colors[idx], 0.99, 0.0, 2.8, 0.20))
		for x in [-0.66, 0.66]:
			_cylinder(p + Vector3(x, 0.18, -1.92), 0.015, 0.30, metal_dark)
	_wardrobe_visual(Vector3(-10.1, 0.0, -7.9), 2.6)
	_wardrobe_visual(Vector3(10.0, 0.0, -7.8), 2.8)
	_wardrobe_visual(Vector3(10.0, 0.0, 1.65), 3.1)''')

    replace_function(path, "_build_kitchen_details() -> void:", r'''func _build_kitchen_details() -> void:
	# Counter/backsplash stack with a warm task-light layer.
	var backsplash = _pbr_material("tile", Color("d9d5cd"), 0.44, 0.0, 3.2, 0.44)
	_panel(Vector3(5.55, 1.08, 0.025), Vector3(8.70, 1.62, 2.93), backsplash)
	for x in range(8):
		_panel(Vector3(0.012, 1.02, 0.015), Vector3(6.08 + float(x) * 0.74, 1.62, 2.905), _simple_material(Color("b7b2aa"), 0.82, 0.0))
	_panel(Vector3(5.35, 0.085, 0.82), Vector3(8.78, 0.98, 3.34), stone)
	_panel(Vector3(0.82, 0.085, 2.12), Vector3(10.96, 0.98, 4.64), stone)
	_panel(Vector3(4.65, 0.018, 0.025), Vector3(8.52, 1.98, 3.00), _emissive(Color("ffe0b8"), 0.70))
	var task = OmniLight3D.new()
	task.position = Vector3(8.50, 1.76, 3.38)
	task.light_color = Color("ffd8ac")
	task.light_energy = 0.30
	task.omni_range = 2.7
	task.shadow_enabled = false
	task.add_to_group("quality_extra_light")
	root.add_child(task)

	# Fridge: recessed black seam, four handles and subtle toe-kick.
	var steel = _simple_material(Color("b6babd"), 0.26, 0.78)
	_panel(Vector3(1.04, 2.24, 0.90), Vector3(10.70, 1.12, 5.55), steel)
	_panel(Vector3(0.94, 0.026, 0.026), Vector3(10.70, 1.20, 5.08), metal_dark)
	_panel(Vector3(0.026, 2.08, 0.026), Vector3(10.70, 1.15, 5.08), metal_dark)
	for x in [10.50, 10.90]:
		_cylinder(Vector3(x, 1.48, 5.045), 0.011, 0.54, metal_dark)
	_panel(Vector3(0.92, 0.10, 0.08), Vector3(10.70, 0.08, 5.10), metal_dark)

	# Sink, faucet and inset induction zones.
	_panel(Vector3(1.28, 0.028, 0.50), Vector3(8.55, 1.035, 3.31), _simple_material(Color("30363b"), 0.20, 0.74))
	_cylinder(Vector3(8.55, 1.25, 3.13), 0.017, 0.38, metal_dark)
	_cylinder(Vector3(8.55, 1.42, 3.28), 0.017, 0.30, metal_dark, Vector3(90.0, 0.0, 0.0))
	for x in [-0.35, 0.35]:
		for z in [-0.22, 0.22]:
			_cylinder(Vector3(6.30 + x, 1.065, 4.95 + z), 0.12, 0.016, _simple_material(Color("0b0d0f"), 0.10, 0.18))

	# Waterfall island trim and three compact stools.
	_panel(Vector3(0.075, 0.90, 1.18), Vector3(5.09, 0.53, 4.95), stone)
	_panel(Vector3(0.075, 0.90, 1.18), Vector3(7.51, 0.53, 4.95), stone)
	for x in [5.55, 6.30, 7.05]:
		_bar_stool(Vector3(x, 0.0, 6.00))
	# Herb pot near the sink.
	_plant(Vector3(9.72, 1.01, 3.38), 0.28)''')

    replace_function(path, "_build_bathroom_details() -> void:", r'''func _build_bathroom_details() -> void:
	_panel(Vector3(9.95, 0.016, 2.60), Vector3(6.85, 0.023, 7.55), tile)
	_panel(Vector3(4.25, 2.25, 0.025), Vector3(8.55, 1.45, 8.86), tile)
	_capsule(Vector3(8.65, 0.42, 7.78), 0.34, 1.65, warm_white, Vector3(0.0, 0.0, 90.0), Vector3(1.0, 1.0, 2.6))
	_panel(Vector3(1.34, 0.66, 0.54), Vector3(4.30, 0.38, 7.16), oak)
	_panel(Vector3(1.42, 0.08, 0.62), Vector3(4.30, 0.76, 7.16), stone)
	_panel(Vector3(0.028, 1.88, 1.72), Vector3(7.02, 1.08, 7.74), glass_mat)
	_mirror(Vector3(4.30, 1.60, 7.48), Vector2(1.30, 1.12))
	# Hotel-style mirror glow, towel rail and shower hardware.
	_panel(Vector3(1.42, 0.018, 0.030), Vector3(4.30, 2.20, 7.445), _emissive(Color("ffdfba"), 0.60))
	_cylinder(Vector3(5.25, 1.05, 8.72), 0.014, 0.68, metal_dark, Vector3(0.0, 0.0, 90.0))
	_panel(Vector3(0.54, 0.62, 0.035), Vector3(5.25, 0.78, 8.69), _pbr_material("fabric", Color("c7beb1"), 0.99, 0.0, 2.4, 0.20))
	_cylinder(Vector3(9.65, 1.18, 8.72), 0.015, 0.78, metal_dark)
	_cylinder(Vector3(9.65, 1.55, 8.50), 0.015, 0.44, metal_dark, Vector3(90.0, 0.0, 0.0))''')

    replace_function(path, "_build_entry_details() -> void:", r'''func _build_entry_details() -> void:
	_panel(Vector3(1.58, 0.10, 0.40), Vector3(0.10, 0.82, 7.88), oak)
	_panel(Vector3(1.46, 0.34, 0.34), Vector3(0.10, 0.60, 7.88), _simple_material(Color("393d41"), 0.80, 0.0))
	_soft_ellipsoid(Vector3(-0.75, 0.42, 6.85), Vector3(0.62, 0.18, 0.32), fabric_dark)
	for x in [-1.10, -0.40]:
		_cylinder(Vector3(x, 0.18, 6.85), 0.016, 0.32, metal_dark)
	_mirror(Vector3(1.58, 1.55, 8.75), Vector2(0.72, 1.45))
	# Slim coat rail and shoe shelf.
	_panel(Vector3(1.35, 0.045, 0.045), Vector3(-0.78, 1.88, 8.72), metal_dark)
	for x in [-1.25, -0.93, -0.61, -0.29]:
		_cylinder(Vector3(x, 1.74, 8.68), 0.012, 0.22, metal_dark)
	_panel(Vector3(1.45, 0.065, 0.38), Vector3(-0.78, 0.16, 7.45), oak)''')

    replace_function(path, "_build_balcony_details() -> void:", r'''func _build_balcony_details() -> void:
	for i in range(20):
		_panel(Vector3(0.46, 0.026, 4.55), Vector3(-10.72 + float(i) * 0.49, 0.025, 11.40), oak)
	for x in range(21):
		_cylinder(Vector3(-10.85 + float(x) * 0.49, 0.63, 13.69), 0.014, 1.02, metal_dark)
	_panel(Vector3(10.0, 0.045, 0.045), Vector3(-6.0, 1.15, 13.69), metal_dark)
	# Softer lounge seat plus side table and varied greenery.
	_soft_ellipsoid(Vector3(-8.45, 0.45, 10.15), Vector3(0.92, 0.20, 0.42), fabric_dark)
	_soft_ellipsoid(Vector3(-8.45, 0.85, 10.48), Vector3(0.88, 0.28, 0.12), fabric_dark, Vector3(-8.0, 0.0, 0.0))
	_panel(Vector3(1.30, 0.06, 0.72), Vector3(-6.25, 0.63, 11.55), stone)
	for x in [-6.72, -5.78]:
		_cylinder(Vector3(x, 0.32, 11.55), 0.018, 0.58, metal_dark)
	_plant(Vector3(-10.25, 0.0, 12.85), 1.20)
	_plant(Vector3(-2.20, 0.0, 12.85), 1.00)
	# Warm decorative bulbs are emissive-only, so they cost no dynamic-light budget.
	for i in range(7):
		var bx = -10.4 + float(i) * 1.45
		_sphere(Vector3(bx, 2.55 + sin(float(i) * 0.7) * 0.12, 13.45), Vector3(0.055, 0.055, 0.055), _emissive(Color("ffd59d"), 1.10))''')

    replace_function(path, "_build_soft_lighting() -> void:", r'''func _build_soft_lighting() -> void:
	# Recessed points remain visible, but 5.0 uses lower-energy layered fills rather
	# than large flat omnidirectional pools.
	for z in [-7.2, -4.0, -0.8, 2.4, 5.6, 7.8]:
		var fixture = MeshInstance3D.new()
		var mesh = CylinderMesh.new()
		mesh.top_radius = 0.070
		mesh.bottom_radius = 0.070
		mesh.height = 0.022
		mesh.radial_segments = 24
		fixture.mesh = mesh
		fixture.position = Vector3(0.0, 3.075, z)
		fixture.material_override = _emissive(Color("ffe0bb"), 0.50)
		root.add_child(fixture)
	for z in [-5.5, 0.0, 5.6]:
		var light = OmniLight3D.new()
		light.position = Vector3(0.0, 2.55, z)
		light.light_color = Color("ffdfbd")
		light.light_energy = 0.20
		light.omni_range = 2.65
		light.shadow_enabled = false
		light.add_to_group("quality_extra_light")
		root.add_child(light)
	for p in [Vector3(-7.2, 2.30, -5.9), Vector3(-7.0, 2.30, 0.2), Vector3(7.0, 2.30, -5.7), Vector3(7.2, 2.30, 0.2)]:
		var bedroom_light = OmniLight3D.new()
		bedroom_light.position = p
		bedroom_light.light_color = Color("ffe7d0")
		bedroom_light.light_energy = 0.72
		bedroom_light.omni_range = 4.65
		bedroom_light.shadow_enabled = false
		bedroom_light.add_to_group("quality_extra_light")
		root.add_child(bedroom_light)
	var living_fill = OmniLight3D.new()
	living_fill.position = Vector3(-7.0, 2.28, 5.30)
	living_fill.light_color = Color("ffd9ba")
	living_fill.light_energy = 0.46
	living_fill.omni_range = 4.55
	living_fill.shadow_enabled = false
	living_fill.add_to_group("quality_extra_light")
	root.add_child(living_fill)
	# One soft key per showcase room; GraphicsManager disables shadow cost on LOW.
	for data in [
		{"p": Vector3(-5.1, 2.55, 6.35), "e": 0.42, "r": 4.1},
		{"p": Vector3(6.25, 2.55, 4.85), "e": 0.38, "r": 3.8},
	]:
		var key = OmniLight3D.new()
		key.position = data["p"]
		key.light_color = Color("ffe3c4")
		key.light_energy = float(data["e"])
		key.omni_range = float(data["r"])
		key.shadow_enabled = true
		key.shadow_opacity = 0.48
		key.add_to_group("quality_extra_light")
		key.add_to_group("quality_shadow")
		root.add_child(key)''')

    helper_anchor = "func _mirror(pos: Vector3, size: Vector2) -> void:\n"
    helpers = r'''func _soft_ellipsoid(pos: Vector3, scale_value: Vector3, material: Material, rot_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	return _soft_ellipsoid_on(root, pos, scale_value, material, rot_deg)

func _soft_ellipsoid_on(parent: Node3D, pos: Vector3, scale_value: Vector3, material: Material, rot_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var mesh = SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	mesh.radial_segments = 28
	mesh.rings = 14
	mi.mesh = mesh
	mi.position = pos
	mi.rotation_degrees = rot_deg
	mi.scale = scale_value * 2.0
	mi.material_override = material
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(mi)
	return mi

func _bar_stool(pos: Vector3) -> void:
	var seat = _pbr_material("fabric", Color("5b5550"), 0.98, 0.0, 2.4, 0.20)
	_soft_ellipsoid(pos + Vector3(0.0, 0.69, 0.0), Vector3(0.28, 0.085, 0.28), seat)
	_cylinder(pos + Vector3(0.0, 0.34, 0.0), 0.022, 0.62, metal_dark)
	_cylinder(pos + Vector3(0.0, 0.16, 0.0), 0.18, 0.018, metal_dark)
	_cylinder(pos + Vector3(0.0, 0.39, 0.15), 0.010, 0.32, metal_dark, Vector3(90.0, 0.0, 0.0))

'''
    text = path.read_text(encoding="utf-8")
    if "func _soft_ellipsoid(" not in text:
        if text.count(helper_anchor) != 1:
            raise SystemExit("VISUAL50 helper anchor missing")
        text = text.replace(helper_anchor, helpers + helper_anchor, 1)
        path.write_text(text, encoding="utf-8")
        print("VISUAL50 APPLIED: home soft-furniture helpers")


def patch_player() -> None:
    path = ROOT / "scripts/player_controller.gd"
    replace_once(
        path,
        "var invert_look_y = false\n",
        "var invert_look_y = false\nvar camera_bob_time = 0.0\nvar camera_bob_offset = Vector2.ZERO\nvar camera_land_kick = 0.0\n",
        "player cinematic camera state",
    )
    replace_once(
        path,
        "\tmove_and_slide()\n\t_update_character_visual(delta, running)\n",
        "\tmove_and_slide()\n\t_update_camera_motion(delta, running)\n\t_update_character_visual(delta, running)\n",
        "player update cinematic camera motion",
    )
    anchor = "func _update_character_visual(delta: float, running: bool) -> void:\n"
    helper = r'''func _update_camera_motion(delta: float, running: bool) -> void:
	if camera == null:
		return
	var speed = Vector2(velocity.x, velocity.z).length()
	var reduced_motion = false
	var extras = get_tree().get_first_node_in_group("cinematic_menu_extras")
	if extras != null and extras.has_method("is_reduced_motion"):
		reduced_motion = bool(extras.call("is_reduced_motion"))
	if is_on_floor() and not previous_grounded:
		camera_land_kick = -0.026 if running else -0.018
	camera_land_kick = lerp(camera_land_kick, 0.0, clamp(delta * 8.5, 0.0, 1.0))
	if first_person:
		var moving = is_on_floor() and speed > 0.45 and not activity_locked
		var target_fov = 76.0 if running and speed > 4.8 else 72.0
		if crouched:
			target_fov -= 1.5
		camera.fov = lerp(camera.fov, target_fov, clamp(delta * 5.5, 0.0, 1.0))
		var target_bob = Vector2.ZERO
		if moving and not reduced_motion:
			camera_bob_time += delta * (11.2 if running else 8.2)
			var amp = 0.017 if running else 0.010
			target_bob.x = sin(camera_bob_time) * amp
			target_bob.y = abs(cos(camera_bob_time * 2.0)) * amp * 0.72
		camera_bob_offset = camera_bob_offset.lerp(target_bob, clamp(delta * 9.0, 0.0, 1.0))
		camera.position = Vector3(camera_bob_offset.x, camera_bob_offset.y + camera_land_kick, 0.0)
	else:
		camera_bob_offset = camera_bob_offset.lerp(Vector2.ZERO, clamp(delta * 8.0, 0.0, 1.0))
		camera.position = camera.position.lerp(Vector3(0.48, 0.08 + camera_land_kick * 0.25, 0.0), clamp(delta * 8.0, 0.0, 1.0))
		camera.fov = lerp(camera.fov, 60.0 if not running else 62.0, clamp(delta * 5.0, 0.0, 1.0))

'''
    text = path.read_text(encoding="utf-8")
    if "func _update_camera_motion(" not in text:
        if text.count(anchor) != 1:
            raise SystemExit("VISUAL50 player camera helper anchor missing")
        path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
        print("VISUAL50 APPLIED: player camera motion helper")


def patch_mobile() -> None:
    path = ROOT / "scripts/mobile_controls.gd"
    replace_function(path, "_make_top_button(text: String, x_from_right: float) -> Button:", r'''func _make_top_button(text: String, x_from_right: float) -> Button:
	var button = Button.new()
	button.text = text
	button.anchor_left = 1.0
	button.anchor_right = 1.0
	button.offset_left = x_from_right
	button.offset_right = x_from_right + 52.0
	button.offset_top = 14.0
	button.offset_bottom = 43.0
	button.add_theme_font_size_override("font_size", 9)
	button.focus_mode = Control.FOCUS_NONE
	_apply_top_button_style(button)
	return button''')

    replace_function(path, "_apply_action_button_style(button: Button) -> void:", r'''func _apply_action_button_style(button: Button) -> void:
	var normal = StyleBoxFlat.new()
	normal.bg_color = Color(0.018, 0.022, 0.028, 0.48)
	normal.border_color = Color(0.88, 0.82, 0.72, 0.20)
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(32)
	button.add_theme_stylebox_override("normal", normal)
	var pressed = normal.duplicate()
	pressed.bg_color = Color(0.20, 0.17, 0.13, 0.88)
	pressed.border_color = Color(0.88, 0.78, 0.62, 0.55)
	button.add_theme_stylebox_override("pressed", pressed)
	button.add_theme_stylebox_override("hover", pressed)
	button.add_theme_color_override("font_color", Color(0.96, 0.94, 0.90, 0.94))
	button.add_theme_color_override("font_pressed_color", Color.WHITE)''')

    replace_function(path, "_apply_top_button_style(button: Button) -> void:", r'''func _apply_top_button_style(button: Button) -> void:
	var normal = StyleBoxFlat.new()
	normal.bg_color = Color(0.018, 0.022, 0.028, 0.54)
	normal.border_color = Color(1.0, 1.0, 1.0, 0.10)
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(8)
	button.add_theme_stylebox_override("normal", normal)
	var active = normal.duplicate()
	active.bg_color = Color(0.19, 0.16, 0.12, 0.90)
	active.border_color = Color(0.86, 0.76, 0.60, 0.48)
	button.add_theme_stylebox_override("pressed", active)
	button.add_theme_stylebox_override("hover", active)
	button.add_theme_color_override("font_color", Color(0.95, 0.94, 0.91, 0.90))''')


def patch_base_lighting() -> None:
    path = ROOT / "scripts/main.gd"
    for old, new, label in [
        ('env.background_color = Color("7898b6")', 'env.background_color = Color("70879b")', "deepen exterior sky tone"),
        ('env.ambient_light_color = Color("c5d1dc")', 'env.ambient_light_color = Color("d0d5d9")', "neutralize ambient fill"),
        ('env.ambient_light_energy = 0.34', 'env.ambient_light_energy = 0.42', "raise indirect readability"),
        ('sun.light_energy = 1.08', 'sun.light_energy = 0.96', "reduce hard direct clipping"),
        ('sun.directional_shadow_max_distance = 55.0', 'sun.directional_shadow_max_distance = 70.0', "extend production shadow range"),
    ]:
        replace_once(path, old, new, label)


def normalize_runtime_compat() -> None:
    for relative in [
        "scripts/world/production_home_builder.gd",
        "scripts/player_controller.gd",
        "scripts/mobile_controls.gd",
        "scripts/main.gd",
    ]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    if not (ROOT / "project.godot").is_file():
        raise SystemExit("VISUAL50: game/project.godot missing")
    patch_home()
    patch_player()
    patch_mobile()
    patch_base_lighting()
    normalize_runtime_compat()
    print("CUMA WORLD VISUAL OVERHAUL 5.0 PATCH: PASS")


if __name__ == "__main__":
    main()
