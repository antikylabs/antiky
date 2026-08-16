# Execute goal 10: fix how the work is presented

## Prerequisites

- **Goal 01** — the capture and metrics loop. Two outcomes below (the blank-capture guard and the
  Glass Garden exposure match) are stated as frame statistics, and nothing can measure them until
  goal 01 lands.
- Nothing else. This goal is **parallel-safe with every other goal in the set**, because it owns
  `packages/website/**`, `packages/demos/threejs/**` and `packages/demos/brometal/**`, and no other
  goal owns a file in those trees. Goal 09 owns the three Antiky demos; goal 11 owns
  `packages/framework/**`; goal 12 owns the render driver. The owned-file sets are disjoint, which
  is the whole concurrency rule.

## `/goal` objective

Stop the presentation layer arguing against the product.

The architectural claim the demos were built to prove — that the game host is renderer-neutral — is
proven cleanly (`subagent-reports/04-baseline-demos-and-presentation.md:299-308`). The claim nobody
meant to make is being made anyway, visually, by a page that shows ten equal-looking cards of which
eight fail on most browsers, and by billing the repository's strongest artifact identically to three
fullscreen shader quads.

Fix the framing, fix the evidence, and fix the four image defects that are one-line-class bugs.

## Required outcome

When the work is complete, the repository must have:

1. **an honest WebGPU story on `/demos`.** Eight of ten demos are `requiresWebGpu: true`
   (`packages/website/src/lib/demos.ts:68,88,106,118,153,168,184`); only `orbital-atlas` and
   `glass-garden` are `false` (`:200`, `:216`). `DemoStage` turns that into a text error card at
   `packages/website/src/components/DemoStage.tsx:106-110`. So on Safari and Firefox a page
   headlined "Run the work." claiming "Ten live studies"
   (`packages/website/src/app/demos/page.tsx:17-18`) is **eight error cards and two working Three.js
   scenes** — and the two that work are labelled as proving the host can mount *another* renderer.
   The requirement must be stated **once**, deliberately, at page level, and every gated demo must
   fall back to its existing poster (`packages/website/src/lib/demos.ts:239-241`) with a static-capture
   badge. A still frame is evidence; an error card is not;
2. **`town-study` promoted out of the shader-study group.** It is ~9,000 lines under `src/town/`: a
   real voxel surface mesher (`src/town/art/voxel-surface-mesh.ts`, 541 lines), a sprite batcher
   (`src/town/art/sprite-batch.ts`, 474 lines), a tested character motor
   (`src/town/physics/character-motor.ts`, 1,286 lines), and twelve shader pairs including dedicated
   shadow passes (`src/town/shaders/town-{voxel,sprite,prop,foliage,awning}-shadow.shader.ts`) and a
   post pass. It is the only BroMetal artifact that demonstrates an engine, and it is currently
   billed identically to three `createPlane({width:2,height:2})` quads. The three shader studies move
   into a clearly labelled subgroup so they are not read as the ceiling of BroMetal's capability;
3. **no committed capture that is uniformly one colour.** Three of six committed Three.js captures
   are 100% blank white
   (`packages/demos/threejs/orbital-atlas/.antiky/captures/capture-119b534d-…png`,
   `capture-07c8aff3-…png`, `glass-garden/.antiky/captures/capture-3357a5fc-…png`), while
   `packages/website/PRODUCT.md:113` cites those studies as **current evidence**. Both demos already
   set `preserveDrawingBuffer: true` (`orbital-atlas/src/game.ts:54`, `glass-garden/src/game.ts:50`),
   so the capture is firing before the first `frame()`, against the wrong canvas, or after teardown.
   Either the timing is fixed and the artifacts regenerated, or the artifacts are deleted and the
   PRODUCT.md claim is corrected. A blank PNG in a directory named `captures` is worse than no PNG;
4. **Glass Garden able to reproduce its own poster.** The poster
   (`packages/website/media-masters/demos/glass-garden.png`) is roughly 40% clipped white with no
   material read; the runtime capture (`capture-c01ffa42-…png`) is a near-black void with floating
   blooms and no shadow contact anywhere. **Both images come from the same code.** The cause is
   stacked: `HemisphereLight` at 1.35 (`src/game.ts:67`) plus IBL (`:63`) plus three `PointLight`s at
   175/165/145 (`:227-229`) plus emissives at 0.65–0.72 plus `MeshBasicMaterial` cores authored above
   1.0 on purpose (`:126-128`) plus `UnrealBloomPass` at threshold 0.76 (`:71`) — all at
   `toneMappingExposure = 1` (`:54`). The terrain's `lowColor = 0x071625` (`:200`) has no albedo to
   catch light, which is why the blooms read as balloons on sticks;
