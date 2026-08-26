#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"FIELDUI63 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/ui/field_ops_runtime.gd", [
        'actions = GridContainer.new()',
        'actions.columns = 2',
        '"KİMLİK"',
        '"ARAÇLAR"',
        'FieldOpsTools',
        '"KAYDET", "SAVE"',
        '"KAMERA", "CAM"',
        '"FOTO MODU", "FOTO"',
        '"GÖRSEL FX", "FX"',
        '"OMUZ / 2P", "2P"',
        'func _on_cover_identity() -> void:',
        'AJAN DEĞERLENDİRMESİ',
        'func _field_grade() -> String:',
    ])
    print("CUMA FIELD OPS UI 6.3 CONTRACT: PASS")


if __name__ == "__main__":
    main()
