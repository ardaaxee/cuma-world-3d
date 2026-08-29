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

## Milestone 01 — Hearing + Social Stealth Foundation (implemented)

HEAD: `74631edc4ca3f00ce94766c8450fc1c25eb78ee7`
Commit: `feat: add hearing and zone suspicion foundation`

Files added:
- `src/game/noise.ts` — authoritative player noise model
- `src/game/zones.ts` — PUBLIC / STAFF / RESTRICTED access-zone model
- `src/game/stealth-signals.ts` — compact noise/zone HUD readout
- `src/stealth-signals.css`

Files changed:
- `src/game/npc.ts` — hearing folded into the existing awareness/investigation system
- `src/game/character.ts` — real landing feeds a noise burst
- `src/game/runtime11.ts` — feeds the noise/zone models and owns the new HUD

Behaviour added:
- One noise model derived from the existing locomotion/cover state. Named,
  tunable levels for idle / crouched / walking / running plus landing bursts.
  Fixed impulse pool, no per-frame allocation.
- NPC hearing works outside the vision cone. Heard noise raises awareness only
  to a loudness-derived ceiling hard-capped below ALERT, so footsteps can never
  raise the facility on their own: walking peaks at CURIOUS, only a close
  sprint reaches SUSPICIOUS.
- Heard noise creates an investigation point at the sound origin and reuses the
  existing investigation / last-known-position / search behaviour. A cooldown
  keeps guards searching where the sound was instead of tracking the player.
- One occlusion ray muffles sound through geometry without silencing it; LOW
  tier substitutes a flat attenuation and keeps hearing working.
- DECOY routes through the same model with a strictly higher awareness floor
  (0.46) and reach (13.5) than any incidental movement noise.
- Zone volumes over the existing market and service-route geometry. Presence
  alone builds suspicion in STAFF/RESTRICTED, amplifies NPC awareness gain,
  and eventually draws one security check. Returning to PUBLIC recovers;
  crouch, cover and earned staff access reduce the pressure.
- Current zone published on `document.body.dataset.zone`.

Reusable API for later milestones: `classifyZone`, `getPlayerZone`,
`getZoneSuspicion`, `setZoneAccessGranted` (credential/intel hook),
`resetZonePresence`.

Preserved untouched: controls, cover, gadgets, CCTV, route choice, the
ACCESS -> MANIFEST -> VERIFY -> EXTRACT chain, security broadcasts, settings and
debrief pause behaviour, graphics tiers, Android lifecycle handling.

Validation: `npm run build` passes. Boot chunk is byte-identical to the previous
build (35087 bytes); the added code lands entirely in the lazy runtime chunk.

Android workflow does not auto-run on this branch — `android-play-runtime.yml`
only triggers on push to `chatgpt/android-play-runtime`. Run it here with
`workflow_dispatch` against `claude/full-game-development`.

Not verified: any real-device behaviour. See the device notes below.

## Requires real-device testing

- Whether the noise/zone readout is legible and uncluttered in landscape.
- Whether hearing distances feel fair with touch controls rather than on paper.
- Whether the zone suspicion rate is too aggressive around the back-office
  objective, which sits inside the RESTRICTED volume by design.
- Performance of the added occlusion ray on MEDIUM/HIGH with three agents.
- Pause/background/resume with noise state reset.

## Planned next milestone after hearing/zone foundation

If the active milestone is green, ChatGPT will prepare the next Claude prompt for:
- physical back-office/security-room expansion
- reusable door/access state system
- social-stealth access opportunities
- intel-driven alternate routes

Do not start these early.
