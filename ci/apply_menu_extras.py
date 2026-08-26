#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "game"
PARTS = REPO / "ci/menu_extras_parts"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"MENU EXTRAS ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"MENU EXTRAS APPLIED: {label}")


def assemble_extras() -> None:
    parts = sorted(PARTS.glob("*.gdpart"))
    if len(parts) != 4:
        raise SystemExit(f"expected 4 cinematic menu extras parts, found {len(parts)}")
    target = ROOT / "scripts/ui/cinematic_menu_extras.gd"
    target.parent.mkdir(parents=True, exist_ok=True)
    content = "".join(part.read_text(encoding="utf-8") for part in parts)
    target.write_text(content, encoding="utf-8")
    print("MENU EXTRAS ASSEMBLED:", target.relative_to(ROOT))


def patch_menu() -> None:
    path = ROOT / "scripts/ui/cinematic_main_menu.gd"
    replace_once(
        path,
        'const MenuCharacterScript = preload("res://scripts/ui/menu_character.gd")\n',
        'const MenuCharacterScript = preload("res://scripts/ui/menu_character.gd")\nconst MenuExtrasScript = preload("res://scripts/ui/cinematic_menu_extras.gd")\n',
        "preload cinematic menu extras",
    )
    replace_once(
        path,
        'var character_info_label: Label\nvar camera_updates_enabled = true\n',
        'var character_info_label: Label\nvar camera_updates_enabled = true\nvar menu_extras: Node\n',
        "retain cinematic menu extras",
    )
    replace_once(
        path,
        '\t_build_ui_shell()\n\t_connect_existing_systems()\n',
        '\t_build_ui_shell()\n\t_build_menu_extras()\n\t_connect_existing_systems()\n',
        "build extras before intro",
    )
    replace_once(
        path,
        'func _connect_existing_systems() -> void:\n',
        '''func _build_menu_extras() -> void:\n\tmenu_extras = Node.new()\n\tmenu_extras.name = "CinematicMenuExtras"\n\tmenu_extras.set_script(MenuExtrasScript)\n\tadd_child(menu_extras)\n\tmenu_extras.call("setup", self)\n\nfunc _connect_existing_systems() -> void:\n''',
        "add extras setup helper",
    )
    replace_once(
        path,
        '\tstate = MenuState.TRANSITION_TO_GAME\n\tcamera_updates_enabled = false\n',
        '\tstate = MenuState.TRANSITION_TO_GAME\n\tcamera_updates_enabled = false\n\tif menu_extras != null:\n\t\tmenu_extras.call("play_transition")\n',
        "play transition feedback",
    )
    replace_once(
        path,
        '''\t\tworld_root.call("_activate_gameplay_from_menu")\n\t\tqueue_free()\n\t\treturn\n''',
        '''\t\tworld_root.call("_activate_gameplay_from_menu")\n\t\t_enter_persistent_playing_state()\n\t\treturn\n''',
        "keep menu controller after fallback handoff",
    )
    replace_once(
        path,
        '''\tstate = MenuState.PLAYING\n\tqueue_free()\n\nfunc _animate_camera_transform(target: Transform3D, duration: float, target_fov: float) -> void:\n''',
        '''\t_enter_persistent_playing_state()\n\nfunc _enter_persistent_playing_state() -> void:\n\tstate = MenuState.PLAYING\n\tcamera_updates_enabled = false\n\tif ui_shell != null:\n\t\tui_shell.visible = false\n\tif menu_character != null:\n\t\tmenu_character.visible = false\n\tif menu_camera != null:\n\t\tmenu_camera.current = false\n\tif menu_extras != null:\n\t\tmenu_extras.call("on_gameplay_started")\n\nfunc _animate_camera_transform(target: Transform3D, duration: float, target_fov: float) -> void:\n\tif menu_extras != null and bool(menu_extras.call("is_reduced_motion")):\n\t\tmenu_camera.global_transform = target\n\t\tmenu_camera.fov = target_fov\n\t\treturn\n''',
        "persist controller and respect reduced motion",
    )


