# Execute goal 08: art direction, stylisation and VFX per demo

## Prerequisites

Complete [execute goal 07](execute-goal-07.md) first — every item here consumes the HDR scene target,
the shadow map, the single tone-map or the bloom stage that goals 06 and 07 built. Complete goal 05
too: it owns items 1–9 of `03-ART-DIRECTION-AND-VFX.md` §7 (triplanar projection, material-ID
routing, detail normals, SH-9 irradiance, ramp LUT, rim and sheen, catalog material intake, textured
soft billboards, and the first VFX timing pass), none of which need the HDR buffer.

This goal is **the remainder** of that document: items 11 through 18, the per-demo art-direction
briefs in §6, the frame-level value targets in §7.1, and every part of the VFX system that could not
be built before bloom existed. Item 10 (directional key plus shadow map) was delivered by goals 06 and
07 — verify it, do not rebuild it. Where goal 05 already satisfied AC-V1 through AC-V4 for a demo,
**re-verify them against the HDR pipeline rather than re-implementing them**.

All four demos now have a capture in `evidence-captures/`. **Look at
`antiky-town-canvas.png` before planning any of its work** — the brief below was corrected against it
and reads very differently from what its source suggested.

## `/goal` objective

Give each demo a committed look, and give all four a VFX system that emits light instead of pasting
decals.

Three of the four demos need a look built from nothing: `point-light-expo` → League of Legends,
`combat-arena` → Rocket League, `traversal-study` → LittleBigPlanet. The honest realistic tier is
best-in-class stylised — Astro Bot, Untitled Goose Game, Monument Valley — reached through lighting,
grading and timing, not polygon budgets.

**`antiky-town` is not in that group, and treating it as though it were is the main way this goal can
go wrong.** Its capture is a different class of image from the other three: real directional cast
shadows falling across the plaza and off every roofline, a genuine sky gradient from deep blue zenith
to a warm horizon with the sun visible behind the ridge, warm-lit faces against cool shadowed ones,
atmospheric depth, textured plaster and timber and tile rather than flat instance tints, and a
composed frame with the buildings framing a plaza and a path leading the eye in. It is the proof that
this stack can produce the target tier — the other three demos are not limited by BroMetal, they are
limited by not having done this work.

So `antiky-town`'s brief is **targeted repair, not a rebuild**: the three weak areas the owner named —
grass, trees, water — plus two cheap frame-wide wins that build nothing new, softening the shadow
penumbra and turning up the depth-of-field and vignette the demo already owns. Everything else in that
frame is working and must be left alone. Do not carry the other demos' remediation across out of
symmetry.

It remains the repository's only **2.3D** artifact — the die-cut sprite characters in a voxel world
are the whole point — so this work is also what gives ADR 0004's equal-support-for-2D-3D-2.3D
commitment real evidence.

The VFX half matters more than the shader half. Every effect in the three smaller demos is an
untextured analytic primitive with a sine-modulated alpha, and **every one of them breathes on a
single shared metronome**: `combat-arena/src/shaders/arena-glow.shader.ts:51` applies
`sin(uTime * 5 + iPhase * 2.3) * 0.18` to every instance's alpha and
`traversal-study/src/shaders/traversal-glow.shader.ts:49` does the same at 4.8 rad/s. Both
phase-offset per instance and share one frequency, which is the same periodicity defect diagnosed in
the camera shake — continuous periodic motion reads as malfunction, not as energy.

## Required outcome

When the work is complete:

1. **A written, committed art-direction brief per demo** — palette strategy, value structure,
   key/fill/rim, material language, VFX language, camera and composition — each citing the capture it
   was written against, and each with the measured value targets it must hit.
2. **Every demo meets its frame-level value target** from §7.1, measured as Rec.709 luma of the
   sRGB-encoded output over the whole canvas:

   | Demo | P5 ≤ | P50 in | P95 ≥ | P95−P5 ≥ | Clipped (≥0.995) ≤ |
   |---|---|---|---|---|---|
   | `point-light-expo` | 0.05 | 0.18–0.32 | 0.80 | 0.72 | 2.0% |
   | `combat-arena` | 0.04 | 0.20–0.34 | 0.88 | 0.80 | 2.5% |
   | `traversal-study` | 0.12 | 0.38–0.52 | 0.90 | 0.72 | 1.5% |
   | `antiky-town` | measured from its current capture and locked as a **regression guard** |

   Plus, for all four: **≥ 3 distinguishable hue clusters** (peaks ≥ 25° apart with a valley ≥ 25%
   below the lower peak) and **no single hue cluster over 55%** of chromatic pixels.

   `antiky-town`'s row is different in kind from the other three. Its frame already has the value
   structure and hue spread the others are chasing, so its numbers are **measured from what it does
   today and locked so this goal cannot make it worse** — a floor, not a target. If a measurement
   comes back outside the others' general shape, verify it against the capture before writing it down.
