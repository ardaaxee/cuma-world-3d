#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil
import re

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "game"
OVERLAY = REPO / "ci" / "overlays" / "72" / "scripts" / "action"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"ACTION72 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ACTION72 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"ACTION72 APPLIED: {label}")


def copy_runtime() -> None:
    target = ROOT / "scripts" / "action"
    target.mkdir(parents=True, exist_ok=True)
    for name in ["cinematic_action_runtime.gd", "cinematic_action_hud.gd"]:
        shutil.copy2(OVERLAY / name, target / name)
        print(f"ACTION72 COPIED: {name}")


def patch_builder() -> None:
    path = ROOT / "scripts" / "intelligence" / "intelligence_stealth_builder.gd"
    replace_once(
        path,
        "\t_build_action_71_environment()\n\tvar hud = CanvasLayer.new()",
        "\t_build_action_71_environment()\n\t_build_action_72_environment()\n\tvar hud = CanvasLayer.new()",
        "build Q-Lens opportunities and chase route nodes",
    )
    anchor = "func _target(node_name: String, pos: Vector3, data: Dictionary) -> void:\n"
    helper = '''func _build_action_72_environment() -> void:\n\t# Environmental opportunities are fictional level-design hints. They expose\n\t# routes, timing and concealment information without real-world instructions.\n\t_opportunity("MarketOpportunityRoute72", Vector3(14.0, 0.05, 35.1), "SERVİS ROTASI", "Daha düşük görünürlüklü alternatif geçiş")\n\t_opportunity("MarketOpportunityCart72", Vector3(18.7, 0.05, 38.5), "TESLİMAT ARABASI", "Kısa süreli görüş hattı kesintisi")\n\t_opportunity("MarketOpportunityCorner72", Vector3(21.0, 0.05, 36.7), "KÖR KÖŞE", "Yaklaşım zamanlaması için güvenli gözlem noktası")\n\t_opportunity("MarketOpportunityCooler72", Vector3(16.6, 0.05, 40.7), "SOĞUTUCU SESİ", "Ortam sesi hareketi kısa süre maskeliyor")\n\t_chase_node("MarketChaseA72", Vector3(11.8, 0.05, 32.7))\n\t_chase_node("MarketChaseB72", Vector3(15.6, 0.05, 35.0))\n\t_chase_node("MarketChaseC72", Vector3(20.9, 0.05, 37.0))\n\t_chase_node("MarketChaseD72", Vector3(21.4, 0.05, 41.2))\n\t_chase_node("MarketChaseE72", Vector3(16.5, 0.05, 42.3))\n\t_chase_node("MarketChaseF72", Vector3(11.5, 0.05, 39.4))\n\nfunc _opportunity(node_name: String, pos: Vector3, label: String, note: String) -> void:\n\tvar point = Marker3D.new()\n\tpoint.name = node_name\n\tpoint.position = pos\n\tpoint.add_to_group("action_opportunity")\n\tpoint.set_meta("opportunity_label", label)\n\tpoint.set_meta("opportunity_note", note)\n\tworld.add_child(point)\n\nfunc _chase_node(node_name: String, pos: Vector3) -> void:\n\tvar point = Marker3D.new()\n\tpoint.name = node_name\n\tpoint.position = pos\n\tpoint.add_to_group("action_chase_node")\n\tworld.add_child(point)\n\n'''
    text = path.read_text(encoding="utf-8")
    if helper not in text:
        if text.count(anchor) != 1:
            raise SystemExit("ACTION72 builder helper anchor missing")
        path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
        print("ACTION72 APPLIED: add environment opportunities and chase nodes")


def patch_mission_scoring() -> None:
    path = ROOT / "scripts" / "intelligence" / "mission_system.gd"
    replace_once(
        path,
        'if kind in ["SPYCRAFT_MARK", "COVER"]:',
        'if kind in ["SPYCRAFT_MARK", "COVER", "SPYCRAFT_OPPORTUNITY"]:',
        "count environmental opportunity scans as spycraft",
    )


def normalize() -> None:
    for relative in [
        "scripts/action/cinematic_action_runtime.gd",
        "scripts/action/cinematic_action_hud.gd",
        "scripts/intelligence/intelligence_stealth_builder.gd",
        "scripts/intelligence/mission_system.gd",
    ]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    copy_runtime()
    patch_builder()
    patch_mission_scoring()
    normalize()
    print("CUMA CINEMATIC ACTION 7.2: PASS")


if __name__ == "__main__":
    main()