def patch_mobile_controls() -> None:
    path = ROOT / "scripts/mobile_controls.gd"
    replace_once(
        path,
        '''\tvar observation_button = _make_top_button("OBS", -364.0)\n\tobservation_button.pressed.connect(_on_observation_mode)\n\troot.add_child(observation_button)\n\n\tvar crouch_button = _make_button("GİZ", Vector2(-190.0, -178.0), Vector2(-126.0, -114.0))''',
        '''\tvar observation_button = _make_top_button("OBS", -364.0)\n\tobservation_button.pressed.connect(_on_observation_mode)\n\troot.add_child(observation_button)\n\n\tvar menu_button = _make_top_button("MENÜ", -424.0)\n\tmenu_button.pressed.connect(_on_pause_menu)\n\troot.add_child(menu_button)\n\n\tvar crouch_button = _make_button("GİZ", Vector2(-190.0, -178.0), Vector2(-126.0, -114.0))''',
        "add mobile pause menu button",
    )
    replace_once(
        path,
        '''func _on_crouch() -> void:\n\tvar player = _player()\n\tif player != null and player.has_method("toggle_crouch"):\n\t\tplayer.toggle_crouch()\n''',
        '''func _on_pause_menu() -> void:\n\tvar extras = get_tree().get_first_node_in_group("cinematic_menu_extras")\n\tif extras != null and extras.has_method("toggle_pause_menu"):\n\t\textras.call("toggle_pause_menu")\n\nfunc _on_crouch() -> void:\n\tvar player = _player()\n\tif player != null and player.has_method("toggle_crouch"):\n\t\tplayer.toggle_crouch()\n''',
        "wire mobile pause handler",
    )


def patch_player_controls() -> None:
    path = ROOT / "scripts/player_controller.gd"
    replace_once(
        path,
        'var last_visual_yaw = 0.0\n',
        'var last_visual_yaw = 0.0\nvar look_sensitivity_multiplier = 1.0\nvar invert_look_y = false\n',
        "add persisted look preferences",
    )
    replace_once(
        path,
        '''\tlast_position = global_position\n\tprevious_grounded = is_on_floor()\n\tif not OS.has_feature("mobile"):\n''',
        '''\tlast_position = global_position\n\tprevious_grounded = is_on_floor()\n\t_load_menu_control_preferences()\n\tif not OS.has_feature("mobile"):\n''',
        "load menu control preferences",
    )
    replace_once(
        path,
        '''func _apply_look(delta: Vector2, sensitivity: float) -> void:\n\trotate_y(-delta.x * sensitivity)\n\tcamera_pitch = clamp(camera_pitch - delta.y * sensitivity, deg_to_rad(-55.0), deg_to_rad(48.0))\n\tcamera_pivot.rotation.x = camera_pitch\n''',
        '''func _apply_look(delta: Vector2, sensitivity: float) -> void:\n\tvar adjusted_sensitivity = sensitivity * look_sensitivity_multiplier\n\tvar vertical_sign = -1.0 if invert_look_y else 1.0\n\trotate_y(-delta.x * adjusted_sensitivity)\n\tcamera_pitch = clamp(camera_pitch - delta.y * adjusted_sensitivity * vertical_sign, deg_to_rad(-55.0), deg_to_rad(48.0))\n\tcamera_pivot.rotation.x = camera_pitch\n\nfunc set_look_preferences(multiplier: float, invert_y: bool) -> void:\n\tlook_sensitivity_multiplier = clamp(multiplier, 0.5, 1.8)\n\tinvert_look_y = invert_y\n\nfunc _load_menu_control_preferences() -> void:\n\tvar cfg = ConfigFile.new()\n\tif cfg.load("user://cuma_menu_preferences.cfg") != OK:\n\t\treturn\n\tset_look_preferences(\n\t\tfloat(cfg.get_value("controls", "look_sensitivity", 1.0)),\n\t\tbool(cfg.get_value("controls", "invert_y", false))\n\t)\n''',
        "apply sensitivity and invert-y preferences",
    )


def normalize_compat() -> None:
    for relative in [
        "scripts/ui/cinematic_menu_extras.gd",
        "scripts/ui/cinematic_main_menu.gd",
        "scripts/mobile_controls.gd",
        "scripts/player_controller.gd",
    ]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    assemble_extras()
    patch_menu()
    patch_mobile_controls()
    patch_player_controls()
    normalize_compat()
    print("CUMA CINEMATIC MENU EXTRAS PATCH: PASS")


if __name__ == "__main__":
    main()
