# CLAUDE NEXT TASK — Priority Character Milestone: Realistic Hero Character Pipeline

Read `CLAUDE.md`, `CLAUDE_CODE_HANDOFF.md`, `docs/CLAUDE_FULL_GAME_MASTER_PLAN.md`, `docs/CLAUDE_007_STYLE_GUIDE.md`, and `docs/QUEUED_CHARACTER_REALISM.md` before editing.

Work ONLY on branch `claude/full-game-development`.
Do not modify `main`.
Do not create a PR.

## Priority override

The previously prepared Milestone 05 mission-graph task is PAUSED, not cancelled. Do not implement it in this commit.
The user has explicitly reprioritized character realism. This file is now the ONLY active implementation task.

Current verified gameplay baseline before this character milestone:
`6925ae171f0cff3aae1373a9c1149465db7a4a62`

Milestone 04 is verified by Android workflow run `33246717365` (#132), including TypeScript/Vite, Android 16, debug APK, Play AAB, hashes and artifact upload.

Current character runtime already loads `./assets/characters/cuma_runtime.glb` through `src/game/character.ts`, keeps the capsule collider authoritative, and recognizes imported idle/walk/run clips. Extend this path; do not create a second player controller.

Current Android workflow character packaging behavior:
- first prefers an archive-provided `assets/characters/cuma_high.glb` or `cuma.glb`
- otherwise falls back to a pinned CC0 MakeHuman / MPFB `suited.glb`
- current fallback size is 6,675,064 bytes
- current validator only guarantees GLB v2, mesh, skin, and idle/walk/run animation groups

This milestone must raise both the ART QUALITY CONTRACT and the RUNTIME/VALIDATION CONTRACT.

---

# Goal

Upgrade CUMA WORLD from a procedural/placeholder-looking hero to an original, believable adult human field operative suitable for a cinematic contemporary spy-thriller, while preserving Babylon.js + Capacitor Android performance.

Target production path:

`licensed anatomy reference -> sculpt/model -> retopology -> UV/PBR textures -> humanoid rig/skin -> animation -> glTF/GLB -> Babylon.js runtime`

The project does NOT use Unreal Engine or Unity. Do not introduce a second engine.

The character must be an ORIGINAL CUMA WORLD character.
Do not copy James Bond, an actor, a real person's identity, or another game's proprietary face/body/costume/animation/assets.
Real-human images may be used only as lawful anatomy/material reference, not identity cloning.

Do not exaggerate physical ideals. Optimize for believable anatomy, deformation, clothing, skin response and third-person readability.

---

# Part A — Audit the existing character pipeline

Inspect before editing:
- `src/game/character.ts`
- `.github/workflows/android-play-runtime.yml`
- `ci/install_high_character.py`
- `ci/validate_android_character_glb.py`
- the source archive character paths
- any checked-in or generated character assets/scripts
- graphics tiers, shadows, camera framing and bundle budgets

Report what the archive-provided model actually contains when available:
- GLB size
- meshes/primitives
- skeleton/bone count
- materials/textures
- animation names
- morph targets

Do not silently call the current MakeHuman fallback "photoreal" if it is not.

Keep the existing procedural fallback operational for invalid/missing GLB.

---

# Part B — Art direction / reference standard

Character direction:
- fictional adult field operative
- believable facial planes and asymmetry
- natural head/neck/shoulder transition
- realistic hands, elbows, knees, feet and silhouette
- restrained contemporary tailored field clothing
- practical footwear/accessories only where visually useful
- grounded proportions; no superhero silhouette
- readable from the existing third-person shoulder camera

Reference standard:
- multiple licensed/admissible adult anatomy references
- front / profile / 3-quarter facial-plane study
- neutral full-body proportion reference
- clothing-fold/fabric material reference
- do not reconstruct one identifiable person's face

If repository/CI cannot legally obtain a truly improved original asset automatically, do not download random web models. Build the pipeline/contract and clearly report the asset-authoring dependency instead of fabricating provenance.

---

# Part C — Modeling / retopology contract

Document and support a Blender-compatible authoring/export path.

Target stages:
1. primary-form sculpt
2. clean game retopology
3. UV unwrap with consistent texel density
4. efficient material regions
5. deformation-friendly loops at shoulders, elbows, wrists, hips, knees, neck, eyes and mouth

Do not waste geometry on invisible micro-detail; pores belong mainly in normal/roughness maps.

Target a practical Android hero budget. Choose exact numbers after auditing the existing model, but report them explicitly.

Preferred runtime strategy:
- HERO/HIGH presentation asset or tier
- MOBILE/LOW reduced asset/LOD if it can be added without destabilizing the renderer

If clean automatic LOD switching is too risky in one milestone, ship one well-optimized model and document the second LOD contract for later.

---

# Part D — PBR skin / eyes / hair / wardrobe

Skin should read as human without looking plastic or waxy.

Support/validate where practical:
- baseColor/albedo
- normal
- roughness/metallic workflow appropriate to glTF
- AO where useful
- restrained detail normal only if worth the cost

Skin authoring should include subtle:
- pore-scale normal detail
- roughness variation
- pigmentation variation
- natural eye/lip region differences
- restrained capillary/vein color variation where appropriate

Do not bake strong lighting into albedo.

Android texture rules:
- no 8K
- do not default blindly to 4K
- prefer a justified 1K/2K strategy
- count/report texture dimensions and total image payload

Eyes:
- separate believable cornea/iris response only if material/mesh cost stays controlled
- avoid glowing or glass-marble eyes

Hair:
- avoid extreme transparent-card overdraw
- prefer a controlled modeled/card hybrid readable at third-person distance

Wardrobe:
- fabric must read through roughness/normal response, not painted highlights
- keep material count controlled

---

# Part E — Rigging / skin deformation

Standardize one humanoid skeleton compatible with the existing collider-driven movement.

Required hierarchy/deformation coverage:
- hips/pelvis
- spine/chest
- neck/head
- clavicles/shoulders
- upper/lower arms
- wrists/hands
- upper/lower legs
- ankles/feet

Finger bones are optional if cost is justified.

Test skin weights in:
- idle
- walk stride extremes
- run stride extremes
- crouch
- jump takeoff
- airborne/fall
- landing
- cover-adjacent/shoulder-camera turns

Reject severe:
- collapsing shoulders
- candy-wrapper wrists
- broken knees
- floating clothing
- visible limb clipping

Gameplay capsule/collision scale remains independent from render skeleton scale.

---

# Part F — Animation contract and runtime integration

Preserve current compatibility with idle/walk/run, but expand imported clip support.

Required canonical runtime states:
- idle
- walk
- run
- crouch_idle
- crouch_walk (or crouch_locomotion)
- jump_start
- airborne/fall
- landing

Optional if cleanly available:
- cover_idle
- cover_locomotion
- contextual turn/look additive

Do NOT add combat/takedown animation work.

Animation requirements:
- believable weight transfer
- minimal visible foot skating
- clean loop boundaries
- consistent root/origin convention
- in-place locomotion preferred because player movement is collider-driven
- no unexpected root-motion translation unless runtime explicitly consumes it

Extend `PlayerCharacter` in place:
- cache imported animation groups once
- map aliases to canonical states
- smooth transitions/crossfades where stable
- do not restart groups every frame
- missing optional clips gracefully fall back to idle/walk/run
- crouch/jump/landing animation changes must NEVER modify authoritative collision behavior

Preserve:
- RUN/JUMP/CROUCH
- cover integration
- landing/noise behavior
- shoulder camera target
- shadows
- graphics tiers

---

# Part G — Optional facial life layer

If compatible morph targets/bones exist, add a low-cost optional facial-life layer.

Initial allowed contract:
- blink or blink_left / blink_right
- subtle eye aim/movement if authored
- optional very subtle neutral jaw/mouth motion

Rules:
- no per-frame random jitter
- deterministic/low-frequency timing
- cache morph references once after load
- Reduced Motion may reduce nonessential micro-motion
- absence of facial targets must never crash or warn-spam
- document exact supported morph aliases

Do not build a dialogue/lip-sync system in this milestone.

---

# Part H — Stronger GLB validator

Upgrade `ci/validate_android_character_glb.py` from the current minimal mesh/skin/idle-walk-run check.

It should report/validate as much as practical without heavyweight dependencies:
- GLB v2 parse
- file size
- meshes / primitive counts
- POSITION accessor vertex counts and approximate triangle/index counts
- skins
- skeleton/bone/joint counts
- materials
- textures/images and embedded byte sizes; dimensions if straightforward to parse
- animation clip names
- required idle/walk/run compatibility
- optional expanded clip availability
- morph-target names/count where glTF metadata exposes them
- suspiciously excessive counts with clear budget warnings/errors

Do not reject a valid model merely because optional facial/crouch clips are missing; runtime fallback is allowed.

Validator output must be written into the Android build log so future character regressions are visible.

---

# Part I — Character provenance and packaging

Keep explicit asset provenance.

Current fallback is pinned CC0 MakeHuman/MPFB `suited.glb` from the existing installer. If replacing it:
- replacement must have documented redistribution rights appropriate for the repository/build
- pin source/version/hash when externally fetched
- never silently fetch an unpinned latest binary
- do not commit or redistribute restricted proprietary source assets

Prefer archive-provided original CUMA character when that asset has valid provenance.

Keep final runtime artifact path compatible:
`public/assets/characters/cuma_runtime.glb`

Ensure `dist/assets/characters/cuma_runtime.glb` is produced and Capacitor packages it into Android.

---

# Part J — Fallback and failure handling

If GLB loading/parsing fails:
- gameplay must still boot
- procedural fallback becomes visible
- collider and controls remain usable
- no half-imported invisible character state
- dispose/disable partial imported data safely if needed

If an optional animation/morph is absent:
- use a sensible fallback
- never crash

Do not make internet access a runtime requirement.

---

# Part K — Performance budgets

Measure/report:
- GLB bytes
- mesh count
- primitive count
- vertices/triangles
- skin/joint count
- material count
- image/texture count and dimensions where possible
- animation count
- morph-target count
- web bundle effect
- APK/AAB artifact delta

Rules:
- no scene-wide per-frame character scans
- no per-frame temporary animation/morph lookup arrays
- controlled skinned-mesh count
- controlled material count
- controlled transparent hair overdraw
- LOW/MEDIUM remain viable
- preserve all existing web bundle budgets

Character asset bytes may increase APK/AAB size, so report the exact delta rather than hiding it.

---

# Part L — Acceptance scenarios

1. Valid packaged character imports and procedural fallback is disabled only after a successful import.
2. Missing/corrupt GLB still boots with the procedural character.
3. Visual character scale matches the existing 1.72 m collider convincingly.
4. Idle/walk/run animation compatibility remains intact.
5. Crouch uses imported crouch animation when present and falls back safely when absent.
6. Jump/air/landing uses imported clips when present without changing gameplay physics.
7. Shoulder-camera view has believable head/neck/shoulder presentation.
8. Skin/material response under current outdoor/interior lighting does not read as flat plastic.
9. Clothing reads as fabric and does not produce severe clipping during locomotion.
10. Hands/elbows/knees/feet remain believable at motion extremes.
11. Directional cover/crouch do not create major body-wall clipping regressions.
12. LOW/MEDIUM graphics tiers still run the same gameplay systems and do not require a different controller.
13. Pause/background/resume does not corrupt imported animation state.
14. Missing optional face morphs/clips never crash.
15. Strong validator prints meaningful geometry/rig/material/animation stats in CI.
16. Android workflow includes the GLB in dist/APK/AAB and completes successfully.

---

# Preserve all gameplay work

Do not regress any verified system from Milestones 01–04:
- movement and multitouch
- RUN/JUMP/CROUCH
- authoritative noise/hearing
- directional cover and cover camera
- facility topology / doors / credentials
- CCTV/gadgets
- CALM/WATCH/SEARCH/HIGH_ALERT
- COVER STORY
- FIELD FOCUS
- mission progression/save
- graphics tiers
- Android lifecycle

Milestone 05 mission-graph work remains paused and must NOT be mixed into this character commit.

---

# Validation / delivery

Before committing:
- run `npm run build`
- fix TypeScript/Vite failures
- run the upgraded character GLB validator against the exact packaged asset
- confirm all bundle budgets green
- inspect `dist/assets/characters/cuma_runtime.glb`
- verify fallback behavior from code paths

Suggested gameplay commit:
`feat: upgrade hero character realism pipeline`

After push:
- dispatch `.github/workflows/android-play-runtime.yml` on `claude/full-game-development`
- verify final run status
- verify debug APK + Play AAB
- verify artifact upload and digest
- do not claim real-device visual quality or FPS from CI

Update `CLAUDE_CODE_HANDOFF.md` with:
- gameplay commit SHA
- character source/provenance/license status
- exact GLB source selected by CI
- GLB hash and size
- mesh/primitive/triangle/vertex stats
- joints/bones
- materials/textures
- animation contract and clips actually present
- morph targets actually present
- runtime animation changes
- fallback behavior
- bundle measurements
- workflow run ID/artifact size/hash
- real-device visual/performance checks still required
- note that Milestone 05 mission graph remains paused

Then STOP.
Do not begin mission-graph work or another milestone in the same implementation commit.
