#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def main() -> None:
    if not ROOT.exists():
        raise SystemExit(f"game directory not found: {ROOT}")

    project = ROOT / "project.godot"
    if not project.is_file():
        raise SystemExit("project.godot not found after extraction")

    # Keep CI-side hotfixes centralized here so the source ZIP does not need
    # to be re-uploaded for every small parser/runtime correction.
    # Each future patch must be deterministic, idempotent, and fail loudly
    # when the expected source pattern is missing.
    print("CI patch layer ready: no source hotfixes currently required.")


if __name__ == "__main__":
    main()
