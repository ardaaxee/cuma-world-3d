#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"AUDIOMIX61 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"AUDIOMIX61 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"AUDIOMIX61 APPLIED: {label}")


def patch_runtime() -> None:
    path = ROOT / "scripts/ui/field_ops_runtime.gd"
    replace_once(
        path,
        'var music_enabled = true\nvar music_volume = 0.46\n',
        'var music_enabled = true\nvar music_volume = 0.46\nvar ambience_volume = 0.34\nvar field_sfx_volume = 0.72\n',
        "add independent audio channel preferences",
    )
    replace_once(
        path,
        '''func _build_audio_runtime() -> void:\n\tmusic_player = AudioStreamPlayer.new()''',
        '''func _build_audio_runtime() -> void:\n\t_ensure_audio_bus("CUMA_MUSIC")\n\t_ensure_audio_bus("CUMA_AMBIENCE")\n\t_ensure_audio_bus("CUMA_FIELD_SFX")\n\tmusic_player = AudioStreamPlayer.new()''',
        "create dedicated audio buses",
    )
    replace_once(
        path,
        '''\tmusic_player.name = "AdaptiveMusic"\n\tmusic_player.process_mode = Node.PROCESS_MODE_ALWAYS\n\tadd_child(music_player)''',
        '''\tmusic_player.name = "AdaptiveMusic"\n\tmusic_player.process_mode = Node.PROCESS_MODE_ALWAYS\n\tmusic_player.bus = "CUMA_MUSIC"\n\tadd_child(music_player)''',
        "route adaptive music bus",
    )
    replace_once(
        path,
        '''\tambience_player.name = "WorldAmbience"\n\tambience_player.process_mode = Node.PROCESS_MODE_ALWAYS\n\tambience_player.stream = _make_ambient_stream()\n\tambience_player.volume_db = -28.0\n\tadd_child(ambience_player)''',
        '''\tambience_player.name = "WorldAmbience"\n\tambience_player.process_mode = Node.PROCESS_MODE_ALWAYS\n\tambience_player.bus = "CUMA_AMBIENCE"\n\tambience_player.stream = _make_ambient_stream()\n\tambience_player.volume_db = _ambience_db()\n\tadd_child(ambience_player)''',
        "route world ambience bus",
    )
    replace_once(
        path,
        '''\tfield_sfx_player.name = "FieldOpsSFX"\n\tfield_sfx_player.process_mode = Node.PROCESS_MODE_ALWAYS\n\tfield_sfx_player.volume_db = -10.0\n\tadd_child(field_sfx_player)''',
        '''\tfield_sfx_player.name = "FieldOpsSFX"\n\tfield_sfx_player.process_mode = Node.PROCESS_MODE_ALWAYS\n\tfield_sfx_player.bus = "CUMA_FIELD_SFX"\n\tfield_sfx_player.volume_db = _field_sfx_db()\n\tadd_child(field_sfx_player)''',
        "route Field Ops SFX bus",
    )
    replace_once(
        path,
        '''func toggle_music() -> void:\n\tmusic_enabled = not music_enabled''',
        '''func _ensure_audio_bus(bus_name: String) -> void:\n\tif AudioServer.get_bus_index(bus_name) >= 0:\n\t\treturn\n\tAudioServer.add_bus()\n\tvar index = AudioServer.bus_count - 1\n\tAudioServer.set_bus_name(index, bus_name)\n\nfunc is_music_enabled() -> bool:\n\treturn music_enabled\n\nfunc get_music_volume() -> float:\n\treturn music_volume\n\nfunc get_ambience_volume() -> float:\n\treturn ambience_volume\n\nfunc get_field_sfx_volume() -> float:\n\treturn field_sfx_volume\n\nfunc toggle_music() -> void:\n\tmusic_enabled = not music_enabled''',
        "add bus and settings query API",
    )
    replace_once(
        path,
        '''func set_music_volume(value: float) -> void:\n\tmusic_volume = clamp(value, 0.0, 1.0)\n\tif music_player != null:\n\t\tmusic_player.volume_db = _music_db()\n\t_save_preferences()\n''',
        '''func set_music_volume(value: float) -> void:\n\tmusic_volume = clamp(value, 0.0, 1.0)\n\tif music_player != null:\n\t\tmusic_player.volume_db = _music_db()\n\t_save_preferences()\n\nfunc set_ambience_volume(value: float) -> void:\n\tambience_volume = clamp(value, 0.0, 1.0)\n\tif ambience_player != null:\n\t\tambience_player.volume_db = _ambience_db()\n\t_save_preferences()\n\nfunc set_field_sfx_volume(value: float) -> void:\n\tfield_sfx_volume = clamp(value, 0.0, 1.0)\n\tif field_sfx_player != null:\n\t\tfield_sfx_player.volume_db = _field_sfx_db()\n\t_save_preferences()\n''',
        "add ambience and Field SFX setters",
    )
    replace_once(
        path,
        '''func _music_db() -> float:\n\treturn linear_to_db(max(music_volume, 0.0001)) - 5.0\n''',
        '''func _music_db() -> float:\n\treturn linear_to_db(max(music_volume, 0.0001)) - 5.0\n\nfunc _ambience_db() -> float:\n\treturn linear_to_db(max(ambience_volume, 0.0001)) - 15.0\n\nfunc _field_sfx_db() -> float:\n\treturn linear_to_db(max(field_sfx_volume, 0.0001)) - 7.0\n''',
        "add channel gain curves",
    )
    replace_once(
        path,
        '''\tmusic_enabled = bool(prefs.get_value("audio", "music_enabled", true))\n\tmusic_volume = clamp(float(prefs.get_value("audio", "music_volume", 0.46)), 0.0, 1.0)''',
        '''\tmusic_enabled = bool(prefs.get_value("audio", "music_enabled", true))\n\tmusic_volume = clamp(float(prefs.get_value("audio", "music_volume", 0.46)), 0.0, 1.0)\n\tambience_volume = clamp(float(prefs.get_value("audio", "ambience_volume", 0.34)), 0.0, 1.0)\n\tfield_sfx_volume = clamp(float(prefs.get_value("audio", "field_sfx_volume", 0.72)), 0.0, 1.0)''',
        "load channel volumes",
    )
    replace_once(
        path,
        '''\tprefs.set_value("audio", "music_enabled", music_enabled)\n\tprefs.set_value("audio", "music_volume", music_volume)\n\tprefs.save(PREF_PATH)''',
        '''\tprefs.set_value("audio", "music_enabled", music_enabled)\n\tprefs.set_value("audio", "music_volume", music_volume)\n\tprefs.set_value("audio", "ambience_volume", ambience_volume)\n\tprefs.set_value("audio", "field_sfx_volume", field_sfx_volume)\n\tprefs.save(PREF_PATH)''',
        "save channel volumes",
    )


