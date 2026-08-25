#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1] / "game"


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text and old not in text:
        print(f"RUNTIME ROUND2 ALREADY APPLIED: {label}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 source match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"RUNTIME ROUND2 APPLIED: {label}")


def run_ci_script(name: str) -> None:
    script = Path(__file__).with_name(name)
    if not script.is_file():
        raise SystemExit(f"missing ci/{name}")
    subprocess.run([sys.executable, str(script)], check=True)


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    run_ci_script("install_character_assets.py")
    for name in ("cuma.glb", "partner.glb"):
        target = ROOT / "assets" / "characters" / name
        if not target.is_file() or target.stat().st_size != 698560:
            raise SystemExit(f"installed character asset invalid: {target}")
    run_ci_script("inspect_imported_character.py")

    run_ci_script("install_high_character.py")
    high_target = ROOT / "assets" / "characters" / "cuma_high.glb"
    if not high_target.is_file() or high_target.stat().st_size != 6_675_064:
        raise SystemExit(f"high-detail character candidate invalid: {high_target}")
    run_ci_script("inspect_high_character.py")

    run_ci_script("apply_character_integration.py")
    run_ci_script("apply_character_overhaul2.py")
    run_ci_script("apply_test_contract_updates.py")

    player = (ROOT / "scripts" / "player_controller.gd").read_text(encoding="utf-8")
    remote = (ROOT / "scripts" / "together" / "remote_avatar.gd").read_text(encoding="utf-8")
    bridge = (ROOT / "scripts" / "imported_character_bridge.gd").read_text(encoding="utf-8")
    humanoid = (ROOT / "scripts" / "character" / "procedural_humanoid.gd").read_text(encoding="utf-8")
    for label, source in (("local player", player), ("remote partner", remote)):
        if "Vector3.ONE * 0.340030" not in source:
            raise SystemExit(f"{label} missing audited 1.78m rig scale")
        if "rotation_degrees.y = 180.0" not in source:
            raise SystemExit(f"{label} missing imported rig forward-axis correction")
    if "first_person = true" not in player:
        raise SystemExit("local camera must keep first-person production default until 3P art passes quality gate")
    if "first_person = imported_bridge == null" in player:
        raise SystemExit("low-poly imported rig must not force third-person on startup")
    if '"Work": ["working", "work"]' not in bridge:
        raise SystemExit("imported rig bridge missing Working animation mapping")
    if "animation_player.speed_scale = clamp(speed / 3.0" not in bridge:
        raise SystemExit("imported rig bridge missing locomotion playback-rate matching")

    if '"formal": true' not in player or '"shirt": Color("ece9e2")' not in player:
        raise SystemExit("Cuma premium formal profile is missing")
    if 'camera.position = Vector3(0.48, 0.08, 0.0)' not in player:
        raise SystemExit("cinematic shoulder camera offset is missing")
    if 'var last_visual_yaw = 0.0' not in player or 'turn_rate = yaw_delta / max(delta, 0.001)' not in player:
        raise SystemExit("player-to-rig turn-rate bridge is missing")
    for token in ['ShirtFront', 'LeftLapel', 'RightLapel', 'Tie', 'Belt']:
        if token not in humanoid:
            raise SystemExit(f"procedural premium clothing layer missing: {token}")
    if 'turn_rate: float = 0.0' not in humanoid or 'turn_blend = clamp(turn_rate * 0.085' not in humanoid:
        raise SystemExit("procedural cinematic counter-turn motion is missing")
    if 'var cadence = lerp(6.0, 9.7, run_blend)' not in humanoid:
        raise SystemExit("weighted cinematic locomotion cadence is missing")

    relationship = ROOT / "scripts" / "social" / "relationship_citizen.gd"
    replace_exact(
        relationship,
        '\tactive_route = [entry, ai_target] if entry != Vector3.ZERO and entry.distance_to(ai_target) > 0.8 else [ai_target]',
        '''\tactive_route.clear()
\tif entry != Vector3.ZERO and entry.distance_to(ai_target) > 0.8:
\t\tactive_route.append(entry)
\tactive_route.append(ai_target)''',
        "preserve Array[Vector3] typing in relationship NPC AI plan routes",
    )

    run_ci_script("apply_intelligence_stealth_70.py")
    run_ci_script("apply_cloudflare_foundation.py")
    print("CUMA RUNTIME ROUND2 PATCH: PASS")


if __name__ == "__main__":
    main()
