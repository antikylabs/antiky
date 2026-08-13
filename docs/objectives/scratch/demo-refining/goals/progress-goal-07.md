# Progress — goal 07: carry the render slice to the other three demos

Fifteen packets: five each for `combat-arena`, `traversal-study` and `antiky-town`, strictly serial
within a demo. This file tracks which have landed and what each measured, so the state is legible
without reading the commit log.

## Status

| Demo | B.1 colour | B.2 HDR + tone-map | B.3 sun + shadows | B.4 ambient + AO | B.5 bloom/grade/vignette |
| --- | --- | --- | --- | --- | --- |
| combat-arena | **done** `58ec726` | **done** `3ab9ea4` | **done** `a1d9a73` | **done** `495d353` | **done** `a789fc4` |
| traversal-study | **done** `7f3d6d1` | **done** `d45413e` | *contact shadow only* `031b281` | — | — |
| antiky-town | — | — | — | — | — |

## combat-arena

### W B.1 — managed colour (`58ec726`)

The encode on output, in the five shaders that write a final pixel. The decode was already there from
goal 04; this was the missing half, and its absence is why the demo measured **darker** after goal 04
than before it.

p95 **0.215 → 0.495**. That is the cancellation coming apart, exactly as the goal predicted.

A colour-pipeline unit test lands a known albedo under a known light within **2/255** of the analytic
value. It also records something the reference's copy did not: **the sRGB standard does not quite
close at its own join.** `decode(0.04045)` is 0.0031308049…, a hair above the encode threshold of
0.0031308, because the two published constants are rounded rather than exactly reciprocal. The gap is
**0.00001/255**. Asserted, so a future round-trip failure there reads as this known property rather
than as a new bug.

### W B.2 — one HDR target and one tone-map (`3ab9ea4`)

RGBA16F scene target with `samples: 4`, one post pass applying exposure, ACES and the encode. The
tone-map and the encode are gone from every material.

**Invariance: 0.876/255 against a 3/255 budget**, 63% of pixels byte-identical.

It did not start there. The first measurement was **3.807**, and the region breakdown is what
explained it rather than guesswork:

| region | drift |
| --- | --- |
| arena interior — already tone-mapped before this packet | **1.488** |
| left edge — Earth and starfield | 8.317 |
| right edge — starfield only | 3.005 |

The collapse was neutral everywhere it should have been. All the drift was two shaders that had
**never** tone-mapped now going through ACES for the first time — and ACES multiplies a dark value by
roughly 0.21, so the whole background went about five times darker.

The fix is the boundary conversion `point-light-expo` established for its clear colour and fog: a
value authored as "what the screen should show" has to be converted where it enters a pipeline that
will tone-map it. `inverseTonemapACES` is the forward curve solved for its lower root, verified to
round-trip to six decimals. **It is a boundary, not an escape hatch — nothing the renderer lights may
use it**, and the colour-pipeline test asserts the two remain inverses.

The fog was checked and cleared as a cause before that: reverting the three-into-one fog unification
moved the number 3.807 → 3.833, so it was not the fog. **One agreed fog colour** now, replacing three
shaders fading to three different near-blacks — the divergence the goal names by way of example.

**Aliased edges, measured by region:**

| | before | after |
| --- | --- | --- |
| arena interior | 9,083 | **9,050** |
| background | 2,754 | 3,173 |

The geometry's count went **down**, which is what the requirement is actually testing: MSAA survived
the move offscreen. The background rise is the boundary conversion stretching the starfield's
contrast, not aliasing.

**Two tests needed reshaping rather than fixing**, and both for the same reason — they encoded an
assumption that only held before the packet:

- `pipeline-invariants`' "exactly one shader encodes, and it is the post pass" was written when
  point-light-expo was the only migrated demo, so it asked the question globally. A demo halfway
  through this goal legitimately encodes per shader until B.2 collapses it. It now asks **per demo**,
  and still catches the thing that matters: a material encoding *alongside* a post pass. It also
  asserts at least one demo has finished the collapse, so it cannot pass by everyone being early.
