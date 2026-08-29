# CLAUDE NEXT TASK — Milestone 03: Connected Back Office + Door / Access Depth

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, and `docs/CLAUDE_007_STYLE_GUIDE.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

Current collaboration HEAD before this milestone: `3778f22912c287a1071b66353f4740f809cac567`.
Milestone 02 gameplay implementation is `89352a2f2a8e941f848c6c3737d19578cfe91e85` and is verified by Android workflow run `33244796378` through TypeScript/Vite, Android 16, debug APK, Play AAB, SHA/build manifest and artifact upload.

## Goal

Make the operation space feel like a believable connected facility rather than one market shell plus an exterior strip.

Build the first real internal infiltration topology and a reusable fictional door/access system so route choice, credentials, STAFF/RESTRICTED zones and hearing all affect physical traversal.

This milestone should create systemic world depth, not only visual decoration.

Do not redesign unrelated systems.

---

# Part A — Expand the physical operation space

Inspect `src/game/world-expansion.ts`, `src/game/operation-depth.ts`, `src/game/zones.ts`, `src/game/mission.ts`, and the market geometry in `src/game/runtime11.ts` before editing.

Extend the existing world instead of creating a second map/world system.

Create a compact but believable connected internal area with at minimum:

1. STAFF CORRIDOR
   - connects sales/public space to back-of-house
   - provides at least one sightline break and one useful cover position

2. BACK OFFICE / RECORDS ROOM
   - contains or logically supports the MANIFEST stage
   - RESTRICTED zone
   - should not be a giant empty rectangle

3. SECURITY / MONITORING ROOM
   - RESTRICTED zone
   - physically connected to another internal zone
   - should create a future gameplay opportunity, even if not all later security mechanics are implemented now

4. UTILITY / ELECTRICAL ROOM OR SERVICE NOOK
   - creates an alternate internal connection/shortcut
   - should provide a gameplay reason to enter, not decoration only

5. STOCK / LOADING CONNECTION
   - physically connects the existing service/loading route to the internal staff network
   - the side route must become a real alternate infiltration loop, not merely an exterior detour

World requirements:
- use connected rooms/corridors with loops where practical
- preserve the existing public sales area and service/loading area
- reuse existing materials or add restrained PBR materials; do not create a second VisualPolish system
- structural geometry can live in the existing world expansion ownership
- avoid excessive PointLights; use emissive fixtures / existing lighting approach when possible
- every new room/route must have a gameplay purpose: access, objective, intel, cover, security, shortcut, patrol exposure or extraction
- keep collision geometry truthful
- do not add fake interactive-looking doors that never work

Target topology should allow at least these distinct traversals:

PUBLIC / FRONT -> controlled staff entry -> STAFF CORRIDOR -> BACK OFFICE
SERVICE / SIDE -> LOADING / STOCK -> STAFF CORRIDOR -> BACK OFFICE
UTILITY SHORTCUT -> reconnect to the internal network instead of ending in a decorative dead end

Exact coordinates should be chosen from the real current geometry after inspection, not guessed from this document.

---

# Part B — Reusable fictional Door / Access system

Create ONE reusable door/access-state system. Do not hard-code unrelated door logic separately for every room.

A door entry should support at minimum:
- unique id
- display label
- OPEN / CLOSED state
- LOCKED / UNLOCKED state
- access requirement
- collision state that matches physical state
- contextual interaction text
- optional auto-close only where it makes gameplay sense
- world position / hinge or slide configuration

Suggested fictional access requirement categories:
- NONE
- STAFF_CREDENTIAL
- ACCESS_CODE
- SECURITY_ACCESS

Names/data structures may differ if the existing architecture suggests a cleaner design.

Important:
- these are fictional game access states only
- do not add real-world lock bypass, hacking, credential theft or intrusion instructions
- do not simulate real security protocols

Door interaction must use the existing mobile interaction flow without adding a new permanent button.

Avoid prompt fights between:
- normal runtime interactions
- staged operation terminals
- CCTV interaction
- new doors

There must be deterministic ownership/priority when more than one interactable is nearby. Prefer extending the existing interaction architecture or one small shared resolver instead of several competing DOM owners.

Door behavior:
- opening/closing should animate clearly but cheaply
- collision must change at the correct point so players do not walk through visibly closed doors
- a locked door must remain physically blocking
- invalid access should show a short requirement message instead of silently doing nothing
- pause/background/resume must not leave a door halfway in an invalid collision state
- Reduced Motion may shorten/simplify nonessential easing but doors still need readable state

---

# Part C — Integrate Milestone 01 hearing with door interactions

Do not create a second noise model.

Extend the authoritative `src/game/noise.ts` model only if necessary so a meaningful door interaction can create a short fictional environment noise event.

Requirements:
- normal door use may create a small/medium impulse
- it should be materially quieter than DECOY
- it must never instant-ALERT the facility by itself
- a nearby guard may become CURIOUS and investigate the door area
- opening a door should not continuously track the player after the event
- quiet/static doors do not produce noise every frame

If the existing noise API is too specific, generalize it minimally rather than adding another event/noise subsystem.

---

# Part D — Turn ACCESS into a real staff credential / social-stealth benefit

Milestone 01 already exposes `setZoneAccessGranted()` and the zone model already distinguishes PUBLIC / STAFF / RESTRICTED.

Use the existing operation chain so the ACCESS stage has a real physical consequence.

Desired behavior:
- before ACCESS is completed, controlled STAFF entry should require a staff credential or force the player to use another physical route
- completing the ACCESS terminal should grant a fictional temporary STAFF CREDENTIAL / operation credential
- that credential should unlock appropriate STAFF doors
- STAFF-zone suspicion should become substantially lower with valid access
- RESTRICTED rooms should still generate meaningful suspicion; the staff credential must NOT make the player universally authorized
- existing MANIFEST and VERIFY stages remain in order

Do not add fake dialogue/bluff screens in this milestone.

Use the existing `setZoneAccessGranted()` hook or refactor it minimally into an explicit credential state if that makes the code more correct.

The credential must survive the existing mission save/restore flow when reasonably possible.
Old saves must not crash; migrate/default safely.

---

# Part E — Intel-driven physical opportunity

Add at least ONE meaningful intel/access opportunity that changes traversal.

Examples of acceptable original game behavior:
- discovering an existing/repositioned staff-route intel reveals that a utility door can be used
- discovering a security-room access clue makes a fictional SECURITY_ACCESS door usable
- existing side-route intel makes the loading/stock connection clearly usable

Requirements:
- intel must change a door/access/world affordance, not only increment a counter
- do not add permanent enemy wallhack
- do not add real-world hacking instructions
- keep it consistent with the existing recon system and mission save

Do not create a huge planning UI in this milestone.

---

# Part F — Reposition / integrate operation targets into the new world

The ACCESS -> MANIFEST -> VERIFY -> EXTRACT chain must remain intact.

However, the targets should now make spatial sense:
- ACCESS at or near a plausible public/staff transition or credential point
- MANIFEST in the new back-office/records network
- VERIFY at a physically distinct delivery/records location
- extraction still requires leaving the operation area

Do not duplicate operation targets.
Move/retarget the existing ones if needed.

The mission should require actual traversal through the expanded topology instead of completing three interactions in nearly the same simple shell.

---

# Part G — Zone model expansion

Extend the existing `ZONE_VOLUMES`; do not create a second zone implementation.

Expected zone assignment:
- public sales space -> PUBLIC
- staff corridor / stock / loading connection -> STAFF
- back office / records -> RESTRICTED
- security room -> RESTRICTED
- utility area -> STAFF or RESTRICTED based on the final topology

Rules:
- volumes should follow the real new geometry closely enough to avoid obvious false positives
- legitimate staff credential reduces STAFF pressure
- RESTRICTED pressure remains meaningful
- returning to PUBLIC still allows normal recovery

---

# Part H — Preserve previous milestones

Do NOT regress Milestone 01:
- player noise
- NPC hearing
- landing impulses
- DECOY priority
- PUBLIC / STAFF / RESTRICTED suspicion/recovery

Do NOT regress Milestone 02:
- directional cover surface state
- observer-specific cover protection
- NPC/CCTV truthful cover detection
- cover-guided movement
- RUN/JUMP cover exits
- cover-aware shoulder camera
- cover performance optimizations

New internal walls/crates should naturally work with directional cover where their shape is suitable.

---

# Existing systems that must remain working

Preserve:
- joystick + touch look multitouch
- RUN / JUMP / CROUCH
- SİPER
- SCAN / SIGNAL JAM / DECOY
- CCTV detection / bypass
- ANA / YAN route selection
- ACCESS -> MANIFEST -> VERIFY -> EXTRACT
- security broadcasts / search
- settings / debrief pause behavior
- graphics tiers
- Android lifecycle handling
- save compatibility

Do not reimplement them.

---

# Performance requirements

This is a world expansion, so mobile cost matters.

- static structural meshes should be frozen where safe
- reuse materials instead of creating one material per wall/prop
- avoid many dynamic lights
- do not add per-frame scans over every door/room if one focused interaction ray or registry can solve it
- do not add a separate requestAnimationFrame loop per door
- one system-level update path for animated doors is preferred
- avoid per-frame DOM writes
- LOW tier must remain playable; geometry may simplify only if it does not break routes/collision
- keep bundle budgets green

---

# Acceptance scenarios

1. Before ACCESS credential, player approaches a controlled staff door from PUBLIC: door remains locked and gives a clear fictional credential requirement.
2. Player completes ACCESS: temporary staff credential is granted, valid STAFF door becomes usable, and STAFF-zone pressure is substantially reduced.
3. Same staff credential does NOT eliminate RESTRICTED-zone suspicion in back office/security room.
4. Front route can physically reach the back office through the controlled staff network.
5. Side route can physically enter through loading/stock and reconnect to the internal network.
6. At least one utility/security-related alternate connection changes based on discovered intel/access state.
7. A nearby NPC can investigate a door-open noise event, but the door does not cause instant ALERT or wall tracking.
8. Closed/locked doors block collision; open doors are traversable; animation and collision never visibly disagree for long.
9. New structural walls/crates work with the existing directional SİPER system when physically suitable.
10. ACCESS -> MANIFEST -> VERIFY -> EXTRACT remains completable after the world expansion.
11. Existing old save data loads without crashing and gets safe defaults for new access state.
12. Pause/background/resume does not leave doors, prompts or collision in an invalid state.

---

# Validation

Before committing:
- run `npm run build`
- fix every TypeScript/Vite failure
- inspect changed files for unrelated rewrites
- confirm there is only one door/access system
- confirm old mission save migration/default path is safe
- inspect multitouch interaction ownership
- inspect pause/resume cleanup

Commit message suggestion:
`feat: expand back office and access routes`

After pushing:
- manually dispatch `.github/workflows/android-play-runtime.yml` against `claude/full-game-development` if it does not auto-run
- verify the exact workflow run for the gameplay commit
- because the job-step API has shown stale snapshots, confirm final result from the run status plus artifact/job log when needed
- do not claim APK/AAB success until artifact/build evidence exists
- update `CLAUDE_CODE_HANDOFF.md` with gameplay HEAD, changed files, topology, door/access API, credential behavior, CI result, remaining real-device checks and planned Milestone 04

Then STOP.
Do not begin Milestone 04 in the same implementation commit.
