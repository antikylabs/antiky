# Remediation Plan — Getting the Demos to Best-in-Class Stylised

**Date:** 2026-08-10
**Reads with:** `00-VISUAL-DIAGNOSIS.md` (what's wrong), `01-RENDERING-VOCABULARY.md` (the words),
`subagent-reports/` (the evidence).

**This document is the reasoning. For execution, use [`06-WORK-PACKETS.md`](06-WORK-PACKETS.md)** —
the same work broken into independently dispatchable packets, each with an owned-file list (the
concurrency lock), explicit dependencies, and bounded mechanically-checkable acceptance criteria.
Hand subagents packets from that document, not phases from this one.

Also in this set: [`03-ART-DIRECTION-AND-VFX.md`](03-ART-DIRECTION-AND-VFX.md) (upgrading the
existing assets with real PBR materials, stylised lighting, and VFX),
[`04-COMPLEXITY-REDUCTION.md`](04-COMPLEXITY-REDUCTION.md),
[`05-FRAMEWORK-EASY-WINS.md`](05-FRAMEWORK-EASY-WINS.md),
[`07-TESTING-WITH-ANTIKY-MCP.md`](07-TESTING-WITH-ANTIKY-MCP.md), and
[`08-ADR-IMPACT.md`](08-ADR-IMPACT.md).

> **Decided 2026-08-10 — the promotion target now has a name.** The framework will own a
> `BroMetalRenderDriver`: BroMetal-specific, no backend abstraction, no plugin seam. Game modules
> may still hand-write BroMetal if they accept the framework work that comes with it. Other
> renderers stay compatible but unfunded. See [`09-RENDER-DRIVER-DECISION.md`](09-RENDER-DRIVER-DECISION.md),
> which carries a draft ADR 0021 superseding framework/0006 and resolving its conflict with
> studio/0007.
>
> **This does not change what gets built first.** Track B stays per-demo: prove the shadow map, HDR
> target and post chain in `point-light-expo`, then a second demo, then extract the driver from two
> working implementations. Building it from zero would abstract from a single implementation, which
> is the failure the decision exists to avoid. Place ADR 0021 before Track B lands so the work sits
> on a decision a reader can follow.

---

## The strategic call

**Owner direction (2026-08-10): the hand-rolled per-demo renderers are intentional.** The
framework is being built out slice by slice, and a capability stays hand-rolled inside the demos
until the framework officially supports it. Demos are the proving ground; promotion into
`@antiky/framework` happens deliberately, on the framework's own slice schedule.

That is the correct reading of this repository, and this plan follows it. An earlier draft of
this document proposed extracting a shared `@antiky/stagecraft` render package as the delivery
vehicle for Phase 1. **That recommendation is withdrawn.** It would have front-run the slice
schedule, and it cuts against `GOOD_ENGINEERING_H.md` more than it serves it — "don't abstract
too early", "let structure emerge from working code", "a little code duplication is better than a
premature abstraction". Three working implementations is evidence a cut-point *may* be
approaching; it is not permission to take it before the framework is ready to own it.

**Nothing in the findings depends on that recommendation.** The shared package was a proposed
delivery vehicle, never the fix. Every defect in `00-VISUAL-DIAGNOSIS.md` is repairable in place,
inside each demo, with no new package:

| Defect | Fixed in-demo by |
|---|---|
| No offscreen render targets → no shadows, no HDR, no post | Adding `createRenderTarget` + `drawTo` passes inside that demo's own renderer |
| Per-material `tonemapACES` | Deleting the call from that demo's material shaders; tone-mapping once in its own post pass |
| Unmanaged colour | An sRGB decode helper in that demo's own shader source |
| Stub BRDF, no Fresnel/geometry term | That demo's own shading functions |
| Asset pipeline discarding UVs and normal maps | The per-demo asset scripts, which are already per-demo |

### Revised approach: one reference slice, then carry the pattern

1. **Prove it in `point-light-expo` first**, hand-rolled, entirely inside that demo. It has the
   most to gain and its whole premise is lighting, so it is the honest test of whether the
   approach is worth promoting.
2. **Carry the pattern to `combat-arena` and `traversal-study` by hand**, adapting per demo.
   Duplication here is expected and accepted.
3. **Promote to the framework only when the framework is ready to own the slice** — on your
   schedule, informed by three real implementations rather than one speculative interface.

The sketch below is therefore **a target shape for the per-demo code, not a package to build
now**. If and when a rendering slice is scheduled, this is roughly what three demos will have
independently converged on, and that convergence is the signal to promote:

```ts
// Per demo, in that demo's own src/ — not a shared import.
const stage = createStage(renderer, {
  sun:     { direction, color, intensity, shadow: { resolution, distance } },
  ambient: { sky, ground, intensity },          // hemispheric, not a flat constant
  bloom:   { threshold, intensity, radius },
  grade:   { exposure, contrast, saturation, vignette },
  fog:     { color, start, end },
});

stage.frame((elapsed) => {
  stage.shadowPass(() => drawOpaque(shadowPrograms));   // depth-from-light
  stage.scenePass(() => { drawSky(); drawOpaque(); drawTransparent(); });
});
// internally: HDR target -> bloom chain -> exposure + ACES + grade -> present
```

and per-demo shading helpers of roughly this shape: `sampleAlbedo` (sRGB decode in-shader, since
BroMetal exposes no sRGB format), `hemisphericAmbient`, `directionalPbr` (energy-conserving GGX),
`pointLightPbr` (windowed inverse-square falloff), `shadowFactorPcf`, `linearFog`.

### The one cost of duplication worth actively managing

Duplication is cheap. **Duplicated bugs silently diverging is not**, and this repository already
shows the failure mode: Combat Arena has three shaders that disagree on the sun direction *and*
carry three different fog ranges, which is a direct cause of the arena reading as incoherent
space. Traversal Study tone-maps in 1 of its 3 shaders.

The mitigation that respects the slice process is not a package — it is making the divergence
*visible and intentional*:

- Treat `point-light-expo` as the **reference implementation** and say so in its README, so the
  next person copying the pattern knows which one is canonical.
- Where a demo deliberately differs, comment why. Undocumented divergence is how three sun
  directions happen.
- Lean on the **pipeline-invariant tests** proposed at the end of this document. They enforce
  correctness across demos without forcing shared code — exactly the right tool here. Assert that
  no material shader under `packages/demos/antiky/` imports `tonemapACES`, and that no asset
  script discards `TEXCOORD_0` or `normalTexture`. Add a per-demo assertion that all of a demo's
  shaders agree on sun direction and fog range.

Those tests give most of the safety a shared module would have given, at none of the
architectural cost, and they keep working when the demos legitimately drift apart.

**The contract that fixes the deepest bug:** material shaders return **linear HDR colour and
never tone-map**. `tonemapACES` is deleted from every material shader. The stage tone-maps
exactly once, at the end, after bloom. This is the change that makes glow, grading and every
future post effect possible at all.

---

## Quick wins — do these first, they take hours (~1 day total)

Independent of everything below. Each is small, safe, and visible.

| Fix | Where | Why | Effort |
|-----|-------|-----|--------|
| Palette textures → `filter: 'nearest'` | `traversal-study/src/renderer.ts:216` | The Quaternius models carry 1×1 to 7×1 **palette-strip** textures. Loading them with linear filtering + mipmaps + 4× anisotropy averages adjacent palette entries into mud wherever two swatches meet. | ~5 min |
| Raise camera `near` from 0.1 | all three cameras | `traversal-study` runs a 2400:1 far/near ratio, throwing away depth precision for nothing. Free quality. | ~30 min |
| One agreed light direction and one fog range per demo | `combat-arena` — three shaders currently disagree on **both** | This is a direct cause of the arena looking incoherent: objects lit by different suns cannot read as one space. | ~1 hr |
| Turn on back-face culling | `traversal-study/src/renderer.ts:297` runs `cull: 'none'` | Renders every back face for no reason. | ~15 min |
| Fix the fake contact shadows | `point-light-expo/src/shaders/foundry.shader.ts:181`, `combat-arena/src/combat-projection.ts:240` | The "shadow" blobs are run through the lit path, so they get roughly **6× brighter** near a light — a shadow that glows. The arena's are hard rectangles. Make them unlit, soft-edged and translucent. | ~2 hrs |
| Add render interpolation | all three demos | A fixed 60 Hz simulation is presented raw, so every 120/144 Hz display shows judder. | ~2 hrs |
| Rebuild the camera shake | `combat-arena/src/presentation.ts:34-35` | Owner feedback: "shakes and judders a lot, it's too much." Confirmed — see below. | ~3 hrs |

### Camera shake in Combat Arena — why it feels wrong

Owner feedback, and the code backs it up exactly. Three separable causes, all in two lines:

```ts
const shakeX = Math.sin(state.time * 47) * actionImpact * 0.11;   // presentation.ts:34
const shakeZ = Math.cos(state.time * 41) * actionImpact * 0.08;   // presentation.ts:35
```

**1. It's on a metronome — this is the big one.** The auto-cannon fires every `0.34 s`
(`simulation.ts:448-449`). Every hit sets `impact = Math.max(impact, 0.45)`
(`simulation.ts:259`), and impact decays at `4.2/s` (`simulation.ts:378`), so 0.45 takes
~0.107 s to reach zero. The result is a shake pulse roughly **three times a second, continuously,
for the entire fight**. Screen shake works because it punctuates; here it *is* the ambient state,
so it stops reading as impact and starts reading as vibration.

It's also mis-scaled: a routine cannon tick delivers 0.45 — nearly *half* the shake of losing
hull, which is 1.0 (`simulation.ts:203`). The most frequent event in the game is nearly the most
violent.

**2. The waveform is a sine pair, and the two frequencies beat.** 47 rad/s is 7.48 Hz; 41 rad/s
is 6.53 Hz. They differ by 6 rad/s, so the X and Z components drift in and out of phase with a
period of `2π/6 ≈ 1.05 s`. The camera traces a slowly precessing Lissajous figure rather than
jittering — a regular, mechanical wobble roughly once per second. Pure periodic motion reads to
the eye as *malfunction*; an impact needs to read as an irregular, decaying burst.

**3. The shake moves the camera position but not its look-at target.** Compare lines 70/72
(shake added to `position`) with 73/75 (`target`, no shake). Because the view is built from
position toward target, translating one without the other *rotates* the view — the whole frame
swivels, including the far arena edges, which is far more nauseating than a pure translation and
is most of the "judder" being felt. Compounding it, the sim runs at a fixed 60 Hz and is
presented with no interpolation, so a 7.5 Hz oscillation gets sampled and then frame-held on a
120/144 Hz display — stair-stepped motion on top of an already-wrong signal.

**The fix** (the standard approach is Squirrel Eiserloh's *Juicing Your Cameras With Math*,
GDC 2016):

- Keep a `trauma` value that spikes on events and decays, and drive shake by **`trauma²`** (or
  `trauma³`) rather than linearly, so small events are subtle and only real hits are violent.
- Replace the sine pair with **noise** (Perlin/simplex, or three independent noise channels)
  sampled at a fixed frequency against its own clock. No two-frequency beat, no periodicity.
- Cut the cannon's contribution hard — to roughly `0.10–0.15` *before* squaring, or remove it
  from camera shake entirely and express cannon feedback through the hit VFX and a brief hit-stop
  instead. Reserve camera shake for hull loss, kills and the Warden.
- Offset **both** `position` and `target` together for a pure translational shake, or better,
  apply a small rotational (roll/pitch/yaw) shake, which reads stronger at lower amplitude and
  avoids parallax swimming.
- Land render interpolation at the same time, or the improvement will be masked by frame-hold
  judder on high-refresh displays.

`tests/presentation.test.ts:62` already covers camera impact bounds, so the regression test has
a home: assert that a sustained cannon-cadence input produces bounded, non-periodic offset, and
that `position` and `target` shake together.

## Phase 0 — Unblock the pipeline (prerequisite, ~1 day)

Two BroMetal limitations block Phase 1. Both are small local patches in the existing
`scripts/patch-brometal.mjs`, which already patches this library for `discard()` and `present()`.

| # | Patch | Why it's blocking | Size |
|---|-------|-------------------|------|
| P1 | Render-target sampler `nearest` → `linear` (`dist/runtime/webgpu.js:761`) | A bloom downsample chain built on point sampling produces blocky, crawling glow. | ~2 lines |
| P2 | Honour MSAA in `drawTo` — it hard-codes `passSamples = 1` (`webgpu.js:235`) | **Today 4× MSAA is on and working. The moment we render to an HDR target we silently lose all of it.** Without this, Phase 1 is a visible regression on edges. | ~40 lines |

Both are genuine upstream bugs-of-omission, not hacks. File them as PRs against BroMetal at the
same time — as with `discard()` and `present()`, we are doing the maintainer's backlog.

**Explicitly *not* blocking**, so don't let anyone gold-plate them into the critical path:

- *sRGB texture formats* — BroMetal hard-codes `rgba8unorm` (`webgpu.js:836-842`). Work around it
  by decoding in-shader in `sampleAlbedo()`. Slightly slower, correct, ships today.
- *Sampleable depth* — needed for SSAO, DOF and soft particles, not for shadow maps. Our shadow
  map writes distance-to-light into an ordinary RGBA16F colour target, which is the approach
  BroMetal's own `DrawToOptions.clear` documentation describes. Defer.
- *MRT / deferred rendering* — not needed. These scenes are small; forward is correct here.

---

## Phase 1 — The four fixes that do most of the work (~1–1.5 weeks)

Built hand-rolled inside `point-light-expo` first as the reference slice, then carried by hand to
`combat-arena` and `traversal-study`. Delivered in this order, each independently shippable and
visible:

1. **HDR scene target + single tone-map + exposure.** Delete every per-material `tonemapACES`.
   Nothing else changes visually yet — this is the plumbing. Verify with captures that the
   image is *unchanged* before moving on.
2. **Directional key light + PCF shadow map.** One sun, one shadow pass, 4-tap soft lookup.
   This is the single largest visual gain in the whole plan.
3. **Hemispheric ambient replacing the flat constant**, plus baked vertex AO on static geometry.
   Removes the clay look; grounds objects into corners.
4. **Bloom + colour grade + vignette.** Now that the HDR buffer exists, lights and VFX finally
   emit rather than decal.

Then port: `point-light-expo` first (it has the most to gain and its whole premise is lighting),
then `combat-arena`, then `traversal-study`.

**Replace the stub BRDF.** BroMetal's `specGGX` is the distribution term only — no Fresnel, no
geometry/shadowing term, and a hard-coded `0.25` where the real denominator belongs. Combat
Arena's ship shader has **zero specular at all**, which is fatal against a Rocket League target;
Traversal Study's model shader is a three-step toon ramp spanning 0.54→0.98 — a maximum contrast
ratio of 1.81:1, with no view-dependent term whatsoever. That ramp is, by itself, a complete
explanation for why the platformer looks flat. Write a real energy-conserving GGX in the
reference slice, then carry it to each demo's own shading helpers.

**Retire the scar tissue.** `uDiffuseLift`, `uTextureContrast`, `uSaturation` and the
`mix(vec3(0.48), …)` grey-wash exist to fight the unmanaged colour pipeline. Once colour is
managed they are actively harmful — delete them rather than re-tuning them.

**Note on the colour bug's shape:** the missing sRGB decode and the missing gamma encode cancel
each other out for unlit passthrough, which is why this survived review — an untextured or
unlit surface looks fine. They stop cancelling the moment you multiply by a light, so *all*
lighting maths is currently happening in display space. This is why the defect presents
specifically as "lit surfaces look mushy" and is the single highest-leverage two-hour fix
available. Also note only 1 of Traversal Study's 3 shaders tone-maps at all
(`traversal-model.shader.ts:56`, covering all 13 GLBs, does not) — so the demos are not even
internally consistent today.

---

## Phase 2 — Stop the asset pipeline destroying the assets (~3–4 days)

These are self-inflicted and cheap to reverse. They are the reason the platformer has no
textures at all.

1. **Fix the UV collapse.** `traversal-study/scripts/normalize-quaternius.mjs:237-238` never
   reads `TEXCOORD_0`; it overwrites every UV with a palette-column lookup, producing shipped
   textures that are literally **1×1 pixels** (`cloud-large`, `cloud-small`, `coastal-cliff`).
   Read and preserve the source UVs and the source texture.
2. **Stop deleting normal maps.** `point-light-expo/scripts/gltf-pack-lib.mjs:89` runs
   `delete material.normalTexture` on maps we downloaded and committed. Keep them, and apply them
   through **triplanar projection**, which needs no tangent basis at all.

   > **Correction (supersedes an earlier draft of this document).** An earlier version said to
   > derive a tangent basis in-shader "with screen-space derivatives". **That is not possible.**
   > BroMetal's DSL exposes no `dpdx`, `dpdy` or `fwidth` — verified against
   > `node_modules/brometal/dist/dsl/builtins.d.ts`, whose complete builtin list contains no
   > derivative function. Any plan step depending on screen-space derivatives is invalid.
   > Triplanar projection deletes the problem rather than working around it. The same missing
   > builtins also block specular anti-aliasing, which matters because adding normal maps and
   > gloss is exactly what creates the need for it — see `03-ART-DIRECTION-AND-VFX.md`.

   (Kenney's models do ship `TANGENT`, and nothing currently reads it — so a tangent-space path
   remains available for those specific meshes if triplanar proves wrong for a surface.)
3. **Converge the three divergent per-demo asset scripts** into one processing step with one
   fidelity policy. Three scripts with three policies is how two of them ended up lossy.
4. **Use the HDRIs we already have.** The catalog holds 332 CC0 HDRIs and not one is used. Even
   a single low-resolution irradiance probe per demo beats any hand-tuned ambient constant.

---

## Phase 3 — Art direction, per demo (~2–3 days each, no framework work)

Only after Phase 1, so the tools exist. This is where the reference targets actually get chased.

**`point-light-expo` → League of Legends.** Kill the floating-ground-quad-in-a-void: add a
horizon, a backdrop, and fog that fades the plane's edge out. Make the point lights *do their
job* — visible falloff gradients across the rock faces, coloured bounce, and shadows cast away
from each light. Replace the faceted low-poly light orbs with soft billboard sprites that bloom.
Rim-light the hero elements. Push the frame's edges dark so the centre pops. Re-skin the debug-
looking `PRISM FRACTURED` overlay.

**`combat-arena` → Rocket League.** Widen the value range — the whole frame currently sits in a
15–35% luminance band. Make the floor glossy so it reflects the arena and the ships; that
reflection is most of what sells scale. Delete the yellow squiggle cables. Impose scale and
rotation discipline on the rim props — right now a stadium reads as a debris pile. Commit the
camera to either a readable tactical framing or a cinematic chase, not the current halfway.
Replace the flat ring decals with soft-edged blooming VFX.

**`traversal-study` → LittleBigPlanet.** Textures (Phase 2) plus a real sky gradient instead of
`clearColor: [0.38, 0.57, 0.68]` (`traversal-study/src/renderer.ts:297`). Aerial perspective so
distance reads. Replace the hard black ellipse under the player with a soft translucent contact
shadow. Fix the composition — ~60% of the frame is dead sky. Move the HUD out of the world; it
is currently a cluster of coloured boxes floating in mid-air. Shade the clouds.

Also: `traversal-study` runs `cull: 'none'`, rendering every back face for no reason. Turn on
back-face culling unless something specific needs double-siding.

---

## Phase 4 — Presentation and the comparison story (~2–3 days)

The demos are also being *shown* badly, and one framing problem is actively self-defeating.

1. **Eight of ten demos are WebGPU-only** (`packages/website/src/lib/demos.ts`). On Safari and
   Firefox, a `/demos` page headlined "Run the work / Ten live studies" is eight error cards and
   two working three.js scenes. The unintended message is "only the non-Antiky demos work." Fix
   the fallback framing, or lead with posters and make the WebGPU requirement explicit and
   confident rather than an error state.
2. **We are showcasing BroMetal's weakest work.** `town-study` — ~9,000 lines, a real voxel
   mesher, a sprite batcher, twelve shader pairs including dedicated shadow passes, a character
   motor with tests — is the strongest artifact in the repository, and it is billed identically
   to three fullscreen 2D shader quads. Promote it.
3. **Three committed three.js runtime captures are blank white PNGs**
   (`packages/demos/threejs/*/.antiky/captures/`), and `PRODUCT.md:113` cites those studies as
   current evidence. Both demos set `preserveDrawingBuffer: true`, so it is a capture-timing bug,
   not a render failure. Fix or delete them.
4. **Glass Garden cannot reproduce its own poster** — the poster is ~40% clipped white, the
   runtime is a near-black void. Stacked over-bright lights and emissives at exposure 1.0.
5. Mobile: demo thumbnails are hover-activated only, so mobile `/demos` is ten static posters;
   `background-size: cover` crops 16:9 posters to their middle ~35% on a portrait stage.
6. Point bugs worth a single sitting: Orbital Atlas re-runs `setSize` + `updateProjectionMatrix`
   **every frame** because its resize guard compares `canvas.width` against `clientWidth` while
   `setPixelRatio(2)` is active (`orbital-atlas/src/game.ts:210-217`) — Glass Garden already has
   the correct pattern. Luminous Reef's plankton renders as hard axis-aligned squares
   (`luminous-reef.shader.ts:139-142`, missing the local-distance test its own `bubbleGlow` uses
   ten lines earlier). Shader Study's moon craters are unfiltered squares and its dither is
   applied before the tone-map.

---

## The process fix that matters more than any of the above

**The previous agent was working blind.** No shader in this repo shows evidence of having been
looked at after it was written. That is the actual root cause of every finding in this document,
and if it isn't fixed the next agent will regenerate the same class of defect.

The repository already has the tooling — `antiky tool capture_frame`, `capture_gameplay_sequence`,
a managed WebGPU Chromium, and an evidence store. It just isn't in the loop.

**Add `npm run demos:shoot`**: launch every demo, capture a canvas frame, write a dated contact
sheet into `docs/objectives/demo-refining/evidence-captures/`. Make looking at it a required
step in `AGENTS.md` for any change to a shader, a renderer or an asset script. A visual change
that hasn't been captured and viewed isn't done.

Pair it with two cheap automated guards, since `AGENTS.md` requires tests for code changes:

- **A luminance-histogram assertion.** For each demo, assert the frame's mean luminance and its
  5th/95th percentile spread fall inside an authored range. This mechanically catches "everything
  is the same middle grey", which is our single most pervasive defect, and it catches the
  Glass Garden blown-out-poster failure too.
- **A pipeline-invariant test.** Assert no `*.shader.ts` under `packages/demos/antiky/` imports
  `tonemapACES`, and that no asset script discards `TEXCOORD_0` or `normalTexture`. These are
  regression tests for the exact bugs found here, which is what `AGENTS.md` asks for.

---

## Sequencing and honest effort

| Phase | Work | Effort | Visual payoff |
|-------|------|--------|---------------|
| QW | Quick wins (table at top) | ~1 day | small each, meaningful together, near-zero risk |
| 0 | Two BroMetal patches | ~1 day | none directly; unblocks everything |
| 1 | Reference slice in `point-light-expo`, then carried to the other two | ~1–1.5 weeks | **the large majority of the total gain** |
| 2 | Asset pipeline repair | ~3–4 days | large on the platformer, moderate elsewhere |
| 3 | Art direction, 3 demos | ~2–3 days each | large, and it is what chases the references |
| 4 | Presentation + point bugs | ~2–3 days | moderate, but it changes the story the site tells |
| — | Capture loop + guards | ~1 day | prevents recurrence |

Roughly four to five focused weeks for all of it. Phases 0 and 1 alone — about two weeks — will
account for most of the difference, and are worth doing before touching anything else.

## What I would *not* do

- **Don't chase *new* assets at all yet — the ceiling is far lower than first reported.** An
  earlier draft of this document, following `subagent-reports/03-asset-pipeline-audit.md`, put
  ~40% of the gap down to a genuine asset ceiling, reasoning that a Kenney block with 5 unique
  UVs cannot carry detail. **That reasoning is wrong**, and it was steering us toward buying
  assets we don't need. It only holds if surface detail must arrive through the mesh's own UVs.
  **Triplanar projection derives texture coordinates from world position and normal and never
  reads `TEXCOORD_0` at all** — so a 168-vertex Kenney block can carry a full 2K PBR material set
  with zero mesh work.

  Revised split: **~35% rendering, ~25% self-inflicted pipeline damage, ~30% simply-absent
  material assignment (fixable on the assets we already own), and only ~10% genuine ceiling** —
  and that last 10% is silhouette and bevel quality, which no texture would fix anyway. See
  `03-ART-DIRECTION-AND-VFX.md`. Do not evaluate KayKit, Poly Haven kits or paid kits like Synty
  until after material assignment lands; there is no evidence yet that we need them.
- **Don't add deferred rendering, SSAO, TAA or DOF yet.** These scenes are small; forward
  rendering is correct here, and each of those adds a large amount of complexity for a fraction
  of what Phase 1 delivers.
- **Don't rewrite the demos' game logic.** The simulation, input and encounter code is not the
  problem, and it has tests. Keep it.
- **Don't extract a shared render package as part of this work.** The hand-rolled per-demo
  renderers are deliberate: capabilities stay in the demos until the framework officially
  supports them, and promotion happens on the framework's slice schedule. Fix the rendering in
  place, let three implementations converge on their own, and let that convergence inform a
  future slice rather than pre-empting it.
