#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"STARTUP65 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"STARTUP65 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"STARTUP65 APPLIED: {label}")


def patch_field_ops() -> None:
    path = ROOT / "scripts/ui/field_ops_runtime.gd"

    replace_once(
        path,
        'var external_track_index = -1\n',
        'var external_track_index = -1\nvar audio_ready = false\nvar audio_boot_pending = false\nvar external_music_scanned = false\n',
        "track deferred audio boot state",
    )

    replace_once(
        path,
        '''\t_load_preferences()\n\t_build_audio_runtime()\n\t_discover_external_music()\n\t_set_music_context("MENU")\n\tset_process(true)''',
        '''\t_load_preferences()\n\taudio_boot_pending = true\n\tcall_deferred("_finish_audio_boot")\n\tset_process(true)''',
        "defer audio and music scanning until first frames render",
    )

    anchor = 'func on_gameplay_started() -> void:\n'
    helper = '''func _finish_audio_boot() -> void:\n\tif audio_ready:\n\t\taudio_boot_pending = false\n\t\treturn\n\t# Give Android two complete frames before allocating PCM buffers / audio buses.\n\tawait get_tree().process_frame\n\tawait get_tree().process_frame\n\t_build_audio_runtime()\n\taudio_ready = true\n\taudio_boot_pending = false\n\t_set_music_context("MENU")\n\nfunc _ensure_external_music_scanned() -> void:\n\tif external_music_scanned:\n\t\treturn\n\texternal_music_scanned = true\n\t_discover_external_music()\n\n'''
    text = path.read_text(encoding="utf-8")
    if helper not in text:
        if text.count(anchor) != 1:
            raise SystemExit("STARTUP65 field ops helper anchor missing")
        path.write_text(text.replace(anchor, helper + anchor, 1), encoding="utf-8")
        print("STARTUP65 APPLIED: add deferred audio boot helpers")

    replace_once(
        path,
        '''func _set_music_context(context: String) -> void:\n\tif current_music_context == context and music_player != null and music_player.playing:''',
        '''func _set_music_context(context: String) -> void:\n\tif not audio_ready:\n\t\tcurrent_music_context = context\n\t\treturn\n\tif current_music_context == context and music_player != null and music_player.playing:''',
        "guard adaptive music before audio boot",
    )

    replace_once(
        path,
        '''func _play_field_sfx(frequency: float, seconds: float, gain: float) -> void:\n\tif field_sfx_player == null:''',
        '''func _play_field_sfx(frequency: float, seconds: float, gain: float) -> void:\n\tif not audio_ready or field_sfx_player == null:''',
        "guard field sfx before audio boot",
    )

    replace_once(
        path,
        '''func _next_music() -> void:\n\tif external_tracks.size() > 0:''',
        '''func _next_music() -> void:\n\t_ensure_external_music_scanned()\n\tif not audio_ready:\n\t\tcall_deferred("_finish_audio_boot")\n\t\treturn\n\tif external_tracks.size() > 0:''',
        "scan custom music only on demand",
    )

    replace_once(
        path,
        '''func _toggle_music_center() -> void:\n\tif music_overlay != null:''',
        '''func _toggle_music_center() -> void:\n\t_ensure_external_music_scanned()\n\tif not audio_ready and not audio_boot_pending:\n\t\taudio_boot_pending = true\n\t\tcall_deferred("_finish_audio_boot")\n\tif music_overlay != null:''',
        "lazy-scan custom music from Music Center",
    )

    replace_once(path, '\tvar seconds = 8.0\n', '\tvar seconds = 4.0\n', "halve procedural music startup buffer")
    replace_once(path, '\tvar seconds = 5.0\n', '\tvar seconds = 3.0\n', "reduce ambience startup buffer")


def patch_menu() -> None:
    path = ROOT / "scripts/ui/cinematic_main_menu.gd"

    replace_once(
        path,
        '''\t_build_menu_camera()\n\t_build_menu_character()\n\t_build_ui_shell()''',
        '''\t_build_menu_camera()\n\t# High-detail character is intentionally lazy-loaded only for CHARACTER.\n\t_build_ui_shell()''',
        "avoid high-detail character allocation on app launch",
    )

    replace_once(
        path,
        '''\tif state == MenuState.TRANSITION_TO_GAME or state == MenuState.PLAYING:\n\t\treturn\n\tstate = next_state\n\t_rebuild_ui()''',
        '''\tif state == MenuState.TRANSITION_TO_GAME or state == MenuState.PLAYING:\n\t\treturn\n\tif next_state == MenuState.CHARACTER and menu_character == null:\n\t\t_build_menu_character()\n\tif menu_character != null:\n\t\tmenu_character.visible = next_state == MenuState.CHARACTER\n\tstate = next_state\n\t_rebuild_ui()''',
        "lazy-load and hide menu character outside character screen",
    )


def normalize() -> None:
    for relative in ["scripts/ui/field_ops_runtime.gd", "scripts/ui/cinematic_main_menu.gd"]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    patch_field_ops()
    patch_menu()
    normalize()
    print("CUMA PRE-RELEASE STARTUP STABILITY 6.5: PASS")


if __name__ == "__main__":
    main()
