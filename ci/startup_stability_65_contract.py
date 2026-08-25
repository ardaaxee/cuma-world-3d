#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"STARTUP65 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/ui/field_ops_runtime.gd", [
        'var audio_ready = false',
        'call_deferred("_finish_audio_boot")',
        'func _finish_audio_boot() -> void:',
        'func _ensure_external_music_scanned() -> void:',
        'if not audio_ready:',
        'var seconds = 4.0',
        'var seconds = 3.0',
    ])
    require(ROOT / "scripts/ui/cinematic_main_menu.gd", [
        'High-detail character is intentionally lazy-loaded only for CHARACTER.',
        'if next_state == MenuState.CHARACTER and menu_character == null:',
        'menu_character.visible = next_state == MenuState.CHARACTER',
    ])
    print("CUMA PRE-RELEASE STARTUP STABILITY 6.5 CONTRACT: PASS")


if __name__ == "__main__":
    main()
