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
- `src/game/mission.ts`: the one MissionDirector — mission rules, stage graph state, save
- `src/game/mission-graph.ts`: typed stage/resolution/objective/opportunity data
- `src/game/mission-save.ts`: the one SAVE_KEY, storage and reset (dependency-free)
- `src/game/mission-result.ts`: typed MissionResult and its completion event
- `src/game/mission-objects.ts`: Milestone 05 world interactables
- `src/game/delivery-cart.ts`: authored cart movement
- `src/game/npc-routines.ts`: authored NPC waypoint routines and per-run variant selection
- `src/game/run-variation.ts`: deterministic runSeed mixing
- `src/game/cinematic-presentation.ts`: the one mission-intro presentation owner
- `src/game/cinematic-timeline.ts`: pure intro timing/skip/completion state
- `src/game/presentation-events.ts`: typed presentation cue contract
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

## Hero Character Realism Pipeline (verified)

Commit `443907a2bdbdab395695e642d2b73f0ca942c395`. Mission Graph Milestone 05
was NOT touched and remains paused.

This milestone built the runtime and CI contracts a realistic hero needs. It did
not produce the hero. See "Asset-authoring dependency" below — that gap is real
and is not hidden anywhere in this document.

### Character asset audit — measured, not assumed

The source archive `CUMA_WORLD_3D_GitHub_APK_Autobuild_2.1.1.zip` contains only
`assets/characters/README.md`, no GLB. Every CI run therefore falls through to
the pinned CC0 fallback in `ci/install_high_character.py`.

Audited with the upgraded validator:

| | |
|---|---|
| Source | `kunalkushwaha/vsim@3f97faf…/packages/assets/library/suited.glb` |
| License | CC0 / public domain, MakeHuman / MPFB 2 — no real person's likeness |
| sha256 | `7b5ff9d323b3bea72eddc2faac3ea3ec8f40232acfa2318692ee30efbc202508` |
| GLB bytes | 6,675,064 |
| Generator | Khronos glTF Blender I/O v4.5.51 |
| Meshes / primitives | 3 / 3 |
| Vertices / triangles | 19,166 / 35,492 |
| Skins / joints | 1 / 53 |
| Materials | 3 |
| Images | 5 × 1024×1024 PNG, 5,296,760 B (79% of the file) |
| Animation clips | 4 — `idle`, `run`, `walk`, `wave` (636 channels) |
| Morph targets | 0 |

No crouch, jump, fall, landing or cover clips. No facial morph targets. No
finger bones. It is a safe provenance baseline, not a photoreal hero, and this
handoff does not describe it as one.

### Runtime

`PlayerCharacter` was extended in place. No second player controller, no second
animation system, and the 1.72 m × 0.34 m capsule remains authoritative.

- `character-animation.ts` — canonical states (`idle`, `walk`, `run`,
  `crouch_idle`, `crouch_walk`, `jump_start`, `airborne`, `landing`,
  `cover_idle`, `cover_locomotion`) with an alias table for real DCC export
  names. Resolution is most-specific-first with single-claim, so `crouch_walk`
  is never mistaken for `walk`. Resolved **once** at GLB load into a `Map`;
  nothing matches names per frame.
- Fallback chains all terminate at `idle`, so a missing optional clip degrades
  rather than failing. Only `idle`/`walk`/`run` are hard requirements.
- `character-blender.ts` — crossfade over 0.18 s using AnimationGroup weights.
  A clip starts only when the state genuinely changes; states that share a clip
  through the fallback chain are a speed-ratio change, not a restart; and
  reversing a blend resumes the outgoing clip instead of restarting it. At most
  two groups are ever live.
- `character-face.ts` — optional facial life: blink plus a slow two-axis gaze
  drift, capped at 0.22 influence. Deterministic cadence table, no RNG, no
  dialogue, no lip-sync. Reduced Motion parks the gaze and slows blinking.
  **Silently inactive when the asset has no morph targets**, which is the
  current case.
- Animation is strictly downstream of physics. `resolveState()` reads grounded
  state, timers, speed, crouch, cover and sprint, and writes nothing back — the
  jump arc (5.35 / −14.5), gravity, collider dimensions and crouch speed are
  unchanged and unreachable from animation.
- Cover state reaches the character as an optional `update()` argument from
  `runtime11.ts`, so `character.ts` gained no dependency on `cover.ts` and the
  boot chain was not widened.
- Imported PBR materials get `environmentIntensity = 0.72` to match the scene's
  own materials. Nothing else about an authored material is touched.

### Import failure handling

