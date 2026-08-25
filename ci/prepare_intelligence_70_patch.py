#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

PATCH = Path(__file__).with_name("apply_intelligence_stealth_70.py")


def main() -> None:
    text = PATCH.read_text(encoding="utf-8")
    changed = False

    old_crouch = '''    replace_once(path, '\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', '\\tif Input.is_action_just_pressed("crouch"):\\n\\t\\ttoggle_crouch()\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', "keyboard crouch input")'''
    new_crouch = '''    replace_once(path, '\\tif not is_on_floor():\\n\\t\\tvelocity.y -= gravity * delta\\n\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', '\\tif not is_on_floor():\\n\\t\\tvelocity.y -= gravity * delta\\n\\n\\tif Input.is_action_just_pressed("crouch"):\\n\\t\\ttoggle_crouch()\\n\\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', "keyboard crouch input in on-foot physics block")'''
    if old_crouch in text:
        if text.count(old_crouch) != 1:
            raise SystemExit("INTEL70 PATCH PREP: ambiguous old crouch patch definition")
        text = text.replace(old_crouch, new_crouch, 1)
        changed = True
    elif new_crouch not in text:
        raise SystemExit("INTEL70 PATCH PREP: crouch patch definition not recognized")

    # Character 3.0 moved the standing third-person pivot from 1.58 to 1.54.
    # Keep Intelligence 7.0's crouch support while preserving that newer framing.
    old_camera = '''    replace_once(path, '\\t\\tcamera_pivot.position = Vector3(0.0, 1.58, 0.0)', '\\t\\tcamera_pivot.position = Vector3(0.0, 1.16 if crouched else 1.58, 0.0)', "third person crouch camera")'''
    new_camera = '''    replace_once(path, '\\t\\tcamera_pivot.position = Vector3(0.0, 1.54, 0.0)', '\\t\\tcamera_pivot.position = Vector3(0.0, 1.16 if crouched else 1.54, 0.0)', "third person crouch camera")'''
    if old_camera in text:
        if text.count(old_camera) != 1:
            raise SystemExit("INTEL70 PATCH PREP: ambiguous legacy third-person camera patch definition")
        text = text.replace(old_camera, new_camera, 1)
        changed = True
    elif new_camera not in text:
        raise SystemExit("INTEL70 PATCH PREP: third-person camera patch definition not recognized")

    if changed:
        PATCH.write_text(text, encoding="utf-8")
        print("INTEL70 PATCH PREP: PASS")
    else:
        print("INTEL70 PATCH PREP: already deterministic and Character 3.0 compatible")


if __name__ == "__main__":
    main()
