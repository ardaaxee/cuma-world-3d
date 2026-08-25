extends Node

signal observation_changed(active: bool)
signal target_changed(data: Dictionary)
signal analysis_changed(progress: float)

const SCAN_INTERVAL = 0.10
const MAX_DISTANCE = 18.0
const CANDIDATE_DOT = 0.86
const ANALYSIS_DOT = 0.965

var active = false
var scan_accum = 0.0
var current_target: Node = null
var analysis_progress = 0.0
var player: Node3D = null
var camera: Camera3D = null

func setup() -> void:
	add_to_group("observation_controller")
	set_process(true)

func toggle() -> bool:
	active = not active
	analysis_progress = 0.0
	if not active:
		_clear_target()
	observation_changed.emit(active)
	return active

func is_active() -> bool:
	return active

func get_status() -> Dictionary:
	if current_target == null or not is_instance_valid(current_target):
		return {"active": active, "title": "", "category": "", "distance": 0.0, "progress": 0.0}
	var data: Dictionary = current_target.get_observation_data() if current_target.has_method("get_observation_data") else {}
	return {
		"active": active,
		"title": str(data.get("title", "")),
		"category": str(data.get("category", "")),
		"distance": player.global_position.distance_to(current_target.global_position) if player != null else 0.0,
		"progress": analysis_progress,
	}

func _process(delta: float) -> void:
	_resolve_player()
	if not active or player == null or camera == null:
		return
	scan_accum += delta
	if scan_accum >= SCAN_INTERVAL:
		scan_accum = 0.0
		_scan_targets()
	_update_analysis(delta)

func _resolve_player() -> void:
	if player != null and is_instance_valid(player):
		return
	var node = get_tree().get_first_node_in_group("player")
	if node is Node3D:
		player = node
		camera = player.get_node_or_null("CameraPivot/CameraSpring/PlayerCamera") as Camera3D

func _scan_targets() -> void:
	var best: Node = null
	var best_score = -1.0
	var forward = -camera.global_transform.basis.z.normalized()
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	for node in get_tree().get_nodes_in_group("intel_target"):
		if not (node is Node3D) or not node.has_method("get_observation_data"):
			continue
		var data: Dictionary = node.get_observation_data()
		if not bool(data.get("mission_relevant", true)):
			continue
		if intel_system != null and intel_system.has_method("is_discovered") and bool(intel_system.is_discovered(str(data.get("intel_id", "")))):
			node.set_observation_visible(false)
			continue
		var to_target = node.global_position - camera.global_position
		var distance = to_target.length()
		if distance <= 0.2 or distance > MAX_DISTANCE:
			node.set_observation_visible(false)
			continue
		var dot_value = forward.dot(to_target.normalized())
		var visible = dot_value >= CANDIDATE_DOT and _has_line_of_sight(node)
		node.set_observation_visible(visible)
		if visible:
			var score = dot_value * 2.0 - distance * 0.018
			if score > best_score:
				best_score = score
				best = node
	if best != current_target:
		current_target = best
		analysis_progress = 0.0
		target_changed.emit(current_target.get_observation_data() if current_target != null else {})

func _update_analysis(delta: float) -> void:
	if current_target == null or not is_instance_valid(current_target) or camera == null:
		analysis_progress = max(0.0, analysis_progress - delta * 2.5)
		analysis_changed.emit(analysis_progress)
		return
	var to_target = current_target.global_position - camera.global_position
	if to_target.length() <= 0.2:
		return
	var dot_value = (-camera.global_transform.basis.z.normalized()).dot(to_target.normalized())
	if dot_value < ANALYSIS_DOT or not _has_line_of_sight(current_target):
		analysis_progress = max(0.0, analysis_progress - delta * 2.8)
		analysis_changed.emit(analysis_progress)
		return
	var data: Dictionary = current_target.get_observation_data()
	var seconds = max(0.25, float(data.get("analysis_seconds", 0.8)))
	analysis_progress = min(1.0, analysis_progress + delta / seconds)
	analysis_changed.emit(analysis_progress)
	if analysis_progress >= 1.0:
		var intel_system = get_tree().get_first_node_in_group("intel_system")
		if intel_system != null and intel_system.has_method("discover_intel"):
			intel_system.discover_intel(str(data.get("intel_id", "")), "recon_lens")
		current_target.set_observation_visible(false)
		_clear_target()

func _has_line_of_sight(target: Node3D) -> bool:
	var world = camera.get_world_3d()
	if world == null:
		return false
	var query = PhysicsRayQueryParameters3D.create(camera.global_position, target.global_position)
	query.collision_mask = 1
	query.collide_with_areas = true
	query.collide_with_bodies = true
	if player is CollisionObject3D:
		query.exclude = [(player as CollisionObject3D).get_rid()]
	var hit = world.direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return true
	var collider = hit.get("collider")
	if collider == target:
		return true
	if collider is Node and target.is_ancestor_of(collider):
		return true
	return false

func _clear_target() -> void:
	if current_target != null and is_instance_valid(current_target) and current_target.has_method("set_observation_visible"):
		current_target.set_observation_visible(false)
	current_target = null
	analysis_progress = 0.0
	target_changed.emit({})
	analysis_changed.emit(0.0)
