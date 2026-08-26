extends SceneTree

const IntelSystemScript = preload("res://scripts/intelligence/intel_system.gd")
const IntelTargetScript = preload("res://scripts/intelligence/intel_target.gd")
const ObservationControllerScript = preload("res://scripts/intelligence/observation_controller.gd")
const AwarenessSystemScript = preload("res://scripts/stealth/awareness_system.gd")
const MissionSystemScript = preload("res://scripts/intelligence/mission_system.gd")
const SecurityCameraScript = preload("res://scripts/crime/security_camera.gd")

var failures: Array[String] = []
var world: Node3D
var player: CharacterBody3D
var camera: Camera3D
var intel: Node
var observation: Node
var awareness: Node

func _initialize() -> void:
	call_deferred("_run")

func _check(value: bool, label: String) -> void:
	if value:
		print("INTEL73_PROBE_OK ", label)
	else:
		failures.append(label)
		push_error("INTEL73_PROBE_FAIL " + label)

func _run() -> void:
	await process_frame
	world = Node3D.new()
	world.name = "Intel73ProbeWorld"
	root.add_child(world)
	_build_player()
	intel = Node.new()
	intel.set_script(IntelSystemScript)
	world.add_child(intel)
	intel.call("setup")
	observation = Node.new()
	observation.set_script(ObservationControllerScript)
	world.add_child(observation)
	observation.call("setup")
	awareness = Node.new()
	awareness.set_script(AwarenessSystemScript)
	world.add_child(awareness)
	awareness.call("setup")
	await physics_frame
	await physics_frame
	await _probe_observation_and_los()
	await _probe_awareness_and_hearing()
	await _probe_cctv()
	await _probe_mission_and_save()
	if failures.is_empty():
		print("INTEL73_RUNTIME_PROBE: PASS")
		quit(0)
	else:
		print("INTEL73_RUNTIME_PROBE: FAIL ", failures)
		quit(1)

func _build_player() -> void:
	player = CharacterBody3D.new()
	player.name = "ProbePlayer"
	player.add_to_group("player")
	world.add_child(player)
	var shape_node = CollisionShape3D.new()
	var capsule = CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = 1.72
	shape_node.shape = capsule
	shape_node.position.y = 0.86
	player.add_child(shape_node)
	var pivot = Node3D.new()
	pivot.name = "CameraPivot"
	pivot.position.y = 1.55
	player.add_child(pivot)
	var spring = Node3D.new()
	spring.name = "CameraSpring"
	pivot.add_child(spring)
	camera = Camera3D.new()
	camera.name = "PlayerCamera"
	spring.add_child(camera)
	camera.current = true

func _make_target(node_name: String, intel_id: String, pos: Vector3) -> Node:
	intel.call("register_intel", {"id": intel_id, "title": node_name, "description": "CI observation probe", "category": "CLUE", "missionId": "probe", "source": "probe", "relatedIntelIds": [], "optional": false, "persistence": true})
	var target = Area3D.new()
	target.name = node_name
	target.position = pos
	target.set_script(IntelTargetScript)
	world.add_child(target)
	target.call("setup", {"intel_id": intel_id, "category": "CLUE", "title": node_name, "info": "CI", "analysis_seconds": 0.25})
	return target

func _make_wall(pos: Vector3) -> StaticBody3D:
	var wall = StaticBody3D.new()
	wall.name = "ProbeLOSBlocker"
	wall.position = pos
	var collider = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(2.4, 2.8, 0.45)
	collider.shape = box
	wall.add_child(collider)
	world.add_child(wall)
	return wall

func _probe_observation_and_los() -> void:
	player.global_position = Vector3.ZERO
	var target = _make_target("ProbeVisible", "probe_visible_73", Vector3(0.0, 1.55, -5.0))
	await physics_frame
	observation.call("toggle")
	observation.call("_scan_targets")
	var status: Dictionary = observation.call("get_status")
	_check(str(status.get("title", "")) == "ProbeVisible", "OBS visible target selected")
	observation.call("_update_analysis", 0.30)
	_check(bool(intel.call("is_discovered", "probe_visible_73")), "OBS analyze discovers intel")
	target.queue_free()
	await physics_frame
	var blocked = _make_target("ProbeBlocked", "probe_blocked_73", Vector3(0.0, 1.55, -5.0))
	var wall = _make_wall(Vector3(0.0, 1.25, -2.5))
	await physics_frame
	await physics_frame
	observation.call("_scan_targets")
	status = observation.call("get_status")
	_check(str(status.get("title", "")) != "ProbeBlocked", "OBS wall blocks LOS")
	wall.queue_free()
	await physics_frame
	await physics_frame
	observation.call("_scan_targets")
	status = observation.call("get_status")
	_check(str(status.get("title", "")) == "ProbeBlocked", "OBS target returns after obstruction removed")
	blocked.queue_free()
	observation.call("toggle")

