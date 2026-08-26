extends Node

const PROFILES := ["AUTO", "LOW", "MEDIUM", "HIGH", "ULTRA"]

var requested_profile = "MEDIUM"
var resolved_profile = "MEDIUM"

func _ready() -> void:
	add_to_group("graphics_manager")
	var gs = get_node_or_null("/root/GameState")
	if gs != null:
		gs.quality_changed.connect(apply_profile)
		call_deferred("apply_profile", gs.quality_profile)

func apply_profile(profile: String) -> void:
	requested_profile = profile.to_upper()
	if requested_profile not in PROFILES:
		requested_profile = "MEDIUM"
	resolved_profile = _resolve_profile(requested_profile)
	var medium_plus = resolved_profile in ["MEDIUM", "HIGH", "ULTRA"]
	var high_plus = resolved_profile in ["HIGH", "ULTRA"]
	var ultra = resolved_profile == "ULTRA"

	for node in get_tree().get_nodes_in_group("quality_shadow"):
		if node is Light3D:
			node.shadow_enabled = medium_plus
	for node in get_tree().get_nodes_in_group("quality_extra_light"):
		if node is Light3D:
			node.visible = medium_plus
	for node in get_tree().get_nodes_in_group("quality_crowd"):
		if node.has_method("set_simulation_enabled"):
			node.set_simulation_enabled(medium_plus)
		elif node is Node3D:
			node.visible = medium_plus
	for node in get_tree().get_nodes_in_group("quality_traffic"):
		if node.has_method("set_simulation_enabled"):
			node.set_simulation_enabled(medium_plus)
		elif node is Node3D:
			node.visible = medium_plus
	for node in get_tree().get_nodes_in_group("quality_ultra_detail"):
		if node is Node3D:
			node.visible = ultra

	var world_env = get_tree().get_first_node_in_group("world_environment")
	if world_env is WorldEnvironment and world_env.environment != null:
		var env = world_env.environment
		env.glow_enabled = high_plus
		env.fog_enabled = medium_plus
		_set_if_present(env, "ssao_enabled", high_plus)
		_set_if_present(env, "ssil_enabled", ultra and not OS.has_feature("mobile"))
		_set_if_present(env, "volumetric_fog_enabled", ultra and not OS.has_feature("mobile"))

func get_requested_profile() -> String:
	return requested_profile

func get_resolved_profile() -> String:
	return resolved_profile

func _resolve_profile(profile: String) -> String:
	if profile != "AUTO":
		return profile
	# Mobile AUTO intentionally favors stable frametime over extra effects.
	return "MEDIUM" if OS.has_feature("mobile") else "HIGH"

func _set_if_present(object: Object, property_name: String, value: Variant) -> void:
	for info in object.get_property_list():
		if str(info.get("name", "")) == property_name:
			object.set(property_name, value)
			return
