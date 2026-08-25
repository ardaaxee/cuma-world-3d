#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"MUSIC64 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/ui/field_ops_runtime.gd", [
        'CumaMusicCenter',
        'MÜZİK MERKEZİ',
        'DİNAMİK OYUN MÜZİĞİ',
        'ÖZEL / LİSANSLI PARÇA',
        'func _previous_music() -> void:',
        'func _toggle_music_playback() -> void:',
        'func _resume_dynamic_music() -> void:',
        'func _on_music_center_volume_changed(value: float, label: Label) -> void:',
        'music.pressed.connect(_toggle_music_center)',
    ])
    print("CUMA MUSIC CENTER 6.4 CONTRACT: PASS")


if __name__ == "__main__":
    main()
