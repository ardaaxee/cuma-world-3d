extends CanvasLayer

var panel: PanelContainer
var label: Label
var refresh_accum = 0.0
var open = false

func setup() -> void:
	if not OS.is_debug_build():
		queue_free()
		return
	name = "IntelligenceDebug73"
	layer = 220
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_ui()
	set_process(true)
	set_process_unhandled_input(true)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_F8:
		open = not open
		if panel != null:
			panel.visible = open

func _process(delta: float) -> void:
	if not open or label == null:
		return
	refresh_accum += delta
	if refresh_accum < 0.35:
		return
	refresh_accum = 0.0
	_refresh()

func _build_ui() -> void:
	panel = PanelContainer.new()
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.offset_left = -430.0
	panel.offset_right = -12.0
	panel.offset_top = 12.0
	panel.offset_bottom = 520.0
	panel.visible = false
	add_child(panel)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)
	label = Label.new()
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", 11)
	margin.add_child(label)

func _refresh() -> void:
	var awareness = get_tree().get_first_node_in_group("awareness_system")
	var mission = get_tree().get_first_node_in_group("mission_system")
	var intel = get_tree().get_first_node_in_group("intel_system")
	var lines: Array[String] = ["INTELLIGENCE DEBUG 7.3"]
	if mission != null and mission.has_method("get_active_summary"):
		var mission_info: Dictionary = mission.call("get_active_summary")
		lines.append("MISSION %s · %s" % [str(mission_info.get("title", "-")), str(mission_info.get("state", "-"))])
	if awareness != null and awareness.has_method("get_debug_snapshot"):
		var snap: Dictionary = awareness.call("get_debug_snapshot", 6)
		lines.append("ALERT %s" % str(snap.get("alert", "CLEAR")))
		for agent in snap.get("agents", []):
			if agent is Dictionary:
				lines.append("NPC %s · %s · %d%% · %s" % [
					str(agent.get("name", "NPC")),
					str(agent.get("state", "UNAWARE")),
					int(round(float(agent.get("suspicion", 0.0)) * 100.0)),
					str(agent.get("last_event", "")),
				])
	if intel != null and intel.has_method("get_discovered"):
		lines.append("INTEL %d" % intel.call("get_discovered").size())
	for camera in get_tree().get_nodes_in_group("security_camera"):
		if camera.has_method("get_camera_state"):
			lines.append("CCTV %s · %s" % [camera.name, str(camera.call("get_camera_state"))])
	label.text = "\n".join(lines)
