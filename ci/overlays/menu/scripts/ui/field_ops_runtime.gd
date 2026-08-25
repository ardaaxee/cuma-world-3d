extends Node

const PREF_PATH = "user://cuma_menu_preferences.cfg"
const ACCENT = Color("d9c7a3")
const TEXT = Color("f3f0e9")
const MUTED = Color("a8a49b")
const PANEL = Color(0.012, 0.016, 0.022, 0.94)
const FIELD_OPS_VERSION = "6.0"

var menu_extras: Node
var menu_root: Node
var gameplay_active = false
var paused = false
var hud_layer: CanvasLayer
var hud_panel: PanelContainer
var hud_box: VBoxContainer
var hud_expanded = true
var objective_label: Label
var suspicion_label: Label
var focus_label: Label
var intel_label: Label
var music_label: Label
var gadget_label: Label
var dossier_layer: CanvasLayer
var briefing_label: Label
var intel_entries: Array[String] = []
var seen_scan_cells: Dictionary = {}
var last_objective = ""
var suspicion = 0.0
var focus = 100.0
var focus_boost_until = 0
var selected_gadget = 0
var gadget_names = ["SİNYAL TARAYICI", "KAMERA DÖNGÜSÜ", "AKILLI ANAHTAR", "DİKKAT DAĞITICI"]
var update_accum = 0.0
var legacy_suppress_accum = 0.0

var prefs = ConfigFile.new()
var music_enabled = true
var music_volume = 0.46
var music_player: AudioStreamPlayer
var ambience_player: AudioStreamPlayer
var field_sfx_player: AudioStreamPlayer
var current_music_context = ""
var current_track_name = ""
var manual_track_index = -1
var music_cache: Dictionary = {}
var external_tracks: Array[String] = []
var external_track_index = -1

func setup(extras: Node, root: Node) -> void:
	menu_extras = extras
	menu_root = root
	name = "FieldOpsRuntime"
	add_to_group("field_ops_runtime")
	process_mode = Node.PROCESS_MODE_ALWAYS
	_load_preferences()
	_build_audio_runtime()
	_discover_external_music()
	_set_music_context("MENU")
	set_process(true)
	set_process_unhandled_input(true)

func on_gameplay_started() -> void:
	gameplay_active = true
	paused = false
	_build_left_hud()
	_suppress_legacy_top_hud()
	_set_music_context("EXPLORATION")
	_collect_intel("SAHA AĞI", "Field Ops çevrimiçi. Görev, gözlem ve aygıt verileri tek panelde toplandı.")

func on_pause_changed(value: bool) -> void:
	paused = value
	if music_player != null:
		music_player.volume_db = _music_db() - (5.0 if paused else 0.0)

func decorate_menu_state(safe: Control, state_value: int) -> void:
	var old = safe.find_child("FieldOpsMenuCard", true, false)
	if old != null:
		old.queue_free()
	if state_value != 2:
		return
	var card = PanelContainer.new()
	card.name = "FieldOpsMenuCard"
	card.anchor_left = 0.62
	card.anchor_right = 0.95
	card.anchor_top = 0.62
	card.anchor_bottom = 0.91
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_theme_stylebox_override("panel", _panel_style(Color(0.01, 0.014, 0.020, 0.88), 12, Color(ACCENT, 0.24)))
	safe.add_child(card)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 18)
	margin.add_theme_constant_override("margin_right", 18)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	card.add_child(margin)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 5)
	margin.add_child(box)
	box.add_child(_label("FIELD OPS  ·  " + FIELD_OPS_VERSION, 11, ACCENT))
	box.add_child(_label("İSTİHBARAT AĞI HAZIR", 20, TEXT))
	box.add_child(_label("Gözlem  ·  Odak  ·  Sosyal gizlilik  ·  Aygıtlar", 11, MUTED))
	box.add_child(_label("Dinamik müzik  ·  Sol HUD  ·  Görev dosyası", 11, MUTED))
	box.add_child(_gap(5))
	box.add_child(_label("ŞİMDİ ÇALIYOR  ·  " + _display_track_name(), 10, Color(TEXT, 0.80)))

