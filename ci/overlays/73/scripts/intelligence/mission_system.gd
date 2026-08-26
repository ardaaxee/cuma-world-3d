extends Node

signal mission_changed(mission_id: String, state: String)
signal mission_completed(mission_id: String, result: Dictionary)

const MISSIONS = {
	"market_recon_70": {
		"title": "Sessiz Teslimat",
		"location": "Fresh Market",
		"primary": "Kurgu teslimat kaydını doğrula ve bölgeden ayrıl",
		"optional": [
			{"id":"extra_intel", "title":"Ek intel bul"},
			{"id":"alternate_route", "title":"Alternatif girişi keşfet"},
			{"id":"unnoticed", "title":"Fark edilmeden tamamla"},
		],
		"required_intel": ["market_front_access", "market_side_access"],
		"intel": [
			{"id":"market_front_access", "title":"Ana Giriş", "description":"Yoğun ve görünür ana yaklaşım.", "category":"ACCESS_POINT", "missionId":"market_recon_70", "source":"observation", "relatedIntelIds":["market_side_access","market_cctv_front"], "optional":false, "persistence":true, "mapPosition":Vector3(15.0,0.05,34.9)},
			{"id":"market_side_access", "title":"Teslimat Girişi", "description":"Daha sakin yan yaklaşım rotası.", "category":"ROUTE", "missionId":"market_recon_70", "source":"observation", "relatedIntelIds":["market_worker_route","market_cctv_side"], "optional":false, "persistence":true, "mapPosition":Vector3(20.0,0.05,38.2)},
			{"id":"market_worker_route", "title":"Çalışan Rutini", "description":"Kurgu market çalışanının dolaşım düzeni alternatif zamanlama bilgisi sağlıyor.", "category":"PERSON", "missionId":"market_recon_70", "source":"npc_observation", "relatedIntelIds":["market_side_access"], "optional":true, "persistence":true},
			{"id":"market_cctv_front", "title":"Ön Güvenlik Kamerası", "description":"Fresh Market girişini izleyen tamamen oyun içi güvenlik kamerası.", "category":"OBJECT", "missionId":"market_recon_70", "source":"recon_lens", "relatedIntelIds":["market_front_access"], "optional":true, "persistence":true, "mapPosition":Vector3(14.0,0.05,33.7)},
			{"id":"market_cctv_side", "title":"Yan Güvenlik Kamerası", "description":"Teslimat koridorunu tarayan tamamen oyun içi güvenlik kamerası.", "category":"OBJECT", "missionId":"market_recon_70", "source":"recon_lens", "relatedIntelIds":["market_side_access"], "optional":true, "persistence":true, "mapPosition":Vector3(21.3,0.05,38.7)},
			{"id":"market_dispatch_object", "title":"Teslimat Kaydı", "description":"Görevde doğrulanacak kurgu sevkiyat kaydı.", "category":"OBJECT", "missionId":"market_recon_70", "source":"mission", "relatedIntelIds":[], "optional":false, "persistence":true, "mapPosition":Vector3(18.4,0.05,39.8)},
		],
		"routes": {
			"main": {"title":"ANA GİRİŞ", "requires":"market_front_access"},
			"side": {"title":"YAN GİRİŞ", "requires":"market_side_access"},
		}
	}
}

var active_mission_id = ""
var mission_state = "IDLE"
var selected_route = ""
var alert_events = 0
var camera_detections = 0
var cinematic_action_events = 0
var spycraft_action_events = 0

func setup() -> void:
	add_to_group("mission_system")
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	if intel_system != null:
		for mission_id in MISSIONS.keys():
			var mission: Dictionary = MISSIONS[mission_id]
			var intel_values: Array = mission.get("intel", [])
			for intel_data in intel_values:
				if intel_data is Dictionary:
					intel_system.register_intel(intel_data)
		intel_system.intel_discovered.connect(_on_intel_discovered)
	_restore_progress()
	if active_mission_id.is_empty():
		start_mission("market_recon_70")

func start_mission(mission_id: String) -> bool:
	if not MISSIONS.has(mission_id):
		return false
	active_mission_id = mission_id
	mission_state = "BRIEFING"
	selected_route = ""
	alert_events = 0
	camera_detections = 0
	cinematic_action_events = 0
	spycraft_action_events = 0
	_save_progress()
	_set_objective("Görev brifingini incele • Fresh Market çevresinde kurgu intel topla")
	mission_changed.emit(active_mission_id, mission_state)
	return true

func acknowledge_briefing() -> void:
	if mission_state == "BRIEFING":
		mission_state = "RECON"
		_save_progress()
		_set_objective("Fresh Market çevresini incele • En az iki gerekli intel bul")
		mission_changed.emit(active_mission_id, mission_state)

