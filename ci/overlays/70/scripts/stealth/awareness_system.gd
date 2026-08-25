extends Node

signal alert_changed(level: String)
signal noise_emitted(position: Vector3, radius: float, kind: String)

const STATES = ["UNAWARE", "CURIOUS", "SUSPICIOUS", "INVESTIGATING", "ALERTED", "RETURNING"]
const TICK_INTERVAL = 0.18
const MAX_AGENTS_PER_TICK = 6
const MAX_ACTIVE_DISTANCE = 30.0
const VISION_DISTANCE = 13.0
const FOV_DOT = 0.50

var tick_accum = 0.0
var cursor = 0
var alert_level = "CLEAR"
var player: Node3D = null

func setup() -> void:
	add_to_group("awareness_system")
	set_process(true)

func emit_gameplay_noise(position: Vector3, radius: float, kind: String) -> void:
	var clean_radius = clamp(radius, 0.0, 18.0)
	if clean_radius <= 0.05:
		return
	noise_emitted.emit(position, clean_radius, kind.left(32))
	for npc in _candidate_npcs():
		if not (npc is Node3D):
			continue
		var distance = npc.global_position.distance_to(position)
		if distance > clean_radius:
			continue
		var suspicion = float(npc.get_meta("stealth_suspicion", 0.0))
		var strength = (1.0 - distance / max(0.1, clean_radius)) * 0.28
		npc.set_meta("stealth_suspicion", clamp(suspicion + strength, 0.0, 1.0))
		npc.set_meta("stealth_last_suspicious_position", position)
		npc.set_meta("stealth_last_event", kind.left(32))

func get_alert_level() -> String:
	return alert_level

func get_nearest_suspicion() -> Dictionary:
	_resolve_player()
	if player == null:
		return {"state": "UNAWARE", "suspicion": 0.0}
	var best_distance = INF
	var best = {"state": "UNAWARE", "suspicion": 0.0}
	for npc in _candidate_npcs():
		if not (npc is Node3D):
			continue
		var distance = player.global_position.distance_to(npc.global_position)
		if distance < best_distance and float(npc.get_meta("stealth_suspicion", 0.0)) > 0.02:
			best_distance = distance
			best = {
				"state": str(npc.get_meta("stealth_state", "UNAWARE")),
				"suspicion": float(npc.get_meta("stealth_suspicion", 0.0)),
				"distance": distance,
			}
	return best

func _process(delta: float) -> void:
	_resolve_player()
	if player == null:
		return
	tick_accum += delta
	if tick_accum < TICK_INTERVAL:
		return
	var step_delta = tick_accum
	tick_accum = 0.0
	var npcs = _candidate_npcs()
	if npcs.is_empty():
		_set_alert("CLEAR")
		return
	var processed = 0
	while processed < min(MAX_AGENTS_PER_TICK, npcs.size()):
		var index = cursor % npcs.size()
		cursor += 1
		processed += 1
		_update_agent(npcs[index], step_delta)
	_refresh_global_alert(npcs)

func _resolve_player() -> void:
	if player != null and is_instance_valid(player):
		return
	var node = get_tree().get_first_node_in_group("player")
	if node is Node3D:
		player = node

func _candidate_npcs() -> Array:
	var out: Array = []
	for group_name in ["relationship_npc", "ambient_city_citizen"]:
		for npc in get_tree().get_nodes_in_group(group_name):
			if npc not in out:
				out.append(npc)
	return out

