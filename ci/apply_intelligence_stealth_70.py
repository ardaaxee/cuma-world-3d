#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1] / "game"
OVERLAY = Path(__file__).resolve().parent / "overlays" / "70"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"INTEL70 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"INTEL70 APPLIED: {label}")


def copy_overlay() -> None:
    if not OVERLAY.is_dir():
        raise SystemExit(f"missing overlay: {OVERLAY}")
    for source in OVERLAY.rglob("*"):
        if not source.is_file():
            continue
        relative = source.relative_to(OVERLAY)
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        print(f"INTEL70 OVERLAY: {relative}")


def patch_game_state() -> None:
    path = ROOT / "scripts/game_state.gd"
    replace_once(path,
        'const SAVE_PATH := "user://cuma_world_save_v19.cfg"\nconst LEGACY_SAVE_PATHS := ["user://cuma_world_save_v18.cfg", "user://cuma_world_save_v04.cfg", "user://cuma_world_save_v03.cfg"]',
        'const SAVE_PATH := "user://cuma_world_save_v70.cfg"\nconst LEGACY_SAVE_PATHS := ["user://cuma_world_save_v19.cfg", "user://cuma_world_save_v18.cfg", "user://cuma_world_save_v04.cfg", "user://cuma_world_save_v03.cfg"]',
        "version intelligence save path")
    replace_once(path,
        'var cyber_cases_completed: Array[String] = []',
        'var cyber_cases_completed: Array[String] = []\n\n# Intelligence & Stealth 7.0 - local mission knowledge. Intentionally not in shared snapshot.\nvar intel_discoveries: Dictionary = {}\nvar intelligence_missions: Dictionary = {}\nvar completed_intelligence_missions: Array[String] = []\nvar intelligence_routes: Dictionary = {}',
        "add intelligence state")
    replace_once(path,
        'cfg.set_value("cyber", "cases", cyber_cases_completed)\n\treturn cfg.save(SAVE_PATH)',
        'cfg.set_value("cyber", "cases", cyber_cases_completed)\n\tcfg.set_value("intelligence", "intel_discoveries", intel_discoveries)\n\tcfg.set_value("intelligence", "missions", intelligence_missions)\n\tcfg.set_value("intelligence", "completed", completed_intelligence_missions)\n\tcfg.set_value("intelligence", "routes", intelligence_routes)\n\treturn cfg.save(SAVE_PATH)',
        "save intelligence state")
    marker = '\tcall_deferred("_restore_world_states")\n\tstate_changed.emit()\n\treturn OK'
    load_block = '''\tintel_discoveries.clear()
\tvar loaded_intel: Variant = cfg.get_value("intelligence", "intel_discoveries", {})
\tif loaded_intel is Dictionary:
\t\tfor raw_id in loaded_intel.keys():
\t\t\tif intel_discoveries.size() >= 256:
\t\t\t\tbreak
\t\t\tvar clean_id = str(raw_id).strip_edges().to_lower().left(64)
\t\t\tvar entry: Variant = loaded_intel[raw_id]
\t\t\tif not clean_id.is_empty() and entry is Dictionary and entry.size() <= 8:
\t\t\t\tintel_discoveries[clean_id] = entry.duplicate(true)
\tintelligence_missions.clear()
\tvar loaded_missions: Variant = cfg.get_value("intelligence", "missions", {})
\tif loaded_missions is Dictionary:
\t\tfor raw_id in loaded_missions.keys():
\t\t\tif intelligence_missions.size() >= 48:
\t\t\t\tbreak
\t\t\tvar clean_id = str(raw_id).strip_edges().to_lower().left(64)
\t\t\tvar entry: Variant = loaded_missions[raw_id]
\t\t\tif not clean_id.is_empty() and entry is Dictionary and entry.size() <= 16:
\t\t\t\tintelligence_missions[clean_id] = entry.duplicate(true)
\tcompleted_intelligence_missions.clear()
\tvar loaded_completed: Variant = cfg.get_value("intelligence", "completed", [])
\tif loaded_completed is Array:
\t\tfor raw_id in loaded_completed.slice(0, 64):
\t\t\tvar clean_id = str(raw_id).strip_edges().to_lower().left(64)
\t\t\tif not clean_id.is_empty() and clean_id not in completed_intelligence_missions:
\t\t\t\tcompleted_intelligence_missions.append(clean_id)
\tintelligence_routes.clear()
\tvar loaded_routes: Variant = cfg.get_value("intelligence", "routes", {})
\tif loaded_routes is Dictionary:
\t\tfor raw_id in loaded_routes.keys():
\t\t\tif intelligence_routes.size() >= 48:
\t\t\t\tbreak
\t\t\tvar clean_id = str(raw_id).strip_edges().to_lower().left(64)
\t\t\tvar routes_value: Variant = loaded_routes[raw_id]
\t\t\tif not clean_id.is_empty() and routes_value is Array:
\t\t\t\tvar clean_routes: Array[String] = []
\t\t\t\tfor route in routes_value.slice(0, 12):
\t\t\t\t\tvar clean_route = str(route).strip_edges().to_lower().left(40)
\t\t\t\t\tif not clean_route.is_empty() and clean_route not in clean_routes:
\t\t\t\t\t\tclean_routes.append(clean_route)
\t\t\t\tintelligence_routes[clean_id] = clean_routes

'''
    replace_once(path, marker, load_block + marker, "load intelligence state")
    methods = '''func record_intel_discovery(intel_id: String, source: String, mission_id: String = "") -> void:
\tvar clean_id = intel_id.strip_edges().to_lower().left(64)
\tif clean_id.is_empty() or intel_discoveries.has(clean_id):
\t\treturn
\tintel_discoveries[clean_id] = {
\t\t"source": source.strip_edges().left(48),
\t\t"mission_id": mission_id.strip_edges().to_lower().left(64),
\t\t"day": world_day,
\t\t"time": time_of_day,
\t}
\tstate_changed.emit()

func is_intel_discovered(intel_id: String) -> bool:
\treturn intel_discoveries.has(intel_id.strip_edges().to_lower().left(64))

func set_intelligence_mission_state(mission_id: String, data: Dictionary) -> void:
\tvar clean_id = mission_id.strip_edges().to_lower().left(64)
\tif clean_id.is_empty() or data.size() > 16:
\t\treturn
\tintelligence_missions[clean_id] = data.duplicate(true)
\tstate_changed.emit()

func get_intelligence_mission_state(mission_id: String) -> Dictionary:
\tvar clean_id = mission_id.strip_edges().to_lower().left(64)
\tvar value: Variant = intelligence_missions.get(clean_id, {})
\treturn value.duplicate(true) if value is Dictionary else {}

func unlock_mission_route(mission_id: String, route_id: String) -> void:
\tvar clean_mission = mission_id.strip_edges().to_lower().left(64)
\tvar clean_route = route_id.strip_edges().to_lower().left(40)
\tif clean_mission.is_empty() or clean_route.is_empty():
\t\treturn
\tvar routes: Array = intelligence_routes.get(clean_mission, [])
\tif clean_route not in routes:
\t\troutes.append(clean_route)
\tintelligence_routes[clean_mission] = routes.slice(0, 12)
\tstate_changed.emit()

func complete_intelligence_mission(mission_id: String, result: Dictionary) -> void:
\tvar clean_id = mission_id.strip_edges().to_lower().left(64)
\tif clean_id.is_empty():
\t\treturn
\tvar stored = result.duplicate(true)
\tstored["state"] = "COMPLETE"
\tintelligence_missions[clean_id] = stored
\tif clean_id not in completed_intelligence_missions:
\t\tcompleted_intelligence_missions.append(clean_id)
\tstate_changed.emit()

'''
    replace_once(path, 'func _safe_world_position(value: Vector3) -> bool:', methods + 'func _safe_world_position(value: Vector3) -> bool:', "add intelligence state API")


