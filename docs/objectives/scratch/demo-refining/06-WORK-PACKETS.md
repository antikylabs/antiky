# Work Packets — Bounded, Testable, Parallelisable

**Date:** 2026-08-10
**Companion to:** `02-REMEDIATION-PLAN.md` (the reasoning). This document is the executable
backlog: what to dispatch, in what order, what may run in parallel, and how each packet is proven
done.

Every packet states the files it **owns**. Two packets may run in parallel if and only if their
owned-file sets are disjoint. That is the whole concurrency rule — no packet may edit a file
another packet owns.

Every packet states acceptance criteria that are **mechanically checkable**. "Looks better" is
not an acceptance criterion and must never appear in one.

---

## Track 0 — The verification harness (do this first; everything else depends on it)

Visual acceptance criteria are only meaningful if something can measure them. Today nothing can,
which is why the previous work went unchecked. **Track 0 is the prerequisite for every other
track's acceptance criteria**, and it is roughly one day of work.

> **Revised after hands-on verification — see [`07-TESTING-WITH-ANTIKY-MCP.md`](07-TESTING-WITH-ANTIKY-MCP.md).**
> This track originally proposed building a Playwright capture harness from scratch. That was
> wrong: the repo already ships a purpose-built capture and inspection MCP (`antiky tool …`,
> `antiky mcp`). Track 0 now *unblocks and wraps* that tooling rather than duplicating it.

### W0.1 — Make `capture_frame` work on the asset-heavy demos

**Owns:** `packages/cli/src/host/actions.ts`, `packages/cli/src/host/capture-service.ts`.
**Depends on:** nothing. **This is the first thing to do in the entire plan.**

Verified: `capture_frame` succeeds first try on `luminous-reef` (no assets) and returns
`ANTIKY_ACTION_TIMEOUT` on `point-light-expo` (~10 MB of GLB and JPEG) at both
`warmUpFrames: 90` and `12`. The cause is `actions.ts:48` — a single
`DEFAULT_ACTION_TIMEOUT_MILLISECONDS = 10_000` budget wrapping browser launch, page load, asset
download, WebGPU init, warm-up and PNG encode.

This is almost certainly why the tooling went unused: anyone who tried it once on a real demo got
a timeout and reasonably concluded it was broken.

**Acceptance criteria**
- `capture_frame` returns a valid artifact for all three antiky demos at `warmUpFrames: 60`,
  three consecutive runs, with no `ANTIKY_ACTION_TIMEOUT`.
- The launch budget and the capture-action budget are separately configurable; neither is a
  magic number at a call site.
- A genuinely hung capture still fails rather than hanging forever — assert a too-small explicit
  timeout still produces `ANTIKY_ACTION_TIMEOUT`.

### W0.1b — Get `npm test` green on `main`

**Owns:** `scripts/repository-policy.test.mjs`.
**Depends on:** nothing. Do it before adding any other test.

`skills/` was deleted in `1062bd4` while `repository-policy.test.mjs:64-66` still reads it.
Verified by running the file: 4 pass, 1 fails `ENOENT`.

**Acceptance criteria** — `npm test` is green at HEAD before any packet below adds a test.
Until this lands, nobody can distinguish their own breakage from the pre-existing failure.

### W0.2 — `demos:shoot`, wrapping the MCP

**Owns:** `scripts/shoot-demos.mjs`, `scripts/shoot-demos.test.mjs`, root `package.json`,
`scripts/repository-policy.test.mjs` (allowlists).
**Depends on:** W0.1, W0.1b.

Drive the existing MCP: fence (`get_latest_build` → `get_runtime_status` →
`get_capture_capabilities`), call `capture_frame`, retry on `CAPTURE_BUILD_STALE`,
`CAPTURE_RUNTIME_STALE` and `CAPTURE_DIMENSIONS_MISMATCH`, then compute frame statistics.

Constraints established by testing, which the implementation must respect:
- **Demos must be captured serially** — every manifest binds `127.0.0.1:3010`/`:3011`.
- **`target` must equal the manifest viewport**, and `deviceScaleFactor` must be `1`; 1280×720 at
  dsf 2 is rejected with `CAPTURE_DIMENSIONS_MISMATCH` despite being inside the stated limits.
- **`repository-policy.test.mjs` asserts exact allowlists** for `scripts/` contents and root
  script keys — both must be updated in the same commit or the suite goes red.