func choose_route(route_id: String) -> bool:
	if active_mission_id.is_empty() or mission_state not in ["PLANNING", "RECON"]:
		return false
	var mission: Dictionary = MISSIONS[active_mission_id]
	var routes: Dictionary = mission.get("routes", {})
	if not routes.has(route_id):
		return false
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	var route_data: Dictionary = routes[route_id]
	var requires = str(route_data.get("requires", ""))
	if intel_system == null or not bool(intel_system.is_discovered(requires)):
		return false
	selected_route = route_id
	mission_state = "INFILTRATE"
	var gs = get_node_or_null("/root/GameState")
	if gs != null and gs.has_method("unlock_mission_route"):
		gs.unlock_mission_route(active_mission_id, route_id)
	_save_progress()
	_set_objective("Yaklaşım: %s • Kurgu teslimat kaydına ulaş" % str(route_data.get("title", route_id)))
	mission_changed.emit(active_mission_id, mission_state)
	return true

func mark_objective_complete() -> bool:
	if mission_state not in ["INFILTRATE", "OBJECTIVE"] or selected_route.is_empty():
		return false
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	if intel_system != null:
		intel_system.discover_intel("market_dispatch_object", "mission_objective")
	mission_state = "EXTRACT"
	_save_progress()
	_set_objective("Görev objesi doğrulandı • Market bölgesinden ayrıl")
	mission_changed.emit(active_mission_id, mission_state)
	return true

func try_extract() -> bool:
	if mission_state != "EXTRACT":
		return false
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	var mission: Dictionary = MISSIONS[active_mission_id]
	var found = int(intel_system.get_discovery_count_for_mission(active_mission_id)) if intel_system != null else 0
	var intel_values: Array = mission.get("intel", [])
	var total = intel_values.size()
	var optional_status = get_optional_statuses(true)
	var optional_completed = 0
	for entry in optional_status:
		if bool(entry.get("complete", false)):
			optional_completed += 1
	var result = {
		"intel_found": found,
		"intel_total": total,
		"optional_completed": optional_completed,
		"optional_total": optional_status.size(),
		"alerts": alert_events,
		"camera_detections": camera_detections,
		"routes_discovered": _route_count(),
		"rank": _rank_for_result(alert_events, camera_detections, found, total),
		"approach": _approach_for_result(),
		"action_events": cinematic_action_events,
		"spycraft_events": spycraft_action_events,
	}
	mission_state = "COMPLETE"
	var gs = get_node_or_null("/root/GameState")
	if gs != null and gs.has_method("complete_intelligence_mission"):
		gs.complete_intelligence_mission(active_mission_id, result)
	_save_progress()
	_set_objective("MISSION COMPLETE • %s" % str(result.get("rank", "OPERATIVE")))
	mission_changed.emit(active_mission_id, mission_state)
	mission_completed.emit(active_mission_id, result)
	return true

func report_alert_transition(level: String) -> void:
	if active_mission_id.is_empty() or mission_state == "COMPLETE":
		return
	if level in ["SEARCHING", "ALERT"]:
		alert_events += 1
		_save_progress()

func report_camera_detection(_camera_id: String) -> void:
	if active_mission_id.is_empty() or mission_state in ["IDLE", "COMPLETE"]:
		return
	camera_detections = min(camera_detections + 1, 999)
	_save_progress()

func report_cinematic_action(kind: String) -> void:
	if kind in ["SPYCRAFT_MARK", "COVER", "SPYCRAFT_OPPORTUNITY"]:
		spycraft_action_events += 1
	else:
		cinematic_action_events += 1
	_save_progress()

func _approach_for_result() -> String:
	if cinematic_action_events == 0 and alert_events == 0 and camera_detections == 0:
		return "GHOST" if spycraft_action_events == 0 else "SPYCRAFT"
	if spycraft_action_events > cinematic_action_events * 2:
		return "SPYCRAFT"
	return "ACTION"

func get_briefing_data() -> Dictionary:
	if active_mission_id.is_empty() or not MISSIONS.has(active_mission_id):
		return {}
	var mission: Dictionary = MISSIONS[active_mission_id]
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	var known = int(intel_system.get_discovery_count_for_mission(active_mission_id)) if intel_system != null else 0
	var total = int(intel_system.get_total_count_for_mission(active_mission_id)) if intel_system != null and intel_system.has_method("get_total_count_for_mission") else mission.get("intel", []).size()
	return {
		"mission": str(mission.get("title", "MISSION")),
		"location": str(mission.get("location", "")),
		"primary": str(mission.get("primary", "")),
		"optional": get_optional_statuses(false),
		"known_intel": known,
		"unknown_intel": max(0, total - known),
	}

