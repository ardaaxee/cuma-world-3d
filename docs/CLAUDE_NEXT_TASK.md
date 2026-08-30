# CLAUDE NEXT TASK — Milestone 08: Save Depth + Field Mastery + Replay Progression

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, `docs/CLAUDE_007_STYLE_GUIDE.md`, and `docs/CHARACTER_PIPELINE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current verified baseline before this milestone:
- Milestone 07 gameplay: `303491c611f1d4076fc89cb8d915d325f306b3ab`
- Milestone 07 handoff: `33d3413b2e2a9a0711943688db8856b80e0ed45e`
- Android workflow run `33301321356` (#136): SUCCESS on the exact gameplay SHA with `AUDIO_RUNTIME_OK 104`, `PRESENTATION_OK 96`, `MISSION_GRAPH_OK 117`, `CHARACTER_RUNTIME_OK 53`, `PRESENTATION_REGRESSION_GUARDS_OK`, `CHARACTER_GLB_OK`, AUDIO REPORT, debug APK, Play AAB and artifact upload.

Milestone 07 is complete and verified. Do not rework audio architecture, cinematic presentation, mission graph, character pipeline, facility security, cover, doors or NPC routines unless a minimal integration change is required by this milestone.

## Goal

Turn completed operations into persistent, meaningful replay progress without turning CUMA WORLD into an XP grind, loot system, live-service loop or stat-upgrade game.

The operation should remember what the player has genuinely accomplished across completed runs:
- best score/rank
- routes completed
- alternate MANIFEST / VERIFY solutions completed
- optional objectives completed
- opportunities used
- intel mastery
- clean-stealth accomplishments
- a bounded recent-run history

The debrief should compare the current run against the player's own previous record and give one useful next replay target.

Progression must be informational/mastery-oriented. It must NOT grant stealth buffs, AI debuffs, faster movement, larger gadget power, weapon upgrades, paid advantages, loot boxes, gambling, daily streaks, FOMO or manipulative monetization.

No combat or weapon work belongs in this milestone.

---

# Part A — Preserve one authoritative run save

The existing mission resume key remains authoritative:

`cuma_world_android_save_v100`

Do NOT rename it.
Do NOT create a second competing mission/run save.
Do NOT duplicate `SAVE_KEY` or `resetMissionProgress()`.

`src/game/mission-save.ts` remains the one owner of active-run mission resume state.

The current run save continues to own:
- mission state
- intel
- selected route
- alerts
- opportunities
- operation step / stage resolutions
- optional objectives
- runSeed
- any new optional run telemetry fields required by this milestone

Old saves must remain safe.

Replay must still clear only the active mission run so a fresh `runSeed` is generated.

---

# Part B — Add ONE separate persistent progression profile

Add one small dependency-free persistent profile module, preferably:

`src/game/progression.ts`

or an equally clear architecture-native name.

This is NOT another mission save. It is a completed-run career/mastery record.

Use one new versioned key, for example:

`cuma_world_progression_v1`

Do not silently overload the mission save with cross-run history.

The profile must have an explicit schema/version and validation/migration path.

Suggested shape — adapt after inspecting current types:

```ts
interface ProgressionProfile {
  version: 1;
  completedRuns: number;
  bestScore: number;
  bestRank: MissionRank | null;
  bestAlerts: number | null;
  bestOperationSeconds: number | null;
  routesCompleted: RouteName[];
  manifestSolutions: MissionResolutionId[];
  verifySolutions: MissionResolutionId[];
  objectivesCompletedEver: OptionalObjectiveId[];
  opportunitiesUsedEver: OpportunityId[];
  intelDiscoveredEver: IntelId[];
  masteryRecords: MasteryRecordId[];
  processedRuns: string[];
  recentRuns: ProgressionRunSummary[];
}
```

Exact fields may differ, but keep the module small and typed.

Rules:
- corrupt JSON -> safe default profile, gameplay still boots
- unknown ids -> reject/filter safely
- bad numeric values -> clamp/reject safely
- missing fields -> migrate/default safely
- arrays deduplicated
- no unbounded storage growth
- no network/cloud/account dependency
- no runtime Babylon import
- no DOM dependency in the storage/model layer

Cap recent run history to a small fixed value such as 10–12 runs.
Do not store huge mission snapshots.
Do not store full frame/event history.

---

# Part C — Completed-run idempotency

This is critical.

Milestone 05 intentionally republishes `MissionResult` when an already-COMPLETE save is restored so the debrief works after relaunch.

Therefore progression recording MUST be idempotent.

Restoring the same COMPLETE run must NOT:
- increment completedRuns twice
- duplicate recent history
- duplicate mastery records
- alter best stats twice
- fabricate a second completion

Use a stable completed-run identity derived from existing immutable result data, preferably the persisted `runSeed` plus any extra deterministic discriminator needed.

Example concept:

`run:${runSeed}`

Do not generate a random progression id after completion.
Do not use current time as the only dedupe key.

Keep a bounded set/ring of processed run ids sufficient to prevent restored COMPLETE saves from being re-recorded.

A genuinely fresh replay with a new runSeed must record as a new run.

---

# Part D — Run telemetry that measures real stealth quality

The master plan asks debrief to consider detection/stealth quality where measurable.

Add only metrics the runtime can truthfully observe.
Do not invent a fake precision score.

Recommended telemetry:
- active operation seconds (INFILTRATE + EXTRACT)
- seconds in facility WATCH
- seconds in facility SEARCH
- seconds in facility HIGH_ALERT
- optionally seconds under clearly defined SUSPICIOUS/ALERT awareness if existing typed state makes this clean
- maximum facility state reached

Existing `alerts` remains authoritative for alert count.

Do NOT persist:
- live NPC positions
- facility heat value
- last-known anchor
- social cooldown
- FIELD FOCUS state
- audio state
- camera state

Those remain runtime-only.

Create a small pure telemetry accumulator/model if useful, e.g.:

`src/game/run-telemetry.ts`

It should receive already-known state from `GameRuntime`; it must not scan the scene.

No `setInterval` / new RAF.
Use runtime `dt`.

Do not write localStorage every frame.
If telemetry is checkpointed for resume, use a bounded cadence driven by accumulated `dt` (for example every ~5 seconds) and flush on meaningful lifecycle/mission events where appropriate.

A pause/background gap must NOT count as operation time.
A cinematic intro must NOT count as operation time.
A resumed tab must not add a giant single-frame duration.

Telemetry fields in `StoredMission` must be optional so old saves still parse.

If an old COMPLETE save has no telemetry, debrief should display `—` / unavailable rather than pretending the run took 0 seconds.

---

# Part E — Extend typed MissionResult, do not scrape UI

Extend the existing typed `MissionResult` with the new measurable run summary needed by debrief/progression.

Potential fields:
- operationSeconds?: number
- watchSeconds?: number
- searchSeconds?: number
- highAlertSeconds?: number
- maxFacilityState?: ...

Use exact typed names appropriate to the codebase.

Keep existing fields intact:
- rank
- score
- route
- intel
- stage resolutions
- optional objectives
- opportunities
- alerts
- runSeed
- replayHint

No MutationObserver.
No HUD text parsing.
No regex reconstruction.

An old COMPLETE save without telemetry must still produce a valid typed MissionResult.

---

# Part F — Field Mastery / replay records

Add a small set of deterministic persistent mastery records based only on completed-run facts.

Do not call them achievements if another naming style fits the game's tone better. Example presentation names:
- FIELD RECORDS
- OPERATION MASTERY
- DOSSIER RECORDS

Suggested mastery records:

1. **CLEAN RUN** — complete a run with 0 alerts.
2. **FULL INTEL** — find all mission intel in one completed run.
3. **FULL OPTIONAL** — complete both optional objectives in one run.
4. **ROUTE MASTERY** — complete both MAIN and SIDE routes across runs.
5. **MANIFEST MASTERY** — complete both MANIFEST solutions across runs.
6. **VERIFY MASTERY** — complete both VERIFY solutions across runs.
7. **OPPORTUNITY MASTERY** — use all three registered opportunities across completed runs.
8. **GHOST RECORD** — earn GHOST rank at least once.

You may tune exact display labels but preserve the underlying concepts.

These records must NOT unlock gameplay power.
They are replay goals and dossier/progression presentation only.

If a record depends on cumulative history (both routes, all opportunities), compute it deterministically from the profile's sets.

A restored COMPLETE save must not produce duplicate record announcements.

---

# Part G — Best-run records

Track meaningful personal bests from completed runs only.

At minimum:
- highest score
- best rank using explicit rank ordering (`GHOST` > `SHADOW` > `OPERATIVE`)
- lowest alert count
- fastest valid operation time when telemetry exists

Do not overwrite a better record with a worse run.

Tie behavior must be deterministic.
For example, if score ties, do not create duplicate "new best" state.

Expose a pure comparison result so debrief can know which fields were actually new records on this run.

Example:

```ts
interface ProgressionUpdate {
  isNewRun: boolean;
  newBestScore: boolean;
  newBestRank: boolean;
  newBestAlerts: boolean;
  newBestTime: boolean;
  newlyUnlockedRecords: MasteryRecordId[];
}
```

Do not let UI infer this by comparing text.

---

# Part H — Recent run history

Store only compact completed-run summaries.

Suggested fields:
- runId/runSeed
- score
- rank
- route
- MANIFEST resolution
- VERIFY resolution
- optional count
- opportunity count
- alerts
- operationSeconds if available

No giant snapshots.
No NPC/world state.
No timestamps required unless there is a strong product reason.

Cap to 10–12 most recent completed runs.
Newest first or oldest first is fine, but be consistent and test it.

Restoring the same COMPLETE save must not append another history entry.

---

# Part I — Deterministic next replay target

Replace/grow the simple current replay hint with a profile-aware replay recommendation.

The recommendation should point at ONE meaningful missing accomplishment, in deterministic priority order.

Example priority:
1. route not yet completed
2. MANIFEST solution not yet completed
3. VERIFY solution not yet completed
4. optional objective record missing
5. opportunity coverage missing
6. full intel missing
7. clean run / better rank
8. if everything is complete, challenge personal best score/time

Do not choose randomly.
Do not reveal hidden live NPC information.
Do not create a "daily challenge" or time-limited FOMO system.

A useful debrief line could read conceptually like:

`SONRAKİ KAYIT · YAN ROTA İLE TAMAMLA`

or

`SONRAKİ KAYIT · STOK DEFTERİ ÇÖZÜMÜNÜ KULLAN`

Use original CUMA WORLD language, not another game's challenge UI.

---

# Part J — Debrief depth

Upgrade the current compact debrief without turning it into a desktop dashboard.

Keep rank and score prominent.

Add mobile-readable sections such as:

CURRENT RUN
- route
- MANIFEST solution
- VERIFY solution
- optional x/2
- intel x/y
- opportunities
- alerts
- operation time if known
- security pressure summary (WATCH/SEARCH/HIGH_ALERT time or concise label)

PERSONAL RECORD
- best score
- best rank
- best alerts
- best time if known

FIELD MASTERY
- completed mastery count / total
- newly earned record(s), if any
- one next replay target

Do not dump the entire 10-run history into the overlay.
A small last-run/personal-best summary is enough.
The history exists for future use and testing.

Do not create giant scrolling walls on landscape phones.
Use CSS safe areas.
Keep close/replay touch targets intact.

`debrief.ts` must remain dependency-light and must NOT import `mission.ts` or Babylon/world modules.
Preserve the Milestone 05 bootstrap optimization.

---

# Part K — Replay semantics

The existing replay button currently calls `resetMissionProgress()` and reloads.
Preserve that basic behavior.

Replay must:
- clear active run save
- generate a fresh runSeed next runtime
- preserve progression profile
- preserve settings/preferences
- preserve audio/graphics preferences

Do not reset mastery/history/best records on replay.

Do not accidentally count pressing replay as a completed run.

If you add any "NEW OPERATION" wording, it must be the same safe reset behavior, not a second restart path.

No "prestige", XP reset or rebirth system.

---

# Part L — Optional compact profile readout at boot

If it can be added without clutter and without pulling world modules into bootstrap, a compact line on the existing boot/briefing screen may show something like:

`OPERASYON KAYDI · 4 TAMAMLAMA · EN İYİ 92 · USTALIK 5/8`

This is optional.

If added:
- dependency-free progression module only
- no extra full-screen menu
- no carousel
- no giant statistics dashboard
- do not show it if there are zero completed runs unless visually useful

Do not delay runtime loading for it.

---

# Part M — Storage robustness and migration

Progression storage must be more defensive than raw casting.

Implement real validation for:
- schema version
- finite numeric ranges
- known rank ids
- known route ids
- known mission resolution ids
- known objective/opportunity/intel ids
- array lengths
- duplicates
- run history size
- processed-run id size/count

Unknown future fields should not crash older code.

Corrupt progression must not corrupt the active mission save.
Corrupt mission save must not erase a valid progression profile.

If progression version is unknown/newer than supported, fail safely to a default/read-only-safe behavior rather than partially interpreting garbage.

No localStorage writes in an unbounded loop.

---

# Part N — Architecture / ownership

Preferred lightweight modules:
- `progression.ts` — schema, storage, validation, record result, best/mastery logic
- `run-telemetry.ts` — pure accumulator if needed

Do not add:
- a second MissionDirector
- a second mission save
- a generic achievement framework
- a generic analytics SDK
- a database
- cloud sync
- accounts/auth
- online leaderboards
- social sharing
- telemetry upload

Everything remains local/offline.

Progression logic must be deterministic and unit-testable.

---

# Part O — Preserve scoring truth

Current mission scoring remains 0..100 and current rank names remain:
- GHOST
- SHADOW
- OPERATIVE

Do not radically rebalance the score in this milestone.

Alternate MANIFEST/VERIFY solutions must remain score-neutral relative to their sibling solution.

Progression/mastery is separate from score.
Do not award hidden score boosts merely for having played more runs.

No XP multiplier.
No level-based gameplay advantage.

---

# Part P — Performance / bootstrap

This milestone should be cheap.

No new render/update loop.
No new interval/timer for progression.
No per-frame DOM writes.
No per-frame localStorage writes.
No unbounded history arrays.
No Babylon import in progression/debrief storage code.

If telemetry is updated every gameplay frame, it should be plain numeric accumulation with no allocations.

Report CI-to-CI against Milestone 07 run #136:
- bootstrap baseline `22,979` bytes
- largest chunk baseline `812,392` bytes
- total JS baseline `7,448,663` bytes
- total web baseline `14,978,763` bytes
- artifact baseline `23,744,254` bytes

Keep all bundle budgets green.
Keep Babylon/world graph out of bootstrap.

---

# Part Q — Preserve every verified milestone

Do NOT regress:

Milestone 01:
- authoritative noise/hearing
- movement/landing signals
- zones
- DECOY investigation

Milestone 02:
- directional cover
- observer-specific protection
- cover movement/camera

Milestone 03:
- connected facility
- Door/Access
- credential
- front/side/utility traversal

Milestone 04:
- CALM/WATCH/SEARCH/HIGH_ALERT
- last-known anchor
- coordinated search
- COVER STORY
- FIELD FOCUS
- CCTV

Character pipeline:
- GLB pipeline
- animation resolver
- AnimationBlender
- optional face layer
- procedural fallback
- CHARACTER REPORT
- 53 tests

Milestone 05:
- one MissionDirector
- typed mission graph
- alternate MANIFEST/VERIFY
- exactly two optional objectives
- opportunities
- runSeed routines
- typed MissionResult
- save migration
- regex-free debrief
- 117 tests

Milestone 06:
- cinematic intro
- skip/input lock
- Reduced Motion
- typed presentation events
- sprint FOV
- stationary turn
- guard presentation cues
- 96 tests

Milestone 07:
- one AudioContext/GameAudio owner
- distance gait
- acoustic zones
- spatial voice cap
- typed world audio cues
- gameplay-noise/audio separation
- AUDIO REPORT
- 104 audio tests

Also preserve:
- mobile multitouch
- settings/preferences
- Android lifecycle
- LOW/MEDIUM/HIGH/ULTRA behavior
- bootstrap chunk boundary

---

# Acceptance scenarios

1. A first-ever profile starts cleanly with 0 completed runs and no fake best records.
2. Completing one run records exactly one progression entry.
3. Reloading the same COMPLETE save opens debrief but does NOT record a second completion.
4. Replay clears mission progress but preserves progression/history/mastery.
5. Fresh replay gets a new runSeed and records as a new run after completion.
6. Better score updates bestScore; worse score does not.
7. GHOST outranks SHADOW outranks OPERATIVE in best-rank comparison.
8. Lowest alert record updates only when genuinely improved.
9. Fastest operation time updates only when telemetry exists and is genuinely better.
10. Old COMPLETE save with no telemetry still opens debrief with unknown time, not fake 0.
11. MAIN and SIDE completions accumulate correctly across separate runs.
12. Both MANIFEST resolution ids accumulate correctly across runs.
13. Both VERIFY resolution ids accumulate correctly across runs.
14. Optional objectives/opportunities/intel sets deduplicate correctly.
15. Mastery records unlock deterministically from actual completed-run facts.
16. Restoring a COMPLETE save does not re-announce already-earned mastery.
17. Recent history never exceeds its fixed cap.
18. Corrupt progression JSON falls back safely without deleting active mission save.
19. Unknown ids in progression are rejected/filtered safely.
20. Pause/background time is not counted as operation time.
21. Cinematic intro time is not counted as operation time.
22. No localStorage write occurs every gameplay frame.
23. Debrief shows current run + personal record + mastery/next replay target from typed data.
24. Debrief does not import `mission.ts`, Babylon or scrape HUD text.
25. Current score/rank behavior remains unchanged for the same run facts.
26. Mission M05 alternate paths remain completable.
27. Character 53, mission 117, presentation 96, audio 104 tests remain green.
28. Audio/gameplay-noise separation guards remain green.
29. Old mission saves remain compatible.
30. Bootstrap/world chunk boundary remains intact.

---

# Tests

Add a focused pure contract suite, preferably:

`ci/test_progression.mjs`

Test at minimum:
- default profile
- schema validation
- corrupt JSON
- unknown version
- id filtering
- result recording
- same-run dedupe
- fresh run count increment
- recent-history cap
- best score
- best rank ordering
- best alerts
- best time with/without telemetry
- route accumulation
- MANIFEST accumulation
- VERIFY accumulation
- optional accumulation
- opportunity accumulation
- intel accumulation
- every mastery record
- no duplicate mastery unlock
- deterministic next replay target
- replay mission reset does not erase profile (pure storage shim is enough)
- telemetry accumulation
- pause/cinematic excluded from telemetry
- telemetry clamp for giant dt
- optional old-save telemetry migration
- progression does not import Babylon/world modules

Add/extend regression guards so CI fails if:
- `debrief.ts` imports `./mission`
- progression imports Babylon/runtime world modules
- a second mission `SAVE_KEY` is introduced
- progression history is unbounded by implementation contract
- progression recording uses a random completion id
- telemetry/progression adds a new interval/RAF
- existing presentation/audio/noise separation regressions return

Make guards explicit; do not use the broken `! grep` + `set -e` pattern discovered in Milestone 06.

---

# Validation

Before committing run:

- `npm run build`
- `node ci/test_character_runtime.mjs`
- `node ci/test_mission_graph.mjs`
- `node ci/test_presentation.mjs`
- `node ci/test_audio_runtime.mjs`
- new progression tests
- `bash ci/check_presentation_regressions.sh` (or the current consolidated regression guard entry point)
- audio asset audit on current packaged audio path when available

Verify:
- old mission save migration still works
- restored COMPLETE result dedupes progression
- replay preserves profile
- no HUD text scraping
- no world/Babylon boot import
- all bundle budgets green

Suggested gameplay commit:

`feat: add persistent field mastery and replay records`

One coherent gameplay commit.

Push it.

Then dispatch:

`.github/workflows/android-play-runtime.yml`

on `claude/full-game-development` for the exact gameplay SHA.

Do not call it SUCCESS until you verify:
- final workflow completed/success
- new progression test result
- `AUDIO_RUNTIME_OK 104`
- `PRESENTATION_OK 96`
- `MISSION_GRAPH_OK 117`
- `CHARACTER_RUNTIME_OK 53`
- regression guards
- `AUDIO REPORT` / audio packaged audit
- `CHARACTER_GLB_OK`
- debug APK
- Play AAB
- artifact upload/digest

Update `CLAUDE_CODE_HANDOFF.md` with:
- gameplay SHA
- handoff SHA
- changed files
- progression storage key/version
- active mission save key unchanged proof
- profile schema
- migration/validation behavior
- completed-run dedupe id
- recent-history cap
- telemetry fields
- telemetry checkpoint cadence if any
- pause/cinematic exclusion
- MissionResult additions
- best-stat logic
- rank ordering
- mastery record ids and unlock conditions
- next replay target priority
- debrief current-run/personal-record/mastery flow
- replay behavior
- corrupt storage behavior
- progression test count/result
- audio 104 result
- presentation 96 result
- mission 117 result
- character 53 result
- bootstrap before/after
- largest chunk before/after
- total JS before/after
- total web before/after
- workflow run ID
- APK hash
- AAB hash
- artifact id/size/digest
- real Android device checks still required

CI does not prove that the debrief layout is readable or that replay goals feel motivating on a real phone. State that honestly.

After Milestone 08 is complete, STOP.
Do not begin Milestone 09 in the same implementation commit.
