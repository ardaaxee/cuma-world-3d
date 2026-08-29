# CUMA WORLD 3D — Full Claude Code Master Plan

This is the long-form implementation roadmap for Claude Code. Work through it in order, but inspect the existing code before every milestone and adapt implementation details to the real architecture.

## Definition of success

The game should no longer feel like a small tech demo. A normal mission should contain reconnaissance, route planning, infiltration, multiple objective stages, security reactions, player-created distractions, changing risk, meaningful escape and a debrief. The player should be able to understand why they were detected and should have multiple ways to solve a situation.

---

# PHASE 1 — Stealth foundation depth

## 1.1 Sound-based awareness

Add a real player-noise model and NPC hearing.

Noise sources should include at minimum:
- walking
- running
- jumping / landing
- crouched movement
- gadget use where appropriate
- interaction with louder environment objects later

Requirements:
- running must be materially louder than walking
- crouched slow movement must be materially quieter
- landing from a meaningful height should create a short noise event
- NPC hearing should respect distance and basic occlusion/room separation when practical
- hearing should create CURIOUS / investigation behavior, not instant omniscient ALERT
- NPCs should investigate the sound origin and search briefly
- repeated or very close loud sounds can escalate suspicion
- add a subtle HUD/noise indicator only if it improves readability without clutter

Acceptance:
- player can intentionally sneak past a guard by crouching and moving carefully
- sprinting near guards changes behavior even if they are not looking directly at the player

## 1.2 Cover refinement

Improve tactical cover from proximity toggle into a more polished stealth mechanic.

Requirements:
- cover should identify a dominant surface direction
- camera shoulder offset should subtly adapt to cover orientation
- movement while in cover should feel constrained/intentional instead of normal free movement
- leaving cover by sprinting/jumping should be clean
- cover should never grant invisible status when fully exposed
- add low-risk peek/exposure logic if architecture allows without destabilizing mobile controls

## 1.3 Player movement polish

- base camera sprint FOV on actual RUN input, not joystick strength alone
- add jump buffer if device tests show missed taps
- add meaningful landing feedback/haptic only for real landings
- prevent animation/run-state mismatch
- maintain reduced-motion behavior
- keep joystick + look + RUN/JUMP/CROUCH simultaneous touch support

---

# PHASE 2 — World expansion and infiltration topology

Create a believable connected operation space rather than one simple market shell.

## 2.1 Interior zones

Add connected zones such as:
- public sales floor
- staff-only corridor
- back office
- security/monitoring room
- stock room
- loading bay
- utility/electrical room
- manager office or records room
- exterior service alley

Each zone must have a gameplay purpose.

## 2.2 Physical alternate routes

At minimum support several distinct approaches:
- public/front approach
- delivery/service approach
- maintenance/utility shortcut
- one higher-risk shortcut or alternate escape route

Requirements:
- routes must be physically traversable
- route choice should alter patrol exposure, CCTV exposure or objective order
- routes should reconnect to create loops rather than dead linear hallways

## 2.3 Doors and access states

Add a reusable door/access system:
- open/closed state
- locked/unlocked state
- interaction prompt
- access requirement
- sound/noise event
- optional auto-close where appropriate
- stable collision state

Possible access methods:
- discovered code
- staff credential/intel
- alternate route
- temporary security opportunity

Do not add fake doors that are only visual unless clearly non-interactive.

---

# PHASE 3 — Mission graph and intelligence gameplay

## 3.1 Mission graph

Replace any remaining hard-coded single-objective assumptions with a reusable mission-stage model.

Support:
- prerequisites
- optional objectives
- route-dependent branches
- fail-soft behavior where possible
- extraction requirements
- score/debrief contributions

## 3.2 Recon 2.0

Recon should reveal useful information rather than simply collect counters.

Intel examples:
- patrol route
- CCTV coverage
- access panel
- staff routine
- delivery timing
- locked door requirement
- optional objective
- shortcut
- security response weakness

When intel is discovered, update the player's planning information or world affordances.

## 3.3 Planning board / operation brief

Create a compact cinematic pre-infiltration planning layer using existing intel:
- discovered entry points
- known cameras
- known guards
- optional opportunities
- recommended but not forced route selection

Keep it mobile-friendly and avoid a complex desktop UI.

## 3.4 Optional objectives

Add at least 2 meaningful optional objectives that change score/debrief and create extra risk/reward.

Examples:
- retrieve secondary records
- disable security logging
- capture optional intel
- leave no security alert

---

# PHASE 4 — AI systemic behavior

## 4.1 Security states

Add facility-level security escalation separate from a single NPC meter.

Suggested states:
- NORMAL
- HEIGHTENED
- SEARCH
- LOCKDOWN
- RECOVERY

Effects can include:
- patrol speed/routing changes
- cameras becoming more important
- access restrictions
- security network broadcasts
- changed extraction risk

Do not make escalation irreversible unless mission design requires it.

## 4.2 Patrol variation

