# Summary — goal 12: extract the BroMetalRenderDriver

**Status: complete. All nine outcomes met.**

**Date:** 2026-08-15
**Goal file:** [`execute-goal-12.md`](execute-goal-12.md)

## Action needed from the owner

| # | What | Why it needs you |
|---|---|---|
| 1 | **The public claim is now `Emerging`, and you should sanity-check the wording.** `PRODUCT.md:86` said "accepted direction, not a current capability" — true before, wrong once both demos rendered. By the taxonomy's own definitions this is **Emerging** ("a narrow working slice exists, but the broader capability remains incomplete"), not **Current**: two of four Antiky demos render through the driver, `combat-arena` and `traversal-study` still write BroMetal by hand. I chose the conservative label rather than promoting it to Current. The claim appears in exactly one place — the "three website pages" the goal mentions no longer repeat it. | product wording |
| 2 | **`@antiky/framework` depends on `brometal`.** Your call, recorded so it is not a surprise. A headless consumer never loads it: the driver is reachable only as `@antiky/framework/render-driver`, never from the barrel. | none |
| 3 | **`traversal-study` fails its own local-contrast budget at 0.58, and did so before this work.** Re-sealing reproduced the same number. `demos:verify` tests 48 and 54 were also already failing. Untouched here, but they are red and you should know. | pre-existing |
| 4 | **`antiky-town/src/town/index.ts` is 1224 lines**, above the 800-line decomposition guidance in `GOOD_ENGINEERING_H.md`. Left as one file to keep the migration diff reviewable. Splitting the pipeline definitions out is a clean follow-up. | follow-up |

## What was delivered

All nine outcomes. The four previously open ones:

4. **`point-light-expo` renders through the driver.** Zero BroMetal resource creation in its `src`,
   verified by `rg`. Mean luminance drifted 0.128856 → 0.120989, **2.0/255**, inside the 3/255
   budget. Budget tests 10/10.
5. **`antiky-town` renders through the driver.** Zero resource creation in its `src`. Every measured
   value is **bit-identical** to the baseline — mean 0.116026, p95 0.361779, local contrast 7.7478,
   saturation 0.31997 — so the drift is **0.0/255**. This is also the 2.3D evidence ADR 0004 asks be
   enforced by test rather than intention: sprites, sprite shadows and voxel surfaces all cross the
   same contract.
6. **The contract carries no BroMetal objects**, asserted by `import-boundary.test.mjs`.
7. **Portability demonstrated**: a second, non-BroMetal driver in the framework's own tests consumes
   identical frames with zero framework source edits.

Full `npm test` is green (exit 0, every suite `fail 0`); framework suite 153/153; driver tests 24/24;
antiky-town 48/48; point-light-expo 88/88. Exactly one framework file imports BroMetal.

## The two bugs that blocked outcome 4, and the one thing that found them

Both were a `setup` callback doing something it must not. `setup` runs during pipeline registration,
before any texture exists.

1. **`uTime` bound on a program that never declares it.** The migration hoisted `uTime` into a shared
   `perFrame` record that the floor draw spreads; `reliquary-floor` does not declare it. A value
   every lit material happens to want is not automatically a value every one of them has.
2. **`uBillboard` bound to a texture *key* instead of a texture** —
   `set(billboardTexture as never)` where `billboardTexture` is the string `'vfx-billboard'`. The
   `as never` cast is what let it typecheck.

**Twelve hypotheses were eliminated blind across four sessions. What ended it was fixing the
diagnosability, not forming a thirteenth.** `capture_frame` is not external — it is Playwright in
`packages/cli/src/host/managed-capture-runtime.ts`. It now installs `pageerror`, `console` and
`requestfailed` handlers writing to the file named by **`ANTIKY_BROWSER_LOG`**, inert when unset:

```
ANTIKY_BROWSER_LOG=/tmp/browser.log npm run demos:shoot -- --demo <slug>
```

The first instrumented run produced *no output*, and that was the decisive result: the host catches a
module-entry rejection, so Playwright never sees an uncaught error. One `console.error` in the demo's
catch made the message and stack appear at once. **When a harness reports only a timeout, fix the
harness before forming another hypothesis.**

## What I got wrong

- **I treated the capture harness as a black box for four sessions.** It is local code. Instrumenting
  it took twenty minutes and ended the search immediately.
- **I "corrected" a correct lead into a wrong one.** I grepped `uTime` in a `.shader.gen.ts`, counted
  four hits, and wrote the hypothesis off — those hits were the TypeScript *type parameter* and the
  WGSL source text, not the runtime `uniforms` map. Import the shader and read `default.uniforms`;
  grep will mislead you.
- **I put the driver in a separate package**, on a misreading of ADR 0021's Context as binding its
  Decision. The owner overruled it. `14-DRIVER-HOME.md` keeps the wrong reasoning visible.
- **I invented a blend mode.** `'add'` does not exist; BroMetal takes `'none' | 'alpha' | 'additive'`.

## Two contract gaps antiky-town found, both closed

Neither demo alone would have found them.

1. **`TargetRequest.filter`.** The driver hardcoded `linear` over BroMetal's `nearest` default.
   `town-shadow.shader.ts` packs one depth into R and G as whole part and fraction, decoded as
   `stored.x + stored.y / 255`; filtering that decodes to a depth belonging to neither texel and
   fills every shadow edge with acne. A target holding *numbers* now asks for `nearest`.
2. **`DrawCall.vertexData` / `DrawCall.indices`.** The die-cut characters' side walls are extruded
   from the alpha contour of whichever sprite frame is showing, so the mesh — vertex *count*
   included — is rebuilt every frame. Instance rows cannot express that.

## Traps worth knowing

- **`setup` may bind geometry and static values only.** Never a texture: name it in the frame as
  `{ texture: 'key' }`. Never a uniform the program does not declare. antiky-town had four
  near-misses that would each have thrown on a GPU.
- **`sourceDigest` covers `packages/framework/src`**, so any framework edit marks every demo's
  capture stale. A wave of red budgets after a framework change is that, not a regression.
- **The framework's API reference is generated and checked before any test runs.** A new export with
  no description fails `npm test` at `docs:api:check`.
- **Demo relative imports need `.ts` extensions** to run under Node. Vite resolves them without;
  Node cannot, so the headless harness fails on an unrelated-looking module-not-found.

## The regression tests that now exist

`renderer-construction.test.ts` in both demos builds the entire renderer headlessly against a stub
that rejects undeclared binding names, `undefined`/`null`, empty data and missing indices, then
submits one real frame. This catches the `uTime` class of fault without a browser; it was verified to
have teeth by temporarily adding an undeclared uniform. The `uBillboard` class still needs a real
renderer, because only a real one can tell a texture from a string — so run one `ANTIKY_BROWSER_LOG`
capture before believing a migration works.
