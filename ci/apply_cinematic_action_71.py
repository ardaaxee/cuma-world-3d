#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil
import re

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "game"
OVERLAY = REPO / "ci" / "overlays" / "71" / "scripts" / "action"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"ACTION71 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ACTION71 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"ACTION71 APPLIED: {label}")


def copy_runtime() -> None:
    target = ROOT / "scripts" / "action"
    target.mkdir(parents=True, exist_ok=True)
    for name in ["cinematic_action_runtime.gd", "cinematic_action_hud.gd"]:
        shutil.copy2(OVERLAY / name, target / name)
        print(f"ACTION71 COPIED: {name}")


def patch_builder() -> None:
    path = ROOT / "scripts" / "intelligence" / "intelligence_stealth_builder.gd"
    replace_once(
        path,
        "\t_build_market_mission_targets()\n\tvar hud = CanvasLayer.new()",
        "\t_build_market_mission_targets()\n\t_build_action_71_environment()\n\tvar hud = CanvasLayer.new()",
        "build spatial cover points and mission action targets",
    )
    anchor = "func _target(node_name: String, pos: Vector3, data: Dictionary) -> void:\n"
    helper = '''func _build_action_71_environment() -> void:\n\t# Spatial cover points are scene locations, not a global always-on stealth toggle.\n\t_cover_point("MarketCoverFront71", Vector3(13.2, 0.05, 34.2), "ANA GİRİŞ DUVARI")\n\t_cover_point("MarketCoverSide71", Vector3(19.7, 0.05, 36.0), "YAN GİRİŞ")\n\t_cover_point("MarketCoverCounter71", Vector3(17.1, 0.05, 39.1), "TEZGÂH")\n\t_cover_point("MarketCoverRear71", Vector3(21.2, 0.05, 40.4), "ARKA KÖŞE")\n\t_cover_point("EntryCover71", Vector3(2.2, 0.05, 10.8), "GİRİŞ DUVARI")\n\t_cover_point("LivingCover71", Vector3(-2.8, 0.05, 8.4), "SALON KÖŞESİ")\n\t# Only explicit mission sentries participate in close tactical states; ordinary\n\t# relationship NPCs stay outside the action-target group.\n\tvar candidates: Array = []\n\tfor npc in get_tree().get_nodes_in_group("ambient_city_citizen"):\n\t\tif npc is Node3D and npc.global_position.distance_to(Vector3(17.5, 0.05, 38.0)) < 25.0:\n\t\t\tcandidates.append(npc)\n\tvar count = min(2, candidates.size())\n\tfor index in range(count):\n\t\tvar npc = candidates[index]\n\t\tnpc.set_meta("action_enabled", true)\n\t\tnpc.set_meta("display_name", "SAHA GÖZCÜSÜ %02d" % (index + 1))\n\t\tnpc.set_meta("action_state", "CALM")\n\nfunc _cover_point(node_name: String, pos: Vector3, label: String) -> void:\n\tvar point = Marker3D.new()\n\tpoint.name = node_name\n\tpoint.position = pos\n\tpoint.add_to_group("action_cover_point")\n\tpoint.set_meta("cover_label", label)\n\tworld.add_child(point)\n\n'''
    text = path.read_text(encoding="utf-8")
    if helper not in text:
        if text.count(anchor) != 1:
            raise SystemExit("ACTION71 builder helper anchor missing")
        path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
        print("ACTION71 APPLIED: add spatial cover and mission sentry helper")


def normalize() -> None:
    for relative in [
        "scripts/action/cinematic_action_runtime.gd",
        "scripts/action/cinematic_action_hud.gd",
        "scripts/intelligence/intelligence_stealth_builder.gd",
    ]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    copy_runtime()
    patch_builder()
    normalize()
    print("CUMA CINEMATIC ACTION 7.1: PASS")


if __name__ == "__main__":
    main()
