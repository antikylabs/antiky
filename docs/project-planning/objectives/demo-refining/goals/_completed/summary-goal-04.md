# Summary — goal 04: stop the asset pipeline destroying the assets

**Completed:** 2026-08-12
**Commits:** `6918407`, `6481d96`, `9a6087e`, `0941360`, `bf56f6c`
**Goal file:** [`execute-goal-04.md`](execute-goal-04.md)

## Action needed from the owner

**One decision.**

| # | What | Why it needs you |
|---|---|---|
| 1 | **`antiky-town` now fails its local-contrast budget: 8.63 → 7.23 against a floor of 8.5.** The sRGB decode darkened mid-tones 28.5%, exactly as the goal predicted. | The goal says explicitly not to re-tune the post grade to hide the shift, so I did not. The demo is now correct and darker, and its grade needs a pass from the art-direction goal. **Nothing is broken** — the frame reads better, not worse. You may simply want to know the number moved the wrong way while the picture improved. |

## The headline: a defect I shipped, found by looking

**`point-light-expo` was completely broken and had been since goal 03's commit `72ccb6a`.** My contact-shadow batch wrote instance data and drew, but never called `upload()`. BroMetal refuses a draw with empty instance buffers — *"no instance data — call set(...) before draw()"* — and the whole demo failed to start.

Every suite I reported green in between was green. Nothing caught it because **every test in that demo runs without a GPU**, `demos:shoot` still produced a frame and plausible metrics, and my own goal-03 summary claimed the contact shadows worked on evidence I only had for `combat-arena`.

It is fixed, with a test that fails when the fix is removed: every batch in `RelayVisualBatches` that is drawn must have its instance data uploaded. All five demos were then confirmed to reach `running` in a real browser.

## Two of the goal's premises did not survive measurement

**W C.1 was wrong.** The goal says `normalize-quaternius.mjs` destroys texture coordinates, and that this is why `cloud-large`, `cloud-small` and `coastal-cliff` ship 1×1 textures. Checked three ways:

- The asset receipt records `embeddedTexture` for Kenney's kit and **nothing** for Quaternius.
- Every palette holds exactly the source material count in flat colours — cloud-large 1 (`#909781`), coastal-tree 2, courier 6, relay-tower 7.
- The same publisher's **spaceship** pack *is* textured (2048², 711–2366 unique UVs) and `combat-arena` preserves it by copying the GLB wholesale.

Quaternius' Ultimate Platformer pack is flat-shaded low-poly: colour lives in `baseColorFactor` and there is no source texture. `cloud-large` is 1×1 because the model is one colour. That is a faithful encoding, and "restoring TEXCOORD_0" would have meant inventing an unwrap for a texture that does not exist.

**So `traversal-study` looks flat because the source art is flat.** That is a materials and art-direction question, not a pipeline bug — worth knowing before a later goal expects textures to appear.

**W C.2's 3× probe target is not met, and I did not lower it to pass.** Against the same frame with normal mapping off: frame-to-frame noise floor **0.000**, mean delta 1.388, 4.72% of pixels changed, local luminance standard deviation up to **1.46×** on lit rock. Sweeping the triplanar scale gives 1.46/1.40/1.39/1.37× at 0.55/1.6/4.0/9.0 — flat in scale, so the ceiling is elsewhere: the probe's variance is dominated by albedo detail and VFX, not by the normal. The 3× reads as uncalibrated.

## What landed

| Packet | Outcome |
|---|---|
| W C.1 | Premise disproved. The false script-level invariant was replaced by two data-level ones that judge the **shipped model**: a model with a real texture must have real UVs, and a palette-baked model must ship an actual palette. |
| W C.2 | Normal maps packed and sampled. All three derived GLBs declare `normalTexture`; triplanar projection in object space, rotated to world, so props do not swim at different yaws. |
| W C.3 | Filtering decided by **texture class** in one place: palette strips get nearest and no mips, real textures get trilinear and anisotropy 8. Supersedes goal 03's interim blanket `nearest`, which was also being applied to Kenney's 512² colormaps. |
| sRGB decode | Ten shaders across four demos. Data textures — normal, ARM, roughness, shadow, scene target — are explicitly excluded and a test enforces that. |
| Convergence | One `asset-fidelity-policy.mjs` imported and enforced by the packing scripts. Verified it rejects the real defect by name. `antiky-town` excluded, with the exclusion itself asserted. |
| Atlas bleed | Measured, not assumed. **Change nothing.** |

