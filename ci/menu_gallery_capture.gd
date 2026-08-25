extends Node

var world_scene: Node
var menu: Node
var failed = false
var gallery_camera: Camera3D

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var packed = load("res://scenes/main.tscn") as PackedScene
	if packed == null:
		_fail("Could not load main scene")
		return
	world_scene = packed.instantiate()
	add_child(world_scene)
	for i in range(180):
		await get_tree().process_frame
	menu = world_scene.find_child("CinematicMainMenu", true, false)
	if menu == null:
		_fail("CinematicMainMenu not found")
		get_tree().quit(2)
		return

	await _capture("01_intro")
	await _set_menu_state_and_capture(2, "02_main_menu", 32)
	await _set_menu_state_and_capture(3, "03_multiplayer", 32)
	await _set_menu_state_and_capture(4, "04_character", 18)
	await _set_menu_state_and_capture(5, "05_world", 18)
	await _set_menu_state_and_capture(6, "06_settings", 32)

	var player = world_scene.call("_prepare_gameplay_from_menu") if world_scene.has_method("_prepare_gameplay_from_menu") else null
	if player == null:
		_fail("Could not prepare gameplay player")
	else:
		world_scene.call("_activate_gameplay_from_menu")
		var player_camera = player.get_node_or_null("CameraPivot/CameraSpring/PlayerCamera")
		if player_camera is Camera3D:
			(player_camera as Camera3D).current = true
		menu.call("_enter_persistent_playing_state")
		for i in range(24):
			await get_tree().process_frame
		await _capture("07_gameplay")

		var field_ops = get_tree().get_first_node_in_group("field_ops_runtime")
		if field_ops != null:
			if field_ops.has_method("_toggle_left_hud"):
				field_ops.call("_toggle_left_hud")
				for i in range(6):
					await get_tree().process_frame
				await _capture("19_field_ops_compact")
				field_ops.call("_toggle_left_hud")
				for i in range(5):
					await get_tree().process_frame
			if field_ops.has_method("_toggle_dossier"):
				field_ops.call("_toggle_dossier")
				for i in range(10):
					await get_tree().process_frame
				await _capture("18_field_ops_dossier")
				field_ops.call("_toggle_dossier")
				for i in range(4):
					await get_tree().process_frame

		var extras = menu.get("menu_extras")
		if extras != null:
			# Build the exact production pause UI without freezing the CI render loop.
			extras.set("paused_tree", false)
			menu.set("state", 9)
			extras.call("_build_pause_overlay")
			for i in range(12):
				await get_tree().process_frame
			await _capture("08_pause")
			var pause_overlay = extras.get("pause_overlay")
			if pause_overlay != null:
				pause_overlay.queue_free()
				extras.set("pause_overlay", null)
			menu.set("state", 8)
			for i in range(6):
				await get_tree().process_frame

		_hide_canvas_layers(world_scene)
		gallery_camera = Camera3D.new()
		gallery_camera.name = "MenuGalleryCamera"
		gallery_camera.fov = 66.0
		gallery_camera.near = 0.05
		add_child(gallery_camera)
		gallery_camera.current = true
		await _capture_view("09_corridor", Vector3(0.0, 1.58, 7.45), Vector3(0.0, 1.48, -3.8))
		await _capture_view("10_living_room", Vector3(-3.45, 1.62, 6.25), Vector3(-7.05, 1.02, 5.05))
		await _capture_view("11_kitchen", Vector3(3.35, 1.62, 5.70), Vector3(7.25, 1.08, 4.45))
		await _capture_view("12_bedroom", Vector3(-3.55, 1.62, -5.40), Vector3(-7.15, 0.95, -6.25))
		await _capture_player(player)
		# Final showcase angles are placed inside each room so nearby partitions
		# cannot block the subject and give a misleading quality read.
		await _capture_view("14_bathroom", Vector3(4.15, 1.55, 6.55), Vector3(8.15, 1.05, 7.85))
		await _capture_view("15_balcony", Vector3(-2.15, 1.62, 10.05), Vector3(-7.25, 0.95, 11.55))
		await _capture_view("16_entry", Vector3(0.0, 1.58, 5.80), Vector3(0.0, 1.30, 8.45))
		await _capture_view("17_city_center", Vector3(145.0, 4.8, 137.0), Vector3(169.0, 1.20, 125.5))

	if failed:
		get_tree().quit(2)
	else:
		print("CUMA_MENU_GALLERY_READY")
		get_tree().quit(0)

func _set_menu_state_and_capture(state_value: int, file_name: String, settle_frames: int) -> void:
	menu.call("_set_state", state_value)
	for i in range(settle_frames):
		await get_tree().process_frame
	await _capture(file_name)

func _capture(file_name: String) -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var image = get_viewport().get_texture().get_image()
	if image == null or image.is_empty():
		_fail("Empty viewport for " + file_name)
		return
	var build_dir = ProjectSettings.globalize_path("res://build/gallery")
	var dir_error = DirAccess.make_dir_recursive_absolute(build_dir)
	if dir_error != OK and dir_error != ERR_ALREADY_EXISTS:
		_fail("Could not create gallery directory")
		return
	var path = "res://build/gallery/" + file_name + ".png"
	var save_error = image.save_png(path)
	if save_error != OK:
		_fail("Could not save " + path)
		return
	print("CUMA_MENU_GALLERY_CAPTURE ", path)

func _capture_view(file_name: String, camera_pos: Vector3, target: Vector3) -> void:
	gallery_camera.global_position = camera_pos
	gallery_camera.look_at(target, Vector3.UP)
	for i in range(3):
		await get_tree().process_frame
	await _capture(file_name)

func _capture_player(player: Node) -> void:
	if not (player is Node3D):
		return
	var visual = player.find_child("CharacterVisual", true, false)
	if visual == null or not (visual is Node3D):
		return
	(visual as Node3D).visible = true
	(player as Node3D).global_position = Vector3(0.0, 0.02, 5.15)
	(player as Node3D).rotation_degrees.y = 0.0
	for i in range(5):
		await get_tree().process_frame
	await _capture_view("13_player_character", Vector3(0.0, 1.72, 8.35), Vector3(0.0, 1.02, 5.05))

func _hide_canvas_layers(node: Node) -> void:
	if node is CanvasLayer:
		(node as CanvasLayer).visible = false
	for child in node.get_children():
		_hide_canvas_layers(child)

func _fail(message: String) -> void:
	failed = true
	push_error("CUMA_MENU_GALLERY: " + message)