The procedural fallback is disabled only after the import has **fully**
succeeded — meshes present and required states resolved. Any failure disposes
every mesh and animation group the loader created (not just those already
adopted), clears the blender and facial layer, and re-enables the procedural
character. The glTF loader's auto-played first group is stopped on import, so
no unmanaged clip can be left running.

### CI validation

`ci/validate_android_character_glb.py` was rewritten. It parses both GLB chunks
and reads PNG/JPEG headers directly (no image library) to print a
`CHARACTER REPORT` covering file/BIN bytes, generator, nodes, meshes,
primitives, vertices, indices, triangles, skins, joints, materials, textures,
per-image dimensions and bytes, animation names and channel count, morph
targets, and the resolved animation and facial contracts.

Android budgets, set from the measured baseline at ~2–3× headroom rather than
guessed:

| Budget | Ceiling | Baseline |
|---|---|---|
| GLB bytes | 24 MB | 6.7 MB |
| Triangles | 120,000 | 35,492 |
| Vertices | 90,000 | 19,166 |
| Meshes / primitives | 16 / 32 | 3 / 3 |
| Materials | 12 | 3 |
| Images | 24 | 5 |
| Joints | 120 | 53 |
| Texture edge | 2048 error, 1024 warn | 1024 |

8K is forbidden and 4K is rejected outright. Verified by construction against
synthetic GLBs: missing `run`, no skin, 4K texture, 200k triangles, truncated
container, bad magic and missing file all fail; a 2K texture warns and passes.

`ci/test_character_runtime.mjs` adds 53 contract checks over the resolver,
blender and facial layer, compiled with the TypeScript already in
devDependencies (Vite 8 uses rolldown, so esbuild is not available). It runs in
the workflow after the bundle measurement. The Python and TypeScript resolvers
were cross-checked to agree on nine clip-name sets including adversarial
ordering and degenerate assets.

### Performance and bundle

CI-to-CI, Milestone 04 run `33246717365` versus character run `33267441725`
(both with the model packaged and `VITE_BUILD_SHA` set):

