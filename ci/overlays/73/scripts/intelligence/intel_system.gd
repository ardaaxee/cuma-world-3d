extends Node

signal intel_discovered(intel_id: String, data: Dictionary)
signal intel_changed

const ALLOWED_CATEGORIES = ["PERSON", "LOCATION", "OBJECT", "EVENT", "ROUTE", "CLUE", "ACCESS_POINT"]
const BOARD_SECTIONS = {
	"PERSON": "PEOPLE",
	"LOCATION": "PLACES",
	"ACCESS_POINT": "PLACES",
	"CLUE": "CLUES",
	"EVENT": "CLUES",
	"ROUTE": "ROUTES",
	"OBJECT": "OBJECTIVES",
}

var catalog: Dictionary = {}

func setup() -> void:
	add_to_group("intel_system")

func register_intel(data: Dictionary) -> bool:
	var intel_id = str(data.get("id", "")).strip_edges().to_lower().left(64)
	var category = str(data.get("category", "CLUE")).to_upper()
	if intel_id.is_empty() or category not in ALLOWED_CATEGORIES:
		return false
	var map_position = data.get("mapPosition", null)
	catalog[intel_id] = {
		"id": intel_id,
		"title": str(data.get("title", intel_id)).left(80),
		"description": str(data.get("description", "")).left(240),
		"category": category,
		"missionId": str(data.get("missionId", "")).left(64),
		"discovered": false,
		"discoveredAt": {},
		"source": str(data.get("source", "world")).left(48),
		"relatedIntelIds": _clean_string_array(data.get("relatedIntelIds", []), 16, 64),
		"optional": bool(data.get("optional", false)),
		"persistence": bool(data.get("persistence", true)),
		"mapPosition": map_position if map_position is Vector3 else null,
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
	var decorated = _decorate_runtime_state(data)
	intel_discovered.emit(clean_id, decorated)
	intel_changed.emit()
	return true

func is_discovered(intel_id: String) -> bool:
	var gs = get_node_or_null("/root/GameState")
	return gs != null and gs.has_method("is_intel_discovered") and bool(gs.is_intel_discovered(intel_id))

func get_intel(intel_id: String) -> Dictionary:
	var clean_id = intel_id.strip_edges().to_lower().left(64)
	var data: Variant = catalog.get(clean_id, {})
	return _decorate_runtime_state(data) if data is Dictionary else {}

func get_discovered(category: String = "") -> Array[Dictionary]:
	var wanted = category.to_upper()
	var out: Array[Dictionary] = []
	for intel_id in catalog.keys():
		if not is_discovered(str(intel_id)):
			continue
		var data: Dictionary = catalog[intel_id]
		if wanted.is_empty() or str(data.get("category", "")) == wanted:
			out.append(_decorate_runtime_state(data))
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return str(a.get("title", "")) < str(b.get("title", "")))
	return out

func get_discovery_count_for_mission(mission_id: String) -> int:
	var total = 0
	for intel_id in catalog.keys():
		var data: Dictionary = catalog[intel_id]
		if str(data.get("missionId", "")) == mission_id and is_discovered(str(intel_id)):
			total += 1
	return total

func get_total_count_for_mission(mission_id: String) -> int:
	var total = 0
	for intel_id in catalog.keys():
		var data: Dictionary = catalog[intel_id]
		if str(data.get("missionId", "")) == mission_id:
			total += 1
	return total

func get_connections(intel_id: String, discovered_only: bool = true) -> Array[Dictionary]:
	var data = get_intel(intel_id)
	var out: Array[Dictionary] = []
	for related_id in data.get("relatedIntelIds", []):
		if not catalog.has(str(related_id)):
			continue
		if discovered_only and not is_discovered(str(related_id)):
			continue
		out.append(get_intel(str(related_id)))
	return out

func get_board_sections() -> Dictionary:
	var sections = {
		"PEOPLE": [],
		"PLACES": [],
		"CLUES": [],
		"ROUTES": [],
		"OBJECTIVES": [],
	}
	for data in get_discovered():
		var section = str(BOARD_SECTIONS.get(str(data.get("category", "CLUE")), "CLUES"))
		var values: Array = sections.get(section, [])
		values.append(data)
		sections[section] = values
	return sections

func get_known_map_markers(mission_id: String = "") -> Array[Dictionary]:
	var markers: Array[Dictionary] = []
	for data in get_discovered():
		if not mission_id.is_empty() and str(data.get("missionId", "")) != mission_id:
			continue
		var pos = data.get("mapPosition", null)
		if not (pos is Vector3):
			continue
		markers.append({
			"id": str(data.get("id", "")),
			"title": str(data.get("title", "")),
			"category": str(data.get("category", "")),
			"position": pos,
		})
	return markers

func _decorate_runtime_state(source_data: Dictionary) -> Dictionary:
	var data = source_data.duplicate(true)
	var discovered = is_discovered(str(data.get("id", "")))
	data["discovered"] = discovered
	data["discoveredAt"] = {}
	if not discovered:
		return data
	var gs = get_node_or_null("/root/GameState")
	if gs != null and gs.has_method("get_intel_discovery"):
		var record: Dictionary = gs.get_intel_discovery(str(data.get("id", "")))
		var discovered_at = record.get("discovered_at", {})
		if discovered_at is Dictionary:
			data["discoveredAt"] = discovered_at.duplicate(true)
		else:
			data["discoveredAt"] = {
				"day": int(record.get("day", 0)),
				"time": float(record.get("time", 0.0)),
			}
		data["discoveredSource"] = str(record.get("source", data.get("source", "world")))
	return data

func _clean_string_array(value: Variant, limit: int, max_len: int) -> Array[String]:
	var out: Array[String] = []
	if value is Array:
		for raw in value.slice(0, limit):
			var clean = str(raw).strip_edges().left(max_len)
			if not clean.is_empty() and clean not in out:
				out.append(clean)
	return out
