# QUEUED MILESTONE — CUMA WORLD SPYCRAFT 2.0

This milestone is queued after Milestone 09 verification. It is inspired by the broad design principle of creative spycraft — observation, information, bluffing, social stealth and improvisational opportunities — but must remain entirely original to CUMA WORLD. Do not copy characters, story, UI, dialogue, names, gadgets, missions, assets or proprietary mechanics from any commercial game.

Work only on `claude/full-game-development`. Do not modify `main`. Do not create a PR.

## Goal

Make information itself a gameplay tool.

The player should be able to enter a space, observe people and environment, learn useful facts, convert those facts into opportunities, move through PUBLIC/STAFF/RESTRICTED areas with better social awareness, and complete the same objective through more than one earned approach.

No combat or weapon work belongs in this milestone.

## New architecture

Prefer small dependency-light modules with one owner each. Do not create a second mission director, second NPC system, second facility-security system, second input manager or generic event framework.

Suggested files:

- `src/game/spycraft.ts` — one orchestration/model owner for discovered spycraft facts and opportunity eligibility
- `src/game/spycraft-events.ts` — tiny typed CustomEvent contract for discovered clue / social opportunity / bluff outcome presentation
- `src/game/observation-intel.ts` — pure authored observation nodes and eavesdrop timing/eligibility
- `src/game/social-stealth.ts` — pure zone/role/behavior expectation model and bluff eligibility
- `src/game/field-instinct.ts` — bounded player resource/state for contextual social recovery and learned-opportunity focus
- `ci/test_spycraft.mjs` — focused pure-logic contract tests

Names may change if a cleaner repo-native architecture exists, but responsibilities must remain separate and small.

## A. Observation and eavesdropping

Add authored observation nodes to Fresh Market. Use the existing world and NPC roles; do not create a dialogue AI service.

Minimum authored observations:

1. PUBLIC customer/service conversation that reveals a staff timing fact.
2. Loading/service observation that reveals a delivery-route opportunity.
3. Back-office/security observation that reveals a camera or access-related fact already supported by the fictional game systems.
4. Environmental clue that can be inspected without listening to an NPC.

Rules:
- player must be within a believable authored radius
- player must face / observe the source long enough
- no discovery through walls
- no automatic discovery simply because the player entered a trigger volume
- listening/inspection progress pauses when eligibility is lost
- each fact unlocks once per run
- same restored save keeps discovered facts
- discovery uses stable typed ids, not HUD text
- no real-world surveillance or intrusion instruction; all interactions are fictional game abstractions

Do not add microphone recording, speech recognition, network calls or LLM dialogue.

## B. Spycraft facts

Facts should be useful, not collectible fluff.

Suggested fact ids, adapted to current mission data:
- `staff_break_window`
- `delivery_rotation`
- `monitoring_shift_gap`
- `service_access_pattern`

Each fact must do at least one of:
- unlock an existing opportunity
- reveal a new contextual interaction
- reduce uncertainty about a route
- improve the next replay target/debrief description

Facts must never directly complete a required mission stage.

## C. Opportunity network

Extend current M05 opportunities instead of replacing them.

Facts may unlock or improve access to:
- existing staff routine window
- delivery cart route
- camera-bypass opportunity
- one new environmental opportunity if the current architecture supports it cleanly

A new opportunity must have:
- typed id
- authored prerequisite
- bounded duration if temporary
- explicit used/not-used state
- clear tradeoff
- no instant mission completion
- no permanent AI disable

Do not add a second opportunity registry.

## D. Social stealth

Build on PUBLIC / STAFF / RESTRICTED and existing COVER STORY.

Add a small role/expectation model:
- PUBLIC visitor behavior
- STAFF expected presence
- SECURITY expected presence

The player should accumulate contextual social pressure from behavior such as:
- remaining too long in STAFF without a valid reason
- repeatedly approaching controlled doors
- sprinting or erratic movement in a socially sensitive area
- lingering near a guarded staff interaction

Keep this separate from NPC omniscience.

Rules:
- no hidden-player wall knowledge
- no instant ALERT from one harmless action
- social pressure recovers when behavior normalizes
- RESTRICTED remains meaningfully dangerous
- facility security remains authoritative for escalation
- zone suspicion remains authoritative for zone-level pressure

Do not create a third suspicion meter that competes with existing systems. Prefer a small social modifier feeding existing bounded suspicion/facility pathways.

## E. FIELD INSTINCT — original CUMA mechanic

Add a bounded player resource named `FIELD INSTINCT` or another original CUMA name.

This is not a combat resource.

It may be spent only on spycraft/social actions such as:
- contextual bluff when suspicion is still recoverable
- temporarily stabilizing a valid COVER STORY interaction
- highlighting only already-discovered spycraft facts/opportunities through FIELD FOCUS

