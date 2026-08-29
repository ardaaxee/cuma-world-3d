# CUMA WORLD — ChatGPT + Claude Code Shared Handoff

Active collaboration branch: `claude/full-game-development`
Do not modify: `main`
Runtime: TypeScript + Babylon.js + Capacitor Android
Authoritative gameplay runtime: `src/game/runtime11.ts`

## Collaboration contract

Read before editing:
1. `CLAUDE.md`
2. `CLAUDE_CODE_HANDOFF.md`
3. `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`
4. `docs/CLAUDE_007_STYLE_GUIDE.md`
5. `docs/CLAUDE_NEXT_TASK.md` — the ONLY active implementation milestone

The target is an original CUMA WORLD cinematic spy-thriller in the broad quality class of modern espionage games. Do not copy 007 First Light names, characters, story, dialogue, missions, UI, assets, animation, music, logos, source code or proprietary content.

Rules:
- always re-read branch HEAD before editing
- apply minimal compatible changes on the latest files
- reuse existing systems; do not create duplicate mission/NPC/security/cover/noise/graphics/audio/HUD implementations
- one coherent gameplay milestone per implementation commit
- run `npm run build` before commit when possible
- fix TypeScript/Vite failures before stopping
- verify GitHub Actions for the exact gameplay commit
- never claim APK/AAB success until run/artifact evidence exists
- never claim real-device behavior without real-device evidence
- update this handoff after each completed milestone

## Current architecture ownership

- `src/game/runtime11.ts`: production gameplay loop, camera, interaction/world integration
- `src/game/input.ts`: mobile input, RUN/JUMP/CROUCH
- `src/game/character.ts`: player collider/model/locomotion
- `src/game/mission.ts`: mission rules/state/save
- `src/game/npc.ts`: NPC awareness/patrol/hearing/investigation/security communication
- `src/game/security.ts`: CCTV gameplay
- `src/game/cover.ts`: directional tactical cover
- `src/game/noise.ts`: authoritative player/environment gameplay noise
- `src/game/zones.ts`: PUBLIC/STAFF/RESTRICTED access-zone suspicion
- `src/game/gadgets.ts`: SCAN/JAM/DECOY
- `src/game/operation-depth.ts`: ACCESS/MANIFEST/VERIFY operation presentation/terminals
- `src/game/world-expansion.ts`: physical service/loading world extension; extend this ownership for structural expansion rather than creating a second map
- `src/game/visuals.ts`: visual/world polish owner
- `src/game/graphics.ts`: graphics/performance profiles
- `src/game/audio.ts`: gameplay audio
- `src/game/debrief.ts`: mission result/replay flow

## Verified baseline before Claude milestones

The Claude branch was created from gameplay commit `3ac21061bb877936600ddb550a00bd0c35e2bdd4`.
That baseline already contained movement, RUN/JUMP/CROUCH, third-person shoulder camera, tactical cover, recon/intel, CCTV, SCAN/JAM/DECOY, coordinated security search, staged ACCESS -> MANIFEST -> VERIFY -> EXTRACT, service/loading side route, graphics tiers and Android lifecycle handling.

Android workflow run `33212850598` was green through TypeScript/Vite, Android 16, APK, AAB, hashes and artifact upload for that baseline.

## Milestone 01 — Hearing + Social Stealth Foundation (verified)

Gameplay commit: `74631edc4ca3f00ce94766c8450fc1c25eb78ee7`
Commit message: `feat: add hearing and zone suspicion foundation`
Workflow: `33244096862` — SUCCESS end-to-end including APK/AAB/artifact.

Implemented:
- authoritative movement/landing/decoy noise model
- NPC hearing outside visual FOV using existing investigation/search
- footsteps cannot directly force ALERT
- DECOY remains stronger than incidental movement
- PUBLIC / STAFF / RESTRICTED zone suspicion and recovery
- reusable `setZoneAccessGranted()` credential hook
- compact noise/zone HUD

Real-device checks still pending:
- hearing-distance feel
- zone-pressure tuning
- HUD readability
- hearing occlusion-ray cost
- background/resume behavior

## Milestone 02 — Directional Cover + Camera Stealth Polish (verified)

Gameplay commit: `89352a2f2a8e941f848c6c3737d19578cfe91e85`
Commit message: `feat: refine directional cover and stealth camera`
Verified handoff commit: `3778f22912c287a1071b66353f4740f809cac567`
Workflow run: `33244796378` (#130) — SUCCESS end-to-end.

Artifact:
- `CUMA-WORLD-Android-Play-Build`
- size: `23689464` bytes
- sha256: `804378bd1e25cbf4ec2cd6fed4c32b1ec2c121fd30eef65bd05b3500a5189351`

Implemented:
- real cover surface normal/tangent/distance/contact state
- low vs full-height cover
- observer-specific `coverProtection()` / detection scaling for NPC + CCTV
- exposed edge/open side loses protection
- cover-guided movement without sticky rail
- RUN/JUMP clean cover exit
- cover-aware smooth shoulder camera with Reduced Motion behavior
- cover probing/DOM performance improvements

Real-device checks still pending:
- shoulder swap feel
- joystick versus cover guidance
- crate-height cover discoverability
- camera clipping around loading bay
- real multitouch RUN/JUMP exits
- Reduced Motion feel
- LOW/MEDIUM probe cost

Important CI note: the job-step endpoint showed a stale in-progress snapshot for roughly 50 minutes after run `33244796378` had already completed. For disputed final status, prefer the workflow run status plus artifact/job log evidence.

## ACTIVE MILESTONE 03 — Connected Back Office + Door / Access Depth

Documentation HEAD that activates this task includes `docs/CLAUDE_NEXT_TASK.md` commit `2b78f0682ab7f7f53eeffa13d8bd6bbb9dfac8be`.

Implement ONLY `docs/CLAUDE_NEXT_TASK.md`.

High-level goals:
- expand the existing facility into a connected STAFF corridor, back office/records room, security room, utility/service connection and stock/loading connection
- make front and side approaches physically reconnect through the internal network
- add ONE reusable fictional Door / Access system with truthful OPEN/CLOSED and LOCKED/UNLOCKED collision states
- integrate door interactions into the existing mobile interaction flow without a new permanent button or prompt conflicts
- make door use feed the existing authoritative hearing/noise model where appropriate
- turn ACCESS completion into a real temporary STAFF credential that unlocks appropriate staff doors and reduces STAFF-zone pressure without authorizing RESTRICTED rooms
- add at least one intel-driven physical traversal opportunity
- reposition/integrate ACCESS/MANIFEST/VERIFY targets so the operation chain requires meaningful traversal through the expanded topology
- extend the existing `ZONE_VOLUMES`; do not create another zone system
- preserve Milestone 01 hearing/zones and Milestone 02 directional cover/camera
- keep old saves safe with defaults/migration
- keep mobile performance and bundle gates green

Do not add real-world lock bypass/hacking/security intrusion instructions. Access mechanics are fictional game abstractions only.

After implementation:
- `npm run build`
- one coherent gameplay commit (suggested: `feat: expand back office and access routes`)
- dispatch Android workflow for the exact gameplay commit
- verify final status using run/artifact evidence when needed
- update this handoff with gameplay commit, changed files, door/access API, topology, credential behavior, CI result and remaining device checks
- STOP; do not start Milestone 04.
