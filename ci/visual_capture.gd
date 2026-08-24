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

	_assert_city_vehicles_clear_of_home()

	# Audit images must show the production art itself, not gameplay HUD/debug labels.
	_hide_audit_ui(world_scene)

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

func _assert_city_vehicles_clear_of_home() -> void:
	# The house footprint is near world origin. Dynamic city/law vehicles must never
	# remain there after startup; doing so physically blocks the player's corridor.
	for vehicle_name in ["CityBus18", "CityTaxi18", "PolicePatrolCar"]:
		var vehicle = world_scene.find_child(vehicle_name, true, false)
		if vehicle == null or not (vehicle is Node3D):
			_fail("Missing expected city vehicle: " + vehicle_name)
			continue
		var vehicle_3d = vehicle as Node3D
		var planar_distance = Vector2(vehicle_3d.global_position.x, vehicle_3d.global_position.z).length()
		print("CUMA_VEHICLE_SPAWN ", vehicle_name, " pos=", vehicle_3d.global_position, " planar=", "%.2f" % planar_distance)
		if planar_distance < 12.0:
			_fail(vehicle_name + " spawned inside/next to the home instead of its city route: " + str(vehicle_3d.global_position))

func _capture_view(view_name: String, camera_pos: Vector3, target: Vector3) -> void:
	audit_camera.global_position = camera_pos
	audit_camera.look_at(target, Vector3.UP)
	_log_nearby_geometry(view_name, camera_pos, 8.0)
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

func _hide_audit_ui(node: Node) -> void:
	if node is CanvasLayer:
		(node as CanvasLayer).visible = false
	elif node is Control:
		(node as Control).visible = false
	elif node is Label3D:
		(node as Label3D).visible = false
	for child in node.get_children():
		_hide_audit_ui(child)

func _log_nearby_geometry(view_name: String, center: Vector3, radius: float) -> void:
	var entries: Array[Dictionary] = []
	_collect_nearby_meshes(world_scene, center, radius, entries)
	entries.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return float(a.get("volume", 0.0)) > float(b.get("volume", 0.0))
	)
	print("CUMA_VISUAL_GEOMETRY_BEGIN ", view_name)
	for i in range(min(entries.size(), 28)):
		var entry: Dictionary = entries[i]
		print(
			"CUMA_VISUAL_GEOMETRY ", view_name,
			" path=", entry.get("path", ""),
			" pos=", entry.get("pos", Vector3.ZERO),
			" size=", entry.get("size", Vector3.ZERO),
			" dist=", "%.2f" % float(entry.get("distance", 0.0))
		)
	print("CUMA_VISUAL_GEOMETRY_END ", view_name)

func _collect_nearby_meshes(node: Node, center: Vector3, radius: float, entries: Array[Dictionary]) -> void:
	if node is MeshInstance3D:
		var mesh_instance = node as MeshInstance3D
		if mesh_instance.visible and mesh_instance.mesh != null:
			var distance = mesh_instance.global_position.distance_to(center)
			if distance <= radius:
				var local_size = mesh_instance.get_aabb().size
				var scale_value = mesh_instance.global_transform.basis.get_scale()
				var world_size = Vector3(
					abs(local_size.x * scale_value.x),
					abs(local_size.y * scale_value.y),
					abs(local_size.z * scale_value.z)
				)
				var max_extent = max(world_size.x, max(world_size.y, world_size.z))
				if max_extent >= 0.70:
					entries.append({
						"path": str(mesh_instance.get_path()),
						"pos": mesh_instance.global_position,
						"size": world_size,
						"distance": distance,
						"volume": world_size.x * world_size.y * world_size.z,
					})
	for child in node.get_children():
		_collect_nearby_meshes(child, center, radius, entries)

func _fail(message: String) -> void:
	capture_failed = true
	push_error("CUMA_VISUAL_AUDIT: " + message)
