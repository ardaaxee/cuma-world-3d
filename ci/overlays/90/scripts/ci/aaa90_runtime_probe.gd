extends SceneTree

const PlayerScript = preload("res://scripts/player_controller.gd")
const JoystickScript = preload("res://scripts/virtual_joystick.gd")
const GraphicsScript = preload("res://scripts/graphics_manager.gd")

func _initialize() -> void:
	call_deferred("_run")

func _fail(message: String) -> void:
	push_error("AAA90_PROBE_FAIL: " + message)
	quit(1)

func _run() -> void:
	var player = PlayerScript.new()
	var dead = player._shape_move_input(Vector2(0.05, 0.0))
	if dead.length() > 0.0001:
		_fail("player movement dead-zone")
		return
	var half = player._shape_move_input(Vector2(0.55, 0.0))
	if half.length() <= 0.05 or half.length() >= 0.95:
		_fail("player analog shaping")
		return
	player.free()

	var joystick = JoystickScript.new()
	joystick.size = Vector2(110.0, 110.0)
	get_root().add_child(joystick)
	await process_frame
	if joystick._shape_direction(Vector2(0.08, 0.0)).length() > 0.0001:
		_fail("joystick dead-zone")
		return
	if joystick._shape_direction(Vector2(1.0, 0.0)).length() < 0.95:
		_fail("joystick full range")
		return
	joystick.queue_free()

	var gs = get_root().get_node_or_null("GameState")
	if gs != null:
		var previous = str(gs.quality_profile)
		gs.set_quality("AUTO")
		if str(gs.quality_profile) != "AUTO":
			_fail("AUTO profile")
			return
		gs.set_quality("ULTRA")
		if str(gs.quality_profile) != "ULTRA":
			_fail("ULTRA profile")
			return
		gs.set_quality(previous)

	var graphics = GraphicsScript.new()
	get_root().add_child(graphics)
	await process_frame
	graphics.apply_profile("AUTO")
	if graphics.get_resolved_profile() not in ["MEDIUM", "HIGH"]:
		_fail("AUTO resolution")
		return
	graphics.queue_free()

	print("AAA90_RUNTIME_PROBE: PASS")
	quit(0)
