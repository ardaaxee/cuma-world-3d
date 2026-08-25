extends Node

signal escalation_changed(level: String)
signal target_marked(label: String)
signal action_feedback(kind: String, detail: String)

const ESCALATION_ORDER = {"CLEAR": 0, "WATCH": 1, "SEARCH": 2, "CHASE": 3}
const MARK_DISTANCE = 18.0
const CLOSE_ACTION_DISTANCE = 2.35
const COVER_DISTANCE = 3.1

var player: Node3D = null
var awareness: Node = null
var mission_system: Node = null
var marked_target: Node = null
var mark_label: Label3D = null
var escalation = "CLEAR"
var peak_escalation = "CLEAR"
var cover_until_msec = 0
var active_cover_name = ""
var spycraft_events = 0
var action_events = 0
var refresh_accum = 0.0

func setup() -> void:
	name = "CinematicAction71"
	add_to_group("cinematic_action_system")
	awareness = get_tree().get_first_node_in_group("awareness_system")
	mission_system = get_tree().get_first_node_in_group("mission_system")
	if awareness != null and awareness.has_signal("alert_changed"):
		awareness.alert_changed.connect(_on_alert_changed)
	set_process(true)

func get_visibility_multiplier() -> float:
	return 0.56 if Time.get_ticks_msec() < cover_until_msec else 1.0

func get_escalation_label() -> String:
	return escalation

func get_marked_target_label() -> String:
	if marked_target == null or not is_instance_valid(marked_target):
		return "YOK"
	return str(marked_target.get_meta("action_label", marked_target.name)).left(32)

func get_cover_status() -> String:
	if Time.get_ticks_msec() < cover_until_msec and not active_cover_name.is_empty():
		return "AKTİF · " + active_cover_name
	var cover = _nearest_cover(COVER_DISTANCE)
	if cover != null:
		return "HAZIR · " + str(cover.get_meta("cover_label", cover.name)).left(24)
	return "YOK"

func get_field_summary() -> Dictionary:
	var approach = "GHOST"
	if action_events > 0:
		approach = "ACTION"
	elif spycraft_events > 0:
		approach = "SPYCRAFT"
	return {
		"approach": approach,
		"escalation": escalation,
		"peak_escalation": peak_escalation,
		"marked": get_marked_target_label(),
		"cover": get_cover_status(),
		"spycraft_events": spycraft_events,
		"action_events": action_events,
	}

func q_lens_mark_nearest() -> bool:
	_resolve_player()
	if player == null:
		_feedback("Q-LENS", "Oyuncu hazır değil")
		return false
	var camera = player.get_node_or_null("CameraPivot/CameraSpring/PlayerCamera") as Camera3D
	if camera == null:
		_feedback("Q-LENS", "Kamera hazır değil")
		return false
	var best: Node = null
	var best_score = -9999.0
	var forward = -camera.global_transform.basis.z.normalized()
	for npc in _markable_npcs():
		if not (npc is Node3D):
			continue
		var to_target = (npc as Node3D).global_position + Vector3(0.0, 1.2, 0.0) - camera.global_position
		var distance = to_target.length()
		if distance <= 0.2 or distance > MARK_DISTANCE:
			continue
		var dot_value = forward.dot(to_target.normalized())
		if dot_value < 0.42:
			continue
		var score = dot_value * 3.0 - distance * 0.035
		if bool(npc.get_meta("action_enabled", false)):
			score += 0.75
		if score > best_score:
			best_score = score
			best = npc
	if best == null:
		_feedback("Q-LENS", "İşaretlenecek kişi bulunamadı")
		return false
	_clear_mark()
	marked_target = best
	marked_target.set_meta("q_lens_marked", true)
	marked_target.set_meta("action_label", _target_label(marked_target))
	_build_mark_label(marked_target)
	spycraft_events += 1
	_report_mission_event("SPYCRAFT_MARK")
	target_marked.emit(get_marked_target_label())
	_feedback("Q-LENS", "%s işaretlendi" % get_marked_target_label())
	return true

func request_cover() -> bool:
	_resolve_player()
	if player == null:
		return false
	var cover = _nearest_cover(COVER_DISTANCE)
	if cover == null:
		_feedback("SİPER", "Yakında uygun siper noktası yok")
		return false
	cover_until_msec = Time.get_ticks_msec() + 4600
	active_cover_name = str(cover.get_meta("cover_label", cover.name)).left(24)
	spycraft_events += 1
	_report_mission_event("COVER")
	_feedback("SİPER", "%s · düşük profil etkin" % active_cover_name)
	return true

