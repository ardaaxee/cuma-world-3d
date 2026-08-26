# CUMA WORLD — Google Play Release Checklist

Status values: **DONE**, **PARTIAL**, **MISSING ASSET**, **NOT IMPLEMENTED**.

This file describes the current `chatgpt/android-play-runtime` pre-release branch. It is not authorization to publish the game.

## Android package

- **DONE** — Application ID: `com.cumaworld.game`
- **DONE** — Application name: `CUMA WORLD`
- **DONE** — Android target SDK: 36
- **DONE** — Landscape orientation: `sensorLandscape`
- **DONE** — Cleartext HTTP disabled
- **DONE** — Capacitor WebView debugging disabled
- **DONE** — Debug APK generation in CI
- **DONE** — Release AAB generation in CI
- **DONE** — APK/AAB SHA-256 manifest generation
- **PARTIAL** — Play upload signing infrastructure exists, but the upload keystore secrets are not configured. CI currently reports `play_upload_signed=false`.

## Runtime / performance

- **DONE** — Babylon.js runtime is loaded only after the player presses `OPERASYONU BAŞLAT`.
- **DONE** — Babylon/vendor code is split into multiple runtime chunks instead of one multi-megabyte JavaScript file.
- **DONE** — Graphics profiles: AUTO / LOW / MEDIUM / HIGH / ULTRA.
- **DONE** — Render scale, FPS target, shadows, fog/view distance, exposure/contrast and Reduced Motion settings.
- **DONE** — LOW quality disables the non-essential worker NPC and stops its patrol/LOS updates.
- **DONE** — NPC sensing interval scales with graphics tier.
- **NOT IMPLEMENTED** — Measured physical-device FPS / frame-time benchmark suite. Do not claim FPS targets as achieved performance until tested on real supported devices.

## Gameplay vertical slice

- **DONE** — Briefing → Recon → Planning → Infiltrate → Extract → Complete mission flow.
- **DONE** — Main and side approach selection.
- **DONE** — Optional intel and CCTV opportunity.
- **DONE** — GHOST / SHADOW / OPERATIVE result and mission score.
- **DONE** — Third-person shoulder camera with obstacle avoidance.
- **DONE** — NPC awareness states: NORMAL / CURIOUS / SUSPICIOUS / ALERT.
- **DONE** — NPC last-known-position investigation memory.
- **DONE** — City ambience and two varied footstep samples.
- **DONE** — Lightweight UI feedback for intel / curiosity / suspicion / alert.
- **MISSING ASSET** — Final CUMA GLB character. The current source archive does not contain `cuma_high.glb` or `cuma.glb`; procedural fallback remains active.
- **MISSING ASSET** — Final-quality interaction SFX such as doors, switches, store equipment, TV/PC and other world objects.

## Visual presentation

- **DONE** — Market/street visual polish layer with quality-gated geometry.
- **DONE** — Market ceiling/fixtures, shelf stock, coolers/checkouts/loading details, street furniture and practical lights.
- **DONE** — Compact HUD mode that reduces the mission card after a few seconds.
- **PARTIAL** — PBR-style materials and lighting are implemented, but final authored texture/material asset pass is not complete.
- **MISSING ASSET** — Final high-quality character art.

## Privacy / Data safety

- **DONE** — In-app privacy page exists at `public/privacy.html`.
- **DONE** — Privacy page is linked from Settings.
- **DONE** — Current policy describes the actual pre-release behavior: local mission/settings storage, no active ads, analytics SDK, social login or account system.
- **PARTIAL** — Final developer/support contact must be inserted before public release. Do not invent a contact address.
- **PARTIAL** — A public HTTPS privacy-policy URL must be supplied in Play Console before release.
- **PARTIAL** — Google Play Data safety form must be completed in Play Console and re-checked against the final app dependencies/features immediately before release.

### Current Data safety draft

Based on the current runtime only:

- Mission progress, intel and preferences are stored locally on-device.
- No application account is required.
- No advertising SDK is active.
- No analytics SDK is active.
- No precise location, contacts, photos, microphone recording, advertising ID, payment details, name, email or phone-number collection is implemented by CUMA WORLD.

This is a draft, not a permanent declaration. Re-audit it whenever analytics, ads, login, multiplayer, crash reporting, cloud save, purchases or any network service is added.

## Store listing assets

- **NOT IMPLEMENTED** — Final Play Store app icon / 512×512 store icon.
- **NOT IMPLEMENTED** — Final adaptive Android launcher icon.
- **NOT IMPLEMENTED** — Feature graphic.
- **NOT IMPLEMENTED** — Final phone screenshots generated from the release candidate.
- **NOT IMPLEMENTED** — Final short description / long description review.
- **NOT IMPLEMENTED** — Final content-rating questionnaire in Play Console.

Do not generate misleading screenshots that show graphics or features not present in the release build.

## Release validation

Before public release:

1. Package the real CUMA character asset and verify its SHA-256 in `BUILD_INFO.txt`.
2. Replace remaining placeholder/fallback production assets where required.
3. Test the release candidate on representative physical Android devices and record frame-time / thermal / memory results.
4. Configure the Play upload keystore secrets and verify a signed upload AAB.
5. Add the final support contact and publish the privacy policy at a stable HTTPS URL.
6. Complete Data safety and content-rating forms using the actual final binary behavior.
7. Create store icon, feature graphic and screenshots from the real release candidate.
8. Use internal/closed testing before production rollout.
9. Only then promote the tested AAB to production.
