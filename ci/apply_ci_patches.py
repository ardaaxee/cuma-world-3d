#!/usr/bin/env python3
from __future__ import annotations

from apply_ci_patches_base import main as apply_existing_patches
from apply_cinematic_main_menu import main as apply_cinematic_menu
from apply_menu_extras import main as apply_menu_extras
from cinematic_menu_contract import main as check_cinematic_menu
from menu_extras_contract import main as check_menu_extras
from update_regression_contracts import main as update_regression_contracts


def main() -> None:
    # Keep the established production patch/regression stack intact first. The
    # cinematic menu and its persistent UX layer are applied only after those
    # contracts pass, so gameplay/world/network systems remain authoritative.
    apply_existing_patches()
    update_regression_contracts()
    apply_cinematic_menu()
    apply_menu_extras()
    check_cinematic_menu()
    check_menu_extras()
    print("CI patch layer + cinematic main menu + persistent UX extras complete.")


if __name__ == "__main__":
    main()
