extends SceneTree

const AwarenessScript = preload("res://scripts/stealth/awareness_system.gd")
const DirectorScript = preload("res://scripts/intelligence/spycraft_mission_director.gd")

func _init() -> void:
	var root_node = Node.new()
	root_node.name = "ProbeRoot"
	get_root().add_child(root_node)

	var player = Node3D.new()
	player.name = "PlayerProbe"
	player.add_to_group("player")
	root_node.add_child(player)

	var npc = Node3D.new()
	npc.name = "NPCProbe"
	npc.position = Vector3(2.0, 0.0, 0.0)
	npc.add_to_group("ambient_city_citizen")
	npc.set_meta("stealth_suspicion", 0.58)
	npc.set_meta("stealth_state", "SUSPICIOUS")
	root_node.add_child(npc)

	var awareness = Node.new()
	awareness.name = "AwarenessProbe"
	awareness.set_script(AwarenessScript)
	root_node.add_child(awareness)
	awareness.setup()
	var before = float(npc.get_meta("stealth_suspicion", 0.0))
	var result: Dictionary = awareness.apply_social_bluff(0.34, 7.5)
	var after = float(npc.get_meta("stealth_suspicion", 0.0))
	assert(bool(result.get("success", false)))
	assert(int(result.get("affected", 0)) == 1)
	assert(after < before)
	assert(float(awareness.get_global_suspicion()) >= 0.0)
	assert(float(awareness.get_global_suspicion()) <= 100.0)

	var director = Node.new()
	director.name = "DirectorProbe"
	director.set_script(DirectorScript)
	root_node.add_child(director)
	director.report_spycraft_action("OBSERVE")
	director.report_spycraft_action("GADGET", {"gadget": "SİNYAL TARAYICI"})
	var snapshot: Dictionary = director.get_snapshot()
	var metrics: Dictionary = snapshot.get("metrics", {})
	assert(int(metrics.get("observe", 0)) == 1)
	assert(int(metrics.get("gadget", 0)) == 1)
	assert(int(snapshot.get("creative_score", -1)) >= 0)
	print("SPYCRAFT91_RUNTIME_PROBE: PASS")
	quit(0)
