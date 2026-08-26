#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"AUDIOMIX61 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/ui/field_ops_runtime.gd", [
        'CUMA_MUSIC',
        'CUMA_AMBIENCE',
        'CUMA_FIELD_SFX',
        'func set_music_volume(value: float) -> void:',
        'func set_ambience_volume(value: float) -> void:',
        'func set_field_sfx_volume(value: float) -> void:',
        '"ambience_volume"',
        '"field_sfx_volume"',
    ])
    require(ROOT / "scripts/ui/cinematic_menu_extras.gd", [
        'MÜZİK SESİ',
        'AMBIYANS',
        'FIELD SFX',
        'func _on_field_music_toggled(enabled: bool) -> void:',
        'func _on_field_ambience_volume_changed(value: float, label: Label) -> void:',
        'func _on_field_sfx_volume_changed(value: float, label: Label) -> void:',
    ])
    print("CUMA AUDIO MIX 6.1 CONTRACT: PASS")


if __name__ == "__main__":
    main()
