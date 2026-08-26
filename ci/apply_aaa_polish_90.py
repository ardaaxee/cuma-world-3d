#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1] / "game"
OVERLAY = Path(__file__).resolve().parent / "overlays" / "90"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"AAA90 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"AAA90 {label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"AAA90 APPLIED: {label}")


def copy_overlay() -> None:
    for source in OVERLAY.rglob("*"):
        if not source.is_file():
            continue
        relative = source.relative_to(OVERLAY)
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        print(f"AAA90 OVERLAY: {relative}")


def patch_player() -> None:
    path = ROOT / "scripts/player_controller.gd"
    replace_once(path, 'const TOUCH_SENSITIVITY = 0.0038\nconst MAX_STAMINA = 100.0', 'const TOUCH_SENSITIVITY = 0.0038\nconst MOVE_DEAD_ZONE = 0.10\nconst GROUND_ACCEL = 17.5\nconst GROUND_DECEL = 23.0\nconst AIR_ACCEL = 5.2\nconst LOOK_SMOOTH_SPEED = 18.0\nconst MAX_STAMINA = 100.0', "player feel constants")
    replace_once(path, 'var camera_land_kick = 0.0', 'var camera_land_kick = 0.0\nvar target_camera_pitch = deg_to_rad(-12.0)\nvar idle_visual_phase = 0.0', "player camera and idle state")
    replace_once(path, '\tprevious_grounded = is_on_floor()\n\t_load_menu_control_preferences()', '\tprevious_grounded = is_on_floor()\n\tfloor_snap_length = 0.28\n\tfloor_max_angle = deg_to_rad(46.0)\n\tfloor_stop_on_slope = true\n\tsafe_margin = 0.04\n\ttarget_camera_pitch = camera_pitch\n\t_load_menu_control_preferences()', "player slope and floor tuning")
    old_move = '''\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
\tvar move_input = mobile_move if mobile_move.length() > 0.04 else keyboard_move
\tif move_input.length() > 1.0:
\t\tmove_input = move_input.normalized()

\tvar direction = (transform.basis * Vector3(move_input.x, 0.0, move_input.y)).normalized()
\tvar wants_run = sprint_requested or Input.is_action_pressed("sprint")
\tvar running = wants_run and not crouched and stamina > 2.0 and direction.length() > 0.01
\tvar speed = CROUCH_SPEED if crouched else (RUN_SPEED if running else WALK_SPEED)

\tif running:
\t\tstamina = max(0.0, stamina - 19.0 * delta)
\telse:
\t\tstamina = min(MAX_STAMINA, stamina + 13.0 * delta)

\tif direction.length() > 0.01:
\t\tvelocity.x = move_toward(velocity.x, direction.x * speed, 24.0 * delta)
\t\tvelocity.z = move_toward(velocity.z, direction.z * speed, 24.0 * delta)
\telse:
\t\tvelocity.x = move_toward(velocity.x, 0.0, 30.0 * delta)
\t\tvelocity.z = move_toward(velocity.z, 0.0, 30.0 * delta)
'''
    new_move = '''\tvar keyboard_move = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
\tvar raw_move = mobile_move if mobile_move.length() > 0.02 else keyboard_move
\tvar move_input = _shape_move_input(raw_move)
\tvar input_strength = clamp(move_input.length(), 0.0, 1.0)
\tvar world_move = transform.basis * Vector3(move_input.x, 0.0, move_input.y)
\tvar direction = world_move.normalized() if world_move.length_squared() > 0.0001 else Vector3.ZERO
\tvar wants_run = sprint_requested or Input.is_action_pressed("sprint")
\tvar running = wants_run and not crouched and stamina > 2.0 and input_strength > 0.08
\tvar speed = CROUCH_SPEED if crouched else (RUN_SPEED if running else WALK_SPEED)

\tif running:
\t\tstamina = max(0.0, stamina - 19.0 * delta)
\telse:
\t\tstamina = min(MAX_STAMINA, stamina + 13.0 * delta)

\tvar target_horizontal = Vector2(direction.x, direction.z) * speed * input_strength
\tvar current_horizontal = Vector2(velocity.x, velocity.z)
\tvar accel = GROUND_ACCEL if is_on_floor() else AIR_ACCEL
\tif input_strength <= 0.001:
\t\taccel = GROUND_DECEL if is_on_floor() else AIR_ACCEL
\tcurrent_horizontal = current_horizontal.move_toward(target_horizontal, accel * delta)
\tvelocity.x = current_horizontal.x
\tvelocity.z = current_horizontal.y
'''
    replace_once(path, old_move, new_move, "analog acceleration and deceleration")
    replace_once(path, '\tif mobile_look != Vector2.ZERO:\n\t\t_apply_look(mobile_look, TOUCH_SENSITIVITY)\n\t\tmobile_look = Vector2.ZERO\n\n\tmove_and_slide()', '\tif mobile_look != Vector2.ZERO:\n\t\t_apply_look(mobile_look, TOUCH_SENSITIVITY)\n\t\tmobile_look = Vector2.ZERO\n\t_update_look_smoothing(delta)\n\n\tmove_and_slide()', "look smoothing tick")
    helpers = '''func _shape_move_input(value: Vector2) -> Vector2:
\tvar magnitude = clamp(value.length(), 0.0, 1.0)
\tif magnitude <= MOVE_DEAD_ZONE:
\t\treturn Vector2.ZERO
\tvar strength = (magnitude - MOVE_DEAD_ZONE) / (1.0 - MOVE_DEAD_ZONE)
\tstrength = smoothstep(0.0, 1.0, clamp(strength, 0.0, 1.0))
\treturn value.normalized() * strength

func _update_look_smoothing(delta: float) -> void:
\tcamera_pitch = lerp_angle(camera_pitch, target_camera_pitch, clamp(delta * LOOK_SMOOTH_SPEED, 0.0, 1.0))
\tif camera_pivot != null:
\t\tcamera_pivot.rotation.x = camera_pitch

func _update_imported_idle_life(delta: float, horizontal_speed: float) -> void:
\tif visual_root == null or imported_bridge == null:
\t\treturn
\tvar reduced_motion = false
\tvar extras = get_tree().get_first_node_in_group("cinematic_menu_extras")
\tif extras != null and extras.has_method("is_reduced_motion"):
\t\treduced_motion = bool(extras.call("is_reduced_motion"))
\tvar idle = is_on_floor() and horizontal_speed < 0.18 and not sitting and not activity_locked and not reduced_motion
\tif idle:
\t\tidle_visual_phase += delta
\t\tvar target_y = sin(idle_visual_phase * 1.65) * 0.0045
\t\tvisual_root.position.y = lerp(visual_root.position.y, target_y, clamp(delta * 3.2, 0.0, 1.0))
\t\tvisual_root.rotation.z = lerp_angle(visual_root.rotation.z, sin(idle_visual_phase * 0.72) * 0.004, clamp(delta * 2.0, 0.0, 1.0))
\telse:
\t\tvisual_root.position.y = lerp(visual_root.position.y, 0.0, clamp(delta * 6.0, 0.0, 1.0))
\t\tvisual_root.rotation.z = lerp_angle(visual_root.rotation.z, 0.0, clamp(delta * 6.0, 0.0, 1.0))

'''
    replace_once(path, 'func _update_camera_motion(delta: float, running: bool) -> void:', helpers + 'func _update_camera_motion(delta: float, running: bool) -> void:', "player feel helpers")
    replace_once(path, '\t\tvar target_fov = 76.0 if running and speed > 4.8 else 72.0', '\t\tvar target_fov = (74.2 if reduced_motion else 76.0) if running and speed > 4.8 else 72.0', "reduced-motion dynamic fov")
    replace_once(path, '\tif imported_bridge != null and imported_bridge.has_method("update_state"):\n\t\timported_bridge.update_state(horizontal_speed, running, is_on_floor(), velocity.y, sitting)', '\tif imported_bridge != null and imported_bridge.has_method("update_state"):\n\t\timported_bridge.update_state(horizontal_speed, running, is_on_floor(), velocity.y, sitting)\n\t_update_imported_idle_life(delta, horizontal_speed)', "imported idle life")
    replace_once(path, '''func _apply_look(delta: Vector2, sensitivity: float) -> void:
\tvar adjusted_sensitivity = sensitivity * look_sensitivity_multiplier
\tvar vertical_sign = -1.0 if invert_look_y else 1.0
\trotate_y(-delta.x * adjusted_sensitivity)
\tcamera_pitch = clamp(camera_pitch - delta.y * adjusted_sensitivity * vertical_sign, deg_to_rad(-55.0), deg_to_rad(48.0))
\tcamera_pivot.rotation.x = camera_pitch
''', '''func _apply_look(delta: Vector2, sensitivity: float) -> void:
\tvar adjusted_sensitivity = sensitivity * look_sensitivity_multiplier
\tvar vertical_sign = -1.0 if invert_look_y else 1.0
\trotate_y(-delta.x * adjusted_sensitivity)
\ttarget_camera_pitch = clamp(target_camera_pitch - delta.y * adjusted_sensitivity * vertical_sign, deg_to_rad(-55.0), deg_to_rad(48.0))
''', "smoothed look target")
    replace_once(path, 'face_fill.light_energy = 0.22', 'face_fill.light_energy = 0.11', "camera fill realism")