func _process(delta: float) -> void:
	update_accum += delta
	legacy_suppress_accum += delta
	if not gameplay_active:
		if current_music_context != "MENU":
			_set_music_context("MENU")
		return
	if legacy_suppress_accum >= 0.75:
		legacy_suppress_accum = 0.0
		_suppress_legacy_top_hud()
	if update_accum < 0.18:
		return
	update_accum = 0.0
	_update_field_state()
	_update_left_hud()
	_update_adaptive_music()

func _unhandled_input(event: InputEvent) -> void:
	if not gameplay_active or paused:
		return
	if event.is_action_pressed("interact"):
		_play_field_sfx(420.0, 0.055, 0.15)

func _build_left_hud() -> void:
	if hud_layer != null:
		return
	hud_layer = CanvasLayer.new()
	hud_layer.name = "FieldOpsLeftHUD"
	hud_layer.layer = 46
	hud_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(hud_layer)

	var root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_layer.add_child(root)

	hud_panel = PanelContainer.new()
	hud_panel.anchor_left = 0.0
	hud_panel.anchor_right = 0.0
	hud_panel.anchor_top = 0.0
	hud_panel.anchor_bottom = 0.0
	hud_panel.offset_left = 12.0
	hud_panel.offset_right = 228.0
	hud_panel.offset_top = 76.0
	hud_panel.offset_bottom = 455.0
	hud_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	hud_panel.add_theme_stylebox_override("panel", _panel_style(PANEL, 11, Color(ACCENT, 0.26)))
	root.add_child(hud_panel)

	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_bottom", 12)
	hud_panel.add_child(margin)

	hud_box = VBoxContainer.new()
	hud_box.add_theme_constant_override("separation", 5)
	margin.add_child(hud_box)

	var toggle = _button("FIELD OPS  ·  ≡", true)
	toggle.pressed.connect(_toggle_left_hud)
	hud_box.add_child(toggle)

	objective_label = _label("GÖREV  ·  hazırlanıyor", 10, TEXT)
	objective_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hud_box.add_child(objective_label)
	suspicion_label = _label("ŞÜPHE  ·  0%", 10, MUTED)
	hud_box.add_child(suspicion_label)
	focus_label = _label("ODAK  ·  100%", 10, MUTED)
	hud_box.add_child(focus_label)
	intel_label = _label("İSTİHBARAT  ·  0", 10, MUTED)
	hud_box.add_child(intel_label)
	gadget_label = _label("AYGIT  ·  " + gadget_names[selected_gadget], 9, Color(MUTED, 0.88))
	gadget_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hud_box.add_child(gadget_label)
	music_label = _label("MÜZİK  ·  " + _display_track_name(), 9, Color(MUTED, 0.88))
	music_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hud_box.add_child(music_label)
	hud_box.add_child(_gap(3))

	var observe = _button("GÖZLEM", false)
	observe.pressed.connect(_on_observe)
	hud_box.add_child(observe)
	var instinct = _button("ODAK", false)
	instinct.pressed.connect(_on_focus)
	hud_box.add_child(instinct)
	var bluff = _button("BLÖF", false)
	bluff.pressed.connect(_on_bluff)
	hud_box.add_child(bluff)
	var gadget = _button("AYGIT", false)
	gadget.pressed.connect(_on_gadget)
	hud_box.add_child(gadget)
	var dossier = _button("DOSYA", false)
	dossier.pressed.connect(_toggle_dossier)
	hud_box.add_child(dossier)
	var music = _button("MÜZİK", false)
	music.pressed.connect(_next_music)
	hud_box.add_child(music)
	var menu = _button("MENÜ", false)
	menu.pressed.connect(_open_pause_menu)
	hud_box.add_child(menu)

func _toggle_left_hud() -> void:
	hud_expanded = not hud_expanded
	if hud_box == null:
		return
	for i in range(1, hud_box.get_child_count()):
		var child = hud_box.get_child(i)
		if child is CanvasItem:
			(child as CanvasItem).visible = hud_expanded
	hud_panel.offset_bottom = 455.0 if hud_expanded else 123.0
	_play_field_sfx(520.0, 0.045, 0.13)

func _update_field_state() -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs != null:
		var objective = str(gs.get("story_objective"))
		if objective != "" and objective != last_objective:
			last_objective = objective
			_collect_intel("GÖREV GÜNCELLENDİ", objective)
	var awareness = get_tree().get_first_node_in_group("awareness_system")
	if awareness != null:
		for method in ["get_global_suspicion", "get_suspicion", "get_alert_level"]:
			if awareness.has_method(method):
				suspicion = clamp(float(awareness.call(method)), 0.0, 100.0)
				break
	else:
		suspicion = max(0.0, suspicion - 0.55)
	if Time.get_ticks_msec() < focus_boost_until:
		focus = max(0.0, focus - 0.12)
	else:
		focus = min(100.0, focus + 0.18)

