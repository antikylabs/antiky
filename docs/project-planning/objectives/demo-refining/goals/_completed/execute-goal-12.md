# Execute goal 12: extract the BroMetalRenderDriver

## Prerequisites

- **Goals 06 and 07** — the colour management, HDR target, key light, shadow pass and post chain,
  landed in `point-light-expo` and then in a second demo. The driver is **extracted from two working
  implementations**, never designed from zero. Designing from one implementation is precisely the
  failure this decision exists to avoid (`09-RENDER-DRIVER-DECISION.md:190-195`).
- **Goal 11** — the framework promotions. The driver's disposal, its seeded inputs and its frame
  boundary all sit on interfaces goal 11 establishes. Building the driver first means building them
  twice.
- ADR 0021 must be **placed before any driver code lands**, not after. See outcome 1.

This is the destination the whole plan has been building toward. Every earlier goal is either
evidence for it or cleanup that stops it inheriting scar tissue.

## `/goal` objective

Build `BroMetalRenderDriver` in the framework, extracted from two working per-demo render pipelines,
and prove it by moving `point-light-expo` onto it and deleting that demo's BroMetal resource
ownership entirely.

The owner has decided the shape (`09-RENDER-DRIVER-DECISION.md:13-31`): the framework owns the
driver; it owns programs, textures, render targets, buffers, GPU state and disposal; it is
**BroMetal-specific by name and by design, with no backend abstraction and no plugin seam** — the
name *is* the design decision, `BroMetalRenderDriver` and not `RenderDriver` with a BroMetal
implementation hidden behind it. Games use the driver by default. Direct BroMetal use in a game
module is an exception for work the driver cannot yet do, and when a game reaches for it that is a
signal the driver is missing a feature. Other renderers stay compatible but unfunded.

Portability comes from the **data contract**, not from a swappable backend. The driver receives
Antiky render data — IDs, pipeline keys, assets, typed updates — and never a BroMetal object.

## Required outcome

When the work is complete, the repository must have:

1. **ADR 0021 placed, and 0006 superseded correctly.** Create
   `docs/adr/framework/0021-brometal-render-driver-ownership_H.md` — `0021` is the next free
   framework number. Tag `0006` **before** editing it, while `HEAD` still holds the old text, using
   `./docs/adr/tag-hash.sh`. Set `0006`'s status to `Superseded by [0021]`; do not delete it and do
   not reuse its number. Add `0021` to the Framework list in `docs/adr/README.md`. The record must
   stand on facts alone — `docs/adr/README.md` forbids an ADR citing an objective or implementation
   plan as authority, so `0021` may not reference `docs/objectives/` at all. It also resolves the
   live contradiction: `framework/0006:25` says only an Antiky-owned `RenderDriver` will use BroMetal
   directly, while the *later accepted* `studio/0007:41-42` gives the game module renderer setup and
   disposal, and a reader cannot today tell which record governs a framework game using BroMetal;
2. **the public claim corrected first.** `packages/website/PRODUCT.md:85` and three website pages
   tell the public that "the current Framework render driver uses BroMetal" as a **Current** claim.
   No driver exists yet, so under PRODUCT.md's own taxonomy at `:87-96` it is a **Direction** claim.
   Fix the wording before the driver ships, and change it back to Current only when a demo actually
   runs on the driver;
3. **the driver extracted from two implementations, and a stated home that keeps the import boundary
   intact.** This is the first design question and it must be answered in writing before code:
   `packages/framework/tests/import-boundary.test.mjs:6-13` forbids framework source from importing
   `brometal`, and `0021` itself restates that the framework must run without a GPU and without a
   browser. A framework-owned component that imports BroMetal cannot live inside the tree that test
   guards without the test changing — and changing that test is an architecture decision, not an
   implementation detail. State where the driver's source lives, show `import-boundary.test.mjs`
   passing, and if the answer requires editing that test, stop and get the owner's decision first;
4. **`point-light-expo` running on the driver with its BroMetal resource ownership deleted.** This is
   **the critical acceptance criterion**. Until a demo has actually moved onto it, the driver is
   unproven — an interface with no caller is a hypothesis. "Deleted entirely" means the demo's `src/`
   creates no BroMetal program, texture, render target or buffer, and disposes none;
5. **2.3D evidence, from `antiky-town`, alongside the 3D evidence.** `docs/adr/framework/0004-23d_H.md:14`
   requires equal framework support for 2D, 3D and 2.3D, and `:22` says framework code must not assume
   that every object is a mesh, sprite, voxel or rigid body. `antiky-town` is the repository's only
   2.3D artifact — sprites over voxels, 2D characters in a 3D world — and it is also the only demo
   with a real post pass, so it has already solved part of what the driver is for. **The driver is
   not complete until it serves both a 3D demo and `antiky-town`.** A render slice promoted on
   3D-only evidence would violate `0004:22` on first contact with a sprite;
6. **a data contract that carries no BroMetal objects.** A test must be able to construct valid
   driver input with no BroMetal import present. If the input type mentions a BroMetal type, the
   contract has failed and the "second driver" property below is unreachable;
7. **the portability property demonstrated the right way.** The acceptance test is **"can a second
   driver be written without changing the framework"** — *not* "can the backend be swapped without
   changing the interface". Demonstrate it cheaply: a second, non-BroMetal driver implementation used
   only by tests, consuming the identical input and sharing no code with the first. If writing it
   requires a single framework edit, the contract is not yet a contract;
