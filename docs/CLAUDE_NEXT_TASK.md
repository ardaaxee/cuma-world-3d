# CLAUDE NEXT TASK — Milestone 05: Mission Graph + Opportunities + NPC Routines + Replay Depth

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, `docs/CLAUDE_007_STYLE_GUIDE.md`, and `docs/CHARACTER_PIPELINE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current branch baseline before this milestone:
- verified Milestone 04 gameplay: `6925ae171f0cff3aae1373a9c1149465db7a4a62`
- verified character-pipeline gameplay: `443907a2bdbdab395695e642d2b73f0ca942c395`
- verified character handoff HEAD: `d541615a7cedafd567bf1feeb1fb3e701d66045e`
- character workflow run `33267441725` (#133): SUCCESS with debug APK, Play AAB, CHARACTER REPORT, 53 runtime contract checks and artifact upload.

The character milestone is complete as a runtime/validation pipeline. The currently packaged CC0 MakeHuman/MPFB `suited.glb` remains a provenance-safe fallback, not target hero art. Do NOT redo the character milestone here. Preserve `character.ts`, `character-animation.ts`, `character-blender.ts`, `character-face.ts`, the stronger GLB validator and all character CI checks.

## Goal

Make the existing Fresh Market operation genuinely replayable instead of a single hard-coded sequence that always resolves the same way.

Preserve the high-level mission flow:
`BRIEFING -> RECON -> PLANNING -> INFILTRATE -> EXTRACT -> COMPLETE`

Preserve the required operation order:
`ACCESS -> MANIFEST -> VERIFY -> EXTRACT`

But convert the required stages into a small typed mission graph where:
- one stage may have multiple valid resolution methods
- optional objectives add risk/reward
- earned intel changes available solutions
- reusable opportunities change the physical stealth situation
- NPC base routines vary between fresh runs while save/resume remains deterministic
- debrief can explain how the player solved the mission without scraping HUD text.

No combat or weapon work belongs in this milestone.
Do not create a second MissionDirector, NPC state machine, opportunity manager, door system, zone system or facility-security controller.

---

# Part A — Data-driven mission graph

Inspect first:
- `src/game/mission.ts`
- `src/game/operation-depth.ts`
- `src/game/runtime11.ts`
- `src/game/debrief.ts`
- `src/game/world-expansion.ts`
- `src/game/doors.ts`
- `src/game/npc.ts`
- `src/game/field-focus.ts`
- Milestone 04 facility-security APIs
- current save/reset path

Refactor the current hard-coded operation transitions minimally into ONE typed stage graph.

A stage should support at minimum:
- id
- required/optional
- prerequisites
- valid resolution ids
- whether it blocks extraction
- score contribution
- optional route/intel requirements for a resolution

Required stage ids remain compatible with:
- ACCESS
- MANIFEST
- VERIFY
- DONE / EXTRACT

Rules:
- completing one resolution completes that stage exactly once
- alternate resolution cannot double-complete the same stage
- progression survives save/resume
- old saves that only carry `operationStep` migrate safely
- existing `document.body.dataset.operationStep` remains compatible because credential/doors consume it
- expose typed read-only resolution state for runtime, FIELD FOCUS and debrief

Do not build a generic workflow engine; keep the API small and game-specific.

---

# Part B — Alternate MANIFEST and VERIFY solutions

Keep all existing solutions; add alternatives rather than replacing them.

## MANIFEST

Resolution A — existing records route
- current BACK OFFICE / RECORDS manifest terminal
- RESTRICTED risk

Resolution B — loading/stock ledger
- add a believable read-only delivery/stock ledger or board in the existing loading/stock network
- valid only when the player has earned `market_worker_route` (or equivalent existing worker-route intel)
- uses the existing interaction control
- lets a prepared player avoid spending as long in back office, but exposes them to service-route patrol/sightline risk

## VERIFY

Resolution A — existing delivery-counter physical record
- preserve current target

Resolution B — monitoring-room cross-check
- add a read-only fictional shipment/timestamp cross-check in SECURITY / MONITORING
- requires `market_camera` (or equivalent earned camera/security intel)
- this is a RESTRICTED-risk alternate verification, not a hack
- no real intrusion/security-bypass procedure

Once one MANIFEST or VERIFY resolution succeeds, the alternate must become non-completing for that stage.
ACCESS remains the existing credential stage; do not destabilize staff-credential semantics.

---

# Part C — Exactly two optional objectives

Add exactly two compact, physical, skippable objectives owned by the mission system.
They must never block extraction.

## SECONDARY_RECORDS
- placed in records/back-office
- player inspects/retrieves an optional secondary shipment/archive record
- creates extra RESTRICTED exposure
- persists in save
- adds score/debrief credit

## SHIFT_PATTERN
- physical staff shift/delivery schedule board in a believable STAFF/back-office location
- persists in save
- adds score/debrief credit
- unlocks STAFF ROUTINE WINDOW opportunity

Requirements:
- no second quest manager
- old saves default to incomplete safely
- FIELD FOCUS may mark only discovered/known optional objectives
- these must have real world-space interaction/risk, not menu checkboxes

---

# Part D — Generalize existing mission opportunities

Extend the existing `opportunities` concept; preserve `camera_bypass`.

Add:

## STAFF ROUTINE WINDOW
Unlocked by SHIFT_PATTERN.
- uses one existing contextual interaction point
- short bounded window roughly 15–25 seconds
- one worker/staff NPC follows an authored alternate routine toward loading/stock or another believable staff task
- creates a temporary gap in STAFF corridor
- does NOT clear facility heat
- does NOT alter security guards in SEARCH/HIGH_ALERT
- one use per run unless the real architecture strongly justifies otherwise

## DELIVERY CART / MOBILE COVER
Unlocked by worker-route/shift knowledge as appropriate.
- delivery cart/rolling stock object moves between a small number of authored positions
- changes a real sightline and/or creates usable physical cover
- final geometry must work with existing directional SİPER
- must not clip or block every route
- no freeform dragging / new physics engine
- movement may emit a small environment-noise impulse through the existing noise system

Opportunity requirements:
- typed availability/use state
- visible in debrief
- modest score credit
- no automatic required-stage completion
- no large opportunity menu
- deterministic interaction priority

---

# Part E — NPC routine variation

Extend existing `npc.ts`; no second scheduler/state machine.

Create a compact authored routine/waypoint model supporting:
- waypoint position
- optional dwell/pause
- optional look direction / sweep
- role-specific behavior
- at least two authored security route variants where geometry supports them
- a worker/staff routine distinct from security behavior

Add a persisted per-run `runSeed`.

Rules:
- deterministic pseudo-random variation derived from runSeed, generated once per run/agent
- same saved run resumes with same route/dwell variation
- replay/fresh mission gets a fresh seed
- no per-frame random
- guards/workers should not synchronize pauses/turns
- SEARCH/HIGH_ALERT overrides routine as Milestone 04 requires
- after recovery NPC returns cleanly to its authored base routine
- STAFF ROUTINE WINDOW may temporarily choose a worker alternate routine
- never route NPCs from player's hidden/live position
- no per-NPC requestAnimationFrame/setInterval
- LOW may simplify look presentation but must preserve actual route variation

Do not add extra NPC count just to fake depth.

---

# Part F — Recon / planning readability

Do not build a giant planning UI yet.

Use existing RECON/PLANNING text/world affordances so earned choices are understandable:
- worker-route intel implies loading-ledger resolution and/or cart opportunity
- camera intel implies monitoring-room VERIFY path and existing CCTV opportunity
- SHIFT_PATTERN makes STAFF ROUTINE WINDOW readable
- FIELD FOCUS during infiltration may show ONLY alternate solutions/opportunities actually earned

No NPC wallhack.
SCAN remains discovery.
FIELD FOCUS remains known-context readability.

---

# Part G — Typed MissionResult + richer debrief

Current `debrief.ts` regex-parses HUD prose. Replace that brittle path.

Preferred contract:
- MissionDirector produces immutable typed `MissionResult` / completion snapshot
- COMPLETE publishes one typed completion event/signal
- debrief consumes typed data, not regex over objective text
- loading an already-COMPLETE save still produces a valid result

Debrief should compactly show:
- rank
- score
- MAIN/SIDE route
- MANIFEST resolution
- VERIFY resolution
- optional objectives completed 0/2, 1/2 or 2/2
- intel found
- opportunities used
- alert/security-performance line
- one short replay hint for a meaningful unused route/resolution

Do not create a desktop analytics dashboard.

If cleanly possible in this milestone, break the known startup dependency:
`debrief -> mission -> operation-depth -> world-expansion -> doors`

A small dependency-light save/result helper is acceptable, but:
- do not duplicate SAVE_KEY
- do not duplicate reset logic
- replay must still clear mission correctly
- measure boot chunk before/after
- no unrelated bundler refactor

---

# Part H — Scoring

Preserve GHOST / SHADOW / OPERATIVE.
Keep score 0..100.

Use named/tunable contributions for:
- required completion
- optional objectives
- useful opportunities
- optional intel
- alert count / security performance

Do not award one required resolution more just because it is "alternate".
Do not punish MAIN vs SIDE route by itself.

---

# Part I — Save migration

Extend current save object only with backward-compatible optional fields as needed:
- `runSeed`
- stage resolution ids
- optional objective ids
- expanded opportunity ids

Rules:
- keep existing storage key
- old saves load without crash
- old INFILTRATE saves with only `operationStep` remain completable
- old COMPLETE saves still produce usable debrief
- replay clears mission progress and next run receives a fresh runSeed
- Milestone 04 facility heat/focus/social cooldown remain runtime-only

---

# Part J — Preserve all verified systems

Do NOT regress Milestone 01:
- movement noise/hearing
- landing impulses
- zones
- DECOY

Do NOT regress Milestone 02:
- directional cover
- observer-specific protection
- cover movement/camera

Do NOT regress Milestone 03:
- connected topology
- one Door/Access system
- staff credential
- front/side/utility routes
- door collision/noise

Do NOT regress Milestone 04:
- CALM/WATCH/SEARCH/HIGH_ALERT
- structural incident ceilings
- last-known anchor, not hidden live tracking
- coordinated search
- COVER STORY
- FIELD FOCUS
- CCTV integration
- security-door close behavior

Do NOT regress the verified character pipeline:
- one authoritative capsule/controller
- imported GLB + procedural fallback
- cached canonical animation resolver
- AnimationBlender crossfade
- optional deterministic facial life
- stronger GLB validator / CHARACTER REPORT
- 53 runtime contract tests
- character provenance/packaging

Preserve mobile multitouch, graphics tiers, pause/background/resume and Android lifecycle.

---

# Performance requirements

- mission graph must be event-driven; no full graph scan every frame
- routine choices generated once, not every NPC update
- no per-frame random
- optional objective/opportunity uses existing interaction resolver
- no per-frame DOM writes
- cart geometry cheap
- no new dynamic lights/post effects
- keep boot, largest chunk and total JS budgets green
- keep character CI checks green

---

# Acceptance scenarios

1. Existing path still works: ACCESS -> records MANIFEST -> delivery-counter VERIFY -> EXTRACT.
2. Worker-route intel enables loading/stock MANIFEST resolution.
3. Camera intel enables monitoring-room VERIFY resolution.
4. One resolution disables duplicate completion through its alternate.
5. Both optional objectives may be ignored and mission remains completable.
6. Optional objectives increase score/debrief credit; SHIFT_PATTERN unlocks STAFF ROUTINE WINDOW.
7. STAFF ROUTINE WINDOW changes worker routine temporarily without clearing facility heat or changing guard hidden knowledge.
8. Delivery cart changes a real sightline/cover option and never blocks all routes.
9. Same save preserves route/dwell variation; fresh replay can differ.
10. SEARCH/HIGH_ALERT overrides routine and guards recover cleanly back to it.
11. FIELD FOCUS shows only earned alternate solutions/opportunities.
12. Debrief reports route, resolutions, optional objective count, intel, opportunities, alerts, rank and score without regex parsing HUD prose.
13. Old saves load safely and old INFILTRATE progress remains completable.
14. Replay resets mission progress and generates fresh runSeed.
15. All previous routes/doors/credential/CCTV/cover/hearing/facility/social-stealth systems remain functional.
16. Character runtime/validator tests remain green and no second player/animation system is introduced.

---

# Validation / delivery

Before commit:
- run `npm run build`
- fix every TypeScript/Vite failure
- run existing character runtime/GLB validation checks
- inspect representative old save migrations
- simulate/unit-check mission graph double-completion protection
- verify same saved seed is stable and replay reset changes seed
- inspect interaction priority versus doors/terminals/COVER STORY
- inspect SEARCH/HIGH_ALERT -> routine recovery
- keep all bundle budgets green

Suggested gameplay commit:
`feat: branch mission solutions and replay routines`

After push:
- dispatch `.github/workflows/android-play-runtime.yml` on `claude/full-game-development`
- verify exact gameplay SHA
- final CI truth = completed run + artifact/job log
- do not claim APK/AAB success before artifact exists
- do not claim real-device behavior from CI

Update `CLAUDE_CODE_HANDOFF.md` with:
- gameplay SHA
- mission graph API
- stage/resolution ids
- optional objectives
- opportunities
- NPC routine/waypoint API
- runSeed behavior
- save migration
- typed MissionResult/debrief flow
- boot dependency result
- scoring changes
- build/bundle measurements
- character checks still green
- workflow run ID/artifact size/hash
- real-device checks still needed

Then STOP. Do not begin Milestone 06 in the same gameplay commit.
