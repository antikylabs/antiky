# Execute goal 05-04: the VFX pass

Part 4 of 4 of what remains in [goal 05](execute-goal-05.md). Covers **items 2, 8 and the rest of
9**.

## `/goal` objective

Every effect in these demos is an untextured primitive on a shared timing curve. Give them texture
and give them independent timing.

## What is already done

**AC-V3 is green.** `arena-glow` and `traversal-glow` pulsed their alpha on one shared frequency with
only a per-instance phase, so instances drifted into unison and breathed as one mechanism. Both now
vary the rate per instance, with a test that catches a regression.

**Contact shadows are already unlit and soft-edged**, from goal 03 — `smoothstep(1, 0.12, length)`
is a smooth analytic falloff. What they lack is *variation*, which is AC-V4's subject, not AC-V1's.

## The billboard texture is built and measured

`packages/demos/scripts/build-vfx-billboard.mjs` generates `vfx-billboard-256.png` into the three
demos that have VFX. Measured: alpha reaches exactly 0 at the rim, max gradient **0.055** per pixel
overall and **0.008** across the outer boundary, against AC-V1's ceiling of 0.10.

It is a soft radial core with angular filaments layered over it. The filaments are damped toward the
centre as well as the rim, because angle changes fastest per pixel at the middle and undamped
angular variation there measured 0.153 per pixel — steeper than anything at the boundary, and over
the ceiling. That is a trap worth knowing about before authoring any radial effect texture.

**Wired in `point-light-expo` and `traversal-study`** — both build their effect batches inside
already-async factories, so the billboard loads beside the detail normal and threads through as an
argument. The view-facing-normal trick works: `normal.xy` maps the visible hemisphere onto the sprite
and reaches its rim, where alpha is already zero, exactly at the silhouette, so the edge softens
instead of ending.

**`combat-arena` is wired too**, and how it got there is the useful part: the three glow programs draw
*spheres*, not screen-facing quads. They carry `vNormal` and no `vUv`, so there is no texture
coordinate to sample with. The cheapest honest option is to sample by the view-facing normal —
`vec2(normal.x, normal.y) * 0.5 + 0.5` — which maps the texture across the visible hemisphere and
has the useful side effect of fading the silhouette, since the texture's alpha reaches zero exactly
where `normal.xy` reaches the unit circle. The alternative is to convert the glows to real
billboards, which is a larger change and worth its own decision.

**The obstacle is not the shader — it is resource lifetime.** An attempt to wire `combat-arena` got
as far as a compiling shader and then stopped here: `createCombatProjection` in
`src/combat-projection.ts` is **synchronous**, and `loadTexture` is not. There are three ways out and
they are not equivalent:

- Make the projection factory async. Cleanest to read, but it ripples through every caller and every
  test that builds one.
- Load the billboard higher up — in `renderer.ts`, where textures are already loaded and awaited —
  and pass it in. Smallest diff, and it matches how `detail-normal` is already threaded into the
  model batches in this same demo.
- Use `createTexture` against a canvas built synchronously from the generator's data, avoiding the
  load entirely. Removes the async problem but adds a code path that does not exist yet.

**The second is what landed.** `createCombatProjection` takes the billboard as an argument, and
`renderer.ts` — which is already async and already owns the catalog and the fleet — loads it and
passes it down. The projection borrows; the renderer owns.

One further correction the tests forced: the loader must be *injected* through
`CombatRendererDependencies` rather than imported and called directly, because `loadTexture` reaches
for `Image` and the renderer's rollback tests build a renderer with no DOM. Three tests went red on
`Image is not defined` before that was fixed. Every other GPU resource in that file is already
injected for exactly this reason.

`traversal-study` and `point-light-expo` build their effect batches inside already-async factories,
so neither has this problem — start with one of those if you want the shader work validated before
touching `combat-arena`'s lifetime code.

## Required outcome

1. ~~**Textured soft billboards for every VFX program**~~ (item 8). **Done, all three demos.**
   `foundry-glow`, `traversal-glow` and `arena-glow` each sample the billboard by their view-facing
   normal. **AC-V4 is satisfied**; it wanted at least one `sampler2D` per VFX program and previously
   had zero of three.
2. **Contact shadows and ring decals textured** (item 2). **Done for `point-light-expo` and
   `combat-arena`** — both contact-shadow shaders sample the billboard through `vLocal`, which
   already runs -1..1 across the quad and is therefore the UV. The analytic `smoothstep` stays: it
   guarantees the edge reaches zero at the inscribed circle, and the sprite adds variation on top.
   Rings are drawn by the glow batches and were textured with item 8.

   **`antiky-town` is exempt** — real shadows, no decal blobs.

   **`traversal-study` is not done, and needs a decision first.** Its contact shadow is drawn by
   `traversal-surface`, which also draws the HUD bars — texturing that shader would texture the HUD
   too. Either split the shader or give the contact shadow its own, and that is a small design
   choice rather than a mechanical change.

   Two test assertions had to move from counting uniforms to naming them. Both shaders were guarded
   by `Object.keys(shader.uniforms).length === 1`, standing in for "unlit"; a sampler that carries no
   light passes that intent but fails the count. They now name `uViewProj` and `uBillboard`, so a
   third uniform still fails.
3. **Timing rebuilt on curves, snap and secondary elements** (the rest of item 9).

   **Check AC-V2's premise before scoping this.** It asks you to "drive one impact event through the
   projection code and record emitted instance values per frame", which assumes event-driven bursts
   exist. In `combat-arena` the rings are *static arena decoration* — `combat-projection.ts:181-184`
   writes three of them at fixed radii every frame, driven by `state.phase` and `state.time` rather
   than by an impact. The per-instance `hit` parameter on the ship shader is the closest thing to an
   impact response, and it is a colour mix rather than a scale-and-fade curve.

   So the honest first step is an inventory of what actually fires on an event in each demo, the same
   way item 8 needed one for `antiky-town`. AC-V2's four measurements — peak scale within 3 frames,
   alpha at frame 10 under 25% of peak, scale-alpha correlation under 0.9, two elements with
   lifetimes differing by 1.5x — are the right shape, but they need something event-driven to measure
   and part of this step is building that rather than instrumenting it.
4. **An `antiky-town` VFX inventory first.** No audit document examined it, so there is no verified
   list to work from. Produce one before deciding what applies.

## Required tests and evidence

- **AC-V4**: every VFX program declares and samples at least one `sampler2D`.
- **AC-V1**: in a VFX-only capture, the per-pixel luminance gradient along every effect's outer
  boundary is at most 0.10 per pixel — every effect falls off over at least 10 pixels.
- **AC-V2**: drive one impact event through the projection code and record emitted instance values
  per frame. Peak scale within 3 frames; alpha at frame 10 at most 25% of peak; Pearson correlation
  between the scale and alpha curves under 0.9; at least two elements with lifetimes differing by at
  least 1.5x. `combat-arena/tests/presentation.test.ts:62` is the precedent for this style.
- `npm test` green.

## Worth measuring before assuming

A texture is not automatically better than a smooth analytic falloff — an analytic radial gradient is
smoother than any 512² texture and costs no memory. AC-V4 exists because VFX that are *only*
primitives read as primitives, which is a statement about variation rather than about edges. Measure
the contact shadow both ways before replacing something that already works.
