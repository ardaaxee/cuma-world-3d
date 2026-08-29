# CUMA WORLD 3D — Claude Code Development Contract

You are the primary implementation agent for this repository. Treat CUMA WORLD 3D as an unfinished mobile-first cinematic stealth / intelligence game, not as a finished demo.

## Branch discipline

- Work ONLY on `claude/full-game-development` unless the user explicitly says otherwise.
- NEVER modify `main`.
- Do not create or merge a pull request unless the user explicitly requests it.
- Before each task, verify the current branch and HEAD.
- Keep commits focused and readable. Prefer one commit per coherent gameplay/system change.
- Never rewrite unrelated working systems just to make implementation easier.

## Current verified baseline

This branch starts from commit `3ac21061bb877936600ddb550a00bd0c35e2bdd4`.
The baseline already includes:
- mobile movement, run, jump and crouch
- third-person camera and character locomotion
- tactical cover
- reconnaissance / intel
- CCTV awareness and bypass
- multi-stage infiltration: ACCESS -> MANIFEST -> VERIFY -> EXTRACT
- field gadgets: SCAN, SIGNAL JAM, DECOY
- NPC patrol / awareness / investigation / coordinated search network
- expanded physical side/service route and loading area
- Android lifecycle pause/resume handling
- graphics quality tiers and Android build pipeline

Do not delete or regress these systems.

## Product direction

The target is a high-quality cinematic mobile stealth game with intelligence gathering, systemic AI, layered infiltration, meaningful route choice, environmental interaction and strong presentation. Avoid cheap mobile-game UI, excessive neon, simple box-room layouts, one-button objectives, static NPCs and fake interactions.

The game must feel deeper through systems, not only through visual decoration.

## Immediate implementation priority

Follow `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md` in order. The next active milestone is described in `docs/CLAUDE_NEXT_TASK.md`.

## Mandatory quality gates

For every implementation batch:
1. Inspect existing code first. Do not guess architecture.
2. Preserve mobile multitouch: joystick + look + action must work simultaneously.
3. Run `npm run build` (which includes TypeScript checking) before committing when the environment allows it.
4. Fix all new TypeScript/build errors before stopping.
5. Push only coherent code.
6. Check the GitHub Actions Android workflow for the new HEAD.
7. Do not call a task complete until TypeScript/Vite build passes.
8. Do not claim APK/AAB success until the Android workflow actually reports success.
9. Do not claim real-device testing unless a real-device result exists.
10. Record important behavioral changes in the commit message and final report.

## Mobile performance rules

- Primary target: Android phone, landscape gameplay.
- Keep touch targets usable and avoid action-button clutter.
- Use contextual actions and compact radial/secondary panels instead of adding many permanent buttons.
- Do not create expensive per-frame allocations when avoidable.
- Reuse vectors/materials where practical.
- Respect LOW / MEDIUM / HIGH / ULTRA tiers.
- Expensive effects and AI work must degrade gracefully on LOW.
- Keep reduced-motion behavior functional.

## Gameplay rules

- Detection must be understandable and avoid unfair instant omniscience.
- NPCs should use sight, sound, last-known position, investigation and coordinated search.
- Cover, crouch, route selection and gadgets must have genuine mechanical consequences.
- Route choice must be physical, not only a hidden multiplier.
- Mission objectives should form chains with setup, execution and escape.
- Do not make the player invincible or invisible through gadgets.
- Cooldowns and limited opportunities should preserve tension.
- Prefer emergent interactions over scripted fake choices.

## World rules

- Build believable connected spaces: public area, staff/back office, loading/service, security/utility and exterior escape routes.
- Use door openings, sightlines, occluders, cover, alternate entries, traversal loops and vertical interest.
- Avoid giant empty rectangles and repeated primitive boxes without gameplay purpose.
- Every new room/route should provide at least one gameplay reason to exist: intel, route, gadget opportunity, cover, patrol change, shortcut, objective or escape option.

## AI rules

NPCs should progressively support:
- vision cones / occlusion
- hearing based on player movement/noise
- suspicion memory
- last-known position
- investigation
- local security broadcasts
- search patterns
- return-to-patrol recovery
- route-aware behavior
- reaction to decoys and security-state changes

Never turn AI into perfect wallhacks.

## Interaction rules

- Contextual prompts must only appear when an action is actually valid.
- Actions should have visual/audio/haptic feedback where appropriate.
- Locked actions should explain requirements briefly instead of silently failing.
- Interaction state must survive pause/background/resume safely.

## Save / compatibility

When mission state schemas evolve, keep existing saves usable when reasonably possible. Add migration/default behavior instead of simply crashing or resetting everything.

## Safety for repository history

- Never expose credentials, keystores, signing secrets or tokens.
- Never place secrets in source, logs or documentation.
- Do not delete working commits or force-push shared branches unless explicitly instructed.

## Reporting format after each milestone

Report:
- commit SHA
- files changed
- gameplay behavior added/changed
- build/typecheck result
- Android workflow status/run ID if available
- what still requires real-device testing
- next milestone

Do not say the game is “final” or “finished” unless the user explicitly decides development is complete.
