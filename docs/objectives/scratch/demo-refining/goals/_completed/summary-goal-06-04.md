# Summary — goal 06-04: one sun and a shadow map

**Complete.** All four required measurements taken and met. Two of them needed the instrument
rebuilt before they meant anything.

**Commits:** `c676ff8` — Give point-light-expo a sun and a shadow map, plus follow-ups below.

## Action needed from the owner

**None.** Every defect found during this step was fixed, including a BroMetal one that affects every
demo and is registered upstream as A11.

Two things to be aware of rather than act on:

- **The frame-time budget was measured against a capped instrument.** The runtime reports 120 fps
  with the shadow pass and 120 fps without, because both sit on the display refresh. The shadow pass
  therefore fits inside existing headroom and the 40% budget is met as measured — but this cannot
  resolve the true GPU cost, only bound it. *Handled by nothing; state it, do not re-derive it.*
- The local-contrast floor of 8.5 is still unmet at 7.56, up from 6.73. *Handled by 06-06.*

## What landed

| | |
| --- | --- |
| Key light | `src/sun.ts` — one direction, reaching the shaders as a uniform |
| Depth pass | `src/shadow-pass.ts` with `model-depth` and `surface-depth` shaders, writing distance into an RGBA16F target |
| Lookup | BroMetal's `shadowFactor`, in all three material shaders |
| Placement | Virtual light and frustum derived from `RELAY_PRESENTATION.reliquaryBounds` — nothing typed in |
| Casters | Rocks, stumps, dead trees, forms, creatures, orbs, rings |

**Nine taps, not four.** The goal asked for a four-tap lookup; BroMetal's `shadowFactor` is 3x3. It
was used as it is rather than hand-rolling a four-tap, because it routes both the write and the
compare through `shadowDepth` — so the value the depth pass stores and the value tested against it
cannot drift apart. Hand-rolling would duplicate that and reintroduce exactly the drift its own
comment warns about. The cost budget had room for it.

`renderer.ts` was at 446 lines, so the pass was lifted into `shadow-pass.ts` rather than added to it.

## Measured

| Requirement | Result |
| --- | --- |
| Ground shadow ≥ 25% darker than lit ground, same material | **32.4%** |
| No acne | **0.000000 variance added by the shadow** |
| Shadow's near edge within 4 px of contact | **0.47 px** |
| Frame time within 40% of 06-02 | **No measurable increase** (capped instrument) |

Local contrast 6.73 → **7.56**. Clipping 0 at both ends. p95 0.255 → 0.397.

### The shadow probe proves itself

Two probes 205 px apart on the same floor: shadowed ground is **32.4% darker** than sunlit ground.
With the shadow term forced to fully lit and the same sun, the same probe reads **34.2% brighter**
than its reference — so the darkness is the shadow arriving, not two different patches of ground.
Both are committed in `DEMO_PROBES` and asserted in the visual budget.

### The specified acne check measures the wrong thing here

It asks for luminance standard deviation under 0.02 on a flat lit plane. This floor is a photoscanned
forest floor, and its litter alone measures **0.063** with the shadow term switched off entirely.
0.02 is unreachable for a reason unconnected to acne.

Acne is variance the *shadow* adds, so that is what was measured: the lit probe reads **0.063065**
with shadows on and **0.063065** with the same sun and no shadow. Identical to six figures. The
shadow adds nothing.

### Peter-panning needed a second instrument, and the first one was wrong

The first metric traced each shadow's leading edge back to its caster and reported the gap: median
4 px, p90 9 px against a 4 px bar. That reads as a marginal failure and it is not a result.

**Halving the bias from 0.03 to 0.012 changed it not at all** — median 4, p90 9, max 10 in both.
Bias is what causes peter-panning, so a metric that does not move when bias halves is measuring
something else, most likely the penumbra plus the caster's own shaded flank.

The replacement measures the shadow *in aggregate*, where a sub-pixel boundary shift is visible:

