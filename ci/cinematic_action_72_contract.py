#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"

CHECKS = {
    "scripts/action/cinematic_action_runtime.gd": [
        'name = "CinematicAction72"',
        'func scan_opportunity()',
        '"action_opportunity"',
        '"action_chase_node"',
        'func _dispatch_chase_routes()',
        'func _best_chase_node(',
        '"opportunity_events"',
        'QOpportunity72',
    ],
    "scripts/action/cinematic_action_hud.gd": [
        '"ACTION 7.2 · FIELD CONTROL"',
        '"FIRSAT"',
        'func _show_mission_intro()',
        '"CUMA WORLD · FIELD ASSIGNMENT"',
        'CUMA WORLD · FIELD DEBRIEF 7.2',
        'SAHA İMZASI ·',
        'func _field_signature(',
    ],
    "scripts/intelligence/intelligence_stealth_builder.gd": [
        'func _build_action_72_environment()',
        'func _opportunity(',
        'func _chase_node(',
        '"action_opportunity"',
        '"action_chase_node"',
        'MarketOpportunityRoute72',
        'MarketChaseF72',
    ],
    "scripts/intelligence/mission_system.gd": [
        '"SPYCRAFT_OPPORTUNITY"',
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
        raise SystemExit("ACTION72 CONTRACT FAIL:\n" + "\n".join(failures))
    print("CUMA CINEMATIC ACTION 7.2 CONTRACT: PASS")


if __name__ == "__main__":
    main()