func contextual_action() -> bool:
	_resolve_player()
	if player == null:
		return false
	var target = _nearest_action_target(CLOSE_ACTION_DISTANCE)
	if target == null:
		return request_cover()
	return _resolve_close_action(target)

func _resolve_close_action(target: Node) -> bool:
	if not (target is Node3D):
		return false
	var current = str(target.get_meta("action_state", "CALM"))
	if current == "SURRENDER":
		_feedback("TAKTİK", "Hedef zaten teslim durumda")
		return false
	_set_npc_state(target, "STAGGERED")
	target.set_meta("action_state_until", Time.get_ticks_msec() + 1800)
	target.set_meta("stealth_suspicion", max(0.68, float(target.get_meta("stealth_suspicion", 0.0))))
	if target.has_method("set_ai_plan"):
		target.call("set_ai_plan", "cinematic_stagger", (target as Node3D).global_position, 0.0)
	action_events += 1
	_report_mission_event("CINEMATIC_CLOSE_ACTION")
	if awareness != null and awareness.has_method("emit_gameplay_noise"):
		awareness.call("emit_gameplay_noise", (target as Node3D).global_position, 5.0, "CINEMATIC_ACTION")
	_feedback("TAKTİK", "%s etkisizleştirildi" % _target_label(target))
	return true

func _process(delta: float) -> void:
	refresh_accum += delta
	if refresh_accum < 0.20:
		return
	refresh_accum = 0.0
	_resolve_player()
	_update_recovery_states()
	_update_escalation_from_awareness()
	_update_mark_label()
	if Time.get_ticks_msec() >= cover_until_msec:
		active_cover_name = ""

func _update_recovery_states() -> void:
	var now = Time.get_ticks_msec()
	for npc in _action_targets():
		if not npc.has_meta("action_state_until"):
			continue
		var until = int(npc.get_meta("action_state_until", 0))
		if until <= 0 or now < until:
			continue
		npc.remove_meta("action_state_until")
		var suspicion = float(npc.get_meta("stealth_suspicion", 0.0))
		if suspicion >= 0.78:
			_set_npc_state(npc, "SURRENDER")
		else:
			_set_npc_state(npc, "INVESTIGATE")

func _update_escalation_from_awareness() -> void:
	if awareness == null or not is_instance_valid(awareness):
		awareness = get_tree().get_first_node_in_group("awareness_system")
	if awareness == null or not awareness.has_method("get_alert_level"):
		return
	_on_alert_changed(str(awareness.call("get_alert_level")))

func _on_alert_changed(level: String) -> void:
	var next = "CLEAR"
	if level == "SUSPICIOUS":
		next = "WATCH"
	elif level == "SEARCHING":
		next = "SEARCH"
	elif level == "ALERT":
		next = "CHASE"
	if next == escalation:
		return
	escalation = next
	if int(ESCALATION_ORDER.get(escalation, 0)) > int(ESCALATION_ORDER.get(peak_escalation, 0)):
		peak_escalation = escalation
	_apply_npc_reactions()
	escalation_changed.emit(escalation)

func _apply_npc_reactions() -> void:
	_resolve_player()
	if player == null:
		return
	for npc in _civilian_npcs():
		if not (npc is Node3D):
			continue
		var npc3d = npc as Node3D
		var distance = npc3d.global_position.distance_to(player.global_position)
		if distance > 26.0:
			continue
		if escalation in ["SEARCH", "CHASE"]:
			npc.set_meta("action_state", "FLEE")
			var away = npc3d.global_position - player.global_position
			if away.length() < 0.2:
				away = Vector3.RIGHT
			var destination = npc3d.global_position + away.normalized() * 7.0
			if npc.has_method("set_ai_plan"):
				npc.call("set_ai_plan", "action_flee", destination, 0.24)
	for npc in _action_targets():
		if not (npc is Node3D):
			continue
		var distance = (npc as Node3D).global_position.distance_to(player.global_position)
		if distance > 26.0:
			continue
		if escalation == "CHASE" and distance <= 4.5:
			_set_npc_state(npc, "SURRENDER")
		elif escalation in ["WATCH", "SEARCH", "CHASE"]:
			_set_npc_state(npc, "INVESTIGATE")

func _set_npc_state(npc: Node, state_value: String) -> void:
	npc.set_meta("action_state", state_value)
	if state_value == "SURRENDER":
		npc.set_meta("stealth_suspicion", min(float(npc.get_meta("stealth_suspicion", 0.0)), 0.72))
		if npc.has_method("set_ai_plan") and npc is Node3D:
			npc.call("set_ai_plan", "action_surrender", (npc as Node3D).global_position, 0.0)
	_update_npc_state_label(npc, state_value)

