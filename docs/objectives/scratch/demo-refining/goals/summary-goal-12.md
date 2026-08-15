# Summary — goal 12: extract the BroMetalRenderDriver

**Status: partially complete. Halted at the critical acceptance criterion, deliberately.**

**Date:** 2026-08-14
**Commits:** `801f8c7`, `d4dd8f6`, `49fd76b`, `58f0c1a`, `c36b471`, `8b6d485`
**Goal file:** [`execute-goal-12.md`](execute-goal-12.md)

## Action needed from the owner

Two items. The first is the reason this goal is not closed.

| # | What | Why it needs you | Blocks |
|---|---|---|---|
| 1 | **No demo runs on the driver yet.** Goal 12 names that its critical acceptance criterion, and it is not met. The driver is built, tested and capable; moving `point-light-expo` onto it is ~20 programs, five passes and a deliberate draw order, and I stopped rather than half-move it. | Nothing is blocked on a decision — this is remaining work, and you should know the goal is open rather than closed. The goal itself says a named backlog beats a demo that moved halfway. | the render driver becoming a **Current** public claim rather than **Direction** |
| 2 | **`@antiky/framework` now depends on `brometal`.** Your call to put the driver in the framework required it. A headless consumer never loads it — the driver is only reachable as `@antiky/framework/render-driver`, deliberately not from the package barrel — but the dependency is now declared. | You made this call knowingly; recorded so it is not a surprise later. | nothing |

## What was delivered

Against the nine required outcomes:

1. **ADR 0021 placed and 0006 superseded — already done, verified.** `0021` is Accepted, supersedes
   `0006`, cites no planning document, and resolves the `studio/0007` conflict. `0006` carries the
   revision-history hash taken *before* the supersede edit. `tag-hash.test.sh` passes. Placed by an
   earlier goal; this goal confirmed it rather than redoing it.
2. **The public claim — already correct, and a stale count fixed.** `PRODUCT.md:85` already reads
   "accepted direction, not a current capability", and no website page claims otherwise. While
   checking, found the pages still said "**ten** runnable studies" after `town-study`'s retirement,
   and the WebGPU gate said "eight of ten". Corrected to nine and seven of nine.
3. **The driver's home, decided in writing before code** —
   [`14-DRIVER-HOME.md`](../14-DRIVER-HOME.md). See *What I got wrong*: the first answer was a
   separate package and the owner overruled it.
4. **`point-light-expo` on the driver — NOT DONE.** The critical criterion. It was attempted:
   `render-batches.ts` converts cleanly to pipeline definitions plus plain instance data, and the
   converted file contains no BroMetal at all. Landing only that file left **71 type errors** in
   `renderer.ts`, which is the coupling measured rather than estimated — the batches, the shadow
   pass and the frame are one unit. The conversion was reverted to keep the tree green. See owner
   item 1.
5. **2.3D evidence — partially.** A driver test drives a sprite batch, a sprite shadow and a voxel
   surface through the identical contract shape, which is what `0004:22` asks be enforced by test
   rather than intention. `antiky-town` itself has not moved.
6. **A data contract carrying no BroMetal objects.**
   `packages/framework/src/render/render-contract.ts` imports nothing, asserted by
   `import-boundary.test.mjs`. `isContractValue` rejects class instances and functions, and a test
   proves it can fail.
7. **The portability property, demonstrated the right way.** A second, non-BroMetal driver lives in
   the framework's own tests, consumes the identical frames, shares no code with the BroMetal one,
   and required **zero** framework source edits.
8. **The exception backlog, checked rather than assumed** —
   [`15-DRIVER-BACKLOG.md`](../15-DRIVER-BACKLOG.md). Checking it found two real gaps, both now
   closed, and established that **nothing on the list blocks a migration today**.
9. **The BroMetal patches — practice verified.** Five patches, not the two the goal names (goals 02,
   06 and 07 added three). Each has its own focused upstream pull request — #3, #4, #5, #6, #7 — and
   the runner is idempotent with six passing tests. The practice `0021` states is being followed.

## What I got wrong

**I put the driver in the wrong place, on a misreading of the ADR the owner owns.** I built it as a
separate workspace package, `@antiky/brometal-driver`, to keep `import-boundary.test.mjs` passing
untouched. The owner asked why it wasn't simply in the framework, and they were right.

