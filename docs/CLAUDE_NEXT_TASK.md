# CLAUDE NEXT TASK — Milestone 07: Layered Audio World + Spatial Stealth Feedback

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, `docs/CLAUDE_007_STYLE_GUIDE.md`, and `docs/CHARACTER_PIPELINE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current verified baseline before this milestone:
- Milestone 06 gameplay: `53d9e066929dbb4eadaa21b40a69e3ef240bb978`
- Milestone 06 handoff: `209942424bbb674e5bdbebebc2b63f2e7ab225f2`
- Android workflow run `33276421355` (#135): SUCCESS on the exact gameplay SHA with `PRESENTATION_OK 96`, `MISSION_GRAPH_OK 117`, `CHARACTER_RUNTIME_OK 53`, presentation regression guards, CHARACTER REPORT, debug APK, Play AAB and artifact.
- Packaged CI bootstrap baseline: `24711` bytes.

Milestone 06 is verified. Do not rework its cinematic, typed presentation contract, sprint-FOV fix, stationary turn, character pipeline, mission graph, facility security, door/access, cover, noise/hearing, NPC routine or save systems except for minimal audio integration.

## Goal

Make CUMA WORLD sound like one coherent physical stealth space instead of a city loop plus two generic footstep files.

Build a mobile-first layered audio system that improves:
- locomotion and landing weight
- acoustic difference between outdoor / market / back-of-house / loading spaces
- doors, cart and physical interactions
- gadgets
- mission/security presentation
- spatial readability of nearby world sounds
- pause/resume and Android audio lifecycle

The game remains an original contemporary spy-thriller. Do not copy or rip music, ambience, UI sounds, weapon sounds, dialogue, sirens or sound design from another game, film or franchise.

No combat/weapon audio belongs in this milestone.
Do not add dialogue, voice acting, lip-sync or a soundtrack system.

The authoritative gameplay noise/hearing model from Milestone 01 is NOT the audio renderer. Audio presentation must never silently change AI hearing radius, facility heat or stealth rules.

---

# Part A — Audit current audio first

Inspect before editing:
- `src/game/audio.ts`
- `src/game/ui-audio-feedback.ts`
- `src/game/presentation-events.ts`
- `src/game/runtime11.ts`
- `src/game/character.ts` landing path
- `src/game/noise.ts`
- `src/game/doors.ts`
- `src/game/delivery-cart.ts`
- `src/game/gadgets.ts`
- `src/game/facility-security.ts`
- `.github/workflows/android-play-runtime.yml`
- current archive/public/dist audio packaging

Current known runtime audio:
- `city_ambience.wav`
- `footstep_a.wav`
- `footstep_b.wav`
- `GameAudio` currently uses `HTMLAudioElement`
- footstep cadence is timer-based
- `UiAudioFeedback` owns a separate small WebAudio context for typed presentation blips

Measure/report the actual packaged assets when present:
- filename
- bytes
- container/codec where inspectable
- sample rate
- channel count
- duration
- total packaged audio bytes

Do not invent asset metadata.

---

# Part B — One gameplay/world audio owner

Refactor toward ONE authoritative runtime audio owner, preferably keeping `GameAudio` as the public owner rather than creating a competing AudioManager.

It may use small dependency-light helper modules, e.g.:
- `audio-model.ts` — pure gait/mix/state logic
- `audio-events.ts` — typed world-audio cue contract
- `audio-surfaces.ts` — acoustic/surface classification
- `audio-voices.ts` — optional voice-pool helper

But there must still be one runtime owner that creates/controls the gameplay AudioContext / buses / voices.

Preferred architecture:
- one AudioContext after user gesture
- one master gain
- category buses such as ambience / world SFX / player SFX / presentation, only if useful
- a bounded spatial voice pool
- one listener update path

Do not create one AudioContext per sound.
Do not create a second requestAnimationFrame loop.
Do not create a timer per sound source.

### UiAudioFeedback consolidation

Milestone 06's typed presentation cues must remain.

If practical, fold `UiAudioFeedback`'s synthesis into `GameAudio` so there is one audio context and one volume owner. `UiAudioFeedback` may become a pure cue-shape helper or be removed if cleanly replaced.

If keeping it separate is demonstrably safer, document why and ensure there are still no duplicate cues or multiple contexts after repeated runtime starts. Preferred outcome is one context.

`main.ts` should not need to unlock two independent audio engines if one owner can handle it.

---

# Part C — Safe asset loading + procedural fallback

Use only local packaged assets with known provenance.
No runtime internet fetch to remote hosts.
No random web sound downloads.
No unpinned third-party binary audio.

Existing WAV files may remain the real sampled foundation.

For missing optional sounds, use a restrained procedural WebAudio fallback rather than failing gameplay. Procedural synthesis may cover short non-musical cues such as:
- door latch/thump
- landing thud
- cart wheel/stop texture
- scan/jam confirmation
- security pressure accent

Do not synthesize fake speech.
Do not build a song/music generator.

A missing optional audio file must never break boot, movement, mission progression or interaction.

Avoid huge new binary assets. If a future asset contract is added, document it without downloading restricted content.

---

# Part D — Audio asset audit in CI

Add a lightweight audio audit script, e.g. `ci/audit_audio_assets.py`, using the standard library where practical.

For WAV assets report:
- bytes
- channels
- sample rate
- sample width/bit depth where available
- frame count
- duration

Print a clear `AUDIO REPORT` in CI.

Recommended validation rules:
- malformed packaged WAV -> fail if that file is declared/packaged
- absurd sample rate/channel count -> fail or warn with a documented threshold
- excessively large single/total audio payload -> fail/warn using measured baseline and reasonable Android headroom
- missing optional file -> report fallback, do not fail

Do not require FFmpeg or another heavyweight dependency just for this audit unless already available and clearly justified.

The workflow must still prove the audio assets actually land in `dist/assets/audio` when packaged and therefore in Capacitor Android output.

---

# Part E — Distance-based player footstep scheduler

Current footstep timing is a clock derived from speed. Replace it with a small deterministic locomotion/gait scheduler based primarily on actual horizontal distance travelled, so speed changes do not make steps feel detached.

Suggested pure state:
- accumulatedDistance
- next foot / alternating sample index
- locomotion mode: CROUCH / WALK / RUN
- optional start/reset handling

Use tuned stride distances rather than animation-root motion.

Requirements:
- standing still -> no repeated footsteps
- tiny joystick jitter -> no footstep spam
- crouch -> slower/quieter cadence
- walk -> normal cadence
- actual RUN + moving -> faster/stronger cadence
- changing WALK <-> RUN should not double-fire a step
- pause/cinematic must not accumulate a giant delayed footstep
- no per-frame random

Do NOT change authoritative movement speed.
Do NOT change the gameplay noise values merely to match the audio.

Pitch/level variation should be deterministic from a small repeating or seeded pattern, not `Math.random()` every step.

---

# Part F — Surface / acoustic classification

Create a small authored surface/acoustic classifier grounded in the real current map.

At minimum distinguish useful broad contexts such as:
- outdoor plaza / alley concrete
- market interior hard floor
- staff/back-office interior
- loading/service industrial area

Use actual geometry/volumes/coordinates after inspection. Do not invent an enormous material system.

Preferred options:
- classify by authored acoustic volumes, or
- classify the actual ground mesh on a footstep event if metadata can be added cleanly

Do NOT raycast every frame just for audio.
A ray on actual footstep emission is acceptable if cheap and needed.

Even with only the two current footstep samples, make surfaces read differently through restrained processing:
- playback-rate range
- gain
- filter/EQ
- optional short room response

Do not make surfaces cartoonishly different.

Expose a small typed `AudioSurface`/`AcousticZone` contract so future real samples can drop into the same system.

---

# Part G — Layered ambience / indoor-outdoor transition

Preserve `city_ambience.wav` as a legal/local ambience source when packaged.

Make ambience respond to broad acoustic space rather than playing at one fixed volume everywhere.

Examples:
- outdoor: city ambience open/full
- market interior: lower city bed + gentle low-pass / interior room tone
- back office/restricted rooms: more enclosed presentation
- loading/service: partially open exterior/industrial character

Use restrained crossfades, not abrupt volume jumps at a boundary.

A small procedurally generated filtered-noise room tone is acceptable if it is stable and cheap.
Do not generate per-frame noise buffers.
Generate reusable buffers/nodes once.

No dynamic soundtrack/music in this milestone.

### Security tension layer

Facility state is already known and displayed.
A subtle non-musical tension layer may respond to:
- CALM
- WATCH
- SEARCH
- HIGH_ALERT

Rules:
- it must not reveal information the HUD/facility state does not already expose
- no loud continuous siren
- no commercial-music imitation
- no melody/theme
- crossfade smoothly
- HIGH_ALERT may be more tense, but still allow footsteps/world sounds to remain readable
- recovery fades cleanly back toward calm

Reduced Motion does not need to change audio intensity unless there is a clear accessibility reason; do not couple unrelated settings.

---

# Part H — Spatial world audio

Add limited spatialization for sounds that have a real world origin.

Candidate cues:
- door interaction
- delivery cart movement/stop
- DECOY at its actual target point
- nearby environmental interaction
- optional NPC local acknowledgement only if an existing non-voice sound exists; do not invent speech

Use a bounded voice pool.
Suggested mobile target: roughly 4–8 concurrent spatial one-shots/loops, chosen after profiling/architecture review.

Use WebAudio `PannerNode` or another native browser primitive if stable.

Listener should follow the active gameplay camera/player orientation using cached vectors/values.
Do not allocate new arrays/vectors for audio listener math every frame.

### Spatial attenuation

Use conservative max distances appropriate to the small market map.
Sounds should not be audible at full level through the entire facility.

### Audio occlusion

If adding occlusion, keep it cheap:
- one ray at sound start for short one-shots, OR
- a low-frequency bounded check for a long cart/loop sound

A blocked source may get lower gain and a low-pass effect.
Do not raycast every spatial voice every render frame.
Do not modify AI hearing based on audio occlusion; gameplay noise already owns that truth separately.

LOW tier may use cheaper equal-power/2D treatment while keeping the mechanic/readability.

---

# Part I — Landing audio

`PlayerCharacter` already knows when a landing occurred and the impact speed used for gameplay noise/camera/haptic.

Route one typed landing presentation signal to `GameAudio` without creating a second landing detector.

Use the existing landing event/impact truth.

Landing sound should scale within a bounded range by impact strength:
- light landing
- normal landing
- heavier legal gameplay landing

No bone-breaking or graphic injury audio.

Do not change jump physics.
Do not change landing gameplay-noise thresholds.
Do not stack duplicate haptic/camera systems.

If no landing sample exists, use a short procedural thud filtered by surface/context.

---

# Part J — Door/access audio

Give the existing one Door/Access system restrained physical feedback.

At minimum distinguish:
- successful manual door movement/latch
- locked/refused access
- automatic security-door close where appropriate

Do not change access rules.
Do not change door collision.
Do not make automatic security closure emit gameplay hearing noise unless the authoritative noise design explicitly already says it should; presentation audio and gameplay noise are separate.

If the existing door system needs to publish a typed audio event, make it small and dependency-light rather than importing the audio engine into `doors.ts`.

Avoid a separate per-door audio update loop.

---

# Part K — Delivery cart audio

The Milestone 05 delivery cart already has authored positions and movement.

Add audio that follows the actual cart state:
- short start/roll texture while moving
- stop/settle cue
- position follows cart

Do not add freeform physics.
Do not add a new movement timer.
Use the existing cart update/state as truth.

The existing authoritative `CART_NOISE_LOUDNESS` gameplay impulse remains the AI-hearing truth. Presentation volume must not change that value.

---

# Part L — Gadget audio

Keep SCAN/JAM/DECOY gameplay behavior intact.

Add distinct original restrained cues:
- SCAN: local short analytic pulse
- JAM: local electronic suppression texture, bounded duration
- DECOY: spatial sound at the actual decoy target point
- GADGET_READY: keep Milestone 06's subtle typed presentation cue

Do not turn JAM into a loud continuous buzz that masks gameplay.
Do not let the audio reveal CCTV/guard locations that the mechanics do not reveal.
Do not create a second gadget cooldown timer.

DECOY audio location should match the existing gameplay decoy point, but AI investigation continues to use the existing authoritative gameplay event, not the audible volume.

---

# Part M — Mission / facility presentation integration

Keep the Milestone 06 typed `presentation-events.ts` contract.
Do not return to DOM scraping.

The audio owner may consume these existing cues:
- `MISSION_INTRO`
- `MISSION_OBJECTIVE`
- `STAGE_RESOLVED`
- `INTEL_DISCOVERED`
- `OPTIONAL_COMPLETED`
- `OPPORTUNITY_USED`
- `FACILITY_WATCH`
- `FACILITY_SEARCH`
- `FACILITY_HIGH_ALERT`
- `GADGET_READY`

Do not duplicate the same cue through both `UiAudioFeedback` and `GameAudio` after consolidation.
Exactly one audible response per event.

For the cinematic intro, add only a restrained short mission-start sting/bed. Do not add copyrighted cinematic music.

---

# Part N — Mix priorities and ducking

Create a small understandable mix model with named constants.

Suggested priority intent:
1. critical gameplay-local cues (nearby door/cart/landing)
2. player footsteps
3. presentation confirmation
4. ambience/tension bed

Do not let ambience overpower footsteps/interactions.

When a strong presentation cue occurs, optional light ducking of ambience is allowed, e.g. a few dB for a fraction of a second. Keep it subtle.

Do not normalize/compress everything aggressively.
No clipping.
Master volume 0 must make all game audio silent and must not keep hidden loops consuming significant work.

---

# Part O — Pause / background / resume / unlock

Android/mobile lifecycle must be robust.

Requirements:
- audio begins only after a valid user gesture/unlock path
- repeated `unlock()` calls are idempotent
- pause/background suspends or pauses ambience/loops cleanly
- resume restores only the loops that should be active
- no duplicate ambience after repeated pause/resume
- no duplicate AudioContext after page lifecycle changes
- master volume changes apply to every category
- mute -> unmute resumes safely
- cinematic pause/resume does not start duplicate intro audio
- missing/blocked AudioContext or decode failure never breaks gameplay

Prefer `AudioContext.suspend()/resume()` or a similarly coherent single-owner approach once migrated.

---

# Part P — Performance / allocations

Android-first.

Rules:
- one audio owner/context preferred
- one listener update path
- bounded voice pool
- no per-source RAF
- no per-door timers
- no per-frame `Math.random()`
- no per-frame audio-buffer generation
- no full-scene audio scan
- no per-frame raycast for surfaces
- no per-frame occlusion ray per source
- recycle/reuse Gain/Panner nodes where practical
- release stopped sources cleanly
- LOW/MEDIUM remain viable

Report:
- number of persistent WebAudio nodes at idle
- maximum active spatial voices
- packaged audio byte delta
- total web-byte delta
- boot/largest/total JS delta

Do not pull Babylon/world graph into the bootstrap chunk.
Milestone 06 CI bootstrap baseline is `24711` bytes.

---

# Part Q — Keep gameplay noise separate

This is critical.

The Milestone 01 authoritative noise system controls NPC hearing.
Audio rendering controls what the human player hears.

Never derive NPC hearing directly from speaker volume, master volume, AudioContext state, asset availability or PannerNode distance.

Examples:
- muting the game must NOT make the character stealthier
- a missing footstep WAV must NOT remove gameplay footstep noise
- a loud local procedural cue must NOT create AI noise unless an existing gameplay mechanic explicitly reports one
- presentation-only security-door audio must not automatically call `reportEnvironmentNoise`

Add tests/guards for this separation where practical.

---

# Part R — Focused audio contract tests

Add `ci/test_audio_runtime.mjs` or an equivalent pure contract suite with no new heavy dependency.

Extract enough pure logic to test at minimum:
- gait scheduler idle/no-spam
- distance-based step emission
- WALK/RUN/CROUCH transitions
- deterministic sample/pitch variation
- acoustic/surface classification
- mix target selection for outdoor/interior and facility states
- master-volume clamp/mute
- voice-cap policy
- typed world-audio event shape if added
- presentation cue single-audible-owner mapping
- gadget activation mapping
- pause/resume state model
- no huge delayed step after pause/cinematic reset

Keep existing suites green:
- PRESENTATION 96
- MISSION GRAPH 117
- CHARACTER 53

Add regression guards if helpful, particularly for:
- accidental second AudioContext owner
- reintroduced DOM audio scraping
- gameplay-noise imports from pure presentation audio helpers
- per-frame random in gait selection

Do not write brittle grep-only theater; if a shell guard is added, make it actually fail like the Milestone 06 regression script.

---

# Part S — Acceptance scenarios

1. Fresh runtime after user gesture creates/unlocks the audio system once; repeated unlock calls do not duplicate context/ambience.
2. Missing optional sound files still allow a complete playable run with procedural/silent fallbacks.
3. Standing still produces no footstep loop/spam.
4. WALK, RUN and CROUCH sound clearly different in cadence/weight without changing movement or AI noise.
5. Outdoor and indoor spaces transition acoustically without abrupt hard cuts.
6. Back-office/loading presentation is distinguishable but restrained.
7. Landing uses the existing real landing truth; no second landing detector or physics change.
8. Door success/locked/security-close presentation is audible without changing access/collision or unintended gameplay hearing.
9. Delivery cart sound follows the real cart and stops cleanly.
10. SCAN/JAM/DECOY receive distinct cues; DECOY sound is spatial at the actual target point while AI still follows authoritative gameplay noise.
11. Facility WATCH/SEARCH/HIGH_ALERT audio layers/cues are distinct but do not expose hidden information or become a permanent loud siren.
12. Typed presentation events still produce exactly one audible UI/presentation cue each.
13. GADGET_READY remains single-fire.
14. Master volume 0 silences all categories but does not affect stealth mechanics.
15. Pause/background/resume never duplicates ambience, tension loops or cart audio.
16. Repeated mute/unmute is stable.
17. Spatial voice count stays capped under rapid door/gadget/cart events.
18. LOW/MEDIUM do not require a different gameplay/audio controller.
19. Existing cinematic M06 intro/skip/pause tests remain green.
20. Existing mission graph, alternate routes, optional objectives, opportunities, cover, hearing, facility security, character animation and old saves remain functional.
21. Audio audit prints the exact packaged assets and all web/Android builds remain green.

---

# Part T — Preserve all verified milestones

Do NOT regress:

Milestone 01:
- authoritative noise/hearing
- movement/landing impulses
- zones
- DECOY gameplay behavior

Milestone 02:
- directional cover
- observer-specific protection
- cover camera

Milestone 03:
- facility topology
- Door/Access
- credential
- front/side/utility routes

Milestone 04:
- CALM/WATCH/SEARCH/HIGH_ALERT
- incident ceilings
- last-known anchor
- coordinated search
- COVER STORY
- FIELD FOCUS
- CCTV

Character pipeline:
- imported GLB path
- canonical animation resolver
- AnimationBlender
- optional face layer
- fallback
- strong GLB validator
- 53 checks

Milestone 05:
- typed mission graph
- alternate MANIFEST/VERIFY
- exactly two optional objectives
- opportunities
- runSeed routines
- typed MissionResult
- save migration
- 117 checks
- bootstrap optimization

Milestone 06:
- fresh-run cinematic
- skip/input lock/pause behavior
- Reduced Motion presentation
- typed presentation cues
- regex/MutationObserver-free feedback
- sprint-FOV fix
- stationary turn
- guard posture presentation
- 96 presentation checks
- working regression guards

Preserve mobile multitouch, settings, graphics tiers, Android lifecycle and old saves.

---

# Validation

Before committing:
- run `npm run build`
- run `node ci/test_character_runtime.mjs`
- run `node ci/test_mission_graph.mjs`
- run `node ci/test_presentation.mjs`
- run new audio contract tests
- run presentation regression guards
- run audio asset audit against the exact packaged assets available locally/CI
- verify master volume/mute ownership from code paths
- verify no second gameplay-noise system exists
- verify no audio path changes AI hearing when volume/assets change
- verify no duplicate AudioContext/ambience on unlock/pause/resume
- verify `dist/assets/audio` packaging when source assets exist
- verify all three web bundle budgets
- compare bootstrap against CI baseline `24711`

Suggested gameplay commit:
`feat: build layered spatial audio system`

After push:
- dispatch `.github/workflows/android-play-runtime.yml` on `claude/full-game-development`
- verify exact gameplay SHA
- require completed SUCCESS from workflow run + job log + artifact
- require `PRESENTATION_OK 96`, `MISSION_GRAPH_OK 117`, `CHARACTER_RUNTIME_OK 53`, presentation regression guards, `CHARACTER_GLB_OK`, new AUDIO checks/report, debug APK and Play AAB
- do not claim speaker quality, stereo imaging, spatial feel or performance from CI

Update `CLAUDE_CODE_HANDOFF.md` with:
- gameplay SHA
- changed files
- audio architecture / owner
- whether UiAudioFeedback was consolidated
- AudioContext count/ownership
- packaged asset audit and provenance status
- footstep gait scheduler
- surface/acoustic zone contract
- ambience mix behavior
- facility tension behavior
- spatial voice cap and attenuation
- occlusion strategy if any
- landing integration
- door audio integration
- cart audio integration
- gadget audio integration
- presentation cue audio mapping
- pause/resume/unlock behavior
- gameplay-noise/audio separation proof
- audio test count/result
- presentation 96 / mission 117 / character 53 results
- boot/largest/total JS before/after
- audio bytes and total web bytes before/after
- workflow run ID
- APK hash
- AAB hash
- artifact id/size/digest
- real Android-device audio checks still required

Then STOP.
Do not begin Milestone 08 in the same implementation commit.
