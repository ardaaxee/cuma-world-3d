# CUMA WORLD — Hero Character Pipeline

The contract between whoever authors the hero character and the Babylon.js
runtime that has to ship it on Android.

Two things enforce this document:

- `ci/validate_android_character_glb.py` — rejects a GLB that breaks the contract
- `src/game/character-animation.ts` — resolves authored clip names at load

They share one alias table. **If you change a name in one, change it in both.**

---

## 1. Current state — measured, not assumed

Audited 2026-08-29 against the asset CI actually packages.

The source archive contains **no** character GLB (only
`assets/characters/README.md`), so every CI run falls through to the pinned CC0
fallback in `ci/install_high_character.py`:

| | |
|---|---|
| Source | `kunalkushwaha/vsim@3f97faf…/packages/assets/library/suited.glb` |
| Provenance | MakeHuman / MPFB 2, CC0 public domain |
| sha256 | `7b5ff9d323b3bea72eddc2faac3ea3ec8f40232acfa2318692ee30efbc202508` |
| GLB bytes | 6,675,064 |
| Generator | Khronos glTF Blender I/O v4.5.51 |
| Meshes / primitives | 3 / 3 |
| Vertices / triangles | 19,166 / 35,492 |
| Skins / joints | 1 / 53 |
| Materials | 3 |
| Images | 5 × 1024×1024 PNG (5,296,760 B — 79% of the file) |
| Animations | 4 — `idle`, `run`, `walk`, `wave` |
| Morph targets | 0 |

**This is a fallback, not the target-quality hero.** It has no crouch, jump,
fall, landing or cover clips, no facial morph targets, and a 53-joint rig with
no finger bones. The runtime degrades gracefully on all of that (§6), but a
believable field operative still has to be authored. See §8.

---

## 2. Art direction

An **original** adult field operative. Not James Bond, not an actor, not any
real person's likeness, not another game's character.

Real-human reference is for **anatomy, skin and material study only** — never
identity replication.

- believable adult facial anatomy, with asymmetry rather than a mirrored
  synthetic face
- honest head/neck/shoulder transitions — this is what the shoulder camera sees
- anatomically plausible hands, elbows, knees, feet
- contemporary tailored field clothing; practical materials, restrained colour
- no superhero silhouette, no exaggerated body ideal
- silhouette must read at third-person shoulder distance on a phone screen

## 3. Production path

The engine is **Babylon.js**. Not Unreal, not Unity.

```
reference → sculpt → retopology → UV → PBR texture → rig/skin → animation → GLB → Babylon
```

1. **Sculpt** primary forms at high resolution (Blender and/or ZBrush).
2. **Retopologise** to a clean game mesh. Loops that actually deform: shoulders,
   elbows, knees, hips, neck, eyelids, mouth.
3. **UV unwrap** at consistent texel density. Split material regions only where
   they earn it — every extra material is another skinned draw call.
4. **Texture** to §4.
5. **Rig and skin** to §5.
6. **Animate** to §6, in place.
7. **Export** GLB to §7 and run the validator locally before pushing.

Delete anything invisible at gameplay distance. Blender is the expected
finalisation and export environment regardless of where the sculpt happened.

## 4. Materials and textures

Skin should read as human through **material variation, not geometry density**.

Channels: base colour, normal (pores and micro-surface), roughness, and AO
detail where it helps. Subsurface approximation and detail normals are optional
and only if they stay cheap.

Restrained variation in: pore scale, roughness, pigmentation, faint capillary
colour, and distinct eye-region and lip materials. Wardrobe gets coherent PBR
values for fabric, leather, rubber and metal trim.

**Do not** bake dramatic lighting into albedo.

### Texture budget

| Resolution | Status |
|---|---|
| 8192 | **forbidden** |
| 4096 | **rejected by CI** — Android gains nothing here |
| 2048 | allowed for the skin/face atlas; CI warns |
| 1024 | the default for everything else |

The baseline ships entirely at 1K and looks acceptable. Reach for 2K only on
the face, and only with a reason.

The runtime sets `environmentIntensity` to 0.72 on imported PBR materials so the
hero sits in the same light as the rest of the scene. Nothing else about an
authored material is touched.

## 5. Rig contract

A humanoid skeleton. Required deforming joints:

- hips → spine → chest → neck → head
- clavicles and shoulders
- upper/lower arms, hands
- upper/lower legs, feet

Finger bones are preferred where the joint budget allows.

Skin weights must be checked in neutral idle, walk and run stride extremes,
crouch, jump take-off / airborne / landing, and shoulder-camera turns. Watch for
collapsing shoulders, candy-wrapper wrists, broken knees, floating cloth.

**The render skeleton never drives collision.** Gameplay collision is the
1.72 m × 0.34 m capsule in `character.ts` and is independent of rig scale.

## 6. Animation contract

Clips are matched by **name**, case-insensitively, with `-`, `.`, `|` and spaces
normalised to `_`. Matching runs most-specific-first and each clip is claimed
once — so `crouch_walk` is never mistaken for `walk`.

