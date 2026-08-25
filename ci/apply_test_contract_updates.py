#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"TEST CONTRACT ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"TEST CONTRACT APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    production_test = ROOT / "tests" / "production_rebuild_smoke.py"
    replace_exact(
        production_test,
        "assert 'first_person = true' in player",
        "assert 'first_person = true' in player\n"
        "assert 'Vector3.ONE * 0.340030' in player\n"
        "assert 'rotation_degrees.y = 180.0' in player",
        "keep first-person default and add audited live-rig scale/yaw contracts",
    )

    print("CUMA TEST CONTRACT UPDATE: PASS")


if __name__ == "__main__":
    main()
