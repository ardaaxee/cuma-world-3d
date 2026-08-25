#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"HUD62 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/ui/field_ops_runtime.gd", [
        '"TELEFON"',
        '"PHONE"',
        'func _on_phone() -> void:',
        '"SESSİZ TESLİMAT" in value',
        'value.begins_with("HAVA")',
        'find_children("*", "RichTextLabel", true, false)',
        '"BRIEFING" in value',
        'hidden_button_texts = ["MENÜ", "SAVE", "OBS", "CAM", "EK", "FX", "2P", "FOTO", "PHONE"]',
        'is_ancestor_of(node)',
    ])
    print("CUMA HUD CLEANUP 6.2 CONTRACT: PASS")


if __name__ == "__main__":
    main()