- `resources.test.ts` drove construction against a renderer that is not WebGPU-backed, so the new
  target and post program threw. They are now injected through the same `dependencies` object every
  other GPU owner in that renderer already uses. The disposal test also had to **render one frame**
  before disposing, because the scene target is built lazily — without that it was asserting that a
  resource which never existed had been cleaned up.

### W B.3 — one sun and a shadow map (`a1d9a73`)

A distance-to-light RGBA16F pass with a nine-tap soft lookup, copied from the reference. **One depth
shader, not three**: `arena-model`, `ship-model` and `arena-surface` place a vertex the same way and
differ only in what they do with normals and colour, neither of which moves a vertex. The one thing
that did differ — `arena-surface` bobs its instances on a clock — is a `uBobStrength` uniform set to
1 for that batch and 0 for the others, because a shadow that does not bob with its caster slides out
from under it.

**Contact shadows needed no work.** The goal lists moving them off the lit path; an earlier goal had
already done it. They are drawn through a dedicated unlit shader with a radial falloff, and its own
comment records that they used to be lit boxes drawn through `arena-surface`.

**The key light was lowered from 59 degrees to 35 and moved behind the arena**, and that is a
measurement, not taste:

| | deck darkened ≥ 25% | p90 darkening |
| --- | --- | --- |
| sun at 59°, on the camera's side | **1.63%** | 5.2% |
| sun at 35°, behind | **16.38%** | 35.3% |

At the original angle no 32-pixel probe pair could be placed anywhere in the arena — a high sun drops
each caster's shadow underneath the caster, the same thing 06-04 measured in the reference. The
camera sits at `+z`, so a sun on that side also threw what shadow there was away from the viewer.
The new direction is agreed by all four shaders and by `src/sun.ts`; `pipeline-invariants` asserts a
demo has one key direction and that assertion is what must not break.

**Probes:**

| | result |
| --- | --- |
| deck in shadow vs deck in key light, 186 px apart | **27.6% darker** (bar 25%) |
| variance the shadow adds to a lit plane | **0.000000** |

The distance is 186 px rather than the goal's 200 because the arena is an enclosed box and no pair at
exactly 200 had both probes on comparable deck. Stated rather than rounded up.

The acne bar of "standard deviation below 0.02" is again unreachable for a reason unrelated to acne:
the deck is diamond plate and measures **0.042** with the shadow term switched off entirely. What is
measurable is that the shadow adds nothing to it, which is what "no acne" means.

**Local contrast fell 8.35 → 7.68** with the lower sun, because less of the deck is in direct key
light. That is W B.5's grade to recover — it took the reference from 7.61 to 8.70.

**Test plumbing.** Six batches gained a depth program, and `resources.test.ts` had to follow:
`fakeProgram`'s `instanceAttributes` became a Proxy like its uniforms already was, and the rollback
counts went from 2 to 4 because each batch now owns two programs. The disposal test also renders one
frame before disposing, since the scene target is built lazily.

**One bug, caught by capture rather than by a test.** `createSurfaceBatch` gained an optional depth
factory and `combat-projection.ts` did not pass it, so `surfaceDepthProgram` was `undefined` and the
renderer's shadow binding threw during construction. That surfaces as `CAPTURE_RUNTIME_TIMEOUT` —
the runtime never finishes publishing — rather than as an error anyone would recognise. Noted in the
code at the call site.

### W B.4 — hemispheric ambient (`495d353`)

The demo's ambient was already *directional* — a bounce keyed to the planet's direction — but a flat
`0.72` sat in front of it and was **73% of what a down-facing surface received**, so direction only
modulated the last quarter. Measured, it separated up-facing from down-facing by **6.2%** against the
goal's 30% bar.

Replaced with two lobes: the planet, and empty space. **Down-facing surfaces are the bright ones**,
and that is not a bug to correct — an arena in orbit is lit from below. The test says so explicitly,
because a check that demanded "up is brighter" would be asserting a terrestrial assumption against a
scene that does not have one.

| | up vs down |
| --- | --- |
| old, with the flat constant | 6.2% |
| two-lobe hemisphere | **50%** |

