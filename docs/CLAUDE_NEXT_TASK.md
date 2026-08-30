# CLAUDE NEXT TASK — Milestone 09: Mobile UX + Controls + Accessibility

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, `docs/CLAUDE_007_STYLE_GUIDE.md`, and `docs/CHARACTER_PIPELINE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Verified baseline:
- Milestone 08 gameplay: `0c3e42e7dbf35ed7d37eb0dfd6ad2a540788e4db`
- Milestone 08 handoff: `6d482368119a81bef09a35b3ea1188dc4213e228`
- Android run `33303346945` (#137): SUCCESS with PROGRESSION 234, AUDIO 104, PRESENTATION 96, MISSION 117, CHARACTER 53, regression guards, audio/character audits, APK/AAB and artifact.

Milestone 08 is complete. Work ONLY on mobile UX and settings here.

## Goal

Make the landscape Android controls reliable with simultaneous touches, safe areas, handedness, control sizing, haptics preference, vertical-look inversion, settings persistence, pause/background/orientation recovery and readable touch targets.

Preserve every verified gameplay system.

## A. Inspect first

Audit:
- `src/game/input.ts`
- `src/game/preferences.ts`
- `src/game/runtime11.ts`
- `src/main.ts`
- `src/styles.css`
- `src/movement.css`
- `index.html`
- `src/game/gadgets.ts`
- all vibration call sites
- pause/background/orientation paths

Structurally check representative landscape CSS viewports: 640x360, 740x360, 800x360, 915x412, 960x440. Do not claim real-device ergonomics from CI.

## B. Keep one MobileInput owner

`src/game/input.ts` remains the only gameplay input owner.

Support simultaneous:
1. joystick pointer
2. look pointer
3. action press

Pointer ownership must be explicit:
- joystick owns one pointer id
- look owns one pointer id
- action buttons cannot steal either
- second joystick/look pointer is ignored safely
- pointercancel/lost capture releases only its owner
- blur/background/orientation clears transient input
- no stuck RUN
- no queued JUMP/INTERACT after pause/cinematic

A small dependency-free pointer-ownership helper is allowed. Do not add another input manager or another render loop.

## C. Remove input DOM scraping

`MobileInput` currently uses MutationObserver to infer ETKİLEŞ/GÖZLEM state from DOM.

Remove this.

Add explicit APIs such as:
- `setInteractionAvailable(boolean)`
- `setObservationActive(boolean)`

Use runtime truth already available.

Requirements:
- no MutationObserver in `input.ts`
- no HUD text parsing
- no repeated DOM queries in the hot path
- button class/ARIA updates only when state changes

## D. Expand gameplay preferences without breaking old settings

Keep existing key unless there is a proven reason not to:
`cuma_world_gameplay_preferences_v1`

Preserve:
- lookSensitivity
- audioVolume
- hudMode

Add:
- `hapticsEnabled: boolean`
- `controlSize: "COMPACT" | "STANDARD" | "LARGE"`
- `controlHandedness: "RIGHT" | "LEFT"`
- `invertLookY: boolean`

Defaults:
- haptics ON
- STANDARD
- RIGHT
- invert Y OFF

Old three-field preference JSON must load with defaults for the new fields. Corrupt or invalid fields fall back independently. Mission/progression storage must not be touched.

## E. One haptics owner

Create one dependency-light helper such as `src/game/haptics.ts`.

Route all vibration through it.

No direct `navigator.vibrate(...)` elsewhere after this milestone.

Provide restrained semantic calls such as tap/confirm/warning/critical.

Rules:
- haptics OFF means no game vibration anywhere
- missing vibration API is harmless
- no continuous/per-frame vibration
- no dedicated timer
- setting applies immediately
- haptics never changes gameplay state

## F. Control handedness

RIGHT default:
- joystick left
- action cluster right

LEFT:
- joystick right
- action cluster left

Look zone must adapt so it does not swallow joystick/action presses.

Do not duplicate markup; use CSS class/dataset/variables.
Do not mirror mission HUD text.
Changing handedness while settings are open should clear transient pointers first and apply immediately.

## G. Control size

Support COMPACT/STANDARD/LARGE using real dimensions/CSS variables, not visual-only transforms.

Affect:
- joystick
- knob
- action hit targets
- spacing

Keep labels readable. Current low-height layout can fall to very small text/targets; improve it.

Normal/large targets should aim for roughly 44 CSS px or more where the viewport permits. On very small landscape screens, clamp the effective layout safely rather than allowing overlap. Stored preference remains unchanged when an effective clamp is used.

No overlap with safe areas or between action cluster and joystick at the representative viewports.

## H. Action hierarchy

Preserve current semantics:
- RUN hold
- JUMP one-shot
- CROUCH toggle
- OBSERVE/FIELD FOCUS
- INTERACT contextual
- GADGET existing toolkit

INTERACT remains the clear contextual primary action but should not cause layout jumps when availability changes.

Do not change gameplay speeds, physics, cooldowns or mission logic.

## I. Invert Y

Apply vertical-look inversion in exactly one authoritative layer.

Requirements:
- X unchanged
- only Y sign changes
- sensitivity still applies once
- cinematic unaffected
- stationary body turn unaffected except for the resulting normal gameplay look

## J. Safe areas and lifecycle

Preserve `viewport-fit=cover` and `env(safe-area-inset-*)`.

Audit joystick, actions, settings button/panel, cinematic skip and debrief buttons in both landscape directions.

On settings open, blur, hidden/background or orientation change:
- clear transient pointer ownership
- clear RUN
- clear queued jump/interact/look deltas
- do not create duplicate listeners

Resume must start with neutral transient input.

Reuse existing resize/orientation behavior; no repeating orientation timer.

## K. Settings panel

Keep the existing settings panel and existing graphics/audio/Reduced Motion controls.

Add a compact mobile-controls/accessibility group for:
- control size
- handedness
- invert Y
- haptics

Changing these applies live and persists.
Settings remain scrollable and touch-friendly.
Gameplay must not receive touches behind the open settings panel.

## L. Tests

Add `ci/test_mobile_ux.mjs` or equivalent.

Test at minimum:
- old preferences gain new defaults
- corrupt/invalid preference values
- round-trip persistence
- haptics gate
- control-size mapping and small-screen clamp
- handedness mapping
- invert Y on/off
- sensitivity not doubled
- joystick acquire/release
- look acquire/release
- duplicate pointer rejection
- joystick + look coexistence
- joystick + look + action coexistence
- action does not steal look
- cancel/lost capture ownership
- transient reset clears RUN/jump/look/pointers
- crouch is not accidentally toggled by transient reset
- explicit interaction state
- explicit observation state
- no MutationObserver required by MobileInput
- representative layout constraints if a pure layout helper is introduced

## M. Regression guards

Extend the existing explicit-fail guard script so CI rejects regressions such as:
- MutationObserver construction in `input.ts`
- direct vibration calls outside the haptics owner
- duplicated gameplay-preference storage key
- new recurring loop/timer in mobile UX helpers
- duplicated core mobile-control markup

Keep the checks specific to active code, not comments.

## N. Preserve all verified systems

Keep green:
- PROGRESSION_OK 234
- AUDIO_RUNTIME_OK 104
- PRESENTATION_OK 96
- MISSION_GRAPH_OK 117
- CHARACTER_RUNTIME_OK 53
- presentation/audio/progression guards
- AUDIO REPORT/AUDIO_OK
- CHARACTER_GLB_OK

Do not regress mission graph, progression, audio/noise separation, cinematic, camera/cover, facility security, NPC routines, character pipeline, graphics or Android lifecycle.

## Acceptance

- joystick + look simultaneous works
- joystick + look + action works
- pause/settings/background cannot leave stuck input
- interaction/observe state is explicit, not DOM-observed
- haptics OFF silences all haptic output without gameplay changes
- LEFT/RIGHT layouts work without duplicating HUD
- control sizes apply live with real hitbox changes
- small landscape clamps safely
- invert Y affects only vertical gameplay look
- old preferences remain compatible
- all previous tests remain green

## Validation and delivery

Run:
- `npm run build`
- character 53
- mission 117
- presentation 96
- audio 104
- progression 234
- new mobile UX tests
- regression guards
- audio audit

Milestone 08 CI baseline:
- bootstrap JS `33894`
- largest JS `812392`
- artifact `23752024` bytes

Report exact total JS/web baselines from #137 and before/after deltas. All budgets must remain green and the bootstrap must still contain no Babylon/world-graph markers.

Suggested gameplay commit:
`feat: refine mobile controls and accessibility settings`

Push once, then dispatch `.github/workflows/android-play-runtime.yml` on the exact gameplay SHA.

Before declaring SUCCESS verify final workflow status, new mobile UX suite, all existing suites/audits, debug APK, Play AAB and artifact.

Update `CLAUDE_CODE_HANDOFF.md` with gameplay/handoff SHA, changed files, preference schema/migration, pointer model, simultaneous touch behavior, explicit context-action flow, haptics owner, control sizing, handedness, invert-Y ownership, safe-area/lifecycle changes, settings changes, test counts, bundle deltas, workflow id, APK/AAB hashes, artifact id/size/digest and concrete real-device checks.

Milestone 09 bittikten sonra Milestone 10'a BAŞLAMA.
STOP.
