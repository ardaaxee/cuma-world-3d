#!/usr/bin/env python3
from __future__ import annotations

from apply_ci_patches_base import main as apply_existing_patches
from apply_cinematic_main_menu import main as apply_cinematic_menu
from cinematic_menu_contract import main as check_cinematic_menu


def main() -> None:
    # Keep the established production patch/regression stack intact first. The
    # menu is applied only after those contracts pass because it intentionally
    # moves player/HUD startup out of main._ready().
    apply_existing_patches()
    apply_cinematic_menu()
    check_cinematic_menu()
    print("CI patch layer + cinematic main menu complete.")


if __name__ == "__main__":
    main()
