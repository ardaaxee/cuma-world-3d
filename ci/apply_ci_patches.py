#!/usr/bin/env python3
from __future__ import annotations

from apply_ci_patches_base import main as apply_existing_patches
from apply_cinematic_main_menu import main as apply_cinematic_menu
from apply_menu_extras import main as apply_menu_extras
from apply_visual_overhaul_50 import main as apply_visual_overhaul_50
from apply_character_50 import main as apply_character_50
from cinematic_menu_contract import main as check_cinematic_menu
from menu_extras_contract import main as check_menu_extras
from update_regression_contracts import main as update_regression_contracts
from visual_overhaul_50_contract import main as check_visual_overhaul_50


def main() -> None:
    # Keep the established production patch/regression stack intact first. The
    # cinematic menu and its persistent UX layer are applied after those systems,
    # then Visual Overhaul 5.0 upgrades rendering/camera/HUD and Character 5.0
    # promotes the audited high-detail rig while retaining the original fallback.
    apply_existing_patches()
    update_regression_contracts()
    apply_cinematic_menu()
    apply_menu_extras()
    apply_visual_overhaul_50()
    apply_character_50()
    check_cinematic_menu()
    check_menu_extras()
    check_visual_overhaul_50()
    print("CI patch layer + cinematic menu + Visual Overhaul 5.0 + Character 5.0 complete.")


if __name__ == "__main__":
    main()
