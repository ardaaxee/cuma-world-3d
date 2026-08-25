extends Node

const IntelSystemScript = preload("res://scripts/intelligence/intel_system.gd")
const IntelTargetScript = preload("res://scripts/intelligence/intel_target.gd")
const ObservationControllerScript = preload("res://scripts/intelligence/observation_controller.gd")
const MissionSystemScript = preload("res://scripts/intelligence/mission_system.gd")
const MissionInteractableScript = preload("res://scripts/intelligence/mission_interactable.gd")
const AwarenessSystemScript = preload("res://scripts/stealth/awareness_system.gd")
const IntelligenceHUDScript = preload("res://scripts/ui/intelligence_hud.gd")

var world: Node3D

func setup(world_root: Node3D) -> void:
	world = world_root
	var intel = Node.new()
	intel.name = "IntelSystem70"
	intel.set_script(IntelSystemScript)
	world.add_child(intel)
	intel.setup()
	var mission = Node.new()
	mission.name = "MissionSystem70"
	mission.set_script(MissionSystemScript)
	world.add_child(mission)
	mission.setup()
	var awareness = Node.new()
	awareness.name = "AwarenessSystem70"
	awareness.set_script(AwarenessSystemScript)
	world.add_child(awareness)
	awareness.setup()
	awareness.alert_changed.connect(mission.report_alert_transition)
	var observation = Node.new()
	observation.name = "ObservationController70"
	observation.set_script(ObservationControllerScript)
	world.add_child(observation)
	observation.setup()
	_build_market_mission_targets()
	var hud = CanvasLayer.new()
	hud.name = "IntelligenceHUD70"
	hud.set_script(IntelligenceHUDScript)
	world.add_child(hud)
	hud.setup()

func _build_market_mission_targets() -> void:
	_target("MarketFrontIntel70", Vector3(15.0, 1.35, 34.9), {"intel_id":"market_front_access","category":"ACCESS_POINT","title":"Ana Giriş","info":"Yoğun yaklaşım","analysis_seconds":0.65})
	_target("MarketSideIntel70", Vector3(20.0, 1.25, 38.2), {"intel_id":"market_side_access","category":"ROUTE","title":"Teslimat Girişi","info":"Alternatif yaklaşım","analysis_seconds":0.85})
	var worker_target_added = false
	for npc in get_tree().get_nodes_in_group("ambient_city_citizen"):
		if npc is Node3D and npc.global_position.distance_to(Vector3(15, 0.05, 38)) < 28.0:
			var worker_target = Area3D.new()
			worker_target.name = "MarketWorkerIntel70"
			worker_target.set_script(IntelTargetScript)
			npc.add_child(worker_target)
			worker_target.position = Vector3(0.0, 1.25, 0.0)
			worker_target.setup({"intel_id":"market_worker_route","category":"PERSON","title":"Çalışan Rutini","info":"Kısa davranış döngüsü","analysis_seconds":1.15})
			worker_target_added = true
			break
	if not worker_target_added:
		_target("MarketWorkerIntel70", Vector3(15.5, 1.35, 39.4), {"intel_id":"market_worker_route","category":"PERSON","title":"Çalışan Rutini","info":"Kısa davranış döngüsü","analysis_seconds":1.15})
	_interactable("MarketBriefing70", Vector3(11.8, 0.58, 31.7), "briefing", "Görev briefingini aç")
	_interactable("MarketRouteMain70", Vector3(15.0, 0.58, 34.0), "route_main", "Ana giriş yaklaşımını seç")
	_interactable("MarketRouteSide70", Vector3(20.0, 0.58, 37.4), "route_side", "Yan giriş yaklaşımını seç")
	_interactable("MarketMissionObjective70", Vector3(18.4, 0.58, 39.8), "objective", "Teslimat kaydını doğrula")
	_interactable("MarketMissionExtraction70", Vector3(10.8, 0.58, 31.6), "extract", "Görev bölgesinden ayrıl")

func _target(node_name: String, pos: Vector3, data: Dictionary) -> void:
	var target = Area3D.new()
	target.name = node_name
	target.position = pos
	target.set_script(IntelTargetScript)
	world.add_child(target)
	target.setup(data)

func _interactable(node_name: String, pos: Vector3, mode: String, label: String) -> void:
	var node = StaticBody3D.new()
	node.name = node_name
	node.position = pos
	node.set_script(MissionInteractableScript)
	world.add_child(node)
	node.setup(mode, label)
