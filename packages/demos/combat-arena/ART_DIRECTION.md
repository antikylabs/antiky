# Combat Arena - art direction

**Reference: Rocket League.** Written by goal 08 against the 2026-08-13 capture (the committed
`visual-metrics.json` at source digest of that date is its record; captures themselves are not
committed). Every number below is measured from that frame, not aspired to.

## The look in one sentence

A night stadium in orbit: neutral steel under a white rail of light, the saturation owned by the
two team signals, everything glossy enough to smear.

## Palette strategy

Cool **neutral** stadium, two hot team colours, one accent.

- The structure's own paint pulls 85% of the way to grey in the shader (`uDesaturate`, per batch) -
  the kit's blue-painted panels otherwise put two-thirds of the frame's chromatic pixels in a
  single blue cluster, which is the "everything is one colour" failure the hue budget catches.
- The ambient (`0.578, 0.582, 0.60`) and the four working floodlights (warm-neutral and
  cool-neutral) are deliberately near-achromatic: light that tints re-saturates whatever the paint
  gave up.
- The saturation lives in: **team red** (`1, 0.3, 0.24` - the near-end practical, enemy signals),
  **team cyan** (`0.3, 0.85, 1` - the far-end practical, the player's ring and HUD), and the amber
  props as the one accent.
- Measured: 4 hue clusters, largest 46% of chromatic pixels (ceiling 55%).

## Value structure

The widest of the four demos, and the §7.1 row demands it:

| p05 | p50 | p95 | spread | clipped |
| --- | --- | --- | --- | --- |
| ≤ 0.04 → **0.028** | 0.20–0.34 → **0.317** | ≥ 0.88 → **0.891** | ≥ 0.80 → **0.863** | ≤ 2.5% → **0.58%** |

Near-black lives in space (the Milky Way band runs at 0.046 of its authored gain; the low camera
aims straight at its core, which is why it took three measured steps to get there). The mids are
the deck. The highlights are item 14's emissive trim - the rail at y 1.62, the skirting line at
0.34, a thin lit coping at the wall top, inward faces only - plus the six fixture glows seated on
the rail, the practical pools, and the ships' specular.

## Key / fill / rim

- **Key**: one sun, `(-0.52, 0.58, -0.63)`, 35° - goal 07's measured choice, unchanged, with its
  camera-following shadow map. Shadow probes re-derived for the new camera and verified against a
  shadow-off control: the shadow box darkens 31%, the lit box moves under 2%.
- **Fill**: planet earthshine from below-left - an arena in orbit is lit from underneath, and
  down-facing surfaces are legitimately the bright ones. Near-neutralised by this goal so it fills
  without tinting.
- **Rim**: team-coloured, always on, every ship (`rim * 0.34 * vTint`). Goal 07 found the term
  gated behind the emissive parameter so it only appeared on dashing ships; ungated here.

## Material language

Glossy painted metal. The hulls carry the reference's Cook-Torrance GGX (roughness 0.26, painted
f0 0.07, `pipeline-invariants` holds every copy identical) - measured hull p95/median **3.88×**
against the ≥ 2× specular criterion. The deck is the star: diamond plate with a **planar
reflection** (item 15) - the camera mirrored through the deck plane at y −0.145, ships, glow and
the trim-lit walls drawn again at half resolution, sampled through `targetUv` and broken by the
plating grain. A physically honest mirror shows a ship's dark belly, so the bright thing the deck
reflects is the rail: measured against a reflection-off control, the deck below the central
fixtures returns 0.34–0.53× their own luminance, decaying below 0.05× by four metres.

## VFX language

Fast, hard, punchy; additive into HDR so it blooms.

- **Ribbon trails** (item 16): each projectile draws its trail as one tapered stroke from a CPU
  history buffer - two segments sharing endpoints - never a chain of sprites. The alpha channel
  stays at 1 by design: BroMetal's additive is `(src-alpha, one)`, so intensity lives in RGB.
- **Impact distortion** (item 17): expanding rings write a screen-space offset field into a
  quarter-res target; the post pass bends its scene lookup through it. The bloom deliberately
  samples unwarped - the air ripples, not the lamp.
- Per-instance pulse frequency everywhere (AC-V3), textured billboards everywhere (AC-V4), snap
  and independent decay curves on impacts (AC-V2, `tests/presentation.test.ts`).

## Camera and composition

Committed: **low and long-lensed** - eye `(x·0.08, 10.0, 22.5)` following play, 30° vertical FOV,
against the old 13.4-high 47° diagram. The whole deck stays framed because this is still a game
you play top-down; the flat perspective is what gives the ships silhouettes, lets the walls read
as architecture, and puts the camera low enough that the deck reflection arrives at grazing.
Terminal framing and pointer drift keep their old behaviour, re-based to the new pose
(`tests/presentation.test.ts` carries the exact numbers).

## What this brief deliberately does not do

No fog rework (one agreed range, 17–34), no second sun, no SSAO/TAA/DOF, no owner-budget changes:
the instance budget moved 400 → 420 only by the arithmetic of items 16 and 17 (+72 ribbon
segments, +7 ripples, −28 deleted cables, −30 glow slots the ribbon freed), and the summary flags
that move to the owner.