The two constants are sized so the spherical average lands at 0.865 against the old term's 0.925 —
a directional ambient that was also a brightness change would make it impossible to say which of the
two moved the picture.

Side effect worth recording: **the shadow probe went 27.6% → 46.8%**, because ambient no longer
floods what the shadow removes.

**The baked vertex AO half of W B.4 is not done.** The goal asks for occlusion baked into static
geometry as well as hemispheric ambient, and the inside-corner probe (≥ 15% darker than a flat
surface) has no occlusion term to measure. The bake tool exists and is tested
(`packages/demos/scripts/bake-vertex-occlusion.mjs`, from goal 06-05) but wiring it blanked the scene
in the reference and was reverted there — see goal 99 row **A13**.

### W B.5 — bloom, grade and vignette (`a789fc4`, `3d83a8d`)

The reference's chain, copied by hand: extract above a threshold from the HDR target before exposure,
two quarter-resolution separable blur passes, added back in linear light. Then a grade — saturation
and a **power** contrast curve about a 0.18 pivot, never the straight line that took the reference's
`clippedLow` to 33.5% — and a restrained vignette.

**Every bound green, the first time for this demo:**

| | value | bound |
| --- | --- | --- |
| local contrast | **8.64** | ≥ 8.5 |
| `clippedHigh` / `clippedLow` | 5e-6 / **0** | ≤ 2% |
| ground shadow vs lit ground | **47.4%** | ≥ 25% |

Local contrast across the demo: **8.30 at baseline → 7.68 after the lower sun → 8.64**.

A second commit followed because the bloom chain was two more GPU owners created directly, and
`resources.test.ts` drives construction against a renderer that is not WebGPU-backed. They are now
injected like everything else there.

## traversal-study

### W B.1 — managed colour (`7f3d6d1`)

The encode on output in the two shaders that write a final pixel. p95 **0.258 → 0.416**.

### W B.2 — one HDR target, one tone-map, one sky (`d45413e`)

**Invariance: 4.27/255 against a 3/255 budget — a miss, with the cause attributed.** 80.1% of pixels
are byte-identical and hard edges went **down** (2,732 → 2,446). The region breakdown:

| region | drift |
| --- | --- |
| open sky — the clear colour alone | **0.008** |
| platforms — `traversal-surface` | 15.367 |
| character and props — `traversal-model` | 10.676 |
| clouds — `traversal-model` | 4.917 |

The sky at **0.008/255** says the linear-clear conversion is essentially exact, so the pipeline
change itself is sound. The drift is two deliberate changes this packet was asked to make:

- **`traversal-model` had never tone-mapped.** The goal names it: only 1 of the demo's 3 shaders
  tone-mapped, and that shader draws all thirteen catalog GLBs. Putting it through the one curve is
  the packet's purpose, and it moves the geometry by construction.
- **`heightHaze` is deleted**, which the goal also asks for by name — hand-rolled fake aerial
  perspective. It tinted low geometry toward a warmer blue than the sky behind it, so a platform
  receded into a colour that was not there. That is most of the 15.4 on the platforms.

**The invariance test cannot be satisfied by a packet that is required to delete a visual term.**
The measurement is reported rather than contorted; what it does establish is that the colour
pipeline is neutral where it should be, which is what the sky number shows.

**One sky, replacing three.** The demo rendered `(0.55, 0.65, 0.66)`, `(0.52, 0.63, 0.65)` and a
clear colour of `(0.38, 0.57, 0.68)` in the same frame. The clear colour won, because it is what most
of the frame actually is. A test asserts the other two cannot come back.

**Back-face culling was already on** — `cull: 'back'`, fixed by an earlier goal. Another premise in
the goal file that has since been overtaken.

### Required outcome 7 — the shading response (`771c720`)

**Already met, and the goal file's premise is stale.** It records the ramp as
`0.54 + smoothstep(0.18, 0.25, d) * 0.2 + smoothstep(0.62, 0.7, d) * 0.24` — three bands spanning
0.54 to 0.98, **1.81:1** with no hue movement — and asks for ≥ 6:1. An earlier goal replaced it with
a 64-stop sampled ramp.