- `combat-arena` and `traversal-study` are missing from `scripts/dev.mjs`'s `demoProjects`; add them.

**Acceptance criteria**
- `npm run demos:shoot` exits 0 and produces, per demo, one capture plus one committed
  `visual-metrics.json` sidecar. **The PNG is not the committed artifact** — `.antiky/` is
  gitignored, evidence retention is session-scoped, and `*.png` is LFS here.
- A demo that renders a blank frame produces a non-zero exit naming the demo. (Three committed
  three.js captures are currently uniform white; this is the check that catches them.)
- Unit tests cover slug resolution, fence assembly and metrics computation against a fixture PNG
  with a known histogram — no GPU required for those.
- `npm test` green.

### W0.2b — Frame statistics and the visual assertion library

**Owns:** `scripts/frame-stats.mjs`, `scripts/frame-stats.test.mjs`.
**Depends on:** W0.1b. Parallel-safe with W0.2 — disjoint files, and it needs no GPU, so it can
be written and tested against fixture PNGs while the capture path is still being unblocked.

Compute, from a PNG: mean luminance, the 5th/50th/95th luminance percentiles, the fraction of
pixels clipped at 0 and at 1, mean saturation, and the value of a named probe rectangle.
Luminance is `0.2126R + 0.7152G + 0.0722B` on linearised channels.

**Acceptance criteria**
- Unit tests over synthetic images: a pure mid-grey image reports p05 == p95; a black-to-white
  ramp reports p05 < 0.1 and p95 > 0.9; a fully clipped white image reports clipped-high == 1.0.
- Probe rectangles are addressed by name from a per-demo config file, not by magic numbers
  scattered through tests.

### W0.3 — Per-demo visual budgets

**Owns:** `packages/demos/antiky/*/tests/visual-budget.test.mjs` (one per demo — three
independently ownable files).

Assert each demo's captured frame falls inside an authored range. These are the criteria the
rest of this document refers back to.

**Acceptance criteria**
- Each demo declares `luminanceP05`, `luminanceP95`, `clippedHigh`, `meanSaturation` bounds.
- The test fails today for the reasons the audit documents (the arena's whole frame sits in a
  15–35% luminance band), and the bounds are set to the *target*, so the test goes green when the
  work lands. A budget that passes on day one is measuring nothing.
- Bounds live beside the demo, with a comment naming the reference look.

### W0.4 — Pipeline invariant tests

**Owns:** `packages/demos/tests/pipeline-invariants.test.mjs`.

Source-level assertions that encode the exact defects this audit found, so they cannot return.

**Acceptance criteria** — all of these must pass:
- No file matching `packages/demos/antiky/*/src/shaders/*.shader.ts` imports `tonemapACES`
  (tone-mapping belongs in exactly one post pass per demo).
- No asset script deletes `normalTexture` or writes UVs without reading `TEXCOORD_0`.
- Within a single demo, all shaders declaring a sun/key direction agree on it, and all shaders
  declaring fog ranges agree on them. (Combat Arena currently violates both.)
- Every `*.shader.ts` has a corresponding up-to-date `*.shader.gen.ts` — the repo already checks
  shader output parity at `packages/demos/tests/shader-output-parity.test.mjs`; extend rather
  than duplicate it.

---

## Track A — BroMetal patches (blocks Track B's HDR packets)

### W A.1 — Linear filtering on render targets
**Owns:** `scripts/patch-brometal.mjs` (section 1), `scripts/patch-brometal.test.mjs`.
**Depends on:** nothing.

`dist/runtime/webgpu.js:761` hard-codes `magFilter: 'nearest', minFilter: 'nearest'` on every
render target's sampler. A bloom downsample chain built on point sampling produces blocky,
crawling glow.

**Acceptance criteria**
- Patch applies cleanly and is idempotent (re-running `postinstall` twice is a no-op) — this is
  the existing patch file's established contract.
- The patch throws a clear error if BroMetal's version is not 0.15.0, matching the file's
  existing guard.
- A test renders a 2×2 texture into a larger target and asserts the sampled midpoint is an
  interpolated value, not one of the four source texels.

### W A.2 — Preserve MSAA in offscreen passes
**Owns:** `scripts/patch-brometal.mjs` (section 2).
**Depends on:** W A.1 (same file — serialise these two, do not parallelise).

