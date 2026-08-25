extends Area3D

var intel_id = ""
var intel_category = "CLUE"
var display_title = ""
var short_info = ""
var analysis_seconds = 0.8
var mission_relevant = true
var marker: Label3D

func setup(values: Dictionary) -> void:
	intel_id = str(values.get("intel_id", "")).strip_edges().to_lower().left(64)
	intel_category = str(values.get("category", "CLUE")).to_upper().left(32)
	display_title = str(values.get("title", intel_id)).left(80)
	short_info = str(values.get("info", "")).left(100)
	analysis_seconds = clamp(float(values.get("analysis_seconds", 0.8)), 0.25, 2.5)
	mission_relevant = bool(values.get("mission_relevant", true))
	collision_layer = 1
	collision_mask = 1
	add_to_group("intel_target")
	var shape_node = CollisionShape3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = 0.42
	shape_node.shape = sphere
	add_child(shape_node)
	marker = Label3D.new()
	marker.text = intel_category + "  •  " + display_title
	marker.font_size = 24
	marker.outline_size = 6
	marker.modulate = Color(0.82, 0.92, 1.0, 0.92)
	marker.position = Vector3(0.0, 0.62, 0.0)
	marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	marker.no_depth_test = false
	marker.visible = false
	add_child(marker)

func set_observation_visible(value: bool) -> void:
	if marker != null:
		marker.visible = value

func get_observation_point() -> Vector3:
	return global_position

func get_observation_data() -> Dictionary:
	return {
		"intel_id": intel_id,
		"category": intel_category,
		"title": display_title,
		"info": short_info,
		"analysis_seconds": analysis_seconds,
		"mission_relevant": mission_relevant,
	}