3. **A VFX system, not a set of shaders**: soft-edged additive billboards, flipbook sheets, ribbon
   trails, distortion, projected decals, and — the part the doc set omits and that matters most —
   **timing and animation curves**.
4. **The shared metronome is gone.** No `*.shader.ts` under `packages/demos/antiky/*/src/**` applies a
   `sin`/`cos` of `uTime` to an output alpha without a per-instance frequency term.
5. **`traversal-study`'s emissive VFX can bloom.** Its single glow program is created with
   `blend: 'alpha'` (`traversal-study/src/renderer.ts:150`), and alpha-blended output cannot exceed
   1.0, so those effects can **never** bloom no matter what the post chain does. Split the emissive
   effects — checkpoint glow, delivery pulse — into an additive batch.
6. **`antiky-town`'s grass, trees, water and shadow penumbra repaired** against measured criteria (see
   below), with the rest of that frame demonstrably unchanged.
7. **The named per-demo art defects are fixed**, each with a before/after capture.
8. **Items 11, 13, 14, 15, 16, 17 and 18** of `03-ART-DIRECTION-AND-VFX.md` §7 landed with their
   stated acceptance criteria, or explicitly deferred with the measurement that made them not worth
   the cost.

## In scope

**Per-demo art fixes, read directly off the captures.**

- `point-light-expo`: the ground is a hard-edged quad floating in a black void — an 18×12.8 plane at
  `src/renderer.ts:75-80` whose crisp trapezoid corners cut against pure black, with no horizon and no
  backdrop, and fog that cannot eat the edge because `fog.maximumMix` is 0.34. Add a horizon and a
  backdrop, and let fog consume the plane boundary. The light orbs are **faceted low-poly spheres**
  (`src/renderer.ts:117`, 12×8 segments — you can count the polygon edges on the pink and orange
  orbs); replace them with soft textured billboards with a white-hot core and a coloured halo. Relay
  rings become soft expanding shockwave meshes with a taper, not 8-segment tori
  (`src/renderer.ts:107-110`). Take the saturation off the rocks and put it in the falloff. Re-skin
  the `PRISM FRACTURED` overlay — a 1px red border with terminal type reads as debug output.
- `combat-arena`: the whole frame sits in a **15–35% luminance band**; widen it to genuine near-black
  in the off-arena space and blown highlights on ship specular and goal glow. The floor is matte where
  Rocket League's reflects the stadium — planar reflection (item 15) is the single technique that most
  separates this capture from its reference, and the deck is one flat plane at a known Y, which makes
  it cheap. Impose scale and rotation discipline on the rim props: they are currently mismatched-scale
  debris, including **yellow squiggle cables** looping the perimeter that are a third saturated hue
  competing with both team colours — delete them. Commit the camera; 46.8° FOV at 13.4 units is a
  diagram, neither a tactical read nor a cinematic chase.
- `traversal-study`: the sky is literally `clearColor: [0.38, 0.57, 0.68]` (`src/renderer.ts:297`) —
  replace it with a gradient carrying a warm horizon, plus aerial perspective so distance reads.
  **~60% of the frame is dead sky** and the bottom-right quadrant is empty; fix the composition. The
  HUD is a cluster of coloured 3D boxes floating in mid-air, drawn as world-space cubes
  (`src/renderer.ts:332`) — move it out of the world or commit to it as diegetic on a physical object.
  Shade the clouds with wrapped diffuse and a warm back-scatter term.

**`antiky-town` — grass. The owner's word is "horrid", and the capture agrees: it is the worst element
in an otherwise strong frame.**

Files: `src/town/art/town-foliage.ts` (671 lines), `src/town/shaders/town-foliage.shader.ts` and its
paired `town-foliage-shadow.shader.ts`, with placement authored in `src/town/art/town.ts`.

