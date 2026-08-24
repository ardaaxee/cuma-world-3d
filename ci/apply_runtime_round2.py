#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"RUNTIME ROUND2 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"RUNTIME ROUND2 APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    installer = Path(__file__).with_name("install_character_assets.py")
    if not installer.is_file():
        raise SystemExit("missing ci/install_character_assets.py")
    subprocess.run([sys.executable, str(installer)], check=True)

    for name in ("cuma.glb", "partner.glb"):
        target = ROOT / "assets" / "characters" / name
        if not target.is_file() or target.stat().st_size != 698560:
            raise SystemExit(f"installed character asset invalid: {target}")

    relationship = ROOT / "scripts" / "social" / "relationship_citizen.gd"

    # GDScript's conditional expression returns an untyped Array here. Assigning
    # that value to Array[Vector3] fails only when NPC Intelligence schedules a
    # meetup, so parser/import checks alone cannot catch it.
    replace_exact(
        relationship,
        '\tactive_route = [entry, ai_target] if entry != Vector3.ZERO and entry.distance_to(ai_target) > 0.8 else [ai_target]',
        '''\tactive_route.clear()
\tif entry != Vector3.ZERO and entry.distance_to(ai_target) > 0.8:
\t\tactive_route.append(entry)
\tactive_route.append(ai_target)''',
        "preserve Array[Vector3] typing in relationship NPC AI plan routes",
    )

    print("CUMA RUNTIME ROUND2 PATCH: PASS")


if __name__ == "__main__":
    main()
