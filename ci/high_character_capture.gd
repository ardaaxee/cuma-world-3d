extends Node3D

const TARGET_HEIGHT := 1.78
var audit_camera: Camera3D
var failed := false

func _ready() -> void:
	var resource = load("res://assets/characters/cuma_high.glb")
	if not (resource is PackedScene):
		_fail("cuma_high.glb did not import as PackedScene")
		_finish()
		return

	var rig = (resource as PackedScene).instantiate() as Node3D
	if rig == null:
		_fail("cuma_high.glb root is not Node3D")
		_finish()
		return
	rig.name = "HighCharacterAuditModel"
	add_child(rig)
	for i in range(8):
		await get_tree().process_frame

	var skeleton = _find_skeleton(rig)
	if skeleton == null:
		_fail("high candidate contains no Skeleton3D")
		_finish()
		return
	var bounds = _skeleton_rest_bounds(skeleton)
	var rest_size: Vector3 = bounds.get("size", Vector3.ZERO)
	var rest_min: Vector3 = bounds.get("min", Vector3.ZERO)
	if rest_size.y <= 0.25:
		_fail("invalid high-character skeleton height: " + str(rest_size))
		_finish()
		return

	var scale_factor := TARGET_HEIGHT / rest_size.y
	rig.scale = Vector3.ONE * scale_factor
	rig.position.y = -rest_min.y * scale_factor
	# vsim manifest records this MakeHuman rig as facing +X. Turn +X -> +Z so
	# the exact same studio camera can judge it against CUMA's existing rigs.
	rig.rotation_degrees.y = -90.0
	print("CUMA_HIGH_GODOT_REST size=", rest_size, " scale=", "%.6f" % scale_factor, " y=", "%.6f" % rig.position.y)

	var player = _find_animation_player(rig)
	if player == null:
		_fail("high candidate contains no AnimationPlayer")
		_finish()
		return
	var names = player.get_animation_list()
	print("CUMA_HIGH_GODOT_ANIMATIONS ", names)
	for token in ["idle", "walk", "run", "wave"]:
		if _find_animation(player, [token]) == StringName():
			_fail("high candidate missing Godot animation token: " + token)
			_finish()
			return

	_build_stage()
	var idle = _find_animation(player, ["idle"])
	player.play(idle)
	player.seek(0.35, true)
	for i in range(6):
		await get_tree().process_frame
	await _capture("visual_character_high_idle.png", Vector3(0.0, 1.08, 3.35), Vector3(0.0, 0.91, 0.0))

	var walk = _find_animation(player, ["walk"])
	player.play(walk)
	player.seek(0.42, true)
	for i in range(4):
		await get_tree().process_frame
	await _capture("visual_character_high_walk.png", Vector3(2.45, 1.10, 2.75), Vector3(0.0, 0.90, 0.0))
	_finish()

func _build_stage() -> void:
	var world_env = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("d9dde1")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("f7f4ef")
	env.ambient_light_energy = 0.78
	world_env.environment = env
	add_child(world_env)

	var key = DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-42.0, -28.0, 0.0)
	key.light_color = Color("fff0dc")
	key.light_energy = 1.05
	key.shadow_enabled = true
	add_child(key)
	var fill = OmniLight3D.new()
	fill.position = Vector3(-1.4, 1.25, 2.1)
	fill.light_color = Color("d8e7ff")
	fill.light_energy = 0.44
	fill.omni_range = 5.0
	fill.shadow_enabled = false
	add_child(fill)

	var floor = MeshInstance3D.new()
	var floor_mesh = PlaneMesh.new()
	floor_mesh.size = Vector2(5.0, 5.0)
	floor.mesh = floor_mesh
	var floor_mat = StandardMaterial3D.new()
	floor_mat.albedo_color = Color("b9bdc2")
	floor_mat.roughness = 0.92
	floor.material_override = floor_mat
	add_child(floor)

	audit_camera = Camera3D.new()
	audit_camera.fov = 48.0
	audit_camera.near = 0.05
	audit_camera.current = true
	add_child(audit_camera)

func _capture(filename: String, camera_position: Vector3, target: Vector3) -> void:
	audit_camera.global_position = camera_position
	audit_camera.look_at(target, Vector3.UP)
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image = get_viewport().get_texture().get_image()
	if image == null or image.is_empty():
		_fail("empty high-character viewport for " + filename)
		return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://build"))
	var output = "res://build/" + filename
	var error = image.save_png(output)
	if error != OK:
		_fail("could not save " + output + ": " + str(error))
		return
	print("CUMA_HIGH_CHARACTER_CAPTURE -> ", output)

func _find_skeleton(root: Node) -> Skeleton3D:
	var skeletons = root.find_children("*", "Skeleton3D", true, false)
	return skeletons[0] as Skeleton3D if not skeletons.is_empty() else null

func _find_animation_player(root: Node) -> AnimationPlayer:
	var players = root.find_children("*", "AnimationPlayer", true, false)
	return players[0] as AnimationPlayer if not players.is_empty() else null

func _find_animation(player: AnimationPlayer, tokens: Array) -> StringName:
	for animation_name in player.get_animation_list():
		var lower = String(animation_name).to_lower()
		for token in tokens:
			if lower.contains(str(token).to_lower()):
				return animation_name
	return StringName()

func _skeleton_rest_bounds(skeleton: Skeleton3D) -> Dictionary:
	var min_v = Vector3(INF, INF, INF)
	var max_v = Vector3(-INF, -INF, -INF)
	for bone_idx in range(skeleton.get_bone_count()):
		var point = skeleton.global_transform * skeleton.get_bone_global_rest(bone_idx).origin
		min_v = min_v.min(point)
		max_v = max_v.max(point)
	return {"min": min_v, "max": max_v, "size": max_v - min_v}

func _fail(message: String) -> void:
	failed = true
	push_error("CUMA_HIGH_CHARACTER_AUDIT: " + message)

func _finish() -> void:
	if failed:
		get_tree().quit(2)
	else:
		print("CUMA_HIGH_CHARACTER_AUDIT_READY")
		get_tree().quit(0)
