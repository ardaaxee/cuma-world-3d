#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"CHARACTER50 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"CHARACTER50 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"CHARACTER50 APPLIED: {label}")


def patch_runtime_character(path: Path) -> None:
    replace_once(
        path,
        'if FileAccess.file_exists("res://assets/characters/cuma.glb"):\n\t\tvar resource = load("res://assets/characters/cuma.glb")',
        'var character_asset_path = "res://assets/characters/cuma_high.glb" if FileAccess.file_exists("res://assets/characters/cuma_high.glb") else "res://assets/characters/cuma.glb"\n\tif FileAccess.file_exists(character_asset_path):\n\t\tvar resource = load(character_asset_path)',
        f"prefer high-detail character in {path.name}",
    )
    replace_once(
        path,
        'imported.scale = Vector3.ONE * 0.340030\n\t\t\timported.position.y = -0.000447\n\t\t\timported.rotation_degrees.y = 180.0',
        'if character_asset_path.ends_with("cuma_high.glb"):\n\t\t\t\timported.scale = Vector3.ONE * 1.002724\n\t\t\t\timported.position.y = -0.000444\n\t\t\t\timported.rotation_degrees.y = 180.0\n\t\t\telse:\n\t\t\t\timported.scale = Vector3.ONE * 0.340030\n\t\t\t\timported.position.y = -0.000447\n\t\t\t\timported.rotation_degrees.y = 180.0',
        f"apply audited high-detail normalization in {path.name}",
    )


def patch_menu_character() -> None:
    path = ROOT / "scripts/ui/menu_character.gd"
    replace_once(
        path,
        'if FileAccess.file_exists("res://assets/characters/cuma.glb"):\n\t\tvar resource = load("res://assets/characters/cuma.glb")',
        'var character_asset_path = "res://assets/characters/cuma_high.glb" if FileAccess.file_exists("res://assets/characters/cuma_high.glb") else "res://assets/characters/cuma.glb"\n\tif FileAccess.file_exists(character_asset_path):\n\t\tvar resource = load(character_asset_path)',
        "prefer high-detail character in menu",
    )
    replace_once(
        path,
        'imported.scale = Vector3.ONE * 0.340030\n\t\t\timported.position.y = -0.000447\n\t\t\timported.rotation_degrees.y = 180.0',
        'if character_asset_path.ends_with("cuma_high.glb"):\n\t\t\t\timported.scale = Vector3.ONE * 1.002724\n\t\t\t\timported.position.y = -0.000444\n\t\t\t\timported.rotation_degrees.y = 180.0\n\t\t\telse:\n\t\t\t\timported.scale = Vector3.ONE * 0.340030\n\t\t\t\timported.position.y = -0.000447\n\t\t\t\timported.rotation_degrees.y = 180.0',
        "apply audited high-detail normalization in menu",
    )


def normalize(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    player = ROOT / "scripts/player_controller.gd"
    menu = ROOT / "scripts/ui/menu_character.gd"
    # Partner uses its own partner.glb slot. Do not replace it with CUMA's male rig.
    patch_runtime_character(player)
    patch_menu_character()
    normalize(player)
    normalize(menu)
    print("CUMA CHARACTER 5.0 HIGH-DETAIL SLOT: PASS")


if __name__ == "__main__":
    main()