The field at lower-left is the clearest case: identical tufts at near-uniform spacing, all one scale,
one hue, one orientation. It reads as a single stamp repeated hundreds of times, and there is no
transition anywhere grass meets path, wall or water — the field simply stops.

The mechanical cause is placement, not shading. `scatterTownClutter` (`src/town/art/town.ts:1645-1659`)
walks a **fixed 2 m lattice** with a row-parity offset, rejects a cell when `hash(seed) < 0.16`, and
plants at the exact grid point — `grassCluster` (`:1601-1603`) places the blade at `gx, gz` with no
sub-cell jitter. Reeds are on a fixed 3 m stride along both canal banks (`:1662-1668`). A uniform
lattice with 16% dropout reads as a lattice, because the eye finds the rhythm immediately.

Cover, with criteria: per-instance scale, rotation and hue jitter wide enough to defeat pattern
recognition; density **clustering** — patch centres with falloff — replacing uniform scatter; slope-
and curvature-aware placement, with grass in flats and concave collectors and none on steep faces; a
soft exclusion falloff near paths and structures so the field feathers out instead of stopping; a
**second taller blade variant** mixed among the shorter so the meadow has a profile; and
distance-based density falloff. Keep the existing paved-route, canal and collider exclusions at
`town.ts:1654` — those are correct.

**Chesterton's Fence.** `town-foliage.ts:96-115` deliberately adds one offset companion clump to turn
isolated atlas cutouts into a continuous meadow edge, and `:120-140` adds two branch silhouettes so a
crown does not read as one flat card. Both carry comments explaining why. Keep the intent; replace the
mechanism only if the replacement measurably beats it.

**`antiky-town` — trees. Too few, and stylistically inconsistent with each other and with the
buildings.** The tall thin ones at left carry sparse flat foliage clumps; the lollipop on the right
ridge is plainly a different species. Neither matches the care visible in the half-timbered buildings
beside them. Foliage has no translucency, so every canopy reads dark and solid — and **the tree
silhouetted directly against the sun on the right ridge is not rim-lit**, which is the single most
obvious missed opportunity in the frame, because the light is already there and pointing at it.

Cover: one coherent species set with a stated silhouette language; a subsurface/translucency
approximation for backlit foliage (wrapped diffuse plus a warm back-scatter term is enough, and needs
nothing BroMetal lacks); rim lighting on canopies; more trees, placed with the same clustering rules
as the grass; and wind motion that is **not** on a shared metronome — per-instance frequency derived
from a position hash, not `uTime` alone.

**`antiky-town` — water. Flat opaque cyan.** Files: `src/town/art/town-water-features.ts` (579 lines),
`src/town/shaders/town-water-features.shader.ts` (254 lines), `src/town/shaders/town-water.shader.ts`.

The canals read as a solid band of painted plastic dropped between the stone walls: no transparency,
no depth gradient, no reflection, no flow, no edge foam, no specular. The fountain jets are hard-edged
solid geometry — no spray, no droplets, no mist.

Cover: scrolling/flowing normals in at least two layers at different rates and scales, so the surface
never reads as one sliding texture; depth-based colour and opacity so shallows differ from deeps;
shoreline foam where water meets the voxel bank and around obstructions; refraction and distortion of
what is under the surface, now affordable because the HDR scene target exists; sky reflection and a
real specular response; and **particle-based fountain spray** — droplets and mist replacing the solid
jet geometry, which is a direct application of the billboard and timing work below.

**The constraint that shapes the water, stated plainly: BroMetal cannot sample a depth attachment.**
That normally blocks depth-based water colour, depth-based opacity and soft shoreline blending
outright. This demo already solved it — the water shader **deliberately does not alpha blend** and
writes linear camera distance into the scene target's alpha channel instead
(`town-water-features.shader.ts:48-49`, `town-water-features.ts:456`). That is the workaround: build
depth-driven colour, opacity and foam on top of the existing convention. Do not reach for a depth
prepass, and read that comment before changing anything. The existing foam term at
`town-water-features.shader.ts:186-241` is the starting point, not something to delete.

