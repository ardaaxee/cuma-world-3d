#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def rep(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"CHARACTER PATCH ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"CHARACTER PATCH APPLIED: {label}")


def main() -> None:
    humanoid = ROOT / "scripts/character/procedural_humanoid.gd"
    player = ROOT / "scripts/player_controller.gd"
    bridge = ROOT / "scripts/imported_character_bridge.gd"

    rep(humanoid,
        '\t\t"shoes": Color("101216"),\n\t\t"height_scale": 1.0,\n\t\t"shoulder_scale": 1.0,',
        '\t\t"shoes": Color("101216"),\n\t\t"shirt": Color("ece9e2"),\n\t\t"tie": Color("171a20"),\n\t\t"formal": false,\n\t\t"height_scale": 1.0,\n\t\t"shoulder_scale": 1.0,',
        "add premium clothing profile")

    rep(humanoid,
        '\t_sphere(pelvis, "PelvisForm", Vector3.ZERO, Vector3(0.235, 0.18, 0.19), pants, 0.90)\n\t_sphere(spine, "Waist", Vector3(0.0, 0.04, 0.0), Vector3(0.235, 0.27, 0.18), top.darkened(0.08), 0.92)\n\tchest_mesh = _sphere(chest, "ChestForm", Vector3(0.0, 0.05, 0.0), Vector3(0.285 * shoulder_scale, 0.30, 0.19), top, 0.90)',
        '\t_sphere(pelvis, "PelvisForm", Vector3.ZERO, Vector3(0.215, 0.165, 0.175), pants, 0.88)\n\t_sphere(spine, "Waist", Vector3(0.0, 0.04, 0.0), Vector3(0.205, 0.265, 0.165), top.darkened(0.07), 0.82)\n\tchest_mesh = _sphere(chest, "ChestForm", Vector3(0.0, 0.045, 0.0), Vector3(0.265 * shoulder_scale, 0.285, 0.175), top, 0.80)',
        "rebalance torso proportions")

    rep(humanoid,
        '\tshirt_meshes.append(_sphere(chest, "UpperChest", Vector3(0.0, 0.19, 0.0), Vector3(0.28 * shoulder_scale, 0.16, 0.185), top.lightened(0.025), 0.90))',
        '\tshirt_meshes.append(_sphere(chest, "UpperChest", Vector3(0.0, 0.185, 0.0), Vector3(0.265 * shoulder_scale, 0.145, 0.170), top.lightened(0.018), 0.80))\n\tif profile.get("formal", false) == true:\n\t\tvar shirt: Color = profile.get("shirt", Color("ece9e2"))\n\t\tvar tie: Color = profile.get("tie", Color("171a20"))\n\t\t_box(chest, "ShirtFront", Vector3(0.0, 0.105, -0.176), Vector3(0.105, 0.245, 0.018), shirt, 0.86)\n\t\t_box(chest, "Tie", Vector3(0.0, 0.065, -0.200), Vector3(0.030, 0.205, 0.012), tie, 0.72)\n\t\t_box(chest, "LeftLapel", Vector3(-0.080, 0.145, -0.192), Vector3(0.050, 0.190, 0.016), top.lightened(0.035), 0.78, Vector3(0.0,0.0,-17.0))\n\t\t_box(chest, "RightLapel", Vector3(0.080, 0.145, -0.192), Vector3(0.050, 0.190, 0.016), top.lightened(0.035), 0.78, Vector3(0.0,0.0,17.0))\n\t\t_box(pelvis, "Belt", Vector3(0.0, 0.115, -0.176), Vector3(0.215, 0.025, 0.018), Color("16181d"), 0.66)',
        "add suit shirt tie lapels belt")

    rep(humanoid,
        '\t_sphere(head, "HeadMesh", Vector3(0.0, 0.055, 0.0), Vector3(0.175, 0.225, 0.17), skin, 0.91)\n\t_sphere(head, "Jaw", Vector3(0.0, -0.045, -0.020), Vector3(0.155, 0.13, 0.155), skin.darkened(0.015), 0.91)',
        '\t_sphere(head, "HeadMesh", Vector3(0.0, 0.055, 0.0), Vector3(0.157, 0.218, 0.158), skin, 0.90)\n\t_sphere(head, "Jaw", Vector3(0.0, -0.048, -0.018), Vector3(0.143, 0.123, 0.142), skin.darkened(0.015), 0.90)\n\t_sphere(head, "EarL", Vector3(-0.158, 0.055, 0.0), Vector3(0.022, 0.050, 0.015), skin, 0.92)\n\t_sphere(head, "EarR", Vector3(0.158, 0.055, 0.0), Vector3(0.022, 0.050, 0.015), skin, 0.92)',
        "refine head silhouette")

    for old, new, label in [
        ('var shoulder_x = 0.305 * shoulder_scale', 'var shoulder_x = 0.292 * shoulder_scale', 'narrow shoulders'),
        ('0.058, 0.36, top, 0.91', '0.050, 0.38, top, 0.80', 'slimmer upper arms'),
        ('0.074, 0.50, pants, 0.94', '0.066, 0.52, pants, 0.84', 'longer slimmer thighs'),
        ('0.062, 0.46, pants.darkened(0.12), 0.94', '0.055, 0.49, pants.darkened(0.08), 0.86', 'longer slimmer shins'),
        ('var cadence = lerp(7.0, 11.5, run_blend)', 'var cadence = lerp(6.0, 9.7, run_blend)', 'weighted gait cadence'),
        ('var hip_amp = lerp(0.48, 0.78, run_blend)', 'var hip_amp = lerp(0.40, 0.68, run_blend)', 'weighted hip swing'),
        ('var arm_amp = lerp(0.52, 0.92, run_blend)', 'var arm_amp = lerp(0.38, 0.72, run_blend)', 'weighted arm swing'),
        ('lerp(0.018, 0.045, run_blend)', 'lerp(0.010, 0.027, run_blend)', 'reduce locomotion bounce'),
    ]:
        rep(humanoid, old, new, label)

    rep(humanoid,
        'func update_pose(delta: float, horizontal_speed: float, running: bool, vertical_velocity: float, grounded: bool, sitting: bool, look_pitch: float = 0.0) -> void:',
        'func update_pose(delta: float, horizontal_speed: float, running: bool, vertical_velocity: float, grounded: bool, sitting: bool, look_pitch: float = 0.0, turn_rate: float = 0.0) -> void:',
        "add cinematic turn rate")
    rep(humanoid,
        '\thead.rotation.x = lerp_angle(head.rotation.x, clamp(look_pitch * 0.23, -0.16, 0.14), min(1.0, delta * 6.0))',
        '\thead.rotation.x = lerp_angle(head.rotation.x, clamp(look_pitch * 0.23, -0.16, 0.14), min(1.0, delta * 6.0))\n\tvar turn_blend = clamp(turn_rate * 0.085, -0.22, 0.22)\n\thead.rotation.y = lerp_angle(head.rotation.y, -turn_blend * 0.72, min(1.0, delta * 7.0))\n\tchest.rotation.y = lerp_angle(chest.rotation.y, turn_blend * 0.42, min(1.0, delta * 7.0))',
        "add head chest counter turn")

    rep(humanoid,
        'func _material(color: Color, roughness: float) -> StandardMaterial3D:',
        'func _box(parent: Node3D, node_name: String, pos: Vector3, half_extents: Vector3, color: Color, roughness: float, rot_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:\n\tvar mi = MeshInstance3D.new()\n\tmi.name = node_name\n\tvar mesh = BoxMesh.new()\n\tmesh.size = half_extents * 2.0\n\tmi.mesh = mesh\n\tmi.position = pos\n\tmi.rotation_degrees = rot_deg\n\tmi.material_override = _material(color, roughness)\n\tparent.add_child(mi)\n\treturn mi\n\nfunc _material(color: Color, roughness: float) -> StandardMaterial3D:',
        "add clothing panel primitive")

    rep(player, 'var vehicle_seat = ""', 'var vehicle_seat = ""\nvar last_visual_yaw = 0.0', "track visual yaw")
    rep(player,
        '\t\t"shoes": Color("101216"),\n\t\t"height_scale": 1.0,\n\t\t"shoulder_scale": 1.04',
        '\t\t"shoes": Color("0c0e12"),\n\t\t"shirt": Color("ece9e2"),\n\t\t"tie": Color("16191f"),\n\t\t"formal": true,\n\t\t"height_scale": 1.0,\n\t\t"shoulder_scale": 1.02',
        "give Cuma formal premium profile")
    rep(player, 'camera_spring.spring_length = 4.65', 'camera_spring.spring_length = 4.25', "cinematic spring length")
    rep(player, '\tcamera.near = 0.05\n\tcamera_spring.add_child(camera)', '\tcamera.near = 0.05\n\tcamera.position = Vector3(0.48, 0.08, 0.0)\n\tcamera_spring.add_child(camera)', "shoulder camera offset")
    rep(player, '\t\tcamera.fov = 72.0', '\t\tcamera.position = Vector3.ZERO\n\t\tcamera.fov = 72.0', "reset first person camera offset")
    rep(player, '\t\tcamera_spring.spring_length = 4.85\n\t\tcamera_pivot.position = Vector3(0.0, 1.58, 0.0)\n\t\tcamera.fov = 63.0', '\t\tcamera_spring.spring_length = 4.25\n\t\tcamera_pivot.position = Vector3(0.0, 1.54, 0.0)\n\t\tcamera.position = Vector3(0.48, 0.08, 0.0)\n\t\tcamera.fov = 60.0', "premium third person framing")
    rep(player,
        '\tif procedural_rig != null and procedural_rig.has_method("update_pose"):\n\t\tprocedural_rig.update_pose(delta, horizontal_speed, running, velocity.y, is_on_floor(), sitting, camera_pitch)',
        '\tif procedural_rig != null and procedural_rig.has_method("update_pose"):\n\t\tvar yaw_delta = wrapf(rotation.y - last_visual_yaw, -PI, PI)\n\t\tvar turn_rate = yaw_delta / max(delta, 0.001)\n\t\tlast_visual_yaw = rotation.y\n\t\tprocedural_rig.update_pose(delta, horizontal_speed, running, velocity.y, is_on_floor(), sitting, camera_pitch, turn_rate)',
        "feed turn rate into procedural rig")

    rep(bridge,
        '\t_play_state(wanted, 0.16)',
        '\t_play_state(wanted, 0.16)\n\tif animation_player != null:\n\t\tif wanted == "Walk":\n\t\t\tanimation_player.speed_scale = clamp(speed / 2.8, 0.78, 1.22)\n\t\telif wanted == "Run":\n\t\t\tanimation_player.speed_scale = clamp(speed / 5.7, 0.85, 1.18)\n\t\telse:\n\t\t\tanimation_player.speed_scale = 1.0',
        "scale imported animation speed")

    print("CUMA CHARACTER OVERHAUL: PASS")


if __name__ == "__main__":
    main()
