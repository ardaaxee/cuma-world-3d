#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"HUD62 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"HUD62 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"HUD62 APPLIED: {label}")


def main() -> None:
    path = ROOT / "scripts/ui/field_ops_runtime.gd"

    replace_once(
        path,
        '''\tif not gameplay_active:\n\t\tif current_music_context != "MENU":\n\t\t\t_set_music_context("MENU")\n\t\treturn\n\tif legacy_suppress_accum >= 0.75:\n\t\tlegacy_suppress_accum = 0.0\n\t\t_suppress_legacy_top_hud()''',
        '''\tif legacy_suppress_accum >= 0.75:\n\t\tlegacy_suppress_accum = 0.0\n\t\t_suppress_legacy_top_hud()\n\tif not gameplay_active:\n\t\tif current_music_context != "MENU":\n\t\t\t_set_music_context("MENU")\n\t\treturn''',
        "clean legacy top chrome in menu and gameplay",
    )

    replace_once(
        path,
        '''\tvar music = _button("MÜZİK", false)\n\tmusic.pressed.connect(_next_music)\n\thud_box.add_child(music)\n\tvar menu = _button("MENÜ", false)''',
        '''\tvar music = _button("MÜZİK", false)\n\tmusic.pressed.connect(_next_music)\n\thud_box.add_child(music)\n\tvar phone = _button("TELEFON", false)\n\tphone.pressed.connect(_on_phone)\n\thud_box.add_child(phone)\n\tvar menu = _button("MENÜ", false)''',
        "move phone access into left Field Ops menu",
    )

    old_suppress = '''func _suppress_legacy_top_hud() -> void:\n\tvar mobile = get_tree().root.find_child("MobileControls", true, false)\n\tif mobile == null:\n\t\treturn\n\tfor property_name in ["title_label", "stats_label", "objective_label"]:\n\t\tvar item = mobile.get(property_name)\n\t\tif item is CanvasItem:\n\t\t\t(item as CanvasItem).visible = false\n\tvar hidden_button_texts = ["MENÜ", "SAVE", "OBS", "CAM", "EK", "FX", "2P", "FOTO"]\n\tfor node in mobile.find_children("*", "Button", true, false):\n\t\tif node is Button and (node as Button).text.to_upper() in hidden_button_texts:\n\t\t\t(node as Button).visible = false\n'''
    new_suppress = '''func _suppress_legacy_top_hud() -> void:\n\t# Keep the screen cinematic: all old top labels disappear in menu/gameplay.\n\t# Field Ops and its dossier are excluded so the new left-side UX stays intact.\n\tfor node in get_tree().root.find_children("*", "Label", true, false):\n\t\tif not (node is Label) or is_ancestor_of(node):\n\t\t\tcontinue\n\t\tvar value = (node as Label).text.strip_edges().to_upper()\n\t\tif "SESSİZ TESLİMAT" in value or value.begins_with("HAVA") or value.begins_with("AVA •"):\n\t\t\t(node as Label).visible = false\n\tif not gameplay_active:\n\t\treturn\n\tvar mobile = get_tree().root.find_child("MobileControls", true, false)\n\tif mobile != null:\n\t\tfor property_name in ["title_label", "stats_label", "objective_label"]:\n\t\t\tvar item = mobile.get(property_name)\n\t\t\tif item is CanvasItem:\n\t\t\t\t(item as CanvasItem).visible = false\n\tvar hidden_button_texts = ["MENÜ", "SAVE", "OBS", "CAM", "EK", "FX", "2P", "FOTO", "PHONE"]\n\tfor node in get_tree().root.find_children("*", "Button", true, false):\n\t\tif not (node is Button) or is_ancestor_of(node):\n\t\t\tcontinue\n\t\tif (node as Button).text.strip_edges().to_upper() in hidden_button_texts:\n\t\t\t(node as Button).visible = false\n'''
    replace_once(path, old_suppress, new_suppress, "hide all remaining top HUD chrome")

    replace_once(
        path,
        '''func _open_pause_menu() -> void:\n\tif menu_extras != null and menu_extras.has_method("toggle_pause_menu"):\n\t\tmenu_extras.call("toggle_pause_menu")''',
        '''func _on_phone() -> void:\n\t# Reuse the production phone button's existing behavior while keeping that\n\t# top-right control hidden. This avoids duplicating the phone subsystem.\n\tfor node in get_tree().root.find_children("*", "Button", true, false):\n\t\tif not (node is Button) or is_ancestor_of(node):\n\t\t\tcontinue\n\t\tvar button = node as Button\n\t\tif button.text.strip_edges().to_upper() == "PHONE":\n\t\t\tbutton.emit_signal("pressed")\n\t\t\t_play_field_sfx(570.0, 0.055, 0.13)\n\t\t\treturn\n\t_notice("Telefon arayüzü bulunamadı")\n\nfunc _open_pause_menu() -> void:\n\tif menu_extras != null and menu_extras.has_method("toggle_pause_menu"):\n\t\tmenu_extras.call("toggle_pause_menu")''',
        "delegate hidden phone button from left menu",
    )

    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
    path.write_text(text, encoding="utf-8")
    print("CUMA HUD CLEANUP 6.2: PASS")


if __name__ == "__main__":
    main()
