#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil

REPO = Path(__file__).resolve().parents[1]
GAME = REPO / "game"
OVERLAY = REPO / "ci" / "overlays" / "menu"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text and old not in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source match, found {count}")
    return text.replace(old, new, 1)


def copy_overlay() -> None:
    if not OVERLAY.is_dir():
        raise SystemExit(f"menu overlay not found: {OVERLAY}")
    shutil.copytree(OVERLAY, GAME, dirs_exist_ok=True)


def patch_main() -> None:
    path = GAME / "scripts" / "main.gd"
    text = path.read_text(encoding="utf-8")

    preload_old = 'const LawHUDScript = preload("res://scripts/crime/law_hud.gd")\n'
    preload_new = preload_old + 'const CinematicMainMenuScript = preload("res://scripts/ui/cinematic_main_menu.gd")\n'
    text = replace_once(text, preload_old, preload_new, "main.gd cinematic menu preload")

    gameplay_boot_old = '''\t_spawn_player()
\t_connect_network()
\t_spawn_mobile_controls()
\t_build_phone_09()
\t_build_social_ui_12()
\t_build_cyber_ui_19()
\t_build_law_hud_19()
\tprint("CUMA_BOOT_READY client ms=", Time.get_ticks_msec() - boot_started_ms)
'''
    gameplay_boot_new = '''\t_build_cinematic_main_menu()
\tprint("CUMA_BOOT_READY client ms=", Time.get_ticks_msec() - boot_started_ms)
'''
    text = replace_once(text, gameplay_boot_old, gameplay_boot_new, "main.gd route boot into cinematic menu")

    anchor = 'func _register_input_actions() -> void:\n'
    helpers = '''func _build_cinematic_main_menu() -> void:
\tif get_node_or_null("CinematicMainMenu") != null:
\t\treturn
\tvar menu = Node.new()
\tmenu.name = "CinematicMainMenu"
\tmenu.set_script(CinematicMainMenuScript)
\tadd_child(menu)
\tmenu.setup(self)

func _prepare_gameplay_from_menu() -> Node:
\tvar existing = get_tree().get_first_node_in_group("player")
\tif existing != null:
\t\treturn existing
\t_spawn_player()
\t_connect_network()
\treturn get_tree().get_first_node_in_group("player")

func _activate_gameplay_from_menu() -> void:
\t# Mobile/controller HUD is deliberately created only after the cinematic
\t# camera has reached PlayerCamera. MobileControls is the activation sentinel.
\tif get_node_or_null("MobileControls") != null:
\t\treturn
\t_spawn_mobile_controls()
\t_build_phone_09()
\t_build_social_ui_12()
\t_build_cyber_ui_19()
\t_build_law_hud_19()

'''
    if helpers not in text:
        if text.count(anchor) != 1:
            raise SystemExit("main.gd menu helper anchor not found exactly once")
        text = text.replace(anchor, helpers + anchor, 1)

    path.write_text(text, encoding="utf-8")


def main() -> None:
    if not (GAME / "project.godot").is_file():
        raise SystemExit("game/project.godot not found; extract source before menu patch")
    copy_overlay()
    patch_main()
    print("Cinematic main menu overlay applied.")


if __name__ == "__main__":
    main()