func _update_left_hud() -> void:
	if hud_layer == null:
		return
	if objective_label != null:
		objective_label.text = "GÖREV  ·  " + (last_objective.left(82) if last_objective != "" else "Serbest keşif")
	if suspicion_label != null:
		suspicion_label.text = "ŞÜPHE  ·  %d%%" % int(round(suspicion))
		suspicion_label.modulate = Color("e4b58a") if suspicion >= 55.0 else MUTED
	if focus_label != null:
		focus_label.text = "ODAK  ·  %d%%" % int(round(focus))
	if intel_label != null:
		intel_label.text = "İSTİHBARAT  ·  %d" % intel_entries.size()
	if gadget_label != null:
		gadget_label.text = "AYGIT  ·  " + gadget_names[selected_gadget]
	if music_label != null:
		music_label.text = "MÜZİK  ·  " + _display_track_name()

func _suppress_legacy_top_hud() -> void:
	var mobile = get_tree().root.find_child("MobileControls", true, false)
	if mobile == null:
		return
	for property_name in ["title_label", "stats_label", "objective_label"]:
		var item = mobile.get(property_name)
		if item is CanvasItem:
			(item as CanvasItem).visible = false
	var hidden_button_texts = ["MENÜ", "SAVE", "OBS", "CAM", "EK", "FX", "2P", "FOTO"]
	for node in mobile.find_children("*", "Button", true, false):
		if node is Button and (node as Button).text.to_upper() in hidden_button_texts:
			(node as Button).visible = false

func _on_observe() -> void:
	var player = get_tree().get_first_node_in_group("player")
	if player != null and player.has_method("toggle_observation_mode"):
		player.call("toggle_observation_mode")
	_scan_field_intel(player)
	focus = min(100.0, focus + 9.0)
	_play_field_sfx(720.0, 0.09, 0.18)

func _scan_field_intel(player: Node) -> void:
	if player == null or not (player is Node3D):
		return
	var p = (player as Node3D).global_position
	var cell = "%d:%d" % [int(floor(p.x / 8.0)), int(floor(p.z / 8.0))]
	if seen_scan_cells.has(cell):
		_collect_intel("YENİDEN TARAMA", "Bölge daha önce analiz edildi; mevcut ipuçları doğrulandı.")
		return
	seen_scan_cells[cell] = true
	var interaction = ""
	if player.has_method("get_interaction_text"):
		interaction = str(player.call("get_interaction_text"))
	var detail = "Konum %.1f / %.1f çevresinde yeni saha verisi kaydedildi." % [p.x, p.z]
	if interaction != "":
		detail += " Fırsat: " + interaction
	_collect_intel("ÇEVRESEL İPUCU", detail)

func _on_focus() -> void:
	if focus < 25.0:
		_notice("Odak yetersiz")
		_play_field_sfx(250.0, 0.08, 0.12)
		return
	focus -= 25.0
	focus_boost_until = Time.get_ticks_msec() + 6000
	var player = get_tree().get_first_node_in_group("player")
	if player != null and player.has_method("toggle_observation_mode"):
		player.call("toggle_observation_mode")
	_collect_intel("ODAK ANALİZİ", "Kısa süreli gelişmiş çevre okuması etkinleştirildi.")
	_play_field_sfx(840.0, 0.11, 0.18)

func _on_bluff() -> void:
	if suspicion <= 4.0:
		_notice("Şüphe yok")
		return
	if focus < 20.0:
		_notice("Blöf için odak yetersiz")
		return
	focus -= 20.0
	suspicion = max(0.0, suspicion - 38.0)
	_collect_intel("SOSYAL GİZLİLİK", "Şüphe kontrollü diyalog/blöf ile azaltıldı.")
	_play_field_sfx(610.0, 0.07, 0.16)

