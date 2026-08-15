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

A component that imports BroMetal cannot sit inside the tree that test guards *while the test stays
as written*. Goal 12 reserves that edit for the owner: *"changing that test is an architecture
decision, not an implementation detail… if the answer requires editing that test, stop and get the
owner's decision first."*

So the question is not whether the framework owns the driver — 0021 settles that. It is which
directory the source sits in, and whether the test should carve out an exception.

## Owner decision, 2026-08-14

**The driver lives in the framework, at `packages/framework/src/render/brometal-driver.ts`, reached
as `@antiky/framework/render-driver`.** The owner made this call when the first draft of this note
put it in a separate package.

The first draft was wrong, and the reason is worth keeping. It leaned on a sentence in ADR 0021's
**Context** — *"Framework source cannot import BroMetal"* — which describes the constraint as it
stood *before* 0021. The **Decision** section says something different and more specific:

> The framework will own this driver. The driver will use BroMetal directly. … Framework code
> **outside the driver** will not use BroMetal.

That phrasing already carves the driver out as the one exception, which means 0021 anticipates the
driver living inside the framework. Reading a Context sentence as though it bound the Decision is
what produced the extra package.

What the move required, and what keeps it honest:

- `import-boundary.test.mjs` now permits `brometal` in **one exact path**, `render/brometal-driver.ts`
  — not a directory and not a pattern. A new test asserts the set of framework files importing
  BroMetal is exactly that one file, so a second cannot join it quietly.
- The driver is reachable only as `@antiky/framework/render-driver`, never from the package barrel.
  A server importing `@antiky/framework` still does not load a WebGPU library.
- `@antiky/framework` now declares `brometal` as a dependency. Installing it on a machine with no
  GPU downloads the library but never executes it, because nothing on the headless path imports the
  driver entry.

The rejected alternative is kept below, because the trade-off it names is real and a future reader
should not have to rediscover it.

## The two designs that were considered

### Option A — the driver is its own workspace package (**not chosen**)

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

### Option B — the driver sits in the framework package, outside `src/` (**not chosen**)

`packages/framework/driver/`, exported as `@antiky/framework/driver`.

The test only walks `src/`, so this would pass without being edited.

**Rejected, and it is worth being clear why this is not what the owner chose.** It passes by
dodging: the test's intent is "framework code does not import BroMetal", and moving the import one
directory sideways satisfies the letter while abandoning the meaning. The chosen design does the
opposite — it edits the test to state the exception out loud, scoped to one exact path, with a
second test asserting that set stays a single file. An exception a reader can see beats an exception
hidden by a directory boundary.

## Decision

~~Option A.~~ **Superseded by the owner decision above.** The driver lives in the framework at
`packages/framework/src/render/brometal-driver.ts`.

The split of responsibility:

| Where | What | Imports BroMetal |
|---|---|---|
| `packages/framework/src/render/` | the render data contract — pass descriptions, pipeline keys, typed updates | **no** |
| `packages/framework/src/render/brometal-driver.ts` | `createBroMetalRenderDriver`, which reads that contract and drives BroMetal | yes — the one permitted file |
| a demo's `src/` | its own shaders and its scene, expressed as contract data | no, once moved |

**An owner decision was needed and was made**, because the boundary test changed. Goal 12 reserved
exactly this: *"changing that test is an architecture decision, not an implementation detail."*

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
