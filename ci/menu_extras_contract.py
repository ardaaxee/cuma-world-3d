#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def fail(message: str) -> None:
    raise SystemExit(f"MENU EXTRAS CONTRACT: FAIL: {message}")


def require(text: str, tokens: list[str], label: str) -> None:
    missing = [token for token in tokens if token not in text]
    if missing:
        fail(f"{label} missing: {', '.join(missing)}")


def function_body(text: str, signature: str) -> str:
    marker = f"func {signature}"
    if marker not in text:
        fail(f"missing function {signature}")
    return text.split(marker, 1)[1].split("\nfunc ", 1)[0]


def main() -> None:
    paths = {
        "menu": ROOT / "scripts/ui/cinematic_main_menu.gd",
        "extras": ROOT / "scripts/ui/cinematic_menu_extras.gd",
        "mobile": ROOT / "scripts/mobile_controls.gd",
        "player": ROOT / "scripts/player_controller.gd",
    }
    for label, path in paths.items():
        if not path.is_file():
            fail(f"missing generated {label}: {path.relative_to(ROOT)}")

    menu = paths["menu"].read_text(encoding="utf-8")
    extras = paths["extras"].read_text(encoding="utf-8")
    mobile = paths["mobile"].read_text(encoding="utf-8")
    player = paths["player"].read_text(encoding="utf-8")

    require(menu, [
        'res://scripts/ui/cinematic_menu_extras.gd',
        '_build_menu_extras()',
        'menu_extras.call("play_transition")',
        '_enter_persistent_playing_state()',
        'menu_extras.call("on_gameplay_started")',
        'menu_extras.call("is_reduced_motion")',
    ], "persistent menu integration")
    begin = function_body(menu, "_begin_gameplay(load_saved_game: bool) -> void:")
    if "queue_free()" in begin:
        fail("cinematic menu controller must survive gameplay for pause/back handling")

    require(extras, [
        'user://cuma_menu_preferences.cfg',
        'ConfigFile.new()',
        'AudioServer.get_bus_index("Master")',
        'AudioServer.set_bus_volume_db',
        'get_tree().paused = true',
        'get_tree().reload_current_scene()',
        'net.call("join_cloud_room"',
        'net.call("join_relay"',
        'Input.vibrate_handheld',
        'AZALTILMIŞ HAREKET',
        'BAKIŞ HASSASİYETİ',
        'DİKEY BAKIŞI TERS ÇEVİR',
        'KAYDET VE ANA MENÜ',
        'OYUNDAN ÇIK',
        'Cloudflare / WebSocket relay',
        'RELAY İLE KATIL',
        'AudioStreamWAV.new()',
        'data.encode_s16',
    ], "menu extras behavior")
    if "SubViewport" in extras or "ViewportTexture" in extras:
        fail("extras must not create a second renderer/world")

    require(mobile, [
        '_make_top_button("MENÜ", -244.0)',
        '_make_top_button("EK", -304.0)',
        'func _on_toggle_utility_tray() -> void:',
        'get_first_node_in_group("cinematic_menu_extras")',
        'extras.call("toggle_pause_menu")',
    ], "mobile pause and compact utility entry")

    require(player, [
        'var look_sensitivity_multiplier = 1.0',
        'var invert_look_y = false',
        '_load_menu_control_preferences()',
        'func set_look_preferences(multiplier: float, invert_y: bool) -> void:',
        'user://cuma_menu_preferences.cfg',
        'adjusted_sensitivity',
        'vertical_sign',
    ], "player look preferences")

    for label, text in [("menu", menu), ("extras", extras), ("mobile", mobile), ("player", player)]:
        if re.search(r"^\s*var\s+[^\n]*:=", text, re.MULTILINE):
            fail(f"{label} reintroduced parser-incompatible local := inference")

    print("MENU EXTRAS CONTRACT: PASS")


if __name__ == "__main__":
    main()
