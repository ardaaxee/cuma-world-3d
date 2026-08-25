#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"
OLD = 'SAVE_PATH := "user://cuma_world_save_v19.cfg"'
NEW = 'SAVE_PATH := "user://cuma_world_save_v70.cfg"'


def main() -> None:
    tests_dir = ROOT / "tests"
    if not tests_dir.is_dir():
        raise SystemExit(f"tests directory not found: {tests_dir}")

    changed: list[str] = []
    for path in sorted(tests_dir.glob("*.py")):
        text = path.read_text(encoding="utf-8")
        if OLD not in text:
            continue
        path.write_text(text.replace(OLD, NEW), encoding="utf-8")
        changed.append(path.name)

    # Intelligence 7.0 owns the current save version. It is valid for older test
    # suites not to mention v19 at all, but if they do, that assertion is stale.
    if changed:
        print("REGRESSION CONTRACT UPDATE: Intelligence 7.0 save path -> " + ", ".join(changed))
    else:
        print("REGRESSION CONTRACT UPDATE: save contracts already current")


if __name__ == "__main__":
    main()
