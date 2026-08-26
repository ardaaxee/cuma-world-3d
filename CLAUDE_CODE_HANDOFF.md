# CUMA WORLD — ChatGPT + Claude Code Shared Handoff

Last coordinated branch: `chatgpt/android-play-runtime`
Runtime target: Android / Google Play pre-release
Engine/runtime: TypeScript + Babylon.js + Capacitor Android
Godot is **not** the publication runtime for this branch.

## Collaboration rules

1. Always pull/re-read the current branch head before editing. This branch is being changed by more than one assistant/workflow.
2. Do not overwrite a whole file from an old snapshot. Apply the smallest compatible change on top of the latest blob.
3. Active gameplay runtime is `src/game/runtime11.ts`. `src/game/runtime.ts` is legacy/reference and must not receive new production features.
4. Reuse existing systems. Do not create second NPC, mission, graphics, HUD, audio, camera, stealth, character-loading, or visual-polish implementations.
5. Before pushing, run `npm run build`. After push, the Android workflow must pass TypeScript/Vite first, then Capacitor/API 36, then APK+AAB.
6. Do not merge to `main` or publish to Google Play. This is still pre-release.
7. Do not claim FPS, device performance, Play upload readiness, or model runtime appearance unless there is actual evidence.
8. If you complete or materially change a task, update this handoff so the other assistant can continue without duplicating work.

## Last verified CI state

- Run #66 (`33011568988`, commit `ceb27cd7fa576a2171cc77e50d35a7c328576ff6`) was fully green through APK + AAB + SHA artifact upload.
- Run #70 (`33012021455`, commit `dd352a9cbf3d178c03660420dec17cbd599261c7`) is also fully green and includes the JavaScript bundle regression budgets.
- Run #71 (`33012271769`, commit `a3fcbf7ea5fce3ff86e8c68e6518043479a6ec7d`) is validating the real high-detail character pipeline. At handoff update time, character packaging + audio + TypeScript/Vite + native Capacitor creation had passed; wait for full APK/AAB completion before calling it release-build green.

## Current architecture

### Android / Play
- Capacitor Android runtime.
- `targetSdk=36`.
- Native orientation is `sensorLandscape`.
- `cleartextTraffic=false`.
- CI creates a test APK and Play AAB.
- SHA-256 files and `BUILD_INFO.txt` are generated automatically.
- Upload signing is optional through repository secrets and must remain reported as false unless actual signing succeeds.

### Entry / UI
- `src/main.ts` is the shell and lazy-loads `./game/runtime11`.
- Runtime 11 is not meant to be eagerly bundled into the briefing shell.
- UI layers include briefing, HUD, settings, UI audio feedback, interaction prompt guard, and cinematic mission debrief.
- HUD supports COMPACT/FULL. COMPACT intentionally quiets/collapses after the player enters gameplay.
- `src/game/interaction-prompt-guard.ts` hides non-actionable route/objective/extraction/CCTV prompts at presentation level. Actual mission validation remains in MissionDirector.

### Gameplay runtime
- `src/game/runtime11.ts` is authoritative.
- Third-person shoulder camera with collision ray protection.
- Mobile analog joystick + touch-look.
- Mission flow: briefing → recon/intel → route selection → infiltrate → objective → extraction → complete/debrief.
- Recon discovers required and optional intel.
- CCTV opportunity is gated by discovered camera intel and mission state.

### Mission interaction rules
- `src/game/mission.ts` owns the rules.
- `MissionDirector.canInteract()` is now the single eligibility source for:
  - route-main
  - route-side
  - objective
  - extract
  - camera-bypass
- `chooseRoute`, `completeObjective`, `extract`, and `useOpportunity` use that method. Do not copy mission-state eligibility into new gameplay systems.

### Character
- `src/game/character.ts` owns player collider, procedural fallback avatar, GLB loading and idle/walk/run animation selection.
- Android CI now packages a verified high-detail GLB when the source archive does not contain one:
  - source: `kunalkushwaha/vsim`
  - pinned commit: `3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91`
  - path: `packages/assets/library/suited.glb`
  - expected bytes: `6,675,064`
  - expected Git blob SHA-1: `95033d30a4b4bab4a4a0ce3eb176a4ce7d73d0b5`
  - provenance: MakeHuman / MPFB 2 human + suit/shoes, CC0/public-domain as documented by upstream CREDITS.
- CI copies the provenance text as `CUMA_HIGH_LICENSE.txt` beside `cuma_runtime.glb`.
- Procedural avatar remains a safe fallback if glTF import fails. Do not present fallback as final character.
- Do not claim on-device visual correctness of the imported model until an actual APK/device screenshot confirms scale/orientation/skin/animations.

