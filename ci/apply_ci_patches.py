#!/usr/bin/env python3
from __future__ import annotations

from apply_ci_patches_base import main as apply_existing_patches
from apply_cinematic_main_menu import main as apply_cinematic_menu
from apply_menu_extras import main as apply_menu_extras
from apply_field_ops_60 import main as apply_field_ops_60
from apply_visual_overhaul_50 import main as apply_visual_overhaul_50
from apply_visual_polish_51 import main as apply_visual_polish_51
from apply_city_visual_52 import main as apply_city_visual_52
from apply_character_50 import main as apply_character_50
from character_50_contract import main as check_character_50
from city_visual_52_contract import main as check_city_visual_52
from cinematic_menu_contract import main as check_cinematic_menu
from field_ops_60_contract import main as check_field_ops_60
from menu_extras_contract import main as check_menu_extras
from update_regression_contracts import main as update_regression_contracts
from visual_overhaul_50_contract import main as check_visual_overhaul_50
from visual_polish_51_contract import main as check_visual_polish_51


def main() -> None:
    # Preserve the established gameplay stack, then layer the cinematic shell,
    # Field Ops audio/spycraft UX, home/city presentation upgrades and audited
    # high-detail CUMA rig deterministically.
    apply_existing_patches()
    update_regression_contracts()
    apply_cinematic_menu()
    apply_menu_extras()
    apply_field_ops_60()
    apply_visual_overhaul_50()
    apply_visual_polish_51()
    apply_city_visual_52()
    apply_character_50()
    check_character_50()
    check_city_visual_52()
    check_cinematic_menu()
    check_field_ops_60()
    check_menu_extras()
    check_visual_overhaul_50()
    check_visual_polish_51()
    print("CI patch layer + cinematic menu + Field Ops 6.0 + Visual 5.1 + City 5.2 + Character 5.1 complete.")


if __name__ == "__main__":
    main()
