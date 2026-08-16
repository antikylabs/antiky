# Execute goal 03: quick wins, motion feel, and safe dead-code removal

## Prerequisites

Complete [execute goal 01](_completed/execute-goal-01.md) first. It unblocks `capture_frame` on the
asset-heavy demos, gets `npm test` green on `main`, and delivers `npm run demos:shoot`, the frame
statistics library, the per-demo visual budgets and the pipeline-invariant tests. Every acceptance
criterion below is measured with those tools; without them this goal is unverifiable and must not
be started.

Read `../06-WORK-PACKETS.md` (Track D, and the safe-before-render column of the ranked worklist in
`../04-COMPLEXITY-REDUCTION.md:59-90`), `../02-REMEDIATION-PLAN.md:126-193` for the camera-shake
diagnosis, and `../07-TESTING-WITH-ANTIKY-MCP.md` for how to capture and inspect a frame.

## `/goal` objective

Land the work that improves the Antiky demos without touching colour management, the HDR target, or
the BroMetal patches: work packets W D.1 through W D.6, and the pure-removal subset of the
complexity worklist that is provably a no-op today.

This goal exists because these fixes are individually small, mutually independent, and none of them
needs a render-pipeline rewrite to be correct. Together they remove roughly 100 lines of dead code,
one class of depth-precision waste, one class of incoherent lighting, a shadow that glows, and the
motion defect the owner reported directly.

**Scope now includes `antiky-town`.** The audit in `../` was written with that demo excluded; the
owner has since put it in scope and wants it to get the same facelift. It is the largest Antiky
demo — ~12,484 lines under `src/`, ~12,045 of them in `src/town/` — with **13 shader pairs** in
`src/town/shaders/`. Most of Track D turns out **not** to apply to it, because it is already ahead
of the other three: it runs `cull: 'back'` at `src/game.ts:16`, it derives its sun direction from a
single `LIGHT_DIR` constant (`src/town/index.ts:80`), and it already renders to offscreen targets
with real shadow passes. **Verify each defect against its source before asserting it applies** — 13
shader pairs is a lot of surface on which to assume.

**Effort.** Roughly 2 days for the original three demos, plus roughly 1 further day for
`antiky-town`: the sweep is mostly verification and documentation there, and only W D.1 and W D.5
carry real work. That is one day, not four, because the town demo does not have most of these
defects. Do not silently absorb it — report the town work separately.

