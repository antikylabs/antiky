# Antiky Town - art direction

**Reference: itself.** Goal 08's brief for this demo is targeted repair, not a look built from
nothing - the town was already the proof the stack can reach the target tier, and the goal's own
warning was that treating it like the other three is the main way to go wrong. Written against the
2026-08-13 captures; the committed `visual-metrics.json` is the record.

## What was already right, and stayed

The golden-hour sky and its visible sun, the warm-against-cool building faces, the composed plaza,
the voxel materials, the colour grade, the camera. Measured guard: the sky moved **≤ 1.8/255**
against the pre-goal baseline and the cleanest unowned in-focus stone **1.63/255** - the grade and
sky are provably untouched. The §7.1 lock - this demo's row is a floor measured from its own
baseline, not a target - holds on every bound: p50 0.308 (0.25–0.38), spread 0.481 (≥ 0.48),
clipped 0%, five hue clusters, largest 42% (≤ 50%).

## The five repairs

**Grass.** The owner's word was "horrid", and the mechanical cause was placement: a 2 m parity
lattice with 16% dropout, one stamp at one scale. Replaced by patch clustering - deterministic
patch centres (three of five weighted into the lawns the camera frames), radial falloff, continuous
jitter, a slope gate with hollow collectors, a two-cell feather toward pavement, plaza-distance
falloff, and a taller blade seasoning the short ones. `town-grass-distribution.test.ts` measures
all of it: nearest-neighbour CV ≥ 0.45 and a multi-modal spacing histogram, no repeated
(scale, yaw, type) stamp above 2%, scale p90/p10 ≥ 2, ≤ 10% of blades on steep faces, monotonic
density feathering at pavement, and every paved/canal/collider exclusion - the exclusions written
first, against the lattice, and watched fail.

**Trees.** One committed species table (`TOWN_TREE_SPECIES`: the summer broadleaf, its autumn
dress, the ridge sentinel) with every placement resolving to a row, groves added beside the old
singles (18 near trees from 10), wind driven at per-instance frequency (the AC-V3 rule - one
shared rate re-synchronises whatever the phases do), a view-dependent back-scatter lobe for
backlit canopies and a rim term gated by it. Honestly reported: the backlit ≥ 1.4× and rim ≥ 1.6×
probes could not be isolated by the current harness - the capture pair sways between shots
(goal 99 A9, the unpinned simulation) and the designated ridge tree borders the sun disc itself,
so any band probe mixes sky. The term's reach is proven by its first authoring, which visibly
over-glowed the stall tree at 0.85 and was dialled to 0.5 deliberately.

**Water.** Both water shaders traded the clamped, distribution-only `specGGX` for the reference's
energy-conserving Cook-Torrance GGX at a dielectric f0 of 0.02 - the `min(…, 3)` ceilings left
with the helper that needed them. The canal body gained real colour travel (striation along the
flow axis over a widened deep-to-shallow band) and crest foam at the banks' scale; the channel
strips striate down their runs. Measured between two captures: the water ROI moves 0.021–0.032
mean per-pixel (≥ 0.02), not as a rigid sheet. The depth-in-alpha contract is untouched and its
regression suite stays green.

**Shadow penumbra.** Every one of the seven shadow-sampling shaders widened its lookup from a
±1-texel grid to a vogel disk over ±2.6–3.2 texels, bias untouched. Measured: plaza shadow steps
that were unmeasurably hard now span 6 px and 13 px; the budget's acne probe stays green. A
blocker-scaled spread (the cheap PCSS estimate) was built for the voxel surface and backed out:
the pipeline invariants trace every shadow-map sample's dataflow, and a centre tap steering other
taps' positions is indistinguishable to the tracer from a sample leaking into the colour path.

**Depth of field and vignette.** A re-tune of a pass the demo already owned, exactly as the goal
ordered - the shipped numbers multiplied to a 0.034-pixel maximum blur radius, arithmetically
invisible. Now: far transitions 19–25 px against 2 px in the focus band, the nearest foreground
13–19 px, the midground characters bit-identical (sd ratio 1.002, mean Δ 0.08/255 against the
≤ 2/255 bar), corners 20.1% below centre (10–25 band), clean silhouettes monotonic outward, and
no new taps - the ring count is unchanged, so the ≤ 15% frame-time bound is met by construction.
The mobile path stays at zero.

## Open with the owner

- **The 8.5 local-contrast floor now collides with the tilt-shift.** The frame measures 7.79: the
  blur zones the owner asked for mechanically lower median tile contrast. This is goal 99 M1/M9's
  question in its sharpest form yet - the look is the one requested, and the number is the one the
  agent once proposed. Not adjusted here; budgets move only by the owner's hand.
- **Fountain spray is deferred with its measurement.** The jets now soften under the DOF and the
  water shaders' foam terms carry the read at the fountain's screen size (~40 px). A particle
  spray system (billboard droplets and mist at two lifetimes) is a real build the remaining goal
  budget could not close honestly; the criterion (AC-V1 on the jet boundary, AC-V2 timing) is
  recorded as not attempted rather than half-done.