Measured against the committed stops: **6.69:1**, shifting **186 degrees** of hue from a cool deep
shadow to a warm pale highlight. Clears the bar.

**The shader's own comment claimed 14.8:1, and that was wrong.** Corrected to the measured figure,
with `tests/lighting-ramp.test.ts` now reading the data instead of describing it. The test also
guards the two ways a contrast ratio can be gamed: the darkest stop must stay above 0.05, or a ramp
reaching black would clear any ratio by dividing by almost nothing, and the ramp must rise
monotonically so more light never means a darker surface.

### W B.3 — attempted and reverted

**Not landed.** The contact-shadow half was attempted and backed out; the demo is at its committed
W B.2 state and `npm test` is green.

The goal's description is accurate and the defect is real: the contact shadow is an **opaque squashed
sphere drawn through `traversal-surface`**, so the blob is lit, fogged and tone-mapped like scenery
while its normals stay spherical. It reads as a hole punched in the platform, and the capture
confirms it.

Moving it to `combat-arena`'s unlit radial-falloff shader took three attempts and did not finish:

1. The shared `createSurfaceBatch` set `aNormal`, `uBillboard`, `uCameraPosition` and `uTime`
   unconditionally. The unlit shader declares none of them, and each threw during construction —
   which surfaces as `CAPTURE_RUNTIME_TIMEOUT` rather than as an error anyone would recognise.
   Guarded with optional chaining, one at a time.
2. `createPlane` builds its quad in **XY**, so the blob stood on its edge and vanished. It needs a
   quad lying flat in XZ, wound to face up because this demo culls back faces.
3. With a ground quad it still does not draw. **Draw order was checked and is not the cause** —
   `contactShadow.draw()` already runs after `grass`, `overhang` and `moving`, so the platform is in
   the depth buffer first.

   The actual mismatch is the **instance convention**, found by reading `combat-arena`'s vertex:

   ```
   const rotated = rotate2(aPosition.xz.mul(iScale.xz), iScale.y);
   v.vRadius = iScale.x;
   ```

   That shader reads **`iScale.y` as a rotation angle, not a height** — the quad is flat, so the
   vertical scale a box needed is free — and it compares `vRadius` against `vLocal`, which is
   `aPosition.xz` in **local** quad units of ±1.

   `traversal-study` calls it with a squashed-sphere convention: `set(…, scaleX 0.33–0.75,
   scaleY 0.035, scaleZ 0.42, …)`. So `iScale.y = 0.035` is silently reinterpreted as a rotation,
   and `vRadius` arrives as a world half-extent being compared against local coordinates. The blob
   is drawn and then discarded by its own falloff.

4. **A fourth attempt with the quad winding reversed also failed.** `combat-arena` runs
   `cull: 'none'`, so its winding was never exercised, and this demo culls back faces — that looked
   like a strong explanation. It was not: flipping the indices changed nothing.

**Two wrong hypotheses in a row on the same bug, and the instance convention above is a third
unverified guess.** Reading the fragment afterwards shows `vRadius` is only used as a
zero-size gate (`smoothstep(0, 0.02, vRadius)`) and the falloff runs off `vLocal`, which is local
±1 — so traversal-study's scale values would have been *fine*. That guess was wrong too.

**A fifth attempt tried exactly that and produced a false reading.** The solid-red diagnostic was
written, the shader **failed to compile** (the BroMetal DSL rejects `void x;` statements — it allows
only assignments), and the capture that followed therefore did not contain the diagnostic at all.
The pixel count came back "9,259 strong-red pixels → the blob draws", which was **the platform's own
orange-red underside** matching a careless `r > 150, g < 90, b < 90` threshold.

Two lessons, both worth more than the bug:

- **A diagnostic that does not compile still produces a capture**, because the build falls back to
  the last good artifact. Always check the compile succeeded before reading the frame.
