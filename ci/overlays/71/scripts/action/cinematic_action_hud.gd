extends CanvasLayer

const ACCENT = Color("d9c7a3")
const TEXT = Color("f3f0e9")
const MUTED = Color("a8a49b")

var action_runtime: Node = null
var panel: PanelContainer = null
var status_label: Label = null
var debrief_layer: CanvasLayer = null
var refresh_accum = 0.0

func setup(runtime: Node) -> void:
	action_runtime = runtime
	name = "CinematicActionHUD71"
	layer = 45
	process_mode = Node.PROCESS_MODE_ALWAYS
	var mission = get_tree().get_first_node_in_group("mission_system")
	if mission != null and mission.has_signal("mission_completed"):
		mission.mission_completed.connect(_on_mission_completed)
	set_process(true)

func _process(delta: float) -> void:
	if panel == null and get_tree().get_first_node_in_group("player") != null:
		_build_hud()
	if panel == null:
		return
	refresh_accum += delta
	if refresh_accum < 0.18:
		return
	refresh_accum = 0.0
	_update_status()

func _build_hud() -> void:
	var root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	panel = PanelContainer.new()
	panel.anchor_left = 0.0
	panel.anchor_right = 0.0
	panel.anchor_top = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = 12.0
	panel.offset_right = 238.0
	panel.offset_top = -184.0
	panel.offset_bottom = -16.0
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.add_theme_stylebox_override("panel", _panel_style(Color(0.012, 0.016, 0.022, 0.94), Color(ACCENT, 0.28), 10))
	root.add_child(panel)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_bottom", 9)
	panel.add_child(margin)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 5)
	margin.add_child(box)
	var title = Label.new()
	title.text = "ACTION 7.1 · FIELD CONTROL"
	title.add_theme_font_size_override("font_size", 10)
	title.add_theme_color_override("font_color", ACCENT)
	box.add_child(title)
	status_label = Label.new()
	status_label.add_theme_font_size_override("font_size", 9)
	status_label.add_theme_color_override("font_color", MUTED)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(status_label)
	var grid = GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 4)
	box.add_child(grid)
	var lens = _button("Q-LENS")
	lens.pressed.connect(_on_lens)
	grid.add_child(lens)
	var cover = _button("SİPER")
	cover.pressed.connect(_on_cover)
	grid.add_child(cover)
	var action = _button("TAKTİK")
	action.pressed.connect(_on_action)
	grid.add_child(action)
	_update_status()

func _button(text_value: String) -> Button:
	var button = Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(64.0, 32.0)
	button.add_theme_font_size_override("font_size", 9)
	button.add_theme_color_override("font_color", TEXT)
	return button

func _update_status() -> void:
	if status_label == null or action_runtime == null:
		return
	var summary: Dictionary = action_runtime.call("get_field_summary")
	status_label.text = "%s · %s\nHEDEF · %s\nSİPER · %s" % [
		str(summary.get("approach", "GHOST")),
		str(summary.get("escalation", "CLEAR")),
		str(summary.get("marked", "YOK")),
		str(summary.get("cover", "YOK")),
	]

func _on_lens() -> void:
	if action_runtime != null:
		action_runtime.call("q_lens_mark_nearest")

func _on_cover() -> void:
	if action_runtime != null:
		action_runtime.call("request_cover")

func _on_action() -> void:
	if action_runtime != null:
		action_runtime.call("contextual_action")

func _on_mission_completed(_mission_id: String, result: Dictionary) -> void:
	_open_debrief(result)

func _open_debrief(result: Dictionary) -> void:
	if debrief_layer != null:
		debrief_layer.queue_free()
	debrief_layer = CanvasLayer.new()
	debrief_layer.name = "ActionDebrief71"
	debrief_layer.layer = 190
	debrief_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(debrief_layer)
	var dim = ColorRect.new()
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0.0, 0.0, 0.0, 0.62)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	debrief_layer.add_child(dim)
	var card = PanelContainer.new()
	card.anchor_left = 0.16
	card.anchor_right = 0.84
	card.anchor_top = 0.16
	card.anchor_bottom = 0.84
	card.add_theme_stylebox_override("panel", _panel_style(Color(0.018, 0.022, 0.029, 0.985), Color(ACCENT, 0.38), 14))
	dim.add_child(card)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	card.add_child(margin)
	var box = VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	margin.add_child(box)
	var eyebrow = Label.new()
	eyebrow.text = "CUMA WORLD · FIELD DEBRIEF"
	eyebrow.add_theme_font_size_override("font_size", 11)
	eyebrow.add_theme_color_override("font_color", ACCENT)
	box.add_child(eyebrow)
	var title = Label.new()
	title.text = "GÖREV TAMAMLANDI"
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", TEXT)
	box.add_child(title)
	var rank = str(result.get("rank", "OPERATIVE"))
	var approach = str(result.get("approach", "GHOST"))
	var hero = Label.new()
	hero.text = "%s  ·  %s" % [rank, approach]
	hero.add_theme_font_size_override("font_size", 22)
	hero.add_theme_color_override("font_color", ACCENT)
	box.add_child(hero)
	var intel_found = int(result.get("intel_found", 0))
	var intel_total = int(result.get("intel_total", 0))
	var alerts = int(result.get("alerts", 0))
	var routes = int(result.get("routes_discovered", 0))
	var spycraft = int(result.get("spycraft_events", 0))
	var actions = int(result.get("action_events", 0))
	var stats = Label.new()
	stats.text = "INTEL  %d/%d\nALARM  %d\nROTA  %d\nSPYCRAFT  %d\nACTION  %d" % [intel_found, intel_total, alerts, routes, spycraft, actions]
	stats.add_theme_font_size_override("font_size", 14)
	stats.add_theme_color_override("font_color", TEXT)
	stats.add_theme_constant_override("line_spacing", 5)
	box.add_child(stats)
	var note = Label.new()
	note.text = _debrief_note(rank, approach, alerts, intel_found, intel_total)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_theme_font_size_override("font_size", 12)
	note.add_theme_color_override("font_color", MUTED)
	box.add_child(note)
	var close = Button.new()
	close.text = "SAHAYA DÖN"
	close.custom_minimum_size.y = 44
	close.pressed.connect(_close_debrief)
	box.add_child(close)
	close.grab_focus()

func _debrief_note(rank: String, approach: String, alerts: int, found: int, total: int) -> String:
	if rank == "GHOST" and found >= total:
		return "Saha kusursuz kapandı: görünür alarm yok ve tüm intel toplandı."
	if approach == "SPYCRAFT":
		return "Gözlem, Q-Lens ve siper kullanımı görevin ana yaklaşımını belirledi."
	if alerts > 1:
		return "Görev tamamlandı ancak saha birkaç kez yükseldi. Bir sonraki denemede daha düşük profil daha yüksek değerlendirme sağlar."
	return "Görev dengeli tamamlandı. Alternatif rota ve ek intel sonraki denemede sonucu yükseltebilir."

func _close_debrief() -> void:
	if debrief_layer != null:
		debrief_layer.queue_free()
		debrief_layer = null

func _panel_style(bg: Color, border: Color, radius: int) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	return style