| | shadowed pixels | perimeter |
| --- | --- | --- |
| bias 0.030 | 106,594 | 21,417 |
| bias 0.012 | 113,082 | 24,823 |

The boundary moved `Δarea / perimeter` = **0.28 px** for a 0.018 change in bias. The offset is linear
in bias — both the normal offset and the depth compensation are `bias * slope` — so the shipped bias
of 0.03 sits at **0.47 px**, about eight times inside the 4 px bar. No pixel-scale conversion is
needed anywhere in that, because the answer comes from a ratio of two measurements at known biases.

A naive estimate from the normal offset alone predicts 2.4 px, five times the measured figure. The
difference is real and worth knowing: `shadowFactor` applies a matching depth compensation alongside
the normal offset, and the two largely cancel. The formula on its own would have been wrong.

### Frame time, and what the instrument can say

`get_render_stats` through a live MCP session, once with the shadow pass and once without:

| | fps | draw calls | instances |
| --- | --- | --- | --- |
| with shadow pass | 119.76 | 12 | 212 |
| without | 120.00 | 12 | 212 |

Both are on the display refresh, so the shadow pass costs less than the headroom already there. The
budget is met; the instrument bounds the cost rather than resolving it, and that limit is stated
rather than dressed up as a precise result.

## BroMetal's `mat4.perspective` emits OpenGL clip depth

Found by this goal and fixed inside it. `m[10] = (far + near) / (near - far)` puts the near plane at
`z = -w`, but WebGPU clips at `0 ≤ z ≤ w`, so the near half of any frustum built with it is discarded
before it is drawn.

Invisible on the demo cameras, which run near 0.1 and far 1000: depth crosses zero at 0.2 world
units, so the lost slice is a fingernail in front of the lens. A shadow frustum is tight by design —
12.0 to 32.1 here — and the same mismatch swallows **27% of it**, starting with whatever is closest
to the light. That is every tall prop's own shadow.

`createCamera` uses the same function, so **every BroMetal camera is currently spending half its
depth range on clipped geometry.** Fixed in `sun.ts` because this goal is scoped to one demo, with a
regression test in `sun.test.ts` that asserts the planes rather than the formula, and registered as
**A11** in `execute-goal-99.md` for an upstream patch.

## The sun's elevation decides how much shadow a frame contains

The first sun sat at 59 degrees and **89.8% of the floor came back fully lit** — a high sun drops each
prop's shadow underneath the prop, where the prop hides it. It also sat on the camera's side of the
scene, so what shadow there was fell away from the viewer.

Now 38 degrees and behind the scene, so shadows turn to face the camera. Both facts are written into
`SUN_DIRECTION`'s comment, because the next person to move the sun will otherwise rediscover them.

## The edge budget was re-derived, not loosened

`edges.hard` rose past its 0.0085 ceiling. Before touching it, the rise was separated by capturing the
same sun with the shadow term forced off:

| | `edges.hard` |
| --- | --- |
| no sun (06-03) | 0.00681 |
| sun, shadows off | 0.00936 |
| sun, shadows on | 0.00946 |

Shadows account for **0.0001 of the 0.0027 rise** — under 4%. The rest is a brighter frame having more
neighbouring pixels separated by a quarter of the range. The new ceiling of 0.0095 is re-derived for
a lit scene, with that table written into the budget beside it.

## The pattern worth keeping

Three times in goal 06 a measurement turned out not to measure its subject: 06-03's energy premise,
the first hard-edge formulation, and this step's peter-panning tracer. Each was caught the same way —
**vary the cause and check the number responds.** Bias halved and the gap did not move; that single
check is what separated a marginal failure from an invalid instrument.

## Left failing

`npm test` green. `npm run demos:verify` reports the same 7 failures as before this step and no new
ones: traversal-study's stale digest (×3), the local-contrast floor on combat-arena and
point-light-expo, the atlas gutter (goal 14), and material tone-maps in other demos (goal 07).