5. **mobile `/demos` that actually runs.** In the `variant === 'thumb'` branch
   (`DemoStage.tsx:313-317`) there is no `.stage-activate` button — activation comes only from
   `onPointerEnter` / `onFocusCapture` (`:305`, `:307`), and
   `.stage-thumb .stage-canvas { pointer-events: none }` (`globals.css:109`) blocks the canvas
   anyway. On a touch device the page is ten static posters;
6. **posters that are not cropped past their subject.** `.stage` uses `background-size: cover`
   (`globals.css:88`) against poster masters that are all 2560×1440. On mobile `.deck-stage` is
   `height: 68svh` (`globals.css:371`), which at a ~390px-wide viewport is a **portrait** container,
   cropping a 16:9 landscape poster to roughly its middle 35%. Orbital Atlas's ringed planet and
   Shader Study's moon are cropped out entirely. Only `combat-arena` has a mobile poster
   (`packages/website/src/lib/demos.ts:243-246`);
7. **Orbital Atlas resizing only when the size changes.** `src/game.ts:210-217` compares
   `canvas.width` (device pixels) against `clientWidth` (CSS pixels) while `setPixelRatio(2)` is
   active (`:59`), so the guard can never short-circuit and `setSize` +
   `camera.updateProjectionMatrix()` run every frame, reallocating the drawing buffer 60×/second.
   `glass-garden/src/game.ts:244-256` already has the correct pattern — memoised
   `renderWidth`/`renderHeight`. Copy it; do not invent a third;
8. **Luminous Reef plankton that are not squares.**
   `packages/demos/brometal/luminous-reef/src/shaders/luminous-reef.shader.ts:139-142` floors into a
   48×48 cell, hashes the cell, and thresholds the seed with **no local-distance test**, so every
   selected cell fills as a solid axis-aligned square. `bubbleGlow` ten lines earlier (`:129-137`)
   computes `length(bubbleLocal.sub(bubblePoint))` correctly. This is the single most damaging
   artifact in the demo set and it is a one-line-class bug; and
9. **Shader Study craters filtered and dither applied after the tone-map.**
   `src/shaders/aurora.shader.ts:100-102` point-samples `hash21(vec2(floor(x*32), floor(y*32)))` with
   no smoothing, so the moon's craters render as axis-aligned solid squares.
   `filmGrain(vUv, uTime) * 0.012` at `:149` is applied **before** the ACES tone-map at `:150`, so
   the dither is compressed by the tone curve exactly in the dark range where it was needed.

## In scope

- `packages/website/**` — `src/lib/demos.ts`, `src/components/DemoStage.tsx`,
  `src/app/demos/page.tsx`, `src/app/demos/[slug]/page.tsx`, `src/app/globals.css`, `PRODUCT.md`,
  `demo-publication.json`, and `tests/*.test.mjs`.
- `packages/demos/threejs/{orbital-atlas,glass-garden}/**` and
  `packages/demos/brometal/{luminous-reef,shader-study,solar-forge,town-study}/**`.
- Committed capture artifacts under `packages/demos/**/.antiky/captures/`.
- The Solar Forge copy at `packages/website/src/lib/demos.ts:159-161`, which calls "a turbulent
  procedural eclipse" with "a black-hot core" what the shader actually implements: a black hole with
  a photon ring (`solar-forge.shader.ts:72-73`), an accretion disk, and relativistic Doppler beaming
  (`:90-91`, `:98-99`). The copy undersells its own content.
- Replacing developer error strings with visitor-facing copy. `DemoStage.tsx:208` and `:221` can
  surface "The compiled game has no default game-module entry." to a public visitor.

## Required tests and evidence

At minimum, prove:

- a headless test asserts that with `'gpu' in navigator` false, `/demos` renders **zero** elements
  carrying the error styling and **ten** poster elements, and that the WebGPU requirement string
  appears exactly once in the document;
