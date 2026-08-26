#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"FIELDOPS60 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FIELDOPS60 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"FIELDOPS60 APPLIED: {label}")


def patch_menu_extras() -> None:
    path = ROOT / "scripts/ui/cinematic_menu_extras.gd"

    replace_once(
        path,
        'const PANEL := Color(0.018, 0.021, 0.026, 0.94)\n',
        'const PANEL := Color(0.018, 0.021, 0.026, 0.94)\nconst FieldOpsRuntime = preload("res://scripts/ui/field_ops_runtime.gd")\n',
        "preload Field Ops runtime",
    )

    replace_once(
        path,
        'var transition_player: AudioStreamPlayer\n',
        'var transition_player: AudioStreamPlayer\nvar field_ops: Node\n',
        "retain Field Ops runtime",
    )

    replace_once(
        path,
        '\t_load_preferences()\n\t_build_ui_audio()\n\t_apply_master_volume()\n',
        '\t_load_preferences()\n\t_build_ui_audio()\n\t_build_field_ops_runtime()\n\t_apply_master_volume()\n',
        "start Field Ops audio and menu runtime",
    )

    replace_once(
        path,
        'func _process(delta: float) -> void:\n',
        '''func _build_field_ops_runtime() -> void:\n\tif field_ops != null:\n\t\treturn\n\tfield_ops = Node.new()\n\tfield_ops.name = "FieldOpsRuntime"\n\tfield_ops.set_script(FieldOpsRuntime)\n\tadd_child(field_ops)\n\tfield_ops.call("setup", self, menu_root)\n\nfunc _process(delta: float) -> void:\n''',
        "add Field Ops runtime builder",
    )

    replace_once(
        path,
        '''\telif current_state == STATE_SETTINGS:\n\t\t_build_settings_override(safe)\n\t_hook_menu_controls()\n''',
        '''\telif current_state == STATE_SETTINGS:\n\t\t_build_settings_override(safe)\n\tif field_ops != null:\n\t\tfield_ops.call("decorate_menu_state", safe, current_state)\n\t_hook_menu_controls()\n''',
        "decorate menu with Field Ops status card",
    )

    replace_once(
        path,
        '''\t_apply_player_preferences()\n\tif pause_overlay != null:\n''',
        '''\t_apply_player_preferences()\n\tif field_ops != null:\n\t\tfield_ops.call("on_gameplay_started")\n\tif pause_overlay != null:\n''',
        "activate Field Ops left HUD in gameplay",
    )

    replace_once(
        path,
        '''\tmenu_root.set("state", STATE_PAUSED)\n\t_build_pause_overlay()\n''',
        '''\tmenu_root.set("state", STATE_PAUSED)\n\tif field_ops != null:\n\t\tfield_ops.call("on_pause_changed", true)\n\t_build_pause_overlay()\n''',
        "duck Field Ops audio while paused",
    )

    replace_once(
        path,
        '''\t_set_gameplay_hud_visible(true)\n\tmenu_root.set("state", STATE_PLAYING)\n''',
        '''\t_set_gameplay_hud_visible(true)\n\tmenu_root.set("state", STATE_PLAYING)\n\tif field_ops != null:\n\t\tfield_ops.call("on_pause_changed", false)\n''',
        "resume Field Ops audio and HUD",
    )


def normalize() -> None:
    for relative in [
        "scripts/ui/cinematic_menu_extras.gd",
        "scripts/ui/field_ops_runtime.gd",
    ]:
        path = ROOT / relative
        if not path.is_file():
            raise SystemExit(f"FIELDOPS60 missing runtime file: {relative}")
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    if not (ROOT / "project.godot").is_file():
        raise SystemExit("FIELDOPS60: game/project.godot missing")
    patch_menu_extras()
    normalize()
    print("CUMA FIELD OPS 6.0 AUDIO/MUSIC/HUD: PASS")


if __name__ == "__main__":
    main()
