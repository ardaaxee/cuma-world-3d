#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil
import re

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "game"
OVERLAY = REPO / "ci" / "overlays" / "70" / "scripts" / "action"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"ACTION70 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ACTION70 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"ACTION70 APPLIED: {label}")


def copy_runtime() -> None:
    target = ROOT / "scripts" / "action"
    target.mkdir(parents=True, exist_ok=True)
    for name in ["cinematic_action_runtime.gd", "cinematic_action_hud.gd"]:
        shutil.copy2(OVERLAY / name, target / name)
        print(f"ACTION70 COPIED: {name}")


def patch_builder() -> None:
    path = ROOT / "scripts" / "intelligence" / "intelligence_stealth_builder.gd"
    replace_once(
        path,
        'const AwarenessSystemScript = preload("res://scripts/stealth/awareness_system.gd")\nconst IntelligenceHUDScript = preload("res://scripts/ui/intelligence_hud.gd")\n',
        'const AwarenessSystemScript = preload("res://scripts/stealth/awareness_system.gd")\nconst CinematicActionRuntimeScript = preload("res://scripts/action/cinematic_action_runtime.gd")\nconst CinematicActionHUDScript = preload("res://scripts/action/cinematic_action_hud.gd")\nconst IntelligenceHUDScript = preload("res://scripts/ui/intelligence_hud.gd")\n',
        "preload action runtime and compact HUD",
    )
    replace_once(
        path,
        '''\tawareness.setup()\n\tawareness.alert_changed.connect(mission.report_alert_transition)\n\tvar observation = Node.new()''',
        '''\tawareness.setup()\n\tawareness.alert_changed.connect(mission.report_alert_transition)\n\tvar action_runtime = Node.new()\n\taction_runtime.name = "CinematicAction70"\n\taction_runtime.set_script(CinematicActionRuntimeScript)\n\tworld.add_child(action_runtime)\n\taction_runtime.setup()\n\tvar action_hud = CanvasLayer.new()\n\taction_hud.name = "CinematicActionHUD70"\n\taction_hud.set_script(CinematicActionHUDScript)\n\tworld.add_child(action_hud)\n\taction_hud.setup(action_runtime)\n\tvar observation = Node.new()''',
        "instantiate action runtime beside awareness",
    )


def patch_awareness() -> None:
    path = ROOT / "scripts" / "stealth" / "awareness_system.gd"
    replace_once(
        path,
        '''\t\tif player.has_method("get_stealth_visibility_factor"):\n\t\t\tvisibility_factor = clamp(float(player.get_stealth_visibility_factor()), 0.35, 1.0)\n\t\tvar distance_factor = clamp(1.25 - distance / VISION_DISTANCE, 0.25, 1.0)''',
        '''\t\tif player.has_method("get_stealth_visibility_factor"):\n\t\t\tvisibility_factor = clamp(float(player.get_stealth_visibility_factor()), 0.35, 1.0)\n\t\tvar action_system = get_tree().get_first_node_in_group("cinematic_action_system")\n\t\tif action_system != null and action_system.has_method("get_visibility_multiplier"):\n\t\t\tvisibility_factor *= clamp(float(action_system.call("get_visibility_multiplier")), 0.45, 1.0)\n\t\tvar distance_factor = clamp(1.25 - distance / VISION_DISTANCE, 0.25, 1.0)''',
        "let temporary cover lower visibility without bypassing awareness",
    )


def patch_mission() -> None:
    path = ROOT / "scripts" / "intelligence" / "mission_system.gd"
    replace_once(
        path,
        'var alert_events = 0\n',
        'var alert_events = 0\nvar cinematic_action_events = 0\nvar spycraft_action_events = 0\n',
        "track cinematic action approach",
    )
    replace_once(
        path,
        '''\tselected_route = ""\n\talert_events = 0\n\t_save_progress()''',
        '''\tselected_route = ""\n\talert_events = 0\n\tcinematic_action_events = 0\n\tspycraft_action_events = 0\n\t_save_progress()''',
        "reset action scoring for new mission",
    )
    replace_once(
        path,
        '''\t\t"routes_discovered": _route_count(),\n\t\t"rank": _rank_for_result(alert_events, found, total),\n\t}''',
        '''\t\t"routes_discovered": _route_count(),\n\t\t"rank": _rank_for_result(alert_events, found, total),\n\t\t"approach": _approach_for_result(),\n\t\t"action_events": cinematic_action_events,\n\t\t"spycraft_events": spycraft_action_events,\n\t}''',
        "add Ghost Spycraft Action mission evaluation",
    )
    anchor = 'func get_active_summary() -> Dictionary:\n'
    helper = '''func report_cinematic_action(kind: String) -> void:\n\tif kind in ["SPYCRAFT_MARK", "COVER"]:\n\t\tspycraft_action_events += 1\n\telse:\n\t\tcinematic_action_events += 1\n\t_save_progress()\n\nfunc _approach_for_result() -> String:\n\tif cinematic_action_events == 0 and alert_events == 0:\n\t\treturn "GHOST" if spycraft_action_events == 0 else "SPYCRAFT"\n\tif spycraft_action_events > cinematic_action_events * 2:\n\t\treturn "SPYCRAFT"\n\treturn "ACTION"\n\n'''
    text = path.read_text(encoding="utf-8")
    if helper not in text:
        if text.count(anchor) != 1:
            raise SystemExit("ACTION70 mission helper anchor missing")
        path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
        print("ACTION70 APPLIED: add approach scoring helpers")
    replace_once(
        path,
        '''\t\t\t"alerts": alert_events,\n\t\t})''',
        '''\t\t\t"alerts": alert_events,\n\t\t\t"action_events": cinematic_action_events,\n\t\t\t"spycraft_events": spycraft_action_events,\n\t\t})''',
        "persist action scoring",
    )
    replace_once(
        path,
        '''\talert_events = clamp(int(saved.get("alerts", 0)), 0, 999)\n''',
        '''\talert_events = clamp(int(saved.get("alerts", 0)), 0, 999)\n\tcinematic_action_events = clamp(int(saved.get("action_events", 0)), 0, 999)\n\tspycraft_action_events = clamp(int(saved.get("spycraft_events", 0)), 0, 999)\n''',
        "restore action scoring",
    )


def normalize() -> None:
    for relative in [
        "scripts/action/cinematic_action_runtime.gd",
        "scripts/action/cinematic_action_hud.gd",
        "scripts/intelligence/intelligence_stealth_builder.gd",
        "scripts/intelligence/mission_system.gd",
        "scripts/stealth/awareness_system.gd",
    ]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    copy_runtime()
    patch_builder()
    patch_awareness()
    patch_mission()
    normalize()
    print("CUMA CINEMATIC ACTION 7.0: PASS")


if __name__ == "__main__":
    main()
