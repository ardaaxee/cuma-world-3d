#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1] / "game"
OVERLAY = Path(__file__).resolve().parent / "overlays" / "91"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"SPY91 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"SPY91 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"SPY91 APPLIED: {label}")


def copy_overlay() -> None:
    for source in OVERLAY.rglob("*"):
        if not source.is_file():
            continue
        relative = source.relative_to(OVERLAY)
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        print(f"SPY91 OVERLAY: {relative}")


def patch_awareness() -> None:
    path = ROOT / "scripts/stealth/awareness_system.gd"
    replace_once(path, 'var sensor_alert_until_msec = 0\nvar last_sensor_position = Vector3.ZERO', 'var sensor_alert_until_msec = 0\nvar sensor_suppressed_until_msec = 0\nvar last_sensor_position = Vector3.ZERO', "track fictional sensor cooldown")
    replace_once(path, 'func report_sensor_tracking(position: Vector3, kind: String = "CCTV") -> void:\n\tlast_sensor_position = position\n', 'func report_sensor_tracking(position: Vector3, kind: String = "CCTV") -> void:\n\tif Time.get_ticks_msec() < sensor_suppressed_until_msec:\n\t\treturn\n\tlast_sensor_position = position\n', "respect sensor cooldown while tracking")
    replace_once(path, 'func report_sensor_detection(position: Vector3, kind: String = "CCTV") -> void:\n\tlast_sensor_position = position\n', 'func report_sensor_detection(position: Vector3, kind: String = "CCTV") -> void:\n\tif Time.get_ticks_msec() < sensor_suppressed_until_msec:\n\t\treturn\n\tlast_sensor_position = position\n', "respect sensor cooldown while detecting")
    helpers = '''func get_global_suspicion() -> float:\n\t_resolve_player()\n\tvar highest = 0.0\n\tfor npc in _candidate_npcs():\n\t\tif not (npc is Node3D):\n\t\t\tcontinue\n\t\tif player != null and (npc as Node3D).global_position.distance_to(player.global_position) > MAX_ACTIVE_DISTANCE:\n\t\t\tcontinue\n\t\thighest = max(highest, float(npc.get_meta("stealth_suspicion", 0.0)))\n\tvar now = Time.get_ticks_msec()\n\tif now < sensor_alert_until_msec:\n\t\thighest = max(highest, 1.0)\n\telif now < sensor_suspicion_until_msec:\n\t\thighest = max(highest, 0.34)\n\treturn clamp(highest * 100.0, 0.0, 100.0)\n\nfunc apply_social_bluff(strength: float = 0.34, radius: float = 7.5) -> Dictionary:\n\t_resolve_player()\n\tif player == null:\n\t\treturn {"success": false, "affected": 0, "reason": "NO_PLAYER"}\n\tvar clean_strength = clamp(strength, 0.05, 0.45)\n\tvar clean_radius = clamp(radius, 2.0, 10.0)\n\tvar affected = 0\n\tvar lowest_after = 1.0\n\tfor npc in _candidate_npcs():\n\t\tif not (npc is Node3D):\n\t\t\tcontinue\n\t\tvar npc3d = npc as Node3D\n\t\tvar distance = npc3d.global_position.distance_to(player.global_position)\n\t\tif distance > clean_radius:\n\t\t\tcontinue\n\t\tvar state = str(npc.get_meta("stealth_state", "UNAWARE"))\n\t\tif state == "ALERTED":\n\t\t\tcontinue\n\t\tvar current = float(npc.get_meta("stealth_suspicion", 0.0))\n\t\tif current <= 0.02:\n\t\t\tcontinue\n\t\tvar falloff = clamp(1.0 - distance / clean_radius, 0.25, 1.0)\n\t\tvar next_value = max(0.0, current - clean_strength * falloff)\n\t\tnpc.set_meta("stealth_suspicion", next_value)\n\t\tnpc.set_meta("stealth_state", _state_for_suspicion(next_value, state, false))\n\t\tnpc.set_meta("stealth_last_event", "SOCIAL_BLUFF")\n\t\taffected += 1\n\t\tlowest_after = min(lowest_after, next_value)\n\t_refresh_global_alert(_candidate_npcs())\n\treturn {"success": affected > 0, "affected": affected, "suspicion_after": lowest_after * 100.0 if affected > 0 else get_global_suspicion()}\n\nfunc apply_sensor_cooldown(duration_msec: int = 2400) -> void:\n\tvar duration = clamp(duration_msec, 500, 4000)\n\tsensor_suppressed_until_msec = max(sensor_suppressed_until_msec, Time.get_ticks_msec() + duration)\n\tsensor_suspicion_until_msec = min(sensor_suspicion_until_msec, Time.get_ticks_msec())\n\n'''
    replace_once(path, 'func get_nearest_suspicion() -> Dictionary:\n', helpers + 'func get_nearest_suspicion() -> Dictionary:\n', "real suspicion API and social bluff")


def patch_builder() -> None:
    path = ROOT / "scripts/intelligence/intelligence_stealth_builder.gd"
    replace_once(path, 'const IntelligenceDebugPanelScript = preload("res://scripts/intelligence/intelligence_debug_panel.gd")\nconst CinematicActionRuntimeScript = preload("res://scripts/action/cinematic_action_runtime.gd")', 'const IntelligenceDebugPanelScript = preload("res://scripts/intelligence/intelligence_debug_panel.gd")\nconst SpycraftMissionDirectorScript = preload("res://scripts/intelligence/spycraft_mission_director.gd")\nconst CinematicActionRuntimeScript = preload("res://scripts/action/cinematic_action_runtime.gd")', "preload spycraft mission director")
    replace_once(path, '\tdebug_panel.set_script(IntelligenceDebugPanelScript)\n\tworld.add_child(debug_panel)\n\tdebug_panel.setup()\n', '\tdebug_panel.set_script(IntelligenceDebugPanelScript)\n\tworld.add_child(debug_panel)\n\tdebug_panel.setup()\n\tvar director = Node.new()\n\tdirector.name = "SpycraftMissionDirector91"\n\tdirector.set_script(SpycraftMissionDirectorScript)\n\tworld.add_child(director)\n\tdirector.setup()\n', "instantiate one director beside existing intelligence systems")


