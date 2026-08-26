extends Node3D

const TARGET_HEIGHT := 1.78
var camera: Camera3D
var rig: Node3D
var player: AnimationPlayer
var failed = false

func _ready() -> void:
	var resource = load("res://assets/characters/cuma_high.glb")
	if not (resource is PackedScene):
		_fail("cuma_high.glb not PackedScene")
		_finish()
		return
	rig = (resource as PackedScene).instantiate() as Node3D
	if rig == null:
		_fail("high rig root not Node3D")
		_finish()
		return
	add_child(rig)
	for i in range(6):
		await get_tree().process_frame
	var skeletons = rig.find_children("*", "Skeleton3D", true, false)
	if skeletons.is_empty():
		_fail("no Skeleton3D")
		_finish()
		return
	var skeleton = skeletons[0] as Skeleton3D
	var min_v = Vector3(INF, INF, INF)
	var max_v = Vector3(-INF, -INF, -INF)
	for bone_idx in range(skeleton.get_bone_count()):
		var p = skeleton.global_transform * skeleton.get_bone_global_rest(bone_idx).origin
		min_v = min_v.min(p)
		max_v = max_v.max(p)
	var scale_factor = TARGET_HEIGHT / (max_v.y - min_v.y)
	rig.scale = Vector3.ONE * scale_factor
	rig.position.y = -min_v.y * scale_factor
	print("CUMA_HIGH_ORIENTATION_NORMALIZATION scale=", "%.6f" % scale_factor, " y=", "%.6f" % rig.position.y)
	var players = rig.find_children("*", "AnimationPlayer", true, false)
	if players.is_empty():
		_fail("no AnimationPlayer")
		_finish()
		return
	player = players[0] as AnimationPlayer
	var idle = _find_animation("idle")
	if idle == StringName():
		_fail("idle missing")
		_finish()
		return
	player.play(idle)
	player.seek(0.35, true)
	_build_stage()
	for yaw in [0.0, 90.0, 180.0, -90.0]:
		rig.rotation_degrees.y = yaw
		for i in range(3):
			await get_tree().process_frame
		await _capture("visual_high_yaw_%s.png" % _yaw_name(yaw))
	_finish()

func _build_stage() -> void:
	var world_env = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("cfd4da")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("f6f2eb")
	env.ambient_light_energy = 0.72
	world_env.environment = env
	add_child(world_env)
	var key = DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-38.0, -25.0, 0.0)
	key.light_color = Color("fff0dc")
	key.light_energy = 0.92
	key.shadow_enabled = true
	add_child(key)
	var floor = MeshInstance3D.new()
	var plane = PlaneMesh.new()
	plane.size = Vector2(5.5, 5.5)
	floor.mesh = plane
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color("b7bcc2")
	mat.roughness = 0.92
	floor.material_override = mat
	add_child(floor)
	camera = Camera3D.new()
	camera.position = Vector3(0.0, 1.18, 3.65)
	camera.fov = 43.0
	camera.near = 0.05
	camera.current = true
	camera.look_at(Vector3(0.0, 0.93, 0.0), Vector3.UP)
	add_child(camera)

func _capture(filename: String) -> void:
	await RenderingServer.frame_post_draw
	var image = get_viewport().get_texture().get_image()
	if image == null or image.is_empty():
		_fail("empty viewport " + filename)
		return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://build"))
	var err = image.save_png("res://build/" + filename)
	if err != OK:
		_fail("save failed " + filename)
	else:
		print("CUMA_HIGH_ORIENTATION_CAPTURE ", filename)

func _find_animation(token: String) -> StringName:
	for animation_name in player.get_animation_list():
		if String(animation_name).to_lower().contains(token):
			return animation_name
	return StringName()

func _yaw_name(yaw: float) -> String:
	if yaw == -90.0:
		return "m90"
	return str(int(yaw))

func _fail(message: String) -> void:
	failed = true
	push_error("CUMA_HIGH_ORIENTATION: " + message)

func _finish() -> void:
	if failed:
		get_tree().quit(2)
	else:
		print("CUMA_HIGH_ORIENTATION_READY")
		get_tree().quit(0)
