#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def require(path: Path, tokens: list[str]) -> None:
    if not path.is_file():
        raise SystemExit(f"FIELDOPS60 CONTRACT missing file: {path.relative_to(ROOT)}")
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"FIELDOPS60 CONTRACT missing {token!r} in {path.relative_to(ROOT)}")


def main() -> None:
    require(ROOT / "scripts/ui/field_ops_runtime.gd", [
        'FIELD_OPS_VERSION = "6.0"',
        'FieldOpsLeftHUD',
        'GÖZLEM',
        'ODAK',
        'BLÖF',
        'AYGIT',
        'DOSYA',
        'MÜZİK',
        'SİNYAL TARAYICI',
        'KAMERA DÖNGÜSÜ',
        'AKILLI ANAHTAR',
        'DİKKAT DAĞITICI',
        '_suppress_legacy_top_hud',
        '"MENÜ", "SAVE", "OBS", "CAM", "EK", "FX", "2P", "FOTO"',
        'NOIR SIGNAL',
        'QUIET FREQUENCY',
        'SAFEHOUSE AFTERGLOW',
        'NIGHT EXPLORATION',
        'AudioStreamOggVorbis.load_from_file',
        'user://music',
    ])
    require(ROOT / "scripts/ui/cinematic_menu_extras.gd", [
        'FieldOpsRuntime = preload("res://scripts/ui/field_ops_runtime.gd")',
        'func _build_field_ops_runtime() -> void:',
        'field_ops.call("on_gameplay_started")',
        'field_ops.call("decorate_menu_state", safe, current_state)',
        'field_ops.call("on_pause_changed", true)',
        'field_ops.call("on_pause_changed", false)',
    ])
    print("CUMA FIELD OPS 6.0 CONTRACT: PASS")


if __name__ == "__main__":
    main()
