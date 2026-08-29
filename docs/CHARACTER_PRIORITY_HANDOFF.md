# Character Priority Handoff

Status: ACTIVE PRIORITY OVERRIDE.

The user explicitly reprioritized the realistic hero-character task ahead of the prepared mission-graph Milestone 05.

Authoritative active task: `docs/CLAUDE_NEXT_TASK.md`.
Reference specification: `docs/QUEUED_CHARACTER_REALISM.md`.

Rules:
- do NOT implement the paused Mission Graph / Opportunities / NPC Routines milestone in the same gameplay commit
- do NOT modify `main`
- do NOT create a PR
- preserve verified gameplay through Milestone 04
- extend the existing `PlayerCharacter` and `cuma_runtime.glb` packaging path; no second player controller
- procedural fallback remains mandatory
- current CI fallback `suited.glb` is a pinned CC0 MakeHuman/MPFB candidate and should be treated as a safe fallback/provenance baseline, not automatically described as the target-quality photoreal hero
- do not download or clone a random real person's likeness; use licensed anatomy/material references only
- final runtime remains Babylon.js + Capacitor Android

Current verified gameplay baseline: `6925ae171f0cff3aae1373a9c1149465db7a4a62`.
Milestone 04 CI: run `33246717365` (#132), completed SUCCESS with APK/AAB/artifact.

Current character pipeline facts:
- `src/game/character.ts` imports `./assets/characters/cuma_runtime.glb`
- authoritative collision is the existing 1.72 m capsule
- imported animation compatibility currently recognizes idle / walk / run
- `.github/workflows/android-play-runtime.yml` prefers archive `cuma_high.glb` / `cuma.glb`, otherwise installs pinned CC0 fallback
- `ci/install_high_character.py` fallback is 6,675,064-byte MakeHuman/MPFB `suited.glb`
- `ci/validate_android_character_glb.py` currently validates GLB v2, at least one mesh/skin, and idle/walk/run names

Character milestone must improve both:
1. art/asset production contract, and
2. runtime/CI validation contract.

After character milestone verification, the paused mission-graph work may be restored as the next task by ChatGPT.
