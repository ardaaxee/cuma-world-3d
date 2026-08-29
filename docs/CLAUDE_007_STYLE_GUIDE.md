# CUMA WORLD 3D — Cinematic Spycraft Design Guide

This document defines the design language Claude Code must follow while evolving CUMA WORLD 3D.

The target is NOT to copy 007 First Light assets, story, characters, names, UI, missions, locations, dialogue, animations, audio, logos or proprietary mechanics. The target is to reach the same broad quality class of modern cinematic spy-thriller gameplay through original CUMA WORLD systems.

## Core experience pillars

### 1. SPYCRAFT
The player should gain power by observing before acting.

Support progressively:
- eavesdropping-style fictional intel opportunities
- environmental clues
- patrol and CCTV knowledge
- staff routines
- access requirements
- hidden shortcuts
- optional records/intel
- route opportunities unlocked by knowledge

Intel must change gameplay. Avoid collectible counters with no consequence.

### 2. CREATIVE APPROACH
Every major objective should eventually support at least two meaningfully different solutions.

Examples:
- public/front route versus service route
- access credential versus alternate physical path
- timed distraction versus careful stealth
- temporary CCTV disruption versus route avoidance
- optional intel that reveals a safer path

Different approaches should alter risk, patrol exposure, security response, score or extraction conditions.

### 3. SOCIAL STEALTH / BLUFF
Build an original suspicion-and-access system for public or semi-restricted areas.

Desired behavior:
- public zones tolerate normal presence
- staff zones increase suspicion without valid context
- restricted zones escalate more quickly
- discovered intel/credentials can reduce suspicion or open access
- limited contextual bluff opportunities can de-escalate suspicion
- bluffing is a gameplay resource/opportunity, not an unlimited invisibility button

Keep this fictional and abstract. Do not reproduce any exact dialogue or UI from another game.

### 4. GADGET IMPROVISATION
Current tools: SCAN, SIGNAL JAM, DECOY.

Expand through original fictional tools that solve gameplay problems without becoming permanent wallhacks or instant-win buttons.

Rules:
- gadgets should have cooldowns, charges, context or tradeoffs
- gadgets should create opportunities, not delete AI
- environment and AI should visibly react
- gadget state must be readable on mobile
- avoid permanent button clutter; use compact contextual/radial UI

### 5. INSTINCT-LIKE ADAPTABILITY
Create an original CUMA WORLD mechanic for short tactical assistance without copying another game's branding.

Possible original direction: `FIELD FOCUS`.

FIELD FOCUS may later:
- briefly emphasize recently discovered intel-linked objects
- make the current objective route more readable
- expose immediate contextual opportunities already known by the player
- assist with a short bluff/de-escalation window

It must NOT reveal every enemy through walls indefinitely.

### 6. SYSTEMIC SECURITY
Security should behave like a network, not independent meters.

Progress toward:
- sight
- hearing
- suspicion memory
- last-known position
- local broadcasts
- investigation
- multi-point search
- facility security states
- recovery back to patrol
- reactions to open doors, decoys, jammed cameras and suspicious interactions

No perfect omniscience.

### 7. CINEMATIC PRESENTATION
The game should feel premium without expensive effects everywhere.

Use:
- restrained mission title/location cards
- deliberate camera framing
- strong silhouette and lighting
- readable environmental composition
- objective/intel transitions
- subtle haptic/audio support
- authored set-piece moments at selected mission beats

Avoid:
- cheap neon overload
- giant HUD panels
- constant screen shake
- excessive bloom
- fake cinematic bars used everywhere

### 8. HANDCRAFTED SET PIECES
Long-term missions should include selected authored moments such as:
- timed escape
- changing security conditions
- collapsing/closing route opportunity
- moving vehicle/environment backdrop as a cinematic sequence
- urgent extraction change

These are fictional game sequences. Do not add real-world dangerous-activity instructions.

### 9. REPLAYABILITY
Missions should reward replay through systems rather than grinding.

Track eventually:
- route used
- alerts
- optional intel
- optional objectives
- security disruptions
- clean extraction
- mission rank
- alternate opportunity completion

Add a replay/challenge layer only after the base mission is deep enough.

## Visual language

Target mood:
- grounded contemporary spy thriller
- premium dark neutrals, practical lighting, selective warm highlights
- believable materials
- clear architecture and navigation
- cinematic contrast without crushing visibility
- subtle filmic presentation

Do not clone another game's color palette or interface.

## Mobile-first constraint

Everything must work on Android landscape.

- maintain multitouch
- keep action density manageable
- respect safe areas
- respect LOW/MEDIUM/HIGH/ULTRA
- expensive effects degrade gracefully
- AI tick rates may scale by tier
- do not trade stable controls for visual spectacle

## Originality rule

When a feature reference comes from 007 First Light or another game, translate it into an original CUMA WORLD mechanic with different names, data model, presentation and implementation. Never copy proprietary assets, exact missions, dialogue, character likenesses, UI layouts or source code.
