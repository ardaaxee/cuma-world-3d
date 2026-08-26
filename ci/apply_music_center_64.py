#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"MUSIC64 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"MUSIC64 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"MUSIC64 APPLIED: {label}")


def main() -> None:
    path = ROOT / "scripts/ui/field_ops_runtime.gd"

    replace_once(
        path,
        'var dossier_layer: CanvasLayer\nvar tools_layer: CanvasLayer\nvar briefing_label: Label\n',
        'var dossier_layer: CanvasLayer\nvar tools_layer: CanvasLayer\nvar music_overlay: CanvasLayer\nvar briefing_label: Label\nvar music_panel_track_label: Label\nvar music_panel_mode_label: Label\n',
        "retain Music Center overlay state",
    )

    replace_once(
        path,
        '''\tvar music = _button("MÜZİK", false)\n\tmusic.pressed.connect(_next_music)\n\tactions.add_child(music)''',
        '''\tvar music = _button("MÜZİK", false)\n\tmusic.pressed.connect(_toggle_music_center)\n\tactions.add_child(music)''',
        "open Music Center from left HUD",
    )

    replace_once(
        path,
        '''\tif music_label != null:\n\t\tmusic_label.text = "MÜZİK  ·  " + _display_track_name()''',
        '''\tif music_label != null:\n\t\tmusic_label.text = "MÜZİK  ·  " + _display_track_name()\n\t_update_music_center_labels()''',
        "refresh Music Center now-playing labels",
    )

    anchor = 'func _next_music() -> void:\n'
    helpers = r'''func _toggle_music_center() -> void:
	if music_overlay != null:
		music_overlay.queue_free()
		music_overlay = null
		music_panel_track_label = null
		music_panel_mode_label = null
		return
	music_overlay = CanvasLayer.new()
	music_overlay.name = "CumaMusicCenter"
	music_overlay.layer = 178
	music_overlay.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(music_overlay)
	var dim = ColorRect.new()
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0.0, 0.0, 0.0, 0.44)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	music_overlay.add_child(dim)
	var panel = PanelContainer.new()
	panel.anchor_left = 0.03
	panel.anchor_right = 0.38
	panel.anchor_top = 0.14
	panel.anchor_bottom = 0.86
	panel.add_theme_stylebox_override("panel", _panel_style(Color(0.012, 0.016, 0.022, 0.985), 12, Color(ACCENT, 0.30)))
	dim.add_child(panel)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 18)
	margin.add_theme_constant_override("margin_right", 18)
	margin.add_theme_constant_override("margin_top", 17)
	margin.add_theme_constant_override("margin_bottom", 17)
	panel.add_child(margin)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	margin.add_child(box)
	box.add_child(_label("CUMA AUDIO", 10, ACCENT))
	box.add_child(_label("MÜZİK MERKEZİ", 25, TEXT))
	music_panel_track_label = _label("", 14, TEXT)
	music_panel_track_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(music_panel_track_label)
	music_panel_mode_label = _label("", 10, MUTED)
	music_panel_mode_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(music_panel_mode_label)
	box.add_child(_label("Özel parçalar: %d  ·  paket + kullanıcı müzik klasörü" % external_tracks.size(), 9, Color(MUTED, 0.80)))
	var row = GridContainer.new()
	row.columns = 3
	row.add_theme_constant_override("h_separation", 5)
	box.add_child(row)
	var previous = _button("◀", false)
	previous.pressed.connect(_previous_music)
	row.add_child(previous)
	var play_pause = _button("OYNAT / DUR", true)
	play_pause.pressed.connect(_toggle_music_playback)
	row.add_child(play_pause)
	var next = _button("▶", false)
	next.pressed.connect(_next_music)
	row.add_child(next)
	var dynamic = _button("DİNAMİK OYUN MÜZİĞİ", false)
	dynamic.pressed.connect(_resume_dynamic_music)
	box.add_child(dynamic)
	var volume_label = _label("MÜZİK SESİ  ·  %d%%" % int(round(music_volume * 100.0)), 10, TEXT)
	box.add_child(volume_label)
	var volume = HSlider.new()
	volume.min_value = 0.0
	volume.max_value = 100.0
	volume.step = 1.0
	volume.value = music_volume * 100.0
	volume.custom_minimum_size.y = 34
	volume.value_changed.connect(_on_music_center_volume_changed.bind(volume_label))
	box.add_child(volume)
	var close = _button("KAPAT", false)
	close.pressed.connect(_toggle_music_center)
	box.add_child(close)
	_update_music_center_labels()
	_play_field_sfx(770.0, 0.055, 0.12)

func _music_mode_text() -> String:
	if external_track_index >= 0:
		return "ÖZEL / LİSANSLI PARÇA"
	if manual_track_index >= 0:
		return "MANUEL CUMA PARÇASI"
	return "DİNAMİK  ·  " + current_music_context

func _update_music_center_labels() -> void:
	if music_panel_track_label != null:
		music_panel_track_label.text = ("DURAKLATILDI  ·  " if not music_enabled else "ŞİMDİ ÇALIYOR  ·  ") + _display_track_name()
	if music_panel_mode_label != null:
		music_panel_mode_label.text = _music_mode_text()

func _toggle_music_playback() -> void:
	toggle_music()
	_update_music_center_labels()
	_play_field_sfx(540.0 if music_enabled else 320.0, 0.055, 0.11)

func _resume_dynamic_music() -> void:
	manual_track_index = -1
	external_track_index = -1
	music_enabled = true
	var player = get_tree().get_first_node_in_group("player")
	var context = "EXPLORATION"
	if player != null and player.has_method("is_crouched") and bool(player.call("is_crouched")):
		context = "STEALTH"
	_set_music_context(context)
	_save_preferences()
	_update_music_center_labels()

func _previous_music() -> void:
	if external_tracks.size() > 0:
		external_track_index = external_tracks.size() - 1 if external_track_index <= 0 else external_track_index - 1
		manual_track_index = -1
		var path = external_tracks[external_track_index]
		var external = _load_external_audio(path)
		if external != null:
			music_player.stream = external
			music_player.volume_db = _music_db()
			music_enabled = true
			music_player.play()
			current_track_name = path.get_file().get_basename()
			_save_preferences()
			_update_music_center_labels()
			return
	external_track_index = -1
	manual_track_index = 3 if manual_track_index <= 0 else manual_track_index - 1
	var contexts = ["MENU", "EXPLORATION", "STEALTH", "SAFEHOUSE"]
	var context = contexts[manual_track_index]
	music_player.stream = _music_stream_for(context)
	music_player.volume_db = _music_db()
	music_enabled = true
	music_player.play()
	current_track_name = _context_track_name(context)
	_save_preferences()
	_update_music_center_labels()

func _on_music_center_volume_changed(value: float, label: Label) -> void:
	set_music_volume(value / 100.0)
	label.text = "MÜZİK SESİ  ·  %d%%" % int(round(value))

'''
    text = path.read_text(encoding="utf-8")
    if 'func _toggle_music_center() -> void:' not in text:
        if text.count(anchor) != 1:
            raise SystemExit("MUSIC64 next-music anchor missing")
        path.write_text(text.replace(anchor, helpers + anchor, 1), encoding="utf-8")
        print("MUSIC64 APPLIED: add full Music Center overlay and controls")

    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
    path.write_text(text, encoding="utf-8")
    print("CUMA MUSIC CENTER 6.4: PASS")


if __name__ == "__main__":
    main()
