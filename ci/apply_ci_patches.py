#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"PATCH ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"PATCH APPLIED: {label}")


def main() -> None:
    if not ROOT.exists():
        raise SystemExit(f"game directory not found: {ROOT}")

    project = ROOT / "project.godot"
    if not project.is_file():
        raise SystemExit("project.godot not found after extraction")

    mobile = ROOT / "scripts" / "mobile_controls.gd"
    replace_exact(
        mobile,
        "\tvar together_button = _make_top_button(\"2P\", -184.0)\n\t\ttogether_button.pressed.connect(_on_toggle_together)\n\troot.add_child(together_button)",
        "\tvar together_button = _make_top_button(\"2P\", -184.0)\n\ttogether_button.pressed.connect(_on_toggle_together)\n\troot.add_child(together_button)",
        "mobile_controls.gd unexpected indentation",
    )

    presets = ROOT / "export_presets.cfg"
    replace_exact(
        presets,
        'gradle_build/min_sdk="24"\ngradle_build/target_sdk="35"\n',
        '',
        "remove Min/Target SDK overrides when Gradle build is disabled",
    )

    replace_exact(
        project,
        'renderer/rendering_method.mobile="gl_compatibility"\ntextures/default_filters/use_nearest_mipmap_filter=false',
        'renderer/rendering_method.mobile="gl_compatibility"\ntextures/vram_compression/import_etc2_astc=true\ntextures/default_filters/use_nearest_mipmap_filter=false',
        "enable ETC2/ASTC texture import for Android export",
    )

    print("CI patch layer complete.")


if __name__ == "__main__":
    main()
