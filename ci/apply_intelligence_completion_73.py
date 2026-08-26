#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import base64
import json
import re
import zlib

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "game"

_PAYLOAD = "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[...snipped for brevity in this tool call...]=="
SOURCES = json.loads(zlib.decompress(base64.b64decode(_PAYLOAD)).decode("utf-8"))

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


def write_sources() -> None:
    for relative, content in SOURCES.items():
        path = ROOT / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
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
        "reuse security camera and add debug panel preloads",
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
    for relative in [
        "scripts/intelligence/intel_system.gd",
        "scripts/intelligence/mission_system.gd",
        "scripts/stealth/awareness_system.gd",
        "scripts/crime/security_camera.gd",
        "scripts/intelligence/intelligence_debug_panel.gd",
        "scripts/ui/phone_ui.gd",
        "scripts/action/cinematic_action_hud.gd",
        "scripts/ci/intelligence_73_runtime_probe.gd",
        "scripts/intelligence/intelligence_stealth_builder.gd",
        "scripts/game_state.gd",
    ]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    write_sources()
    patch_game_state()
    patch_builder()
    normalize()
    print("CUMA INTELLIGENCE COMPLETION 7.3: PASS")


if __name__ == "__main__":
    main()
