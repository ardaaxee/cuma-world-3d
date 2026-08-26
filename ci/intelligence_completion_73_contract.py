#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game"

CHECKS = {
    "scripts/intelligence/intel_system.gd": [
        '"discoveredAt"', 'func get_connections(', 'func get_board_sections()',
        'func get_known_map_markers(', '"PEOPLE"', '"ROUTES"',
    ],
    "scripts/intelligence/mission_system.gd": [
        '"optional_completed"', '"camera_detections"', 'func get_optional_statuses(',
        'func get_briefing_data()', 'func get_coop_foundation_status()',
        '"mission_sync_enabled": false', 'market_cctv_front', 'market_cctv_side',
    ],
    "scripts/stealth/awareness_system.gd": [
        'func report_sensor_tracking(', 'func report_sensor_detection(',
        'func get_debug_snapshot(', '"RETURNING"] and value > 0.03',
        'stealth_investigate_until', 'MAX_AGENTS_PER_TICK = 6',
    ],
    "scripts/crime/security_camera.gd": [
        '"IDLE", "TRACKING", "DETECTED", "DISABLED_BY_GAMEPLAY"',
        'func can_observe(', 'func _has_line_of_sight(', 'field_of_view_degrees',
        'func set_disabled_by_gameplay(', 'OS.is_debug_build()', 'add_to_group("intel_target")',
    ],
    "scripts/ui/phone_ui.gd": [
        '"MISSIONS"', '"INTEL"', '"MAP"', 'func _refresh_intelligence_phone()',
        'get_board_sections', 'get_known_map_markers', 'KNOWN INTEL', 'CCTV',
    ],
    "scripts/intelligence/intelligence_debug_panel.gd": [
        'OS.is_debug_build()', 'KEY_F8', 'get_debug_snapshot', 'get_camera_state',
    ],
    "scripts/intelligence/intelligence_stealth_builder.gd": [
        'SecurityCameraScript', 'IntelligenceDebugPanelScript',
        'func _build_intelligence_73_environment()', 'MarketCCTVFront73', 'MarketCCTVSide73',
    ],
    "scripts/game_state.gd": [
        '"discovered_at": {"day": world_day, "time": time_of_day}',
        'func get_intel_discovery(', 'user://cuma_world_save_v70.cfg',
    ],
    "scripts/action/cinematic_action_hud.gd": [
        '"ACTION 7.3 · INTELLIGENCE"', 'RECON · %s', 'OPTIONAL  %d/%d', 'CCTV  %d',
    ],
    "scripts/ci/intelligence_73_runtime_probe.gd": [
        'OBS analyze discovers intel', 'OBS wall blocks LOS',
        'NPC staged visual suspicion reaches ALERTED', 'Gameplay noise raises suspicion',
        'CCTV wall obstruction blocks detection', 'Mission extraction completes',
        'Reload restores discovered intel', 'INTEL73_RUNTIME_PROBE: PASS',
    ],
}


def main() -> None:
    failures = []
    for relative, tokens in CHECKS.items():
        path = ROOT / relative
        if not path.exists():
            failures.append(f"missing {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                failures.append(f"{relative}: missing {token}")
    if failures:
        raise SystemExit("INTEL73 CONTRACT FAIL:\n" + "\n".join(failures))
    print("CUMA INTELLIGENCE COMPLETION 7.3 CONTRACT: PASS")


if __name__ == "__main__":
    main()
