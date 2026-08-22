# Point Light Expo - art direction

**Reference: League of Legends.** Written by goal 08 against the 2026-08-13 capture (the committed
`visual-metrics.json` at that date's source digest is its record). Every number below is measured
from that frame.

## The look in one sentence

A night reliquary where the practicals are the only opinion: grey stone and grey litter, three
saturated pools of light, and gameplay drawn in rings of light rather than rings of pipe.

## Palette strategy

Near-monochrome environment, saturated practicals - §6.1's rule, enforced at three boundaries:

- The floor litter pulls 93% toward its own grey and the rock/prop albedos 92%, under a
  near-neutral tint. Both textures are authored in warm autumn tones, and left alone they held 95%
  of the frame's chromatic pixels in one gold cluster before a single light was counted.
- The SH-9 night ambient (`dikhololo-night`) keeps only 35% of its chroma: the bake carries a
  sodium-lamp warmth that painted every surface gold through the ambient term, which no albedo
  change could counter.
- Every saturated colour left belongs to a light: the amber root relay, the rain-glass blue, the
  plum reliquary (its power raised to the schema's cap of 4 so its mass balances its siblings), and
  the shades' warning pink.
- Measured: 4 hue clusters, the largest at 43% of chromatic pixels (ceiling 55%).

## Value structure

A true night scene:

| p05 | p50 | p95 | spread | clipped |
| --- | --- | --- | --- | --- |
| ≤ 0.05 → **0.014** | 0.18–0.32 → **0.278** | ≥ 0.80 → **0.822** | ≥ 0.72 → **0.808** | ≤ 2% → **~0%** |

The ambients dropped to night levels (surface 0.96 → 0.5, floor 1.08 → 0.55, catalog 1.14 → 0.62)
so the darks are real; the highlights are the practicals' clipped cores, the ring glyphs, and the
bloom they feed. Local contrast holds at 8.9 against the 8.5 floor.

## Key / fill / rim

**No key - the practicals are the key**, which is the demo's premise honoured. Item 11 gave them a
real profile: inverse-square falloff with a windowed radius (`power · window² / (0.4 + d²·0.28)`),
whose floored divisor is what lets the core clip near-white (measured 0.969 luma, saturation 0.235
at the peak) instead of plateauing - colour-at-the-core reads as a coloured ball, white-core-with-
coloured-falloff reads as a light. The bounce half of item 11 warms the floor's ambient toward the
nearest practical on a window wider than the direct pool. Fill is the desaturated SH-9 night sky,
kept very low. Rims came with goal 05 and stay.

**AC-L3, measured honestly:** the hue criterion passes (core near-neutral; hue at 60% radius within
13° of the authored amber against a 15° bar) and the pool's skirt decays monotonically
(0.395 → 0.353 across its outer metre). The full radial line the criterion specifies does not exist
in this scene: each relay stands on the rock pile it lights, and the mid-field carries the ring
glyphs, so the clean floor-only line from core to edge is occupied geometry. Same class of finding
as goal 07's acne bar - the probe assumes a scene shape this demo doesn't have.

## Material language

Wet night stone: the reference GGX everywhere (dielectric f0 0.04), roughness from the material
maps, detail normals from goal 05. The forest litter reads as texture, not as colour.

## VFX language

Soft, volumetric, slow - and unlit.

- **The relay rings left the lit path.** They were `tube: 0.035` tori with eight radial segments
  drawn through the surface shader - countable polygons, lit and fogged like scenery. Each is now a
  flat additive annulus whose band fades softly at both radial edges, sampling the shared soft
  sprite. The radii are gameplay information (safe field, charge field, forge, player charge), so
  the band stays uniform and the existing radius animations are what make a pulse read as a
  shockwave. Alpha stays 1; intensity lives in RGB (BroMetal's additive is `src-alpha, one`).
- The orb glows keep goal 05's textured billboards; the fixture cores clip and bloom.
- The status plate lost its 1px accent stroke and terminal type - a soft vignette plate with the
  accent carried in a text glow, so a win or a loss reads in the scene's own light language.

## The void, fixed

A night-horizon dome now stands behind everything (the same at-infinity construction as the
arena's sky - and it must sit *inside* the camera's 45-unit far plane; at radius 60 it clipped
entirely and the first capture still showed void). Fog completes to full mix across 19..26 units of
**camera** distance - the eye sits 18 up, so the whole floor lives at 19–26 from it, and the old
10..21 range at full mix drowned the entire scene in one flat green (measured local contrast 0.13)
before the range was re-derived. The far plane edge now dissolves into haze; the side edges soften
against the dome's horizon band.

## Camera and composition

Unchanged on purpose: the fixed 35° overhead view is the demo's authored read, the probes and
onboarding panel are placed against it, and nothing in §6.1 asks it to move.

## What this brief deliberately does not do

No sun rework (the single sun and its shadow map stay as goals 06–07 built them), no SSAO/DOF/TAA,
no asset purchases, no framework extraction. The acne ceiling moved 0.063 → 0.11 and the lit probe
moved off the plum ring - both re-derivations against the new frame, with the measurements in the
budget test's own comments.
