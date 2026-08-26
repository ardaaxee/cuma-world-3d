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
        raise SystemExit(f"VISUAL51: function not found: {path.name}:{name}")
    end = text.find("\nfunc ", start + len(start_token))
    if end < 0:
        end = len(text)
    text = text[:start] + replacement.strip() + "\n" + text[end:]
    path.write_text(text, encoding="utf-8")
    print(f"VISUAL51 APPLIED: {path.name}:{name}")


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"VISUAL51 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"VISUAL51 {label}: expected 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"VISUAL51 APPLIED: {label}")


def patch_home() -> None:
    path = ROOT / "scripts/world/production_home_builder.gd"

    replace_function(path, "_build_living_room() -> void:", r'''func _build_living_room() -> void:
	# Visual 5.1: structured modular sofa. Low cushions with visible seams read as
	# furniture at gameplay distance instead of inflated spheres.
	var sofa_root = Node3D.new()
	sofa_root.name = "VisualOverhaul51Sofa"
	sofa_root.position = Vector3(-7.0, 0.0, 5.78)
	root.add_child(sofa_root)
	var cushion = _pbr_material("fabric", Color("656a70"), 0.98, 0.0, 2.55, 0.24)
	var cushion_dark = _pbr_material("fabric", Color("454a50"), 0.99, 0.0, 2.55, 0.22)
	var accent = _pbr_material("fabric", Color("a58c78"), 0.99, 0.0, 2.7, 0.18)
	_panel_on(sofa_root, Vector3(4.18, 0.16, 1.24), Vector3(0.0, 0.20, 0.0), cushion_dark)
	for x in [-1.28, 0.0, 1.28]:
		_panel_on(sofa_root, Vector3(1.18, 0.18, 0.96), Vector3(x, 0.42, -0.12), cushion)
		_panel_on(sofa_root, Vector3(1.18, 0.57, 0.18), Vector3(x, 0.84, 0.48), cushion, Vector3(-5.5, 0.0, 0.0))
	# Lower arms keep the room open and preserve a realistic lounge silhouette.
	_panel_on(sofa_root, Vector3(0.18, 0.48, 1.18), Vector3(-2.02, 0.49, 0.0), cushion_dark)
	_panel_on(sofa_root, Vector3(0.18, 0.48, 1.18), Vector3(2.02, 0.49, 0.0), cushion_dark)
	_soft_ellipsoid_on(sofa_root, Vector3(-0.91, 0.69, -0.48), Vector3(0.24, 0.18, 0.075), accent, Vector3(-5.0, 8.0, 0.0))
	_soft_ellipsoid_on(sofa_root, Vector3(0.91, 0.69, -0.48), Vector3(0.24, 0.18, 0.075), fabric_light, Vector3(-5.0, -8.0, 0.0))
	for x in [-1.75, 1.75]:
		for z in [-0.38, 0.38]:
			_panel_on(sofa_root, Vector3(0.075, 0.13, 0.075), Vector3(x, 0.065, z), metal_dark)

	# Coffee table: thin stone top on a recessed black frame.
	_panel(Vector3(2.02, 0.055, 0.98), Vector3(-7.0, 0.60, 4.10), stone)
	_panel(Vector3(1.82, 0.032, 0.032), Vector3(-7.0, 0.45, 3.65), metal_dark)
	_panel(Vector3(1.82, 0.032, 0.032), Vector3(-7.0, 0.45, 4.55), metal_dark)
	for x in [-0.83, 0.83]:
		for z in [-0.37, 0.37]:
			_cylinder(Vector3(-7.0 + x, 0.30, 4.10 + z), 0.014, 0.52, metal_dark)
	_panel(Vector3(4.70, 0.012, 3.12), Vector3(-7.0, 0.020, 4.90), _pbr_material("fabric", Color("aaa39a"), 0.99, 0.0, 3.0, 0.18))

	# Media wall: apartment-scale screen, timber backing, acoustic detail, console.
	var media_wood = _pbr_material("oak", Color("6a4d3a"), 0.72, 0.0, 3.6, 0.44)
	_panel(Vector3(4.10, 1.90, 0.050), Vector3(-7.0, 1.38, 3.02), media_wood)
	for x in range(13):
		_panel(Vector3(0.046, 1.84, 0.025), Vector3(-8.88 + float(x) * 0.313, 1.38, 2.975), oak)
	_panel(Vector3(3.34, 1.44, 0.024), Vector3(-7.0, 1.48, 2.925), _emissive(Color("d8bf98"), 0.18))
	_panel(Vector3(3.16, 1.30, 0.045), Vector3(-7.0, 1.48, 2.885), _simple_material(Color("090b0d"), 0.10, 0.10))
	_panel(Vector3(3.02, 1.16, 0.012), Vector3(-7.0, 1.48, 2.852), _simple_material(Color("111820"), 0.16, 0.18))
	_panel(Vector3(3.70, 0.13, 0.40), Vector3(-7.0, 0.39, 3.16), stone)
	for x in [-1.20, 0.0, 1.20]:
		_panel(Vector3(1.10, 0.32, 0.34), Vector3(-7.0 + x, 0.22, 3.16), _simple_material(Color("373c41"), 0.74, 0.12))
	_panel(Vector3(1.28, 0.065, 0.065), Vector3(-7.0, 0.60, 3.03), metal_dark)
	_cylinder(Vector3(-9.00, 0.66, 3.28), 0.09, 0.38, metal_dark)
	_cylinder(Vector3(-5.00, 0.66, 3.28), 0.09, 0.38, metal_dark)
	_panel(Vector3(0.34, 0.030, 0.22), Vector3(-7.34, 0.65, 4.00), _simple_material(Color("3f4851"), 0.76, 0.0), Vector3(0.0, 16.0, 0.0))
	_panel(Vector3(0.26, 0.022, 0.11), Vector3(-6.64, 0.65, 4.18), metal_dark, Vector3(0.0, -12.0, 0.0))
	_floor_lamp(Vector3(-9.28, 0.0, 5.58))
	_plant(Vector3(-4.62, 0.0, 3.74), 0.78)''')

    replace_function(path, "_build_bedrooms() -> void:", r'''func _build_bedrooms() -> void:
	var beds: Array[Vector3] = [Vector3(-7.2, 0.0, -6.4), Vector3(-7.0, 0.0, -0.1), Vector3(7.0, 0.0, -6.2), Vector3(7.2, 0.0, -0.2)]
	var accent_colors: Array[Color] = [Color("8b7567"), Color("697884"), Color("80786c"), Color("856f79")]
	for idx in range(beds.size()):
		var p: Vector3 = beds[idx]
		_panel(Vector3(3.45, 0.012, 3.88), p + Vector3(0.0, 0.018, -0.12), _pbr_material("fabric", Color("a9a198"), 0.99, 0.0, 3.0, 0.16))
		_panel(Vector3(2.30, 0.14, 3.02), p + Vector3(0.0, 0.15, 0.0), oak)
		_panel(Vector3(2.18, 0.20, 2.86), p + Vector3(0.0, 0.36, 0.0), fabric_light)
		# Layered duvet with an inset fold replaces the inflated one-piece blanket.
		_panel(Vector3(2.06, 0.13, 2.05), p + Vector3(0.0, 0.55, -0.30), _pbr_material("fabric", Color("d2cbc1"), 0.99, 0.0, 2.45, 0.20))
		_panel(Vector3(2.02, 0.055, 0.42), p + Vector3(0.0, 0.64, -1.08), _simple_material(accent_colors[idx], 0.98, 0.0))
		_panel(Vector3(2.00, 0.055, 0.18), p + Vector3(0.0, 0.64, 0.66), _simple_material(Color("c1b9ae"), 0.98, 0.0))
		_soft_ellipsoid(p + Vector3(-0.54, 0.67, 1.06), Vector3(0.43, 0.105, 0.25), warm_white, Vector3(0.0, 7.0, 0.0))
		_soft_ellipsoid(p + Vector3(0.54, 0.67, 1.06), Vector3(0.43, 0.105, 0.25), warm_white, Vector3(0.0, -7.0, 0.0))
		_panel(Vector3(2.46, 1.02, 0.042), p + Vector3(0.0, 1.25, 1.43), _pbr_material("oak", Color("70523e"), 0.76, 0.0, 3.1, 0.42))
		_panel(Vector3(2.18, 0.72, 0.090), p + Vector3(0.0, 1.22, 1.37), _pbr_material("fabric", Color("686d72"), 0.99, 0.0, 2.5, 0.22))
		for x in [-0.80, -0.40, 0.0, 0.40, 0.80]:
			_panel(Vector3(0.010, 0.66, 0.016), p + Vector3(x, 1.22, 1.315), _simple_material(Color("565c61"), 0.95, 0.0))
		_panel(Vector3(2.16, 0.016, 0.022), p + Vector3(0.0, 1.61, 1.34), _emissive(Color("ffd7b1"), 0.32))
		_bedside_table(p + Vector3(-1.33, 0.0, 0.76), idx)
		_bedside_table(p + Vector3(1.33, 0.0, 0.76), idx + 10)
		# Tailored upholstered bench: box base with a thin soft cushion.
		_panel(Vector3(1.70, 0.28, 0.48), p + Vector3(0.0, 0.27, -1.82), _pbr_material("fabric", accent_colors[idx], 0.99, 0.0, 2.7, 0.18))
		_panel(Vector3(1.76, 0.08, 0.52), p + Vector3(0.0, 0.45, -1.82), _pbr_material("fabric", Color(accent_colors[idx], 0.95), 0.99, 0.0, 2.7, 0.16))
		for x in [-0.66, 0.66]:
			_cylinder(p + Vector3(x, 0.12, -1.82), 0.013, 0.22, metal_dark)
	_wardrobe_visual(Vector3(-10.1, 0.0, -7.9), 2.6)
	_wardrobe_visual(Vector3(10.0, 0.0, -7.8), 2.8)
	_wardrobe_visual(Vector3(10.0, 0.0, 1.65), 3.1)''')

    replace_function(path, "_build_bathroom_details() -> void:", r'''func _build_bathroom_details() -> void:
	_panel(Vector3(9.95, 0.016, 2.60), Vector3(6.85, 0.023, 7.55), tile)
	_panel(Vector3(4.25, 2.25, 0.025), Vector3(8.55, 1.45, 8.86), tile)
	# Rectilinear built-in tub with inset water well reads correctly from doorway.
	_panel(Vector3(2.25, 0.52, 1.05), Vector3(8.65, 0.31, 7.78), warm_white)
	_panel(Vector3(1.88, 0.055, 0.72), Vector3(8.65, 0.58, 7.78), _simple_material(Color("6f8790"), 0.18, 0.0))
	_panel(Vector3(1.34, 0.66, 0.54), Vector3(4.30, 0.38, 7.16), oak)
	_panel(Vector3(1.42, 0.08, 0.62), Vector3(4.30, 0.76, 7.16), stone)
	_panel(Vector3(0.028, 1.88, 1.72), Vector3(7.02, 1.08, 7.74), glass_mat)
	_mirror(Vector3(4.30, 1.60, 7.48), Vector2(1.30, 1.12))
	_panel(Vector3(1.42, 0.016, 0.026), Vector3(4.30, 2.20, 7.445), _emissive(Color("ffdfba"), 0.40))
	_cylinder(Vector3(5.25, 1.05, 8.72), 0.014, 0.68, metal_dark, Vector3(0.0, 0.0, 90.0))
	_panel(Vector3(0.54, 0.62, 0.035), Vector3(5.25, 0.78, 8.69), _pbr_material("fabric", Color("c7beb1"), 0.99, 0.0, 2.4, 0.20))
	_cylinder(Vector3(9.65, 1.18, 8.72), 0.015, 0.78, metal_dark)
	_cylinder(Vector3(9.65, 1.55, 8.50), 0.015, 0.44, metal_dark, Vector3(90.0, 0.0, 0.0))
	var bath_fill = OmniLight3D.new()
	bath_fill.position = Vector3(6.9, 2.28, 7.65)
	bath_fill.light_color = Color("fff0df")
	bath_fill.light_energy = 0.26
	bath_fill.omni_range = 3.6
	bath_fill.shadow_enabled = false
	bath_fill.add_to_group("quality_extra_light")
	root.add_child(bath_fill)''')

    replace_function(path, "_build_entry_details() -> void:", r'''func _build_entry_details() -> void:
	_panel(Vector3(1.58, 0.10, 0.40), Vector3(0.10, 0.82, 7.88), oak)
	_panel(Vector3(1.46, 0.34, 0.34), Vector3(0.10, 0.60, 7.88), _simple_material(Color("484d51"), 0.80, 0.0))
	_panel(Vector3(1.36, 0.28, 0.58), Vector3(-0.75, 0.30, 6.85), fabric_dark)
	_panel(Vector3(1.42, 0.08, 0.62), Vector3(-0.75, 0.49, 6.85), _pbr_material("fabric", Color("686d70"), 0.98, 0.0, 2.5, 0.20))
	for x in [-1.12, -0.38]:
		_cylinder(Vector3(x, 0.14, 6.85), 0.014, 0.25, metal_dark)
	_mirror(Vector3(1.58, 1.55, 8.75), Vector2(0.72, 1.45))
	_panel(Vector3(1.35, 0.045, 0.045), Vector3(-0.78, 1.88, 8.72), metal_dark)
	for x in [-1.25, -0.93, -0.61, -0.29]:
		_cylinder(Vector3(x, 1.74, 8.68), 0.012, 0.22, metal_dark)
	_panel(Vector3(1.45, 0.065, 0.38), Vector3(-0.78, 0.16, 7.45), oak)
	var entry_fill = OmniLight3D.new()
	entry_fill.position = Vector3(0.0, 2.36, 7.65)
	entry_fill.light_color = Color("ffe4c8")
	entry_fill.light_energy = 0.24
	entry_fill.omni_range = 3.1
	entry_fill.shadow_enabled = false
	entry_fill.add_to_group("quality_extra_light")
	root.add_child(entry_fill)''')

    replace_function(path, "_build_balcony_details() -> void:", r'''func _build_balcony_details() -> void:
	for i in range(20):
		_panel(Vector3(0.46, 0.026, 4.55), Vector3(-10.72 + float(i) * 0.49, 0.025, 11.40), oak)
	for x in range(21):
		_cylinder(Vector3(-10.85 + float(x) * 0.49, 0.63, 13.69), 0.014, 1.02, metal_dark)
	_panel(Vector3(10.0, 0.045, 0.045), Vector3(-6.0, 1.15, 13.69), metal_dark)
	_panel(Vector3(1.88, 0.30, 0.78), Vector3(-8.45, 0.30, 10.15), fabric_dark)
	_panel(Vector3(1.84, 0.60, 0.16), Vector3(-8.45, 0.75, 10.50), fabric_dark, Vector3(-6.0, 0.0, 0.0))
	_panel(Vector3(1.30, 0.06, 0.72), Vector3(-6.25, 0.63, 11.55), stone)
	for x in [-6.72, -5.78]:
		_cylinder(Vector3(x, 0.32, 11.55), 0.018, 0.58, metal_dark)
	_plant(Vector3(-10.25, 0.0, 12.85), 1.12)
	_plant(Vector3(-2.20, 0.0, 12.85), 0.96)
	for i in range(7):
		var bx = -10.4 + float(i) * 1.45
		_sphere(Vector3(bx, 2.55 + sin(float(i) * 0.7) * 0.12, 13.45), Vector3(0.050, 0.050, 0.050), _emissive(Color("ffd59d"), 0.82))
	var balcony_fill = OmniLight3D.new()
	balcony_fill.position = Vector3(-6.6, 2.22, 11.45)
	balcony_fill.light_color = Color("ffd4a8")
	balcony_fill.light_energy = 0.28
	balcony_fill.omni_range = 4.8
	balcony_fill.shadow_enabled = false
	balcony_fill.add_to_group("quality_extra_light")
	root.add_child(balcony_fill)''')

    replace_once(path, "task.light_energy = 0.30", "task.light_energy = 0.14", "reduce kitchen task-light clipping")
    replace_once(path, "task.omni_range = 2.7", "task.omni_range = 2.2", "tighten kitchen task-light range")