`drawTo` forces `passSamples = 1` (`webgpu.js:235`), so **the moment any demo renders to an HDR
target it silently loses the 4× MSAA it has today.** Without this, Track B is a visible
regression on every silhouette edge.

**Acceptance criteria**
- With the patch, a diagonal edge rendered into an offscreen target and resolved shows at least
  three distinct intermediate values along the edge; without it, exactly two.
- The demos' existing captures show no *increase* in aliased edge pixels versus the pre-Track-B
  baseline.

> Both patches are bugs of omission, not hacks. File them upstream as PRs at the same time — the
> repo already contributes `discard()` and `present()` this way.

---

## Track B — Per-demo render pipeline (three parallel tracks)

**This is where most of the visual gain lives.** Each demo is an independent track owning only
its own `src/`. Run all three in parallel if you want, but **within** a demo the packets are
strictly serial, because each builds on the last.

Do `point-light-expo` first regardless — it is the reference slice, and its whole premise is
lighting, so it is the honest test of the approach before the pattern is carried anywhere else.

For each demo D in {point-light-expo, combat-arena, traversal-study}:

### W B.1(D) — Colour management
**Owns:** `packages/demos/antiky/D/src/shaders/**`.
**Depends on:** W0.3, W0.4.

Decode albedo textures from sRGB to linear on sample (BroMetal exposes no sRGB texture format,
so this is done in-shader), do all lighting in linear, encode once on output.

**Acceptance criteria**
- A test scene of known albedo under a known light produces an output value within 2/255 of the
  analytically computed result. This is the packet's real proof — it is a *unit test of the
  colour pipeline*, not an eyeball check.
- `uDiffuseLift`, `uTextureContrast`, `uSaturation` and the `mix(vec3(0.48), …)` grey-wash are
  deleted, not re-tuned. Grep returns zero hits.
- W0.4 passes. Captures show no regression in W0.3 bounds.

### W B.2(D) — HDR target and a single tone-map
**Owns:** `packages/demos/antiky/D/src/renderer.ts`, `src/shaders/**`.
**Depends on:** W B.1(D), W A.2.

Render the scene into an RGBA16F target; apply exposure and one ACES tone-map in a post pass.

**Acceptance criteria**
- W0.4's "no `tonemapACES` in material shaders" assertion passes.
- **The captured frame is visually unchanged from before this packet** — mean per-channel
  difference under 3/255. This packet is plumbing; if the image moves, something is wrong.
- Aliased-edge pixel count does not increase (proves W A.2 held).

### W B.3(D) — Directional key light and PCF shadow map
**Owns:** `packages/demos/antiky/D/src/renderer.ts`, `src/shaders/**`.
**Depends on:** W B.2(D).

One sun, one depth-from-light pass, a 4-tap soft lookup. The shadow map writes distance-to-light
into an ordinary RGBA16F colour target — BroMetal's depth attachments are never sampleable, and
this is the approach its own `DrawToOptions.clear` documentation describes.

**Acceptance criteria**
- **Probe test:** a named probe rectangle in the ground shadow of a known object is at least 25%
  darker in luminance than a reference probe on the same material 200 px away. This is the
  bounded, mechanical test for "does it have shadows".
- No shadow acne: on a flat lit plane facing the sun, the luminance standard deviation inside a
  probe rectangle is under 0.02.
- No peter-panning: the shadow's near edge is within 4 px of the object's contact point.
- Frame time increases by no more than 40% versus W B.2(D), measured through
  `antiky tool get_render_stats`.

### W B.4(D) — Hemispheric ambient and baked AO
**Owns:** `packages/demos/antiky/D/src/shaders/**`, that demo's geometry-build code.
**Depends on:** W B.3(D).

**Acceptance criteria**
- The flat constant ambient is gone; grep finds no single-colour ambient constant.
- A surface facing up and a surface facing down under the same light differ in ambient
  contribution by at least 30%.
- An inside-corner probe is at least 15% darker than a flat-surface probe of the same material.
- W0.3's `luminanceP05` bound is now met (the scene reaches genuine darks).

### W B.5(D) — Bloom, colour grade, vignette
**Owns:** `packages/demos/antiky/D/src/renderer.ts`, `src/shaders/**`.
**Depends on:** W B.4(D), W A.1.

**Acceptance criteria**
- **Bloom probe:** a probe 20 px away from a known emissive element is at least 20% brighter than
  the same probe with bloom disabled, and the falloff is monotonic with distance.