def patch_field_ops() -> None:
    path = ROOT / "scripts/ui/field_ops_runtime.gd"
    replace_once(path, '\t_scan_field_intel(player)\n\tfocus = min(100.0, focus + 9.0)\n\t_play_field_sfx(720.0, 0.09, 0.18)\n', '\t_scan_field_intel(player)\n\tvar director = get_tree().get_first_node_in_group("spycraft_mission_director")\n\tif director != null and director.has_method("report_spycraft_action"):\n\t\tdirector.call("report_spycraft_action", "OBSERVE", {})\n\tfocus = min(100.0, focus + 9.0)\n\t_play_field_sfx(720.0, 0.09, 0.18)\n', "observation contributes to mission approach")
    replace_once(path, '\t_collect_intel("ODAK ANALİZİ", "Kısa süreli gelişmiş çevre okuması etkinleştirildi.")\n\t_play_field_sfx(840.0, 0.11, 0.18)\n', '\t_collect_intel("ODAK ANALİZİ", "Kısa süreli gelişmiş çevre okuması etkinleştirildi.")\n\tvar director = get_tree().get_first_node_in_group("spycraft_mission_director")\n\tif director != null and director.has_method("report_spycraft_action"):\n\t\tdirector.call("report_spycraft_action", "FOCUS", {})\n\t_play_field_sfx(840.0, 0.11, 0.18)\n', "focus contributes to mission approach")
    replace_once(path, '\tfocus -= 20.0\n\tsuspicion = max(0.0, suspicion - 38.0)\n\t_collect_intel("SOSYAL GİZLİLİK", "Şüphe kontrollü diyalog/blöf ile azaltıldı.")\n\t_play_field_sfx(610.0, 0.07, 0.16)\n', '\tfocus -= 20.0\n\tvar director = get_tree().get_first_node_in_group("spycraft_mission_director")\n\tvar bluff_result: Dictionary = {}\n\tif director != null and director.has_method("attempt_social_bluff"):\n\t\tbluff_result = director.call("attempt_social_bluff", 0.34)\n\tvar awareness = get_tree().get_first_node_in_group("awareness_system")\n\tif awareness != null and awareness.has_method("get_global_suspicion"):\n\t\tsuspicion = float(awareness.call("get_global_suspicion"))\n\telse:\n\t\tsuspicion = max(0.0, suspicion - 18.0)\n\tif bool(bluff_result.get("success", false)):\n\t\t_collect_intel("SOSYAL GİZLİLİK", "Dünya durumu güncellendi; yakındaki kurgu NPC şüphesi azaldı.")\n\telse:\n\t\t_notice("Blöf için uygun sosyal fırsat yok")\n\t_play_field_sfx(610.0, 0.07, 0.16)\n', "make bluff affect real NPC awareness")
    replace_once(path, '\tvar gadget = gadget_names[selected_gadget]\n\tif gadget == "SİNYAL TARAYICI":\n', '\tvar gadget = gadget_names[selected_gadget]\n\tvar director = get_tree().get_first_node_in_group("spycraft_mission_director")\n\tif director != null and director.has_method("use_context_gadget"):\n\t\tdirector.call("use_context_gadget", gadget)\n\tif gadget == "SİNYAL TARAYICI":\n', "route gadgets through mission director")
    replace_once(path, '\telif gadget == "KAMERA DÖNGÜSÜ":\n\t\tsuspicion = max(0.0, suspicion - 10.0)\n\t\t_collect_intel("AYGIT", "Kurgusal güvenlik kamerası döngüsü kısa süreli rota fırsatı oluşturdu.")\n', '\telif gadget == "KAMERA DÖNGÜSÜ":\n\t\t_collect_intel("AYGIT", "Kurgusal güvenlik kamerası döngüsü kısa süreli rota fırsatı oluşturdu.")\n', "remove fake camera suspicion reduction")
    replace_once(path, '\telse:\n\t\tsuspicion = max(0.0, suspicion - 7.0)\n\t\t_collect_intel("AYGIT", "Çevresel dikkat başka yöne çekildi; gizli geçiş için kısa fırsat oluştu.")\n', '\telse:\n\t\t_collect_intel("AYGIT", "Çevresel dikkat başka yöne çekildi; gizli geçiş için kısa fırsat oluştu.")\n', "remove fake distraction suspicion reduction")


def normalize() -> None:
    files = [ROOT / "scripts/stealth/awareness_system.gd", ROOT / "scripts/intelligence/intelligence_stealth_builder.gd", ROOT / "scripts/ui/field_ops_runtime.gd", ROOT / "scripts/intelligence/spycraft_mission_director.gd", ROOT / "scripts/ci/spycraft_91_runtime_probe.gd"]
    for path in files:
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    copy_overlay()
    patch_awareness()
    patch_builder()
    patch_field_ops()
    normalize()
    print("CUMA WORLD SPYCRAFT GAMEPLAY 9.1: PASS")


if __name__ == "__main__":
    main()
