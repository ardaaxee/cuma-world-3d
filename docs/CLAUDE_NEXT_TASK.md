# CLAUDE NEXT TASK — Milestone 01: Hearing + Social Stealth Foundation

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, and `docs/CLAUDE_007_STYLE_GUIDE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

## Goal

Make the current mission feel less like a simple stealth demo by adding two systemic layers:

1. NPC hearing based on player-generated noise.
2. A first reusable public/staff/restricted zone suspicion model that will later support social-stealth and bluff opportunities.

Do not redesign unrelated systems.

---

# Part A — Player noise model

Create one authoritative noise model. Reuse existing movement state instead of inventing a second locomotion controller.

Noise should account for:
- idle: near zero
- crouched slow movement: very low
- normal walking: moderate
- running: high
- meaningful landing: short burst
- decoy: existing gadget event should remain a special distraction source

Requirements:
- expose a small typed API that NPC AI can consume
- avoid expensive allocations every frame
- make values tunable through named constants/config rather than scattered magic numbers
- no instant ALERT from ordinary footsteps
- nearby loud movement may create CURIOUS/SUSPICIOUS behavior
- repeated noise can escalate suspicion
- hearing must feed the existing investigation/last-known-position/search behavior, not create a second AI state machine

If practical, use simple occlusion/room attenuation. Do not implement expensive acoustic simulation.

---

# Part B — NPC hearing

Integrate hearing into the existing `src/game/npc.ts` awareness system.

Behavior:
- guard outside visual FOV can hear running nearby
- heard noise creates an investigation point at the sound origin
- the NPC turns/moves toward the source using existing investigation/search logic
- crouched slow movement should be materially safer
- cover should not magically silence loud running
- facility broadcasts should only occur after meaningful suspicion thresholds, not every footstep

Add a subtle player-readable feedback mechanism only if it can be done without clutter, for example a tiny noise meter/ring near existing stealth HUD.

---

# Part C — Zone-based suspicion foundation

Create a reusable zone/access model for the current map.

Minimum zone categories:
- PUBLIC
- STAFF
- RESTRICTED

Use existing world geometry/positions; do not build a second map.

Expected behavior:
- PUBLIC: player presence alone causes no suspicion
- STAFF: presence creates slow suspicion unless a future access condition is satisfied
- RESTRICTED: stronger suspicion pressure
- visual detection and zone suspicion combine predictably
- leaving an inappropriate zone should allow recovery

The first implementation may use simple bounded zones/volumes, but the API must be reusable for future back-office/security rooms.

Expose current zone through `document.body.dataset` or a typed game API only if useful for HUD/mission systems.

Do NOT add fake dialogue/bluff UI yet. This milestone only builds the system foundation.

---

# Part D — Existing systems that must remain working

Preserve:
- joystick + touch look
- RUN/JUMP/CROUCH multitouch
- cover
- SCAN/JAM/DECOY
- CCTV
- route choice
- staged ACCESS -> MANIFEST -> VERIFY -> EXTRACT mission
- security broadcasts/search
- settings/debrief pause behavior
- graphics tiers
- Android lifecycle handling

Do not reimplement them.

---

# Quality/performance requirements

- LOW tier: hearing updates may run at a lower cadence but must still work.
- Avoid per-frame DOM writes where possible.
- Avoid duplicate singleton listeners after runtime reloads.
- Keep TypeScript strictness clean.
- No copyrighted assets or ripped audio.
- If no new licensed sound asset exists, hearing should use movement/noise state, not depend on playing an audio file.

---

# Acceptance scenarios

1. Player crouch-walks behind a guard at a reasonable distance: guard normally does not investigate from sound alone.
2. Player runs behind a guard at close range: guard becomes CURIOUS/SUSPICIOUS and investigates the origin.
3. Player makes noise then moves away quietly: guard searches the previous sound location rather than tracking the player through walls.
4. Player enters STAFF zone in view: suspicion pressure increases gradually.
5. Player returns to PUBLIC area and breaks sight/noise: suspicion can recover.
6. Existing DECOY still works and remains more deliberate than ordinary footsteps.

---

# Validation

Before committing:
- run `npm run build`
- fix every new TypeScript/Vite failure
- inspect changed files and ensure no unrelated rewrite

Commit message suggestion:
`feat: add hearing and zone suspicion foundation`

After pushing:
- verify the Android GitHub Actions run
- report exact run ID/status
- do not claim APK/AAB success until the workflow is complete
- update `CLAUDE_CODE_HANDOFF.md` with the new HEAD, files changed, behavior and next milestone

Then STOP. Do not begin the next milestone in the same commit.
