# CLAUDE NEXT TASK — Milestone 06: Cinematic Mission Presentation + Feedback + Camera Polish

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, `docs/CLAUDE_007_STYLE_GUIDE.md`, and `docs/CHARACTER_PIPELINE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current verified gameplay baseline before this milestone:
- Milestone 05 gameplay: `ecec0a8d65cacc6b461bdf469ecc070eff00185c`
- Milestone 05 handoff: `c574a7e495ce52f053ad8111be4f0b3ea9eae77d`
- Android workflow run `33271072252` (#134): SUCCESS on the exact gameplay SHA with `MISSION_GRAPH_OK 117`, `CHARACTER_RUNTIME_OK 53`, character GLB validation, debug APK, Play AAB and artifact upload.

Milestone 05 is complete and verified. Do not rework the mission graph, save system, typed MissionResult, alternate solutions, opportunities, NPC routine seed system, character pipeline, facility security, door system or cover system unless a minimal integration change is required by this presentation milestone.

## Goal

Make the operation feel intentionally directed and cinematic from the moment the player enters the world, without turning the game into a non-interactive cutscene or adding heavy visual effects.

This milestone should improve:
- mission entry / establishing presentation
- objective / intel / opportunity / security feedback
- subtle audio + haptic language
- third-person camera feel
- player turn / locomotion presentation
- readable guard search/watch posture cues

The target is an original grounded contemporary spy-thriller presentation. Do not copy another game's title cards, camera shots, UI, sound cues, dialogue, cinematics, character poses or proprietary assets.

No combat or weapon work belongs in this milestone.
Full environmental audio layering is Milestone 07; keep audio work here limited to short presentation cues and existing systems.

---

# Part A — One lightweight presentation owner

Add ONE small presentation/cinematic owner, preferably something like `src/game/cinematic-presentation.ts` or an equivalent architecture-native name.

Do not create:
- a second render loop
- a second gameplay controller
- a second mission controller
- a permanent second camera system
- a generic timeline engine

Prefer driving the existing `UniversalCamera` already owned by `GameRuntime`.

The presentation owner should support at minimum:
- fresh-run mission intro active/inactive state
- elapsed/normalized progress
- skip
- completion callback/promise
- Reduced Motion behavior
- pause-safe progression through runtime `dt`, not an uncontrolled wall-clock timeout chain

The presentation owner must allocate any reusable vectors/shot data once, not every frame.

---

# Part B — Fresh-run mission intro

Current behavior hides the boot screen and immediately shows HUD/mobile controls as soon as `GameRuntime.start()` begins. Replace that abrupt transition with a short authored mission-entry presentation.

### When to play

Play the intro only for a genuinely fresh run.

A safe pattern is:
1. inspect the MissionDirector state before `acknowledgeBriefing()` changes BRIEFING -> RECON
2. remember whether this runtime was created from BRIEFING
3. acknowledge/persist briefing exactly once as before
4. `playMissionIntro()` is a no-op for restored RECON/PLANNING/INFILTRATE/EXTRACT/COMPLETE saves

Do not add a save-schema field just for the intro unless absolutely required.
Do not replay the intro after background/resume in the same runtime.

### Duration / camera language

Normal motion target: roughly 3.0–4.5 seconds total.

Use a small number of authored beats, for example:
- establishing view of the Fresh Market exterior / operation space
- controlled move or cut that reveals the service/loading side or operational depth
- settle cleanly into the existing third-person shoulder camera behind the player

Exact coordinates must be chosen after inspecting the real geometry.
Do not invent a camera path that passes through walls, ceilings or solid props.
Validate authored shot lines/positions against the real world geometry.

Prefer restrained easing / smoothstep. No whip pans, excessive shake, Dutch-angle gimmicks, neon sweeps or aggressive depth effects.

At completion or skip:
- restore the same gameplay camera/yaw/pitch ownership used before this milestone
- call the existing third-person camera update with a forced/safe settle where appropriate
- leave no camera offset or stale cinematic target behind

### Input lock

During the intro:
- render the world normally
- do not allow player movement/look/interact/gadget actions to advance gameplay
- do not accidentally consume a queued jump/interact into the first gameplay frame
- do not let hidden desktop keyboard input move the player while mobile controls are hidden

It is acceptable to freeze gameplay simulation for these few seconds as long as rendering/presentation continues and pause/resume remains safe.

Do not change mission progress, facility heat, NPC knowledge or route state merely because the intro is playing.

### UI title card

Show a restrained original title card, for example a structure such as:
- `CUMA WORLD · OPERASYON`
- mission/location line derived from this fictional operation (Fresh Market / operation codename)
- optional small objective-context line

Keep it compact and readable in landscape mobile safe areas.
Do not imitate another franchise's title typography or exact layout.

A small `ATLA`/skip affordance is allowed. It must be touch-friendly but visually secondary.

### Main bootstrap ownership

Keep HUD/mobile controls hidden while the intro is active.
A preferred integration is for `GameRuntime` to expose a small `playMissionIntro(): Promise<void>` or equivalent runtime API so `main.ts` can:
- start the render loop
- unlock audio from the user's original button gesture when possible
- hide boot
- await/observe intro completion
- then show HUD + mobile controls

Do not pull Babylon/runtime world modules back into the bootstrap chunk. The 40% Milestone 05 boot reduction must remain materially intact.

---

# Part C — Reduced Motion, skip, pause and lifecycle

Reduced Motion is a first-class behavior, not a CSS afterthought.

When Reduced Motion is enabled:
- no long camera fly-through
- use one safe static/near-static establishing composition or a much shorter blend
- title card may fade without sweeping/pulsing motion
- total presentation should be clearly shorter

Skip behavior:
- one press/tap
- idempotent
- immediately reaches a valid gameplay camera state
- no queued player action leaks through
- no duplicate completion event

Pause/background during intro:
- cinematic progression freezes while paused/hidden
- resume continues cleanly
- no duplicated listeners/timers
- no promise left unresolved forever
- pagehide/pageshow must not restart the intro

---

# Part D — Typed presentation events instead of DOM scraping

`MissionFeedback` and `UiAudioFeedback` currently observe DOM mutations and parse HUD text. Remove that brittle path in this milestone, similar in spirit to Milestone 05's typed MissionResult cleanup.

Create one small dependency-light typed presentation-event contract, for example `src/game/presentation-events.ts`.

Do not create a generic event bus framework. A typed CustomEvent contract is enough.

Support meaningful event kinds such as:
- mission objective/stage update
- intel discovered
- optional objective completed
- opportunity unlocked/used
- facility WATCH / SEARCH / HIGH_ALERT transition
- gadget cooldown ready (only if implemented cleanly through the existing gadget refresh path)

Events should carry the already-known display label/detail needed by presentation, or stable ids that can be mapped dependency-light. Do not make the feedback layer regex HUD prose.

### MissionFeedback

Refactor `MissionFeedback` so it consumes typed presentation events.
Remove its `MutationObserver` dependency for objective/intel/awareness feedback.
Do not call `text.match()` to infer gameplay state.

Use restrained feedback hierarchy:
- objective/stage: clear but not giant
- intel/optional: smaller positive confirmation
- opportunity: short tactical confirmation
- WATCH: subtle
- SEARCH: stronger
- HIGH_ALERT: strongest, but still no giant screen takeover or camera shake

Do not duplicate the existing permanent HUD meters/chips.

### UiAudioFeedback

Refactor `UiAudioFeedback` to consume the same typed events rather than observing/parsing DOM.

Keep this milestone's sounds short and synthetic/local through the existing WebAudio approach; Phase 07 owns full audio content.

Add a small cue vocabulary such as:
- mission intro sting
- objective update
- intel/optional confirmation
- opportunity confirmation
- WATCH / SEARCH / HIGH_ALERT
- gadget ready if supported

Rules:
- short duration
- restrained gain
- no copyrighted/ripped sounds
- no continuous siren layer yet
- volume setting still applies
- missing AudioContext never breaks gameplay

### Haptic language

Use distinct but restrained patterns for important transitions.
Do not vibrate continuously or repeatedly every frame.
Only fire once when an event genuinely occurs.

---

# Part E — Gadget cooldown-ready feedback

The existing `GadgetToolkit` already refreshes cooldown UI on a 250 ms global timer. Do not add another timer.

If cleanly possible:
- remember whether each gadget was previously cooling down
- when it crosses from cooldown -> ready, publish one typed `GADGET_READY` presentation event
- do not publish READY for gadgets that were already ready at boot
- do not spam while the panel is open

Do not rewrite gadget mechanics in this milestone.
Preserve SCAN/JAM/DECOY behavior exactly.

---

# Part F — Third-person camera polish

### Fix sprint-FOV ownership

Current runtime sets `this.running = strength > 0.86`, which ties sprint FOV to joystick magnitude instead of actual RUN state.

Fix it.

Sprint camera/FOV must require actual running gameplay state, e.g. all relevant conditions such as:
- RUN held
- not crouched
- meaningful horizontal speed
- not in an incompatible cinematic/paused state

Pushing the joystick fully without RUN must NOT widen sprint FOV.
Holding RUN while stationary must NOT widen sprint FOV.

Keep the effect subtle.
Reduced Motion keeps the smaller FOV delta.

### Camera obstruction

Preserve `resolveThirdPersonCameraCollision()` and existing cover shoulder behavior.
Do not regress obstruction-safe camera pull-in.

Test authored intro transition back into:
- normal open space
- cover
- near a wall/doorway

No persistent wall clipping after cinematic completion.

### Landing / camera feel

The character already owns a landing camera kick. Do not create a second competing landing-kick system.
If tuning is needed, coordinate existing character target movement with the camera rather than stacking another shake.

No screen shake spam.

---

# Part G — Player turn / stance presentation

The character pipeline milestone already owns imported animation resolution and crossfade. Preserve it.

Do not require new animation assets to complete this milestone.

Improve presentation using the existing visual root/state where safe:
- moving player keeps current movement-facing behavior
- when standing still, a large camera/body yaw difference may resolve through a restrained turn-to-facing behavior instead of the body feeling permanently disconnected from the shoulder camera
- use a dead zone so tiny camera movement does not rotate the whole body
- do not instantly snap the character
- cover should remain authoritative; do not rotate the body through the cover surface
- crouch must remain visually coherent

If a future GLB has turn/additive clips, keep the architecture compatible, but do not fabricate an unavailable clip.

Do not let visual turn logic alter the capsule collider, player position, noise model or mission logic.

---

# Part H — Guard/watch/search visual cues

Use the existing NPC hierarchy and Milestone 04/05 awareness + routine states.
Do not create a second animation state machine.

Add lightweight authored/procedural presentation cues so a player can visually read broad guard intent even without dedicated animation assets.

Examples, adapt to actual NPC hierarchy:
- WATCH: slightly more deliberate head/body scan at authored dwell points
- SEARCH: clearer pause/inspect/turn cadence around assigned search point
- HIGH_ALERT: increased urgency in locomotion/turn response without adding knowledge
- recovery: settle back to routine cleanly

Workers must not suddenly adopt security-guard posture.
No combat/takedown/weapon poses.
No cartoonish exaggerated bobbing.
Reduced Motion should reduce nonessential oscillation while preserving readable orientation/state.

Do not add per-frame random motion.
Reuse existing routine/sweep phase and facility state.

---

# Part I — Performance / architecture

Presentation must stay mobile-first.

Rules:
- one render loop only
- one existing gameplay camera owner plus lightweight temporary cinematic override
- no per-frame DOM writes for unchanged presentation state
- no MutationObserver HUD scraping in `MissionFeedback` / `UiAudioFeedback`
- no full-scene scan every frame for cinematic shots
- no per-frame random animation jitter
- cache authored shot data / reusable vectors
- no new post-processing stack or dynamic lights
- no large video background
- no runtime network dependency
- preserve LOW/MEDIUM behavior
- preserve the Milestone 05 bootstrap improvement; report boot chunk before/after
- keep largest chunk and total JS budgets green

The presentation module should remain in the lazy runtime path where practical, not pull Babylon/world modules into startup.

---

# Part J — Preserve all verified systems

Do NOT regress:

Milestone 01:
- authoritative noise/hearing
- movement/landing impulses
- zones
- DECOY behavior

Milestone 02:
- directional cover
- observer-specific protection
- cover-guided movement
- cover-aware shoulder camera

Milestone 03:
- connected facility
- one Door/Access system
- staff credential
- front/side/utility traversal

Milestone 04:
- CALM/WATCH/SEARCH/HIGH_ALERT
- incident ceilings
- last-known anchor
- coordinated search
- COVER STORY
- FIELD FOCUS
- CCTV integration

Character pipeline:
- `character.ts`
- canonical animation resolver
- AnimationBlender
- optional face layer
- strong GLB validator
- 53 character contract checks

Milestone 05:
- typed mission graph
- alternate MANIFEST/VERIFY solutions
- exactly two optional objectives
- opportunities
- runSeed routine variation
- typed MissionResult / regex-free debrief
- save migration
- 117 mission graph checks
- boot dependency reduction

Preserve mobile multitouch, graphics tiers, settings, pause/background/resume and Android lifecycle behavior.

---

# Acceptance scenarios

1. Fresh run: boot -> short original cinematic establishing presentation -> clean third-person gameplay; HUD/controls do not appear early.
2. Restored RECON/PLANNING/INFILTRATE/EXTRACT/COMPLETE save: no fresh-run intro replay.
3. Intro can be skipped once and always lands in the same valid gameplay camera/control state.
4. Reduced Motion uses a short/static presentation and no sweeping fly-through.
5. Background/pause during intro freezes safely and resume does not duplicate/restart it.
6. Hidden keyboard/touch input during intro cannot move, jump, interact or trigger a gadget.
7. Full joystick without RUN does not trigger sprint FOV.
8. RUN + real movement triggers subtle sprint FOV; RUN while stationary does not.
9. Existing camera collision and cover shoulder behavior still prevents obvious wall clipping after intro.
10. MissionFeedback no longer uses MutationObserver/text parsing for objective/intel/awareness presentation.
11. UiAudioFeedback no longer uses MutationObserver/text parsing for intel/awareness cues.
12. Stage/intel/optional/opportunity/facility transitions produce at most one correct presentation cue each.
13. WATCH/SEARCH/HIGH_ALERT cues are visually/audio/haptically distinct without covering the gameplay screen.
14. Gadget cooldown-ready cue, if implemented, fires once on cooldown -> ready and never spams boot-ready gadgets.
15. Stationary player turn presentation is smooth, dead-zoned and does not rotate through active cover.
16. WATCH/SEARCH/HIGH_ALERT guard posture cues improve readability without changing NPC knowledge/path truth.
17. Existing mission alternate routes/objectives/opportunities/save/replay remain completable.
18. Existing character 53 checks and mission 117 checks remain green.
19. Old saves remain compatible.
20. LOW/MEDIUM and Reduced Motion remain functional.

---

# Validation

Before committing:
- run `npm run build`
- fix every TypeScript/Vite failure
- run `node ci/test_character_runtime.mjs`
- run `node ci/test_mission_graph.mjs`
- add focused presentation/cinematic contract tests where useful, especially pure timing/state/event logic
- verify no MutationObserver/text-match path remains in `MissionFeedback` and `UiAudioFeedback`
- test intro state machine: normal finish / skip / Reduced Motion / pause-resume / non-fresh save
- verify sprint-FOV predicate from actual RUN state
- inspect camera transition points against actual collision geometry
- verify no presentation event fires twice for one state transition
- verify all three web bundle budgets
- compare bootstrap to Milestone 05 CI baseline (`25566` bytes packaged CI baseline)

Suggested gameplay commit:
`feat: add cinematic mission presentation and feedback`

After push:
- dispatch `.github/workflows/android-play-runtime.yml` on `claude/full-game-development`
- verify the workflow for the exact gameplay commit
- final truth comes from completed run status + job log + artifact
- require mission 117 checks, character 53 checks, character GLB validation, build APK and AAB
- do not claim real-device camera feel, FPS, animation quality, vibration feel or readability from CI

Update `CLAUDE_CODE_HANDOFF.md` with:
- gameplay SHA
- cinematic/presentation API
- fresh-run detection
- intro duration/shots
- skip/Reduced Motion behavior
- input-lock behavior
- typed presentation-event contract
- MissionFeedback / UiAudioFeedback data flow
- gadget-ready implementation if present
- sprint-FOV predicate before/after
- player turn presentation
- guard state presentation
- pause/resume behavior
- test counts
- boot/largest/total JS before/after
- workflow run id
- APK/AAB hashes
- artifact id/size/digest
- remaining real-device checks

Then STOP.
Do not begin Milestone 07 audio-system work in the same implementation commit.