**`antiky-town` — soft shadows.** Not named by the owner, and worth doing anyway: the shadows are
present and correct but **hard-edged, with no penumbra**. Widening the PCF kernel on the existing
shadow pass, ideally with a penumbra that grows with receiver distance, is cheap and lifts the whole
frame. This is a change to the shadow lookup only — the shadow pass, its target and its resolution
switch all stay.

> **The grade exclusion below was written against a capture that no longer exists.** Goal 04 added
> the sRGB decode, which dropped `antiky-town`'s median frame luminance 28.5% because the old
> exposure of 1.1 had been calibrated against undecoded albedo. Exposure was re-derived to 1.45 in
> goal 04's follow-up, restoring the authored median of ~0.086 with the colour maths now correct.
> **That correction is done.** The exclusion still stands for everything else listed here — it is a
> ban on art-directing the grade, not on repairing a compensation that came off.

**What `antiky-town` does not need, and must not receive.** No sky replacement, no fog or aerial
perspective rework, no composition or camera pass, no value-range widening, no colour-grade rewrite,
no triplanar material reassignment on the voxel surface, props, awnings or buildings, and no new
lighting model. All of that is already working in the capture. Touching it spends effort to move a
frame that is ahead of everything else in the repository.

The one deliberate exception is the depth-of-field and vignette re-tune below, which changes no
lighting and builds nothing new — it turns up a pass the demo already owns.

**`antiky-town` — depth of field and vignette. Owner request, and this is a tuning task, not a
build task.** Both features are already fully implemented in `src/town/shaders/town-post.shader.ts`
— a real circle-of-confusion DOF with separate near and far dead zones around focus, silhouette
depth rejection, and eight shared ring taps, plus a `uVignette` term. **Do not rebuild any of it.**
It is turned down to the point of invisibility. Measured at `src/town/index.ts`:

| Uniform | Value | Effect |
|---|---|---|
| `uDofMaxRadius` (`:1020`) | `0.45` px desktop, `1.1` ambient, **`0` mobile** | a sub-pixel blur radius is no blur |
| `uDofStrength` (`:1021`) | `0.075` desktop, `0.24` ambient, **`0` mobile** | scales that radius down again |
| `uNearFocusRange` / `uFarFocusRange` (`:1017-1018`) | `12` / `18` desktop, `20` / `26` ambient | with `uDofTransition` `7`, nearly the whole town sits inside the in-focus band |
| `uVignette` (`:665`) | `0.085` desktop, `0.12` ambient | below the visible threshold |

**Do the arithmetic before tuning.** The shader computes
`coc = clamp(max(nearCoc, farCoc) * uDofStrength, 0, 1)` then `sampleRadius = coc * uDofMaxRadius`.
In play mode that is `0.075 x 0.45` = a **maximum blur radius of 0.034 pixels** — three hundredths
of a pixel, arithmetically incapable of being visible. `sampleRadius = max(uBloomRadius, ...)` means
the bloom radius dominates it regardless. Focus also tracks the camera-to-hero distance with 12/18
unit dead zones and a 7 unit transition, so nothing within roughly 19-25 units of the hero can blur
at all, which in this town is the entire scene. The owner reports both effects as absent in play,
and the numbers agree: these are off by about three orders of magnitude, not slightly low.

This is why the captured frame is uniformly sharp from foreground to horizon with no corner
falloff. The demo is a **miniature town diorama**, and a pronounced near/far falloff is precisely
what sells that read — the tilt-shift effect. It is the cheapest large win available in this demo.

Required: re-tune, do not re-engineer. Narrow the focus band so the foreground wall and the far
ridge both leave it, raise the blur radius into visible range, and raise the vignette until it
shapes the frame. Keep the existing dead zones so the **midground and characters stay
sample-for-sample crisp** — that is the stated intent of the pass and it is correct. Preserve the
`0` mobile path unless a measurement shows the cost is affordable.

Acceptance criteria:
- A probe on the far ridge has local contrast (luminance standard deviation inside the probe) of
  **≤ 40%** of a probe on the in-focus midground, and a foreground probe nearer than the focus band
  is **≤ 60%**, in the same capture.
- The midground character band changes by **≤ 2/255** mean per-channel against the pre-tuning
  capture. Blurring the characters fails this goal.
- Corner luminance is **10–25%** below centre luminance — present, not heavy-handed.
- No halo at silhouettes: across the roofline against sky, luminance is monotonic outward over
  **≥ 6 px**, proving the existing depth rejection still holds.