func _update_agent(npc: Node, delta: float) -> void:
	if not (npc is Node3D) or player == null:
		return
	var npc3d = npc as Node3D
	var distance = npc3d.global_position.distance_to(player.global_position)
	if distance > MAX_ACTIVE_DISTANCE:
		return
	var suspicion = float(npc.get_meta("stealth_suspicion", 0.0))
	var previous_state = str(npc.get_meta("stealth_state", "UNAWARE"))
	if not npc.has_meta("stealth_return_anchor"):
		npc.set_meta("stealth_return_anchor", npc3d.global_position)
	var visible = distance <= VISION_DISTANCE and _can_see_player(npc3d, distance)
	if visible:
		var visibility_factor = 1.0
		if player.has_method("get_stealth_visibility_factor"):
			visibility_factor = clamp(float(player.get_stealth_visibility_factor()), 0.35, 1.0)
		var distance_factor = clamp(1.25 - distance / VISION_DISTANCE, 0.25, 1.0)
		suspicion = min(1.0, suspicion + delta * 0.72 * visibility_factor * distance_factor)
		npc.set_meta("stealth_last_seen_position", player.global_position)
		npc.set_meta("stealth_last_suspicious_position", player.global_position)
		npc.set_meta("stealth_last_event", "VISUAL")
	else:
		var decay = 0.035 if previous_state in ["INVESTIGATING", "ALERTED"] else 0.075
		suspicion = max(0.0, suspicion - delta * decay)
	var new_state = _state_for_suspicion(suspicion, previous_state, visible)
	npc.set_meta("stealth_suspicion", suspicion)
	npc.set_meta("stealth_state", new_state)
	if new_state == "INVESTIGATING" and previous_state != "INVESTIGATING":
		var last_value = npc.get_meta("stealth_last_suspicious_position", npc3d.global_position)
		var last_pos = last_value if last_value is Vector3 else npc3d.global_position
		if npc.has_method("set_ai_plan"):
			npc.set_ai_plan("stealth_investigating", last_pos, 0.18)
	elif new_state == "RETURNING" and previous_state != "RETURNING":
		var return_value = npc.get_meta("stealth_return_anchor", npc3d.global_position)
		var return_pos = return_value if return_value is Vector3 else npc3d.global_position
		if npc.has_method("set_ai_plan"):
			npc.set_ai_plan("stealth_returning", return_pos, 0.18)

func _state_for_suspicion(value: float, previous: String, visible: bool) -> String:
	if visible:
		if value >= 0.92:
			return "ALERTED"
		if value >= 0.66:
			return "INVESTIGATING"
		if value >= 0.38:
			return "SUSPICIOUS"
		if value >= 0.14:
			return "CURIOUS"
		return "UNAWARE"
	if previous in ["INVESTIGATING", "ALERTED", "SUSPICIOUS"] and value > 0.03:
		return "RETURNING"
	if value >= 0.38:
		return "SUSPICIOUS"
	if value >= 0.14:
		return "CURIOUS"
	return "UNAWARE"

func _can_see_player(npc: Node3D, distance: float) -> bool:
	var eye = npc.global_position + Vector3(0.0, 1.45, 0.0)
	var target = player.global_position + Vector3(0.0, 1.15, 0.0)
	var direction = target - eye
	if direction.length() <= 0.1:
		return true
	var forward = -npc.global_transform.basis.z.normalized()
	if distance > 2.0 and forward.dot(direction.normalized()) < FOV_DOT:
		return false
	var world = npc.get_world_3d()
	if world == null:
		return false
	var query = PhysicsRayQueryParameters3D.create(eye, target)
	query.collision_mask = 1
	query.collide_with_areas = false
	query.collide_with_bodies = true
	var hit = world.direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return true
	var collider = hit.get("collider")
	return collider == player or (collider is Node and player.is_ancestor_of(collider))

func _refresh_global_alert(npcs: Array) -> void:
	var highest = 0.0
	for npc in npcs:
		highest = max(highest, float(npc.get_meta("stealth_suspicion", 0.0)))
	if highest >= 0.92:
		_set_alert("ALERT")
	elif highest >= 0.66:
		_set_alert("SEARCHING")
	elif highest >= 0.14:
		_set_alert("SUSPICIOUS")
	else:
		_set_alert("CLEAR")

func _set_alert(value: String) -> void:
	if alert_level == value:
		return
	alert_level = value
	alert_changed.emit(alert_level)
