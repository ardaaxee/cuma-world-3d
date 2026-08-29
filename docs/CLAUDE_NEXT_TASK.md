# CLAUDE NEXT TASK — Milestone 05: Mission Graph + Opportunities + NPC Routines + Replay Depth

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, and `docs/CLAUDE_007_STYLE_GUIDE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current verified gameplay implementation before this milestone:
`6925ae171f0cff3aae1373a9c1149465db7a4a62`

Milestone 04 is verified by Android workflow run `33246717365` (#132), completed SUCCESS through TypeScript/Vite, Android 16, debug APK, Play AAB, hashes and artifact upload.

## Goal

Make the operation genuinely replayable instead of a single hard-coded sequence that always resolves the same way.

Preserve the readable high-level mission flow:

`BRIEFING -> RECON -> PLANNING -> INFILTRATE -> EXTRACT -> COMPLETE`

and preserve the required operation order:

`ACCESS -> MANIFEST -> VERIFY -> EXTRACT`

but turn the stages into a small reusable mission graph where a required stage may have more than one valid resolution, optional objectives add risk/reward, discovered intel changes available solutions, NPC routines vary between runs, and the debrief can explain how the player solved the mission.

This is an original CUMA WORLD cinematic spycraft system. Do not copy another game's missions, dialogue, UI, characters, proprietary systems or assets.

No combat or weapon work belongs in this milestone.

---

# Part A — Data-driven mission graph

Inspect `src/game/mission.ts`, `src/game/operation-depth.ts`, `src/game/runtime11.ts`, `src/game/debrief.ts`, `src/game/world-expansion.ts`, `src/game/doors.ts`, `src/game/npc.ts`, and the Milestone 04 facility/security APIs before editing.

`mission.ts` currently hard-codes stage transitions with direct `if` branches and has only one general mission opportunity (`camera_bypass`). Refactor this minimally into ONE reusable graph/stage model.

A mission node/stage should be able to describe at minimum:
- id
- required vs optional
- prerequisites
- one or more valid resolution ids / methods
- whether it blocks extraction
- score contribution
- optional route/intel requirements for a resolution

Do not build a generic enterprise workflow engine. Keep the API small and specific to this game.

Required stages remain:
- ACCESS
- MANIFEST
- VERIFY
- DONE / EXTRACT

Rules:
- the player completes a stage by using ONE valid resolution for that stage
- a stage must never complete twice
- resolving one method must disable duplicate completion from its alternate method
- progression must survive save/resume
- old saves with only `operationStep` must migrate safely
- existing `document.body.dataset.operationStep` compatibility must remain because Milestone 03 credential/doors consume it
- do not create a second MissionDirector

Expose enough typed read-only state for runtime, FIELD FOCUS and debrief to know which resolution was used.

---

# Part B — Give MANIFEST and VERIFY real alternate solutions

Keep the current targets; do not delete the existing path.

Add at least these original alternate resolution concepts, adapting exact coordinates to the real world after inspection:

## MANIFEST

Resolution A — current records route:
- existing BACK OFFICE / RECORDS manifest terminal
- RESTRICTED risk

Resolution B — loading/stock ledger route:
- add a believable read-only delivery/stock manifest board or ledger in the existing loading/stock network
- it becomes a valid MANIFEST resolution only when the player has discovered the existing worker/service-route intelligence (`market_worker_route`) or an equivalent already-earned prerequisite
- this should let a prepared player resolve MANIFEST with less time in the back office, at the cost of exposure to the service route / patrol environment
- use the existing interaction control

## VERIFY

Resolution A — current delivery-counter physical record
- preserve the existing VERIFY target

Resolution B — monitoring-room cross-check
- add a read-only fictional shipment/timestamp cross-check at the existing SECURITY / MONITORING room
- requires the already-discovered camera/security intelligence (`market_camera`) or an equivalent earned prerequisite
- this is a higher-risk RESTRICTED resolution, not a hack
- no real security bypass instructions or realistic intrusion procedure

The alternate resolution must satisfy VERIFY exactly once and then move to EXTRACT like the original target.

Do not make one route objectively superior. The trade-off should be location, surveillance, zone pressure, patrol exposure and available intel.

ACCESS remains the required credential stage from previous milestones unless the existing architecture proves a safe alternative can be added without weakening the staff-credential system. Do not destabilize credential semantics just to force another branch.

---

# Part C — Two meaningful optional objectives

Add exactly two compact optional objectives for this mission. They must be skippable and must never block extraction.

Suggested original objectives:

1. `SECONDARY_RECORDS`
   - located in the records/back-office area
   - interact with a secondary shipment/archive record
   - creates extra RESTRICTED exposure
   - adds debrief/score credit

2. `SHIFT_PATTERN`
   - inspect a staff shift/delivery schedule board in a believable STAFF or back-office location
   - completion unlocks a useful staff-routine opportunity described below
   - adds debrief/score credit

Names can be improved if needed, but keep them original and readable in Turkish UI.

Requirements:
- optional objective state belongs to the mission system, not a second quest manager
- completion persists in the current save
- old saves default to incomplete without crashing
- FIELD FOCUS may mark a discovered/known optional objective when appropriate
- the objective should have a physical world reason and risk/reward, not merely a menu checkbox

---

# Part D — Generalize mission opportunities

Extend the existing `opportunities` concept rather than creating another opportunity manager.

Preserve `camera_bypass` exactly as a valid opportunity.

Add at least two original, non-combat environmental opportunities:

## 1. STAFF ROUTINE WINDOW

Unlocked by completing/discovering the relevant staff schedule / shift-pattern information.

Effect:
- use one existing contextual interaction point such as a schedule/dispatch board
- starts a short, bounded routine window (roughly 15–25 seconds)
- one worker/staff NPC follows an authored alternate routine toward loading/stock or another believable staff task
- creates a temporary gap in the staff corridor
- does NOT reduce all security heat
- does NOT affect security guards in SEARCH/HIGH_ALERT
- one use per run unless architecture strongly justifies otherwise

This is a fictional scheduling opportunity, not impersonation instructions for the real world.

## 2. DELIVERY CART / MOBILE COVER OPPORTUNITY

Unlocked by `market_worker_route`, SHIFT_PATTERN, or another earned staff-route condition.

Effect:
- a delivery cart / rolling stock object in the staff/loading network can move between authored positions
- the moved object changes a real sightline or creates useful physical cover
- its final geometry must work with the existing directional SİPER system
- it must not clip, block every route, or create a permanent softlock
- moving it may create a small environment-noise impulse through the existing authoritative noise system if appropriate
- no new physics engine or freeform object dragging is needed; use controlled authored positions

Opportunity requirements:
- opportunity discovery/availability and use must be typed and visible to mission/debrief state
- using one must not automatically complete a required mission stage
- opportunity use should contribute modestly to score/debrief
- do not create a large opportunity menu
- existing interaction ownership remains deterministic

---

# Part E — NPC routine variation

Milestone 04 improved facility response, but base patrol loops are still mostly deterministic.

Extend the existing `npc.ts` route/patrol ownership; do NOT create a second scheduler or AI state machine.

Create a compact routine/waypoint model supporting at minimum:
- waypoint position
- optional dwell/pause duration
- optional look direction / look sweep
- role-appropriate behavior
- at least two authored route variants for security where the real geometry supports them
- a worker/staff routine distinct from security behavior

Requirements:
- NPCs must not all pause/turn at the same time
- use deterministic pseudo-random variation from a persisted per-run seed rather than calling random every frame
- the same saved run resumes with the same routine variation
- pressing REPLAY / starting a fresh mission should generate a new run seed so patrol timing/path variation can differ
- SEARCH/HIGH_ALERT from Milestone 04 overrides normal routine as appropriate, then NPCs return cleanly to their routine after recovery
- STAFF ROUTINE WINDOW may temporarily select an authored worker alternate routine
- never route an NPC from the player's live position
- no per-NPC `requestAnimationFrame`, `setInterval`, or per-frame random allocations
- LOW tier may use simpler look/pause presentation while preserving actual route differences

Do not add more NPCs merely to make the system look deeper. Improve behavior of the current cast first.

---

# Part F — Recon/intel must explain the new choices

Do not add a giant planning screen yet.

Use existing RECON / PLANNING presentation to make earned choices understandable:
- worker-route intel should clearly imply the loading/ledger route and/or cart opportunity
- camera intel should clearly imply the monitoring-room VERIFY path and existing CCTV opportunity
- completed SHIFT_PATTERN should make STAFF ROUTINE WINDOW readable
- FIELD FOCUS during infiltration may show only the alternate solutions/opportunities the player has actually earned

No permanent enemy markers and no new wallhack.

SCAN remains signal discovery.
FIELD FOCUS remains known-context readability.

---

# Part G — Rich mission result and debrief

The current `debrief.ts` scrapes the HUD text with regular expressions and directly imports `mission.ts`. This is brittle and also pulls `mission -> operation-depth -> world-expansion -> doors` toward the startup bundle.

Because this milestone already changes mission result data, replace that dependency with a small typed result handoff.

Preferred shape:
- MissionDirector exposes/builds a typed `MissionResult` or immutable completion snapshot
- runtime or mission layer publishes one completion event/signal when COMPLETE is reached
- debrief consumes that result directly rather than parsing the objective/HUD string
- if the game loads a save already in COMPLETE, debrief still receives a valid result

Debrief should show compactly:
- rank
- score
- route used
- MANIFEST resolution used
- VERIFY resolution used
- optional objectives completed (0/2, 1/2, 2/2)
- intel found
- opportunities used
- alert count or a compact security-performance line
- one short replay hint based on an unused major route/resolution when available

Do not turn debrief into a desktop analytics dashboard.

### Startup dependency improvement

If it can be done cleanly within this work, break the known startup dependency:
`debrief -> mission -> operation-depth -> world-expansion -> doors`

A good approach is moving the tiny save-reset helper into a dependency-light storage/result module that both mission and debrief can use.

Requirements:
- do NOT duplicate save keys or reset logic
- replay still clears the current mission correctly
- measure boot chunk before/after
- do not perform a broad bundler refactor unrelated to the mission/debrief edge

---

# Part H — Scoring and rank

Preserve the existing GHOST / SHADOW / OPERATIVE rank concept.

Refine score so it rewards meaningful play instead of only raw intel count:
- required mission completion
- optional objectives
- useful opportunities
- optional intel
- low alert count
- completing an alternate resolution should not itself be worth more than the normal resolution; risk/reward should come from optional goals and security performance

Keep score 0..100 and make the formula understandable/tunable with named values.

Do not punish a player merely for choosing MAIN versus SIDE route.

---

# Part I — Save migration and replay seed

Extend the existing save object with optional backward-compatible fields as needed, for example:
- `runSeed`
- stage resolution ids
- optional-objective ids
- expanded opportunity ids

Rules:
- do not change the existing storage key unless absolutely necessary
- old saves must load without crashing
- old INFILTRATE saves with only `operationStep` must get sensible unresolved/default branch state
- COMPLETE old saves must still show a usable debrief
- replay must clear mission progress and generate a fresh run seed on the next run
- runtime-only Milestone 04 facility heat/focus/social cooldown should remain runtime-only unless there is a strong gameplay reason otherwise

---

# Part J — Preserve all previous milestones

Do NOT regress Milestone 01:
- authoritative noise/hearing
- landing impulses
- zone suspicion/recovery
- DECOY behavior

Do NOT regress Milestone 02:
- directional cover
- observer-specific protection
- cover movement/camera
- RUN/JUMP cover exits

Do NOT regress Milestone 03:
- connected facility topology
- one Door/Access system
- staff credential
- front/side/utility routes
- door collision/noise

Do NOT regress Milestone 04:
- CALM/WATCH/SEARCH/HIGH_ALERT
- incident ceilings
- last-known anchor instead of live-player wall tracking
- coordinated multi-point search
- COVER STORY rules/cooldown
- FIELD FOCUS
- CCTV facility integration
- security-door close behavior

Preserve mobile multitouch, settings, graphics tiers, pause/background/resume and current Android lifecycle behavior.

---

# Performance requirements

- do not evaluate the entire mission graph by scanning every node every frame
- mission progression should be event-driven where practical
- do not allocate route variants every NPC update
- deterministic routine choices should be generated once per run/agent
- optional-objective and opportunity prompts use the existing interaction resolver
- no per-frame DOM writes for mission/debrief state
- mobile cover/cart geometry must remain cheap
- keep boot, largest chunk and total JS budgets green
- report boot chunk before/after, especially if the debrief->mission dependency is broken

---

# Acceptance scenarios

1. Existing normal path still works: ACCESS terminal -> records MANIFEST -> delivery-counter VERIFY -> EXTRACT.
2. Prepared player with worker-route intel can complete MANIFEST through the loading/stock ledger instead of the records terminal.
3. Prepared player with camera intel can complete VERIFY through the monitoring-room cross-check instead of the delivery counter.
4. Resolving MANIFEST or VERIFY through one method disables duplicate completion through the alternate method.
5. Two optional objectives can both be ignored and the mission remains completable.
6. Completing optional objectives increases score/debrief credit and one of them unlocks STAFF ROUTINE WINDOW.
7. STAFF ROUTINE WINDOW temporarily changes the worker's authored routine without changing guard knowledge or erasing facility heat.
8. Delivery-cart opportunity moves to an authored position, changes a real sightline/cover option, and never blocks all routes.
9. Two fresh replays can select different patrol dwell/route variation, while saving/resuming the same run preserves its variation.
10. SEARCH/HIGH_ALERT still overrides normal routines and guards return cleanly after recovery.
11. FIELD FOCUS shows only alternate resolutions/opportunities actually earned by intel/objectives.
12. Debrief reports route, resolution choices, optional-objective count, intel, opportunities, alerts, rank and score without regex-parsing HUD prose.
13. Old saves load safely; old INFILTRATE progress remains completable.
14. Replay resets mission progress and creates a fresh run variation seed.
15. All previous front/side/utility traversals, doors, credential, CCTV, cover, hearing, facility security and social stealth remain functional.

---

# Validation

Before committing:
- run `npm run build`
- fix every TypeScript/Vite failure
- verify all three bundle budgets
- inspect the save migration manually with representative old payload shapes
- simulate or unit-check the mission graph so alternate resolutions cannot double-complete a stage
- inspect replay seed stability: same saved run stable, reset run changes seed
- inspect interaction ownership so optional/objective/opportunity prompts cannot fight doors/terminals/COVER STORY
- inspect SEARCH/HIGH_ALERT -> routine recovery
- confirm no new combat/weapon system and no duplicate AI/mission/opportunity managers

Commit message suggestion:
`feat: branch mission solutions and replay routines`

After pushing:
- dispatch `.github/workflows/android-play-runtime.yml` against `claude/full-game-development` if needed
- verify the workflow for the exact gameplay commit
- final CI truth comes from completed run status plus artifact/job log; do not rely on a stale step snapshot
- do not claim APK/AAB success until the artifact/build evidence exists
- update `CLAUDE_CODE_HANDOFF.md` with gameplay HEAD, mission-graph API, resolution ids, optional objectives, opportunities, routine model, run-seed behavior, debrief/result contract, bundle measurements, CI result and remaining real-device checks

Then STOP.
Do not begin Milestone 06 in the same implementation commit.
