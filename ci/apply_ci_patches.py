#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"PATCH ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"PATCH APPLIED: {label}")


def main() -> None:
    if not ROOT.exists():
        raise SystemExit(f"game directory not found: {ROOT}")

    project = ROOT / "project.godot"
    if not project.is_file():
        raise SystemExit("project.godot not found after extraction")

    mobile = ROOT / "scripts" / "mobile_controls.gd"
    replace_exact(
        mobile,
        "\tvar together_button = _make_top_button(\"2P\", -184.0)\n\t\ttogether_button.pressed.connect(_on_toggle_together)\n\troot.add_child(together_button)",
        "\tvar together_button = _make_top_button(\"2P\", -184.0)\n\ttogether_button.pressed.connect(_on_toggle_together)\n\troot.add_child(together_button)",
        "mobile_controls.gd unexpected indentation",
    )

    presets = ROOT / "export_presets.cfg"
    replace_exact(
        presets,
        'gradle_build/min_sdk="24"\ngradle_build/target_sdk="35"\n',
        '',
        "remove Min/Target SDK overrides when Gradle build is disabled",
    )

    replace_exact(
        project,
        'renderer/rendering_method.mobile="gl_compatibility"\ntextures/default_filters/use_nearest_mipmap_filter=false',
        'renderer/rendering_method.mobile="gl_compatibility"\ntextures/vram_compression/import_etc2_astc=true\ntextures/default_filters/use_nearest_mipmap_filter=false',
        "enable ETC2/ASTC texture import for Android export",
    )

    dynamic_city = ROOT / "scripts" / "city" / "dynamic_city_builder.gd"
    replace_exact(
        dynamic_city,
        'var bus = StaticBody3D.new(); bus.name = "CityBus18"; bus.set_script(PublicTransportVehicle); root.add_child(bus); bus.setup("city_bus_18","ŞEHİR OTOBÜSÜ",bus_route,7.2,Color("486b82"))',
        'var bus = AnimatableBody3D.new(); bus.name = "CityBus18"; bus.set_script(PublicTransportVehicle); root.add_child(bus); bus.setup("city_bus_18","ŞEHİR OTOBÜSÜ",bus_route,7.2,Color("486b82"))',
        "instantiate city bus with the native type required by public_transport_vehicle.gd",
    )
    replace_exact(
        dynamic_city,
        'var taxi = StaticBody3D.new(); taxi.name = "CityTaxi18"; taxi.set_script(PublicTransportVehicle); root.add_child(taxi); taxi.setup("city_taxi_18","TAKSİ",taxi_route,9.0,Color("d4b649"))',
        'var taxi = AnimatableBody3D.new(); taxi.name = "CityTaxi18"; taxi.set_script(PublicTransportVehicle); root.add_child(taxi); taxi.setup("city_taxi_18","TAKSİ",taxi_route,9.0,Color("d4b649"))',
        "instantiate city taxi with the native type required by public_transport_vehicle.gd",
    )

    crime_city = ROOT / "scripts" / "city" / "crime_justice_builder.gd"
    replace_exact(
        crime_city,
        '\tpatrol.setup([Vector3(-58,0.05,62),Vector3(-5,0.05,62),Vector3(-5,0.05,35),Vector3(-58,0.05,35)])',
        '\tvar patrol_route: Array[Vector3] = [Vector3(-58,0.05,62),Vector3(-5,0.05,62),Vector3(-5,0.05,35),Vector3(-58,0.05,35)]\n\tpatrol.setup(patrol_route)',
        "pass a typed Vector3 route to patrol_vehicle.gd",
    )

    main_script = ROOT / "scripts" / "main.gd"
    old_ready = '''func _ready() -> void:
\t_register_input_actions()
\t_build_lighting()
\t_build_world_ground()
\t_build_house_shell()
\t_build_room_layout()
\t_build_furniture()
\t_build_balcony()
\t_build_windows_and_city()
\t_build_street_v03()
\t_build_interactions_v03()
\t_build_together_spaces()
\t_build_realism_overhaul()
\t_build_ultra_home_07()
\t_build_production_home_21()
\t_build_living_city_08()
\t_build_production_city_polish_21()
\t_build_online_life_09()
\t_build_full_life_10()
\t_build_online_relay_11()
\t_build_physical_ai_14()
\t_build_human_behavior_15()
\t_build_social_life_12()
\t_build_npc_intelligence_13()
\t_build_daily_life_16()
\t_build_city_society_17()
\t_build_dynamic_city_18()
\t_build_crime_justice_19()
\t_build_runtime_systems()
\t_build_weather_09()
\tvar net = get_node_or_null("/root/NetworkManager")
\tvar dedicated = net != null and net.has_method("is_dedicated_server") and net.is_dedicated_server()
\tif dedicated:
\t\treturn
\t_spawn_player()
\t_connect_network()
\t_spawn_mobile_controls()
\t_build_phone_09()
\t_build_social_ui_12()
\t_build_cyber_ui_19()
\t_build_law_hud_19()
'''
    new_ready = '''func _ready() -> void:
\tvar boot_started_ms = Time.get_ticks_msec()
\t_register_input_actions()

\t# Stage 1: core playable home shell.
\t_build_lighting()
\t_build_world_ground()
\t_build_house_shell()
\t_build_room_layout()
\t_build_furniture()
\t_build_balcony()
\t_build_windows_and_city()
\tawait get_tree().process_frame

\t# Stage 2: home interactions and production visuals.
\t_build_street_v03()
\t_build_interactions_v03()
\t_build_together_spaces()
\t_build_realism_overhaul()
\t_build_ultra_home_07()
\t_build_production_home_21()
\tawait get_tree().process_frame

\t# Stage 3: city and online-life layers.
\t_build_living_city_08()
\t_build_production_city_polish_21()
\t_build_online_life_09()
\t_build_full_life_10()
\t_build_online_relay_11()
\tawait get_tree().process_frame

\t# Stage 4: navigation, behavior and social AI.
\t_build_physical_ai_14()
\t_build_human_behavior_15()
\t_build_social_life_12()
\t_build_npc_intelligence_13()
\t_build_daily_life_16()
\tawait get_tree().process_frame

\t# Stage 5: society, dynamic city, law and weather.
\t_build_city_society_17()
\t_build_dynamic_city_18()
\t_build_crime_justice_19()
\t_build_runtime_systems()
\t_build_weather_09()
\tawait get_tree().process_frame

\tvar net = get_node_or_null("/root/NetworkManager")
\tvar dedicated = net != null and net.has_method("is_dedicated_server") and net.is_dedicated_server()
\tif dedicated:
\t\tprint("CUMA_BOOT_READY dedicated ms=", Time.get_ticks_msec() - boot_started_ms)
\t\treturn

\t_spawn_player()
\t_connect_network()
\t_spawn_mobile_controls()
\t_build_phone_09()
\t_build_social_ui_12()
\t_build_cyber_ui_19()
\t_build_law_hud_19()
\tprint("CUMA_BOOT_READY client ms=", Time.get_ticks_msec() - boot_started_ms)
'''
    replace_exact(
        main_script,
        old_ready,
        new_ready,
        "stage heavy world initialization across multiple frames",
    )

    checker = Path(__file__).with_name("runtime_contract_check.py")
    subprocess.run([sys.executable, str(checker)], check=True)
    print("CI patch layer complete.")


if __name__ == "__main__":
    main()