func get_optional_statuses(final_state: bool = false) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if active_mission_id.is_empty() or not MISSIONS.has(active_mission_id):
		return out
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	for raw in MISSIONS[active_mission_id].get("optional", []):
		if not (raw is Dictionary):
			continue
		var entry: Dictionary = raw
		var optional_id = str(entry.get("id", ""))
		var complete = false
		var state_text = "AÇIK"
		match optional_id:
			"extra_intel":
				complete = intel_system != null and bool(intel_system.is_discovered("market_worker_route"))
			"alternate_route":
				complete = intel_system != null and bool(intel_system.is_discovered("market_side_access"))
			"unnoticed":
				complete = alert_events == 0 and camera_detections == 0
				state_text = "KORUNUYOR" if complete and not final_state else ("TAMAMLANDI" if complete else "BOZULDU")
		if optional_id != "unnoticed":
			state_text = "TAMAMLANDI" if complete else "AÇIK"
		out.append({"id": optional_id, "title": str(entry.get("title", optional_id)), "complete": complete, "state": state_text})
	return out

func get_active_summary() -> Dictionary:
	if active_mission_id.is_empty() or not MISSIONS.has(active_mission_id):
		return {"state":"IDLE"}
	var mission: Dictionary = MISSIONS[active_mission_id]
	var briefing = get_briefing_data()
	return {
		"id": active_mission_id,
		"title": str(mission.get("title", "MISSION")),
		"location": str(mission.get("location", "")),
		"primary": str(mission.get("primary", "")),
		"optional": get_optional_statuses(false),
		"state": mission_state,
		"selected_route": selected_route,
		"known_routes": get_available_routes(),
		"alerts": alert_events,
		"camera_detections": camera_detections,
		"known_intel": int(briefing.get("known_intel", 0)),
		"unknown_intel": int(briefing.get("unknown_intel", 0)),
	}

func get_available_routes() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if active_mission_id.is_empty():
		return out
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	var routes: Dictionary = MISSIONS[active_mission_id].get("routes", {})
	for route_id in routes.keys():
		var data: Dictionary = routes[route_id]
		if intel_system != null and bool(intel_system.is_discovered(str(data.get("requires", "")))):
			out.append({"id":str(route_id), "title":str(data.get("title", route_id))})
	return out

func get_coop_foundation_status() -> Dictionary:
	var net = get_node_or_null("/root/NetworkManager")
	var online = net != null and net.has_method("is_online") and bool(net.is_online())
	return {
		"online": online,
		"authority": "HOST" if online and multiplayer.is_server() else ("CLIENT_READ_ONLY" if online else "LOCAL"),
		"mission_sync_enabled": false,
		"reason": "Single-player intelligence loop is authoritative until explicit shared mission replication is validated.",
	}

func _on_intel_discovered(_intel_id: String, _data: Dictionary) -> void:
	if active_mission_id.is_empty() or mission_state not in ["BRIEFING", "RECON", "PLANNING"]:
		return
	if mission_state == "BRIEFING":
		acknowledge_briefing()
	var intel_system = get_tree().get_first_node_in_group("intel_system")
	var required: Array = MISSIONS[active_mission_id].get("required_intel", [])
	var complete = true
	for intel_id in required:
		if intel_system == null or not bool(intel_system.is_discovered(str(intel_id))):
			complete = false
			break
	if complete:
		mission_state = "PLANNING"
		_save_progress()
		_set_objective("Intel yeterli • Keşfettiğin yaklaşım noktasından rotanı seç")
		mission_changed.emit(active_mission_id, mission_state)

func _route_count() -> int:
	return get_available_routes().size()

func _rank_for_result(alerts: int, cameras: int, found: int, total: int) -> String:
	if alerts == 0 and cameras == 0 and found >= total:
		return "GHOST"
	if alerts <= 1 and cameras <= 1:
		return "SHADOW"
	return "OPERATIVE"

func _save_progress() -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs != null and gs.has_method("set_intelligence_mission_state") and not active_mission_id.is_empty():
		gs.set_intelligence_mission_state(active_mission_id, {
			"state": mission_state,
			"selected_route": selected_route,
			"alerts": alert_events,
			"camera_detections": camera_detections,
			"action_events": cinematic_action_events,
			"spycraft_events": spycraft_action_events,
			"optional": get_optional_statuses(mission_state == "COMPLETE"),
		})

func _restore_progress() -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs == null or not gs.has_method("get_intelligence_mission_state"):
		return
	var saved: Dictionary = gs.get_intelligence_mission_state("market_recon_70")
	if saved.is_empty():
		return
	active_mission_id = "market_recon_70"
	mission_state = str(saved.get("state", "BRIEFING"))
	selected_route = str(saved.get("selected_route", ""))
	alert_events = clamp(int(saved.get("alerts", 0)), 0, 999)
	camera_detections = clamp(int(saved.get("camera_detections", 0)), 0, 999)
	cinematic_action_events = clamp(int(saved.get("action_events", 0)), 0, 999)
	spycraft_action_events = clamp(int(saved.get("spycraft_events", 0)), 0, 999)

func _set_objective(text: String) -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs != null:
		gs.set_objective(text)
		gs.set("story_objective", text)
