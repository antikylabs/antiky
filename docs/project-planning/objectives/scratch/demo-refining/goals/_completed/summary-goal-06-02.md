# Summary — goal 06-02: one HDR target and exactly one tone-map

**Complete.** Every required outcome met; the invariance test passes at 0.477/255 against a 3/255
budget.

**Commit:** `886ff11` — Collapse point-light-expo onto one HDR target and one post pass

## Action needed from the owner

**None.** Two bugs were found during this step and **both were fixed** — the onboarding panel not
drawing, and the scene losing anti-aliasing. Both now have budgets that were proven to fail against
the broken code.

One thing to be aware of rather than act on: the local-contrast floor of 8.5 is still unmet at 6.73.
That is pre-existing, this step was forbidden from touching materials or lights, and 06-03 through
06-06 are what have to move it. It is *handled by 06-06*, not open.

## What the step was for

Before this, three material shaders each applied their own exposure and their own ACES curve. The
demo had three tone-maps and no single point where linear light stopped and a picture started. Every
later step in goal 06 — shadows, ambient, bloom, a grade — would have had to be threaded through all
three and kept in step by hand.

Now the scene renders into one RGBA16F target and exposure, tone-mapping and the sRGB encode happen
once, in `src/shaders/post.shader.ts`, in that order.

## The acceptance bar, measured

| | required | measured |
| --- | --- | --- |
| mean per-channel difference from the 06-01 frame | under 3/255 | **0.477** |
| hard-edge count | must not rise | **6,288 against 6,356** |
| `npm test` | green | **green** |
| material shaders that tone-map | none | **none** |
| shaders that encode | exactly one, the post pass | **one, the post pass** |

91.6% of pixels are byte-identical to the 06-01 capture. The residual sits on edges 3.3x stronger
than the frame average, which is the linear MSAA resolve described below.

## Two things broke, and neither was visible to any test

This step first measured **3.260/255** against a budget of 3, and the frame looked right at a
glance. It was not right. Both causes were found by looking at the capture beside its predecessor
rather than by reasoning about the numbers, and the first explanation reached for — fp16 precision —
was wrong.

### The onboarding panel stopped drawing

BroMetal sets `depthWriteEnabled: blend === 'none'` with `depthCompare: 'less'` and offers no
separate depth knob. The post quad sits at clip z = 0 and covers the canvas, so it stamped 0 into
every depth texel, and the overlay — also at z = 0 — then failed `0 < 0`.

The panel is 4.1% of the frame, and losing it accounted for **2.74 of the 3.26** drift. Everything
else measured normal: p95 0.256, local contrast 6.66, saturation 0.422.

Fixed by creating the post program with `blend: 'alpha'`, which is how you ask BroMetal not to write
depth. The blend itself is a no-op — the fragment writes alpha 1, so `src·α + dst·(1−α)` is exactly
`src`.

### The scene stopped being anti-aliased

`createRenderTarget` defaults to `samples: 1`. The canvas is 4x multisampled, so moving the scene
off the screen and into a target silently dropped anti-aliasing from the entire demo. Hard luminance
steps went from 6,356 to 9,449 while every committed metric stayed inside budget.

**The goal file called goal 02's `offscreen-multisampling` patch "hard-blocking" and said it "keeps
4x MSAA alive through `drawTo`".** The patch was present and correct, but it adds a *capability* —
it does not change the default. The caller still has to pass `samples: 4`. That reading of the
prerequisite is worth correcting for the later sub-goals, which will each create targets of their
own: 06-04's shadow map, 06-06's bloom chain.

### Why they hid from each other

With both bugs present the edge metric read **0.613%** — *better* than the correct frame's 0.682% —
because the missing panel took its hard-edged text with it. Two defects, and each one masked the
evidence for the other.

## What now catches them

Both failures were invisible to every existing test and obvious in the frame, so the checks went
where the evidence is: the capture sidecar.

- **`edges.hard`** in `scripts/frame-stats.mjs` — the fraction of pixels stepping more than 64 of
  display luminance to a neighbour. Budget ceiling 0.85% against a measured 0.68%.
- **A named probe on the onboarding rectangle**, judged by standard deviation: 0.143 with the panel,
  0.081 without. Floor 0.11. This connects `frame-stats`' probe machinery, which already existed and
  was reachable by nothing.

Proven against frames captured from the actually-broken code:

| state | edges | panel |
| --- | --- | --- |
| both bugs | 0.613% pass | 0.081 **fail** |
| target not multisampled | 1.028% **fail** | 0.143 pass |
| fixed | 0.682% pass | 0.143 pass |

**An honest note on the edge metric.** It is a directional indicator, not a classifier. On a single
synthetic silhouette it separates point-sampled from 4x-supersampled by only about 1.2x, because the
midpoint of a big jump is still a big jump. It earns its keep across a whole frame, where thousands
of edges sit at many contrasts. Three sharper formulations were tried and discarded — they scored
100% both ways, because on a curve the intermediate values lie *along* the edge, not across it. The
test asserts the margin the instrument actually delivers rather than a flattering one, and the
metric is documented as "compare a demo against its own recorded number, never another demo's".

## Two boundary conversions the step needed

Both are in `src/renderer.ts` with the reasoning beside them.

- **`LINEAR_CLEAR`.** `drawTo` clears to transparent black by default, not to the scene background.
  Missing it turned 34% of the frame — everything outside the floor — to pure black.
- **`LINEAR_FOG_COLOR`.** Materials used to mix fog in *after* exposure, so the authored value was a
  post-exposure quantity; now the post pass exposes everything at once. Left unconverted it moved
  dark pixels from 25 to 89. Fog dominates the darks and the sRGB encode has an enormous slope
  there — a 0.005 linear shift near black is about 20/255 on screen.

## Deliberate decision the goal asked to be settled

**The onboarding overlay draws after the post pass, outside tone-mapping.** It is authored
display-space UI; inside the target it would be exposed and tone-mapped along with the scene, which
would change text picked to be legible exactly as authored. Stated in `renderer.ts` and in
`post.shader.ts` so it is a decision rather than an accident.

## Sidecar schema

`schemaVersion` 2 → 3, adding `edges` and `probes`. The other nine demos still carry v2 sidecars and
stay green, because their budgets read neither field. They pick up v3 whenever they are next shot.

## Left failing, and why

`npm test` is green. `npm run demos:verify` reports 7 failures, none from this step:

- **`traversal-study` × 3** — stale `source.digest`; its sidecar predates source changes from an
  earlier goal and needs a re-shoot. Pre-existing.
- **`combat-arena` and `point-light-expo` local contrast** — 8.30 and 6.73 against a floor of 8.5.
  Pre-existing and untouched here; 06-02 is explicitly forbidden from changing materials, lights,
  ambient or fog. This is what 06-03 through 06-06 are for.
- **Atlas gutter** — goal 14.
- **Material tone-maps** — seven shaders across `combat-arena`, `traversal-study` and the three
  BroMetal demos. Goal 07. No point-light-expo shader is in the list, which is this step's own
  invariant holding.

## Note for the next step

`src/renderer.ts` is now 446 lines. `GOOD_ENGINEERING_H.md` wants a cohesion review at 500 and
decomposition by 800, and the goal file predicted this file would grow through the rest of goal 06.
06-03 should expect to split it by responsibility.
