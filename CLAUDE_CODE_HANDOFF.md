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
- `src/game/character.ts`: player collider/model/locomotion, GLB import and procedural fallback
- `src/game/character-animation.ts`: canonical animation-state contract and clip-name resolver
- `src/game/character-blender.ts`: animation-group crossfade
- `src/game/character-face.ts`: optional facial-life (blink/gaze) layer
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

## Milestone 03 — Connected Back Office + Door / Access Depth (verified)

Gameplay commit: `b965fe81cb16e09bec1be2f6f090e7b9b11786dd`
Commit message: `feat: expand back office and access routes`

Workflow run: `33245899904` (#131), dispatched against this branch for the exact
gameplay commit.

Completed SUCCESS in 2m57s (09:36:45 -> 09:39:41) through TypeScript/Vite, native
Capacitor Android generation, Android 16 SDK, debug APK, Play AAB, SHA/build
manifest and artifact upload.

Artifact `CUMA-WORLD-Android-Play-Build`, 23695981 bytes,
sha256 `778ed2dc08a0be8fb5fc076a10414ce1e0e069608a7518cf4e6479013dd5815c`.

Note for whoever re-checks: the job-step endpoint again reported step 12 as still
running for roughly an hour after the run had actually finished. This is the third
run in a row with that behaviour. Trust the run artifact and the job log, never the
step list.

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

## Milestone 04 — Facility Security + Social Stealth + Field Focus (verified)

Gameplay commit: `6925ae171f0cff3aae1373a9c1149465db7a4a62`
Commit message: `feat: coordinate facility security and social stealth`
Workflow run: `33246717365` (#132) — SUCCESS end-to-end in 2m55s
(09:58:31 -> 10:01:26), confirmed from run status, artifact and job log.

Artifact `CUMA-WORLD-Android-Play-Build`, 23704495 bytes,
sha256 `9a1b35fb96a7e18fbe1363ed1f52eb67c99c37750ca66a69083a2aed56e97f77`.

`npm run build` passed locally with a clean `tsc --noEmit`; all three bundle
budgets green (boot 42949/102400, largest chunk 809378/921600, total JS
7028046/8500000).

Files added:
- `src/game/facility-security.ts` — the one facility controller
- `src/game/field-focus.ts` — pooled contextual markers

Files changed:
- `src/game/npc.ts` — facility posture, coordinated search, social-check API
- `src/game/runtime11.ts` — facility update, COVER STORY prompt, FIELD FOCUS
- `src/game/security.ts` — CCTV feeds and reacts to facility state
- `src/game/doors.ts` + `src/game/world-expansion.ts` — `closeSecurityDoors()`
- `src/game/zones.ts` — bounded `relaxZoneSuspicion()`
- `src/game/stealth-signals.ts` + `src/stealth-signals.css` — facility chip

### Facility security API

`FacilityState` = CALM | WATCH | SEARCH | HIGH_ALERT.
`reportIncident(kind, x?, y?, z?)`, `updateFacilitySecurity(dt, active)`,
`getFacilitySnapshot()`, `getFacilityState()`, `readSearchAnchor(out)`,
`getAnchorVersion()`, `relaxFacilityHeat(amount)`, `facilityStateLabel(state)`,
`resetFacilitySecurity()`.

Snapshot carries state, heat, hasAnchor, secondsSinceContact, escalating.

### Heat model

Each incident kind has a gain and a **ceiling**; the ceiling is the structural
safety rule, not a tuning accident:

| kind | gain | ceiling | anchor | confirms |
|---|---|---|---|---|
| noise (guard turns CURIOUS) | 0.10 | 0.40 | yes | no |
| zone (sustained pressure) | 0.05 | 0.30 | no | no |
| decoy | 0.50 | 0.60 | yes | no |
| suspicion (guard SUSPICIOUS) | 0.28 | 0.66 | yes | no |
| guard-alert | 0.80 | 1.00 | yes | yes |
| camera-alert | 0.75 | 1.00 | yes | yes |

Thresholds: WATCH 0.18, SEARCH 0.45, HIGH_ALERT 0.78. Falling: 0.10 / 0.34 /
0.62. Decay 0.05/s after a 2 s grace so repeated events accumulate. HIGH_ALERT
additionally requires a sighting within 14 s. Escalation is immediate;
de-escalation needs 2.5 s dwell.

Simulated before wiring: 3 door-noise events peak at WATCH; 2 suspicious guards
reach SEARCH; a decoy reaches SEARCH; a confirmed guard or camera alert reaches
HIGH_ALERT and recovers to CALM in roughly 30 s.

### Coordinated search

Guards never receive the player's live position — only the anchor. In SEARCH,
security units are fanned onto distinct ring points (golden-angle spacing,
2.4–5.2 m) and each candidate is pulled back if a wall sits between it and the
anchor. Points regenerate only on anchor/state change or every 6.5 s.

WATCH slows security patrol to 0.82x and adds a look-around sweep; workers are
unaffected. SEARCH/HIGH_ALERT add urgency multipliers (1.18x / 1.35x) and small
awareness-rate scaling (1.12/1.2/1.3), never knowledge.

### COVER STORY

Uses the existing interact control; it claims the prompt only when no physical
interactable is targeted, so terminals > world meshes > social stays
deterministic. Requires all of: INFILTRATE/EXTRACT, STAFF zone, staff
credential, facility below HIGH_ALERT, not crouched / not in cover / not
sprinting, noise <= 0.5, off cooldown, and a guard within 6.5 m with eye
contact who is CURIOUS or SUSPICIOUS with awareness <= 0.72.

Success: that guard drops 0.34 to a floor of 0.08 (never zero), STAFF zone
suspicion -0.28, facility heat -0.12 but never below the SEARCH exit, 22 s
cooldown. It cannot work in RESTRICTED, against ALERT, or during HIGH_ALERT.

### FIELD FOCUS

Recon is untouched before infiltration. During INFILTRATE/EXTRACT the same
OBSERVE control gives a 3 s window on a 9 s cooldown. It marks only the current
operation target, nearby doors, discovered intel, a discovered CCTV opportunity,
extraction, and the abstract last-known incident point. NPCs are never
candidates. Markers are pooled (6, LOW 3) and the target scan runs once per
activation. SCAN remains signal discovery; FIELD FOCUS is readability of what is
already known.

### Performance

One facility update path, no per-guard timers, no per-frame search generation,
no full-scene per-frame scan, DOM writes only on displayed-state change. LOW
reduces markers; Reduced Motion drops the pulse, not the mechanic. Pause clears
focus/social timers and freezes doors.

Boot chunk 42597 -> 42949 bytes (budget 102400): the new modules are reachable
only from the lazy runtime, so the documented `debrief -> mission ->
operation-depth -> world-expansion -> doors` startup chain was not widened.

### Save compatibility

No save schema change. Facility state, focus and social cooldowns are
runtime-only by design. Mission progression, route, intel, alerts, opportunities
and score are untouched.

### Requires real-device testing from Milestone 04

- whether WATCH look-around reads as alert patrolling or as jitter
- whether two guards fanning out around the anchor is visibly different from
  the old stacking behaviour
- whether facility recovery (~30 s) feels earned or too generous
- whether COVER STORY is discoverable — it appears with no world interactable
  targeted, which players may not expect
- FIELD FOCUS marker legibility at LOW and under Reduced Motion
- whether auto-closed doors ever feel like a softlock in practice
- CCTV pressure during SEARCH/HIGH_ALERT versus JAM usefulness
- pause/background/resume during an active focus window or search
- frame cost of the search LOS rays on LOW/MEDIUM

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