- Frame time increases by **≤ 15%** via `get_render_stats`. The ring taps already exist, so a
  larger radius must not add taps.

**VFX system, all demos.**

- **Soft additive billboards** replacing sphere and torus meshes: camera-facing quads sampling an
  authored VFX texture, with the camera right/up vectors as uniforms. Mind the blend coupling —
  BroMetal's additive is `(src-alpha, one)`, not `(one, one)`, so `combat-projection.ts:118` writing
  trails at `alpha: 0.42` silently scales their colour by 0.42. Either always write `a = 1` and put
  intensity in RGB, or make the coupling deliberate and commented.
- **Flipbook sheets** for explosions, smoke, splashes and dust, with sub-frame blending. Use **one
  small texture per effect type, not one shared atlas** — BroMetal generates a full mip chain for any
  texture not created with `filter: 'nearest'` and caps nothing, so atlas cells bleed at coarse mips.
- **Ribbon trails** replacing sphere chains. There is no line topology and `draw()` has no sub-range,
  so build a fixed-capacity ribbon of N quads fed from a CPU history buffer with unused segments
  collapsed to zero scale — the batch pattern already at `traversal-study/src/renderer.ts:414-419`.
- **Distortion / refraction** for heat haze, shockwaves, dashes and water: sample the HDR scene target
  at `targetUv(clip) + offset`, offset from a normal map or `vnoise3(vWorld)`.
- **Projected decals** with a real radial falloff, faded by an analytic plane distance — the arena
  deck, the platform tops (`courseTopAt(x, t)`), the reliquary floor and the town's water are all
  known surfaces, so this covers every visible intersection without a depth prepass.
- **Timing and curves — the part that actually reads as expensive.** Anticipation (a 60–120 ms tell;
  `combat-arena` has telegraph states in the simulation at `src/combat-projection.ts:126-135` and no
  tell in the frame), a 1–2 frame snap at impact, non-linear decay via `easeOutExpo` / `easeOutBack`,
  **separated curves** for scale, alpha, colour and rotation, secondary motion that outlives the
  flash, and de-synchronisation driven from a per-instance hash rather than `uTime` alone. Today
  `traversal-study/src/renderer.ts:434-435` drives scale and alpha both directly off `life`, so
  everything grows and brightens together and reads as one blob inflating.

**Ranked items.** 11 (point-light falloff, hot core, coloured bounce — `point-light-expo`), 13 (light
cookies / gobos), 14 (procedural world-space trim — `combat-arena`), 15 (planar reflection —
`combat-arena`, optionally the town's canal), 16 (ribbon trails), 17 (distortion pass), 18 (offline
normal-variance → roughness bake).

## Required tests and evidence

- **AC-V1 soft edges.** On a VFX-only capture with scene geometry suppressed, the per-pixel luminance
  gradient along every effect's outer boundary is **≤ 0.10 per pixel** — every effect falls off over
  **at least 10 pixels**. Today the ring VFX transition in 1–2 pixels.
- **AC-V2 timing.** A presentation-layer unit test, no rendering: drive one impact event and record
  emitted instance values per frame. Peak scale within **≤ 3 frames**; alpha at frame 10 **≤ 25%** of
  peak; Pearson correlation between the scale and alpha curves **< 0.9**; **≥ 2 distinct elements**
  with lifetimes differing by **≥ 1.5×**.
- **AC-V3 no metronome.** Static source test: zero hits for a `sin`/`cos` of `uTime` on an output alpha
  without a per-instance frequency term. `arena-glow.shader.ts:51` and `traversal-glow.shader.ts:49`
  both fail today.
- **AC-V4 textured VFX.** Every VFX program declares and samples at least one `sampler2D`. Today zero
  of the three glow shaders do.
- **AC-L3 falloff, `point-light-expo`.** A horizontal pixel line across a lit rock face through the
  point nearest a practical is monotonic decreasing away from the light for **≥ 80%** of samples with
  total falloff **≥ 2.5:1**; hue at the light centre within **12° of neutral**, hue at 60% of the
  light radius within **15°** of the authored hue.
- **AC-L5 planar reflection, `combat-arena`.** Reflected-signal luminance 1 m below a bright object is
  **≥ 0.25×** the object's own, decaying to **≤ 0.05×** by 4 m, with reflected hue within **20°** of
  the reflecting object — which distinguishes a reflection from a bloom smear.
