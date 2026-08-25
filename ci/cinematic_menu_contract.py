#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def fail(message: str) -> None:
    raise SystemExit(f"CINEMATIC MENU CONTRACT: FAIL: {message}")


def body(text: str, signature: str) -> str:
    marker = f"func {signature}"
    if marker not in text:
        fail(f"missing function {signature}")
    return text.split(marker, 1)[1].split("\nfunc ", 1)[0]


def require(text: str, tokens: list[str], label: str) -> None:
    missing = [token for token in tokens if token not in text]
    if missing:
        fail(f"{label} missing: {', '.join(missing)}")


def main() -> None:
    main_path = ROOT / "scripts/main.gd"
    menu_path = ROOT / "scripts/ui/cinematic_main_menu.gd"
    character_path = ROOT / "scripts/ui/menu_character.gd"
    for path in [main_path, menu_path, character_path]:
        if not path.is_file():
            fail(f"missing generated source {path.relative_to(ROOT)}")

    main_script = main_path.read_text(encoding="utf-8")
    menu = menu_path.read_text(encoding="utf-8")
    character = character_path.read_text(encoding="utf-8")

    ready = body(main_script, "_ready() -> void:")
    if "_build_cinematic_main_menu()" not in ready:
        fail("client boot must enter the cinematic menu")
    for forbidden in ["_spawn_player()", "_spawn_mobile_controls()", "_build_phone_09()", "_build_law_hud_19()"]:
        if forbidden in ready:
            fail(f"gameplay system starts before menu handoff: {forbidden}")

    prepare = body(main_script, "_prepare_gameplay_from_menu() -> Node:")
    require(prepare, ["_spawn_player()", "_connect_network()"], "gameplay preparation")
    activate = body(main_script, "_activate_gameplay_from_menu() -> void:")
    require(
        activate,
        ["_spawn_mobile_controls()", "_build_phone_09()", "_build_social_ui_12()", "_build_cyber_ui_19()", "_build_law_hud_19()"],
        "gameplay UI activation",
    )

    require(
        menu,
        [
            "BOOT", "INTRO", "MAIN_MENU", "MULTIPLAYER", "CHARACTER", "WORLD_SELECT",
            "SETTINGS", "TRANSITION_TO_GAME", "PLAYING", "PAUSED",
            'menu_camera = Camera3D.new()',
            'net.host_lan(requested)',
            'net.join_lan(join_address_input.text, join_code_input.text)',
            'gs.load_game()',
            'gs.cycle_quality()',
            'DisplayServer.get_display_safe_area()',
            'player.set_physics_process(false)',
            'world_root.call("_activate_gameplay_from_menu")',
            'start_q.slerp(target_q, eased)',
            '"CUMA HOME"',
            '"CUMA WORLD"',
            '"YOUR WORLD. YOUR STORY."',
            '"DÜNYAYA GİR"',
        ],
        "menu state/integration",
    )
    if "SubViewport" in menu or "ViewportTexture" in menu:
        fail("menu must render the existing world instead of a second renderer/world")
    if "fake" in menu.lower() and "fake progress" in menu.lower():
        fail("fake progress is forbidden")
    if "user://cuma_world_save_v70.cfg" not in menu or "FileAccess.file_exists" not in menu:
        fail("continue must be driven by real save-file presence")
    if "FileAccess.get_modified_time" not in menu:
        fail("continue detail must use the real save timestamp")

    require(
        character,
        [
            'res://assets/characters/cuma_high.glb',
            'res://assets/characters/cuma.glb',
            'res://scripts/imported_character_bridge.gd',
            'res://scripts/character/procedural_humanoid.gd',
            'imported.scale = Vector3.ONE * 1.002724',
            'imported.position.y = -0.000444',
            'imported.rotation_degrees.y = 180.0',
            'imported.scale = Vector3.ONE * 0.340030',
            'procedural_rig.call("update_pose", delta, 0.0, false, 0.0, true, false, 0.0)',
            '"formal": true',
            'gs.get_character_palette()',
        ],
        "real menu character reuse",
    )

    print("CINEMATIC MENU CONTRACT: PASS")


if __name__ == "__main__":
    main()
