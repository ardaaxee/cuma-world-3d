#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"FIELDUI63 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FIELDUI63 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"FIELDUI63 APPLIED: {label}")


def main() -> None:
    path = ROOT / "scripts/ui/field_ops_runtime.gd"

    replace_once(
        path,
        'var dossier_layer: CanvasLayer\nvar briefing_label: Label\n',
        'var dossier_layer: CanvasLayer\nvar tools_layer: CanvasLayer\nvar briefing_label: Label\n',
        "retain compact tools overlay",
    )
    replace_once(
        path,
        'var selected_gadget = 0\n',
        'var selected_gadget = 0\nvar cover_identity_active = false\n',
        "track social cover identity",
    )

    old_buttons = '''\tvar observe = _button("GÖZLEM", false)\n\tobserve.pressed.connect(_on_observe)\n\thud_box.add_child(observe)\n\tvar instinct = _button("ODAK", false)\n\tinstinct.pressed.connect(_on_focus)\n\thud_box.add_child(instinct)\n\tvar bluff = _button("BLÖF", false)\n\tbluff.pressed.connect(_on_bluff)\n\thud_box.add_child(bluff)\n\tvar gadget = _button("AYGIT", false)\n\tgadget.pressed.connect(_on_gadget)\n\thud_box.add_child(gadget)\n\tvar dossier = _button("DOSYA", false)\n\tdossier.pressed.connect(_toggle_dossier)\n\thud_box.add_child(dossier)\n\tvar music = _button("MÜZİK", false)\n\tmusic.pressed.connect(_next_music)\n\thud_box.add_child(music)\n\tvar phone = _button("TELEFON", false)\n\tphone.pressed.connect(_on_phone)\n\thud_box.add_child(phone)\n\tvar menu = _button("MENÜ", false)\n\tmenu.pressed.connect(_open_pause_menu)\n\thud_box.add_child(menu)'''
    new_buttons = '''\tvar actions = GridContainer.new()\n\tactions.columns = 2\n\tactions.add_theme_constant_override("h_separation", 5)\n\tactions.add_theme_constant_override("v_separation", 5)\n\thud_box.add_child(actions)\n\tvar observe = _button("GÖZLEM", false)\n\tobserve.pressed.connect(_on_observe)\n\tactions.add_child(observe)\n\tvar instinct = _button("ODAK", false)\n\tinstinct.pressed.connect(_on_focus)\n\tactions.add_child(instinct)\n\tvar bluff = _button("BLÖF", false)\n\tbluff.pressed.connect(_on_bluff)\n\tactions.add_child(bluff)\n\tvar cover = _button("KİMLİK", false)\n\tcover.pressed.connect(_on_cover_identity)\n\tactions.add_child(cover)\n\tvar gadget = _button("AYGIT", false)\n\tgadget.pressed.connect(_on_gadget)\n\tactions.add_child(gadget)\n\tvar dossier = _button("DOSYA", false)\n\tdossier.pressed.connect(_toggle_dossier)\n\tactions.add_child(dossier)\n\tvar music = _button("MÜZİK", false)\n\tmusic.pressed.connect(_next_music)\n\tactions.add_child(music)\n\tvar phone = _button("TELEFON", false)\n\tphone.pressed.connect(_on_phone)\n\tactions.add_child(phone)\n\tvar tools = _button("ARAÇLAR", false)\n\ttools.pressed.connect(_toggle_tools)\n\tactions.add_child(tools)\n\tvar menu = _button("MENÜ", false)\n\tmenu.pressed.connect(_open_pause_menu)\n\tactions.add_child(menu)'''
    replace_once(path, old_buttons, new_buttons, "replace tall action stack with compact two-column grid")

    replace_once(
        path,
        '''\tif suspicion_label != null:\n\t\tsuspicion_label.text = "ŞÜPHE  ·  %d%%" % int(round(suspicion))''',
        '''\tif suspicion_label != null:\n\t\tvar cover_suffix = "  ·  KİMLİK" if cover_identity_active else ""\n\t\tsuspicion_label.text = "ŞÜPHE  ·  %d%%" % int(round(suspicion)) + cover_suffix''',
        "show social cover state in left HUD",
    )

    replace_once(
        path,
        '''func _on_bluff() -> void:\n\tif suspicion <= 4.0:''',
        '''func _on_cover_identity() -> void:\n\tif cover_identity_active:\n\t\tcover_identity_active = false\n\t\t_collect_intel("KİMLİK", "Sosyal örtü kapatıldı; normal saha profiline dönüldü.")\n\t\t_play_field_sfx(470.0, 0.055, 0.12)\n\t\treturn\n\tif focus < 15.0:\n\t\t_notice("Kimlik için odak yetersiz")\n\t\treturn\n\tfocus -= 15.0\n\tcover_identity_active = true\n\tsuspicion = max(0.0, suspicion - 12.0)\n\t_collect_intel("KİMLİK", "Kurgusal sosyal örtü etkin; gözlem sırasında daha düşük profil korunuyor.")\n\t_play_field_sfx(690.0, 0.07, 0.14)\n\nfunc _on_bluff() -> void:\n\tif suspicion <= 4.0:''',
        "add safe cover identity spycraft action",
    )

    replace_once(
        path,
        '''\tlines.append("ŞÜPHE %d%%  ·  ODAK %d%%  ·  KAYIT %d" % [int(round(suspicion)), int(round(focus)), intel_entries.size()])\n\tlines.append("")''',
        '''\tlines.append("ŞÜPHE %d%%  ·  ODAK %d%%  ·  KAYIT %d" % [int(round(suspicion)), int(round(focus)), intel_entries.size()])\n\tlines.append("AJAN DEĞERLENDİRMESİ  ·  " + _field_grade())\n\tlines.append("")''',
        "add non-combat field performance grade",
    )

    replace_once(
        path,
        '''func _on_phone() -> void:\n\t# Reuse the production phone button's existing behavior while keeping that''',
        '''func _field_grade() -> String:\n\tif suspicion < 15.0 and intel_entries.size() >= 4:\n\t\treturn "S  ·  GÖRÜNMEZ / BİLGİLİ"\n\tif suspicion < 30.0 and intel_entries.size() >= 2:\n\t\treturn "A  ·  TEMİZ SAHA"\n\tif suspicion < 55.0:\n\t\treturn "B  ·  KONTROLLÜ"\n\treturn "C  ·  YÜKSEK ŞÜPHE"\n\nfunc _toggle_tools() -> void:\n\tif tools_layer != null:\n\t\ttools_layer.queue_free()\n\t\ttools_layer = null\n\t\treturn\n\ttools_layer = CanvasLayer.new()\n\ttools_layer.name = "FieldOpsTools"\n\ttools_layer.layer = 175\n\ttools_layer.process_mode = Node.PROCESS_MODE_ALWAYS\n\tadd_child(tools_layer)\n\tvar dim = ColorRect.new()\n\tdim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)\n\tdim.color = Color(0.0, 0.0, 0.0, 0.32)\n\tdim.mouse_filter = Control.MOUSE_FILTER_STOP\n\ttools_layer.add_child(dim)\n\tvar panel = PanelContainer.new()\n\tpanel.anchor_left = 0.015\n\tpanel.anchor_right = 0.30\n\tpanel.anchor_top = 0.12\n\tpanel.anchor_bottom = 0.86\n\tpanel.add_theme_stylebox_override("panel", _panel_style(Color(0.012, 0.016, 0.022, 0.98), 11, Color(ACCENT, 0.28)))\n\tdim.add_child(panel)\n\tvar margin = MarginContainer.new()\n\tmargin.add_theme_constant_override("margin_left", 14)\n\tmargin.add_theme_constant_override("margin_right", 14)\n\tmargin.add_theme_constant_override("margin_top", 14)\n\tmargin.add_theme_constant_override("margin_bottom", 14)\n\tpanel.add_child(margin)\n\tvar box = VBoxContainer.new()\n\tbox.add_theme_constant_override("separation", 7)\n\tmargin.add_child(box)\n\tbox.add_child(_label("FIELD OPS", 10, ACCENT))\n\tbox.add_child(_label("ARAÇLAR", 24, TEXT))\n\tfor data in [\n\t\t["KAYDET", "SAVE"],\n\t\t["KAMERA", "CAM"],\n\t\t["FOTO MODU", "FOTO"],\n\t\t["GÖRSEL FX", "FX"],\n\t\t["OMUZ / 2P", "2P"],\n\t]:\n\t\tvar button = _button(str(data[0]), false)\n\t\tbutton.pressed.connect(_emit_hidden_control.bind(str(data[1])))\n\t\tbox.add_child(button)\n\tvar close = _button("KAPAT", true)\n\tclose.pressed.connect(_toggle_tools)\n\tbox.add_child(close)\n\nfunc _emit_hidden_control(control_text: String) -> void:\n\tfor node in get_tree().root.find_children("*", "Button", true, false):\n\t\tif not (node is Button) or is_ancestor_of(node):\n\t\t\tcontinue\n\t\tvar button = node as Button\n\t\tif button.text.strip_edges().to_upper() == control_text.to_upper():\n\t\t\tbutton.emit_signal("pressed")\n\t\t\t_play_field_sfx(620.0, 0.05, 0.12)\n\t\t\treturn\n\tif control_text == "SAVE":\n\t\tvar gs = get_node_or_null("/root/GameState")\n\t\tvar player = get_tree().get_first_node_in_group("player")\n\t\tif gs != null and gs.has_method("save_game"):\n\t\t\tif player is Node3D:\n\t\t\t\tgs.call("save_game", (player as Node3D).global_position)\n\t\t\telse:\n\t\t\t\tgs.call("save_game")\n\t\t\t_notice("Oyun kaydedildi")\n\t\t\treturn\n\t_notice("Araç kullanılamıyor")\n\nfunc _on_phone() -> void:\n\t# Reuse the production phone button's existing behavior while keeping that''',
        "add left-side legacy tools delegation and field grade helper",
    )

    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^(\s*var\s+[^\n]*?)\s*:=\s*", r"\1 = ", text, flags=re.MULTILINE)
    path.write_text(text, encoding="utf-8")
    print("CUMA FIELD OPS UI 6.3: PASS")


if __name__ == "__main__":
    main()
