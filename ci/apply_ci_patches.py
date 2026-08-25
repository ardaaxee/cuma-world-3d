#!/usr/bin/env python3
from __future__ import annotations

from apply_ci_patches_base import main as apply_existing_patches
from apply_cinematic_main_menu import main as apply_cinematic_menu
from apply_menu_extras import main as apply_menu_extras
from apply_field_ops_60 import main as apply_field_ops_60
from apply_audio_mix_61 import main as apply_audio_mix_61
from apply_hud_cleanup_62 import main as apply_hud_cleanup_62
from apply_field_ui_63 import main as apply_field_ui_63
from apply_music_center_64 import main as apply_music_center_64
from apply_visual_overhaul_50 import main as apply_visual_overhaul_50
from apply_visual_polish_51 import main as apply_visual_polish_51
from apply_city_visual_52 import main as apply_city_visual_52
from apply_character_50 import main as apply_character_50
from apply_startup_stability_65 import main as apply_startup_stability_65
from apply_cinematic_action_70 import main as apply_cinematic_action_70
from apply_cinematic_action_71 import main as apply_cinematic_action_71
from audio_mix_61_contract import main as check_audio_mix_61
from character_50_contract import main as check_character_50
from city_visual_52_contract import main as check_city_visual_52
from cinematic_action_70_contract import main as check_cinematic_action_70
from cinematic_action_71_contract import main as check_cinematic_action_71
from cinematic_menu_contract import main as check_cinematic_menu
from field_ops_60_contract import main as check_field_ops_60
from field_ui_63_contract import main as check_field_ui_63
from hud_cleanup_62_contract import main as check_hud_cleanup_62
from menu_extras_contract import main as check_menu_extras
from music_center_64_contract import main as check_music_center_64
from startup_stability_65_contract import main as check_startup_stability_65
from update_regression_contracts import main as update_regression_contracts
from visual_overhaul_50_contract import main as check_visual_overhaul_50
from visual_polish_51_contract import main as check_visual_polish_51


def main() -> None:
    # Preserve the established gameplay stack, then layer the cinematic shell,
    # Field Ops spycraft UX, mixer/Music Center, presentation upgrades and audited
    # high-detail CUMA rig. Startup Stability stays before the action stack so
    # Android launch remains lazy. Action 7.0 establishes the core contract; 7.1
    # then upgrades it with spatial cover, 3D Q-Lens markers and mission debrief.
    apply_existing_patches()
    update_regression_contracts()
    apply_cinematic_menu()
    apply_menu_extras()
    apply_field_ops_60()
    apply_audio_mix_61()
    apply_hud_cleanup_62()
    apply_field_ui_63()
    apply_music_center_64()
    apply_visual_overhaul_50()
    apply_visual_polish_51()
    apply_city_visual_52()
    apply_character_50()
    apply_startup_stability_65()
    apply_cinematic_action_70()
    check_cinematic_action_70()
    apply_cinematic_action_71()
    check_cinematic_action_71()
    check_audio_mix_61()
    check_character_50()
    check_city_visual_52()
    check_cinematic_menu()
    check_field_ops_60()
    check_field_ui_63()
    check_hud_cleanup_62()
    check_menu_extras()
    check_music_center_64()
    check_startup_stability_65()
    check_visual_overhaul_50()
    check_visual_polish_51()
    print("CI patch layer + cinematic menu + Field Ops 6.0 + Audio Mix 6.1 + HUD 6.2 + Field UI 6.3 + Music Center 6.4 + Visual 5.1 + City 5.2 + Character 5.1 + Startup Stability 6.5 + Cinematic Action 7.1 complete.")


if __name__ == "__main__":
    main()