### NPC / stealth
- `src/game/npc.ts` already implements:
  - NORMAL → CURIOUS → SUSPICIOUS → ALERT awareness.
  - distance + FOV + raycast line-of-sight.
  - sensing cadence controlled by graphics tier.
  - last-seen-position investigation memory and timed investigation.
  - suspicion decay after line of sight is lost.
- LOW quality reduces active NPC budget; do not add another AI loop.

### Security camera
- `src/game/security.ts` owns fictional in-game CCTV detection and bypass panel.
- This is game-only fictional stealth gameplay; do not turn it into real-world surveillance functionality.

### Visuals / lighting
- `src/game/visuals.ts` is the single VisualPolish system.
- It already owns quality-gated market/street details, practical lights, market ceiling/fixtures, shelf detail, streetlights, benches, trees, coolers, checkout, loading crates and utility props.
- Many static meshes use `freezeWorldMatrix()`.
- Keep practical PointLight count bounded on mobile. Prefer geometry/material/readability improvements over expensive full-screen effects.
- Do not create a second world-polish system.

### Graphics / performance
- `src/game/graphics.ts`: AUTO/LOW/MEDIUM/HIGH/ULTRA, render scale, target FPS, shadows, fog/view distance, exposure/contrast.
- Vite production bundle has explicit code splitting (`babylon-runtime`).
- `ci/measure_android_web_bundle.py` now gates:
  - bootstrap JS <= 100 KiB
  - largest JS chunk <= 900 KiB
  - total JS <= 8.5 MB
- Last verified run #66 metrics before these hard limits: bootstrap 11,227 B; largest chunk 809,372 B; total JS 6,957,089 B. These are bundle metrics, not FPS measurements.

### Audio
- `src/game/audio.ts` currently uses only packaged/licensed existing assets:
  - `city_ambience.wav`
  - `footstep_a.wav`
  - `footstep_b.wav`
- Footsteps already have pace, pitch and volume variation.
- UI audio feedback is separate in `src/game/ui-audio-feedback.ts`.
- Do not call missing door/switch/TV/etc. sound effects implemented. Mark them MISSING ASSET until licensed files exist.

### Debrief
- `src/game/debrief.ts` shows a cinematic mission result when the HUD reports COMPLETE.
- It pauses runtime while open and resumes on close.
- Strict-indexing bug was fixed in commit `ceb27cd7fa576a2171cc77e50d35a7c328576ff6`.

## Current priority order

### P0 — keep build green
- Wait for run #71 to finish and verify APK + AAB + BUILD_INFO.
- Confirm `cuma_model_source` is the pinned CC0 source and `cuma_model_sha256` is no longer unavailable.
- If red, fix the exact current failure before adding another large feature.

### P1 — vertical-slice quality
1. Real character device verification: scale, orientation, materials, idle/walk/run, camera framing, shadow casting.
2. Camera/game feel: collision edge cases, tight interior framing, spawn framing, look sensitivity and Reduced Motion.
3. Market/street readability: improve materials/geometry/lighting through existing `VisualPolish` only.
4. Mission presentation: briefing → gameplay → debrief transitions must never overlap HUD/settings/mobile controls.
5. Interaction polish: use `MissionDirector.canInteract()` as the gameplay truth; avoid dead prompts.
6. Audio: only extend when a real licensed asset exists; keep current three shipped assets stable.

### P2 — stealth/gameplay depth
- Tune existing last-seen-position investigation; do not duplicate it.
- Improve awareness communication and recovery behavior.
- Add environmental opportunities only when they have actual world interactions, not menu-only choices.
- Keep optional intel effects consistent with score/route/debrief.

### P3 — mobile optimization
- Maintain LOW/MEDIUM/HIGH/ULTRA budgets.
- Respect the JS bundle gates.
- Reduce Babylon/runtime overhead only when measurements justify it.
- Use distance/quality gating before adding dynamic lights/NPCs.

### P4 — Play release (not yet)
- Real upload keystore / Play App Signing setup.
- Final app icon/store screenshots/feature graphic.
- Privacy/store metadata review.
- Signed AAB verification.
- Only then consider a Play Console upload.

## What Claude Code should do next

Read the latest branch head and newest Actions run first. Do **not** reimplement the character source lookup, mission interaction rules, prompt guard, bundle budgets, NPC investigation, or VisualPolish. If run #71 is green, take a non-overlapping P1 item: preferably camera framing/collision tuning or a focused device-agnostic character shadow/animation validation. Make one focused commit and update this handoff.

## What ChatGPT is doing next

- Finishing validation of run #71 and the verified high-detail character package.
- Checking `BUILD_INFO.txt`/artifact once green.
- Then moving to character visual integration/camera polish without duplicating Claude's work.