I had anchored on a sentence in ADR 0021's **Context** — *"Framework source cannot import
BroMetal"* — which describes the constraint as it stood *before* 0021. The **Decision** section says
*"Framework code **outside the driver** will not use BroMetal"*, which already carves the driver out
as the one exception and therefore anticipates it living inside the framework. I read a Context
sentence as though it bound the Decision.

Worse, the design note argued *against* the in-framework option partly on the grounds that adding
`brometal` to the framework's dependencies "contradicts ADR 0021 directly". That argument was wrong
for the same reason. Both the note and the placement are corrected, and the note keeps the wrong
reasoning visible rather than quietly deleting it.

The move was made properly rather than by dodging: the boundary test now permits `brometal` in **one
exact path**, and a second test asserts the set of framework files importing BroMetal is exactly that
one file.

**I invented a blend mode.** The driver's pipeline options typed `blend?: 'alpha' | 'add'`. BroMetal
accepts `'none' | 'alpha' | 'additive'`. Every glow, ring and effect pipeline across all four Antiky
demos uses `additive`, so the driver would have rejected most of the effect work in the repository
the moment a demo tried to move. Found only because outcome 8 required checking the backlog claim
against real code instead of assuming it. Fixed, with a test that builds one pipeline of each mode.

**I twice wrote a comment that a test rejected, for the same reason.** `import-boundary.test.mjs`
forbids demo names in framework source, and I named the two demos the driver was extracted from — in
the contract, then again in the driver. Rewording rather than loosening the guard was right both
times, but I should have learned it the first time.

## What the attempt measured

Converting one file and counting the damage is worth more than an estimate:

- `render-batches.ts` → pipeline definitions plus instance data: **clean**, zero BroMetal left, and
  the data halves (`createSurfaceInstanceData`, `createGlowInstanceData`) were already factored out
  by earlier goals, so they needed no change at all.
- That one file alone broke `renderer.ts` in **71 places**. Every batch is constructed with a
  renderer and consumed as `.program` / `.upload()` / `.draw()` / `.drawDepth()`, and the shadow
  pass binds those same programs.

So the remaining work is bounded and understood, not open-ended: four more files convert the same
way, then `renderer.ts` is rewritten once to build a driver and a frame. It cannot be split across
sessions in a green state, which is the whole reason it has not landed.

## Traps worth knowing

- **The framework's API reference is generated and checked before any test runs.** A new export with
  no description fails `npm test` at `docs:api:check`, before a single assertion executes. A module
  reachable through two package entries must be listed under both areas.
- **`sourceDigest` covers `packages/framework/src`, not just the demo folder.** Any framework edit
  marks every demo's capture stale, correctly. A wave of red visual budgets after a framework change
  is that, not a regression — re-shoot before diagnosing.
- **BroMetal's `Renderer` has no `width`/`height`.** It exposes `canvas` and `aspect`; sizes come
  from `renderer.canvas.width`.
- **BroMetal ties depth-write to blend mode** with no separate control, which
  `point-light-expo/src/renderer.ts:354-360` documents as having erased an overlay. The driver
  inherits that coupling; it is item 3 of the backlog.

## Evidence

| Check | Result |
|---|---|
| `import-boundary.test.mjs` passes with the driver in the tree | yes — and a new test asserts exactly one framework file imports BroMetal |
| Driver input constructible with no `brometal` import | `render-contract.test.ts` imports nothing from it |
| Second driver, zero framework source edits | consumes the identical frames; 6 contract tests |
| A driver test drives a sprite | sprite batch, sprite shadow and voxel surface, identical shape |
| `rg` finds no BroMetal creation in `point-light-expo/src` | **not met** — the demo has not moved |
| Before/after captures for a moved demo | **not applicable** — nothing moved |
| `dev-host.test.mjs` passes, fence untouched | yes |
| Framework suite | 141 tests, 0 failures |
| `tsc --noEmit` all workspaces | clean |
| Full `npm test` | **0 failures** |
| BroMetal patch practice | 5 patches, 5 distinct upstream PRs, idempotent runner, 6 tests |

## What this unblocks

- The driver, the contract and `registerPipeline` exist and are tested, so a demo migration is now
  transcription rather than design. `15-DRIVER-BACKLOG.md` states that explicitly and names what
  makes `point-light-expo` large.

## What remains blocked

- **The goal itself.** Outcome 4 is unmet and outcome 5 is half-met. A future session moves
  `point-light-expo`, then `antiky-town`, deletes their BroMetal ownership, and captures before and
  after. Only then does the render driver become a Current claim.
