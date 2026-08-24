#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def fail(message: str) -> None:
    raise SystemExit(f"RUNTIME CONTRACT CHECK: FAIL: {message}")


def main() -> None:
    if not ROOT.is_dir():
        fail(f"missing extracted game directory: {ROOT}")

    dynamic = (ROOT / "scripts/city/dynamic_city_builder.gd").read_text(encoding="utf-8")
    crime = (ROOT / "scripts/city/crime_justice_builder.gd").read_text(encoding="utf-8")

    if 'var bus = AnimatableBody3D.new(); bus.name = "CityBus18"' not in dynamic:
        fail("CityBus18 must be instantiated as AnimatableBody3D")
    if 'var taxi = AnimatableBody3D.new(); taxi.name = "CityTaxi18"' not in dynamic:
        fail("CityTaxi18 must be instantiated as AnimatableBody3D")
    if 'var patrol_route: Array[Vector3]' not in crime or 'patrol.setup(patrol_route)' not in crime:
        fail("police patrol route must remain Array[Vector3]")
    if re.search(r"\bpatrol\.setup\(\s*\[", crime):
        fail("do not pass an untyped array literal directly to patrol_vehicle.setup")

    # Best-effort check for same-line native-node/script mismatches.
    bases: dict[str, str] = {}
    for script in ROOT.rglob("*.gd"):
        lines = script.read_text(encoding="utf-8").splitlines()
        if not lines:
            continue
        match = re.match(r"\s*extends\s+([A-Za-z0-9_]+)", lines[0])
        if match:
            bases[script.relative_to(ROOT).as_posix()] = match.group(1)

    problems: list[str] = []
    for script in ROOT.rglob("*.gd"):
        text = script.read_text(encoding="utf-8")
        preloads = {
            m.group(1): m.group(2)
            for m in re.finditer(r'const\s+(\w+)\s*=\s*preload\("res://([^\"]+\.gd)"\)', text)
        }
        for match in re.finditer(
            r"var\s+(\w+)\s*=\s*(\w+)\.new\(\)([^\n]*?)\1\.set_script\((\w+)\)",
            text,
        ):
            _var_name, created_type, _middle, preload_name = match.groups()
            target = preloads.get(preload_name)
            if not target:
                continue
            expected = bases.get(target)
            if expected and expected != created_type:
                line = text.count("\n", 0, match.start()) + 1
                problems.append(
                    f"{script.relative_to(ROOT)}:{line}: {created_type} + {target} (expects {expected})"
                )

    if problems:
        fail("native script mismatches:\n" + "\n".join(problems))

    print("RUNTIME CONTRACT CHECK: PASS")


if __name__ == "__main__":
    main()
