# Summary — goal 06-03: a specular model that does not need a ceiling

**Commit:** `40cad33` — Give point-light-expo a specular model that conserves energy

## The headline, first

The model was replaced, the ceilings and scale factors are gone, and energy conservation is proven
by integration. **The picture did not change** — and that is not a near miss, it is the finding.

Deleting the specular term from all three shaders entirely moves this frame by **0.080/255**.
Rewriting it moves it by **0.072/255**. Specular contributes essentially nothing to this scene as it
stands, so no specular model could have made the visible difference the goal asked for.

The goal's stated aim was that the image should move toward "materials look different from each
other". It did not, and the reason is structural rather than a defect in the work: three weak point
lights with inverse-square falloff over an eighteen-by-thirteen floor, against an SH-9 ambient that
carries no specular term at all. There is almost no direct light here to reflect. The goal's own
non-goals forbid touching lights or ambient — those are 06-04 and 06-05 — so the change that would
make this visible is explicitly out of scope here. **06-04's sun is where this work starts to show.**

## What changed

`specGGX` is the GGX distribution term on its own: no Fresnel, no geometry term, and a hard-coded
`0.25` where `1 / (4 · N·L · N·V)` belongs. Three call sites wrapped it in a ceiling and scaled it:

| Shader | Before |
| --- | --- |
| `reliquary-model` | `min(specGGX(…), 1.5) * 0.12` |
| `foundry` | `min(specGGX(…), 2.4) * (0.16 + metalness * 0.84)` |
| `reliquary-floor` | `specGGX(…) * 0.12` |

All three now call one `specularGGX(normal, light, view, roughness, f0)` carrying the GGX
distribution, height-correlated Smith visibility and Schlick Fresnel, with no ceiling and no scale
factor. `f0` is 0.04 for the dielectric floor and models, and `mix(0.04, albedo, metalness)` for the
foundry — so metals take their specular colour from albedo.

Two further corrections fell out of doing it properly:

- **Albedo no longer tints the specular.** All three shaders summed diffuse and specular and let the
  caller multiply the result by albedo, which gave every highlight the surface's own colour. A
  highlight is the colour of the light; how reflective a surface is at a given angle is what `f0`
  is for. Albedo now tints diffuse inside the light helper and ambient at the call site.
- **`foundry`'s `+ radiance * metalness * 0.2` is gone.** It was faking a metal highlight that
  Fresnel now produces properly.

## Why the ceilings could not have been fixed with better numbers

The premise this goal was written on — that `specGGX` returns more light than arrives — is **false**,
and measurement is what showed it. Integrated over the hemisphere it stays under 1 everywhere.

What is actually wrong with it is worse. The constant `0.25` replaces `1 / (4 · N·L · N·V)`, and both
of those follow the view, so the error is angular rather than a fixed factor. On a near-mirror:

| view | `specGGX` energy | full model |
| --- | --- | --- |
| head-on | 0.999 | 1.000 |
| 45° | 0.500 | 1.000 |
| near edge-on | 0.015 | 0.999 |

A 69x swing across view angle, against a model that stays flat. A per-call-site scale factor can only
ever be right at one angle — which is why there were three different factors and ceilings on top of
them. That is the justification for deleting them, and it is now the assertion
`a constant cannot correct the term the ceilings were containing`.

## Tests

`tests/specular.test.ts` mirrors the model in TypeScript, in the same shape as
`colour-pipeline.test.ts` mirrors the sRGB curve:

- **Energy conservation** — white-furnace integral ≤ 1 at 7 roughness values × 5 view angles, with
  `f0 = 1` as the worst case.
- **The integrator is tight enough to catch a violation** — a model inflated 5% must fail, and a
  near-mirror must reach 0.99 rather than merely landing under the ceiling.
- **Roughness is monotonic** — peak falls 37.17 → 0.005 and lobe width grows 0.18 → 0.93 across
  roughness 0.1 to 0.9.
- **Fresnel brightens a dielectric edge-on** — 79x rise at grazing for `f0 = 0.04` against 5.8x for
  `f0 = 1`, which isolates Fresnel from the visibility term that also rises there.
- **No call site clamps or scales the term**, and the mirror still names the same expressions as the
  shader, so the two cannot drift silently.

`pipeline-invariants.test.mjs` gains two: the compiled `specularGGX` body must be identical across
all three shaders, and no point-light-expo shader may still call `specGGX`. The divergence check was
proven to fail by changing one epsilon in one copy.

**An instrument correction worth recording.** The energy test first read 1.0211 and looked like a
real violation. It was quadrature error: at roughness 0.08 the lobe is about 0.006 radians wide, so a
256-step uniform sweep lands roughly one sample inside it. The test now importance-samples the GGX
distribution with a deterministic Hammersley sequence. Three of the four original assertions were
built on premises that measurement refuted — the file records which and why.

## The capture harness cannot pin an animated frame

Found while trying to attribute a change to the creatures, and it bounds what any of these
before/after comparisons can claim.

`scripts/shoot-demos.mjs` fences the capture on build and runtime revision but only waits
`warmUpFrames` — it never calls `pause_simulation` / `step_simulation`, which the goal's own capture
protocol asks for. Animated objects therefore land at a different phase on every run:

| comparison | whole-frame mean |
| --- | --- |
| 06-02 run A vs run B, identical code | 0.327 |
| 06-03 run A vs run B, identical code | 0.583 |
| 06-02 vs 06-03 | 0.619 |

The step change is inside its own run-to-run noise. About 2.2% of the frame moves between identical
runs, and a first pass at attributing creature differences to this shader was wrong for exactly that
reason — the crops showed a creature in a different pose, not a different material.

Every number quoted above is therefore measured on the 901,430 pixels (97.8%) that are static across
**both** same-code pairs. Whole-frame comparisons remain sound; per-object claims about anything that
moves do not. **Worth fixing before 06-04**, which will want per-object evidence for a shadow map.

## Budgets

| | | |
| --- | --- | --- |
| `clipping.high` | 0 | ceiling 0.02 — removing the clamps blew nothing |
| `clipping.low` | 0 | ceiling 0.02 |
| `edges.hard` | 0.00681 | ceiling 0.0085 |
| onboarding probe | 0.143 | floor 0.11 |
| `localContrast.median` | 6.73 | floor 8.5 — **still failing** |

`npm test` green. `npm run demos:verify` reports the same 7 failures as before this step and no new
ones: traversal-study's stale digest (×3), the local-contrast floor on combat-arena and
point-light-expo, the atlas gutter (goal 14) and material tone-maps in other demos (goal 07).

Local contrast is unchanged at 6.73 because, as above, specular is not what is lighting this scene.
It is 06-04 through 06-06 that have to move it.

## Note for the next step

`src/renderer.ts` is 446 lines and unchanged by this step. The cohesion review at 500 that 06-02's
summary flagged is still pending, and 06-04 adds a shadow pass.
