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


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"game directory not found: {ROOT}")

    installer = Path(__file__).with_name("install_character_assets.py")
    if not installer.is_file():
        raise SystemExit("missing ci/install_character_assets.py")
    subprocess.run([sys.executable, str(installer)], check=True)

    for name in ("cuma.glb", "partner.glb"):
        target = ROOT / "assets" / "characters" / name
        if not target.is_file() or target.stat().st_size != 698560:
            raise SystemExit(f"installed character asset invalid: {target}")

    character_integration = Path(__file__).with_name("apply_character_integration.py")
    if not character_integration.is_file():
        raise SystemExit("missing ci/apply_character_integration.py")
    subprocess.run([sys.executable, str(character_integration)], check=True)

    test_contracts = Path(__file__).with_name("apply_test_contract_updates.py")
    if not test_contracts.is_file():
        raise SystemExit("missing ci/apply_test_contract_updates.py")
    subprocess.run([sys.executable, str(test_contracts)], check=True)

    player = (ROOT / "scripts" / "player_controller.gd").read_text(encoding="utf-8")
    remote = (ROOT / "scripts" / "together" / "remote_avatar.gd").read_text(encoding="utf-8")
    bridge = (ROOT / "scripts" / "imported_character_bridge.gd").read_text(encoding="utf-8")
    for label, source in (("local player", player), ("remote partner", remote)):
        if "Vector3.ONE * 0.340030" not in source:
            raise SystemExit(f"{label} missing audited 1.78m rig scale")
        if "rotation_degrees.y = 180.0" not in source:
            raise SystemExit(f"{label} missing imported rig forward-axis correction")
    if "first_person = imported_bridge == null" not in player:
        raise SystemExit("local camera must prefer 3P only when verified imported rig is available")
    if '"Work": ["working", "work"]' not in bridge:
        raise SystemExit("imported rig bridge missing Working animation mapping")
    if "animation_player.speed_scale = clamp(speed / 3.0" not in bridge:
        raise SystemExit("imported rig bridge missing locomotion playback-rate matching")

    relationship = ROOT / "scripts" / "social" / "relationship_citizen.gd"

    # GDScript's conditional expression returns an untyped Array here. Assigning
    # that value to Array[Vector3] fails only when NPC Intelligence schedules a
    # meetup, so parser/import checks alone cannot catch it.
    replace_exact(
        relationship,
        '\tactive_route = [entry, ai_target] if entry != Vector3.ZERO and entry.distance_to(ai_target) > 0.8 else [ai_target]',
        '''\tactive_route.clear()
\tif entry != Vector3.ZERO and entry.distance_to(ai_target) > 0.8:
\t\tactive_route.append(entry)
\tactive_route.append(ai_target)''',
        "preserve Array[Vector3] typing in relationship NPC AI plan routes",
    )

    # Network foundation layer: adds the optional Cloudflare control plane without
    # replacing LAN/manual relay modes. This stays in the same deterministic patch
    # stack used by Android builds and Visual Audit.
    cloudflare = Path(__file__).with_name("apply_cloudflare_foundation.py")
    if not cloudflare.is_file():
        raise SystemExit("missing ci/apply_cloudflare_foundation.py")
    subprocess.run([sys.executable, str(cloudflare)], check=True)

    print("CUMA RUNTIME ROUND2 PATCH: PASS")


if __name__ == "__main__":
    main()