**Render interpolation (W D.5) belongs to this goal, not to the framework render-driver goal.** It
is roughly fifteen lines per demo, `docs/adr/framework/0013-explicit-simulation-inputs_H.md:30`
already permits it ("The renderer can estimate positions between two simulation states. It can also
run at a different rate from the simulation"), and the camera-shake rebuild is masked without it —
a 7.5 Hz signal frame-held on a 144 Hz display stair-steps regardless of how good the signal is.
Stated here so [execute goal 11](execute-goal-11.md) does not duplicate it; goal 11 may promote the
interpolation helper into the framework once three demos have converged on it, but it does not
build it.

## Required outcome

When the work is complete, the repository must have:

1. palette textures in `traversal-study` loaded with `filter: 'nearest'`
   (`packages/demos/antiky/traversal-study/src/renderer.ts:216` currently uploads them with
   `anisotropy: 4` and default linear filtering, averaging adjacent palette entries into mud);
2. a far/near ratio of 500:1 or tighter in all four cameras
   (`traversal-study/src/renderer.ts:337` runs `near: 0.1, far: 240`, a 2400:1 ratio;
   `combat-arena/src/renderer.ts:105` runs `near: 0.1, far: 60`;
   `point-light-expo/src/renderer.ts:177-178` runs `near: 0.1, far: 45`; and
   `antiky-town/src/town/index.ts:733` and `:825` run `near: 0.32` against
   `FAR_DEPTH = 180` (`src/town/art/town.ts:14`) — 562:1, marginally over budget and the smallest
   correction of the four);
3. exactly one sun direction and one fog range per demo, agreed across every shader in that demo —
   `combat-arena` today carries three shaders that disagree on both, while `antiky-town` already
   agrees and needs its one **deliberate** divergence documented instead of changed;
4. back-face culling on in `traversal-study`, which runs `cull: 'none'` at
   `traversal-study/src/renderer.ts:297`. `antiky-town` already runs `cull: 'back'`
   (`src/game.ts:16`) and its foliage geometry is authored for it
   (`src/town/art/town-foliage.ts:156`) — leave it alone;
5. unlit, soft-edged, translucent contact shadows in place of the current blobs, which are drawn
   through the lit path and therefore get roughly six times *brighter* near a light
   (`point-light-expo/src/shaders/foundry.shader.ts:181` applies `uAmbientColor` and radiance to
   them; `combat-arena/src/combat-projection.ts:240` writes them as hard rectangles into the lit
   surface batch). `antiky-town` casts **real** shadows — `town-shadow`, `town-prop-shadow`,
   `town-foliage-shadow`, `town-awning-shadow` and `town-sprite-shadow` are depth-from-light passes
   into a 1024²/2048² render target (`src/town/index.ts:270-275`) — so it has no fake blobs to fix,
   and none may be added;
6. render interpolation between the two most recent simulation states in all four demos;
7. a rebuilt camera shake in `combat-arena` meeting the criteria in the section below; and
8. the provably dead code named below deleted, with a grep-based test proving each name is gone.

## In scope

- **W D.1 — camera near planes.** Raise `near` per demo until the ratio is at most 500:1 without
  clipping anything the camera can actually reach. Record the chosen value and the reasoning in a
  comment beside each `createCamera` call.
- **W D.2 — one sun, one fog range per demo.** Hoist `combat-arena`'s sun direction and fog range
  into a single exported constant that all of its shaders read. Do not invent a new value; pick one
  of the three existing ones deliberately and say in a comment why.
- **W D.3 — back-face culling.** Set `cull: 'back'` in `traversal-study`. If a specific mesh needs
  double-siding, draw that mesh in its own pass rather than reverting the demo-wide setting.
- **W D.4 — contact shadows.** Move the blobs out of the lit path entirely: an unlit program, a
  radial alpha falloff, and no light term of any kind.
- **W D.5 — render interpolation.** Keep the previous and current simulation states, interpolate
  presented positions by the fractional accumulator, and present that. Simulation stays at fixed
  60 Hz and its inputs stay explicit — this changes presentation only.
- **W D.6 — camera shake.** Detailed below. It is a `combat-arena` defect; confirm by measurement
  whether `antiky-town`'s camera has an equivalent, and if it does not, say so and stop.
- **`antiky-town`, packet by packet.** Each of these is a finding to confirm, not an assumption:
  - W D.1 **applies**, mildly. 180 / 0.32 = 562:1. Raising `near` to 0.36 clears the budget; check
    the character motor's closest approach before choosing, since this is a close third-person
    camera and not a distant one.
  - W D.2 **does not apply as a defect.** `LIGHT_DIR` (`src/town/index.ts:80`) is one normalised
    constant fed to every program, and fog is 45→110 at every call site. There is one deliberate
    divergence: the foliage programs take `uSunColor [1, 0.82, 0.58]` at intensity 1.05
    (`src/town/index.ts:455-456`) where world, water, awning and prop programs take
    `SUN_COLOR [1, 0.55, 0.28]` at 2.65. That is an art decision on alpha-cut cards. The
    deliverable is a comment saying so, so the invariant test can whitelist it and a future reader
    does not "fix" it. Do not change the values.
  - W D.3 **does not apply.** Already `cull: 'back'`.
  - W D.4 **does not apply.** Real shadow passes, no fake blobs.
  - W D.5 **applies.** No interpolation exists in `src/game.ts` or `src/town/index.ts`.
  - Dead-code removal — nothing in the complexity worklist covers this demo. Do not go hunting;
    `../04-COMPLEXITY-REDUCTION.md` never audited it, so there is no verified dead-code list to
    work from, and speculative deletion across 12,000 lines is exactly the wrong risk here.
- **Safe dead-code removal**, items 1, 2, 3, 4, 17 and 18 of `../04-COMPLEXITY-REDUCTION.md:59-78`,
  all marked gate `before` at risk `none` or `low`:
  - `ARENA_ENERGY_INSTANCES` (`combat-arena/src/arena-environment.ts:6`) — a repo-wide grep returns
    exactly one hit, the declaration;
  - `DEFAULT_OFFSETS` (`combat-arena/src/arena-signals.ts:9`, used at `:101`) — `setCombatSignals`
    has one caller (`combat-projection.ts:249`) which always passes `SIGNAL_OFFSETS`, and the
    default value is wrong anyway (the real gauge offset is 60, not 28);
  - `ROLE_SHAPES.height` and `catalogParts` in `combat-arena`;
  - the uncalled `set()` twin on both batch factories (`combat-arena/src/render-batches.ts:53`,
    `:125`; `point-light-expo/src/render-batches.ts:90`, `:168`) — every caller uses `setValues`,
    and `arena-composition.ts` calls `.set` on a different type;
  - `uTint` in `traversal-study` (`shaders/traversal-model.shader.ts:23`, `:46`, `:54`;
    `renderer.ts:71`, `:200`, `:232`) — all thirteen `createCatalogBatch` call sites at
    `renderer.ts:302-314` pass `[1, 1, 1]`, by default or explicitly;
  - `uModel` in `point-light-expo` (`shaders/foundry.shader.ts:55`, `:88`, `:99`, `:111`) — the
    only write is `renderer.ts:246` setting the `mat4.identity()` built at `renderer.ts:171`, so
    both `mul` calls are dead 4×4 multiplies per vertex;
  - the `RELAY_VISUAL_COUNTS` / `RELAY_RENDER_PASSES` exports and the `SHIP_PRESENTATION_SPANS`
    double re-export.
- Regenerating every touched `*.shader.gen.ts` so the existing shader-output parity test stays
  green.

## Required tests and evidence

- **W D.1** — no near-plane clipping in any captured frame, and a source-level assertion that every
  `createCamera` call under `packages/demos/antiky/**/src/` has `far / near <= 500`. The assertion
  must reach `antiky-town`'s two call sites, which are nested at `src/town/index.ts:733` and `:825`
  rather than in a top-level `renderer.ts` — a glob of `*/src/renderer.ts` silently misses them.
- **W D.2** — goal 01's intra-demo agreement assertion passes: within a demo, all shaders declaring
  a sun direction agree, and all shaders declaring fog ranges agree. `antiky-town` must pass without
  source changes; if it does not, the assertion is wrong about the demo and the assertion gets
  fixed, not the demo. Its foliage sun-colour divergence is whitelisted with the comment that
  justifies it.
- **W D.3** — triangle count from `antiky tool get_render_stats` drops, and the captured frame
  differs from the pre-change capture by no more than 2/255 mean per-channel.
- **W D.4** — blob luminance does not increase within 2 m of any light, and blob alpha falls to
  zero over at least 15% of the blob radius.
- **W D.5** — with the simulation at 60 Hz and presentation at 144 Hz, frame-to-frame position
  deltas are monotonic across 100 frames: no value repeated on consecutive frames and then jumped.
- **W D.6** — the four criteria below, each as a test.
- **Dead code** — `rg uModel packages/demos/antiky/point-light-expo` returns zero hits including
  the generated shader; `rg 'uTint|\btint\b' packages/demos/antiky/traversal-study/src` returns
  zero hits; each deleted symbol has a grep assertion in the pipeline-invariant test file so it
  cannot return. Existing `tests/render-batches.test.ts` and `tests/resources.test.ts` must stay
  green without being loosened.
- **`antiky-town`** — for every packet marked "does not apply" above, commit the measurement that
  proves it rather than the assertion that it is fine. A one-line note citing `src/game.ts:16` is
  evidence; "checked, looks fine" is not.
- One `npm run demos:shoot` run per demo at the end — four demos now — with the committed
  `visual-metrics.json` sidecar and an explicit statement that the frames were looked at. The PNG is
  not committed. Note that captures are strictly serial: every manifest binds `127.0.0.1:3010`,
  and `antiky-town.antiky` is no exception.
- `npm test` green.

### W D.6 — camera shake, the full contract

`combat-arena/src/presentation.ts:34-35` currently computes
`Math.sin(state.time * 47) * actionImpact * 0.11` and
`Math.cos(state.time * 41) * actionImpact * 0.08`. The owner's report is "shakes and judders a lot,
it's too much", and `../02-REMEDIATION-PLAN.md:140-192` isolates three causes. All four criteria
must hold:

1. **Trauma, squared.** Shake amplitude is driven by `trauma²` (or `trauma³`), not linearly in the
   impact value.
2. **Noise, not summed sines.** The autocorrelation of the offset signal sampled over 10 s has no
   peak above 0.3 at any lag outside zero. Today's pair fails this: 47 rad/s and 41 rad/s differ by
   6 rad/s and beat with a ~1.05 s period, which reads as a mechanical wobble once per second.
3. **Translate, do not swivel.** `position` and `target` receive the same offset. Today
   `presentation.ts:70`/`:72` add shake to `position` while `:73`/`:75` leave `target` alone, so
   the view rotates and the far arena edges swing — most of the felt judder.
4. **The cannon is not a hull loss.** Under a sustained cannon cadence of one hit per 0.34 s
   (`simulation.ts:448-449`), peak camera offset stays below 30% of the hull-loss peak
   (`simulation.ts:203` sets 1.0; `simulation.ts:259` currently sets 0.45 for a routine cannon
   tick).

`packages/demos/antiky/combat-arena/tests/presentation.test.ts:62` covers camera impact bounds
today and must continue to pass unmodified. Write the regression tests for the four criteria above
before changing `presentation.ts`, and confirm each one fails against current code first.

Judging feel needs motion, not a still: use `capture_gameplay_sequence`. It declares itself
non-deterministic, so do not write exact-replay assertions against it — the numeric criteria above
run against the projection code directly, which needs no rendering at all.

## Explicit non-goals

- Do not touch the scar-tissue knobs. `uDiffuseLift`, `uTextureContrast`, `uSaturation`,
  `uGradeColor`, `uGradeMix`, `vWash` and the `mix(vec3(0.48), …)` grey-wash are items 19–22 of
  `../04-COMPLEXITY-REDUCTION.md`, gated **after** the colour fix. Deleting them now visibly darkens
  the demos and this goal owns none of that work.
- Do not add an HDR render target, a shadow map, bloom, tone-mapping changes or a colour grade.
- Do not apply the BroMetal patches, and do not change `scripts/patch-brometal.mjs`.
- Do not split `simulation.ts` or `renderer.ts`, collapse the three ground-height functions, or take
  any worklist item marked medium risk or gated `after`.
- Do not change simulation behaviour, tuning values, encounter design or input handling. W D.5 and
  W D.6 are presentation-layer changes.
- Do not rewrite the asset scripts — that is goal 04 — and do not assign materials, which is
  goal 05.
- Do not add a seeded RNG, a shared render module, or a new package.

## Engineering constraints

- `packages/demos/antiky/antiky-town` is **in scope**, on the owner's instruction, and gets the same
  facelift as the other three. It is also the demo with the most existing correctness, so the
  default action there is to confirm and document, not to change. Every change to it must cite the
  line that justifies it.
- Demos hand-roll rendering per demo until the `BroMetalRenderDriver` exists. **Do not extract a
  shared render package.** Duplication across the four demos is expected and accepted here; the
  pipeline-invariant tests are the mechanism that keeps duplicates honest.
- Tests are required for every code change. When fixing a reported bug — the camera shake is one —
  write the regression test first, watch it fail, then fix the code.
- Commit incrementally with short one-line messages. No coauthor tags.
- Capture PNGs are **not** committed. `.antiky/` is gitignored, capture retention is scoped to the
  development session, and `*.png` is LFS here. The committed artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes. Do not revert or stash another person's work.
- Every visual change ends with a fresh capture that is actually looked at. A visual change that has
  not been captured and viewed is not done.

## Completion definition

The goal is complete when all eight required outcomes are landed, each has its named mechanical
test passing, `npm test` is green, and one `visual-metrics.json` sidecar per demo is committed from
a post-change capture.

If any acceptance criterion cannot be met, report that plainly with the measurement that failed.
Budgets and criteria are changed by the owner, never by the agent failing them. A partially
completed goal with honest measurements is a better outcome than a green report over a loosened
threshold.
