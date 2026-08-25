#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def main() -> None:
    path = ROOT / "scripts/city/dynamic_city_builder.gd"
    text = path.read_text(encoding="utf-8")
    for token in [
        'CUMA CITY CENTER • 5.2',
        'func _street_lamp(',
        'func _planter(',
        'Covered stop with glass side',
        'Crosswalks at the plaza approach',
        'Dark plinth, canopy and trim',
    ]:
        if token not in text:
            raise SystemExit(f"CITY52 CONTRACT missing {token!r}")
    print("CUMA CITY VISUAL 5.2 CONTRACT: PASS")


if __name__ == "__main__":
    main()