| Tier | State | Accepted aliases |
|---|---|---|
| **Required** | `idle` | idle, stand, breath, rest |
| **Required** | `walk` | walk, locomotion |
| **Required** | `run` | run, sprint, jog |
| Supported | `crouch_idle` | crouch_idle, crouchidle, crouch, sneak_idle |
| Supported | `crouch_walk` | crouch_walk, crouchwalk, crouch_locomotion, sneak_walk, sneak |
| Supported | `jump_start` | jump_start, jumpstart, takeoff, jump |
| Supported | `airborne` | airborne, falling, fall, inair, air |
| Supported | `landing` | landing, land, touchdown |
| Optional | `cover_idle` | cover_idle, coveridle, cover, wall_idle |
| Optional | `cover_locomotion` | cover_locomotion, cover_walk, cover_move, wall_walk |

**Only the three Required clips are enforced.** A GLB without them is rejected
and the game boots the procedural fallback instead.

Everything else degrades along a fallback chain that always terminates at
`idle`:

```
run              → walk → idle
crouch_idle      → idle
crouch_walk      → crouch_idle → walk → idle
jump_start       → airborne → idle
airborne         → jump_start → idle
landing          → crouch_idle → idle
cover_idle       → crouch_idle → idle
cover_locomotion → crouch_walk → walk → idle
```

`jump_start` and `landing` play once; everything else loops. States crossfade
over 0.18 s via animation-group weights.

Authoring rules:

- **in place** — the collider drives movement, so root motion is not consumed
- believable weight transfer; no visible foot skate at gameplay speed
- clean loop boundaries
- one consistent root/origin convention across every clip
- no combat or takedown animation in this contract

**Animation never drives physics.** The jump arc, gravity, collider dimensions
and crouch speed are decided before a clip is chosen, and no animation state
writes back to them.

## 7. Facial life contract — optional

If the mesh carries morph targets, the runtime picks up a small deterministic
life layer: blinks, plus a slow gaze drift when eye targets exist.

| Role | Accepted target names (case/punctuation insensitive) |
|---|---|
| Blink | blink, eyesClosed, eyeClose |
| Gaze up / down | eyeLookUp / eyeLookDown, eyesUp / eyesDown |
| Gaze left / right | eyeLookLeft / eyeLookRight, lookIn / lookOut |

No dialogue system, no lip-sync, no per-frame randomness — the timing comes from
a fixed cadence table, so the same second of gameplay always produces the same
face. Gaze influence is capped at 0.22. Reduced Motion parks the gaze and slows
blinking.

**An asset with no morph targets is a supported, silent no-op.** The current
fallback has zero, and that must never produce an error.

## 8. Export and validation

Final packaged path: `public/assets/characters/cuma_runtime.glb`
(CI writes it; it is gitignored, never committed).

Export requirements: glTF 2.0 binary, metres, Y-up, one clean root hierarchy,
embedded textures, named animation groups per §6, no editor-only cameras,
lights or helpers, and no unused meshes, material slots or animation tracks.

Validate before pushing:

```sh
python3 ci/validate_android_character_glb.py path/to/character.glb
```

It prints a `CHARACTER REPORT` and enforces:

| Budget | Ceiling | Baseline |
|---|---|---|
| GLB bytes | 24 MB | 6.7 MB |
| Triangles | 120,000 | 35,492 |
| Vertices | 90,000 | 19,166 |
| Meshes | 16 | 3 |
| Primitives | 32 | 3 |
| Materials | 12 | 3 |
| Images | 24 | 5 |
| Joints | 120 | 53 |
| Texture edge | 2048 (warn above 1024) | 1024 |

Ceilings are roughly 2–3× the measured baseline: room for finger bones, hair
cards, eyes and separate wardrobe pieces, but not for a desktop-class asset.

A validation failure fails CI. A GLB that fails at *runtime* falls back to the
procedural character rather than breaking boot.

## 9. Runtime fallback behaviour

`PlayerCharacter` builds the procedural character first, then tries to import
the GLB over it. The procedural parts are only disabled once the import has
**fully** succeeded — mesh present, required animation states resolved.

Any failure — missing file, corrupt container, absent required clips, an error
part-way through — disposes whatever was imported, clears the animation cache
and the facial layer, and re-enables the procedural character. The player is
never left looking at nothing.

Animation groups are resolved into a `Map` **once**, at load. Nothing searches
the scene or matches a name per frame, and a clip is only started when the state
actually changes.

## 10. Still outstanding

An authored hero meeting §2 does not exist in this repository. Producing one
needs sculpting, texturing and animation work outside CI's reach — CI can only
verify and package what it is given.

Until such an asset is committed to the source archive as
`assets/characters/cuma_high.glb`, CI will keep packaging the CC0 MakeHuman
fallback, and the game will keep looking like the fallback.

**Asset-authoring dependency remains.**
