extends Node3D

const ImportedCharacterBridge = preload("res://scripts/imported_character_bridge.gd")
const ProceduralHumanoidScript = preload("res://scripts/character/procedural_humanoid.gd")

var visual_root: Node3D
var imported_bridge: Node
var procedural_rig: Node3D
var elapsed := 0.0
var rest_y := 0.0

func setup() -> void:
	name = "MenuCharacter"
	visual_root = Node3D.new()
	visual_root.name = "CharacterVisual"
	add_child(visual_root)

	# Reuse the exact production character slot used by player_controller.gd.
	if FileAccess.file_exists("res://assets/characters/cuma.glb"):
		var resource = load("res://assets/characters/cuma.glb")
		if resource is PackedScene:
			var imported = resource.instantiate()
			imported.name = "ImportedCumaGLB"
			visual_root.add_child(imported)
			imported_bridge = Node.new()
			imported_bridge.name = "ImportedCharacterBridge"
			imported_bridge.set_script(ImportedCharacterBridge)
			add_child(imported_bridge)
			imported_bridge.setup(imported)
			if bool(imported_bridge.available):
				rest_y = position.y
				return
			imported.queue_free()
			imported_bridge.queue_free()
			imported_bridge = null

	# This is the game's existing organic fallback, not a menu-only placeholder.
	procedural_rig = Node3D.new()
	procedural_rig.name = "CumaOrganicRig"
	procedural_rig.set_script(ProceduralHumanoidScript)
	visual_root.add_child(procedural_rig)
	var gs = get_node_or_null("/root/GameState")
	var palette = gs.get_character_palette() if gs != null and gs.has_method("get_character_palette") else {
		"top": Color("263653"),
		"pants": Color("20293a"),
		"hair": Color("171819")
	}
	procedural_rig.setup({
		"skin": Color("d3a17f"),
		"top": palette.get("top", Color("263653")),
		"pants": palette.get("pants", Color("20293a")),
		"hair": palette.get("hair", Color("171819")),
		"shoes": Color("101216"),
		"height_scale": 1.0,
		"shoulder_scale": 1.04
	})
	if gs != null and procedural_rig.has_method("apply_hair_style"):
		procedural_rig.apply_hair_style(int(gs.hair_style))
	rest_y = position.y

func _process(delta: float) -> void:
	elapsed += delta
	# Preserve the real idle animation path. The procedural rig receives the same
	# locomotion pose API as gameplay with zero movement; the imported rig's bridge
	# owns its Idle clip itself.
	if procedural_rig != null and procedural_rig.has_method("update_pose"):
		procedural_rig.update_pose(delta, 0.0, false, 0.0, true, false, 0.0)
	rotation.y = sin(elapsed * 0.27) * 0.022
	position.y = rest_y + sin(elapsed * 0.92) * 0.004

func refresh_customization() -> void:
	var gs = get_node_or_null("/root/GameState")
	if gs == null or procedural_rig == null:
		return
	if procedural_rig.has_method("apply_palette"):
		procedural_rig.apply_palette(gs.get_character_palette())
	if procedural_rig.has_method("apply_hair_style"):
		procedural_rig.apply_hair_style(int(gs.hair_style))
