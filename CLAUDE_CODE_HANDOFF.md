# CUMA WORLD — ChatGPT + Claude Code Shared Handoff

Last coordinated branch: `chatgpt/android-play-runtime`
Runtime target: Android / Google Play pre-release
Engine/runtime: TypeScript + Babylon.js + Capacitor Android
Godot is **not** the publication runtime for this branch.

## Collaboration rules

1. Always pull/re-read the current branch head before editing. This branch is being changed by more than one assistant/workflow.
2. Do not overwrite a whole file from an old snapshot. Apply the smallest compatible change on top of the latest blob.
3. Active gameplay runtime is `src/game/runtime11.ts`. `src/game/runtime.ts` is legacy/reference and must not receive new production features.
4. Reuse existing systems. Do not create second NPC, mission, graphics, HUD, audio, camera, stealth, or visual-polish implementations.
5. Before pushing, run `npm run build`. After push, the Android workflow must pass TypeScript/Vite first, then Capacitor/API 36, then APK+AAB.
6. Do not merge to `main` or publish to Google Play. This is still pre-release.
7. Do not claim FPS, device performance, Play upload readiness, or packaged character assets unless CI/device evidence exists.
8. If you complete or materially change a task, update this handoff so the other assistant can continue without duplicating work.

## Current architecture

### Android / Play
- Capacitor Android runtime.
- `targetSdk=36`.
- Native orientation is `sensorLandscape`.
- CI creates a test APK and Play AAB.
- SHA-256 files and `BUILD_INFO.txt` are generated automatically.
- Upload signing is optional through repository secrets and must remain reported as false unless actual signing succeeds.

### Entry / UI
- `src/main.ts` is the shell and lazy-loads `./game/runtime11`.
- Runtime 11 is not meant to be eagerly bundled into the briefing shell.
- UI layers include briefing, HUD, settings, audio feedback, and cinematic mission debrief.
- HUD supports COMPACT/FULL. COMPACT intentionally quiets/collapses after the player enters gameplay.

### Gameplay runtime
- `src/game/runtime11.ts` is authoritative.
- Third-person shoulder camera with collision ray protection.
- Mobile analog joystick + touch-look.
- Mission flow: briefing → recon/intel → route selection → infiltrate → objective → extraction → complete/debrief.
- Recon discovers required and optional intel.
- CCTV opportunity is gated by discovered camera intel and mission state.

### Character
- `src/game/character.ts` owns player collider, procedural fallback avatar, GLB loading and idle/walk/run animation selection.
- Real CUMA GLB remains optional. Current source archive historically did not contain `cuma_high.glb`/`cuma.glb`; never claim the model is packaged unless CI says `CUMA_MODEL_PACKAGED=true`.
- Keep procedural avatar only as fallback; do not present it as the final character.

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
- It already owns quality-gated market/street details, practical lights, market ceiling/fixtures, shelf detail, streetlights, benches, trees and additional props.
- Keep practical PointLight count bounded on mobile. Prefer geometry/material/readability improvements over expensive full-screen effects.
- Do not create a second world-polish system.

### Graphics / performance
- `src/game/graphics.ts`: AUTO/LOW/MEDIUM/HIGH/ULTRA, render scale, target FPS, shadows, fog/view distance, exposure/contrast.
- Vite production bundle has explicit code splitting (`babylon-runtime` contract in CI).
- Static visual meshes can be frozen where safe; do not freeze moving/interactable objects.

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
- Latest known CI issue was TypeScript strict indexing in debrief parsing; fixed by ChatGPT in commit `ceb27cd7fa576a2171cc77e50d35a7c328576ff6`.

## Current priority order

### P0 — keep build green
- Confirm the post-`ceb27cd7` Android workflow passes TypeScript/Vite.
- If it fails, fix the exact current error before adding features.
- Then require full Android APK + AAB artifact success.

### P1 — vertical-slice quality
1. Character asset pipeline: locate/provide a real licensed CUMA GLB and package it deterministically; keep fallback safe.
2. Camera/game feel: test collision edge cases, tight interior framing, spawn framing, look sensitivity and reduced-motion behavior.
3. Market/street readability: improve materials/geometry/lighting through the existing `VisualPolish` only.
4. Mission presentation: ensure briefing → gameplay → debrief transitions never overlap HUD/settings/mobile controls.
5. Interaction polish: route/objective/extraction/CCTV prompts should appear only when actionable.
6. Audio: only extend when a real licensed asset exists; keep current three shipped assets stable.

### P2 — stealth/gameplay depth
- NPC search/investigation tuning based on last seen position (already implemented; tune, do not duplicate).
- Awareness communication and recovery behavior.
- More environmental opportunities backed by actual world interactions, not menu-only choices.
- Optional intel should affect debrief score/route/readability consistently.

### P3 — mobile optimization
- Maintain LOW/MEDIUM/HIGH/ULTRA budgets.
- Measure bundle size and CI output; avoid invented FPS numbers.
- Reduce Babylon import/bundle overhead where possible without breaking loader/runtime.
- Use distance/quality gating before adding more dynamic lights/NPCs.

### P4 — Play release (not yet)
- Real upload keystore / Play App Signing setup.
- Final app icon/store screenshots/feature graphic.
- Privacy/store metadata review.
- Signed AAB verification.
- Only then consider a Play Console upload.

## What Claude Code should do next

Start by reading the latest branch head and the newest GitHub Actions result. If the build after `ceb27cd7` is red, fix only that regression first. If green, take one P1 item that does not overlap another in-progress edit. Prefer a focused commit with an explicit contract/test update. Update this handoff after completion.

## What ChatGPT is doing next

- Watching the post-debrief CI gate.
- Keeping active Runtime 11 architecture single-source (no duplicate systems).
- Continuing P1/P2 only after the current build is green.
