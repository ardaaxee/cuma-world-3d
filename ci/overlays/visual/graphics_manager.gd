extends Node

func _ready() -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs != null:
		gs.quality_changed.connect(apply_profile)
		call_deferred("apply_profile", gs.quality_profile)

func apply_profile(profile: String) -> void:
	if profile not in ["LOW", "MEDIUM", "HIGH", "ULTRA"]:
		return
	_configure_viewport(profile)
	var high = profile in ["HIGH", "ULTRA"]
	var medium_or_high = profile != "LOW"
	for node in get_tree().get_nodes_in_group("quality_shadow"):
		if node is Light3D:
			node.shadow_enabled = medium_or_high
	for node in get_tree().get_nodes_in_group("quality_extra_light"):
		if node is Light3D:
			node.visible = medium_or_high
	for node in get_tree().get_nodes_in_group("quality_crowd"):
		if node.has_method("set_simulation_enabled"):
			node.set_simulation_enabled(medium_or_high)
		elif node is Node3D:
			node.visible = medium_or_high
	for node in get_tree().get_nodes_in_group("quality_traffic"):
		if node.has_method("set_simulation_enabled"):
			node.set_simulation_enabled(medium_or_high)
		elif node is Node3D:
			node.visible = medium_or_high
	var world_env = get_tree().get_first_node_in_group("world_environment")
	if world_env is WorldEnvironment and world_env.environment != null:
		world_env.environment.glow_enabled = high
		world_env.environment.fog_enabled = medium_or_high

# Quality is selected by the player, never by a specific phone model.
# Keep the Compatibility renderer usable on both Android and desktop.
func _configure_viewport(profile: String) -> void:
	var viewport = get_viewport()
	match profile:
		"LOW":
			viewport.msaa_3d = Viewport.MSAA_DISABLED
			viewport.mesh_lod_threshold = 4.0
			viewport.positional_shadow_atlas_size = 1024
		"MEDIUM":
			viewport.msaa_3d = Viewport.MSAA_2X
			viewport.mesh_lod_threshold = 2.0
			viewport.positional_shadow_atlas_size = 2048
		"HIGH":
			viewport.msaa_3d = Viewport.MSAA_4X
			viewport.mesh_lod_threshold = 1.0
			viewport.positional_shadow_atlas_size = 4096
		"ULTRA":
			viewport.msaa_3d = Viewport.MSAA_8X
			viewport.mesh_lod_threshold = 0.5
			viewport.positional_shadow_atlas_size = 4096
