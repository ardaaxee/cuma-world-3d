# Scalable visual foundation — first increment

The game targets a broad audience; no phone model is used to choose or cap quality.
The existing FX control now cycles LOW → MEDIUM → HIGH → ULTRA → LOW. Saved
ULTRA selections survive loading; existing selections and the MEDIUM default remain valid.

| Profile | MSAA | Mesh LOD threshold | Local shadow atlas |
| --- | --- | --- | --- |
| LOW | Off | 4 px | 1024 |
| MEDIUM | 2× | 2 px | 2048 |
| HIGH | 4× | 1 px | 4096 |
| ULTRA | 8× | 0.5 px | 4096 |

LOD affects meshes that actually have imported LODs; it does not simplify procedural boxes.
The local shadow atlas affects shadow-casting positional lights, not directional sun shadows.
Ultra is opt-in and has not been benchmarked on hardware. The Compatibility renderer remains
unchanged for Android and desktop; this is not a PC export or store publishing implementation.

Static production-home PBR surfaces now use world-space triplanar mapping and anisotropic
mipmap filtering, preventing box-UV stretching and reducing grazing-angle texture blur.
Existing albedo and normal assets are reused; no downloaded asset license is added.
Triplanar projection costs extra texture samples and needs hardware visual/performance review.
It is deliberately restricted to the static home material factory, not moving characters.

## Validation

After extracting the source ZIP to `game`, run `python ci/apply_ci_patches.py`.
The new patch is repeatable in isolation. Run:

```
cp ci/visual_foundation_test.gd game/ci_visual_foundation_test.gd
godot --headless --path game --editor --quit
godot --headless --path game --script res://ci_visual_foundation_test.gd
godot --headless --path game --quit-after 120
```

Locally verified with Godot 4.7.2: all four quality transitions and wraparound,
invalid-input rejection, viewport state, and production material texture loading.
Existing performance regression, material API regression and APK preflight checks passed.
Startup reached CUMA_BOOT_READY. The initially observed corrupt character was a truncated
local copy (2,097,152 bytes instead of 6,675,064). Reinstalling the pinned, hash-verified
asset restored a clean import. This does not establish that the upstream asset is corrupt.
The installer now validates the whole GLB and replaces the target atomically. The inspector
rejects incomplete binary chunks even when JSON metadata remains readable. Five regression
cases cover valid input, truncation, forged total length, out-of-bounds bufferViews and trailing data.
Shutdown still reports one resource in use; that separate issue is not fixed here.
No rendered before/after comparison, APK export, or physical device benchmark was performed.

Next art milestone: curated detailed furniture/architecture meshes, bevels and authored
roughness maps, followed by day/night reference captures and Android/PC frame-time budgets.
These code changes alone do not constitute photorealism.

API references:
- https://docs.godotengine.org/en/stable/classes/class_viewport.html
- https://docs.godotengine.org/en/stable/classes/class_basematerial3d.html

## Furniture edge pass

Production furniture panels at least 7 cm thick now use a cached beveled mesh, with up to
12 mm edge radius clamped to panel thickness. Thin trim and rugs retain their original boxes.
Outer dimensions, placement and collision remain unchanged. Each beveled panel is 108
triangles, one surface/draw call; equal dimensions share one mesh. This is a modest geometric
edge treatment, not an authored high-detail furniture replacement.
Runtime tests verify dimensions, clockwise face winding, no degenerate triangles and mesh reuse.

Visual Audit now runs on pull requests and checks the new runtime and GLB regressions before
capturing rooms and the high-detail character. Import failures now fail the gate explicitly.
Local graphical capture is unavailable because this executor cannot open X display sockets;
headless import and geometry tests passed, but appearance still requires the CI images.
