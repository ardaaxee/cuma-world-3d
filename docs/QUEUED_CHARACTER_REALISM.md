# QUEUED TASK — Realistic Hero Character Production Pipeline

This task is queued behind the currently active Milestone 05. Do NOT replace or interrupt `docs/CLAUDE_NEXT_TASK.md` until Milestone 05 has been implemented and verified, unless ChatGPT explicitly reprioritizes it.

## Goal

Replace the current procedural-looking hero presentation with an original, believable adult human character pipeline suitable for a cinematic contemporary spy-thriller, while preserving CUMA WORLD's Babylon.js + Capacitor Android runtime and mobile performance budgets.

The player character must remain an original CUMA WORLD character. Do not copy the likeness, costume, face, body, animation, or identity of James Bond, an actor, a real person, or another game's proprietary character.

Use only reference material that is licensed/owned/allowed for the project. If real-human references are used, treat them as anatomy/material study rather than identity replication.

The project does NOT use Unreal Engine or Unity. The engine target is Babylon.js. The production path is:

reference -> sculpt/model -> retopology -> UV/textures -> rig/skin -> animation -> glTF/GLB export -> Babylon.js runtime.

---

# Part A — Inspect the existing runtime first

Before changing anything, inspect:

- `src/game/character.ts`
- the character asset packaging/build path
- `.github/workflows/android-play-runtime.yml`
- any existing `assets/characters` directory or character-generation scripts
- shadow setup, graphics profiles, and Android bundle budgets

Preserve the existing authoritative player collider and movement logic.

Current runtime already supports an imported `./assets/characters/cuma_runtime.glb` and looks for animation groups matching idle / walk / run. Extend that path; do not create a second player controller.

Procedural fallback must remain available if the GLB is missing or invalid.

---

# Part B — Character art direction

Create an ORIGINAL fictional adult field operative with grounded proportions and contemporary wardrobe.

Direction:
- believable adult facial anatomy
- asymmetry and natural variation rather than a perfectly symmetrical synthetic face
- realistic head/neck/shoulder transitions
- anatomically believable hands, fingers, knees, elbows, feet and silhouette
- contemporary tailored field clothing that fits the CUMA WORLD visual language
- practical materials, restrained colors, no superhero silhouette
- readable from the current third-person shoulder camera

Do not pursue exaggerated body ideals. Optimize for believable anatomy, silhouette, deformation quality and game readability.

Reference process:
- use multiple licensed/admissible adult-human anatomy references
- study front / 3-quarter / profile facial planes
- study neutral full-body proportion and clothing folds
- do not reproduce one real person's identity

---

# Part C — Modeling / sculpting pipeline

Preferred authoring workflow may use Blender and/or ZBrush externally, but the repository should document a Blender-compatible finalization/export path.

Target stages:
1. high-resolution sculpt for primary forms
2. clean game retopology
3. UV unwrap with sensible texel density
4. separate logical material regions only where useful
5. skinning-ready topology around shoulders, elbows, knees, hips, neck, eyes and mouth

Avoid unnecessary geometry that is invisible at gameplay distance.

Provide at least two runtime LOD targets if the asset pipeline can support them cleanly:
- HERO/HIGH: close third-person presentation
- MOBILE/LOW: reduced geometry/material cost

If automatic LOD switching would destabilize the current runtime, prepare the asset contract and keep a single optimized model for this milestone rather than building a second renderer.

---

# Part D — Realistic skin and material authoring

The skin should read as human through physically plausible material variation, not through excessive geometry.

Recommended texture channels where supported by the final GLB/Babylon material path:
- base color / albedo
- normal map for pores and micro-surface breakup
- roughness
- ambient-occlusion detail where appropriate

Optional only if the current Babylon pipeline can use them without large cost:
- subtle subsurface/translucency approximation
- detail normal

Skin treatment should include restrained:
- pore scale variation
- roughness variation
- subtle pigmentation variation
- faint capillary/vein color variation where naturally appropriate
- eye-region and lip material differences

Do not bake dramatic lighting into albedo.
Do not use ultra-high-resolution textures by default on Android.

Propose tier-aware texture sizes, with a practical mobile target such as 1K/2K rather than blindly shipping 4K/8K maps.

Wardrobe materials should also use coherent PBR values for fabric, leather/rubber/metal details where present.

---

# Part E — Rigging and deformation

Create/standardize a humanoid skeleton suitable for the existing movement system.

Required deformation quality:
- hips/spine/chest/neck/head
- clavicles/shoulders
- upper/lower arms and hands
- upper/lower legs and feet

Preferred optional finger bones if cost is acceptable.

Skin weights must be tested in:
- neutral idle
- walk stride extremes
- run stride extremes
- crouch
- jump takeoff / airborne / landing poses
- shoulder-camera turning poses

Avoid collapsing shoulders, candy-wrapper wrists, broken knees, floating clothing or severe clipping.

Keep the gameplay collider independent from render skeleton scale.

---

# Part F — Facial rig / life layer

Do not require a full dialogue system yet.

If the model contains facial morph targets or bones, add an OPTIONAL low-cost facial-life layer in the existing `PlayerCharacter` implementation or a small character-owned helper.