## Findings worth keeping

**The decode had to be duplicated, and the duplication is guarded.** The BroMetal MVP resolves only *"module-level helper functions declared above their first use"* — an imported helper fails to compile, so `decodeSrgb` is declared in each of the ten shaders. A test asserts every copy is byte-identical after whitespace normalisation, so forced duplication cannot become drift.

**The mip footgun is real and was avoided.** A `texture()` call inside a DSL helper compiles to `textureSampleLevel(…, 0.0)` and silently loses mips. Every material sample stays inlined in `fragment()`; the generated WGSL contains `textureSample` and no `textureSampleLevel`.

**Correction, found later the same day: the atlas does bleed.** The measurement below sampled boxes
that never crossed a tile boundary, so it reported a clean result from a check that was not looking
at the thing it claimed to measure. Corrected, it reads 25.3%. Goal 14 owns the fix. The original
finding is left in place below because the mistake is the useful part.

**The atlas appeared to pass for a weaker reason than padding.** `antiky-town`'s material atlas carries **no padding**, and `1254 / 4 = 313.5` means the tile grid does not land on texel boundaries at all. Bleed measures 0.3% at mip 2 and 0.0% at mips 3–6 — it passes because the twelve tiles are natural materials whose colour gamuts overlap, so an average of two adjacent tiles lands inside one of them. A future tile that breaks that pattern would break the seam, which is why the measurement is now a test rather than a note.

**Two DSL limits, one of which the goal warned about.** `.zy` is not a legal swizzle — only `.xy`, `.xz`, `.yz` — as the goal said. It did **not** warn that `abs` is scalar-only, which the triplanar blend weights hit immediately.

**A metric moved the wrong way again while the picture improved.** `antiky-town` lost 1.4 of local contrast to the decode and looks visibly better for it: the muddy wash is gone, roofs read orange, stone reads grey. That is the second instance in this objective, after the foliage sun. It belongs with M1 and M7 on the register.

## A trap for whoever verifies next

`npm test` failed twice during verification with **zero failing tests**, and neither was a code
defect:

- `Failed to collect page data for /icon.svg` — a `next dev` server was running and its `.next`
  cache collided with the `next build` the suite runs.
- `ANTIKY_ARTIFACT_MANIFEST_MISSING (traversal-study)` — `demos:stage` writes `antiky-artifact.json`
  into each demo's `dist`, and any later `vite build` in that demo deletes it again through
  `emptyOutDir: true`. Running a demo build by hand between staging and verifying breaks staging.

Both are verification-environment races. **Stop any dev server and avoid hand-running a demo build
before `npm test`.** Worth knowing because an exit code of 1 with no failing test looks alarming and
sent me looking for a defect that was not there.

## Outstanding

| Item | Disposition |
|---|---|
| `antiky-town` below its contrast budget after the decode | **Art-direction goal.** Explicitly not re-tuned here, on the goal's instruction. |
| Local contrast still below 8.5 on all four demos (6.05 / 0.00 / 3.14 / 7.23) | **Goals 06–08.** This goal restores data; it does not light it. |
| `traversal-study` at 0.00 | **Not a pipeline defect.** Flat source art plus a frame that is over half empty sky. Composition and materials. |
| The 3× normal-map probe threshold | **Register.** Measured at 1.46× and flat in scale; the threshold looks uncalibrated rather than the implementation being wrong. |
| `no material shader tone-maps` invariant still red | **Goal 06.** Not in this goal's scope. |
