extends Node

signal phase_changed(phase: String, payload: Dictionary)
signal feedback(message: String)
signal debrief_ready(result: Dictionary)

const PHASE_LABELS = {
	"BRIEFING": "BRIEFING",
	"RECON": "READ THE ROOM",
	"PLANNING": "CHOOSE APPROACH",
	"INFILTRATE": "INFILTRATE",
	"OBJECTIVE": "OBJECTIVE",
	"EXTRACT": "EXFILTRATE",
	"COMPLETE": "DEBRIEF",
}

var mission_system: Node = null
var intel_system: Node = null
var awareness_system: Node = null
var observation_controller: Node = null
var phase = "IDLE"
var metrics: Dictionary = {
	"observe": 0,
	"focus": 0,
	"bluff": 0,
	"gadget": 0,
	"opportunity": 0,
}

func setup() -> void:
	name = "SpycraftMissionDirector91"
	add_to_group("spycraft_mission_director")
	call_deferred("_bind_existing_systems")

func _bind_existing_systems() -> void:
	mission_system = get_tree().get_first_node_in_group("mission_system")
	intel_system = get_tree().get_first_node_in_group("intel_system")
	awareness_system = get_tree().get_first_node_in_group("awareness_system")
	observation_controller = get_tree().get_first_node_in_group("observation_controller")
	if mission_system != null:
		if mission_system.has_signal("mission_changed") and not mission_system.mission_changed.is_connected(_on_mission_changed):
			mission_system.mission_changed.connect(_on_mission_changed)
		if mission_system.has_signal("mission_completed") and not mission_system.mission_completed.is_connected(_on_mission_completed):
			mission_system.mission_completed.connect(_on_mission_completed)
		if mission_system.has_method("get_active_summary"):
			var summary: Dictionary = mission_system.call("get_active_summary")
			phase = str(summary.get("state", "IDLE"))
	if intel_system != null and intel_system.has_signal("intel_discovered") and not intel_system.intel_discovered.is_connected(_on_intel_discovered):
		intel_system.intel_discovered.connect(_on_intel_discovered)
	if awareness_system != null and awareness_system.has_signal("alert_changed") and not awareness_system.alert_changed.is_connected(_on_alert_changed):
		awareness_system.alert_changed.connect(_on_alert_changed)

func report_spycraft_action(kind: String, data: Dictionary = {}) -> Dictionary:
	var clean = kind.strip_edges().to_upper()
	match clean:
		"OBSERVE": metrics["observe"] = int(metrics.get("observe", 0)) + 1
		"FOCUS": metrics["focus"] = int(metrics.get("focus", 0)) + 1
		"BLUFF": metrics["bluff"] = int(metrics.get("bluff", 0)) + 1
		"GADGET": metrics["gadget"] = int(metrics.get("gadget", 0)) + 1
		"OPPORTUNITY": metrics["opportunity"] = int(metrics.get("opportunity", 0)) + 1
		_: pass
	if mission_system == null or not is_instance_valid(mission_system):
		mission_system = get_tree().get_first_node_in_group("mission_system")
	if mission_system != null and mission_system.has_method("report_cinematic_action"):
		mission_system.call("report_cinematic_action", "SPYCRAFT_OPPORTUNITY")
	return {"kind": clean, "data": data.duplicate(true), "snapshot": get_snapshot()}

func attempt_social_bluff(strength: float = 0.34) -> Dictionary:
	if awareness_system == null or not is_instance_valid(awareness_system):
		awareness_system = get_tree().get_first_node_in_group("awareness_system")
	if awareness_system == null or not awareness_system.has_method("apply_social_bluff"):
		return {"success": false, "affected": 0, "reason": "AWARENESS_UNAVAILABLE"}
	var result: Dictionary = awareness_system.call("apply_social_bluff", strength, 7.5)
	if bool(result.get("success", false)):
		report_spycraft_action("BLUFF", result)
		feedback.emit("Sosyal gizlilik işe yaradı")
	return result

func use_context_gadget(gadget_name: String) -> Dictionary:
	var clean = gadget_name.strip_edges().to_upper()
	report_spycraft_action("GADGET", {"gadget": clean})
	if awareness_system == null or not is_instance_valid(awareness_system):
		awareness_system = get_tree().get_first_node_in_group("awareness_system")
	if clean == "KAMERA DÖNGÜSÜ" and awareness_system != null and awareness_system.has_method("apply_sensor_cooldown"):
		awareness_system.call("apply_sensor_cooldown", 2400)
		feedback.emit("Kamera ağı kısa süreli rota fırsatı oluşturdu")
	elif clean == "DİKKAT DAĞITICI":
		feedback.emit("Çevresel dikkat geçici olarak başka yöne kaydı")
	elif clean == "SİNYAL TARAYICI":
		feedback.emit("Yakındaki görev fırsatları tarandı")
	elif clean == "AKILLI ANAHTAR":
		feedback.emit("Erişim noktaları analiz edildi")
	return get_snapshot()

func get_snapshot() -> Dictionary:
	var summary: Dictionary = {}
	if mission_system != null and is_instance_valid(mission_system) and mission_system.has_method("get_active_summary"):
		summary = mission_system.call("get_active_summary")
	var suspicion = 0.0
	var alert = "CLEAR"
	if awareness_system != null and is_instance_valid(awareness_system):
		if awareness_system.has_method("get_global_suspicion"):
			suspicion = float(awareness_system.call("get_global_suspicion"))
		if awareness_system.has_method("get_alert_level"):
			alert = str(awareness_system.call("get_alert_level"))
	return {
		"phase": phase,
		"phase_label": str(PHASE_LABELS.get(phase, phase)),
		"mission": summary,
		"metrics": metrics.duplicate(true),
		"suspicion": suspicion,
		"alert": alert,
		"creative_score": _creative_score(summary),
	}

func _creative_score(summary: Dictionary) -> int:
	var variety = 0
	for key in ["observe", "focus", "bluff", "gadget", "opportunity"]:
		if int(metrics.get(key, 0)) > 0:
			variety += 1
	var score = variety * 14
	score += min(20, int(summary.get("known_intel", 0)) * 4)
	score -= min(24, int(summary.get("alerts", 0)) * 8)
	score -= min(18, int(summary.get("camera_detections", 0)) * 6)
	return clamp(score, 0, 100)

func _on_mission_changed(_mission_id: String, state: String) -> void:
	phase = state
	phase_changed.emit(phase, get_snapshot())
	match state:
		"RECON": feedback.emit("Çevreyi oku • intel ve fırsat topla")
		"PLANNING": feedback.emit("Yeni yaklaşım seçenekleri açıldı")
		"INFILTRATE": feedback.emit("Seçilen yaklaşım aktif")
		"EXTRACT": feedback.emit("Görev hedefi tamamlandı • bölgeden ayrıl")
		_: pass

func _on_mission_completed(_mission_id: String, result: Dictionary) -> void:
	phase = "COMPLETE"
	var enriched = result.duplicate(true)
	enriched["creative_score"] = _creative_score(result)
	enriched["spycraft_metrics"] = metrics.duplicate(true)
	debrief_ready.emit(enriched)

func _on_intel_discovered(_intel_id: String, data: Dictionary) -> void:
	var category = str(data.get("category", "")).to_upper()
	if category in ["ACCESS_POINT", "ROUTE", "PERSON", "OBJECT"]:
		report_spycraft_action("OPPORTUNITY", {"category": category})

func _on_alert_changed(level: String) -> void:
	if level == "ALERT":
		feedback.emit("Alarm yükseldi • yaklaşımı değiştir veya bölgeden uzaklaş")
