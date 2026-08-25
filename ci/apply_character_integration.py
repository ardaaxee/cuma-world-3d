#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"CHARACTER INTEGRATION ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"CHARACTER INTEGRATION APPLIED: {label}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    player = ROOT / "scripts" / "player_controller.gd"
    remote = ROOT / "scripts" / "together" / "remote_avatar.gd"
    bridge = ROOT / "scripts" / "imported_character_bridge.gd"

    # Skeleton-rest audit measured the pinned rig at 5.234836 units tall.
    # 1.78 / 5.234836 = 0.340030. The source character faces +Z while the
    # Godot controller moves forward along -Z, so live gameplay needs 180° Y.
    replace_exact(
        player,
        '''\t\t\tvar imported = resource.instantiate()\n\t\t\timported.name = "ImportedCumaGLB"\n\t\t\tvisual_root.add_child(imported)''',
        '''\t\t\tvar imported = resource.instantiate()\n\t\t\timported.name = "ImportedCumaGLB"\n\t\t\timported.scale = Vector3.ONE * 0.340030\n\t\t\timported.position.y = -0.000447\n\t\t\timported.rotation_degrees.y = 180.0\n\t\t\tvisual_root.add_child(imported)''',
        "normalize local rig scale, floor offset and forward axis",
    )

    # The current audited CC0 rig is technically sound but still visually too
    # low-poly/monochrome for a production default. Keep 1P as the safe default;
    # CAM can still reveal the fully animated normalized rig at any time.
    # The original source already uses first_person = true, so no source rewrite
    # is needed here; CI contracts below keep that behavior intentional.

    replace_exact(
        player,
        '''\tif procedural_rig != null and procedural_rig.has_method("set_activity_pose"):\n\t\tprocedural_rig.set_activity_pose(pose)\n\tshow_status(label + "...", seconds)''',
        '''\tif procedural_rig != null and procedural_rig.has_method("set_activity_pose"):\n\t\tprocedural_rig.set_activity_pose(pose)\n\tif imported_bridge != null and imported_bridge.has_method("set_activity_pose"):\n\t\timported_bridge.set_activity_pose(pose)\n\tshow_status(label + "...", seconds)''',
        "route timed activity poses to imported rig",
    )
    replace_exact(
        player,
        '''\tif procedural_rig != null and procedural_rig.has_method("set_activity_pose"):\n\t\tprocedural_rig.set_activity_pose("")\n\tactivity_locked = false''',
        '''\tif procedural_rig != null and procedural_rig.has_method("set_activity_pose"):\n\t\tprocedural_rig.set_activity_pose("")\n\tif imported_bridge != null and imported_bridge.has_method("set_activity_pose"):\n\t\timported_bridge.set_activity_pose("")\n\tactivity_locked = false''',
        "clear imported rig activity pose after timed activity",
    )

    replace_exact(
        remote,
        '''\t\t\tvar imported = resource.instantiate()\n\t\t\timported.name = "ImportedPartnerGLB"\n\t\t\tadd_child(imported)''',
        '''\t\t\tvar imported = resource.instantiate()\n\t\t\timported.name = "ImportedPartnerGLB"\n\t\t\timported.scale = Vector3.ONE * 0.340030\n\t\t\timported.position.y = -0.000447\n\t\t\timported.rotation_degrees.y = 180.0\n\t\t\tadd_child(imported)''',
        "normalize partner rig scale, floor offset and forward axis",
    )
    replace_exact(
        remote,
        '''\tlabel.position = Vector3(0.0, 2.65, 0.0)''',
        '''\tlabel.position = Vector3(0.0, 2.08, 0.0)''',
        "place partner nameplate above normalized 1.78m rig",
    )

    replace_exact(
        bridge,
        '''\t"HighFive": ["highfive", "high_five", "high five"]\n}''',
        '''\t"HighFive": ["highfive", "high_five", "high five"],\n\t"Work": ["working", "work"]\n}''',
        "map Working animation from pinned humanoid asset",
    )
    replace_exact(
        bridge,
        '''var locked_action = ""''',
        '''var locked_action = ""\nvar activity_state = ""''',
        "track imported rig activity state",
    )
    replace_exact(
        bridge,
        '''\tlocked_action = ""\n\tvar wanted = "Idle"''',
        '''\tlocked_action = ""\n\tif not activity_state.is_empty() and animations.has(activity_state):\n\t\tanimation_player.speed_scale = 1.0\n\t\t_play_state(activity_state, 0.14)\n\t\treturn\n\tvar wanted = "Idle"''',
        "keep imported rig in explicit activity clip while activity is active",
    )
    replace_exact(
        bridge,
        '''\telif animations.has("Idle"):\n\t\twanted = "Idle"\n\t_play_state(wanted, 0.16)''',
        '''\telif animations.has("Idle"):\n\t\twanted = "Idle"\n\tif wanted == "Walk":\n\t\tanimation_player.speed_scale = clamp(speed / 3.0, 0.82, 1.35)\n\telif wanted == "Run":\n\t\tanimation_player.speed_scale = clamp(speed / 5.4, 0.90, 1.32)\n\telse:\n\t\tanimation_player.speed_scale = 1.0\n\t_play_state(wanted, 0.16)''',
        "match walk and run playback rate to controller velocity",
    )
    replace_exact(
        bridge,
        '''func play_emote(emote: String) -> void:''',
        '''func set_activity_pose(pose: String) -> void:\n\tactivity_state = ""\n\tif pose in ["work", "working", "career"] and animations.has("Work"):\n\t\tactivity_state = "Work"\n\tif activity_state.is_empty():\n\t\tcurrent_state = ""\n\telif animation_player != null:\n\t\tanimation_player.speed_scale = 1.0\n\t\t_play_state(activity_state, 0.14, true)\n\nfunc play_emote(emote: String) -> void:''',
        "expose safe work activity pose on imported rig",
    )

    print("CUMA CHARACTER LIVE INTEGRATION: PASS")


if __name__ == "__main__":
    main()