- Bloom does not wash the frame: `clippedHigh` stays under its W0.3 budget.
- Corner luminance is 10–25% below centre luminance (vignette present but not heavy-handed).
- W0.3 passes on all bounds. This is the packet where each demo's budget should finally go green.

---

## Track C — Asset pipeline (parallel with Track B; different files)

### W C.1 — Fix the UV collapse
**Owns:** `packages/demos/antiky/traversal-study/scripts/normalize-quaternius.mjs` and that
demo's `assets/`.
**Depends on:** nothing. **Coordinate with** W B.*(traversal-study) — different files, but they
meet at the shader that samples these textures. Sequence them or agree the sampler contract up front.

`normalize-quaternius.mjs:237-238` never reads `TEXCOORD_0`; it overwrites every UV with a
palette-column lookup, producing shipped textures that are literally 1×1 pixels.

**Acceptance criteria**
- Every regenerated GLB has more unique UV pairs than it has materials. (Today `cloud-large`,
  `cloud-small` and `coastal-cliff` have exactly one.)
- No shipped texture is smaller than 64×64.
- The demo's existing asset tests pass; `assets.test.ts` is extended to assert the above so this
  cannot regress.

### W C.2 — Stop deleting normal maps
**Owns:** `packages/demos/antiky/point-light-expo/scripts/gltf-pack-lib.mjs`, that demo's `assets/`.
**Depends on:** nothing.

`gltf-pack-lib.mjs:89` runs `delete material.normalTexture` on maps that were downloaded,
hash-verified and committed.

**Acceptance criteria**
- The `delete material.normalTexture` line is gone and every derived GLB that had a normal map
  upstream still has one.
- Normal maps are applied via **triplanar projection**, which requires no tangent basis.
  (Correction: an earlier draft specified screen-space derivatives. BroMetal's DSL has no
  `dpdx`/`dpdy`/`fwidth` — verified against `dist/dsl/builtins.d.ts` — so that approach is
  impossible. Do not accept a solution built on it.)
- Probe test: on a normal-mapped surface lit at a grazing angle, luminance standard deviation
  inside a probe rectangle is at least 3× that of the same surface with normal mapping disabled.

### W C.3 — Interim: correct filtering for palette textures
**Owns:** `packages/demos/antiky/traversal-study/src/renderer.ts` (line 216 only).
**Depends on:** nothing. Supersede with W C.1.

Palette-strip textures are loaded with linear filtering, mipmaps and 4× anisotropy, which
averages adjacent palette entries into mud wherever two swatches meet. These are palette strips,
not unwrapped meshes, so the boundary is between columns of the strip rather than a UV seam.

**Acceptance criteria** — `filter: 'nearest'` on palette textures; no colour appears in the
capture that is absent from the source palette (within 4/255). Five minutes of work; do it today.

---

## Track D — Quick wins (all independent, all parallel-safe)

Each owns a distinct file or a distinct region, and none depends on any other track.

| ID | Packet | Owns | Acceptance criterion |
|----|--------|------|----------------------|
| W D.1 | Raise camera `near` | each demo's camera setup | far/near ratio ≤ 500:1 in every demo (traversal is 2400:1 today); no visible near-plane clipping in captures |
| W D.2 | One sun direction, one fog range per demo | `combat-arena/src/shaders/**` | W0.4's intra-demo agreement assertion passes |
| W D.3 | Back-face culling | `traversal-study/src/renderer.ts:297` | `cull: 'back'`; triangle count in `get_render_stats` drops with no capture difference above 2/255 |
| W D.4 | Unlit soft contact shadows | `point-light-expo/src/shaders/foundry.shader.ts:181`, `combat-arena/src/combat-projection.ts:240` | Blob luminance does not increase within 2 m of any light (today they get ~6× *brighter*); alpha falls to zero over ≥15% of the blob radius |
| W D.5 | Render interpolation | each demo's game loop | With sim at 60 Hz and present at 144 Hz, frame-to-frame position deltas are monotonic across 100 frames — no repeated-then-jumped values |
| W D.6 | Camera shake rebuild | `combat-arena/src/presentation.ts` | See below |

### W D.6 — Camera shake, in detail
**Owns:** `combat-arena/src/presentation.ts`, `tests/presentation.test.ts`.

The owner's report — "shakes and judders a lot, it's too much" — is confirmed by the code.
Diagnosis is in `02-REMEDIATION-PLAN.md`; the fix is the standard trauma model.