def patch_game_state() -> None:
    path = ROOT / "scripts/game_state.gd"
    replace_once(path, 'if normalized not in ["LOW", "MEDIUM", "HIGH"]:', 'if normalized not in ["AUTO", "LOW", "MEDIUM", "HIGH", "ULTRA"]:', "five graphics tiers")
    replace_once(path, '''func cycle_quality() -> String:
\tmatch quality_profile:
\t\t"LOW": set_quality("MEDIUM")
\t\t"MEDIUM": set_quality("HIGH")
\t\t_: set_quality("LOW")
\treturn quality_profile
''', '''func cycle_quality() -> String:
\tvar profiles = ["AUTO", "LOW", "MEDIUM", "HIGH", "ULTRA"]
\tvar index = profiles.find(quality_profile)
\tset_quality(profiles[(index + 1) % profiles.size()] if index >= 0 else "AUTO")
\treturn quality_profile
''', "five tier quality cycle")
    replace_once(path, 'quality_profile = loaded_quality if loaded_quality in ["LOW", "MEDIUM", "HIGH"] else "MEDIUM"', 'quality_profile = loaded_quality if loaded_quality in ["AUTO", "LOW", "MEDIUM", "HIGH", "ULTRA"] else "MEDIUM"', "five tier save restore")


def patch_home() -> None:
    path = ROOT / "scripts/world/production_home_builder.gd"
    replace_once(path, '\t_build_corridor_architecture()\n\t_build_living_room()', '\t_build_corridor_architecture()\n\t_build_aaa_architecture_details()\n\t_build_living_room()', "AAA architecture detail pass")
    replace_once(path, '\t_build_balcony_details()\n\t_build_soft_lighting()', '\t_build_balcony_details()\n\t_build_soft_lighting()\n\t_apply_aaa_render_budget()', "AAA render budget pass")
    methods = '''func _build_aaa_architecture_details() -> void:
\tvar trim = warm_white
\t_panel(Vector3(23.40, 0.12, 0.055), Vector3(0.0, 0.06, -8.82), trim)
\t_panel(Vector3(0.055, 0.12, 17.45), Vector3(-11.82, 0.06, 0.0), trim)
\t_panel(Vector3(0.055, 0.12, 17.45), Vector3(11.82, 0.06, 0.0), trim)
\tfor segment in [[-10.0, -8.0], [-4.0, -1.25], [1.25, 12.0]]:
\t\tvar x0 = float(segment[0])
\t\tvar x1 = float(segment[1])
\t\t_panel(Vector3(x1 - x0, 0.12, 0.055), Vector3((x0 + x1) * 0.5, 0.06, 8.82), trim)
\tvar threshold = _simple_material(Color("6f6258"), 0.56, 0.12)
\tfor z in [-5.3, 0.7, 5.0, 6.5, 8.2]:
\t\t_panel(Vector3(0.58, 0.018, 0.095), Vector3(-1.70, 0.024, z), threshold)
\t\t_panel(Vector3(0.58, 0.018, 0.095), Vector3(1.70, 0.024, z), threshold)
\t_panel(Vector3(1.95, 0.075, 0.22), Vector3(-7.10, 0.72, 8.76), stone)
\t_panel(Vector3(1.95, 0.075, 0.22), Vector3(-4.90, 0.72, 8.76), stone)

func _apply_aaa_render_budget() -> void:
\tvar meshes = root.find_children("*", "MeshInstance3D", true, false)
\tfor node in meshes:
\t\tvar mesh_instance = node as MeshInstance3D
\t\tif mesh_instance == null or mesh_instance.mesh == null:
\t\t\tcontinue
\t\tvar size = mesh_instance.mesh.get_aabb().size
\t\tvar scale_abs = Vector3(abs(mesh_instance.scale.x), abs(mesh_instance.scale.y), abs(mesh_instance.scale.z))
\t\tsize *= scale_abs
\t\tvar volume = max(0.0, size.x * size.y * size.z)
\t\tif volume < 0.0035:
\t\t\tmesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
\t\t\tmesh_instance.visibility_range_end = 28.0
\t\telif volume < 0.028:
\t\t\tmesh_instance.visibility_range_end = 44.0
\tfor node in root.find_children("*", "OmniLight3D", true, false):
\t\tif node is OmniLight3D:
\t\t\tnode.add_to_group("aaa_practical_light")

'''
    replace_once(path, 'func _floor_lamp(pos: Vector3) -> void:', methods + 'func _floor_lamp(pos: Vector3) -> void:', "architecture and render helpers")


def patch_main_glass() -> None:
    path = ROOT / "scripts/main.gd"
    replace_once(path, 'material.albedo_color = Color(0.62, 0.82, 0.95, 0.24)', 'material.albedo_color = Color(0.62, 0.78, 0.88, 0.28)', "glass visibility")
    replace_once(path, 'material.roughness = 0.08\n\tmaterial.metallic = 0.15', 'material.roughness = 0.12\n\tmaterial.metallic = 0.05\n\tmaterial.cull_mode = BaseMaterial3D.CULL_DISABLED', "glass response")


def main() -> None:
    copy_overlay()
    patch_player()
    patch_game_state()
    patch_home()
    patch_main_glass()
    print("CUMA WORLD AAA POLISH 9.0 P0: PASS")


if __name__ == "__main__":
    main()
