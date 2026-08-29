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

## Milestone 03 — Connected Back Office + Door / Access Depth (implemented)

Gameplay commit: `b965fe81cb16e09bec1be2f6f090e7b9b11786dd`
Commit message: `feat: expand back office and access routes`

Workflow run: `33245899904` (#131), dispatched against this branch for the exact
gameplay commit.

Verified green on that run: character packaging, audio detection, npm install,
**Typecheck and build game runtime**, native Capacitor Android generation,
Android toolchain and Android 16 SDK packages (steps 1-11).

**APK/AAB NOT CONFIRMED.** Step 12 `Build test APK and Play App Bundle` was still
reported in progress ~55 minutes after it started, with no artifact and no
downloadable job log. No APK/AAB success is claimed for Milestone 03.

Runs #129 and #130 showed the same stale-snapshot behaviour and both turned out to
have finished in under three minutes, so this is most likely the same API lag
rather than a real failure — but that is an inference, not evidence. Before
treating Milestone 03 as fully CI-verified, re-check
`https://github.com/ardaaxee/cuma-world-3d/actions/runs/33245899904` for the
artifact, or re-dispatch the workflow for commit `b965fe8`.

`npm run build` passed locally with a clean `tsc --noEmit`.

Files added:
- `src/game/doors.ts` — the one door/access system
- `src/game/access-state.ts` — staff credential, shared by zones and doors
- `src/doors.css`

Files changed:
- `src/game/world-expansion.ts` — back-of-house geometry and door registration
- `src/game/zones.ts` — extended `ZONE_VOLUMES`, credential moved to access-state
- `src/game/noise.ts` — one generalised environment impulse
- `src/game/mission.ts` — publishes discovered intel on `document.body.dataset.intel`
- `src/game/operation-depth.ts` — ACCESS/MANIFEST repositioned, player-origin ray
- `src/game/security.ts` — CCTV panel moved into the monitoring room
- `src/game/runtime11.ts` — door interaction, system-level door update, prompt guard

### Facility topology

Back-of-house block sits behind the market rear wall, x -8.0..7.4, z 14.0..22.6:
- STAFF CORRIDOR, z 14.0..17.3 — spine with a sightline stub and crate cover
- BACK OFFICE / RECORDS, x -8.0..-1.0, z 17.3..22.6 — RESTRICTED, holds MANIFEST
- SECURITY / MONITORING, x -1.0..5.4, z 17.3..22.6 — RESTRICTED, holds the CCTV panel
- UTILITY NOOK, x 5.4..7.4, z 17.3..22.6 — STAFF, open passage to the corridor

Verified traversals (flood-filled over the real collision boxes at player height):
- no doors open: back of house is sealed; sales floor, ACCESS, delivery counter, loading bay and alley reachable
- stock door only: side route reaches corridor + utility nook without any credential
- staff door only: front route reaches corridor + utility nook
- + back-office door: MANIFEST reachable
- + security door: monitoring room reachable

Openings are 1.8 m wide, leaving ~1.1 m clearance for the 0.68 m player capsule.

### Door / access API (`src/game/doors.ts`)

`DoorAccess` = NONE | STAFF_CREDENTIAL | ACCESS_CODE | SECURITY_ACCESS (fictional).
`registerDoor`, `updateDoors`, `tryUseDoor`, `doorPromptLabel`, `isAccessSatisfied`,
`accessRequirementText`, `showDoorStatus`, `resetDoors`.

Doors: staff-market (STAFF_CREDENTIAL, auto-closes after 8 s), stock-service (NONE),
utility-service (ACCESS_CODE), back-office (NONE), security-room (SECURITY_ACCESS).

Collision follows the leaf and only releases past half travel, so a visibly closed
door always blocks and a locked door never stops blocking. One system-level update
visits only doors that are moving or counting down.

### Credential and zones

`access-state.ts` derives the staff credential from the saved operation step, so
there is no save-schema change and old saves default to no credential. Completing
ACCESS grants it: the staff door unlocks and STAFF pressure drops to 0.32x, while
RESTRICTED stays at 0.78x (0.027/s vs 0.156/s) — the rooms stay risky.

### Intel changes the world

- worker-route intel makes the utility door usable (alley -> nook shortcut)
- camera intel makes the monitoring room usable, and the CCTV panel now lives there

### Door noise

`reportEnvironmentNoise` reuses the Milestone 01 impulse queue. A worked door is
loudness 0.55, radius ~6.6 m, awareness floor 0.277 — CURIOUS only, below the decoy
floor of 0.46 and far below ALERT. Automatic closing is silent.

### Performance

Static back-of-house meshes are frozen and share a small material set; no new
dynamic lights. Doors have no per-door loop and no full scan. The interaction
prompt now writes to the DOM only when its text changes. Boot chunk 35087 -> 42597
bytes against a 102400 budget; total JS 7017418 against 8500000.

Note on the boot chunk: `debrief.ts` imports `mission.ts`, which side-effect
imports `operation-depth` -> `world-expansion` -> `doors`, so the door system
lands in the startup bundle. `doors.ts` was deliberately kept free of
`zones`/`noise`/`cover` imports to stop that chain widening further; routing the
door noise through the runtime and putting the credential in `access-state.ts` is
what keeps the delta at ~7 kB instead of ~25 kB. Breaking the
`debrief -> mission` edge would move the whole world builder out of startup and
is the obvious next performance win, but it was out of scope here.

### Requires real-device testing from Milestone 03

- whether 1.8 m openings and the corridor stub feel navigable with the joystick
- door prompt versus terminal prompt when both are close (staff door and ACCESS
  terminal are ~4 m apart)
- whether the terminal ray change makes ACCESS/MANIFEST easier or harder to aim at
- RESTRICTED pressure in the records and monitoring rooms over a full objective
- door-noise reaction from guards patrolling the sales floor
- frame cost of the added back-of-house geometry on LOW/MEDIUM
- pause/background/resume with a door mid-animation
- an old save from before Milestone 03 loading straight into INFILTRATE
