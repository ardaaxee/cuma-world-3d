# CUMA WORLD — ChatGPT + Claude Code Shared Handoff

Active collaboration branch: `claude/full-game-development`
Do not modify: `main`
Runtime: TypeScript + Babylon.js + Capacitor Android
Authoritative gameplay runtime: `src/game/runtime11.ts`

## Current verified gameplay baseline

The Claude development branch was created from gameplay commit:
`3ac21061bb877936600ddb550a00bd0c35e2bdd4`

That baseline includes:
- mobile movement, RUN, JUMP, CROUCH
- third-person shoulder camera
- tactical cover
- staged mission: ACCESS -> MANIFEST -> VERIFY -> EXTRACT
- recon/intel
- route choice
- CCTV detection and bypass
- SCAN / SIGNAL JAM / DECOY gadgets
- NPC visual awareness
- last-known-position investigation
- coordinated security broadcasts/search
- physical side/service route and loading area
- graphics tiers and Android lifecycle handling

GitHub Actions run #128 (`33212850598`) for commit `3ac21061bb877936600ddb550a00bd0c35e2bdd4` completed successfully through TypeScript/Vite, Capacitor Android generation, Android 16 SDK, debug APK, Play AAB, hashes and artifact upload.

Do not claim real-device behavior from this CI result.

## Current Claude documentation layer

Read these before every milestone:
1. `CLAUDE.md` — repository/development contract
2. `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md` — long roadmap
3. `docs/CLAUDE_007_STYLE_GUIDE.md` — original cinematic spycraft design language
4. `docs/CLAUDE_NEXT_TASK.md` — the ONLY active implementation milestone

The style target is an original CUMA WORLD spy-thriller in the broad quality class of modern cinematic espionage games. Do not copy 007 First Light names, characters, story, dialogue, missions, UI, assets, animation, music, logos, source code or proprietary content.

## Collaboration rules

- Always re-read branch HEAD before editing.
- Apply minimal compatible changes; never overwrite a new file from an old snapshot.
- Reuse existing systems instead of creating duplicate mission/NPC/security/graphics/audio/HUD implementations.
- One coherent gameplay milestone per commit.
- Run `npm run build` before commit when environment allows.
- Fix TypeScript/Vite errors before stopping.
- After push, verify GitHub Actions for the exact new HEAD.
- Never claim APK/AAB success until workflow completion.
- Never claim device FPS, touch behavior, imported-character visual correctness or thermal performance without real-device evidence.
- Update this handoff after each completed milestone.

## Current architecture ownership

- `src/game/runtime11.ts`: production gameplay loop/camera/world integration
- `src/game/input.ts`: mobile input, run/jump/crouch
- `src/game/character.ts`: player collider/model/locomotion
- `src/game/mission.ts`: mission rules/state
- `src/game/npc.ts`: NPC awareness/patrol/investigation/security communication
- `src/game/security.ts`: CCTV/security camera gameplay
- `src/game/cover.ts`: tactical cover
- `src/game/gadgets.ts`: SCAN/JAM/DECOY
- `src/game/operation-depth.ts`: staged operation terminals/progress
- `src/game/world-expansion.ts`: physical service/loading route extension
- `src/game/visuals.ts`: visual/world polish owner
- `src/game/graphics.ts`: graphics/performance profiles
- `src/game/audio.ts`: gameplay audio
- `src/game/debrief.ts`: mission result/replay flow

Do not create parallel replacements unless a refactor is explicitly justified and preserves behavior.

## Active milestone

Implement `docs/CLAUDE_NEXT_TASK.md`:
**Hearing + Social Stealth Foundation**.

The milestone must add:
- player noise model
- NPC hearing integrated into existing investigation/search
- PUBLIC / STAFF / RESTRICTED zone suspicion foundation
- gradual recovery after leaving inappropriate zones

It must preserve current gadgets, cover, CCTV, routes, mission chain, controls, lifecycle and graphics tiers.

After implementation, STOP and report:
- commit SHA
- files changed
- behavior added
- `npm run build` result
- GitHub Actions run ID/status
- what still requires real-device testing

Do not automatically begin the next milestone until the active milestone is green.

## Planned next milestone after hearing/zone foundation

If the active milestone is green, ChatGPT will prepare the next Claude prompt for:
- physical back-office/security-room expansion
- reusable door/access state system
- social-stealth access opportunities
- intel-driven alternate routes

Do not start these early.