def patch_player() -> None:
    path = ROOT / "scripts/player_controller.gd"
    replace_once(path, 'const RUN_SPEED = 6.4', 'const RUN_SPEED = 6.4\nconst CROUCH_SPEED = 2.25', "add crouch speed")
    replace_once(path, 'var vehicle_seat = ""', 'var vehicle_seat = ""\nvar crouched = false\nvar body_collider: CollisionShape3D', "add stealth player state")
    replace_once(path, '\tvar collider = CollisionShape3D.new()\n\tvar capsule = CapsuleShape3D.new()', '\tbody_collider = CollisionShape3D.new()\n\tvar capsule = CapsuleShape3D.new()', "retain player collider")
    replace_once(path, '\tcollider.shape = capsule\n\tcollider.position.y = 0.89\n\tadd_child(collider)', '\tbody_collider.shape = capsule\n\tbody_collider.position.y = 0.89\n\tadd_child(body_collider)', "wire retained collider")
    replace_once(path, '\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', '\tif Input.is_action_just_pressed("crouch"):\n\t\ttoggle_crouch()\n\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")', "keyboard crouch input")
    replace_once(path, '\tvar running = wants_run and stamina > 2.0 and direction.length() > 0.01\n\tvar speed = RUN_SPEED if running else WALK_SPEED', '\tvar running = wants_run and not crouched and stamina > 2.0 and direction.length() > 0.01\n\tvar speed = CROUCH_SPEED if crouched else (RUN_SPEED if running else WALK_SPEED)', "crouch locomotion")
    replace_once(path, '\t\tfootstep_distance = 0.0\n\t\tvar player = footstep_a if use_step_a else footstep_b', '\t\tfootstep_distance = 0.0\n\t\t_emit_stealth_footstep(horizontal_speed)\n\t\tvar player = footstep_a if use_step_a else footstep_b', "connect footsteps to gameplay noise")
    replace_once(path, '\t\tcamera_pivot.position = Vector3(0.0, 1.63, 0.0)', '\t\tcamera_pivot.position = Vector3(0.0, 1.18 if crouched else 1.63, 0.0)', "first person crouch camera")
    replace_once(path, '\t\tcamera_pivot.position = Vector3(0.0, 1.58, 0.0)', '\t\tcamera_pivot.position = Vector3(0.0, 1.16 if crouched else 1.58, 0.0)', "third person crouch camera")
    methods = '''func toggle_crouch() -> void:
\tif activity_locked or sitting or driving_vehicle != null:
\t\treturn
\tcrouched = not crouched
\tif body_collider != null and body_collider.shape is CapsuleShape3D:
\t\tvar capsule = body_collider.shape as CapsuleShape3D
\t\tcapsule.height = 1.24 if crouched else 1.78
\t\tbody_collider.position.y = 0.62 if crouched else 0.89
\t_apply_camera_mode()
\tshow_status("Gizli hareket" if crouched else "Normal duruş", 1.1)

func is_crouched() -> bool:
\treturn crouched

func toggle_observation_mode() -> void:
\tvar controller = get_tree().get_first_node_in_group("observation_controller")
\tif controller != null and controller.has_method("toggle"):
\t\tvar enabled = bool(controller.toggle())
\t\tshow_status("Recon Lens açık" if enabled else "Recon Lens kapalı", 1.0)

func get_stealth_visibility_factor() -> float:
\tvar factor = 0.68 if crouched else 1.0
\tvar gs = get_node_or_null("/root/GameState")
\tif gs != null and (float(gs.time_of_day) >= 20.0 or float(gs.time_of_day) < 6.0):
\t\tfactor *= 0.82
\treturn clamp(factor, 0.35, 1.0)

func _emit_stealth_footstep(horizontal_speed: float) -> void:
\tvar awareness = get_tree().get_first_node_in_group("awareness_system")
\tif awareness == null or not awareness.has_method("emit_gameplay_noise"):
\t\treturn
\tvar movement_factor = 1.25 if horizontal_speed > 5.3 else 0.85
\tif crouched:
\t\tmovement_factor = 0.48
\tvar radius = 4.2 * movement_factor * _surface_noise_multiplier()
\tawareness.emit_gameplay_noise(global_position, radius, "FOOTSTEP")

func _surface_noise_multiplier() -> float:
\tvar world = get_world_3d()
\tif world == null:
\t\treturn 1.0
\tvar query = PhysicsRayQueryParameters3D.create(global_position + Vector3(0.0, 0.12, 0.0), global_position - Vector3(0.0, 1.25, 0.0))
\tquery.collision_mask = 1
\tquery.exclude = [get_rid()]
\tvar hit = world.direct_space_state.intersect_ray(query)
\tif hit.is_empty():
\t\treturn 1.0
\tvar collider = hit.get("collider")
\tvar name = str(collider.name).to_lower() if collider is Node else ""
\tif "rug" in name or "carpet" in name or "halı" in name:
\t\treturn 0.62
\tif "tile" in name or "stone" in name or "concrete" in name or "porcelain" in name:
\t\treturn 1.15
\treturn 1.0

'''
    replace_once(path, 'func toggle_camera_mode() -> void:', methods + 'func toggle_camera_mode() -> void:', "add player stealth methods")