- `setSize` call count is **1 across 100 simulated frames at a fixed canvas size** for
  `orbital-atlas`, asserted against a fake renderer — and the same test passes for `glass-garden`,
  proving both demos now share one resize protocol;
- a source-level assertion that the plankton term in `luminous-reef.shader.ts` computes a distance
  from a local point before thresholding, and that `filmGrain` in `aurora.shader.ts` is applied on a
  later line than `tonemapACES`; both fail against today's source;
- a repository test asserts no committed PNG under `packages/demos/**/.antiky/captures/` is a single
  uniform colour, using goal 01's frame statistics (`clippedHigh === 1.0` or `p05 === p95` is the
  mechanical form of "blank");
- Glass Garden's poster and its runtime capture differ by **under 10% mean luminance**, with
  `clippedHigh` under 0.02 on both, recorded in a committed `visual-metrics.json` sidecar;
- a layout test asserts that for every poster, at least 70% of the master's width is visible on a
  390×844 portrait stage and on the 1440px detail stage;
- a test asserts the thumb variant renders an activation control, and that activation does not
  depend on `onPointerEnter`;
- `packages/website/tests/*.test.mjs` and `packages/demos/tests/dev-host.test.mjs` pass — the latter
  **unchanged**, because it is the framework-free fence and this goal does not touch it; and
- every visual change ends with a fresh capture that was actually looked at, plus its metrics
  sidecar. A visual change that has not been captured and looked at is not done.

## Explicit non-goals

- Do not touch `packages/demos/antiky/**` (including `antiky-town`) or `packages/framework/**`. Those
  belong to other goals and editing them breaks the concurrency rule.
- Do not set `requiresWebGpu: false` on a demo that needs WebGPU. The fix is the fallback, not the
  flag.
- Do not port a demo to another renderer, and do not rewrite the three shader studies into 3D scenes.
  Their scope is honest (`aurora.shader.ts:56-59` says so plainly); the problem is billing.
- Do not relax `packages/demos/tests/dev-host.test.mjs`'s framework-free fence for any of these six
  demos. That fence is deliberate and belongs to the owner.
- Do not decompose `packages/demos/brometal/town-study/src/town/art/town.ts` (2,194 lines against an
  800-line threshold) in this goal. It is real, it is recorded, and it is not presentation work.
- Do not build a video-capture pipeline as the no-WebGPU fallback unless the poster fallback is
  measured as insufficient. Posters already exist for all ten demos.
- Do not add hover-only interactions of any kind.

## Engineering constraints

- `packages/demos/antiky/**`, `antiky-town` included, belongs to goal 09 in this plan. Nothing here
  edits it — not because it is protected, but because the owned-file sets must stay disjoint for the
  two goals to run in parallel.
- Tests are required for code changes. When fixing a reported bug — the blank captures, the resize
  loop, the square plankton — write the regression test first, run it, watch it fail, then fix.
- Short one-line commit messages. No coauthor tags.
- Capture PNGs are **not** committed — `.antiky/` is gitignored, evidence retention is
  session-scoped and `*.png` is LFS here. The committed artifact is the metrics sidecar. This is why
  outcome 3 is "delete or regenerate", not "commit a better PNG".
- Preserve unrelated dirty worktree changes.
- The framework is renderer-agnostic and platform-agnostic.
  `packages/framework/tests/import-boundary.test.mjs:6-13` forbids `brometal`, `node:`, `react` and
  `next` imports in framework source. Nothing in this goal may push website or Three.js concerns into
  the framework; if a fix seems to want that, it belongs in goal 11 with an argument.
- `packages/website/PRODUCT.md` has its own evidence taxonomy. A claim that is not currently true is
  moved to Direction, not deleted and not left standing.

## Completion definition

The goal is complete when a browser without WebGPU shows no error-styled card on `/demos`,
`town-study` is billed separately from the three shader studies, no committed capture is a uniform
frame, Glass Garden's runtime matches its poster inside the stated tolerances, the thumb variant
activates without hover, `setSize` is called once per size change in both Three.js demos, and the
plankton, crater and dither-order fixes each have a source-level test that fails on the old code.

If the Glass Garden exposure work cannot reach the stated tolerance without changing the scene's art
direction, stop and report the measured numbers rather than loosening the tolerance. Budgets are
changed by the owner, not by the agent failing them.
