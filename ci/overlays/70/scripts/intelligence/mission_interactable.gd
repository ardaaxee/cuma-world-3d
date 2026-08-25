extends StaticBody3D

var mode = "objective"
var title = "Görev objesi"

func setup(mode_value: String, title_value: String) -> void:
	mode = mode_value
	title = title_value.left(80)
	collision_layer = 1
	collision_mask = 1
	var shape_node = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(0.72, 0.68, 0.42)
	shape_node.shape = shape
	add_child(shape_node)
	var mesh_node = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = Vector3(0.62, 0.12, 0.38)
	mesh_node.mesh = mesh
	mesh_node.position = Vector3(0.0, 0.18, 0.0)
	var material = StandardMaterial3D.new()
	if mode == "objective":
		material.albedo_color = Color("3b4752")
	elif mode.begins_with("route_"):
		material.albedo_color = Color("43545e")
	else:
		material.albedo_color = Color("56675c")
	material.roughness = 0.72
	mesh_node.material_override = material
	add_child(mesh_node)

func interact(player: Node) -> void:
	var mission = get_tree().get_first_node_in_group("mission_system")
	if mission == null:
		return
	if mode == "objective":
		if mission.mark_objective_complete():
			_show(player, "Kurgu teslimat kaydı doğrulandı")
		else:
			_show(player, "Önce intel topla ve yaklaşım rotası seç")
	elif mode == "extract":
		if mission.try_extract():
			_show(player, "Görev tamamlandı")
		else:
			_show(player, "Görev objesini tamamlamadan çıkış yapılamaz")
	elif mode == "briefing":
		mission.acknowledge_briefing()
		_show(player, "Briefing alındı • Recon Lens hazır")
	elif mode == "route_main":
		if mission.choose_route("main"):
			_show(player, "Ana giriş yaklaşımı seçildi")
		else:
			_show(player, "Bu yaklaşım için önce ilgili intel'i keşfet")
	elif mode == "route_side":
		if mission.choose_route("side"):
			_show(player, "Yan giriş yaklaşımı seçildi")
		else:
			_show(player, "Bu yaklaşım için önce ilgili intel'i keşfet")

func get_interaction_label() -> String:
	return title

func _show(player: Node, text: String) -> void:
	if player != null and player.has_method("show_status"):
		player.show_status(text)