def patch_settings() -> None:
    path = ROOT / "scripts/ui/cinematic_menu_extras.gd"
    old = '''\tui_volume.value_changed.connect(_on_ui_sfx_changed.bind(ui_label))\n\tbox.add_child(ui_volume)\n\tbox.add_child(_section("KONTROLLER"))'''
    new = '''\tui_volume.value_changed.connect(_on_ui_sfx_changed.bind(ui_label))\n\tbox.add_child(ui_volume)\n\tif field_ops != null:\n\t\tvar music_toggle = _toggle("MÜZİK", bool(field_ops.call("is_music_enabled")))\n\t\tmusic_toggle.toggled.connect(_on_field_music_toggled)\n\t\tbox.add_child(music_toggle)\n\t\tvar music_label = _label("MÜZİK SESİ  ·  %d%%" % int(round(float(field_ops.call("get_music_volume")) * 100.0)), 12, TEXT)\n\t\tbox.add_child(music_label)\n\t\tvar music_slider = HSlider.new()\n\t\tmusic_slider.min_value = 0.0\n\t\tmusic_slider.max_value = 100.0\n\t\tmusic_slider.step = 1.0\n\t\tmusic_slider.value = float(field_ops.call("get_music_volume")) * 100.0\n\t\tmusic_slider.custom_minimum_size.y = 38\n\t\tmusic_slider.value_changed.connect(_on_field_music_volume_changed.bind(music_label))\n\t\tbox.add_child(music_slider)\n\t\tvar ambience_label = _label("AMBIYANS  ·  %d%%" % int(round(float(field_ops.call("get_ambience_volume")) * 100.0)), 12, TEXT)\n\t\tbox.add_child(ambience_label)\n\t\tvar ambience_slider = HSlider.new()\n\t\tambience_slider.min_value = 0.0\n\t\tambience_slider.max_value = 100.0\n\t\tambience_slider.step = 1.0\n\t\tambience_slider.value = float(field_ops.call("get_ambience_volume")) * 100.0\n\t\tambience_slider.custom_minimum_size.y = 38\n\t\tambience_slider.value_changed.connect(_on_field_ambience_volume_changed.bind(ambience_label))\n\t\tbox.add_child(ambience_slider)\n\t\tvar field_label = _label("FIELD SFX  ·  %d%%" % int(round(float(field_ops.call("get_field_sfx_volume")) * 100.0)), 12, TEXT)\n\t\tbox.add_child(field_label)\n\t\tvar field_slider = HSlider.new()\n\t\tfield_slider.min_value = 0.0\n\t\tfield_slider.max_value = 100.0\n\t\tfield_slider.step = 1.0\n\t\tfield_slider.value = float(field_ops.call("get_field_sfx_volume")) * 100.0\n\t\tfield_slider.custom_minimum_size.y = 38\n\t\tfield_slider.value_changed.connect(_on_field_sfx_volume_changed.bind(field_label))\n\t\tbox.add_child(field_slider)\n\tbox.add_child(_section("KONTROLLER"))'''
    replace_once(path, old, new, "add audio mixer controls to settings")

    anchor = 'func _on_look_sensitivity_changed(value: float, label: Label) -> void:\n'
    helpers = '''func _on_field_music_toggled(enabled: bool) -> void:\n\tif field_ops == null:\n\t\treturn\n\tif bool(field_ops.call("is_music_enabled")) != enabled:\n\t\tfield_ops.call("toggle_music")\n\nfunc _on_field_music_volume_changed(value: float, label: Label) -> void:\n\tif field_ops == null:\n\t\treturn\n\tfield_ops.call("set_music_volume", value / 100.0)\n\tlabel.text = "MÜZİK SESİ  ·  %d%%" % int(round(value))\n\nfunc _on_field_ambience_volume_changed(value: float, label: Label) -> void:\n\tif field_ops == null:\n\t\treturn\n\tfield_ops.call("set_ambience_volume", value / 100.0)\n\tlabel.text = "AMBIYANS  ·  %d%%" % int(round(value))\n\nfunc _on_field_sfx_volume_changed(value: float, label: Label) -> void:\n\tif field_ops == null:\n\t\treturn\n\tfield_ops.call("set_field_sfx_volume", value / 100.0)\n\tlabel.text = "FIELD SFX  ·  %d%%" % int(round(value))\n\n'''
    text = path.read_text(encoding="utf-8")
    if helpers not in text:
        if text.count(anchor) != 1:
            raise SystemExit("AUDIOMIX61 settings handler anchor missing")
        path.write_text(text.replace(anchor, helpers + anchor, 1), encoding="utf-8")
        print("AUDIOMIX61 APPLIED: add audio mixer handlers")


def normalize() -> None:
    for relative in ["scripts/ui/field_ops_runtime.gd", "scripts/ui/cinematic_menu_extras.gd"]:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    patch_runtime()
    patch_settings()
    normalize()
    print("CUMA AUDIO MIX 6.1: PASS")


if __name__ == "__main__":
    main()