**Acceptance criteria**
- Shake is driven by `trauma²` (or `trauma³`), not linearly.
- Offsets come from noise, not summed sines. **Test:** the autocorrelation of the offset signal
  over 10 s has no peak above 0.3 outside lag zero. That is a bounded, mechanical test for "it
  no longer has a periodic wobble", and today's `sin(t·47)`/`cos(t·41)` pair fails it — those
  two frequencies beat with a ~1.05 s period.
- `position` and `target` receive the same translational offset, so the frame translates rather
  than swivels. Asserted directly in `presentation.test.ts`.
- Under a sustained cannon cadence (one hit per 0.34 s), peak camera offset stays below 30% of
  the hull-loss peak. The cannon must not be nearly as violent as taking damage.
- `tests/presentation.test.ts:62` continues to pass.

---

## Track E — Art direction and material assignment

Detailed briefs, material-upgrade strategy and VFX specification are in
`03-ART-DIRECTION-AND-VFX.md`, which carries 18 ranked items with their own bounded acceptance
criteria following the same rules as this document.

**Important scheduling correction:** items 1–9 of that document (~12 engineer-days) need neither
the HDR buffer nor the BroMetal patches, so **they are parallel-safe against Track A and Track B
and can start today.** Do not serialise the whole of art direction behind the render work — only
the items that genuinely consume an HDR buffer (bloom-dependent VFX, grading) belong after
W B.5(D). Triplanar material assignment in particular is both the single largest untapped visual
gain and completely independent of the render pipeline work.

Dependencies: W E(D) depends on W B.5(D). Complexity-reduction packets are in
`04-COMPLEXITY-REDUCTION.md` and are mostly parallel-safe against Track B, but check owned files.

---

## Track F — Presentation and site (fully independent; parallel with everything)

**Owns:** `packages/website/**`, `packages/demos/threejs/**`, `packages/demos/brometal/**`.

| ID | Packet | Acceptance criterion |
|----|--------|----------------------|
| W F.1 | WebGPU fallback framing | On a browser without WebGPU, `/demos` shows no error-styled cards; the requirement is stated once, deliberately |
| W F.2 | Promote `town-study` | It is the repo's strongest artifact (~9,000 LOC, real voxel mesher, shadow passes, tested character motor) and is billed identically to three fullscreen shader quads |
| W F.3 | Fix or delete blank captures | No committed PNG under `packages/demos/**/.antiky/captures/` is uniformly one colour; W0.1's blank-frame guard covers this going forward |
| W F.4 | Glass Garden exposure | Poster and runtime capture differ by under 10% mean luminance; `clippedHigh` under 0.02 |
| W F.5 | Mobile demo activation | Thumbnails activate without hover; posters are not cropped below 70% of their width on a portrait stage |
| W F.6 | Orbital Atlas resize bug | `setSize` is called only when dimensions actually change — assert call count is 1 across 100 frames at a fixed size (`orbital-atlas/src/game.ts:210-217`) |
| W F.7 | Luminous Reef plankton, Shader Study craters | No hard axis-aligned square edges at 1:1; dither applied after tone-map |

---

## Dispatch guide

**Critical path:** `W0.1 (capture timeout) → W0.1b (npm test green) → W0.2 + W0.2b → W0.3/W0.4 → W A.1 → W A.2 → W B.1..B.5(point-light-expo) → W E(point-light-expo)`

**Safe to start immediately, in parallel, before anything else:** all of Track D, all of Track F,
W C.1, W C.2, W C.3.

**Rules for whoever dispatches subagents**
1. Never assign two packets that own the same file. The owned-file list is the lock.
2. Never assign a packet whose dependencies are unmet — the acceptance criteria will not be
   satisfiable and the agent will fake them.
3. Every packet ends with a fresh capture that the agent **actually looks at**, and a committed
   `visual-metrics.json` sidecar. **A visual change that has not been captured and looked at is
   not done.** This is the single discipline whose absence produced every finding in this audit.
   The **PNG itself is not committed** — `.antiky/` is gitignored, capture evidence is scoped to
   the development session, and `*.png` is LFS here. The sidecar is the durable artifact.
4. If a packet's acceptance criteria cannot be met, the agent reports that plainly rather than
   loosening the criteria. Budgets are changed by the owner, not by the agent that is failing them.
