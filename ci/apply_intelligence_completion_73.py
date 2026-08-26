#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import shutil

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "game"
OVERLAY = REPO / "ci" / "overlays" / "73" / "scripts"

SOURCE_FILES = [
    "intelligence/intel_system.gd",
    "intelligence/mission_system.gd",
    "stealth/awareness_system.gd",
    "crime/security_camera.gd",
    "intelligence/intelligence_debug_panel.gd",
    "ui/phone_ui.gd",
    "action/cinematic_action_hud.gd",
    "ci/intelligence_73_runtime_probe.gd",
]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"INTEL73 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"INTEL73 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"INTEL73 APPLIED: {label}")


def copy_sources() -> None:
    for relative in SOURCE_FILES:
        source = OVERLAY / relative
        target = ROOT / "scripts" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        print(f"INTEL73 SOURCE: {relative}")


def patch_game_state() -> None:
    path = ROOT / "scripts" / "game_state.gd"
    old = '''\tintel_discoveries[clean_id] = {
\t\t"source": source.strip_edges().left(48),
\t\t"mission_id": mission_id.strip_edges().to_lower().left(64),
\t\t"day": world_day,
\t\t"time": time_of_day,
\t}
\tstate_changed.emit()

func is_intel_discovered(intel_id: String) -> bool:
\treturn intel_discoveries.has(intel_id.strip_edges().to_lower().left(64))
'''
    new = '''\tintel_discoveries[clean_id] = {
\t\t"source": source.strip_edges().left(48),
\t\t"mission_id": mission_id.strip_edges().to_lower().left(64),
\t\t"day": world_day,
\t\t"time": time_of_day,
\t\t"discovered_at": {"day": world_day, "time": time_of_day},
\t}
\tstate_changed.emit()

func get_intel_discovery(intel_id: String) -> Dictionary:
\tvar clean_id = intel_id.strip_edges().to_lower().left(64)
\tvar value: Variant = intel_discoveries.get(clean_id, {})
\treturn value.duplicate(true) if value is Dictionary else {}

func is_intel_discovered(intel_id: String) -> bool:
\treturn intel_discoveries.has(intel_id.strip_edges().to_lower().left(64))
'''
    replace_once(path, old, new, "persist discoveredAt and expose intel record")


def patch_builder() -> None:
    path = ROOT / "scripts" / "intelligence" / "intelligence_stealth_builder.gd"
    replace_once(
        path,
        'const AwarenessSystemScript = preload("res://scripts/stealth/awareness_system.gd")\nconst CinematicActionRuntimeScript = preload("res://scripts/action/cinematic_action_runtime.gd")\n',
        'const AwarenessSystemScript = preload("res://scripts/stealth/awareness_system.gd")\nconst SecurityCameraScript = preload("res://scripts/crime/security_camera.gd")\nconst IntelligenceDebugPanelScript = preload("res://scripts/intelligence/intelligence_debug_panel.gd")\nconst CinematicActionRuntimeScript = preload("res://scripts/action/cinematic_action_runtime.gd")\n',
        "reuse existing CCTV and add debug panel preloads",
    )
    replace_once(
        path,
        '\t_build_action_72_environment()\n\tvar hud = CanvasLayer.new()',
        '\t_build_action_72_environment()\n\t_build_intelligence_73_environment()\n\tvar hud = CanvasLayer.new()',
        "stage CCTV and debug intelligence environment",
    )
    anchor = 'func _target(node_name: String, pos: Vector3, data: Dictionary) -> void:\n'
    helper = '''func _build_intelligence_73_environment() -> void:
\t_mission_camera("MarketCCTVFront73", Vector3(14.0, 3.15, 33.7), deg_to_rad(180.0), 11.5, {"fov":58.0,"intel_id":"market_cctv_front","title":"Ön Güvenlik Kamerası"})
\t_mission_camera("MarketCCTVSide73", Vector3(21.3, 3.05, 38.7), deg_to_rad(-90.0), 9.5, {"fov":55.0,"intel_id":"market_cctv_side","title":"Yan Güvenlik Kamerası"})
\tvar debug_panel = CanvasLayer.new()
\tdebug_panel.name = "IntelligenceDebug73"
\tdebug_panel.set_script(IntelligenceDebugPanelScript)
\tworld.add_child(debug_panel)
\tdebug_panel.setup()

func _mission_camera(node_name: String, pos: Vector3, yaw: float, radius: float, data: Dictionary) -> void:
\tvar camera_node = Node3D.new()
\tcamera_node.name = node_name
\tcamera_node.position = pos
\tcamera_node.rotation.y = yaw
\tcamera_node.set_script(SecurityCameraScript)
\tworld.add_child(camera_node)
\tcamera_node.setup(radius, data)

'''
    text = path.read_text(encoding="utf-8")
    if helper not in text:
        if text.count(anchor) != 1:
            raise SystemExit("INTEL73 builder helper anchor missing")
        path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
        print("INTEL73 APPLIED: add in-world CCTV and debug builder helper")


def normalize() -> None:
    for relative in SOURCE_FILES + ["intelligence/intelligence_stealth_builder.gd", "game_state.gd"]:
        path = ROOT / "scripts" / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    copy_sources()
    patch_game_state()
    patch_builder()
    normalize()
    print("CUMA INTELLIGENCE COMPLETION 7.3: PASS")


if __name__ == "__main__":
    main()