| | M04 (#132) | Character (#133) | Delta |
|---|---|---|---|
| `bootstrap_js_bytes` | 42,924 | 42,924 | **0** |
| `largest_js_chunk_bytes` | 812,398 | 812,398 | **0** |
| `total_js_bytes` | 7,411,675 | 7,417,096 | +5,421 |
| `total_web_bytes` | 14,940,329 | 14,945,750 | +5,421 |
| Artifact bytes | 23,704,495 | 23,708,575 | +4,080 |

Boot chunk and largest chunk are **byte-identical**: the new modules are
reachable only from the lazy runtime, so the `debrief → mission →
operation-depth → world-expansion → doors` startup chain was not widened. All
budgets green (102400 / 921600 / 8500000).

Locally, without `VITE_BUILD_SHA` and without the model packaged, the boot chunk
is likewise unchanged at 42,949 bytes and total JS moves 7,028,046 → 7,032,419.

No per-frame allocation was added: animation state selection is numeric, the
blender holds two references, and the facial layer costs two trig calls a frame
only when targets exist.

### Packaging

Path is unchanged: `public/assets/characters/cuma_runtime.glb`. Verified
locally by reproducing the CI step — the GLB reaches
`dist/assets/characters/cuma_runtime.glb` byte-identical (sha256
`7b5ff9d3…c202508`). Character binaries are now gitignored; they are installed
by CI and never committed.

### Save compatibility

No save schema change. Nothing in this milestone is persisted.

### CI verification

Run `33267441725` (#133), `workflow_dispatch` on
`443907a2bdbdab395695e642d2b73f0ca942c395`, **completed SUCCESS**, all 15 steps
green, 3m21s.

Verified from the job log and artifact list, not from the step-status API:

- `CHARACTER REPORT` printed in full, matching the local audit exactly
- `CHARACTER_GLB_OK path=public/assets/characters/cuma_runtime.glb`
- `CHARACTER_RUNTIME_OK 53 checks passed`
- `test -s dist/assets/characters/cuma_runtime.glb` passed
- `BUILD SUCCESSFUL in 1m 53s`
- debug APK sha256 `4248070506bbe0e532759cd23cc1ad8817e6b2d87dde59231f487300dd269fb7`
- Play AAB sha256 `18b7e3c7f82ea59c8006e0346d98b6bcf3627a97798e10092450dca4a1309238`
- packaged model sha256 `7b5ff9d323b3bea72eddc2faac3ea3ec8f40232acfa2318692ee30efbc202508`
- model source `pinned-cc0:kunalkushwaha/vsim@3f97faf…/packages/assets/library/suited.glb`
- artifact `CUMA-WORLD-Android-Play-Build` id `9719107652`, 23,708,575 bytes,
  zip sha256 `d73189db14bcbb1548283963bf82726fde41f1c27d9f6f4fb55bb9bf97d91f57`
- versionCode 1100, versionName 11.0.0-pre.1, targetSdk 36,
  orientation sensorLandscape, cleartextTraffic false, Play upload unsigned

CI proves the build. It proves nothing about how the character looks or
performs on a real phone.

### Asset-authoring dependency

**An authored hero meeting the art direction does not exist in this
repository.** Producing one requires sculpting, retopology, texturing, rigging
and animation work that CI cannot perform — CI can only validate and package
what it is given.

Until such an asset is committed to the source archive as
`assets/characters/cuma_high.glb`, CI will keep packaging the CC0 MakeHuman
fallback and the game will keep looking like that fallback. The runtime is now
ready to consume a better asset the day one exists, and `docs/CHARACTER_PIPELINE.md`
is the contract it must meet.

**Asset-authoring dependency remains.**

### Requires real-device testing from the character milestone

Nothing below was tested on hardware. CI proves the build, not the look.

- whether the 0.18 s crossfade reads as smooth or mushy on a real device
- whether the imported character's scale still visually matches the 1.72 m
  collider after the material change
- whether `environmentIntensity = 0.72` improves or flattens the hero under
  daylight and interior lighting
- landing-clip timing versus the 0.28 s window at various fall heights
- frame cost of weighted two-group blending on LOW/MEDIUM
- Android pause/background/resume mid-crossfade
- that the procedural fallback still boots correctly when the GLB is absent
- blink cadence legibility at third-person distance, if a future asset has
  morph targets

## Milestone 05 — Mission Graph + Opportunities + NPC Routines + Replay Depth (verified)

Gameplay commit `ecec0a8`. The operation is now a typed graph with real
alternate solutions instead of one hard-coded sequence. No second
MissionDirector, NPC state machine, door, zone or facility controller.

### Mission graph API (`src/game/mission-graph.ts`)

Dependency-free typed data, deliberately game-specific rather than a generic
workflow engine.

- `MissionStageId` — `ACCESS`, `MANIFEST`, `VERIFY` (`STAGE_ORDER`)
- `MissionResolutionId` — `access_terminal`, `manifest_records`,
  `manifest_ledger`, `verify_counter`, `verify_monitoring`
- `OptionalObjectiveId` — `secondary_records`, `shift_pattern`
- `OpportunityId` — `camera_bypass`, `staff_routine_window`, `delivery_cart`
- helpers: `getStage`, `getResolution`, `resolutionsForStage`,
  `stepForResolvedStages`, `firstBlockingStage`, `stagesImpliedByStep`,
  `legacyResolutionFor`, plus `is*Id` guards

Director surface: `canResolve(id)`, `resolveStage(id)`, `isStageResolved(stage)`,
`resolutionFor(stage)`, `canCompleteObjective(id)`, `completeOptionalObjective(id)`,
`hasObjective(id)`, `canUseOpportunity(id)`, `useOpportunity(id)`, `getRunSeed()`.

**Double completion is structurally impossible.** Presence in the resolution
map *is* stage completion, so `canResolve()` rejects any resolution whose stage
is already resolved — the alternate, the same resolution replayed, and the
legacy `completeObjective()` path all return false and the operation step does
not advance. `document.body.dataset.operationStep` is still derived from
resolved stages, so the credential and door systems are untouched.

### MANIFEST A/B and VERIFY A/B

| Stage | A (unchanged) | B (new) | B requires |
|---|---|---|---|
| MANIFEST | back-office records terminal | loading bay stock ledger | `market_worker_route` |
| VERIFY | delivery-counter physical record | monitoring-room cross-check | `market_camera` |

B for MANIFEST sits in the STAFF loading zone (ledger mounted on the bay post at
`11.70, 1.35, 12.85`); B for VERIFY sits in the RESTRICTED monitoring room
(`-0.78, 1.5, 20.5`). Neither is a hack or a security bypass — both are
read-only records. ACCESS keeps its single credential resolution.

### Optional objectives — exactly two

`SECONDARY_RECORDS` (records room, `-6.82, 1.34, 21.4`, RESTRICTED exposure) and
`SHIFT_PATTERN` (staff corridor west wall, `-7.62, 1.62, 15.4`). Both are
physical world interactions, persisted, scored and shown in debrief. **Neither
blocks extraction** — a run completes at 0/2. `SHIFT_PATTERN` unlocks
`staff_routine_window`.

### Opportunity registry

| Opportunity | Unlocked by | Effect |
|---|---|---|
| `camera_bypass` | `market_camera` | unchanged from Milestone 04 |
| `staff_routine_window` | `SHIFT_PATTERN` | 20 s worker alternate routine |
| `delivery_cart` | `market_worker_route` | slides cart to next authored stop |

All three are one-shot per run, typed, scored and reported in debrief.

**STAFF ROUTINE WINDOW** sends one worker onto an authored loading-bay task via
`NpcSystem.openStaffRoutineWindow()`. It opens a corridor gap and nothing else:
it does not clear facility heat, does not touch security units, and changes
nothing about what anyone knows. It claims the same contextual prompt slot as
COVER STORY, taking priority only while unused.

**DELIVERY CART** moves between three authored stops down the service alley
(`x 9.6`, `z 12.4 / 15.9 / 18.9`). No dragging, no physics engine. It is
collidable and tops out at ~1.33 m — above the cover system's 0.70 m contact
probe, below its 1.45 m head probe — so directional SİPER reads it as
crate-height cover that rewards crouching. Movement emits a
`CART_NOISE_LOUDNESS = 0.34` impulse through the existing noise model.

Traversal was flood-filled over the real collision boxes at every stop: every
room, doorway and new interactable stays reachable, and the cart leaves ~1.5 m
clear on the wall side and ~2.5 m on the open side, so no stop can seal a route.

### NPC routine API (`src/game/npc-routines.ts`)

`RoutineWaypoint { x, z, dwell?, sweep? }` → `RoutineVariant { id, waypoints }`
→ `RoutineSet { variants, alternate? }`. Positions are plain coordinates so the
data module stays dependency-free and allocates nothing at import; `npc.ts`
converts each routine to Vector3 once when an agent adopts it.

- GÜVENLİK 01: `s1-floor-west`, `s1-counter-watch`
- GÜVENLİK 02: `s2-floor-east`, `s2-corridor-mouth`
- MARKET ÇALIŞANI: `worker-floor`, `worker-shelves`, alternate `worker-loading-run`

`selectVariant`, `selectDwellScale` and `selectPhaseOffset` are all derived from
the run seed, once per agent per run. There is no per-frame random anywhere and
no per-NPC timer or animation frame.

NPC movement does not test collision, so every routine leg was checked against
the walls — the worker's loading run originally cut through the market's right
wall and now threads the delivery opening (`x 7.25`, clear between `z 8.9` and
`11.5`).

### runSeed and replay variation

Generated by `createRunSeed()` on first run, persisted in the save, exposed via
`MissionDirector.getRunSeed()` and passed into `NpcSystem`. Deterministic mixing
lives in `run-variation.ts` (`seededUnit` / `seededIndex` / `seededRange`).

- resuming the same save reproduces the same variant, dwell scale and sweep phase
- replay clears the save, so the next run seeds afresh and may differ
- different agents get different dwell scales, so units no longer pause in lockstep

### SEARCH/HIGH_ALERT override and recovery

Milestone 04 behaviour is unchanged: investigation, coordinated search and the
last-known anchor still override routines, and NPCs are never routed from the
player's live position. What is new is the recovery — an interrupted agent
rejoins its authored routine at the **nearest** waypoint rather than a stale
index, and `setEnabled(false)` drops any active alternate window so a re-enabled
LOW-tier agent never resumes mid-window. Verified by simulation.

### Typed MissionResult and debrief data flow

`MissionDirector` → `publishMissionResult()` → `cuma-mission-result` window
event → `MissionDebrief`. The result carries rank, score, route, intel,
per-stage resolutions with labels, completed objectives, objective total,
opportunities used, alerts, run seed and a replay hint.

**The regex path is gone.** `debrief.ts` no longer creates a `MutationObserver`
and no longer runs `text.match(...)` over HUD prose; CI now fails if either
returns. A save restored straight into COMPLETE republishes its result, so an
already-finished save still opens a valid debrief.

### Boot dependency chain

`SAVE_KEY` and `resetMissionProgress` were **moved** — not duplicated — into the
dependency-free `mission-save.ts`, and the `operation-depth` side-effect import
moved from `mission.ts` to `runtime11.ts`. Debrief no longer reaches
`mission.ts`, which breaks the documented chain:

`debrief → mission → operation-depth → world-expansion → doors`

Bootstrap **42,949 → 25,591 bytes**, a 40% reduction. Verified by inspecting the
built chunk: no doors, operation-depth, world-expansion, zones, MissionDirector
or Babylon remain in it — only the dependency-free save/graph/result modules
debrief actually needs. One storage key, one reset function, no bundler refactor.

### Scoring

GHOST / SHADOW / OPERATIVE and 0..100 preserved. Named weights: `SCORE_BASE` 58,
per-stage score 4, optional objective 7 each, opportunity 6 each,
`SCORE_OPTIONAL_INTEL` 6, `SCORE_ROUTE_CHOSEN` 6, `SCORE_ALERT_PENALTY` 18.
An alternate resolution scores exactly what its sibling scores — verified.

### Save migration

Same storage key. `runSeed`, `resolutions` and `objectives` are optional fields.

- old saves carrying only `operationStep` backfill the stages that step implies,
  so a pre-Milestone-05 INFILTRATE run stays completable
- old COMPLETE saves still publish a usable result
- corrupt JSON, unknown intel/objective/opportunity ids, and a resolution stored
  under the wrong stage are all rejected without crashing
- replay clears progress and reseeds
- facility heat, focus and social cooldowns remain runtime-only

### Verification

`npm run build` clean. 117 mission-graph contract checks and the 53 character
runtime checks both green; both run in CI. Local bundle (model not packaged):
bootstrap 25,591, largest chunk 809,372, total JS 7,047,374 — all budgets green.

Beyond the unit checks, three things were verified numerically rather than
assumed:

- **Traversal.** Flood-filled the real collision boxes with the cart at each of
  its three stops. Every room, doorway and new interactable stays reachable, and
  no stop closes a route.
- **Routine legs.** NPC movement does not test collision, so every leg of every
  authored loop was sampled against the walls. The worker's loading run
  originally cut through the market's right wall; it now threads the delivery
  opening.
- **Routine override/recovery.** Simulated the patrol state machine: search
  overrides the routine, recovery rejoins at the nearest waypoint, the alternate
  window expires correctly even while interrupted, and agents with different
  dwell scales drift out of lockstep.

### CI verification

Run `33271072252` (#134), `workflow_dispatch` on
`ecec0a8d65cacc6b461bdf469ecc070eff00185c`, **completed SUCCESS**, all 15 steps
green, 3m08s.

Verified from the job log and artifact list, not the step-status API:

- `MISSION_GRAPH_OK 117 checks passed`
- `CHARACTER_RUNTIME_OK 53 checks passed`
- `CHARACTER_GLB_OK` with the CHARACTER REPORT intact
- `BUILD SUCCESSFUL in 1m 57s`
- debug APK sha256 `e25afb77b8cdb95b9f9546fee467eaf494ca88541ecbb5efabe51134c92b678e`
- Play AAB sha256 `f2fda40d52a00b8cd6ea2af9857c524dfcb67a58c8d64f330f681d413a3dbf6a`
- packaged model sha256 `7b5ff9d323b3bea72eddc2faac3ea3ec8f40232acfa2318692ee30efbc202508`
- artifact `CUMA-WORLD-Android-Play-Build` id `9720150414`, 23,731,156 bytes,
  digest `sha256:7e415cf6f7d5a3b3c99754751e22caf4913e60fe9b0d3940808a9df908fbc92f`
- versionCode 1100, versionName 11.0.0-pre.1, targetSdk 36,
  orientation sensorLandscape, Play upload unsigned

CI-to-CI against the character run `33267441725` (#133), both with the model
packaged:

| | #133 | #134 | Delta |
|---|---|---|---|
| `bootstrap_js_bytes` | 42,924 | **25,566** | **−17,358** |
| `largest_js_chunk_bytes` | 812,398 | 812,392 | −6 |
| `total_js_bytes` | 7,417,096 | 7,432,062 | +14,966 |
| `total_web_bytes` | 14,945,750 | 14,960,738 | +14,988 |
| Artifact bytes | 23,708,575 | 23,731,156 | +22,581 |

The boot chunk fell 40% because the mission/world chain left it. All budgets
green (102400 / 921600 / 8500000).

CI proves the build. It proves nothing about how any of this feels on a phone.

### Requires real-device testing from Milestone 05

- whether the two MANIFEST routes feel like a genuine choice or one is
  obviously better once the worker-route intel is in hand
- whether the monitoring-room VERIFY is worth the RESTRICTED exposure
- whether the STAFF ROUTINE WINDOW's 20 s gap is long enough to be useful and
  short enough to stay a decision
- whether the delivery cart reads as usable cover from the third-person camera,
  and whether pushing it near a guard is a reasonable risk
- whether the cart's ~1.33 m height genuinely rewards crouching in play
- whether routine variation is noticeable across two fresh replays, or too
  subtle to register
- guard dwell/sweep legibility at LOW, where sense interval is coarser
- whether recovery from SEARCH back to routine reads as natural or abrupt
- interaction-prompt priority in the corridor, where the shift board, a door
  and the routine window can all be close together
- debrief readability on a phone now that the note block carries several lines
- an old pre-Milestone-05 save resuming mid-INFILTRATE on a real device
- pause/background/resume during an active routine window or a cart slide

## Milestone 06 — Cinematic Mission Presentation + Feedback + Camera Polish (verified)

Gameplay commit `53d9e06`. The operation opens as a short directed
presentation and reports itself through typed cues instead of scraped HUD text.
One render loop, one camera owner, no new effects stack, no new dynamic lights.

### Cinematic API

`src/game/cinematic-presentation.ts` is the one presentation owner; it drives
the `UniversalCamera` `GameRuntime` already owns.

- `GameRuntime.playMissionIntro(): Promise<void>` — resolves on completion or
  skip, and resolves immediately on a restored save so `main.ts` can always
  await it
- `GameRuntime.isCinematicActive()` / `skipMissionIntro()`
- `CinematicPresentation.begin(reducedMotion) / update(...) / skip() / dispose()`
- `src/game/cinematic-timeline.ts` holds the pure timing state (elapsed, skip,
  single-fire completion, segment sampling, `smoothstep`) with no Babylon
  dependency, so the awkward parts are unit-checkable

### Fresh-run detection

The runtime records `mission.snapshot().state === "BRIEFING"` **before**
`acknowledgeBriefing()` moves BRIEFING → RECON. A restored RECON / PLANNING /
INFILTRATE / EXTRACT / COMPLETE save never plays it, and `introPlayed` stops a
replay inside the same runtime. **No save-schema field was added** — the
existing mission state already answers the question.

### Intro shots and duration

Normal motion, 4.0 s total (inside the authored 3.0–4.5 s window):

| Beat | Seconds | Camera → target |
|---|---|---|
| Establishing | 1.5 | `(0, 7.2, −21)` → `(0, 2.4, 5)`, slow push, elevated over the plaza looking north at the market |
| Service reveal | 1.4 | → `(16.5, 6.4, 2.5)` → `(10.2, 1.6, 11)`, revealing the loading/service side |
| Settle | 1.1 | → the live third-person pose |

Every position, and every line between them, was validated against the real
collision geometry with a 0.45 m clearance margin: none pass through a wall,
the market ceiling (y 4.0), the loading canopy (y 3.45), the bay beams or any
prop.

The closing beat blends into the pose `updateThirdPersonCamera` actually
resolved that frame — the runtime stores it in `gameplayLookTarget` rather than
recomputing the math — so the handover is exact and leaves no stale offset. The
runtime then force-settles, which runs the existing
`resolveThirdPersonCameraCollision()` so the camera lands collision-resolved
whether the player is in open space, against a wall, in a doorway or in cover.

### Reduced Motion

One near-static composition at `(2.6, 3.4, −14.5)` → `(0, 1.6, −6.5)` held for
0.85 s, then a 0.55 s blend — **1.4 s total, 35% of the normal duration**. No
fly-through, no sweep or pulse; the title card fades. Reduced Motion also keeps
the smaller sprint-FOV delta and damps guard oscillation.

### Skip

Any pointer press or the touch-friendly `ATLA` button. `CinematicTimeline.skip()`
jumps to the end; `consumeCompletion()` returns true exactly once, so a double
skip, or skipping something that already finished naturally, produces no second
completion and no second HUD reveal. The pointer listener is registered per run
and removed on completion, so listeners never accumulate. Skip and natural
completion land in the identical camera/control state.

### Input lock

Gameplay simulation does not run during the intro — the render loop calls
`updateCinematicFrame()` instead of `update()` — so mission progress, facility
heat, NPC knowledge, zones, routes and security cannot move, because nothing
that changes them is called.

Input is **drained**, not ignored: `input.frame()` and `consumeJumpPressed()`
run every cinematic frame and again at handover, so a tap or hidden desktop
keyboard press neither moves the player during the intro nor leaks a queued
jump or interact into the first gameplay frame.

### Pause / resume

The timeline advances on runtime `dt`, never a `setTimeout` chain. The existing
`if (!this.paused)` guard therefore freezes the intro exactly as it freezes
gameplay — there is no separate timer to suspend, nothing restarts on resume,
and `pagehide`/`pageshow` cannot restart it. A single very long frame (a resumed
tab) is clamped to 0.1 s so it cannot skip a beat, and the completion promise is
always resolved, including through `dispose()`.

### Typed presentation events

`src/game/presentation-events.ts` — a thin typed CustomEvent contract, not an
event bus. Cue ids:

`MISSION_INTRO`, `MISSION_OBJECTIVE`, `STAGE_RESOLVED`, `INTEL_DISCOVERED`,
`OPTIONAL_COMPLETED`, `OPPORTUNITY_USED`, `FACILITY_WATCH`, `FACILITY_SEARCH`,
`FACILITY_HIGH_ALERT`, `GADGET_READY`.

Each carries a display-ready `label` and `detail` plus a `PresentationWeight`
(`SUBTLE` / `NORMAL` / `STRONG` / `CRITICAL`) that consumers map onto their own
medium. Single-fire is the publisher's job: `runtime11` compares against the
previous mission snapshot and seeds that baseline from the state it starts in,
so a restored save does not replay transitions the player already saw. Facility
cues fire on **escalation only** — calming down is silent.

### MissionFeedback data flow

`runtime11.publishMissionCues()` / `publishFacilityCue()` → typed cue →
`MissionFeedback`. **No MutationObserver, no `text.match()`.** Weight drives
hold time (1.9–2.6 s), haptic pattern (`[16]` → `[44,30,66]`) and priority, so a
quiet cue never wipes a louder one still on screen. `MISSION_INTRO` is skipped
because the title card already covers it. No banner, no screen flash, no camera
shake, and it does not duplicate the permanent HUD chips.

### UiAudioFeedback data flow

Same cue stream → one short synthetic WebAudio blip per cue (0.09–0.42 s, gain
0.022–0.04, rising for confirmations, falling for pressure). Volume setting
still applies; a missing or blocked `AudioContext` silently costs nothing;
nothing loops and there is no siren layer. Full environmental audio remains
Milestone 07's.

### Gadget ready

Implemented inside `GadgetToolkit.refresh()`, the existing 250 ms UI timer — **no
new timer**. A per-gadget `wasReady` map fires `GADGET_READY` only on a
`false → true` crossing. Gadgets already ready at the first refresh are recorded
silently (the map starts `undefined`), and a held ready state never repeats, so
an open panel cannot spam. SCAN/JAM/DECOY mechanics are untouched.

### Sprint FOV predicate

| | |
|---|---|
| Before | `this.running = strength > 0.86` — joystick magnitude, so a full joystick at walking speed widened the FOV |
| After | `isRunHeld() && !isCrouched() && horizontalSpeed > 1.2 && !cinematic.isActive` |

Walking is input-limited to 0.82 deflection, so the speed floor only has to
reject "RUN held while standing still"; `isRunHeld()` does the real work. Full
joystick without RUN → no sprint FOV. RUN while stationary → no sprint FOV. RUN
while moving → subtle FOV, smaller under Reduced Motion.

### Stationary turn presentation

`PlayerCharacter.setIdleFacing(yaw, dt, allowed)`. A hysteresis band, not a
threshold: the turn starts only past `IDLE_TURN_ENTER` 1.0 rad (~57°) and stops
once inside `IDLE_TURN_SETTLE` 0.12 rad, easing at rate 4.2. Measured: a 92°
gap resolves in ~0.63 s and comes to rest inside the settle band without
chattering at the boundary. Small camera movement never rotates the body.

Cover is authoritative — the runtime passes `!guided`, so the body is never
rotated through the cover surface. This writes only the visual root's yaw; the
capsule collider, player position, noise model and mission logic are untouched,
and the character milestone's resolver/blender/face layer are unchanged.

### Guard state presentation

Presentation only, on the existing NPC hierarchy — no second animation state
machine, no added knowledge, no live player tracking.

- **WATCH**: the existing deliberate scan at authored dwell points
- **SEARCH**: a stepped turn/hold inspect cadence (`SEARCH_CADENCE_HZ` 1.6,
  hold threshold −0.2) driven by the agent's seeded `phaseOffset`, so it is
  deterministic and desynchronised between units
- **HIGH_ALERT**: more urgent turn response
- **recovery**: unchanged — the agent rejoins its routine at the nearest waypoint
- Reduced Motion scales nonessential oscillation to 0.55 while preserving
  readable orientation; workers never adopt security posture

### Tests

| Suite | Checks |
|---|---|
| `ci/test_presentation.mjs` | **96** |
| `ci/test_mission_graph.mjs` | **117** |
| `ci/test_character_runtime.mjs` | **53** |

The Milestone 05 regression guards were written as `! grep -q ...`, which is
**exempt from `set -e`** and so could never fail a build. They are replaced by
`ci/check_presentation_regressions.sh`, which tests explicitly and was verified
to actually fire on a reintroduced MutationObserver, reintroduced text scraping,
the sprint-FOV bug and the `debrief → mission` boot-chain import. Its patterns
match real usage (`new MutationObserver`, an active `.match(`) so these modules
can still document in comments what they deliberately no longer do.

### Bundle

CI-to-CI, Milestone 05 run `33271072252` versus Milestone 06 run `33276421355`
(both with the model packaged):

| | M05 (#134) | M06 (#135) | Delta |
|---|---|---|---|
| `bootstrap_js_bytes` | 25,566 | **24,711** | **−855** |
| `largest_js_chunk_bytes` | 812,392 | 812,392 | **0** |
| `total_js_bytes` | 7,432,062 | 7,439,643 | +7,581 |
| `total_web_bytes` | 14,960,738 | 14,969,743 | +9,005 |
| Artifact bytes | 23,731,156 | 23,737,975 | +6,819 |

The Milestone 05 boot reduction is intact and slightly improved — the feedback
layers no longer need HUD element handles. Verified by inspecting the built
bootstrap chunk: **no Babylon, no `UniversalCamera`, no cinematic title card,
DOM or timeline, no doors, no MissionDirector.** Only the dependency-free
presentation contract is there. All three budgets green
(102400 / 921600 / 8500000).

### CI verification

Run `33276421355` (#135), `workflow_dispatch` on
`53d9e066929dbb4eadaa21b40a69e3ef240bb978`, **completed SUCCESS**, all 15 steps
green, 2m48s.

Verified from the job log and artifact list, not the step-status API:

- `PRESENTATION_OK 96 checks passed`
- `MISSION_GRAPH_OK 117 checks passed`
- `CHARACTER_RUNTIME_OK 53 checks passed`
- `PRESENTATION_REGRESSION_GUARDS_OK`
- `CHARACTER_GLB_OK` with the full CHARACTER REPORT intact (unchanged asset:
  6,675,064 B, 35,492 tris, 53 joints, 4 clips, 0 morph targets)
- `BUILD SUCCESSFUL in 1m 46s`
- debug APK sha256 `eaa21d3301edf78c8e261e698fced1c38fda357cd344079e04493c2f55c1fe1d`
- Play AAB sha256 `8a916e29b929fc71decf87c645f7852a12c5a79585c85a4d7cab2b5348b218ae`
- packaged model sha256 `7b5ff9d323b3bea72eddc2faac3ea3ec8f40232acfa2318692ee30efbc202508`
- artifact `CUMA-WORLD-Android-Play-Build` id `9721663033`, 23,737,975 bytes,
  digest `sha256:339f754d3d89214c3648858e7c4bb59b933eed37dde585537f1119683c6d8e14`
- versionCode 1100, versionName 11.0.0-pre.1, targetSdk 36,
  orientation sensorLandscape, Play upload unsigned

CI proves the build. It says nothing about camera feel, animation quality,
vibration or readability on a real phone.

### Requires real-device testing from Milestone 06

- whether the 4.0 s intro earns its length or wants trimming toward 3.0 s
- whether the two establishing shots read as composed or as a camera drifting
- whether the blend into the third-person pose is invisible or noticeably lands
- whether the Reduced Motion 1.4 s version still feels like an intro at all
- whether tap-anywhere skip fires accidentally on a first touch, and whether the
  ATLA button is comfortably reachable in landscape
- that HUD and mobile controls genuinely stay hidden until the intro ends
- the intro on a cold start with slow GLB loading, where the character may still
  be swapping in mid-presentation
- backgrounding mid-intro on a real device and resuming
- whether the sprint FOV change now feels correct at full-joystick walk speed
- whether the 1.2 m/s sprint floor is right, or trips on a slow run start
- whether the standing turn's 57° dead zone and ~0.63 s turn feel natural, or
  the ~6.4° settle offset reads as the body being slightly off-camera
- the standing turn in a doorway and hard against a wall in cover
- whether the SEARCH inspect cadence reads as searching or as hesitating
- haptic distinctness of WATCH / SEARCH / HIGH_ALERT on real hardware
- whether the audio cue gains sit right against gameplay audio at various
  volume settings
- gadget-ready cue frequency during heavy SCAN/JAM/DECOY use
- feedback line legibility at LOW and under Reduced Motion
