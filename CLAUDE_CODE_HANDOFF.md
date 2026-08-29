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