def patch_room_lighting() -> None:
    path = ROOT / "scripts/main.gd"
    changes = [
        ('_add_room_light("HallLight", Vector3(0.0, 2.65, 1.0), 8.0, 1.05)', '_add_room_light("HallLight", Vector3(0.0, 2.65, 1.0), 6.8, 0.78)', "rebalance hall light"),
        ('_add_room_light("LivingLight", Vector3(-6.1, 2.55, 5.7), 7.5, 1.10)', '_add_room_light("LivingLight", Vector3(-6.1, 2.55, 5.7), 6.1, 0.78)', "rebalance living light"),
        ('_add_room_light("KitchenLight", Vector3(6.2, 2.55, 4.4), 7.0, 1.05)', '_add_room_light("KitchenLight", Vector3(6.2, 2.55, 4.4), 5.4, 0.64)', "rebalance kitchen light"),
        ('_add_room_light("BackRoomsLight", Vector3(0.0, 2.55, -5.8), 9.0, 0.92)', '_add_room_light("BackRoomsLight", Vector3(0.0, 2.55, -5.8), 7.2, 0.72)', "rebalance back-room light"),
    ]
    for old, new, label in changes:
        replace_once(path, old, new, label)


def patch_mobile_hud() -> None:
    path = ROOT / "scripts/mobile_controls.gd"
    replace_once(path, "var hud_accum = 0.0\n", "var hud_accum = 0.0\nvar utility_buttons: Array[Button] = []\nvar utility_tray_open = false\n", "add compact utility tray state")
    old = '''\tvar save_button = _make_top_button("SAVE", -304.0)
\tsave_button.pressed.connect(_on_save)
\troot.add_child(save_button)

\tvar quality_button = _make_top_button("FX", -244.0)
\tquality_button.pressed.connect(_on_quality)
\troot.add_child(quality_button)

\tvar together_button = _make_top_button("2P", -184.0)
\ttogether_button.pressed.connect(_on_toggle_together)
\troot.add_child(together_button)

\tvar photo_button = _make_top_button("FOTO", -124.0)
\tphoto_button.pressed.connect(_on_photo)
\troot.add_child(photo_button)

\tvar camera_button = _make_top_button("CAM", -64.0)
\tcamera_button.pressed.connect(_on_camera_mode)
\troot.add_child(camera_button)

\tvar observation_button = _make_top_button("OBS", -364.0)
\tobservation_button.pressed.connect(_on_observation_mode)
\troot.add_child(observation_button)

\tvar menu_button = _make_top_button("MENÜ", -424.0)
\tmenu_button.pressed.connect(_on_pause_menu)
\troot.add_child(menu_button)'''
    new = '''\tvar menu_button = _make_top_button("MENÜ", -244.0)
\tmenu_button.pressed.connect(_on_pause_menu)
\troot.add_child(menu_button)

\tvar save_button = _make_top_button("SAVE", -184.0)
\tsave_button.pressed.connect(_on_save)
\troot.add_child(save_button)

\tvar observation_button = _make_top_button("OBS", -124.0)
\tobservation_button.pressed.connect(_on_observation_mode)
\troot.add_child(observation_button)

\tvar camera_button = _make_top_button("CAM", -64.0)
\tcamera_button.pressed.connect(_on_camera_mode)
\troot.add_child(camera_button)

\tvar utility_button = _make_top_button("EK", -304.0)
\tutility_button.pressed.connect(_on_toggle_utility_tray)
\troot.add_child(utility_button)

\tvar quality_button = _make_top_button("FX", -184.0)
\tquality_button.offset_top = 50.0
\tquality_button.offset_bottom = 79.0
\tquality_button.pressed.connect(_on_quality)
\tquality_button.visible = false
\tutility_buttons.append(quality_button)
\troot.add_child(quality_button)

\tvar together_button = _make_top_button("2P", -124.0)
\ttogether_button.offset_top = 50.0
\ttogether_button.offset_bottom = 79.0
\ttogether_button.pressed.connect(_on_toggle_together)
\ttogether_button.visible = false
\tutility_buttons.append(together_button)
\troot.add_child(together_button)

\tvar photo_button = _make_top_button("FOTO", -64.0)
\tphoto_button.offset_top = 50.0
\tphoto_button.offset_bottom = 79.0
\tphoto_button.pressed.connect(_on_photo)
\tphoto_button.visible = false
\tutility_buttons.append(photo_button)
\troot.add_child(photo_button)'''
    replace_once(path, old, new, "collapse secondary top controls into utility tray")
    anchor = "func _on_pause_menu() -> void:\n"
    helper = '''func _on_toggle_utility_tray() -> void:\n\tutility_tray_open = not utility_tray_open\n\tfor button in utility_buttons:\n\t\tbutton.visible = utility_tray_open\n\n'''
    text = path.read_text(encoding="utf-8")
    if helper not in text:
        if text.count(anchor) != 1:
            raise SystemExit("VISUAL51 mobile utility handler anchor missing")
        path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
        print("VISUAL51 APPLIED: mobile utility tray handler")


def normalize() -> None:
    for rel in ["scripts/world/production_home_builder.gd", "scripts/main.gd", "scripts/mobile_controls.gd"]:
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    patch_home()
    patch_room_lighting()
    patch_mobile_hud()
    normalize()
    print("CUMA WORLD VISUAL POLISH 5.1: PASS")


if __name__ == "__main__":
    main()
