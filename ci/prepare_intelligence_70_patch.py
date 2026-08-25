#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

PATCH = Path(__file__).with_name("apply_intelligence_stealth_70.py")


def main() -> None:
    text = PATCH.read_text(encoding="utf-8")
    old = '''    replace_once(path, '\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', '\\tif Input.is_action_just_pressed("crouch"):\\n\\t\\ttoggle_crouch()\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', "keyboard crouch input")'''
    new = '''    replace_once(path, '\\tif not is_on_floor():\\n\\t\\tvelocity.y -= gravity * delta\\n\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', '\\tif not is_on_floor():\\n\\t\\tvelocity.y -= gravity * delta\\n\\n\\tif Input.is_action_just_pressed("crouch"):\\n\\t\\ttoggle_crouch()\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', "keyboard crouch input in on-foot physics block")'''
    if new in text and old not in text:
        print("INTEL70 PATCH PREP: already deterministic")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"INTEL70 PATCH PREP: expected 1 old crouch patch definition, found {count}")
    PATCH.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("INTEL70 PATCH PREP: PASS")


if __name__ == "__main__":
    main()