Rules:
- max resource is small and fixed
- starts partially or fully charged per fresh run as designed
- spend is explicit
- no per-frame regeneration
- recovery comes from meaningful stealth/observation milestones, not waiting in a corner
- cannot be used in HIGH_ALERT
- cannot erase alerts already reported
- cannot reduce NPC memory to zero
- cannot reveal undiscovered NPCs/opportunities
- cannot turn FIELD FOCUS into a wallhack

Persist only if required for resume consistency. If persisted, add one optional backwards-compatible run-save field; do not put it in cross-run progression.

## F. Contextual bluff

Build on the existing COVER STORY idea.

A bluff should be eligible only when:
- player is not in HIGH_ALERT
- current zone and social context allow it
- a relevant spycraft fact / credential / contextual reason exists
- cooldown/resource rules allow it

Possible outcomes:
- success: bounded temporary relief
- weak success: smaller relief and faster re-check
- fail: no relief and a small authored increase in social/facility pressure

Outcome must be deterministic from authored state, not random dice.

Do not implement free-form dialogue generation.

## G. FIELD FOCUS integration

FIELD FOCUS must show only earned knowledge.

When active, it may mark:
- discovered observation nodes already completed
- known unlocked opportunities
- known contextual route hints
- known controlled-access points already learned

It must NOT show:
- hidden NPC positions through walls
- undiscovered cameras
- undiscovered opportunities
- live search targets
- secret mission state

## H. Mission/debrief/progression integration

Extend typed MissionResult minimally with spycraft summary data if needed.

Debrief may report:
- spycraft facts discovered this run
- social bluff used / not used
- opportunity chain used
- one replay hint for an undiscovered fact or unused approach

Progression may accumulate coverage only if it remains informational/mastery based. No gameplay buff, XP, loot, daily task, streak or monetization.

Do not make old COMPLETE saves invalid.

## I. UI/presentation

Keep UI restrained and landscape-mobile friendly.

Use existing MissionFeedback / typed presentation path.

Suggested messages:
- `İSTİHBARAT DOĞRULANDI`
- `FIRSAT AÇILDI`
- `SOSYAL BASKI`
- `BLÖF UYGUN`

Do not copy another game's fonts, wording, icons, layout or animation language.

No giant spy HUD dashboard.

## J. Audio/haptics

Reuse GameAudio and the one haptics owner.

Short restrained cues only.

No new AudioContext.
No dedicated timer.
No gameplay-noise coupling.

## K. Mobile controls

Do not add another permanent button wall.

Use the existing contextual INTERACT action where possible.
FIELD FOCUS remains the observation/focus control.
A bluff should appear contextually only when valid.

Preserve simultaneous joystick + look + action ownership from M09.

## L. Performance

Android-first.

Forbidden:
- per-frame full scene scan
- per-frame DOM write for observation progress
- per-NPC timer
- per-frame Math.random
- new RAF
- unbounded fact/history arrays
- generic dynamic dialogue graph

Observation candidates should be authored and bounded. Evaluate at a modest fixed cadence or from already-available interaction candidate queries, without changing gameplay truth across graphics tiers.

## M. Tests

Add `ci/test_spycraft.mjs`.

Test at minimum:
- stable fact ids
- no duplicate discovery
- observation eligibility and range loss
- progress pause/reset semantics
- restored fact state
- fact -> opportunity prerequisite mapping
- unknown fact rejection
- social pressure bounded
- harmless action cannot instant-alert
- normal behavior recovery
- RESTRICTED still risky
- deterministic bluff eligibility/outcome
- FIELD INSTINCT clamp/spend/recovery
- no HIGH_ALERT bluff
- no alert erase
- FIELD FOCUS only known knowledge
- old save migration
- MissionResult compatibility
- replay hint determinism
- no gameplay buff from progression

Keep all previous suites green, including mobile UX, progression, audio, presentation, mission and character tests.

## N. Acceptance scenarios

1. Player listens to an authored public conversation and earns one useful fact.
2. Fact unlocks a tactical option without completing the mission automatically.
3. Player can choose to ignore it and use another route.
4. Social pressure rises from clearly suspicious behavior but does not instantly jump to ALERT.
5. Returning to normal behavior reduces pressure.
6. Valid contextual bluff provides bounded relief.
7. Bluff unavailable in HIGH_ALERT.
8. FIELD INSTINCT cannot reveal unknown entities.
9. FIELD FOCUS remains earned-information-only.
10. Restored save preserves discovered facts consistently.
11. Old saves still load.
12. Replay can expose a different approach and debrief hint.
13. No extra input owner, AudioContext, mission director, render loop or NPC system.
14. Mobile multitouch remains intact.

## Validation

Before gameplay commit:
- `npm run build`
- all existing CI test suites
- new spycraft suite
- regression guards
- bundle measurement

Suggested gameplay commit:

`feat: deepen spycraft observation and social stealth`

Then run the Android workflow on the exact gameplay SHA, verify APK/AAB/artifact, update `CLAUDE_CODE_HANDOFF.md`, and STOP. Do not begin the next milestone in the same implementation commit.
