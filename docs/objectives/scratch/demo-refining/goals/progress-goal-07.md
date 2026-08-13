# Progress — goal 07: carry the render slice to the other three demos

Fifteen packets: five each for `combat-arena`, `traversal-study` and `antiky-town`, strictly serial
within a demo. This file tracks which have landed and what each measured, so the state is legible
without reading the commit log.

## Status

| Demo | B.1 colour | B.2 HDR + tone-map | B.3 sun + shadows | B.4 ambient + AO | B.5 bloom/grade/vignette |
| --- | --- | --- | --- | --- | --- |
| combat-arena | **done** `58ec726` | **done** `3ab9ea4` | **done** `a1d9a73` | **done** `495d353` | **done** `a789fc4` |
| traversal-study | **done** `7f3d6d1` | **done** `d45413e` | — | — | — |
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

## Notes carried forward

- The three `brometal/` demos still tone-map in their materials. They are **outside this goal's
  scope**, which covers the three antiky demos, so `pipeline-invariants`' tone-map assertion will
  still report them when goal 07 finishes.