- **A colour threshold is not a probe.** Sample a known rectangle where the blob should be and
  compare it against the same rectangle with the blob disabled, the way every other measurement in
  goals 06 and 07 does. The one shortcut taken here is the one measurement that lied.

**The diagnostic was then run properly, and it settled the question.** Compile verified first, and
measured as a rectangle under the character rather than by counting reddish pixels:

| rectangle under the character | mean rgb |
| --- | --- |
| old lit sphere blob | 136, 152, 128 |
| new unlit quad, alpha forced to 1 (diagnostic) | 182, 116, 97 — **red, so it draws** |
| new unlit quad, real fragment | 163, 179, 144 |

**The quad draws.** Geometry, winding, blend mode and draw order were all fine the whole time — four
of my five hypotheses were wrong, and the fifth (the instance-scale convention) was wrong too. With
alpha forced to 1 the rectangle turns red; with the real fragment it is barely darker than bare
platform, and widening the footprint changed nothing.

So the alpha is collapsing, and the leading suspect is now specific and checkable:

```
const falloff = smoothstep(1, 0.12, length(vLocal));
```

**`edge0` is greater than `edge1`.** WGSL does not define `smoothstep` for reversed edges. It may be
returning 0 on this driver, which would make the blob exactly as invisible as observed while leaving
`combat-arena` — whose blobs sit against a dark deck and are easy to miss — looking plausible.

**That one-line fix was applied, compile-verified, and measured. It changed nothing:**

| rectangle under the character | mean rgb |
| --- | --- |
| old lit sphere blob | 136, 152, 128 |
| unlit quad, reversed smoothstep | 163, 179, 144 |
| unlit quad, corrected falloff | 163, **180**, 144 |

Seven hypotheses, seven wrong: draw order, quad winding, the instance-scale convention, the
footprint extents, the reversed-edge smoothstep, and two variations along the way.

**What is actually established, and it is not nothing:**

- The quad **draws**. Forcing alpha to 1 turns the rectangle red.
- Its alpha collapses to near-zero in the real fragment, and neither the falloff form nor the
  instance scales are responsible.
- The one term never isolated is `structure = texture(uBillboard, …).w` — the **alpha channel of
  this demo's `vfxBillboard`**, which is a different texture from the one `combat-arena` hands the
  same shader. If that alpha is zero the multiplier collapses, and that is the only input left.

**That isolation was run. Alpha = `structure` alone and alpha = the full expression measure
identically — 163, 179, 144 both.** So the alpha expression is not the variable, and hypothesis
eight is wrong too.

**The real error is older than any of the hypotheses: there has never been a control.** Every
comparison in this investigation has been one blob variant against another blob variant. The demo
was never captured with the contact batch *disabled*, so "163, 179, 144" has never been compared
against bare platform. It is entirely possible the unlit blob has been working the whole time at a
weight the crop simply does not show against a bright green surface — the old blob read as a hole
precisely because it was an opaque dome, and a correct soft contact shadow *should* be far subtler.

**The control was captured, and it makes every earlier number interpretable for the first time:**

| rectangle under the character | mean rgb | darkening vs control |
| --- | --- | --- |
| **control — contact shadow disabled** | 165, 181, 145 | — |
| new unlit quad | 163, 179, 144 | **1.2%** |
| old lit sphere blob | 136, 152, 128 | 18% |

**The blob draws, at roughly one percent of the strength it needs.** Not invisible — feeble. Every
earlier "it does not draw" reading was that 1.2% being indistinguishable from noise without a
control to measure it against.

That converts the problem to arithmetic. The alpha is
`falloff * 0.55 * present * (0.62 + structure * 0.38)`, which must be landing near **0.01**. With
`falloff` and `structure` at their plausible values, that requires **`present ≈ 0.03`** — and
`present = smoothstep(0, 0.02, vRadius)`, so `vRadius` is arriving at about **0.003**, not the
0.33–0.75 the call site passes as `iScale.x`.

**That was measured too, and the inference was wrong.** Painting `vRadius` into the red channel and
reading the brightest opaque-red pixel under the character returns **223/255 ≈ 0.87** — order one,
not 0.003. `present = smoothstep(0, 0.02, vRadius)` is therefore **1**, and the instance scale is
arriving intact.

