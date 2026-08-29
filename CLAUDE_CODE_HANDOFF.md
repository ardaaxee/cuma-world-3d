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

## Milestone 01 — Hearing + Social Stealth Foundation (verified)

Gameplay implementation HEAD: `74631edc4ca3f00ce94766c8450fc1c25eb78ee7`
Commit: `feat: add hearing and zone suspicion foundation`
Handoff HEAD after recording: `f61bfec31cd09ca7f78d0f13c12de928fded8283`

Files added:
- `src/game/noise.ts` — authoritative player noise model
- `src/game/zones.ts` — PUBLIC / STAFF / RESTRICTED access-zone model
- `src/game/stealth-signals.ts` — compact noise/zone HUD readout
- `src/stealth-signals.css`

Files changed:
- `src/game/npc.ts` — hearing folded into existing awareness/investigation
- `src/game/character.ts` — real landing feeds a noise burst
- `src/game/runtime11.ts` — feeds noise/zone models and owns the new HUD

Behaviour:
- crouched movement is materially quieter than walking/running
- NPC hearing works outside visual FOV and investigates sound origin
- footsteps cannot directly force ALERT
- DECOY remains stronger/more deliberate than ordinary movement noise
- PUBLIC / STAFF / RESTRICTED zone pressure is reusable and recovers after leaving inappropriate areas
- current zone is published through `document.body.dataset.zone`

Reusable API:
`classifyZone`, `getPlayerZone`, `getZoneSuspicion`, `setZoneAccessGranted`, `resetZonePresence`.

Validation:
- `npm run build` passed
- workflow dispatch run `33244096862` completed SUCCESS for gameplay commit `74631edc4ca3f00ce94766c8450fc1c25eb78ee7`
- TypeScript/Vite, native Android generation, Android 16 SDK, debug APK, Play AAB, SHA/build manifest and artifact upload all succeeded

No real-device behavior is claimed from CI.

## Requires real-device testing from Milestone 01

- noise/zone HUD readability in landscape
- hearing distances with touch movement
- STAFF/RESTRICTED suspicion tuning near objectives
- hearing occlusion-ray cost on MEDIUM/HIGH
- background/resume noise reset

## Active Milestone 02 — Directional Cover + Camera Stealth Polish

The only active implementation task is now `docs/CLAUDE_NEXT_TASK.md`.

Milestone 02 must refine the existing cover system rather than replace it:
- retain dominant cover surface normal/tangent
- make cover protection directional and based on real exposure/occlusion
- remove broad global stealth benefit when the player is actually exposed
- constrain cover movement naturally along the surface without a sticky rail
- RUN/JUMP must exit cover cleanly
- adapt the third-person shoulder camera to cover/open side while preserving camera collision
- keep compact protected/exposed feedback
- preserve Milestone 01 hearing and zone suspicion

Do not add another permanent action button.
Do not create a second movement, camera or visibility system.

Validation requirements:
- `npm run build`
- focused commit
- manually dispatch Android workflow against `claude/full-game-development` if necessary
- verify exact run for the gameplay commit
- stop after Milestone 02 and report before starting anything else

## Planned Milestone 03 after Milestone 02 is verified

ChatGPT will prepare the next prompt for world/access depth, expected to include:
- physical back-office/security/utility expansion
- reusable interactive door/access-state system
- credential/intel-driven access opportunities
- social-stealth use of PUBLIC/STAFF/RESTRICTED zones
- at least one additional physical route/loop with gameplay purpose

Do not start Milestone 03 early.
