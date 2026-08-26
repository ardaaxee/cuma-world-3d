extends Node3D

signal camera_state_changed(state: String)

const STATES = ["IDLE", "TRACKING", "DETECTED", "DISABLED_BY_GAMEPLAY"]
const DETECTION_TICK = 0.20

var sweep = 0.0
var origin_yaw = 0.0
var detection_radius = 10.0
var field_of_view_degrees = 58.0
var camera_state = "IDLE"
var detection_accum = 0.0
var tracking_seconds = 0.0
var intel_id = ""
var intel_title = "Güvenlik Kamerası"
var mission_relevant = false
var observation_marker: Label3D
var debug_cone: MeshInstance3D

func setup(radius_value: float = 10.0, mission_data: Dictionary = {}) -> void:
	detection_radius = clamp(radius_value, 4.0, 20.0)
	field_of_view_degrees = clamp(float(mission_data.get("fov", 58.0)), 30.0, 90.0)
	intel_id = str(mission_data.get("intel_id", "")).strip_edges().to_lower().left(64)
	intel_title = str(mission_data.get("title", "Güvenlik Kamerası")).left(80)
	mission_relevant = not intel_id.is_empty()
	add_to_group("security_camera")
	add_to_group("cctv_gameplay")
	if mission_relevant:
		add_to_group("intel_target")
	origin_yaw = rotation.y
	_build_visual()
	_build_observation_marker()
	_build_debug_cone()
	set_process(true)

func _build_visual() -> void:
	var pole = MeshInstance3D.new()
	var pole_mesh = CylinderMesh.new()
	pole_mesh.top_radius = 0.05
	pole_mesh.bottom_radius = 0.05
	pole_mesh.height = 1.0
	pole.mesh = pole_mesh
	pole.position = Vector3(0, -0.45, 0)
	var metal = StandardMaterial3D.new()
	metal.albedo_color = Color("555c62")
	metal.roughness = 0.45
	pole.material_override = metal
	add_child(pole)
	var housing = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(0.34, 0.22, 0.48)
	housing.mesh = box
	housing.position = Vector3(0, 0.0, -0.12)
	housing.rotation_degrees.x = -12.0
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color("d7dde0")
	mat.roughness = 0.38
	housing.material_override = mat
	add_child(housing)
	var lens = MeshInstance3D.new()
	var lens_mesh = CylinderMesh.new()
	lens_mesh.top_radius = 0.08
	lens_mesh.bottom_radius = 0.08
	lens_mesh.height = 0.05
	lens.mesh = lens_mesh
	lens.position = Vector3(0, -0.01, -0.37)
	lens.rotation_degrees.x = 90
	var lens_mat = StandardMaterial3D.new()
	lens_mat.albedo_color = Color("17232d")
	lens_mat.metallic = 0.2
	lens_mat.roughness = 0.1
	lens.material_override = lens_mat
	add_child(lens)

func _build_observation_marker() -> void:
	if not mission_relevant:
		return
	observation_marker = Label3D.new()
	observation_marker.name = "CCTVObservationMarker73"
	observation_marker.text = "CCTV • " + intel_title
	observation_marker.font_size = 24
	observation_marker.outline_size = 6
	observation_marker.modulate = Color(0.82, 0.92, 1.0, 0.92)
	observation_marker.position = Vector3(0.0, 0.52, 0.0)
	observation_marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	observation_marker.no_depth_test = false
	observation_marker.visible = false
	add_child(observation_marker)

func _build_debug_cone() -> void:
	if not OS.is_debug_build():
		return
	debug_cone = MeshInstance3D.new()
	debug_cone.name = "CCTVDebugCone73"
	var cone = CylinderMesh.new()
	cone.top_radius = 0.04
	cone.bottom_radius = tan(deg_to_rad(field_of_view_degrees * 0.5)) * detection_radius
	cone.height = detection_radius
	cone.radial_segments = 18
	debug_cone.mesh = cone
	debug_cone.position = Vector3(0.0, 0.0, -detection_radius * 0.5)
	debug_cone.rotation_degrees.x = 90.0
	var material = StandardMaterial3D.new()
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color = Color(0.52, 0.76, 0.94, 0.08)
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.no_depth_test = true
	debug_cone.material_override = material
	add_child(debug_cone)

func _process(delta: float) -> void:
	if camera_state != "DISABLED_BY_GAMEPLAY":
		sweep += delta * 0.65
		rotation.y = origin_yaw + sin(sweep) * 0.55
	detection_accum += delta
	if detection_accum < DETECTION_TICK:
		return
	var step = detection_accum
	detection_accum = 0.0
	_update_detection(step)

func _update_detection(step: float) -> void:
	if camera_state == "DISABLED_BY_GAMEPLAY":
		tracking_seconds = 0.0
		return
	var player = get_tree().get_first_node_in_group("player")
	if not (player is Node3D):
		_set_state("IDLE")
		return
	var target = (player as Node3D).global_position + Vector3(0.0, 1.05, 0.0)
	var visible = can_observe(target)
	if visible:
		tracking_seconds += step
		var awareness = get_tree().get_first_node_in_group("awareness_system")
		if tracking_seconds >= 0.70:
			_set_state("DETECTED")
			if awareness != null and awareness.has_method("report_sensor_detection"):
				awareness.call("report_sensor_detection", global_position, "CCTV")
		else:
			_set_state("TRACKING")
			if awareness != null and awareness.has_method("report_sensor_tracking"):
				awareness.call("report_sensor_tracking", global_position, "CCTV")
	else:
		tracking_seconds = max(0.0, tracking_seconds - step * 2.2)
		if tracking_seconds <= 0.05:
			_set_state("IDLE")

func can_observe(world_position: Vector3) -> bool:
	if camera_state == "DISABLED_BY_GAMEPLAY":
		return false
	var direction = world_position - global_position
	var distance = direction.length()
	if distance <= 0.15 or distance > detection_radius:
		return false
	var forward = -global_transform.basis.z.normalized()
	var min_dot = cos(deg_to_rad(field_of_view_degrees * 0.5))
	if forward.dot(direction.normalized()) < min_dot:
		return false
	return _has_line_of_sight(world_position)

func _has_line_of_sight(world_position: Vector3) -> bool:
	var world = get_world_3d()
	if world == null:
		return false
	var query = PhysicsRayQueryParameters3D.create(global_position, world_position)
	query.collision_mask = 1
	query.collide_with_areas = false
	query.collide_with_bodies = true
	var hit = world.direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return true
	var hit_position = hit.get("position", global_position)
	return hit_position is Vector3 and (hit_position as Vector3).distance_to(world_position) <= 0.85

func set_disabled_by_gameplay(value: bool) -> void:
	_set_state("DISABLED_BY_GAMEPLAY" if value else "IDLE")
	tracking_seconds = 0.0

func get_camera_state() -> String:
	return camera_state

func set_observation_visible(value: bool) -> void:
	if observation_marker != null:
		observation_marker.visible = value

func get_observation_data() -> Dictionary:
	return {
		"intel_id": intel_id,
		"category": "OBJECT",
		"title": intel_title,
		"info": "Durum: " + camera_state,
		"analysis_seconds": 0.85,
		"mission_relevant": mission_relevant,
	}

func _set_state(value: String) -> void:
	if value not in STATES or camera_state == value:
		return
	var previous = camera_state
	camera_state = value
	if camera_state == "DETECTED" and previous != "DETECTED":
		var mission = get_tree().get_first_node_in_group("mission_system")
		if mission != null and mission.has_method("report_camera_detection"):
			mission.call("report_camera_detection", name)
	camera_state_changed.emit(camera_state)