Safe initial set:
- blink left/right or combined blink
- subtle eye aim/eye movement if the asset supports it
- jaw/mouth neutral micro-motion only if naturally authored

Rules:
- no per-frame random jitter
- use deterministic/low-frequency timing
- Reduced Motion may reduce nonessential facial/head micro-motion
- if the asset has no compatible facial targets, runtime must degrade gracefully with no error

Document the required morph-target names or mapping contract instead of assuming a proprietary rig.

---

# Part G — Animation set

Current runtime resolves imported animation groups by name. Expand the animation contract while preserving compatibility.

Required clips:
- idle
- walk
- run
- crouch idle
- crouch locomotion
- jump start
- airborne/fall
- landing

Nice-to-have if available without destabilizing scope:
- cover idle
- cover locomotion
- contextual turn/look additive

Do not add graphic combat/takedown animation work in this task.

Animation requirements:
- believable weight transfer
- feet should not visibly skate at normal gameplay speed
- clean loop boundaries
- consistent root/origin convention
- no huge unexpected root motion unless runtime explicitly consumes it

Prefer in-place locomotion for compatibility with the current collider-driven movement.

Extend `character.ts` so missing optional clips gracefully fall back to existing idle/walk/run behavior.

---

# Part H — GLB export contract

Final runtime artifact:

`public/assets/characters/cuma_runtime.glb`

(or the exact existing packaged path after inspection).

Export requirements:
- glTF 2.0 / binary GLB
- meters / consistent scale
- Y-up compatible final result for Babylon.js
- embedded or correctly packaged textures according to the current build pipeline
- one clean root hierarchy
- named animation groups following the documented contract
- no editor-only helpers/cameras/lights
- remove unused meshes/material slots/animation tracks

Create a validation script if practical that reports:
- file exists
- GLB parses
- triangle/vertex counts
- texture count and approximate dimensions when available
- animation clip names
- skeleton/bone count
- morph-target names
- file size

Validation failure should fall back to the procedural character instead of breaking game boot.

---

# Part I — Babylon.js integration

Extend the existing import path in `src/game/character.ts` rather than replacing the class.

Requirements:
- keep the authoritative capsule collider
- imported render skeleton follows `visualRoot`
- preserve shoulder camera target
- preserve directional cover integration
- preserve RUN/JUMP/CROUCH controls
- preserve landing/noise logic
- preserve shadows
- preserve graphics tiers
- imported animation selection should support the expanded locomotion states
- smooth transitions/crossfades where Babylon AnimationGroup architecture allows without instability
- missing clip names must have sensible fallback

Avoid restarting animation groups every frame.

If morph-target facial life is implemented, cache target references once after GLB load.

---

# Part J — Mobile performance budget

This is an Android-first game.

Do not accept a photoreal asset that destroys runtime performance.

Measure/report:
- GLB size
- rendered mesh count
- triangle/vertex count
- bone count
- texture count/resolution
- animation count
- bundle/artifact delta

Performance rules:
- no 8K textures
- avoid excessive transparent hair cards/material overdraw
- keep skinned mesh/material count controlled
- no per-frame scene-wide character scans
- no per-frame creation of temporary arrays/vectors for facial/animation updates where avoidable
- LOW/MEDIUM must remain viable

If realistic hair is too expensive, prefer a carefully modeled/groom-card hybrid that reads well from third-person distance.

---

# Part K — Visual acceptance scenarios

1. Imported character loads correctly from a clean install and replaces the procedural fallback.
2. If the GLB is missing/corrupt, procedural fallback still boots and gameplay remains usable.
3. Character scale matches the current 1.72 m gameplay collider visually.
4. Walk/run/crouch/jump states do not change collision behavior.
5. Shoulder-camera view shows believable head/neck/shoulder anatomy without obvious clipping.
6. Skin reads as PBR skin under current daylight/interior lighting without looking plastic or waxy.
7. Clothing reads as fabric rather than painted geometry.
8. Hands/feet/knees/elbows remain believable in locomotion extremes.
9. Cover poses and crouch do not create severe body-wall clipping.
10. LOW/MEDIUM do not suffer an unacceptable character rendering cost.
11. Android pause/background/resume does not restart or corrupt the skeleton/animations.
12. Missing optional facial morphs/animation clips never crash runtime.

---

# Part L — Validation and delivery

Before gameplay commit:
- run `npm run build`
- clean TypeScript/Vite result
- keep all existing bundle budgets green
- validate packaged character asset path
- inspect generated Android packaging to ensure the GLB is included

Run the Android workflow for the exact gameplay commit and verify:
- run final status
- debug APK
- Play AAB
- artifact upload
- artifact hash

Do NOT claim real-device visual/FPS quality from CI.

Suggested gameplay commit:
`feat: upgrade hero character realism pipeline`

Update `CLAUDE_CODE_HANDOFF.md` with:
- character asset source/license status (without embedding restricted third-party assets)
- modeling/retopo assumptions
- GLB file size
- mesh/triangle/bone/texture stats
- animation clip contract
- facial morph contract if present
- runtime fallback behavior
- build/bundle measurements
- workflow run ID/artifact result
- real-device checks still needed

Then STOP. Do not begin the next milestone in the same implementation commit.
