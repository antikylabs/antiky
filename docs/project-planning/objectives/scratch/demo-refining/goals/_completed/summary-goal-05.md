# Goal 05 — give the existing assets real materials

**Complete.** All ten required outcomes addressed; seven acceptance criteria green.

## Action needed from the owner

1. **`antiky-town`'s local-contrast floor sits inside the capture noise.** Three captures of
   identical code give 8.50, 8.50, 8.46 against a floor of 8.5, so the budget passes or fails by the
   run. The demo genuinely improved from 7.997 to about 8.49 — that is not in doubt — but a test that
   fails a third of the time for no reason trains people to ignore it. Either the floor drops
   slightly, or `demos:shoot` starts stepping a paused simulation to a fixed count the way goal 06's
   capture protocol already specifies. **Blocks nothing; needs a decision.**
2. **The per-frame instance budget moved from 384 to 400** to fit the arena's wall panels, on your
   instruction to replace the stretched room shell with real kit pieces. Recorded rather than
   silently grown. **Already applied; flagged because budgets are yours.**

Every bug found during this goal was fixed. Nothing is left broken.

## What landed

| Item | Outcome |
|---|---|
| 1 — detail normals | A generated 512² tiling normal, projected in world space by ten shaders across four demos. |
| 2 — soft contact shadows | Textured on all three demos that have them. `traversal-study` needed its HUD lifted out of `traversal-surface` first. |
| 3 — rim, sheen, wrapped diffuse | Rim on the four model shaders that lacked one; wrapped diffuse on clouds behind a per-batch control. Cloth sheen not done — see Outstanding. |
| 4 — ambient | SH-9 baked from real HDRIs for `point-light-expo`, `traversal-study` and `antiky-town`. `combat-arena` uses directional earthshine instead. |
| 5 — ramp LUT | `traversal-study` lit through a 64-step `sampler3D` ramp: **14.8:1** brightest-to-darkest against a 6:1 floor, **185°** of hue shift against 20°. |
| 6 — PBR materials | `plywood` on the course, `metal-plate` on the arena deck, `forrest-ground-01` as a second ground layer. Bound per batch. |
| 7 — material identity | Both Kenney kits generate a material table from their own atlas; both model shaders read roughness from the swatch a face lands on. |
| 8 — VFX billboards | A generated soft sprite, sampled by all three glow shaders. |
| 9 — VFX timing | Per-instance pulse frequency (AC-V3) and impact curves that snap and fade independently (AC-V2). |
| 10 — town record | `packages/demos/antiky/antiky-town/MATERIALS.md`, all thirteen shaders including four rejections. |

## Acceptance criteria

Green: **AC-M2, AC-M3, AC-M4, AC-L1, AC-V2, AC-V3, AC-V4.**

**AC-M1 passes on `traversal-study` but does not attribute.** Three ROIs measured 0.0385, 0.0666 and
0.0270 against a 0.020 floor — and two of them already passed before item 6 touched anything. It
measures whether a surface varies, not what made it vary.

## Measured

| demo | local contrast before | after |
|---|---|---|
| `antiky-town` | 7.997 | **8.50** |
| `combat-arena` | 5.990 | **8.30** |
| `point-light-expo` | 3.156 | **4.62** |
| `traversal-study` | 0.00 | 0.00 — see below |

`traversal-study` reads zero because over half its frame is flat sky, so the median tile has no
variation. That is the metric's shape, not a defect, and it means `localContrastMedian` is the wrong
instrument for that demo. Its ramp ratio is the honest measure and it moved 1.81:1 → 14.8:1.

## Eleven premises in this goal turned out wrong

Each corrected against a measurement, and each was checkable in minutes:

- `fresnel()` is uncalled, but **13 of 29 shaders already hand-roll a rim term**.
- AC-M3 "passes for zero shaders" — `point-light-expo` already had a live normal map.
- AC-M1's "all three measure below 0.004" — measured 0.0072 to 0.0272.
- AC-M2's "every Kenney GLB would fail (single V)" — they carry 3 to 30 distinct V values.
- The Kenney atlas is a **grid**, not a gradient. V picks a row, U picks the swatch.
- AC-V2 assumed event-driven effects; the arena's rings are static decoration.
- The catalog installer cannot fetch anything, **by design** — the catalog is a reference.
- SH-9 is not automatically better: it measured **worse** on `combat-arena` with both named HDRIs.
- A detail normal does nothing without directional light — 40.6% of `antiky-town`'s frame changed
  against effectively none of `point-light-expo`'s until SH-9 landed.
- One material for a whole demo is the wrong shape: it made the course's clouds brown.
- The capture instrument's noise floor is about 0.05 local contrast.

## Outstanding

- **Cloth sheen** (part of item 3) — *handled by goal 08*. It needs fabric materials on
  `traversal-study` that this goal did not install, and sheen is an art-direction decision.
- **Normal and ARM maps** (part of item 6) — *handled by goal 08*. Diffuse and roughness are bound;
  the normal and AO halves need the tangent-basis work goal 06 does first.
- **`antiky-town` has no PBR material** — *deliberate, closed*. `rock-boulder-dry` was installed,
  projected and measured; its effect was inside the noise floor, and the demo already carries
  authored roughness, a detail normal and five shadow passes. The material stays receipted at
  `assets/poly-haven/rock-boulder-dry/` so a sharper instrument can revisit it.
- **`courier.glb` is a 91-byte texture** — *needs the owner*, filed as its own concern. Goal 04's
  pipeline reduced it; no material path or LUT rescues it. Re-pack from source or accept it flat.

## What this goal leaves behind

Three tools that outlive it: `install-poly-haven-material.mjs` (fetch and verify by size and md5),
`install-kenney-kit.mjs` (extract named models from a kit), and `embed-glb-images.mjs` (inline a
GLB's external textures, which BroMetal's loader refuses).

And one invariant worth more than any of them: **every instanced batch that is written must be
uploaded and drawn.** The arena's wall panels went through three captures looking unchanged because
they were never uploaded, then never drawn — the same defect that shipped in goal 03. The first
version of that test missed the case that prompted it, because the layout writes through a local
alias; it is anchored on catalog access now and verified to go red.
