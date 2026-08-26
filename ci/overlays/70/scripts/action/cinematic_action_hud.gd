extends CanvasLayer

const ACCENT = Color("d9c7a3")
const TEXT = Color("f3f0e9")
const MUTED = Color("a8a49b")

var action_runtime: Node = null
var panel: PanelContainer = null
var status_label: Label = null
var refresh_accum = 0.0

func setup(runtime: Node) -> void:
	action_runtime = runtime
	name = "CinematicActionHUD70"
	layer = 45
	process_mode = Node.PROCESS_MODE_ALWAYS
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
	panel.offset_right = 228.0
	panel.offset_top = -168.0
	panel.offset_bottom = -16.0
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.012, 0.016, 0.022, 0.94)
	style.border_color = Color(ACCENT, 0.28)
	style.set_border_width_all(1)
	style.set_corner_radius_all(10)
	panel.add_theme_stylebox_override("panel", style)
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
	title.text = "ACTION 7.0"
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
	button.custom_minimum_size = Vector2(62.0, 32.0)
	button.add_theme_font_size_override("font_size", 9)
	button.add_theme_color_override("font_color", TEXT)
	return button

func _update_status() -> void:
	if status_label == null or action_runtime == null:
		return
	var summary: Dictionary = action_runtime.call("get_field_summary")
	status_label.text = "%s · %s\nHEDEF · %s" % [str(summary.get("approach", "GHOST")), str(summary.get("escalation", "CLEAR")), str(summary.get("marked", "YOK"))]

func _on_lens() -> void:
	if action_runtime != null:
		action_runtime.call("q_lens_mark_nearest")

func _on_cover() -> void:
	if action_runtime != null:
		action_runtime.call("request_cover")

func _on_action() -> void:
	if action_runtime != null:
		action_runtime.call("contextual_action")
