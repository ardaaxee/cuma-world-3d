extends Node

var animation_player: AnimationPlayer
var animations: Dictionary = {}
var current_state = ""
var available = false
var action_until = 0
var locked_action = ""
var activity_state = ""
var was_grounded = true
var land_until = 0

const STATE_ALIASES := {
	"Idle": ["idle", "stand", "breath", "rest"],
	"Walk": ["walk", "walking", "locomotion"],
	"Run": ["run", "running", "sprint", "jog"],
	"Jump": ["jump", "jumping", "takeoff"],
	"Fall": ["fall", "falling", "air"],
	"Land": ["land", "landing"],
	"Sit": ["sit", "sitting", "seat"],
	"Wave": ["wave", "waving", "hello"],
	"Cheer": ["cheer", "celebrate", "victory"],
	"HighFive": ["highfive", "high_five", "high five"],
	"Work": ["working", "work"]
}

func setup(imported_root: Node) -> void:
	var players = imported_root.find_children("*", "AnimationPlayer", true, false)
	if players.is_empty():
		return
	animation_player = players[0] as AnimationPlayer
	if animation_player == null:
		return
	var names = animation_player.get_animation_list()
	for state in STATE_ALIASES.keys():
		var found = _find_animation(names, STATE_ALIASES[state])
		if found != StringName():
			animations[state] = found
	available = animations.has("Idle") or animations.has("Walk")
	if available:
		_play_state("Idle", 0.0)

func update_state(speed: float, running: bool, grounded: bool, vertical_velocity: float, sitting: bool) -> void:
	if not available or animation_player == null:
		return
	var now = Time.get_ticks_msec()
	if grounded and not was_grounded and animations.has("Land"):
		land_until = now + 320
	was_grounded = grounded
	if now < action_until and not locked_action.is_empty():
		return
	locked_action = ""
	if not activity_state.is_empty() and animations.has(activity_state):
		animation_player.speed_scale = 1.0
		_play_state(activity_state, 0.14)
		return

	var wanted = "Idle"
	if sitting and animations.has("Sit"):
		wanted = "Sit"
	elif now < land_until and animations.has("Land"):
		wanted = "Land"
	elif not grounded:
		if vertical_velocity > 0.15 and animations.has("Jump"):
			wanted = "Jump"
		elif animations.has("Fall"):
			wanted = "Fall"
		elif animations.has("Jump"):
			wanted = "Jump"
	elif speed > 0.22:
		if running and animations.has("Run"):
			wanted = "Run"
		elif animations.has("Walk"):
			wanted = "Walk"
		elif animations.has("Run"):
			wanted = "Run"
	elif animations.has("Idle"):
		wanted = "Idle"

	if wanted == "Walk":
		animation_player.speed_scale = clamp(speed / 3.1, 0.80, 1.30)
	elif wanted == "Run":
		animation_player.speed_scale = clamp(speed / 5.5, 0.88, 1.30)
	else:
		animation_player.speed_scale = 1.0
	_play_state(wanted, 0.14)

func set_activity_pose(pose: String) -> void:
	activity_state = ""
	if pose in ["work", "working", "career"] and animations.has("Work"):
		activity_state = "Work"
	if activity_state.is_empty():
		current_state = ""
	elif animation_player != null:
		animation_player.speed_scale = 1.0
		_play_state(activity_state, 0.14, true)

func play_emote(emote: String) -> void:
	if not available:
		return
	var state = ""
	match emote:
		"wave": state = "Wave"
		"cheer": state = "Cheer"
		"highfive": state = "HighFive"
	if state.is_empty() or not animations.has(state):
		return
	locked_action = state
	action_until = Time.get_ticks_msec() + 1400
	_play_state(state, 0.12, true)

func _play_state(state: String, blend: float, force: bool = false) -> void:
	if not animations.has(state) or animation_player == null:
		return
	if not force and current_state == state:
		return
	var animation_name: StringName = animations[state]
	animation_player.play(animation_name, blend)
	# The pinned high-detail MakeHuman idle clip has a wide-arm phase. Hold its
	# audited relaxed frame and let PlayerController add subtle whole-body idle life.
	if state == "Idle" and String(animation_name).to_lower() == "idle":
		animation_player.seek(0.35, true)
		animation_player.pause()
	current_state = state

func _find_animation(names: Array[StringName], tokens: Array) -> StringName:
	for name in names:
		var lower = String(name).to_lower()
		for token_value in tokens:
			var token = str(token_value).to_lower()
			if lower == token or lower.contains(token):
				return name
	return StringName()
