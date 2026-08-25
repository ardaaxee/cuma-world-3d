#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

PATCH = Path(__file__).with_name("apply_intelligence_stealth_70.py")


def normalize_definition(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        if old in text:
            raise SystemExit(f"INTEL70 PATCH PREP: both old and new definitions present for {label}")
        print(f"INTEL70 PATCH PREP: already normalized {label}")
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"INTEL70 PATCH PREP: expected 1 old definition for {label}, found {count}")
    print(f"INTEL70 PATCH PREP: normalized {label}")
    return text.replace(old, new, 1)


def main() -> None:
    text = PATCH.read_text(encoding="utf-8")

    old_keyboard = '''    replace_once(path, '\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', '\\tif Input.is_action_just_pressed("crouch"):\\n\\t\\ttoggle_crouch()\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', "keyboard crouch input")'''
    new_keyboard = '''    replace_once(path, '\\tif not is_on_floor():\\n\\t\\tvelocity.y -= gravity * delta\\n\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', '\\tif not is_on_floor():\\n\\t\\tvelocity.y -= gravity * delta\\n\\n\\tif Input.is_action_just_pressed("crouch"):\\n\\t\\ttoggle_crouch()\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', "keyboard crouch input in on-foot physics block")'''
    text = normalize_definition(text, old_keyboard, new_keyboard, "on-foot crouch input")

    # Character Overhaul 3.0 runs before Intelligence 7.0 and intentionally changes
    # the third-person pivot from 1.58m to 1.54m. Keep the newer cinematic base
    # height while layering crouch behavior, instead of requiring the obsolete value.
    old_camera = '''    replace_once(path, '\\t\\tcamera_pivot.position = Vector3(0.0, 1.58, 0.0)', '\\t\\tcamera_pivot.position = Vector3(0.0, 1.16 if crouched else 1.58, 0.0)', "third person crouch camera")'''
    new_camera = '''    replace_once(path, '\\t\\tcamera_pivot.position = Vector3(0.0, 1.54, 0.0)', '\\t\\tcamera_pivot.position = Vector3(0.0, 1.16 if crouched else 1.54, 0.0)', "third person crouch camera on Character 3.0 framing")'''
    text = normalize_definition(text, old_camera, new_camera, "Character 3.0 crouch camera")

    PATCH.write_text(text, encoding="utf-8")
    print("INTEL70 PATCH PREP: PASS")


if __name__ == "__main__":
    main()
