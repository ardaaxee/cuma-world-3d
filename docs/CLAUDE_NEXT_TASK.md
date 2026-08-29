# CLAUDE NEXT TASK — Milestone 04: Facility Security + Social Stealth + Field Focus

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, and `docs/CLAUDE_007_STYLE_GUIDE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current collaboration HEAD before this milestone: `faef9f7c34595ad23425e584aee51ef9d352853a`.
Milestone 03 gameplay implementation is `b965fe81cb16e09bec1be2f6f090e7b9b11786dd` and is verified by Android workflow run `33245899904` through TypeScript/Vite, Android 16, debug APK, Play AAB, SHA/build manifest and artifact upload.

## Goal

Make the facility react as one believable security environment instead of a collection of unrelated awareness meters, while turning the Milestone 03 staff credential into the first real social-stealth tool and giving the existing OBSERVE control a contextual infiltration use.

This milestone must deepen systemic spycraft without adding combat, another movement controller, another NPC state machine, another zone system, or a large new HUD.

The target is an original CUMA WORLD cinematic spy-thriller. Do not copy another game's names, UI, exact mechanics, dialogue, missions, characters or assets.

---

# Part A — One authoritative Facility Security State

Create ONE reusable facility-level security controller, preferably a focused module such as `src/game/facility-security.ts` if that fits the architecture.

Suggested state model:
- CALM
- WATCH
- SEARCH
- HIGH_ALERT

Names may differ, but there must be one authoritative state and one small typed snapshot/API.

The controller should know at minimum:
- current facility security state
- a normalized security pressure/heat value
- whether there is a valid last-known incident/search anchor
- how long since confirmed contact
- whether the current state is escalating or recovering

Security state inputs may include:
- guard visual suspicion crossing meaningful thresholds
- confirmed guard ALERT
- confirmed CCTV ALERT
- repeated local suspicious events
- existing security-network broadcasts
- sustained zone suspicion only as a weak contributor

Rules:
- ordinary footsteps alone can NEVER force HIGH_ALERT
- a normal door-noise event alone can NEVER force HIGH_ALERT
- a single CURIOUS guard is not a facility emergency
- a confirmed visual/CCTV alert may cause SEARCH/HIGH_ALERT according to clear thresholds
- do not give all guards the player's current position
- facility state may share a LAST-KNOWN incident point, never magical live tracking
- recovery must use hysteresis/timers so the state does not flicker every frame
- after contact is lost and the player remains quiet/unseen, HIGH_ALERT -> SEARCH -> WATCH -> CALM should be possible

Publish a compact signal such as `document.body.dataset.securityState` only if useful. Avoid per-frame DOM writes.

Do not replace `MissionDirector.reportAlert()` scoring. Confirmed alert events should still count for mission/debrief exactly once per real alert cycle.

---

# Part B — Coordinated multi-point search

Extend the existing NPC investigation/search architecture in `src/game/npc.ts`; do NOT build a second AI state machine.

Current AI already has:
- NORMAL / CURIOUS / SUSPICIOUS / ALERT
- last-known position
- investigation
- a local search timer
- security broadcasts
- hearing

Build on those.

Desired behavior:

### WATCH
- security NPCs become more observant without knowing the player location
- small authored scan/pause behavior is acceptable
- normal worker NPC behavior should not turn into security behavior

### SEARCH
- facility has a last-known incident anchor
- nearby security units receive DIFFERENT local search sectors/points around that anchor instead of all stacking on one coordinate
- search points must be generated only when needed, not every frame
- avoid obviously selecting a point through a solid wall when practical; cheap LOS/path-clear tests are acceptable
- guards should inspect, turn, pause and move between a small number of local points
- if no new evidence appears, search eventually relaxes

### HIGH_ALERT
- confirmed contact produces the strongest coordinated response
- nearby security may move/search faster and scan more aggressively, within reasonable mobile/gameplay limits
- CCTV may become slightly more responsive, but JAM and permanent bypass must remain meaningful
- the player still wins by breaking sight, reducing noise and leaving the last-known area
- no perfect omniscience

Do NOT add weapons, gore or combat behavior in this milestone.

Do not add a navmesh rewrite. Use the current movement architecture and small, defensible search-point validation.

---

# Part C — Facility reaction through existing doors

Reuse the ONE Milestone 03 door/access system.

When security escalates:
- selected controlled doors may automatically close for readable facility response
- never permanently hard-lock every route
- never create an unwinnable softlock
- existing access requirements remain authoritative
- a door that the player is entitled to use must remain usable after it closes
- utility/stock alternate routes must remain meaningful

Do not add a second door registry.

Automatic security closing should be silent or use the existing deliberate door-noise rules only if player-caused. Do not spam environment impulses.

---

# Part D — First real social-stealth / COVER STORY interaction

Turn the existing fictional STAFF CREDENTIAL into a limited social-stealth opportunity.

Use an original CUMA WORLD concept such as `COVER STORY` / `PERSONEL KARTINI GÖSTER` / `RUTİNİ DOĞRULA`.

This must use the EXISTING interact control. Do not add a permanent BLUFF button and do not create a dialogue tree.

A social check should only become actionable when conditions are believable, for example:
- player is in a STAFF zone, NOT RESTRICTED
- player currently has the staff credential
- a relevant guard is close enough and has visual contact
- that guard is CURIOUS or low/mid SUSPICIOUS, not fully ALERT
- facility is not in HIGH_ALERT
- player is standing normally, not crouched in cover
- player is not currently sprinting
- recent player noise is low enough
- social check cooldown/usage rules allow it

On successful COVER STORY:
- lower that specific guard's awareness by a bounded amount; do not erase it to zero automatically
- reduce STAFF zone suspicion by a bounded amount through the existing zone model
- optionally delay/reduce escalation into WATCH when appropriate
- give restrained feedback/haptic
- create a meaningful cooldown so it is an opportunity, not infinite invisibility

It must NOT work in RESTRICTED rooms.
It must NOT work against an ALERT guard.
It must NOT instantly clear SEARCH/HIGH_ALERT for the whole facility.
It must NOT create fake spoken dialogue if no dialogue system exists.

Add the smallest reusable API needed, e.g. a way for `NpcSystem` to expose a current social-check target and resolve a bounded de-escalation.

Interaction priority must remain deterministic with terminals, doors, CCTV and mission objectives.

---

# Part E — FIELD FOCUS using the existing OBSERVE control

Do not add another permanent action button.

The current `OBSERVE` / recon control already exists.

Preserve current behavior during:
- BRIEFING / RECON / PLANNING: existing recon/analysis behavior remains intact

During:
- INFILTRATE / EXTRACT

the same control should become a short original tactical-assistance mode called `FIELD FOCUS` or Turkish UI equivalent such as `SAHA ODAĞI`.

FIELD FOCUS requirements:
- short active duration, roughly 2-4 seconds
- meaningful cooldown, roughly 7-12 seconds
- no time slowdown
- no permanent wallhack
- never reveal unknown NPCs through walls
- never reveal every enemy indefinitely
- no expensive full-screen post effect required

It MAY briefly emphasize only information the player has earned or can already reasonably perceive, such as:
- current operation target / objective context
- nearby known door/access states
- previously discovered intel-linked opportunities
- known CCTV opportunity if camera intel was discovered
- extraction context when active
- facility security state / last-known search context in an abstract way

Prefer world-space markers/outlines/status treatment for a small number of relevant known objects. Reuse/pool markers where practical.

FIELD FOCUS should make spycraft more readable, not solve the mission automatically.

LOW tier:
- fewer simultaneous markers
- no expensive animation requirement

Reduced Motion:
- static/faded presentation instead of pulse/sweep motion

The existing recon system must remain unchanged before infiltration.

---

# Part F — Security / social feedback

Add restrained mobile-readable feedback only.

A compact facility status may display states like:
- TESİS · NORMAL
- TESİS · İZLEME
- TESİS · ARAMA
- TESİS · YÜKSEK ALARM

Exact Turkish labels may differ.

Rules:
- no giant alert banner permanently covering play
- no constant screen shake
- no cinematic bars
- no cheap neon overload
- update DOM only when displayed state changes
- respect safe areas and landscape
- Reduced Motion removes nonessential movement

Existing awareness, stealth signals, cover status and door status remain usable; do not create redundant meters for the same value.

---

# Part G — Zone model support for social stealth

Extend the existing `src/game/zones.ts`; do not create a second suspicion model.

Add only the smallest API needed for a successful social check, such as a bounded suspicion reduction.

Requirements:
- reduction cannot make RESTRICTED areas socially safe
- COVER STORY only affects STAFF social suspicion
- returning to PUBLIC still uses normal recovery
- existing credential scaling remains authoritative
- no negative suspicion values
- no per-frame extra DOM reads

---

# Part H — Existing gadgets must interact sensibly with facility state

Preserve SCAN / SIGNAL JAM / DECOY.

Expected interactions:
- DECOY can create a false local incident/search point, but must not automatically force HIGH_ALERT
- SIGNAL JAM still suppresses CCTV temporarily even during SEARCH/HIGH_ALERT
- permanent CCTV bypass remains valuable
- SCAN/FIELD FOCUS responsibilities should not duplicate each other completely
  - SCAN = gadget/intel signal discovery/readability
  - FIELD FOCUS = short contextual tactical readability using already-earned knowledge

Do not delete or rename existing gadgets unnecessarily.

---

# Part I — Save / mission / replay compatibility

Do not break the existing mission save.

Facility security state and temporary FIELD FOCUS cooldown do NOT need to persist across app restart unless there is a compelling architectural reason.

Mission progression remains:
ACCESS -> MANIFEST -> VERIFY -> EXTRACT.

Existing route, intel, alerts, opportunities and score remain compatible.

If COVER STORY is added to opportunity scoring, generalize the known opportunity-id restore path safely and keep old saves valid. Do not change save schema unless necessary.

---

# Part J — Performance requirements

Mobile cost matters.

- one facility-security update path; no timer/RAF per guard or room
- do not add per-frame full-scene scans
- generate search sectors only on incident/state changes or low cadence
- reuse existing LOS/sensing results where practical
- no new raycast per NPC per rendered frame unless absolutely justified
- pool/reuse vectors/markers where reasonable
- FIELD FOCUS must have bounded marker count
- no new dynamic lights required
- no expensive post-processing requirement
- avoid per-frame DOM writes
- LOW tier must retain all gameplay behavior with cheaper presentation/cadence
- keep existing JS bundle budgets green

Do not perform an unrelated large boot-chunk refactor in this milestone. The known `debrief -> mission -> operation-depth -> world-expansion -> doors` startup dependency is documented; keep new dependencies pointed away from the boot path where practical.

---

# Acceptance scenarios

1. One guard becomes CURIOUS from a normal door sound: facility does NOT jump to HIGH_ALERT.
2. A guard clearly sees the player long enough to ALERT: facility escalates and stores a last-known incident point.
3. Player breaks sight and moves quietly: guards search the last-known area, not the player's live hidden position.
4. Two security guards in SEARCH choose meaningfully different local search points/sectors instead of stacking exactly together.
5. With no new evidence, facility de-escalates over time from HIGH_ALERT/SEARCH toward WATCH/CALM.
6. CCTV confirmed detection can escalate facility state; SIGNAL JAM still suppresses CCTV and does not instantly clear existing human search.
7. During escalation, controlled doors may close but no valid route is permanently locked and current fictional access requirements still work.
8. In STAFF with credential and a CURIOUS/SUSPICIOUS guard, calm normal-standing player can get a contextual COVER STORY interaction.
9. Successful COVER STORY lowers only that guard and some STAFF suspicion; it does not erase the whole facility state.
10. COVER STORY is unavailable while crouched/in cover, sprinting/noisy, in RESTRICTED, against ALERT, or during HIGH_ALERT.
11. Before infiltration, OBSERVE still performs recon exactly as before.
12. During INFILTRATE/EXTRACT, OBSERVE becomes short FIELD FOCUS with cooldown and highlights only known/contextual information.
13. FIELD FOCUS never reveals unknown NPCs through walls and never becomes permanent wallhack.
14. LOW tier and Reduced Motion preserve the mechanic with cheaper/static presentation.
15. Pause/background/resume clears or freezes temporary focus/social/security timers without duplicate listeners or stuck UI.
16. Existing ACCESS -> MANIFEST -> VERIFY -> EXTRACT mission remains completable on both front and side routes.
17. Old saves load without crashing.

---

# Validation

Before committing:
- run `npm run build`
- fix every TypeScript/Vite failure
- inspect changed files for unrelated rewrites
- confirm there is ONE facility-security controller
- confirm existing NpcSystem investigation/search remains the AI foundation
- confirm social interaction uses existing interact ownership
- confirm recon is unchanged before infiltration
- confirm no unknown-NPC wallhack was introduced
- inspect pause/resume cleanup
- keep bundle budgets green

Commit message suggestion:
`feat: coordinate facility security and social stealth`

After pushing:
- manually dispatch `.github/workflows/android-play-runtime.yml` against `claude/full-game-development` if it does not auto-run
- verify the exact workflow run for the gameplay commit
- because the job-step endpoint has repeatedly served stale snapshots, confirm final status from workflow-run completion PLUS artifact/job-log evidence when needed
- do not claim APK/AAB success until artifact/build evidence exists
- update `CLAUDE_CODE_HANDOFF.md` with gameplay HEAD, changed files, facility state API, AI behavior, social-check rules, FIELD FOCUS behavior, performance, CI result, real-device checks and planned Milestone 05

Then STOP.
Do not begin Milestone 05 in the same implementation commit.