func _probe_awareness_and_hearing() -> void:
	player.global_position = Vector3.ZERO
	var npc = Node3D.new()
	npc.name = "ProbeWatcher"
	npc.position = Vector3(0.0, 0.0, -4.0)
	npc.rotation.y = PI
	npc.add_to_group("ambient_city_citizen")
	world.add_child(npc)
	await physics_frame
	awareness.call("_update_agent", npc, 0.8)
	awareness.call("_update_agent", npc, 0.8)
	_check(str(npc.get_meta("stealth_state", "")) == "ALERTED", "NPC staged visual suspicion reaches ALERTED")
	player.global_position = Vector3(7.0, 0.0, 0.0)
	awareness.call("_update_agent", npc, 0.2)
	_check(str(npc.get_meta("stealth_state", "")) in ["INVESTIGATING", "RETURNING"], "NPC uses last-known investigation after LOS lost")
	var listener = Node3D.new()
	listener.name = "ProbeListener"
	listener.position = Vector3(12.0, 0.0, 0.0)
	listener.add_to_group("ambient_city_citizen")
	world.add_child(listener)
	awareness.call("emit_gameplay_noise", listener.global_position, 4.0, "FOOTSTEP")
	_check(float(listener.get_meta("stealth_suspicion", 0.0)) > 0.0, "Gameplay noise raises suspicion")

func _probe_cctv() -> void:
	player.global_position = Vector3(20.0, 0.0, -5.0)
	var cctv = Node3D.new()
	cctv.name = "ProbeCCTV"
	cctv.position = Vector3(20.0, 1.55, 0.0)
	cctv.set_script(SecurityCameraScript)
	world.add_child(cctv)
	cctv.call("setup", 8.0, {"fov": 58.0, "intel_id": "probe_cctv_73", "title": "Probe CCTV"})
	await physics_frame
	var target_pos = player.global_position + Vector3(0.0, 1.05, 0.0)
	_check(bool(cctv.call("can_observe", target_pos)), "CCTV inside FOV and LOS detected")
	cctv.call("_update_detection", 0.8)
	_check(str(cctv.call("get_camera_state")) == "DETECTED", "CCTV state reaches DETECTED")
	var wall = _make_wall(Vector3(20.0, 1.25, -2.5))
	await physics_frame
	await physics_frame
	_check(not bool(cctv.call("can_observe", target_pos)), "CCTV wall obstruction blocks detection")
	wall.queue_free()
	cctv.call("set_disabled_by_gameplay", true)
	_check(str(cctv.call("get_camera_state")) == "DISABLED_BY_GAMEPLAY", "CCTV fictional gameplay disable state")

func _probe_mission_and_save() -> void:
	var mission = Node.new()
	mission.set_script(MissionSystemScript)
	world.add_child(mission)
	mission.call("setup")
	mission.call("start_mission", "market_recon_70")
	intel.call("discover_intel", "market_front_access", "probe")
	intel.call("discover_intel", "market_side_access", "probe")
	_check(str(mission.get("mission_state")) == "PLANNING", "Mission intel unlocks planning")
	_check(bool(mission.call("choose_route", "side")), "Discovered route can be selected")
	_check(bool(mission.call("mark_objective_complete")), "Mission objective completes")
	_check(bool(mission.call("try_extract")), "Mission extraction completes")
	_check(str(mission.get("mission_state")) == "COMPLETE", "Mission reaches COMPLETE")
	var gs = root.get_node_or_null("GameState")
	if gs == null:
		_check(false, "GameState available for save probe")
		return
	_check(gs.has_method("get_intel_discovery"), "GameState exposes intel discovery record")
	var record: Dictionary = gs.call("get_intel_discovery", "market_side_access")
	_check(record.has("discovered_at"), "Intel record includes discovered_at")
	var save_err = int(gs.call("save_game", Vector3.ZERO))
	_check(save_err == OK, "Save writes intelligence state")
	gs.set("intel_discoveries", {})
	_check(not bool(gs.call("is_intel_discovered", "market_side_access")), "Save probe clears runtime intel before reload")
	var load_err = int(gs.call("load_game"))
	_check(load_err == OK and bool(gs.call("is_intel_discovered", "market_side_access")), "Reload restores discovered intel")