- **AC-L7 shimmer.** Two captures with the camera translated 0.5 world units, registered by the known
  delta: 99th-percentile per-pixel luminance difference over the glossy-floor ROI **≤ 0.10**.
- **AC-L8 cookies.** Over the largest continuous ground ROI, the luminance histogram shows **≥ 3
  distinguishable modes** (peaks ≥ 0.06 apart with a valley ≥ 20% below the lower peak). All demos are
  unimodal today.
- **Grass placement, `antiky-town`.** Static tests over the generated instance list, no rendering
  needed, since placement is deterministic: the nearest-neighbour distance histogram is **not
  unimodal** and its coefficient of variation is **≥ 0.45** (a jittered lattice scores near zero); no
  two instances share an identical `(scale, yaw, tile)` triple above **2%** of the population; scale
  spans **≥ 2:1** between the 10th and 90th percentiles and at least two blade variants are present;
  mean density on surfaces steeper than the stated slope threshold is **≤ 10%** of mean density on
  flats; density within 1 m of a path or wall is **≤ 50%** of open-field density and falls off
  monotonically rather than stopping at a hard boundary; and every paved-route, canal and collider
  exclusion still holds — that last one is a regression test against `town-validation.test.ts`,
  written first.
- **Grass silhouette, `antiky-town`.** In a capture of the lower-left meadow ROI, the horizontal
  autocorrelation of the foliage alpha mask has **no peak above 0.3** outside lag zero. That is the
  mechanical test for "it no longer reads as one stamp repeated", and it is the same test the
  camera-shake work uses for periodicity.
- **Trees, `antiky-town`.** Backlit translucency: on a canopy ROI whose tree sits between the camera
  and the sun, mean luminance is **≥ 1.4×** the same canopy's luminance with the translucency term
  disabled, and its hue sits within **20°** of the sun colour rather than the canopy's own. Rim light:
  the 3-pixel band just inside a backlit canopy silhouette is **≥ 1.6×** the canopy interior — today
  it measures ≈1.0, which is the tree on the right ridge. Species coherence is a static test over the
  authored set: every tree instance resolves to a declared species in one committed table, and the
  count of distinct species is what that table says it is.
- **Wind de-synchronisation, `antiky-town`.** The foliage wind term is covered by AC-V3 — no
  `sin`/`cos` of `uTime` on foliage motion without a per-instance frequency derived from a position
  hash.
- **Shadow penumbra, `antiky-town`.** Across a designated shadow edge on the plaza, the luminance
  transition spans **≥ 6 px** where it currently spans 1–2, and a shadow edge cast from a higher
  occluder is measurably wider than one cast from a contact point. The acne and peter-panning bounds
  from goal 07 must still hold — softening must not reintroduce either.
- **Water, `antiky-town`.** Across a designated shoreline transect: colour and opacity vary
  monotonically with the depth recovered from the existing scene-alpha convention, with an end-to-end
  ratio **≥ 2:1**; a foam band is present within **≤ 12 px** of the waterline and is **≥ 1.5×** the
  luminance of open water; between two captures 0.5 s apart the flow field has moved (mean per-pixel
  difference over the water ROI **≥ 0.02**) without the surface translating as a rigid texture
  (cross-correlation peak of the two frames **< 0.9** at any single uniform offset); and a specular or
  sky-reflection highlight is present with a 95th-percentile luminance **≥ 2×** the water median.
- **Fountain spray, `antiky-town`.** The jets emit particles, proven by AC-V1 on the jet boundary —
  luminance gradient **≤ 0.10 per pixel**, where solid jet geometry transitions in 1–2 pixels — and by
  AC-V2 on the emitter's timing curves. At least two elements with different lifetimes are present
  (droplets and mist), satisfying AC-V2(d).
- **Nothing else in the town frame moved.** Outside the ROIs this goal owns — meadow, canopies, canal
  and fountain, shadow edges, and the depth-of-field and vignette regions — the mean per-channel
  difference against the pre-goal capture is **under 3/255**. This is the guard that keeps a targeted
  repair targeted, and it is the criterion that fails if someone "improves" the sky or the grade.
