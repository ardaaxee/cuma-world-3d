#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

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

    print("CI patch layer complete.")


if __name__ == "__main__":
    main()
