# Cinematic menu extras source

CUMA WORLD keeps its authoritative Godot project inside the versioned source ZIP and applies deterministic CI overlays/patches before tests and Android export.

`01_core.gdpart` through `04_ui_back.gdpart` are ordered source fragments for the persistent cinematic-menu UX layer. `ci/apply_menu_extras.py` concatenates them into `game/scripts/ui/cinematic_menu_extras.gd`, then wires the generated script into the already-patched menu, player controller, and mobile controls.

This split keeps the repository's packed-source workflow intact while making the added pause, audio, online-join, settings, accessibility, and control-preference behavior reviewable. `ci/menu_extras_contract.py`, the existing regression suite, the Godot parser/runtime smoke gates, and the Android ARM64 export verify the generated result.
