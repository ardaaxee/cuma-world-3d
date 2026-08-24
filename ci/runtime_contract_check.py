#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1] / "game"


def fail(message: str) -> None:
    raise SystemExit(f"RUNTIME CONTRACT CHECK: FAIL: {message}")


def function_body(text: str, name: str) -> str:
    marker = f"func {name}"
    if marker not in text:
        fail(f"missing function {name}")
    return text.split(marker, 1)[1].split("\nfunc ", 1)[0]


def main() -> None:
    if not ROOT.is_dir():
        fail(f"missing extracted game directory: {ROOT}")

    # Android build and Visual Audit share the exact same deterministic patch stack.
    layers = [
        Path(__file__).with_name("apply_runtime_round2.py"),
        Path(__file__).with_name("apply_visual_polish.py"),
        Path(__file__).with_name("apply_visual_finish.py"),
        Path(__file__).with_name("apply_visual_round3.py"),
        Path(__file__).with_name("apply_visual_round4.py"),
    ]
    for layer in layers:
        if not layer.is_file():
            fail(f"missing {layer.relative_to(Path(__file__).resolve().parents[1])}")
        subprocess.run([sys.executable, str(layer)], check=True)

    dynamic = (ROOT / "scripts/city/dynamic_city_builder.gd").read_text(encoding="utf-8")
    crime = (ROOT / "scripts/city/crime_justice_builder.gd").read_text(encoding="utf-8")
    transport = (ROOT / "scripts/city/public_transport_vehicle.gd").read_text(encoding="utf-8")
    patrol = (ROOT / "scripts/crime/patrol_vehicle.gd").read_text(encoding="utf-8")
    relationship = (ROOT / "scripts/social/relationship_citizen.gd").read_text(encoding="utf-8")
    main_script = (ROOT / "scripts/main.gd").read_text(encoding="utf-8")
    ultra_home = (ROOT / "scripts/world/ultra_home_builder.gd").read_text(encoding="utf-8")
    production_home = (ROOT / "scripts/world/production_home_builder.gd").read_text(encoding="utf-8")

    if 'var bus = AnimatableBody3D.new(); bus.name = "CityBus18"' not in dynamic:
        fail("CityBus18 must be instantiated as AnimatableBody3D")
    if 'var taxi = AnimatableBody3D.new(); taxi.name = "CityTaxi18"' not in dynamic:
        fail("CityTaxi18 must be instantiated as AnimatableBody3D")
    if 'var patrol_route: Array[Vector3]' not in crime or 'patrol.setup(patrol_route)' not in crime:
        fail("police patrol route must remain Array[Vector3]")
    if re.search(r"\bpatrol\.setup\(\s*\[", crime):
        fail("do not pass an untyped array literal directly to patrol_vehicle.setup")

    for label, source in [("public transport", transport), ("police patrol", patrol)]:
        if "sync_to_physics = false" not in source:
            fail(f"{label} must disable AnimatableBody3D sync_to_physics")
        if "func _physics_process(delta: float) -> void:" not in source:
            fail(f"{label} movement must run in _physics_process")
        if "set_physics_process(enabled)" not in source:
            fail(f"{label} quality toggle must control physics processing")
        if "func _process(delta: float) -> void:" in source:
            fail(f"{label} still contains idle-frame movement")

    if 'active_route = [entry, ai_target] if' in relationship:
        fail("relationship NPC AI still assigns an untyped conditional Array to Array[Vector3]")
    if 'active_route.clear()' not in relationship or 'active_route.append(ai_target)' not in relationship:
        fail("relationship NPC typed-route runtime fix is missing")

    try:
        ready_body = main_script.split("func _ready() -> void:\n", 1)[1].split("\nfunc ", 1)[0]
    except IndexError:
        fail("could not isolate main.gd _ready()")

    if ready_body.count("await get_tree().process_frame") < 4:
        fail("main.gd startup builders must be distributed across at least 4 frame boundaries")

    required_ready_calls = [
        "_build_lighting()", "_build_world_ground()", "_build_house_shell()",
        "_build_room_layout()", "_build_furniture()", "_build_balcony()",
        "_build_windows_and_city()", "_build_street_v03()", "_build_interactions_v03()",
        "_build_together_spaces()", "_build_realism_overhaul()", "_build_ultra_home_07()",
        "_build_production_home_21()", "_build_living_city_08()",
        "_build_production_city_polish_21()", "_build_online_life_09()",
        "_build_full_life_10()", "_build_online_relay_11()", "_build_physical_ai_14()",
        "_build_human_behavior_15()", "_build_social_life_12()",
        "_build_npc_intelligence_13()", "_build_daily_life_16()",
        "_build_city_society_17()", "_build_dynamic_city_18()",
        "_build_crime_justice_19()", "_build_runtime_systems()", "_build_weather_09()",
        "_spawn_player()", "_connect_network()", "_spawn_mobile_controls()",
    ]
    missing = [call for call in required_ready_calls if call not in ready_body]
    if missing:
        fail("staged startup lost required calls: " + ", ".join(missing))

    ultra_setup = function_body(ultra_home, "setup(world_root: Node3D) -> void:")
    forbidden_ultra_static_calls = [
        "_build_entry()", "_build_living_room_layer()", "_build_bathroom_layer()",
        "_build_bedroom_layer()", "_build_balcony_layer()", "_build_ceiling_and_lighting()",
    ]
    duplicate_calls = [call for call in forbidden_ultra_static_calls if call in ultra_setup]
    if duplicate_calls:
        fail("UltraHome07 still builds superseded static room layers: " + ", ".join(duplicate_calls))
    for required in ["_build_kitchen_layer()", "_build_curtains()", "_build_micro_details()"]:
        if required not in ultra_setup:
            fail(f"UltraHome07 lost required interaction/detail layer: {required}")

    production_setup = function_body(production_home, "setup(world_root: Node3D) -> void:")
    if "_hide_superseded_home_overlays()" not in production_setup:
        fail("ProductionHome21 must hide superseded RealismOverhaul home meshes")
    if "func _is_production_home_zone(pos: Vector3) -> bool:" not in production_home:
        fail("ProductionHome21 missing replacement-zone ownership helper")

    # Visual-polish contracts discovered from actual CI-rendered screenshots.
    if 'Vector3(-0.75, 0.24, 6.85)' not in main_script:
        fail("legacy hall bench collider must align with production entry bench")
    if 'board.position = Vector3(-1.62, 1.42, 3.85)' not in main_script or 'board.rotation_degrees.y = 90.0' not in main_script:
        fail("TogetherBoard must remain wall-mounted")
    if 'decor.position = Vector3(1.62, 1.28, 2.10)' not in main_script:
        fail("DecorStation must remain wall-mounted")
    if 'Bedroom-local fill lights fix the dusk audit' not in production_home:
        fail("production bedroom local fill lights are missing")
    if 'Layered bedding reads as a duvet' not in production_home:
        fail("layered production bedding correction is missing")
    if 'Production sofa uses restrained upholstered slabs' not in production_home:
        fail("production sofa panel correction is missing")
    if 'Living-room fill preserves fabric/wood separation' not in production_home:
        fail("living-room dusk fill light is missing")
    if 'Color("4b5057")' not in production_home:
        fail("dark upholstery floor correction is missing")

    # Round 4: final proportions after Visual Audit #8.
    if 'tv.setup(Vector3(2.72, 1.42, 0.10))' not in main_script:
        fail("round4 TV scale correction is missing")
    if 'fixture.material_override = _emissive(Color("ffe2bd"), 0.58)' not in production_home:
        fail("round4 corridor fixture correction is missing")
    if 'mesh.top_radius = 0.075' not in production_home:
        fail("round4 corridor fixture size correction is missing")
    if 'Vector3(2.34, 0.17, 3.12)' not in production_home:
        fail("round4 bedroom frame scaling is missing")
    if 'bedroom_light.light_energy = 0.66' not in production_home:
        fail("bedroom fill correction is missing")
    if 'Vector3(0.48, 0.38, 0.14)' not in production_home:
        fail("round4 compact sofa pillows are missing")
    if 'living_fill.light_energy = 0.56' not in production_home:
        fail("round4 living fill correction is missing")
    if 'Vector3(1.92,0.075,0.72)' not in ultra_home:
        fail("round4 kitchen island clearance correction is missing")
    if 'Vector3(1.62,0.54,0.50)' not in ultra_home:
        fail("round4 kitchen island carcass correction is missing")
    if '_cylinder(root,pos,0.16,0.20' not in ultra_home:
        fail("round4 pendant scale correction is missing")
    if 'Vector3(width * 0.46, height, 0.035)' not in ultra_home:
        fail("curtain cloth panel correction is missing")
    if 'for i in range(11):' in function_body(ultra_home, "_make_interactive_curtain"):
        fail("old bar-like curtain fold loop survived")

    # Best-effort native-node/script mismatch scan.
    bases: dict[str, str] = {}
    for script in ROOT.rglob("*.gd"):
        lines = script.read_text(encoding="utf-8").splitlines()
        if not lines:
            continue
        match = re.match(r"\s*extends\s+([A-Za-z0-9_]+)", lines[0])
        if match:
            bases[script.relative_to(ROOT).as_posix()] = match.group(1)

    problems: list[str] = []
    for script in ROOT.rglob("*.gd"):
        text = script.read_text(encoding="utf-8")
        preloads = {
            m.group(1): m.group(2)
            for m in re.finditer(r'const\s+(\w+)\s*=\s*preload\("res://([^\"]+\.gd)"\)', text)
        }
        for match in re.finditer(
            r"var\s+(\w+)\s*=\s*(\w+)\.new\(\)([^\n]*?)\1\.set_script\((\w+)\)",
            text,
        ):
            _var_name, created_type, _middle, preload_name = match.groups()
            target = preloads.get(preload_name)
            if not target:
                continue
            expected = bases.get(target)
            if expected and expected != created_type:
                line = text.count("\n", 0, match.start()) + 1
                problems.append(
                    f"{script.relative_to(ROOT)}:{line}: {created_type} + {target} (expects {expected})"
                )

    if problems:
        fail("native script mismatches:\n" + "\n".join(problems))

    print("RUNTIME CONTRACT CHECK: PASS")


if __name__ == "__main__":
    main()