func _on_gadget() -> void:
	selected_gadget = (selected_gadget + 1) % gadget_names.size()
	var gadget = gadget_names[selected_gadget]
	if gadget == "SİNYAL TARAYICI":
		_scan_field_intel(get_tree().get_first_node_in_group("player"))
	elif gadget == "KAMERA DÖNGÜSÜ":
		suspicion = max(0.0, suspicion - 10.0)
		_collect_intel("AYGIT", "Kurgusal güvenlik kamerası döngüsü kısa süreli rota fırsatı oluşturdu.")
	elif gadget == "AKILLI ANAHTAR":
		_collect_intel("AYGIT", "Yakındaki görev kilitleri ve erişim noktaları tarandı.")
	else:
		suspicion = max(0.0, suspicion - 7.0)
		_collect_intel("AYGIT", "Çevresel dikkat başka yöne çekildi; gizli geçiş için kısa fırsat oluştu.")
	_play_field_sfx(930.0, 0.07, 0.15)

func _collect_intel(title: String, detail: String) -> void:
	var entry = title + "  ·  " + detail
	if intel_entries.size() >= 12:
		intel_entries.pop_front()
	intel_entries.append(entry)
	focus = min(100.0, focus + 5.0)
	_refresh_dossier_text()

func _toggle_dossier() -> void:
	if dossier_layer != null:
		dossier_layer.queue_free()
		dossier_layer = null
		return
	dossier_layer = CanvasLayer.new()
	dossier_layer.name = "FieldOpsDossier"
	dossier_layer.layer = 170
	dossier_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(dossier_layer)
	var dim = ColorRect.new()
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0.0, 0.0, 0.0, 0.72)
	dossier_layer.add_child(dim)
	var panel = PanelContainer.new()
	panel.anchor_left = 0.08
	panel.anchor_right = 0.92
	panel.anchor_top = 0.08
	panel.anchor_bottom = 0.92
	panel.add_theme_stylebox_override("panel", _panel_style(Color(0.012, 0.016, 0.022, 0.98), 12, Color(ACCENT, 0.30)))
	dim.add_child(panel)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_right", 22)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	panel.add_child(margin)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	margin.add_child(box)
	box.add_child(_label("CUMA FIELD OPS", 11, ACCENT))
	box.add_child(_label("GÖREV DOSYASI", 27, TEXT))
	briefing_label = _label("", 12, Color(TEXT, 0.86))
	briefing_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(briefing_label)
	var close = _button("KAPAT", true)
	close.pressed.connect(_toggle_dossier)
	box.add_child(close)
	_refresh_dossier_text()

func _refresh_dossier_text() -> void:
	if briefing_label == null:
		return
	var lines: Array[String] = []
	lines.append("BRIEFING  ·  " + (last_objective if last_objective != "" else "Serbest keşif / istihbarat toplama"))
	lines.append("ŞÜPHE %d%%  ·  ODAK %d%%  ·  KAYIT %d" % [int(round(suspicion)), int(round(focus)), intel_entries.size()])
	lines.append("")
	lines.append("SAHA NOTLARI")
	for entry in intel_entries:
		lines.append("• " + entry)
	briefing_label.text = "\n".join(lines)

func _open_pause_menu() -> void:
	if menu_extras != null and menu_extras.has_method("toggle_pause_menu"):
		menu_extras.call("toggle_pause_menu")

func _notice(text: String) -> void:
	var player = get_tree().get_first_node_in_group("player")
	if player != null and player.has_method("show_status"):
		player.call("show_status", text, 1.4)

func _build_audio_runtime() -> void:
	music_player = AudioStreamPlayer.new()
	music_player.name = "AdaptiveMusic"
	music_player.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(music_player)
	ambience_player = AudioStreamPlayer.new()
	ambience_player.name = "WorldAmbience"
	ambience_player.process_mode = Node.PROCESS_MODE_ALWAYS
	ambience_player.stream = _make_ambient_stream()
	ambience_player.volume_db = -28.0
	add_child(ambience_player)
	ambience_player.play()
	field_sfx_player = AudioStreamPlayer.new()
	field_sfx_player.name = "FieldOpsSFX"
	field_sfx_player.process_mode = Node.PROCESS_MODE_ALWAYS
	field_sfx_player.volume_db = -10.0
	add_child(field_sfx_player)

