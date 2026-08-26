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
        raise SystemExit(f"CITY52 function not found: {path.name}:{name}")
    end = text.find("\nfunc ", start + len(start_token))
    if end < 0:
        end = len(text)
    current = text[start:end].rstrip()
    normalized = replacement.strip()
    if current == normalized:
        print(f"CITY52 ALREADY APPLIED: {path.name}:{name}")
        return
    path.write_text(text[:start] + normalized + "\n" + text[end:], encoding="utf-8")
    print(f"CITY52 APPLIED: {path.name}:{name}")


def insert_helper(path: Path) -> None:
    anchor = "func _desk(c:Vector3)->void:\n"
    text = path.read_text(encoding="utf-8")
    if "func _street_lamp(" in text:
        return
    helper = r'''func _street_lamp(pos: Vector3) -> void:
	_cylinder(pos + Vector3(0.0, 1.65, 0.0), 0.055, 3.30, Color("30353a"))
	_cylinder(pos + Vector3(0.0, 3.18, 0.0), 0.20, 0.075, Color("30353a"))
	var bulb = MeshInstance3D.new()
	var sm = SphereMesh.new()
	sm.radius = 0.11
	sm.height = 0.22
	sm.radial_segments = 18
	sm.rings = 9
	bulb.mesh = sm
	bulb.position = pos + Vector3(0.0, 3.12, 0.0)
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color("ffe0ac")
	mat.emission_enabled = true
	mat.emission = Color("ffd296")
	mat.emission_energy_multiplier = 0.72
	bulb.material_override = mat
	root.add_child(bulb)

func _planter(pos: Vector3, scale_value: float = 1.0) -> void:
	_box(Vector3(0.82, 0.38, 0.82) * scale_value, pos + Vector3(0.0, 0.19 * scale_value, 0.0), Color("6b5b4d"), false)
	for i in range(5):
		var angle = float(i) * TAU / 5.0
		var leaf = MeshInstance3D.new()
		var sm = SphereMesh.new()
		sm.radius = 0.32 * scale_value
		sm.height = 0.68 * scale_value
		sm.radial_segments = 14
		sm.rings = 7
		leaf.mesh = sm
		leaf.position = pos + Vector3(cos(angle) * 0.18, 0.68 + float(i % 2) * 0.16, sin(angle) * 0.18) * scale_value
		leaf.scale = Vector3(0.72, 1.0, 0.58)
		var mat = StandardMaterial3D.new()
		mat.albedo_color = Color("496b4d")
		mat.roughness = 0.98
		leaf.material_override = mat
		root.add_child(leaf)

'''
    if text.count(anchor) != 1:
        raise SystemExit("CITY52 helper anchor missing")
    path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
    print("CITY52 APPLIED: city detail helpers")


