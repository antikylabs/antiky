# Summary — goal 06-05: ambient that knows which way is up

**Done, with one piece deferred and registered.** The goal's core intent — ambient that varies with
which way a surface faces, and occlusion that touches only ambient — is met and tested. Two of its
five required outcomes were already satisfied by better means before this step began, and one is
deferred with a measurement saying why.

**Commit:** `a80f67f` — Stop ambient occlusion dimming direct light in point-light-expo

## Action needed from the owner

**None.** The one defect found was fixed, and the deferral below is a gap that measurement says is
worth about 4%.

To be aware of rather than act on: **the rock models still have no ambient occlusion.** The bake that
would give them some is written, tested and deterministic, but wiring it into the shader blanked the
scene and the rock measured only 3.9% occluded at its tenth percentile — it is a set of convex
boulders with very little to occlude. Registered as **A13**. *Not handled by a later goal; it needs
someone to pick the row up or close it.*

## The goal's premise had moved on, in two places

**Ambient is not "a single constant added to everything".** That was true when the goal was written.
Goal 05 replaced it with a nine-coefficient spherical-harmonic bake of a real sky, which is a
superset of the hemispheric ambient this goal asks for: hemispheric blends two colours by the
normal's vertical component; SH-9 reconstructs a full directional field and reproduces a hemisphere
as a special case. **Required outcome 1 was already met, better.**

**Outcome 2 — "no single-colour ambient constant survives; grep finds none" — was not done, on
purpose.** `surfaceAmbient.color` and `floorAmbient.color` do survive in `presentation.ts`, but not
as ambient. `ambient.ts` uses them to set the *level* of the baked sky, so that adopting a real sky
changed the direction of the light without also changing how much of it there was. Deleting them
would delete that normalisation and re-brighten the scene by about four times. The comment in
`ambient.ts` already explains this at length; the goal's grep test would have removed a deliberate
piece of design.

**`luminanceP05` has no W0.3 bound to meet.** The goal expects this step to bring it good. The
budget was rewritten before this to prefer local contrast over percentile spread, with the sidecar
recording `spread` as "descriptive only" because it tracks peak brightness at r = 0.99. The real
"are the darks crushed" check is `clippedLow`, which measures **0** against a 2% ceiling.

## The defect that was real

`reliquary-model` computed `base.mul(ambient).add(relay).add(sunRadiance).scale(occlusion)` — so a
crevice was darkened once for seeing less sky and **again for seeing less sun**. That is the exact
mistake the goal names, and its signature is what this demo had: shadowed areas that go flat and grey
instead of dark and shaped.

It now reads `base.mul(ambient.scale(occlusion)).add(relay).add(sunRadiance)`. The rim term keeps its
occlusion because it is ambient — `uSh0` is the sky's average over the whole sphere, which is what a
surface turning away from the camera catches.

`reliquary-floor` already had this right: `shIrradiance.scale(uAmbientStrength * ao)`.

`tests/ambient.test.ts` asserts both, and was proven to fail by putting the old expression back.

## Measured

| Requirement | Result |
| --- | --- |
| Up-facing vs down-facing ambient differ ≥ 30% | **90.1%**, on both sky bakes |
| Inside corner ≥ 15% darker than a flat face | **42%** on the two models with an occlusion texture; **none** on the rocks |
| Occlusion does not touch direct light | **Passes**, proven able to fail |
| The bake is deterministic | **Passes** — two runs, identical bytes |
| `clippedLow` inside its 2% ceiling | **0** |

Local contrast 7.5566 → **7.6056** with the occlusion fix. p05 0.004012, p50 0.1285, p95 0.3965.
Clipping 0 at both ends. The shadow probe from 06-04 still reads 32.4%.

A sideways-facing surface is also asserted to land *between* sky and ground bounce — a term returning
two values and nothing between would pass the 30% test while reading as a hard terminator around
every object.

## The occlusion bake exists and works; it is not wired

`packages/demos/scripts/bake/vertex-occlusion.mjs`, with `packages/demos/tests/vertex-occlusion.test.mjs`.
Cosine-weighted Fibonacci hemisphere, uniform grid for ray acceleration, no randomness anywhere.

**It is tested against shapes whose answer is known by looking at them**, and that is what caught the
bug in it: the first version returned "fully open" for every vertex of every shape, including the
underside of a roof, and looked entirely reasonable doing it. The cause is worth recording —

> It searched a fixed two-cell neighbourhood around each ray's origin, but the grid is built over the
> mesh bounds. A flat model has cells that are wide in x and z and paper-thin in y, so an occluder a
> fifth of a unit overhead sat twenty-four cells away and was never tested. **A neighbourhood
> measured in cells cannot bound a distance measured in world units.**

Fixed, it reads 47.3% darker under a roof and 1.000 in the open.

**Why only the rocks need it.** `tree-stump` and `dead-tree` ship proper ORM textures — red is
occlusion — and a 1K texture beats a per-vertex value on any mesh. `rock-moss`'s `catalog_material`
image is a single greyscale channel replicated across RGB, which is roughness with no occlusion in
it, so the shader has been giving those rocks `occlusion = 1`. That is a genuine gap, now stated in
the shader rather than looking like a choice.

**Why it is not wired.** Adding the vertex attribute blanked the scene — only the onboarding overlay
survived, which means the whole scene pass stopped. Two hypotheses were checked and eliminated: the
vertex counts match (both bake and runtime take `meshes[0]`, 8,538 vertices), and BroMetal does
support a single-float vertex attribute (`vertexFormat` returns `float32` for size 1). Rather than
keep guessing, it was reverted: the baked rock measured **3.9% darker at p10** and 1.2% at the
median, because a set of convex boulders has almost nothing to occlude. Only the deepest crevice
reaches 45%.

Shipping a build step, 11 KB of committed data and a vertex attribute for a 4% effect is the kind of
trade `GOOD_ENGINEERING_H.md` says to decline. The tool is kept because it is correct and the next
concave asset will want it.

## Left failing

`npm test` green. `npm run demos:verify` reports the same 7 failures as before this step: three from
`traversal-study`'s stale digest, the local-contrast floor on `combat-arena` and `point-light-expo`
(7.61 against 8.5 — 06-06's job), the atlas gutter (goal 14), and material tone-maps in other demos
(goal 07).