func _set_music_context(context: String) -> void:
	if current_music_context == context and music_player != null and music_player.playing:
		return
	current_music_context = context
	manual_track_index = -1
	var stream = _music_stream_for(context)
	if music_player == null or stream == null:
		return
	music_player.stream = stream
	music_player.volume_db = _music_db() - (5.0 if paused else 0.0)
	if music_enabled:
		music_player.play()
	current_track_name = _context_track_name(context)

func _update_adaptive_music() -> void:
	if manual_track_index >= 0 or external_track_index >= 0:
		return
	var player = get_tree().get_first_node_in_group("player")
	if player == null:
		return
	var context = "EXPLORATION"
	if player.has_method("is_crouched") and bool(player.call("is_crouched")):
		context = "STEALTH"
	elif player.get("driving_vehicle") != null:
		context = "DRIVE"
	else:
		var p = (player as Node3D).global_position if player is Node3D else Vector3.ZERO
		if abs(p.x) < 12.0 and abs(p.z) < 14.0:
			context = "SAFEHOUSE"
	if context != current_music_context:
		_set_music_context(context)

func _next_music() -> void:
	if external_tracks.size() > 0:
		external_track_index = (external_track_index + 1) % external_tracks.size()
		manual_track_index = -1
		var path = external_tracks[external_track_index]
		var external = _load_external_audio(path)
		if external != null:
			music_player.stream = external
			music_player.volume_db = _music_db()
			music_player.play()
			current_track_name = path.get_file().get_basename()
			music_enabled = true
			_save_preferences()
			return
	external_track_index = -1
	manual_track_index = (manual_track_index + 1) % 4
	var contexts = ["MENU", "EXPLORATION", "STEALTH", "SAFEHOUSE"]
	var context = contexts[manual_track_index]
	music_player.stream = _music_stream_for(context)
	music_player.volume_db = _music_db()
	music_enabled = true
	music_player.play()
	current_track_name = _context_track_name(context)
	_save_preferences()
	_play_field_sfx(660.0, 0.05, 0.12)

func toggle_music() -> void:
	music_enabled = not music_enabled
	if music_player != null:
		if music_enabled:
			music_player.play()
		else:
			music_player.stop()
	_save_preferences()

func set_music_volume(value: float) -> void:
	music_volume = clamp(value, 0.0, 1.0)
	if music_player != null:
		music_player.volume_db = _music_db()
	_save_preferences()

func _music_stream_for(context: String) -> AudioStream:
	if music_cache.has(context):
		return music_cache[context]
	var stream = _make_music_loop(context)
	music_cache[context] = stream
	return stream

func _make_music_loop(context: String) -> AudioStreamWAV:
	var mix_rate = 11025
	var seconds = 8.0
	var frame_count = int(float(mix_rate) * seconds)
	var data = PackedByteArray()
	data.resize(frame_count * 2)
	var root = 55.0
	var pulse = 2.0
	if context == "MENU":
		root = 49.0
		pulse = 1.5
	elif context == "STEALTH":
		root = 46.25
		pulse = 1.0
	elif context == "SAFEHOUSE":
		root = 65.41
		pulse = 1.25
	elif context == "DRIVE":
		root = 73.42
		pulse = 2.4
	for i in range(frame_count):
		var t = float(i) / float(mix_rate)
		var bass = sin(TAU * root * t) * 0.34
		var pad = sin(TAU * root * 1.5 * t + 0.6) * 0.16
		var air = sin(TAU * root * 2.01 * t + sin(t * 0.4)) * 0.07
		var gate = pow(max(0.0, sin(TAU * pulse * t)), 7.0) * 0.18
		var sample_value = tanh((bass + pad + air + gate) * 0.55)
		var sample = int(clamp(sample_value, -1.0, 1.0) * 32767.0)
		data.encode_s16(i * 2, sample)
	var wav = AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = mix_rate
	wav.stereo = false
	wav.data = data
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_begin = 0
	wav.loop_end = frame_count
	return wav

func _make_ambient_stream() -> AudioStreamWAV:
	var mix_rate = 8000
	var seconds = 5.0
	var frame_count = int(float(mix_rate) * seconds)
	var data = PackedByteArray()
	data.resize(frame_count * 2)
	for i in range(frame_count):
		var t = float(i) / float(mix_rate)
		var sample_value = sin(TAU * 38.0 * t) * 0.045 + sin(TAU * 73.0 * t) * 0.018
		var sample = int(sample_value * 32767.0)
		data.encode_s16(i * 2, sample)
	var wav = AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = mix_rate
	wav.stereo = false
	wav.data = data
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_begin = 0
	wav.loop_end = frame_count
	return wav

