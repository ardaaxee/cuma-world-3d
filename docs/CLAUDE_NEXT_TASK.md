# CLAUDE NEXT TASK — Milestone 02: Directional Cover + Camera Stealth Polish

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, and `docs/CLAUDE_007_STYLE_GUIDE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current collaboration HEAD before this milestone: `f61bfec31cd09ca7f78d0f13c12de928fded8283`.
Milestone 01 gameplay implementation is `74631edc4ca3f00ce94766c8450fc1c25eb78ee7` and is verified by Android workflow run `33244096862` through TypeScript/Vite, Android 16, APK, AAB, hashes and artifact upload.

## Goal

Turn the existing SİPER system from a proximity toggle with a broad stealth multiplier into a directional, physically believable cover mechanic with premium third-person camera behavior.

This milestone should make stealth feel more deliberate and cinematic without adding another permanent action button or a second movement controller.

Do not redesign unrelated systems.

---

# Part A — Directional cover state

Inspect the current `src/game/cover.ts` first.

The current system finds nearby collision geometry but does not retain a meaningful dominant cover surface direction. Replace or extend it so the cover system knows at minimum:

- whether cover is available
- whether cover is active
- the dominant cover surface normal/direction
- a tangent direction along the surface
- the current distance to the cover surface
- whether the player is actually protected versus merely near a surface

Expose this through one small typed API. Prefer a shared/read-only state object or low-allocation accessors.

Requirements:
- reuse Babylon raycasts and the existing player collider
- avoid allocating many `Vector3`/`Ray` objects every animation frame if practical
- preserve the existing contextual `SİPER` button
- cover must stop being valid immediately when the surface is lost
- do not let random floor/ceiling geometry become cover
- service-route crates and believable wall-height geometry should remain useful cover

Do not create a second cover system.

---

# Part B — Real protection / exposure

The current NPC/CCTV logic must not receive a strong stealth bonus simply because `isInCover()` is true.

Make cover protection directional and physically justified.

Desired behavior:
- if a wall/crate is genuinely between the observer and the player's relevant body area, cover should materially reduce detection
- if the player is at the exposed edge or the observer is looking from the open side, the cover bonus should reduce sharply or disappear
- cover never makes the player invisible
- crouch + real cover may combine, but do not create near-zero detection in an obviously exposed position
- running while in/near cover must still be audible through Milestone 01 hearing; do not treat cover as silence

Prefer reusing existing line-of-sight/occlusion information instead of adding an expensive second visibility system.

If useful, provide a function such as a normalized protection value against an observer position/direction, but keep the API simple and tunable.

Update BOTH:
- NPC awareness
- CCTV awareness

so they use truthful directional protection rather than a global cover multiplier.

---

# Part C — Cover movement

When cover is active, movement should feel intentional rather than identical to free locomotion.

Requirements:
- project/guide horizontal movement primarily along the cover tangent
- do not hard-lock the player or create a sticky rail
- preserve touch joystick responsiveness
- allow clean exit away from the surface
- RUN should exit cover cleanly before sprint behavior takes over
- JUMP should exit cover cleanly before a valid jump, subject to current crouch/jump rules
- CROUCH should remain compatible with cover
- avoid changing the authoritative movement controller architecture

Do not add a new cover joystick or another movement UI.

---

# Part D — Cover-aware third-person camera

Inspect `src/game/runtime11.ts` and the existing `resolveThirdPersonCameraCollision()` path before editing.

Improve the shoulder camera while cover is active:

- derive a subtle shoulder preference from the cover normal/open side
- avoid forcing the camera into the wall/cover surface
- preserve camera collision handling
- transition smoothly when entering/leaving cover
- keep the player and immediate threat space readable
- avoid large FOV swings or aggressive camera motion
- respect Reduced Motion by reducing or disabling nonessential positional flourish

The camera should feel authored and stable, not like it is snapping between sides every frame.

Do not add cinematic black bars or constant screen shake.

---

# Part E — Cover feedback

Keep feedback compact and mobile-friendly.

Update the current cover status so it can distinguish something like:
- cover available
- protected
- exposed / edge risk

Use restrained wording/style. Do not add a large new HUD panel.

Only update DOM when the displayed state actually changes.

---

# Part F — Preserve Milestone 01 systems

Do not regress:
- authoritative player-noise model
- NPC hearing
- landing noise impulses
- PUBLIC / STAFF / RESTRICTED zones
- zone suspicion/recovery
- DECOY priority over footsteps
- stealth signals HUD

Noise and zone pressure must still behave correctly while cover is active.

---

# Existing systems that must remain working

Preserve:
- joystick + touch look multitouch
- RUN/JUMP/CROUCH
- SCAN/JAM/DECOY
- CCTV bypass
- route choice
- ACCESS -> MANIFEST -> VERIFY -> EXTRACT
- security network broadcasts/search
- settings/debrief pause behavior
- graphics tiers
- Android lifecycle handling

Do not reimplement them.

---

# Quality/performance requirements

- LOW tier must still have functional cover and truthful exposure logic
- avoid a large new raycast budget per NPC per frame
- reuse existing LOS results or lower-frequency checks where practical
- avoid per-frame DOM writes
- avoid duplicate listeners/singletons across runtime reloads
- keep TypeScript strictness clean
- no new copyrighted assets/audio
- do not change unrelated visual-polish systems

---

# Acceptance scenarios

1. Player enters cover behind a service-route crate with a guard on the opposite side: detection is materially reduced.
2. Player remains in cover state but moves to an exposed edge/open side: protection falls sharply instead of granting a global bonus.
3. Player moves left/right while in cover: movement follows the surface naturally without feeling locked.
4. Player presses RUN from cover: cover exits cleanly and sprint behavior resumes without stuck states.
5. Player performs a valid JUMP exit: cover clears before jump and does not leave the camera/animation in cover state.
6. Player runs while beside cover: hearing still reacts to the noise; cover does not magically silence the sprint.
7. Camera shoulder position adapts around cover without clipping into the wall/crate.
8. Reduced Motion keeps camera transitions restrained.
9. Existing side-route cover crates remain usable.
10. PUBLIC/STAFF/RESTRICTED suspicion from Milestone 01 continues to recover/escalate normally.

---

# Validation

Before committing:
- run `npm run build`
- fix every new TypeScript/Vite failure
- inspect changed files and ensure no unrelated rewrite
- specifically inspect multitouch ownership and pause/resume state cleanup

Commit message suggestion:
`feat: refine directional cover and stealth camera`

After pushing:
- manually dispatch `.github/workflows/android-play-runtime.yml` against `claude/full-game-development` if it does not auto-run
- verify the exact Android workflow run for the gameplay commit
- report exact run ID/status
- do not claim APK/AAB success until the workflow is complete
- update `CLAUDE_CODE_HANDOFF.md` with the implementation HEAD, changed files, behavior, CI result, remaining real-device checks and the next planned milestone

Then STOP. Do not begin Milestone 03 in the same commit.
