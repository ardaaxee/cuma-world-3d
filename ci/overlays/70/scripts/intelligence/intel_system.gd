extends Node

signal intel_discovered(intel_id: String, data: Dictionary)
signal intel_changed

const ALLOWED_CATEGORIES = ["PERSON", "LOCATION", "OBJECT", "EVENT", "ROUTE", "CLUE", "ACCESS_POINT"]

var catalog: Dictionary = {}

func setup() -> void:
	add_to_group("intel_system")

func register_intel(data: Dictionary) -> bool:
	var intel_id = str(data.get("id", "")).strip_edges().to_lower().left(64)
	var category = str(data.get("category", "CLUE")).to_upper()
	if intel_id.is_empty() or category not in ALLOWED_CATEGORIES:
		return false
	catalog[intel_id] = {
		"id": intel_id,
		"title": str(data.get("title", intel_id)).left(80),
		"description": str(data.get("description", "")).left(240),
		"category": category,
		"missionId": str(data.get("missionId", "")).left(64),
		"source": str(data.get("source", "world")).left(48),
		"relatedIntelIds": _clean_string_array(data.get("relatedIntelIds", []), 16, 64),
		"optional": bool(data.get("optional", false)),
		"persistence": bool(data.get("persistence", true)),
	}
	intel_changed.emit()
	return true

func discover_intel(intel_id: String, source: String = "observation") -> bool:
	var clean_id = intel_id.strip_edges().to_lower().left(64)
	if not catalog.has(clean_id):
		return false
	var gs = get_node_or_null("/root/GameState")
	if gs != null and gs.has_method("is_intel_discovered") and bool(gs.is_intel_discovered(clean_id)):
		return false
	var data: Dictionary = catalog[clean_id]
	if gs != null and gs.has_method("record_intel_discovery"):
		gs.record_intel_discovery(clean_id, source, str(data.get("missionId", "")))
	intel_discovered.emit(clean_id, data.duplicate(true))
	intel_changed.emit()
	return true

func is_discovered(intel_id: String) -> bool:
	var gs = get_node_or_null("/root/GameState")
	return gs != null and gs.has_method("is_intel_discovered") and bool(gs.is_intel_discovered(intel_id))

func get_intel(intel_id: String) -> Dictionary:
	var clean_id = intel_id.strip_edges().to_lower().left(64)
	return catalog.get(clean_id, {}).duplicate(true)

func get_discovered(category: String = "") -> Array[Dictionary]:
	var wanted = category.to_upper()
	var out: Array[Dictionary] = []
	for intel_id in catalog.keys():
		if not is_discovered(str(intel_id)):
			continue
		var data: Dictionary = catalog[intel_id]
		if wanted.is_empty() or str(data.get("category", "")) == wanted:
			out.append(data.duplicate(true))
	return out

func get_discovery_count_for_mission(mission_id: String) -> int:
	var total = 0
	for intel_id in catalog.keys():
		var data: Dictionary = catalog[intel_id]
		if str(data.get("missionId", "")) == mission_id and is_discovered(str(intel_id)):
			total += 1
	return total

func _clean_string_array(value: Variant, limit: int, max_len: int) -> Array[String]:
	var out: Array[String] = []
	if value is Array:
		for raw in value.slice(0, limit):
			var clean = str(raw).strip_edges().left(max_len)
			if not clean.is_empty() and clean not in out:
				out.append(clean)
	return out
