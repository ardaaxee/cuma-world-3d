extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var manager = load("res://scripts/graphics_manager.gd").new()
	root.add_child(manager)
	await process_frame
	var gs = root.get_node("GameState")
	var profiles = ["LOW", "MEDIUM", "HIGH", "ULTRA"]
	var aa = [Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X, Viewport.MSAA_8X]
	var lod = [4.0, 2.0, 1.0, 0.5]
	gs.set_quality("LOW")
	for i in range(profiles.size()):
		assert(gs.quality_profile == profiles[i], "Quality cycle lost a tier")
		assert(root.msaa_3d == aa[i], "Anti-aliasing not applied")
		assert(root.mesh_lod_threshold == lod[i], "LOD not applied")
		gs.cycle_quality()
	assert(gs.quality_profile == "LOW", "Ultra must return to Low")
	gs.set_quality("invalid")
	assert(gs.quality_profile == "LOW", "Invalid tier accepted")
	var builder = load("res://scripts/world/production_home_builder.gd").new()
	var material = builder._pbr_material("oak", Color.WHITE, 0.7, 0.0, 3.0, 0.4)
	assert(material.uv1_triplanar and material.uv1_world_triplanar)
	assert(material.albedo_texture != null and material.normal_texture != null)
	builder.free()
	print("CUMA VISUAL FOUNDATION RUNTIME: PASS")
	quit()