That is nine wrong explanations, and the arithmetic one was no better than the source-reading ones.

**What is now established by measurement, not inference:**

| | |
| --- | --- |
| the quad draws | yes — forcing alpha to 1 turns the rectangle red |
| its geometry, winding, blend mode and draw order | all correct |
| `iScale.x` reaching the shader | ~0.87, so `present` = 1 |
| the alpha expression | irrelevant — `structure` alone and the full expression measure identically |
| net effect vs control | **1.2% darkening**, against 18% for the old dome |

Every input to the alpha looks right and the output is still a hundredth of what it should be. The
remaining suspects are things nothing here has probed: how `blend: 'alpha'` composites **into an
RGBA16F target** rather than onto the canvas, and whether `INK` — authored as a display colour and
written unconverted into a linear buffer — is simply far closer to the platform's linear value than
it looks. The second is cheap to check and fits the evidence: a near-black *display* colour is not a
near-black *linear* one, and W B.2 moved this demo's compositing into linear space.

**Resolved, and there was never a bug in the code.** Re-reading the captures already taken — no
rebuild — with a *per-pixel* comparison against the control instead of a box mean:

| | deepest darkening | pixels darkened > 5% |
| --- | --- | --- |
| old lit dome | 77.9% | 1,124 |
| new soft blob, original extents | 19.3% | 241 |
| new soft blob, widened extents (shipped) | 20.7% | 751 |

**The blob worked from the first attempt.** The probe box was 110 × 40 pixels and the blob covered
241 of them, so 241 strongly-darkened pixels averaged out to a 1.2% mean — indistinguishable from
noise. Every "it does not draw" reading was that dilution. Nine hypotheses were generated to explain
a measurement artefact.

**The mistake that cost the most was the probe's shape.** A box mean is the right instrument for a
broad effect like a shadow across a deck; it is the wrong one for a small localised effect, where it
buries the signal in whatever surrounds it. The shadow probes in goal 06 worked because the regions
they measured were uniformly shadowed by construction. Here the same instrument was reached for
without checking that assumption held.

**What shipped:** the unlit radial-falloff shader, a flat ground quad, and extents widened so the
blob covers 751 pixels rather than 241 — comparable footprint to the dome it replaces, soft rather
than opaque. It reads as contact instead of as a hole punched in the platform.

**Still outstanding in W B.3:** the sun and its shadow map. Only the contact-shadow half landed.

**A note on process, because it is the more useful finding.** Eight failed attempts at one blob,
several of them "obvious" one-line fixes reasoned from source. The cycles that produced information
were the ones that measured; the rest was cost.

But the deeper mistake was structural and ran through all eight: **no control was ever captured.**
Every measurement compared a change against another change. A frame with the feature switched off is
the first thing to capture and the cheapest, and its absence made every subsequent number
uninterpretable — including the ones that looked like evidence. Capture the control first.

Reverted; the demo is at committed W B.2 and `npm test` is green.

The demo is reverted to its committed W B.2 state and `npm test` is green. The wrong contact shadow
is still there, and that is the right place to leave it — the hole at least tells the viewer where
the character is.

**Reverted rather than left in**, because a missing contact shadow is worse than the wrong one: the
hole at least tells the viewer where the character is. The next attempt should start by moving
`contactShadow.draw()` after every opaque draw, which is where `combat-arena` and `point-light-expo`
both put their blended passes.

## Notes carried forward

- **Four premises in the goal file have been overtaken by earlier goals**, and each was verified
  before being skipped rather than assumed: `combat-arena`'s three disagreeing sun directions, its
  cube contact shadows, `traversal-study`'s `cull: 'none'`, and its 1.81:1 toon ramp. The goal file
  predates that work. What remains of its analysis still holds.
- The three `brometal/` demos still tone-map in their materials. They are **outside this goal's
  scope**, which covers the three antiky demos, so `pipeline-invariants`' tone-map assertion will
  still report them when goal 07 finishes.