- **The water depth contract still holds** — the regression test from goal 07 still passes.
- **§7.1 value and hue targets met per demo**, plus each demo's W0.3 budget still green.
- **Additive-batch proof, `traversal-study`.** A designated emissive element's peak pre-tone-map
  radiance exceeds 1.0, and its bloom probe passes the ≥ 20% test from goal 07.
- Every change ends in a fresh capture the implementer actually looks at, with a committed
  `visual-metrics.json` sidecar. `npm test` green.

## Explicit non-goals

- Do not extract a shared render, material or VFX package. Goal 12 extracts `BroMetalRenderDriver`
  from goal 06's and goal 07's implementations; copy the forty-line blocks per demo instead.
- Do not accept any solution requiring screen-space derivatives — BroMetal's DSL has no `dpdx`, `dpdy`
  or `fwidth`, verified against `node_modules/brometal/dist/dsl/builtins.d.ts`. This blocks Toksvig and
  LEAN specular anti-aliasing; the offline roughness bake (item 18) and a per-material minimum
  roughness are the sanctioned substitutes, and the limitation is recorded, not worked around.
- Do not build a depth prepass, and do not replace `antiky-town`'s depth-in-alpha convention in order
  to get depth-based water. Build on it.
- Do not add SSAO or TAA, and do not chase specular IBL through a `sampler3D`. Do not build a new
  depth-of-field pass — `antiky-town` already has a real one and this goal only re-tunes it.
- Do not build a shared flipbook atlas. Do not re-UV any kit in Blender. Do not buy assets.
- Do not rebuild the shadow map, the tone-map or the bloom stage — goals 06 and 07 own them. On
  `antiky-town` the shadow work is a wider PCF kernel and nothing else.
- Do not rewrite `antiky-town`'s voxel mesher, character motor or town layout. Its grass, trees,
  water, shadow softness and depth-of-field tuning are in scope; its geometry, gameplay, sky, grade,
  composition and materials are not.
- Do not write an acceptance criterion that reads "better", "polished" or "improved". If it cannot be
  measured off a capture, a generated instance list, a source scan or a presentation-layer unit test,
  it is not an acceptance criterion — and "horrid" becoming "fine" is a judgement, not a measurement.

## Engineering constraints

- Demos hand-roll rendering **per demo**. Duplication across demos is expected and accepted; the
  driver is extracted later, from working implementations.
- Tests are required for every code change. Prose and briefs need no test and must not get one — do
  not add frozen-text assertions. Regression test first when fixing a reported bug; the foliage
  exclusion rules and the water depth contract are both regression-first.
- Short one-line commit messages. No coauthor tags. One commit per demo per item.
- Capture PNGs are **not** committed — `.antiky/` is gitignored and `*.png` is LFS here. The committed
  artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes — and on `antiky-town`, preserve the working frame too.
  The unchanged-elsewhere criterion above is the mechanical form of that.
- Two items may run in parallel only if their owned-file sets are disjoint. The four demos qualify,
  and within `antiky-town` so do grass, water, shadow softness and the depth-of-field re-tune. Grass
  and trees share `town-foliage.ts` and must be serialised.
- Keep handwritten files under 500 lines. `town-foliage.ts` and `town-water-features.ts` are already
  past it and will grow — decompose by responsibility as part of the work.

## Completion definition

The goal is complete only when each of the four demos has a committed art-direction brief written
against a capture that exists, hits its §7.1 value and hue targets, keeps its W0.3 budget green, and
passes AC-V1 through AC-V4 plus the lighting criteria for the items it received; when no shader
anywhere applies a shared-frequency `uTime` sine to an output alpha; when `traversal-study`'s emissive
effects are additive and demonstrably bloom; when `antiky-town`'s grass passes its distribution,
variation, slope, edge-falloff and autocorrelation tests, its trees pass their translucency, rim and
species-coherence tests, its water passes its depth, foam, flow and specular tests with the
depth-in-alpha contract intact, its fountain emits particles, its shadow edges span ≥ 6 px without
acne or peter-panning, and **everything else in that frame measures unchanged**; and when each of
items 11, 13, 14, 15, 16, 17 and 18 is
either landed against its acceptance criterion or deferred with the measurement that justified
deferring it.

If a criterion cannot be met, report the failing measurement and stop. Budgets and targets are changed
by the owner, never by the agent that is failing them.
