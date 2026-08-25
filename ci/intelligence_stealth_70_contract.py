#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "game"


def fail(message: str) -> None:
    raise SystemExit(f"INTELLIGENCE 7.0 CONTRACT: FAIL: {message}")


def need(path: str, tokens: list[str]) -> str:
    target = ROOT / path
    if not target.is_file():
        fail(f"missing {path}")
    text = target.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            fail(f"{path} missing contract token: {token}")
    return text


def main() -> None:
    if not ROOT.is_dir():
        fail("extracted game directory missing")

    intel = need("scripts/intelligence/intel_system.gd", [
        "ALLOWED_CATEGORIES", "PERSON", "LOCATION", "OBJECT", "EVENT", "ROUTE", "CLUE", "ACCESS_POINT",
        "register_intel", "discover_intel", "relatedIntelIds", "missionId",
    ])
    observation = need("scripts/intelligence/observation_controller.gd", [
        "MAX_DISTANCE = 18.0", "CANDIDATE_DOT", "ANALYSIS_DOT", "intersect_ray", "collide_with_areas = true",
        "analysis_progress", "discover_intel",
    ])
    awareness = need("scripts/stealth/awareness_system.gd", [
        "UNAWARE", "CURIOUS", "SUSPICIOUS", "INVESTIGATING", "ALERTED", "RETURNING",
        "TICK_INTERVAL = 0.18", "MAX_AGENTS_PER_TICK = 6", "stealth_last_suspicious_position", "intersect_ray",
        "emit_gameplay_noise", "stealth_investigating", "stealth_returning",
    ])
    mission = need("scripts/intelligence/mission_system.gd", [
        "market_recon_70", "Sessiz Teslimat", "required_intel", "routes", "choose_route", "mark_objective_complete",
        "try_extract", "GHOST", "SHADOW", "OPERATIVE",
    ])
    need("scripts/intelligence/intelligence_stealth_builder.gd", [
        "MarketFrontIntel70", "MarketSideIntel70", "MarketRouteMain70", "MarketRouteSide70",
        "MarketMissionObjective70", "MarketMissionExtraction70",
    ])
    player = need("scripts/player_controller.gd", [
        "CROUCH_SPEED", "toggle_crouch", "toggle_observation_mode", "get_stealth_visibility_factor",
        "_emit_stealth_footstep", "_surface_noise_multiplier",
    ])
    mobile = need("scripts/mobile_controls.gd", ["OBS", "GİZ", "_on_observation_mode", "_on_crouch"])
    game_state = need("scripts/game_state.gd", [
        "cuma_world_save_v70.cfg", "intel_discoveries", "intelligence_missions", "intelligence_routes",
        "record_intel_discovery", "set_intelligence_mission_state", "complete_intelligence_mission",
    ])
    main_script = need("scripts/main.gd", [
        "IntelligenceStealthBuilderScript", "_build_intelligence_stealth_70()", '_add_key_action("crouch", KEY_C)',
    ])
    relationship = need("scripts/social/relationship_citizen.gd", ["stealth_investigating", "stealth_returning"])

    shared = game_state.split("func get_shared_snapshot() -> Dictionary:", 1)[1].split("\nfunc apply_shared_snapshot", 1)[0]
    for forbidden in ["intel_discoveries", "intelligence_missions", "intelligence_routes", "completed_intelligence_missions"]:
        if forbidden in shared:
            fail(f"local intelligence state leaked into shared multiplayer snapshot: {forbidden}")

    new_sources = "\n".join([intel, observation, awareness, mission])
    for forbidden in ["HTTPClient", "HTTPRequest", "PacketPeerUDP", "WebSocketPeer", "camera://", "content://", "http://", "https://"]:
        if forbidden in new_sources:
            fail(f"game-only intelligence code contains external-system token: {forbidden}")

    if "quality_profile" in awareness or "quality_profile" in observation:
        fail("stealth gameplay must not change by graphics tier")
    if re.search(r"get_nodes_in_group\(\"intel_target\"\).*_process", observation, re.S) is None:
        pass
    if "first_person" not in player:
        fail("existing camera controller was replaced instead of extended")
    if "JoystickScript" not in mobile:
        fail("existing mobile controller was replaced instead of extended")
    if "get_shared_snapshot" not in game_state:
        fail("existing multiplayer state architecture missing")
    if "set_ai_plan" not in relationship:
        fail("awareness investigation is not reusing existing NPC navigation")
    if "_build_crime_justice_19()\n\t_build_intelligence_stealth_70()" not in main_script:
        fail("Intelligence 7.0 must extend existing world build order")

    print("INTELLIGENCE 7.0 CONTRACT: PASS")


if __name__ == "__main__":
    main()
