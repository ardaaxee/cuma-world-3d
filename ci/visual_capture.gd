extends Node

var world_scene: Node
var audit_camera: Camera3D
var capture_failed := false

func _ready() -> void:
	var packed = load("res://scenes/main.tscn") as PackedScene
	if packed == null:
		_fail("Could not load res://scenes/main.tscn")
		return

	world_scene = packed.instantiate()
	add_child(world_scene)

	# Let staged world boot, materials, navigation and UI finish creating nodes.
	for i in range(140):
		await get_tree().process_frame

	audit_camera = Camera3D.new()
	audit_camera.name = "ProductionVisualAuditCamera"
	audit_camera.fov = 66.0
	audit_camera.near = 0.05
	add_child(audit_camera)
	audit_camera.current = true

	await _capture_view(
		"corridor",
		Vector3(0.0, 1.58, 7.45),
		Vector3(0.0, 1.48, -3.8)
	)
	await _capture_view(
		"living_room",
		Vector3(-3.45, 1.62, 6.25),
		Vector3(-7.05, 1.02, 5.05)
	)
	await _capture_view(
		"kitchen",
		Vector3(3.35, 1.62, 5.70),
		Vector3(7.25, 1.08, 4.45)
	)
	await _capture_view(
		"bedroom",
		Vector3(-3.55, 1.62, -5.40),
		Vector3(-7.15, 0.95, -6.25)
	)

	if capture_failed:
		get_tree().quit(2)
	else:
		print("CUMA_VISUAL_AUDIT_READY")
		get_tree().quit(0)

func _capture_view(view_name: String, camera_pos: Vector3, target: Vector3) -> void:
	audit_camera.global_position = camera_pos
	audit_camera.look_at(target, Vector3.UP)
	await get_tree().process_frame
	await get_tree().process_frame
	await RenderingServer.frame_post_draw

	var image = get_viewport().get_texture().get_image()
	if image == null or image.is_empty():
		_fail("Viewport image was empty for " + view_name)
		return

	var build_dir = ProjectSettings.globalize_path("res://build")
	var dir_error = DirAccess.make_dir_recursive_absolute(build_dir)
	if dir_error != OK and dir_error != ERR_ALREADY_EXISTS:
		_fail("Could not create visual build directory: " + str(dir_error))
		return

	var output_path = "res://build/visual_" + view_name + ".png"
	var save_error = image.save_png(output_path)
	if save_error != OK:
		_fail("Could not save " + output_path + ": " + str(save_error))
		return
	print("CUMA_VISUAL_CAPTURE ", view_name, " -> ", output_path)

func _fail(message: String) -> void:
	capture_failed = true
	push_error("CUMA_VISUAL_AUDIT: " + message)