func _update_npc_state_label(npc: Node, state_value: String) -> void:
	if not (npc is Node3D):
		return
	var existing = npc.get_node_or_null("ActionState71") as Label3D
	if state_value in ["CALM", "INVESTIGATE"]:
		if existing != null:
			existing.queue_free()
		return
	if existing == null:
		existing = Label3D.new()
		existing.name = "ActionState71"
		existing.position = Vector3(0.0, 2.18, 0.0)
		existing.font_size = 30
		existing.outline_size = 8
		existing.modulate = Color(0.95, 0.88, 0.70, 0.95)
		existing.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		(npc as Node3D).add_child(existing)
	match state_value:
		"SURRENDER": existing.text = "TESLİM"
		"STAGGERED": existing.text = "SENDELEDİ"
		"FLEE": existing.text = "KAÇIYOR"
		_: existing.text = state_value

func _build_mark_label(target: Node) -> void:
	if not (target is Node3D):
		return
	mark_label = Label3D.new()
	mark_label.name = "QLensMark71"
	mark_label.position = Vector3(0.0, 2.48, 0.0)
	mark_label.font_size = 32
	mark_label.outline_size = 9
	mark_label.modulate = Color(0.86, 0.94, 1.0, 0.96)
	mark_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	(target as Node3D).add_child(mark_label)
	_update_mark_label()

func _update_mark_label() -> void:
	if marked_target == null or not is_instance_valid(marked_target) or mark_label == null or not is_instance_valid(mark_label):
		return
	var state_value = str(marked_target.get_meta("action_state", "CALM"))
	mark_label.text = "Q · %s\n%s" % [get_marked_target_label(), state_value]

func _markable_npcs() -> Array:
	var out: Array = []
	for npc in _civilian_npcs():
		out.append(npc)
	for npc in _action_targets():
		if npc not in out:
			out.append(npc)
	return out

func _civilian_npcs() -> Array:
	return get_tree().get_nodes_in_group("ambient_city_citizen")

func _action_targets() -> Array:
	var out: Array = []
	for group_name in ["ambient_city_citizen", "relationship_npc"]:
		for npc in get_tree().get_nodes_in_group(group_name):
			if bool(npc.get_meta("action_enabled", false)) and npc not in out:
				out.append(npc)
	return out

func _nearest_action_target(max_distance: float) -> Node:
	_resolve_player()
	if player == null:
		return null
	var best: Node = null
	var best_distance = max_distance
	for npc in _action_targets():
		if not (npc is Node3D):
			continue
		var distance = (npc as Node3D).global_position.distance_to(player.global_position)
		if distance < best_distance:
			best_distance = distance
			best = npc
	return best

func _nearest_cover(max_distance: float) -> Node3D:
	_resolve_player()
	if player == null:
		return null
	var best: Node3D = null
	var best_distance = max_distance
	for node in get_tree().get_nodes_in_group("action_cover_point"):
		if not (node is Node3D):
			continue
		var distance = (node as Node3D).global_position.distance_to(player.global_position)
		if distance < best_distance:
			best_distance = distance
			best = node as Node3D
	return best

func _resolve_player() -> void:
	if player != null and is_instance_valid(player):
		return
	var node = get_tree().get_first_node_in_group("player")
	if node is Node3D:
		player = node

func _target_label(target: Node) -> String:
	var explicit = str(target.get_meta("display_name", ""))
	if explicit != "":
		return explicit.left(32)
	return target.name.replace("_", " ").left(32)

func _clear_mark() -> void:
	if mark_label != null and is_instance_valid(mark_label):
		mark_label.queue_free()
	mark_label = null
	if marked_target != null and is_instance_valid(marked_target):
		marked_target.set_meta("q_lens_marked", false)
	marked_target = null

func _report_mission_event(kind: String) -> void:
	if mission_system == null or not is_instance_valid(mission_system):
		mission_system = get_tree().get_first_node_in_group("mission_system")
	if mission_system != null and mission_system.has_method("report_cinematic_action"):
		mission_system.call("report_cinematic_action", kind)

func _feedback(kind: String, detail: String) -> void:
	action_feedback.emit(kind, detail)
	var p = get_tree().get_first_node_in_group("player")
	if p != null and p.has_method("show_status"):
		p.call("show_status", kind + " • " + detail, 1.5)