def patch_mobile() -> None:
    path = ROOT / "scripts/mobile_controls.gd"
    replace_once(path,
        '\tvar camera_button = _make_top_button("CAM", -64.0)\n\tcamera_button.pressed.connect(_on_camera_mode)\n\troot.add_child(camera_button)',
        '\tvar camera_button = _make_top_button("CAM", -64.0)\n\tcamera_button.pressed.connect(_on_camera_mode)\n\troot.add_child(camera_button)\n\n\tvar observation_button = _make_top_button("OBS", -364.0)\n\tobservation_button.pressed.connect(_on_observation_mode)\n\troot.add_child(observation_button)\n\n\tvar crouch_button = _make_button("GİZ", Vector2(-190.0, -178.0), Vector2(-126.0, -114.0))\n\tcrouch_button.pressed.connect(_on_crouch)\n\troot.add_child(crouch_button)',
        "add compact mobile stealth controls")
    handlers = '''func _on_observation_mode() -> void:
\tvar player = _player()
\tif player != null and player.has_method("toggle_observation_mode"):
\t\tplayer.toggle_observation_mode()

func _on_crouch() -> void:
\tvar player = _player()
\tif player != null and player.has_method("toggle_crouch"):
\t\tplayer.toggle_crouch()

'''
    replace_once(path, 'func _on_move(value: Vector2) -> void:', handlers + 'func _on_move(value: Vector2) -> void:', "add stealth control handlers")