func _play_field_sfx(frequency: float, seconds: float, gain: float) -> void:
	if field_sfx_player == null:
		return
	var mix_rate = 16000
	var frame_count = int(float(mix_rate) * seconds)
	var data = PackedByteArray()
	data.resize(frame_count * 2)
	for i in range(frame_count):
		var t = float(i) / float(mix_rate)
		var env = pow(1.0 - float(i) / max(1.0, float(frame_count - 1)), 2.0)
		var v = sin(TAU * frequency * t) * env * gain
		data.encode_s16(i * 2, int(clamp(v, -1.0, 1.0) * 32767.0))
	var wav = AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = mix_rate
	wav.stereo = false
	wav.data = data
	field_sfx_player.stream = wav
	field_sfx_player.play()

func _discover_external_music() -> void:
	external_tracks.clear()
	for root_path in ["res://audio/music", "user://music"]:
		var dir = DirAccess.open(root_path)
		if dir == null:
			continue
		dir.list_dir_begin()
		var file_name = dir.get_next()
		while file_name != "":
			if not dir.current_is_dir():
				var ext = file_name.get_extension().to_lower()
				if ext in ["ogg", "mp3", "wav"]:
					external_tracks.append(root_path.path_join(file_name))
			file_name = dir.get_next()
		dir.list_dir_end()

func _load_external_audio(path: String) -> AudioStream:
	var ext = path.get_extension().to_lower()
	if path.begins_with("res://"):
		var resource = load(path)
		return resource if resource is AudioStream else null
	if ext == "ogg":
		return AudioStreamOggVorbis.load_from_file(ProjectSettings.globalize_path(path))
	if ext == "mp3":
		return AudioStreamMP3.load_from_file(ProjectSettings.globalize_path(path))
	if ext == "wav":
		return AudioStreamWAV.load_from_file(ProjectSettings.globalize_path(path))
	return null

func _context_track_name(context: String) -> String:
	if context == "MENU":
		return "NOIR SIGNAL"
	if context == "STEALTH":
		return "QUIET FREQUENCY"
	if context == "SAFEHOUSE":
		return "SAFEHOUSE AFTERGLOW"
	if context == "DRIVE":
		return "CITY PULSE"
	return "NIGHT EXPLORATION"

func _display_track_name() -> String:
	return ("KAPALI" if not music_enabled else (current_track_name if current_track_name != "" else _context_track_name(current_music_context)))

func _music_db() -> float:
	return linear_to_db(max(music_volume, 0.0001)) - 5.0

func _load_preferences() -> void:
	if prefs.load(PREF_PATH) != OK:
		prefs = ConfigFile.new()
	music_enabled = bool(prefs.get_value("audio", "music_enabled", true))
	music_volume = clamp(float(prefs.get_value("audio", "music_volume", 0.46)), 0.0, 1.0)

func _save_preferences() -> void:
	prefs.set_value("audio", "music_enabled", music_enabled)
	prefs.set_value("audio", "music_volume", music_volume)
	prefs.save(PREF_PATH)

func _panel_style(color: Color, radius: int, border: Color) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	return style

func _label(text_value: String, size: int, color: Color) -> Label:
	var label = Label.new()
	label.text = text_value
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

func _button(text_value: String, primary: bool) -> Button:
	var button = Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(0.0, 31.0)
	button.focus_mode = Control.FOCUS_ALL
	var normal = StyleBoxFlat.new()
	normal.bg_color = Color(ACCENT, 0.18) if primary else Color(0.02, 0.026, 0.034, 0.70)
	normal.border_color = Color(ACCENT, 0.42) if primary else Color(1.0, 1.0, 1.0, 0.10)
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(7)
	button.add_theme_stylebox_override("normal", normal)
	var active = normal.duplicate()
	active.bg_color = Color(ACCENT, 0.30)
	button.add_theme_stylebox_override("hover", active)
	button.add_theme_stylebox_override("pressed", active)
	button.add_theme_color_override("font_color", TEXT)
	button.add_theme_font_size_override("font_size", 10)
	return button

func _gap(height: float) -> Control:
	var gap = Control.new()
	gap.custom_minimum_size = Vector2(0.0, height)
	return gap