- add route pauses/look-arounds
- add limited route variance
- add staff vs security behavior differences
- avoid perfectly synchronized loops

## 4.3 Search behavior

Improve search beyond standing and rotating:
- move through nearby candidate points
- inspect last-known area
- communicate locally
- gradually give up and return to route

## 4.4 NPC reaction to environment

NPCs should react to:
- decoy
- loud player movement
- suspicious open/accessed doors later
- disabled/jammed security when discovered if appropriate

---

# PHASE 5 — Gadget and opportunity depth

Existing gadgets: SCAN, SIGNAL JAM, DECOY.

Improve them without making them overpowered.

## 5.1 SCAN

- reveal useful recon targets temporarily
- show distance/priority subtly
- avoid permanent wallhack on enemies

## 5.2 SIGNAL JAM

- temporary effect only
- clear duration/readability
- cameras recover afterward
- using it should not duplicate permanent CCTV bypass

## 5.3 DECOY

- target a believable point
- NPCs should investigate based on hearing/range
- repeated use should not permanently trap AI

## 5.4 Environmental opportunities

Add contextual opportunities unlocked by intel:
- temporary lighting change
- staff-door access
- CCTV loop/bypass
- delivery distraction
- short-lived security diversion

These should be fictional game mechanics, not real-world intrusion instructions.

---

# PHASE 6 — Presentation and cinematic quality

## 6.1 Mission start

Improve transition from menu/briefing into gameplay:
- cinematic camera moment
- mission title/location card
- restrained audio sting
- no excessive flashy neon

## 6.2 Mission feedback

Improve:
- objective update feedback
- intel discovery feedback
- suspicion escalation feedback
- gadget cooldown feedback
- security-state feedback

Use sound/haptic/UI together carefully.

## 6.3 Character animation polish

- imported animation blending where available
- crouch locomotion fallback improvements
- turn smoothing
- landing response
- cover stance/lean if feasible
- guard look/search animation cues, even procedural if no assets exist

## 6.4 Camera polish

- actual RUN-linked sprint camera
- cover-aware shoulder behavior
- subtle landing response
- obstruction-safe camera collision
- reduced-motion alternatives

---

# PHASE 7 — Audio system

Create layered game audio behavior using available/local assets and safe fallbacks.

Needed categories:
- footsteps by locomotion state
- landing
- UI confirm/back
- intel discovery
- objective update
- security escalation
- gadget activate/cooldown-ready
- doors/access interaction
- environment ambience

Requirements:
- no copyrighted commercial audio ripped from games/music
- optional assets must fail gracefully
- respect master volume and pause/resume lifecycle
- Android backgrounding must not leave looping audio in a bad state

---

# PHASE 8 — Save, progression and replayability

## 8.1 Save state

Persist appropriate mission progress without corrupting old saves.

## 8.2 Debrief depth

Debrief should consider:
- alerts
- optional objectives
- intel found
- route used
- detection time or stealth quality where measurable
- gadget use where useful

## 8.3 Replay motivation

Encourage replay through:
- alternate route completion
- optional intel
- better rank
- cleaner stealth
- alternate opportunities

Do not add manipulative monetization or gambling mechanics.

---

# PHASE 9 — Mobile UX and settings

- keep controls readable in landscape
- no crowded button wall
- contextual buttons where possible
- haptics toggle if settings architecture supports it
- sensitivity controls
- audio controls
- graphics tier
- reduced motion
- safe-area handling
- orientation/resume robustness

Test simultaneous pointer ownership carefully.

---

# PHASE 10 — Performance and stability

For every large addition:
- inspect bundle size
- avoid runaway observers/listeners
- avoid duplicate singleton initialization
- ensure event listeners do not multiply across runtime reloads
- reduce update frequency for low-priority AI on LOW tier
- avoid allocating many new Vector3 objects every frame in hot loops if easy to prevent
- keep shadows/visuals tier-aware

Add targeted tests where useful for pure logic such as:
- mission state transitions
- cooldown logic
- security-state transitions
- save migration

---

# PHASE 11 — Android validation

For every stable milestone:
- `npm run build`
- verify native project generation
- GitHub Actions Android build
- APK + AAB success
- artifact metadata/hashes where workflow already provides them

Real device smoke test checklist should include:
- joystick + look multitouch
- RUN + JUMP
- crouch
- cover
- gadget panel
- interact
- background 30s -> resume
- Settings/debrief pause conflict
- mission stage persistence
- side route collision
- NPC sight/hearing behavior
- performance on LOW/MEDIUM

Never claim these device behaviors are verified without actual device testing.

---

# Delivery strategy

Do not attempt all phases in one giant commit.

Use milestone-sized batches, for example:
1. sound awareness
2. cover refinement/movement polish
3. back-office world expansion
4. reusable doors/access
5. mission graph
6. recon/planning
7. security-state AI
8. search/patrol depth
9. presentation/audio
10. save/replayability
11. performance/device hardening

After each milestone, build, commit, push, check CI, report status, then continue to the next milestone unless a blocking failure requires fixing first.