def patch_main() -> None:
    path = ROOT / "scripts/main.gd"
    replace_once(path,
        'const CrimeJusticeBuilderScript = preload("res://scripts/city/crime_justice_builder.gd")',
        'const CrimeJusticeBuilderScript = preload("res://scripts/city/crime_justice_builder.gd")\nconst IntelligenceStealthBuilderScript = preload("res://scripts/intelligence/intelligence_stealth_builder.gd")',
        "preload Intelligence 7.0 builder")
    replace_once(path, '\t_add_key_action("interact", KEY_E)', '\t_add_key_action("interact", KEY_E)\n\t_add_key_action("crouch", KEY_C)', "register crouch input")
    replace_once(path, '\t_build_crime_justice_19()\n\t_build_runtime_systems()', '\t_build_crime_justice_19()\n\t_build_intelligence_stealth_70()\n\t_build_runtime_systems()', "stage Intelligence 7.0 world")
    builder_func = '''func _build_intelligence_stealth_70() -> void:
\tvar builder = Node.new()
\tbuilder.name = "IntelligenceStealthBuilder70"
\tbuilder.set_script(IntelligenceStealthBuilderScript)
\tadd_child(builder)
\tbuilder.setup(self)

'''
    replace_once(path, 'func _build_cyber_ui_19() -> void:', builder_func + 'func _build_cyber_ui_19() -> void:', "add Intelligence 7.0 builder function")


def patch_relationship_ai() -> None:
    path = ROOT / "scripts/social/relationship_citizen.gd"
    old = '"weekend_outing", "celebration"]'
    new = '"weekend_outing", "celebration", "stealth_investigating", "stealth_returning"]'
    replace_once(path, old, new, "allow existing NPC navigation for investigation/return")


def patch_phone_objective() -> None:
    path = ROOT / "scripts/intelligence/mission_system.gd"
    replace_once(path,
        '\tif gs != null:\n\t\tgs.set_objective(text)',
        '\tif gs != null:\n\t\tgs.set_objective(text)\n\t\tgs.set("story_objective", text)',
        "keep existing mobile objective label in sync")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"missing extracted game directory: {ROOT}")
    copy_overlay()
    patch_game_state()
    patch_player()
    patch_mobile()
    patch_main()
    patch_relationship_ai()
    patch_phone_objective()
    print("CUMA INTELLIGENCE & STEALTH 7.0 PATCH: PASS")


if __name__ == "__main__":
    main()
