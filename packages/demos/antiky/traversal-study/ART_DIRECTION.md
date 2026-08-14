# Traversal Study — art direction

**Reference: LittleBigPlanet.** Written by goal 08 against the 2026-08-13 capture (the committed
`visual-metrics.json` at that date's digest is its record). Numbers below are measured, including
the ones that miss.

## The look in one sentence

A warm afternoon coast: a craft-material course in front of a real sky, its glyphs drawn in light.

## Palette strategy

Warm, hand-made, tertiary. The kit palette and the 64-stop hue-shifting ramp (6.69:1, 186° of hue
travel — goal 07's measurement) carry the material identity; the sky carries the atmosphere. Hue
clusters measured **5** with the largest at **78%** — the sky band still owns the chromatic frame,
and that is this demo's structural story (below).

## Value structure — measured, and partly missing

| bound | target | measured |
| --- | --- | --- |
| p05 | ≤ 0.12 | **0.39** — no darks in an open-horizon frame |
| p50 | 0.38–0.52 | **0.46** ✓ |
| p95 | ≥ 0.90 | **0.78** |
| spread | ≥ 0.72 | **0.39** |
| clipped | ≤ 1.5% | **0%** ✓ |
| dominant hue | ≤ 55% | **78%** |

**The misses are structural, not unattempted.** Three composition passes moved local contrast
0.16 → 0.56 and dominance 0.84 → 0.78: the sky went from one flat `clearColor` to a gradient dome
(fit to the narrow elevation band this camera actually sees — the first authoring spread the
gradient over the hemisphere and the frame saw one colour), the camera rose two units so the course
band owns more frame, and a second rank of coastal cliffs now fills the once-empty background. What
remains is what goal 99 row M12 already names for this demo's local-contrast floor: **bounds
authored against filled frames do not fit a side-scroller with an open horizon.** Reaching p05 0.12
means 5% of the frame near-black; nothing in a sunny LBP frame is near-black without either a stage
that fills the frame (a course-design pass, not a lighting pass) or darkness this brief would have
to lie to justify. The owner picks: retarget the row for this framing, or commission the stage
fill.

## Key / fill / rim

One warm sun with goal 07's camera-following shadow map (a 190-unit course cannot share one static
2048² map). SH-9 sky fill. The ramp does the silhouette work; rim stays subtle per the brief.

## Material language

The whole demo, unchanged from goals 05–07: plywood course, kit-swatch roughness, detail normals,
the sampled ramp. Clouds keep their wrapped diffuse (`uWrap`, per batch).

## VFX language

Soft, physical, papery — and now split by what a thing is:

- **Emissive glyphs are additive.** The checkpoint rings and the delivery pulse moved out of the
  alpha batch into an additive batch with a 2.6× colour gain: alpha-blended output can never exceed
  1.0, so those glyphs could never bloom no matter what the post chain did. At idle they sit warm
  (peak 0.85 encoded); an active delivery runs past 1.0 in linear light and blooms.
- Dust puffs (land, jump) stay alpha-blended: dust is matter, not light.
- Per-instance pulse frequency everywhere (AC-V3, goal 05); every glow samples the shared sprite
  (AC-V4).

## Composition and the HUD

The camera rides 5.4 above its target (was 3.45) and the background carries two ranks of coastline
so the frame reads as a place. The HUD sits on an ink plate now — the readouts used to float as
bare coloured geometry against sky, which is exactly what the goal's capture note called "a cluster
of coloured 3D boxes". (The HUD was already screen-space — goal 05 lifted it out of the surface
batch; the goal file's "world-space cubes" premise predates that.)

## What this brief deliberately does not do

No fabric-material intake (cloth sheen waits on fabric textures — goal 05 recorded the same), no
stage redesign, no ramp changes (its contract lives in `tests/lighting-ramp.test.ts`), no
threshold edits: the §7.1 misses above are reported, not retargeted.
