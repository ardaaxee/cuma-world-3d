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

## Milestone 02 — Directional Cover + Camera Stealth Polish (verified)

Gameplay implementation HEAD: `89352a2f2a8e941f848c6c3737d19578cfe91e85`
Commit: `feat: refine directional cover and stealth camera`

Files changed (no new module; the existing cover system was extended in place):
- `src/game/cover.ts` — directional surface tracking and the protection API
- `src/game/npc.ts` — per-guard directional cover instead of a global multiplier
- `src/game/security.ts` — same for CCTV
- `src/game/runtime11.ts` — cover-guided movement and cover-aware shoulder camera
- `src/game/input.ts` — non-consuming jump peek so cover can exit first
- `src/cover.css` — exposed-state styling

Behaviour:
- Cover keeps a real dominant surface: geometric normal oriented surface -> player,
  the tangent along it, distance, and live contact.
- Surfaces tilted more than 45 degrees are rejected, so floors, the plaza slab
  and 30 cm curbs can never become cover.
- The contact probe sits at world ~0.70 so service-route crates (tops 0.90-1.32)
  register at all; a probe at world ~1.45 separates crate-height from full-height
  cover. Shelves and market walls read as full-height cover.
- Cover drops the instant the tracking probe misses, which is what makes walking
  past an edge lose protection.
- `coverProtection(observer)` scores how far an observer sits behind the surface:
  1 directly behind, ~0.13 side-on, 0 from the open side. Standing behind
  crate-height cover keeps only 35%; crouching restores it.
- NPC and CCTV awareness both consume this per observer. The old global 0.56 /
  0.52 multipliers are gone. Best case is 0.38x detection; an exposed player is
  detected exactly as if they had no cover.
- Movement is decomposed onto tangent/normal: along-surface preserved exactly,
  into-surface damped to 0.15, away-from-surface only to 0.85. Guided, not a rail.
- RUN or a queued JUMP releases cover before that movement is applied.
- Shoulder side follows the open side implied by the cover normal, behind a dead
  zone and an exponential blend. Reduced Motion slows the blends and cuts the
  camera pull-in to 40%. The existing camera collision resolver is untouched.
- Status distinguishes SİPER HAZIR / KORUNUYOR / AÇIKTA plus a ÇÖMEL hint, with
  no new panel and no new permanent button.

Reusable API:
`getCoverState`, `coverProtection`, `coverDetectionScale`, `releaseCover`,
`setCoverPaused`, `isInCover`, `isCoverReady`, `COVER_MAX_DETECTION_REDUCTION`.

Performance:
- The old tick rebuilt 8 direction vectors and 8 Rays and wrote the DOM every
  frame. Directions and the Ray are now module constants and the tick allocates
  nothing.
- Probing runs at 15 Hz while searching and 30 Hz while attached, replacing
  8 raycasts every frame with 8 at 15 Hz (searching) or 2 at 30 Hz (attached).
- DOM writes only when the displayed state changes.
- Cover raycasts stop entirely while paused; the ray filter is rebuilt only when
  the player collider changes rather than captured once at startup.

Milestone 01 systems verified untouched: noise model, NPC hearing, landing
impulses, zones, zone suspicion/recovery, DECOY priority, stealth signals HUD.
Because RUN now exits cover first, a sprint is heard at full loudness.

Validation:
- `npm run build` passed locally; boot chunk unchanged at 35087 bytes
- Android workflow dispatch run `33244796378` (run #130) for gameplay commit
  `89352a2f2a8e941f848c6c3737d19578cfe91e85`

  Completed SUCCESS in 2m38s (09:08:48 -> 09:11:27) through TypeScript/Vite,
  native Capacitor Android generation, Android 16 SDK, debug APK, Play AAB,
  SHA/build manifest and artifact upload.

  Artifact `CUMA-WORLD-Android-Play-Build`, 23689464 bytes,
  sha256 `804378bd1e25cbf4ec2cd6fed4c32b1ec2c121fd30eef65bd05b3500a5189351`.

  Note for whoever re-checks: this workflow's job-step API responses cache
  heavily and reported step 12 as still running for ~50 minutes after the run
  had actually finished. Confirm the real outcome from the run artifact and the
  job log, not from the step list.

No real-device behavior is claimed from CI.

## Requires real-device testing from Milestone 02

- whether the shoulder swap reads as intentional or busy while moving in cover
- whether cover guidance fights the joystick on a touch screen
- whether crate-height cover and the ÇÖMEL hint are discoverable
- camera clipping around the loading-bay crates and bay edge
- RUN/JUMP cover exits under real multitouch (joystick + look + action together)
- Reduced Motion camera feel
- cover probe cost on LOW/MEDIUM

## Planned Milestone 03 after Milestone 02 is verified

ChatGPT will prepare the next prompt for world/access depth, expected to include:
- physical back-office/security/utility expansion
- reusable interactive door/access-state system
- credential/intel-driven access opportunities
- social-stealth use of PUBLIC/STAFF/RESTRICTED zones
- at least one additional physical route/loop with gameplay purpose

Do not start Milestone 03 early.
