# Where the BroMetal render driver lives

**Date:** 2026-08-14
**Status:** design decision, made before driver code. Required by
`goals/execute-goal-12.md` outcome 3.
**Authority:** `docs/adr/framework/0021-brometal-render-driver-ownership_H.md`. This document applies
that record; it does not decide anything the record leaves open about ownership.

## The problem, stated exactly

Two accepted constraints meet head-on:

- ADR 0021 says *"The framework will own this driver"* and *"The driver will use BroMetal
  directly."*
- ADR 0021 also says *"Antiky Framework must operate without a GPU and without a browser… A test
  enforces this rule. Framework source cannot import BroMetal."* That test is
  `packages/framework/tests/import-boundary.test.mjs`, which walks `packages/framework/src/**` and
  rejects any import matching `/^brometal/`.

A component that imports BroMetal cannot sit inside the tree that test guards. Goal 12 forbids
editing the test to make room: *"changing that test is an architecture decision, not an
implementation detail… if the answer requires editing that test, stop and get the owner's decision
first."*

So the question is not whether the framework owns the driver — 0021 settles that. It is which
directory the source sits in, given that ownership and that test.

## Two designs

### Option A — the driver is its own workspace package

`packages/brometal-driver/`, published as `@antiky/brometal-driver`, depending on `brometal` and on
`@antiky/framework` for the render contract types.

The framework keeps the **contract**: the render data types, which import nothing from BroMetal. The
driver package implements it.

- `import-boundary.test.mjs` passes **unchanged**, because the driver is not under
  `packages/framework/src`.
- `@antiky/framework` gains no dependency on `brometal`, so the framework still installs and runs on
  a server with no GPU.
- A second driver is another package implementing the same contract, which is exactly the
  portability property 0021 asks for.

### Option B — the driver sits in the framework package, outside `src/`

`packages/framework/driver/`, exported as `@antiky/framework/driver`.

The test only walks `src/`, so it would pass without being edited.

**Rejected.** Two reasons, and the first is decisive:

1. **It contradicts ADR 0021 directly.** `@antiky/framework`'s `package.json` would have to declare
   `brometal` as a dependency. Installing the framework would then install a WebGPU library on a
   server that has no GPU, which is the exact situation 0021's Context says must not happen. Passing
   the test while breaking the sentence the test exists to enforce is worse than failing it.
2. **It passes by dodging.** The test's intent is "framework code does not import BroMetal". Moving
   the import one directory sideways satisfies the letter and abandons the meaning. A future reader
   would reasonably conclude the boundary is decorative.

## Decision

**Option A.** The driver's source lives at `packages/brometal-driver/src/`, as the workspace package
`@antiky/brometal-driver`.

The split of responsibility:

| Where | What | Imports BroMetal |
|---|---|---|
| `packages/framework/src/render/` | the render data contract — pass descriptions, pipeline keys, typed updates | **no** |
| `packages/brometal-driver/src/` | `createBroMetalRenderDriver`, which reads that contract and drives BroMetal | yes |
| a demo's `src/` | its own shaders and its scene, expressed as contract data | no, once moved |

"The framework owns this driver" is satisfied in the sense 0021 means it: the driver is Antiky's,
sits beside the framework, is versioned and tested with it, and is the default path for every game.
It is not a third-party or per-game component. Ownership is about who is responsible for it, not
about which folder holds the file — and the folder is constrained by a rule 0021 itself states.

**No owner decision is needed**, because no test changes and no accepted record is contradicted.

## What the contract may and may not carry

Outcome 6 requires that driver input be constructible with no BroMetal import present, and outcome 7
requires a second driver to consume the identical input.

The boundary that makes both true:

- **Per-frame render data is contract data.** Pass order, target sizes, clear colours, instance
  rows, uniform values, pipeline keys. Numbers, strings and typed arrays. No BroMetal types.
- **Pipeline registration is driver-specific setup, not contract data.** A compiled shader is a
  BroMetal artifact — `*.shader.gen.ts` exports a `CompiledShader`. The demo hands its compiled
  shaders to `createBroMetalRenderDriver` at construction, keyed by pipeline key. A second driver
  would take its own backend's equivalent at *its* construction and consume the same per-frame data.

This is the line 0021 draws when it says the data uses *"Antiky identifiers, pipeline keys, assets,
and typed updates"* — a pipeline **key** crosses the contract, the compiled pipeline does not.

Handing a demo's compiled shader to the driver is not the demo "creating a BroMetal program". The
demo imports a generated constant; the driver creates, owns and disposes the program. Outcome 4's
bar — the demo's `src/` creates no program, texture, render target or buffer, and disposes none —
is still met.