def patch_city() -> None:
    path = ROOT / "scripts/city/dynamic_city_builder.gd"

    replace_function(path, "_build_city_center() -> void:", r'''func _build_city_center() -> void:
	# City 5.2: layered asphalt/sidewalk/plaza surfaces with readable traffic edges.
	_box(Vector3(78,0.12,66), Vector3(169,0.02,102), Color("737774"), true)
	_box(Vector3(12,0.08,66), Vector3(169,0.09,102), Color("282d32"), true)
	_box(Vector3(78,0.08,10), Vector3(169,0.10,102), Color("282d32"), true)
	# Curbs make the road/plaza transition visible at walking height.
	for x in [162.7, 175.3]:
		_box(Vector3(0.18,0.16,65.0), Vector3(x,0.15,102), Color("b8b5ad"), false)
	for z in [96.7, 107.3]:
		_box(Vector3(77.0,0.16,0.18), Vector3(169,0.15,z), Color("b8b5ad"), false)
	# Plaza paving bands and inset center strip.
	for x in range(143,197,4):
		_box(Vector3(2.8,0.035,18), Vector3(float(x),0.13,126), Color("aaa69d") if x % 8 == 0 else Color("918f87"), false)
	_box(Vector3(30.0,0.025,1.2), Vector3(169,0.165,126), Color("77736c"), false)
	# Crosswalks at the plaza approach.
	for i in range(7):
		_box(Vector3(0.72,0.018,4.6), Vector3(164.2 + float(i) * 1.55,0.145,111.0), Color("dedbd3"), false)
	for p in [Vector3(147,0,123),Vector3(158,0,129),Vector3(181,0,123),Vector3(192,0,129)]:
		_tree(p)
	for p in [Vector3(153,0,126),Vector3(187,0,126)]:
		_bench(p)
	for p in [Vector3(145,0,117),Vector3(158,0,117),Vector3(180,0,117),Vector3(193,0,117),Vector3(145,0,134),Vector3(193,0,134)]:
		_street_lamp(p)
	for p in [Vector3(151,0,132),Vector3(169,0,132),Vector3(187,0,132)]:
		_planter(p, 0.82)
	var sign = Label3D.new()
	sign.text = "CUMA CITY CENTER • 5.2"
	sign.position = Vector3(169,4.4,134)
	sign.font_size = 38
	sign.outline_size = 8
	root.add_child(sign)''')

    replace_function(path, "_open_building(title: String, c: Vector3, accent: Color, kind: String) -> void:", r'''func _open_building(title: String, c: Vector3, accent: Color, kind: String) -> void:
	# Open south front remains fully walkable, now framed as a finished storefront.
	_box(Vector3(14,0.12,12), c + Vector3(0,0.06,0), Color("b6a88e"), true)
	_box(Vector3(14,4.2,0.18), c + Vector3(0,2.1,5.9), Color("d7d5cf"), true)
	_box(Vector3(0.18,4.2,12), c + Vector3(-6.9,2.1,0), Color("d7d5cf"), true)
	_box(Vector3(0.18,4.2,12), c + Vector3(6.9,2.1,0), Color("d7d5cf"), true)
	_box(Vector3(4.6,4.2,0.18), c + Vector3(-4.65,2.1,-5.9), accent, true)
	_box(Vector3(4.6,4.2,0.18), c + Vector3(4.65,2.1,-5.9), accent, true)
	_glass(c + Vector3(-4.6,2.15,-6.01), Vector3(3.8,2.65,0.05))
	_glass(c + Vector3(4.6,2.15,-6.01), Vector3(3.8,2.65,0.05))
	# Dark plinth, canopy and trim give every facade depth without extra collision.
	_box(Vector3(13.6,0.18,0.22), c + Vector3(0,0.15,-6.04), Color("353a3f"), false)
	_box(Vector3(5.2,0.12,1.05), c + Vector3(0,3.15,-6.35), Color("3b4146"), false)
	_box(Vector3(5.0,0.12,0.10), c + Vector3(0,2.75,-6.04), accent.lightened(0.10), false)
	for x in [-2.25, 2.25]:
		_box(Vector3(0.10,2.75,0.12), c + Vector3(x,1.42,-6.05), Color("42474c"), false)
	var sign = Label3D.new()
	sign.text = title
	sign.position = c + Vector3(0,3.55,-6.08)
	sign.font_size = 26
	sign.outline_size = 6
	root.add_child(sign)
	match kind:
		"office":
			for x in [-4.2,0.0,4.2]: _desk(c + Vector3(x,0,-0.2))
		"creative":
			for x in [-4.0,0.0,4.0]: _desk(c + Vector3(x,0,-0.6))
			for x in [-3.0,3.0]: _easel(c + Vector3(x,0,2.5))
		"fitness":
			for x in [-4.0, 0.0, 4.0]:
				_gym_station(c + Vector3(x, 0, 0.5))
				_activity_station(c + Vector3(x, 0.9, -0.6), "Antrenman yap")
		"salon":
			for x in [-3.7,0.0,3.7]: _salon_chair(c + Vector3(x,0,0.5))
		"service":
			_box(Vector3(9.5,0.95,0.65), c + Vector3(0,0.48,1.9), Color("7b674f"), false)
			for x in [-3.5,0.0,3.5]: _desk(c + Vector3(x,0,-1.2))''')

    replace_function(path, "_bus_stop(pos:Vector3,title:String)->void:", r'''func _bus_stop(pos:Vector3,title:String)->void:
	# Covered stop with glass side, roof, bench and readable pole marker.
	_cylinder(pos + Vector3(-0.82,1.1,0), 0.04, 2.2, Color("303840"))
	_box(Vector3(2.30,0.10,0.95), pos + Vector3(0.10,2.12,0), Color("353b40"), false)
	_glass(pos + Vector3(1.10,1.08,0), Vector3(0.06,1.90,0.88))
	_box(Vector3(1.35,0.10,0.42), pos + Vector3(0.05,0.58,0.04), Color("735b46"), false)
	for x in [-0.48,0.48]:
		_box(Vector3(0.06,0.52,0.06), pos + Vector3(x,0.30,0.04), Color("353b40"), false)
	var l=Label3D.new()
	l.text="DURAK • "+title
	l.position=pos+Vector3(-0.82,2.35,0)
	l.font_size=18
	l.outline_size=5
	l.billboard=BaseMaterial3D.BILLBOARD_ENABLED
	root.add_child(l)''')

    replace_function(path, "_tree(pos:Vector3)->void:", r'''func _tree(pos:Vector3)->void:
	_cylinder(pos+Vector3(0,1.25,0),0.15,2.5,Color("654a36"))
	for data in [
		{"o": Vector3(0.0,2.85,0.0), "s": Vector3(1.00,0.82,1.00)},
		{"o": Vector3(-0.52,2.65,0.16), "s": Vector3(0.68,0.62,0.68)},
		{"o": Vector3(0.50,2.72,-0.12), "s": Vector3(0.70,0.66,0.70)},
	]:
		var crown=MeshInstance3D.new()
		var sm=SphereMesh.new()
		sm.radius=1.0
		sm.height=1.7
		sm.radial_segments=16
		sm.rings=8
		crown.mesh=sm
		crown.position=pos+data["o"]
		crown.scale=data["s"]
		var mat=StandardMaterial3D.new()
		mat.albedo_color=Color("4e704f") if crown.position.x <= pos.x else Color("587b56")
		mat.roughness=.98
		crown.material_override=mat
		root.add_child(crown)''')

    replace_function(path, "_bench(pos:Vector3)->void:", r'''func _bench(pos:Vector3)->void:
	var wood = Color("765a43")
	for z in [-0.18,0.0,0.18]:
		_box(Vector3(2.0,0.075,0.14),pos+Vector3(0,0.50,z),wood,false)
	for y in [0.73,0.92,1.11]:
		_box(Vector3(2.0,0.12,0.07),pos+Vector3(0,y,0.30),wood,false)
	for x in [-0.78,0.78]:
		_box(Vector3(0.07,0.72,0.07),pos+Vector3(x,0.42,0.22),Color("33383d"),false)''')

    insert_helper(path)

    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    if not (ROOT / "project.godot").is_file():
        raise SystemExit("CITY52: game/project.godot missing")
    patch_city()
    print("CUMA CITY VISUAL 5.2 PATCH: PASS")


if __name__ == "__main__":
    main()
