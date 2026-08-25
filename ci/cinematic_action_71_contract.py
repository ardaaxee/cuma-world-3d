#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"

CHECKS = {
    "scripts/action/cinematic_action_runtime.gd": [
        'name = "CinematicAction71"',
        'const COVER_DISTANCE = 3.1',
        'func get_cover_status()',
        'func _nearest_cover(',
        '"action_cover_point"',
        'func _build_mark_label(',
        '"QLensMark71"',
        'func _update_npc_state_label(',
        '"SURRENDER"',
        '"STAGGERED"',
        '"FLEE"',
        'bool(npc.get_meta("action_enabled", false))',
    ],
    "scripts/action/cinematic_action_hud.gd": [
        '"ACTION 7.1 · FIELD CONTROL"',
        '"Q-LENS"',
        '"SİPER"',
        '"TAKTİK"',
        'func _open_debrief(',
        '"CUMA WORLD · FIELD DEBRIEF"',
        '"GÖREV TAMAMLANDI"',
        '"SAHAYA DÖN"',
    ],
    "scripts/intelligence/intelligence_stealth_builder.gd": [
        'func _build_action_71_environment()',
        'func _cover_point(',
        '"MarketCoverFront71"',
        '"MarketCoverSide71"',
        '"MarketCoverCounter71"',
        '"action_enabled"',
        '"SAHA GÖZCÜSÜ %02d"',
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
        raise SystemExit("ACTION71 CONTRACT FAIL:\n" + "\n".join(failures))
    print("CUMA CINEMATIC ACTION 7.1 CONTRACT: PASS")


if __name__ == "__main__":
    main()
