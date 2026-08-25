extends Node3D

const TARGET_HEIGHT = 1.78
const BridgeScript = preload("res://scripts/imported_character_bridge.gd")

var model_root: Node3D
var bridge: Node
var audit_camera: Camera3D
var failed = false

func _ready() -> void:
	var resource = load("res://assets/characters/cuma.glb")
	if not (resource is PackedScene):
		_fail("cuma.glb did not import as PackedScene")
		_finish()
		return

	model_root = (resource as PackedScene).instantiate() as Node3D
	if model_root == null:
		_fail("cuma.glb root is not Node3D")
		_finish()
		return
	model_root.name = "CharacterAuditModel"
	add_child(model_root)

	for i in range(8):
		await get_tree().process_frame

	var mesh_bounds = _world_bounds(model_root)
	var mesh_size: Vector3 = mesh_bounds.get("size", Vector3.ZERO)
	print("CUMA_CHARACTER_ANIMATED_MESH_BOUNDS min=", mesh_bounds.get("min", Vector3.ZERO), " size=", mesh_size)

	var skeletons = model_root.find_children("*", "Skeleton3D", true, false)
	if skeletons.is_empty():
		_fail("Godot import contains no Skeleton3D")
		_finish()
		return
	var skeleton = skeletons[0] as Skeleton3D
	var rest_bounds = _skeleton_rest_bounds(skeleton)
	var rest_size: Vector3 = rest_bounds.get("size", Vector3.ZERO)
	var rest_min: Vector3 = rest_bounds.get("min", Vector3.ZERO)
	print("CUMA_CHARACTER_REST_BOUNDS min=", rest_min, " size=", rest_size, " bones=", skeleton.get_bone_count())
	# Compatibility marker for older CI checks. Rest-pose bounds are the canonical values.
	print("CUMA_CHARACTER_NATIVE_BOUNDS min=", rest_min, " size=", rest_size)
	if rest_size.y <= 0.10:
		_fail("character skeleton rest height is invalid: " + str(rest_size))
		_finish()
		return
	if rest_size.y <= rest_size.x or rest_size.y <= rest_size.z:
		_fail("character skeleton rest pose is not upright on Y axis: " + str(rest_size))
		_finish()
		return

	bridge = Node.new()
	bridge.name = "CharacterAuditBridge"
	bridge.set_script(BridgeScript)
	add_child(bridge)
	bridge.setup(model_root)
	if not bool(bridge.available):
		_fail("ImportedCharacterBridge could not map Idle/Walk animations")
		_finish()
		return

	var players = model_root.find_children("*", "AnimationPlayer", true, false)
	if players.is_empty():
		_fail("Godot import contains no AnimationPlayer")
		_finish()
		return
	var animation_player = players[0] as AnimationPlayer
	var names = animation_player.get_animation_list()
	print("CUMA_CHARACTER_GODOT_ANIMATIONS ", names)
	if names.size() < 2:
		_fail("Godot imported too few animation clips")
		_finish()
		return

	var scale_factor = TARGET_HEIGHT / rest_size.y
	model_root.scale = Vector3.ONE * scale_factor
	model_root.position.y = -rest_min.y * scale_factor
	print("CUMA_CHARACTER_RECOMMENDED_SCALE ", "%.6f" % scale_factor)
	print("CUMA_CHARACTER_RECOMMENDED_Y_OFFSET ", "%.6f" % (-rest_min.y * scale_factor))

	_build_stage()
	await _capture_state("idle", 0.0, false)
	await _capture_state("walk", 1.8, false)
	_finish()

func _build_stage() -> void:
	var environment = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("d9dde1")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("f7f4ef")
	env.ambient_light_energy = 0.78
	environment.environment = env
	add_child(environment)

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
	add_child(audit_camera)
	audit_camera.look_at_from_position(Vector3(0.0, 1.05, 3.25), Vector3(0.0, 0.92, 0.0), Vector3.UP)
	audit_camera.current = true

func _capture_state(label: String, speed: float, running: bool) -> void:
	bridge.update_state(speed, running, true, 0.0, false)
	for i in range(14):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image = get_viewport().get_texture().get_image()
	if image == null or image.is_empty():
		_fail("empty character viewport for " + label)
		return
	var build_dir = ProjectSettings.globalize_path("res://build")
	DirAccess.make_dir_recursive_absolute(build_dir)
	var output = "res://build/visual_character_" + label + ".png"
	var error = image.save_png(output)
	if error != OK:
		_fail("could not save " + output + ": " + str(error))
		return
	print("CUMA_CHARACTER_CAPTURE ", label, " -> ", output)

func _skeleton_rest_bounds(skeleton: Skeleton3D) -> Dictionary:
	var min_v = Vector3(INF, INF, INF)
	var max_v = Vector3(-INF, -INF, -INF)
	for bone_idx in range(skeleton.get_bone_count()):
		var point = skeleton.global_transform * skeleton.get_bone_global_rest(bone_idx).origin
		min_v = min_v.min(point)
		max_v = max_v.max(point)
	return {"min": min_v, "max": max_v, "size": max_v - min_v}

func _world_bounds(root: Node) -> Dictionary:
	var state = {
		"has": false,
		"min": Vector3(INF, INF, INF),
		"max": Vector3(-INF, -INF, -INF),
	}
	_collect_bounds(root, state)
	if not bool(state["has"]):
		return {"min": Vector3.ZERO, "max": Vector3.ZERO, "size": Vector3.ZERO}
	var min_v: Vector3 = state["min"]
	var max_v: Vector3 = state["max"]
	return {"min": min_v, "max": max_v, "size": max_v - min_v}

func _collect_bounds(node: Node, state: Dictionary) -> void:
	if node is MeshInstance3D:
		var mesh_instance = node as MeshInstance3D
		if mesh_instance.mesh != null:
			var box = mesh_instance.get_aabb()
			for x in [box.position.x, box.end.x]:
				for y in [box.position.y, box.end.y]:
					for z in [box.position.z, box.end.z]:
						var point = mesh_instance.global_transform * Vector3(x, y, z)
						state["min"] = (state["min"] as Vector3).min(point)
						state["max"] = (state["max"] as Vector3).max(point)
						state["has"] = true
	for child in node.get_children():
		_collect_bounds(child, state)

func _fail(message: String) -> void:
	failed = true
	push_error("CUMA_CHARACTER_AUDIT: " + message)

func _finish() -> void:
	if failed:
		get_tree().quit(2)
	else:
		print("CUMA_CHARACTER_AUDIT_READY")
		get_tree().quit(0)