8. **a checked claim from every demo that stays on hand-written BroMetal.** The moment the driver
   ships, every demo still hand-writing BroMetal is implicitly claiming the driver cannot do its
   work. That claim must be checked, not assumed: each such demo records the specific driver feature
   it lacks, and that list becomes the driver's backlog. A long list means the driver is incomplete,
   which is a signal to add features, not a reason to normalise the exception; and
9. **the two BroMetal patches carried under the practice `0021` states**: patch locally, send one
   focused upstream pull request per patch, retire the patch when it is accepted. Both current
   patches correct errors, so both satisfy the contribution clause. No separate ADR for the
   `postinstall` patch step — it is normal dependency practice with a stated exit.

## In scope

- The driver's implementation, its tests, and its data contract.
- Moving `point-light-expo` and `antiky-town` onto it, and deleting the resource ownership each of
  them replaces.
- Placing ADR 0021, tagging and superseding 0006, updating `docs/adr/README.md`, and considering
  whether `studio/0007` needs an in-place clarification pointing at `0021` for the
  framework-plus-BroMetal case. It is not wrong; it is the record a reader hits first.
- Correcting the PRODUCT.md render-driver claim and the three website pages that repeat it.
- Shadow maps, the HDR target, tone mapping, bloom and grading as **driver responsibilities in the
  end state**. The per-demo copies built in goals 06 and 07 are the proving ground, not the
  destination.

## Required tests and evidence

At minimum, prove:

- `packages/framework/tests/import-boundary.test.mjs` passes, unchanged, with the driver in the tree;
- driver input can be constructed and asserted in a test file that imports nothing from `brometal`;
- the test-only second driver consumes the same input with **zero** framework source edits, and the
  framework's own tests pass against it;
- `rg` over `packages/demos/antiky/point-light-expo/src` finds no BroMetal program, texture, render
  target or buffer creation, and no disposal of one;
- `point-light-expo`'s captured frame before and after the move differs by under 3/255 mean
  per-channel — the move is plumbing, and if the image moves, something is wrong — with the
  before/after `visual-metrics.json` sidecars committed;
- its goal-01 visual budget stays green, and `get_render_stats` shows frame time within the budget
  goal 07 established for it;
- the same three checks pass for `antiky-town`, and at least one driver test drives a **sprite**
  through the contract, so `0004:22` is enforced by test rather than by intention;
- resources acquired through the driver are released on dispose, asserted by the demos' existing
  resource-leak tests passing after re-pointing their imports;
- `packages/demos/tests/dev-host.test.mjs` passes — the fence is untouched by this goal; and
- every visual step ends with a capture that was actually looked at. A visual change that has not
  been captured and looked at is not done.

## Explicit non-goals

- **Do not add a backend abstraction, a plugin seam, or a `ThreeBackend`.** An interface over
  BroMetal and Three.js fails on altitude: BroMetal is a shader compiler with a thin runtime that
  takes buffers and WGSL, Three.js is a scene graph that takes meshes and materials and owns the
  pipeline itself. A shared interface must sit at one of those heights and either choice discards the
  other backend's value. Designed against one real backend it would end up BroMetal-shaped regardless
  of intent.
- Do not write a second ADR for the other-renderer position. `studio/0007` already decides that
  renderer choice lives in the game module; effort allocation is a product priority, not an
  architecture decision, and a record for it would decide nothing new.
- Do not build a Three.js driver. Other renderers stay compatible and unfunded; porting later is
  accepted as cheap.
- Do not let `0021` cite this directory, or any planning document, as authority.
- Do not design the driver from `point-light-expo` alone. Two working implementations, or stop.
- Do not begin driver code before `0021` is placed. Track B's ADR gate is what makes game-module
  BroMetal ownership explicitly permitted rather than ambiguous.
- Do not move `combat-arena` or `traversal-study` onto the driver in this goal unless their features
  are already covered. Record what they need instead.

## Engineering constraints

- `antiky-town` is in scope for modification and is **required** evidence here, not optional
  reference. It is the largest Antiky demo and it was excluded from every audit this plan is built
  on, so budget for reading it before changing it and say so in the estimate rather than discovering
  it mid-flight.
- Tests are required for code changes. When fixing a reported bug, write the regression test first,
  run it, watch it fail, then fix.
- Short one-line commit messages. No coauthor tags.
- Capture PNGs are **not** committed — `.antiky/` is gitignored, evidence retention is
  session-scoped and `*.png` is LFS here. The committed artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes.
- The framework is renderer-agnostic and platform-agnostic.
  `packages/framework/tests/import-boundary.test.mjs:6-13` forbids `brometal`, `node:`, `react` and
  `next` imports in framework source. The driver is the one component that speaks BroMetal, and
  outcome 3 exists because reconciling those two sentences is the first real design problem in this
  goal — not a formality.
- Framework code outside the driver must not use BroMetal, and the driver must not hand a BroMetal
  object back out.

## Completion definition

The goal is complete when ADR 0021 is placed and 0006 is tagged and superseded, the driver exists
with a stated home that leaves the import boundary passing, `point-light-expo` and `antiky-town` both
run on it with their own BroMetal resource ownership deleted, a test-only second driver consumes the
same contract with no framework edit, at least one driver test drives a sprite, and every moved demo
has before/after captures with committed metrics sidecars showing no regression.

If the driver cannot serve `antiky-town` without a backend abstraction, that is a finding to report,
not a licence to add one. If a demo cannot move onto the driver, name the missing feature — that is
the driver's backlog, and it is more useful than a demo that moved halfway.
