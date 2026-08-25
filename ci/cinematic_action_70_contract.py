#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"

CHECKS = {
    "scripts/action/cinematic_action_runtime.gd": [
        'add_to_group("cinematic_action_system")',
        'func q_lens_mark_nearest()',
        'func request_cover()',
        'func contextual_action()',
        '"FLEE"',
        '"SURRENDER"',
        '"STAGGERED"',
        'func get_visibility_multiplier()',
        'func get_field_summary()',
    ],
    "scripts/action/cinematic_action_hud.gd": [
        '"ACTION 7.0"',
        '"Q-LENS"',
        '"SİPER"',
        '"TAKTİK"',
    ],
    "scripts/intelligence/intelligence_stealth_builder.gd": [
        'CinematicActionRuntimeScript',
        'CinematicActionHUDScript',
        'action_runtime.setup()',
        'action_hud.setup(action_runtime)',
    ],
    "scripts/stealth/awareness_system.gd": [
        'cinematic_action_system',
        'get_visibility_multiplier',
    ],
    "scripts/intelligence/mission_system.gd": [
        'func report_cinematic_action',
        'func _approach_for_result',
        '"approach": _approach_for_result()',
        '"spycraft_events"',
        '"action_events"',
    ],
}


def main() -> None:
    failures: list[str] = []
    for relative, tokens in CHECKS.items():
        path = ROOT / relative
        if not path.exists():
            failures.append(f"missing {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                failures.append(f"{relative}: missing {token}")
    if failures:
        raise SystemExit("ACTION70 CONTRACT FAIL:\n" + "\n".join(failures))
    print("CUMA CINEMATIC ACTION 7.0 CONTRACT: PASS")


if __name__ == "__main__":
    main()
