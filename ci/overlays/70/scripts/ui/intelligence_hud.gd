extends CanvasLayer

var obs_label: Label
var suspicion_label: Label
var mission_label: Label
var refresh_accum = 0.0

func setup() -> void:
	layer = 24
	var root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	obs_label = Label.new()
	obs_label.anchor_left = 0.5
	obs_label.anchor_right = 0.5
	obs_label.offset_left = -190
	obs_label.offset_right = 190
	obs_label.offset_top = 62
	obs_label.offset_bottom = 92
	obs_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	obs_label.add_theme_font_size_override("font_size", 13)
	obs_label.modulate = Color(0.86, 0.94, 1.0, 0.88)
	root.add_child(obs_label)
	suspicion_label = Label.new()
	suspicion_label.anchor_left = 0.5
	suspicion_label.anchor_right = 0.5
	suspicion_label.offset_left = -150
	suspicion_label.offset_right = 150
	suspicion_label.offset_top = 92
	suspicion_label.offset_bottom = 116
	suspicion_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	suspicion_label.add_theme_font_size_override("font_size", 11)
	suspicion_label.modulate = Color(1.0, 0.82, 0.58, 0.82)
	root.add_child(suspicion_label)
	mission_label = Label.new()
	mission_label.position = Vector2(18, 52)
	mission_label.add_theme_font_size_override("font_size", 10)
	mission_label.modulate = Color(1, 1, 1, 0.62)
	root.add_child(mission_label)

func _process(delta: float) -> void:
	refresh_accum += delta
	if refresh_accum < 0.10:
		return
	refresh_accum = 0.0
	var observation = get_tree().get_first_node_in_group("observation_controller")
	var awareness = get_tree().get_first_node_in_group("awareness_system")
	var mission = get_tree().get_first_node_in_group("mission_system")
	obs_label.text = ""
	if observation != null and observation.has_method("get_status"):
		var status: Dictionary = observation.get_status()
		if bool(status.get("active", false)):
			var title = str(status.get("title", ""))
			var progress = int(round(float(status.get("progress", 0.0)) * 100.0))
			if title.is_empty():
				obs_label.text = "RECON LENS  •  çevreyi incele"
			elif progress > 0:
				obs_label.text = "%s  •  ANALYZING %d%%" % [title, progress]
			else:
				obs_label.text = "%s  •  %.1fm" % [title, float(status.get("distance", 0.0))]
	suspicion_label.text = ""
	if awareness != null and awareness.has_method("get_nearest_suspicion"):
		var sense: Dictionary = awareness.get_nearest_suspicion()
		var suspicion = float(sense.get("suspicion", 0.0))
		if suspicion > 0.05:
			suspicion_label.text = "%s  •  %d%%" % [str(sense.get("state", "CURIOUS")), int(round(suspicion * 100.0))]
	mission_label.text = ""
	if mission != null and mission.has_method("get_active_summary"):
		var info: Dictionary = mission.get_active_summary()
		if str(info.get("state", "IDLE")) != "IDLE":
			mission_label.text = "%s • %s" % [str(info.get("title", "MISSION")), str(info.get("state", ""))]
