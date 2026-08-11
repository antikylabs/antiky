# Execute goal 11: promote what has earned it into the framework

## Prerequisites

- **Goal 03** — the quick-win track. **Render interpolation is handled there, not here.** It is
  ranked first in `05-FRAMEWORK-EASY-WINS.md` and it is deliberately excluded from this goal so the
  two are not built twice. Do not add `frameRenderAlpha` in this goal; consume it if goal 03 shipped
  it.
- **Goals 06 and 07** — the colour and lighting work. The promotions below delete and re-point code
  inside the three Antiky demos' `game.ts`, `simulation.ts` and `inspection.ts`. Landing them while
  those demos' render paths are being rewritten produces avoidable merge pain and makes "the demo's
  existing tests pass unchanged" impossible to interpret.

Owned files: `packages/framework/src/**`, `packages/framework/tests/**`, and the non-render source
of all four Antiky demos including `antiky-town`. This goal conflicts with goal 09 on those demos —
sequence them, or agree the file split up front.

## `/goal` objective

Promote six capabilities into `@antiky/framework` that have already been independently
re-implemented three or more times with the same shape, delete each demo's local copy, and prove the
promotion by leaving that demo's existing tests passing unchanged.

The bar is empirical, not aesthetic: a capability qualifies when it has been independently
re-implemented in three or more demos with the same shape
(`05-FRAMEWORK-EASY-WINS.md:5-7`). Everything that failed that bar is listed below as rejected, with
the reason, so nobody re-litigates it.

**Correction to carry into the work:** six of the ten demos do not depend on `@antiky/framework` at
all, and that is enforced by test. `packages/demos/tests/dev-host.test.mjs:7-16` declares the
showcase matrix; `:72` asserts the dependency matches `framework:` and `:95` asserts the string
`@antiky/framework` does not even appear in a framework-free demo's source. That fence is
deliberate — it proves BroMetal and Three.js work standalone — and this goal does not knock it down.

## Required outcome

When the work is complete, the repository must have:

1. **a duplicate-file guard for `character-motor.ts`, landed first — then a real decision on it.**
   `packages/demos/brometal/town-study/src/town/physics/character-motor.ts` and
   `packages/demos/antiky/antiky-town/src/town/physics/character-motor.ts` are **byte-identical**,
   1,286 lines each, both hashing to `7d25770c0f80275956bec78e7d5c8293`. It is the highest-quality
   code in the repository and it is maintained in two packages with **no test that they agree**. Ship
   the guard first: it is thirty minutes, it adds no behaviour, and it stops further drift while the
   real fix is decided. Then propose the real fix with the evidence it needs, and note the constraint
   that shapes it — `town-study` is framework-free by the fence at
   `packages/demos/tests/dev-host.test.mjs:72,95`, so a shared home for this code cannot be
   `@antiky/framework` unless the fence moves, which is the owner's call. The honest reading of the
   promotion bar still applies: this is **one** implementation plus a verbatim copy, not convergence,
   and `CharacterPhysicsWorld` (`character-motor.ts:130-134`) is already the right interface if and
   when a second, genuinely independent consumer appears;
2. **a disposal scope in the framework — 7 implementations collapsed to 1.** Three Antiky
   (`point-light-expo/src/resource-lifetime.ts` 56 lines, `combat-arena/src/resource-lifetime.ts`
   26 lines — `diff` shows only line wrapping between them, `traversal-study/src/resource-scope.ts`
   118 lines), two Three.js two-array patterns (`glass-garden/src/game.ts:75-76,284-290`,
   `orbital-atlas/src/game.ts:68-69,242-246`), one hand-ordered list of **22** `.dispose()` calls
   (`town-study/src/town/index.ts:1031-1054`), and **the framework's own, which is the worst of the
   seven**: `EngineSessionDisposalError` keeps a `failureCount` and discards every cause.
   `traversal-study` already built the right one — an `AggregateError` carrying every cause — so this
   is transcription, not design. It must type on `{ dispose(): void }` and nothing else, because
   glass-garden's stack holds five unrelated Three types;
3. **one seeded RNG, and the ADR 0013 gap closed.** Six copies, five of them the same
   `fract(sin(a·k₁ + b·k₂) · k₃)` folklore hash and **no two using the same constants**:
   `point-light-expo/src/simulation.ts:131-134` (`73.17, 41.73, 43_758.5453`),
   `combat-arena/src/combat-state.ts:176-179` (`91.71, 37.13, 43758.5453`),
   `traversal-study/src/simulation.ts:173-176` (`73.91, 19.37, 41758.31`),
   `traversal-study/src/renderer.ts:277-280` (`63.17, 17.53, 43147.19` — a *second copy in the same
   package*), and `town-study/src/town/art/town.ts:2191`. `docs/adr/framework/0013-explicit-simulation-inputs_H.md`
   requires the authoritative simulation to receive "random seeds or random streams" explicitly; the
   framework shipped the clock, the inputs and the system order and **no seed exists anywhere**, so
   this closes a real compliance gap rather than adding a convenience. It is also a correctness fix:
   ECMA-262 does not require `Math.sin` to be correctly rounded, and `seeded()` feeds simulated state
   (`point-light-expo/src/simulation.ts:160`) which feeds `getStateDigest()`, which the MCP reports to
   agents as ground truth via `step_simulation` (`packages/cli/src/mcp/tools.ts:400`). Integer ops
   only — `Math.imul`, `^`, `>>>`;
4. **one latched input buffer — and a bug that never propagated, fixed.** Three copies
   (`point-light-expo/src/input-buffer.ts` 20 lines, `combat-arena/src/input-buffer.ts` 26,
   `traversal-study/src/input-buffer.ts` 59), all exposing `capture`/`read`/`consume` and all called
   in the same order. `combat-arena/src/input-buffer.ts:12-17` added rising-edge detection;
   `point-light-expo/src/input-buffer.ts:11` still does `pending ||= clicked`, so its relay
   interaction **re-triggers on a held pointer today**. Someone found and fixed a real bug in one
   copy and it never reached the others. The three demos also carry 171 + 189 + 112 = **472 lines of
   test testing one module three times**. The promoted version must be edge-triggered by
   construction, so the bug becomes unrepresentable rather than merely fixed;
5. **one bounded event recorder — 3 byte-identical rings collapsed.**
   `point-light-expo/src/inspection.ts:33,72-74,279-293` (capacity 40),
   `combat-arena/src/inspection.ts:21,48-50,283-297` (32),
   `traversal-study/src/inspection.ts:52,71-73,305-313` (64). The retention loop is the same three
   lines in all three, the `createEventHistory` envelope is the same fourteen, and the private helper
   `function count(value) { return { available: value, retained: value }; }` appears **character for
   character** in all three. The framework already owns the *format* and forces every caller to
   hand-assemble the counts and the retention block — a shallow module made deep. The recorder must
   take the timestamp as an argument, because two demos call `new Date().toISOString()` inside
   `record()`;
6. **a zero-dependency contract module.** `packages/framework/src/game/host.ts:1-19` imports from
   `inspection/snapshot`, `point-light/commands`, `point-light/world-inspection`,
   `point-light/inspection` and `sessions/engine-session/contract`, so **you cannot obtain
   `GameModuleEntry` without pulling in the entire point-light service type graph.** That is why
   hand-copying looked cheaper than importing even to demos that *could* import. Five of the six
   hand-copied `studio-game.ts` files are **byte-identical** (`af245243d07bb1810e1dcce4dda36dc0`;
   only `town-study`'s differs, because it also needs `mode`) — and **they have already drifted**.
   They declare `pointer: { x, y }` while the real `GamePointerInput` (`host.ts:22-30`) has seven
   fields, so those demos cannot see `clicked`, `down`, `active`, `dragX`, `dragY`, and cannot see
   `movement` (`host.ts:33-37`) or `mode: 'ambient' | 'interactive' | 'thumbnail'` (`host.ts:39`) at
   all. Neither Three.js demo can degrade for thumbnail mode even though the host sets it; and
7. **a session frame driver — last, and the only medium-risk item.** Four implementations of the
   elapsed-time derivation (`point-light-expo/src/game.ts:141-144`, `combat-arena:131-134`,
   `traversal-study:99-102`, `town-study/src/town/index.ts:1069-1074`), plus **nine identical
   inspection-control method bodies** across three demos, each repeating
   `previousPlatformTime = null` — a framework invariant leaking into game code. Three accidental
   divergences: `traversal-study/src/game.ts:101` clamps at `Math.min(0.1, …)` which is *looser* than
   the framework's `MAX_FRAME_ELAPSED_SECONDS = 0.05` and is therefore dead code that reads as
   live; one demo honours `renderRequested` and two ignore it; and **no demo reads `advance()`'s
   result code** — all eight error codes, including `SESSION_FAULTED`, are silently dropped
   everywhere, so a faulted session presents as a frozen picture with no diagnostic anywhere.

## In scope

- The seven items above, in that order. Items 2–6 are mutually independent and parallelise across
  agents; item 7 lands last because its interface is informed by the others.
- Deleting each demo's local copy as part of the same promotion, so no capability ships in two places.
- The independently shippable one-hour fix inside item 2: make `EngineSessionDisposalError` carry the
  causes.
- Splitting the pure contract types into an import-free module and adding a **guard test** that
  `GameModuleEntry` stays structurally assignable to each of the six `StudioGameEntry` declarations.

## Required tests and evidence

At minimum, prove:

- the `character-motor.ts` guard fails when either copy is edited, and neither package is modified to
  make it pass;
- disposal happens in reverse adoption order; when 3 of 5 resources throw, all 5 `dispose()` methods
  are still called and an `AggregateError` carrying all 3 causes is thrown; `rollback(cause)` rethrows
  `cause` itself, and when rollback also fails both are preserved;
- `hashUnit` uses no `Math.sin` and no floating-point hashing; 1,000 draws from a fixed seed match a
  committed golden array exactly; a fork produces an identical sequence whether or not a sibling fork
  was created or drawn from first; and 100,000 `unit()` draws land within ±1% of uniform across 10
  buckets — the test the `sin` hash would fail;
- **regression test for the divergence:** a held press across 10 frames yields exactly **one** pending
  action, and a frame with `completedSteps === 0` does not clear a pending action. Write it first,
  watch it fail against `point-light-expo`'s copy;
- with capacity 3, recording 10 events retains the last 3, reports `counts.available === 10`,
  `retention.droppedCount === 7` and `incomplete === true`; sequence numbers are 1-based, monotonic,
  and never reused after a drop;
- the contract module has **zero import statements**, asserted inside
  `packages/framework/tests/import-boundary.test.mjs`, and a type-level test fails if
  `GamePointerInput` gains a required field;
- a non-`ADVANCED` frame result invokes the fault channel exactly once and still presents;
  `stepSimulation` presents with alpha 0; and `traversal-study`'s dead `Math.min(0.1, …)` clamp is
  removed with its `simulation.test.ts` digest **unchanged**, which is the proof the clamp was dead;
- for **every** promotion: the demo's local module is deleted and **that demo's existing test file
  passes unchanged** apart from the import path. The one permitted exception is the seeded-RNG
  digest fixtures, whose churn is expected, mechanical and must land as one reviewable commit per
  demo; and
- `packages/framework/tests/import-boundary.test.mjs` and
  `packages/demos/tests/dev-host.test.mjs` both pass, the latter **unchanged**.

## Explicit non-goals

Each of the following was checked against real code and rejected. Do not build them here.

- **Camera rigs.** Five demos position cameras and they are structurally unrelated: one static
  (`point-light-expo/src/presentation.ts:33-40`), one stateless per-frame projector with six lead
  sources (`combat-arena/src/presentation.ts:25-78`), one stateful damped rig
  (`traversal-study/src/presentation.ts:63-85`), one with aspect-driven modes and a second ad-hoc
  accumulator (`town-study/src/town/index.ts:233-248,806-813`), and an undamped pointer-orbit idiom in
  both Three.js demos. They share two idioms, not a module. Revisit if the shake and interpolation
  work makes them converge; convergence is the signal and it has not happened.
- **Camera shake / trauma.** Two implementations and **both are wrong**
  (`combat-arena/src/presentation.ts:34-35`, `point-light-expo/src/renderer.ts:226-235`). Promoting a
  model that both demos got wrong would enshrine the bug. Fix combat-arena first.
- **Object pooling.** The ring cursor appears four times and *is* `cursor = (cursor + 1) % length`.
  A wrapper would hide nothing and the caller would still own the array, the reset semantics, and the
  cursor's exposure in the state digest (`combat-arena/src/combat-digest.ts:74-75`).
- **Phase / round state machines.** Effectively one implementation. One is a feature, not a pattern.
- **Attract mode.** `traversal-study/src/attract-controller.ts` is welded to its own level geometry
  from line 1. The promotable idea hiding inside it is a synthetic *input provider*, and that should
  be prototyped in one demo before the framework grows a seam for it.
- **Live-tunable constants.** Close to zero implementations; the one thoughtful mechanism is dead
  code where it lives. A new capability, not a promotion.
- **Easing / math helpers.** A handful of five-line pure functions is the shallow module the rubric
  warns about. They get pulled in as a by-product of other work, not shipped as a package.
- **Spatial broadphase, as a framework promotion.** Genuinely the best code in the repository, and
  still **one** implementation — the apparent second copy is byte-identical, which is a copy, not
  convergence. Nothing in the other eight demos does spatial queries at all: a grep for
  `grid|broadphase|bucket|overlap|spatial` across the three other Antiky `src/` trees returns zero
  hits, and `combat-arena` correctly does brute-force N² over ≤6 enemies and ≤36 projectiles. De-
  duplicating the two copies **is** in scope (outcome 1); promoting the interface into the framework
  on this evidence is not.
- Do not relax `packages/demos/tests/dev-host.test.mjs`'s fence. **Land the contract split and the
  guard test; do not land a types-only import for the framework-free demos in the same change.** The
  split is safe; opening the fence is a product decision that belongs to the owner.

## Engineering constraints

- `antiky-town` is in scope for modification, which is what makes outcome 1's real fix possible at
  all. It is also a fourth Antiky demo that the promotions must reach: each of the six capabilities
  must be checked against it, and where it holds a seventh copy — its `character-motor.ts`, and the
  hash at `src/town/art/town.ts:2192` — that copy is deleted with the others rather than left behind.
  Budget for four demos, not three: the source audit behind this goal never read `antiky-town`, so
  its per-demo cost is an estimate, not a measurement.
- Tests are required for code changes. When fixing a reported bug — the held-button latch — write the
  regression test first, run it, watch it fail, then fix.
- Short one-line commit messages. No coauthor tags. `point-light-expo` receives an intentional
  behaviour change with the latch fix; say so in that commit.
- Capture PNGs are **not** committed; the committed artifact is a metrics sidecar.
- Preserve unrelated dirty worktree changes.
- The framework is renderer-agnostic and platform-agnostic.
  `packages/framework/tests/import-boundary.test.mjs:6-13` forbids `brometal`, `node:`, `react` and
  `next` imports in framework source. Every item above satisfies this by construction — none touches
  a GPU, a canvas, a vector type or a matrix convention — and any proposal that cannot must say where
  else it belongs instead.

## Completion definition

The goal is complete when the duplicate-file guard is committed, each of the six capabilities is
exported from the framework with the tests above passing, every local copy is deleted, and each
affected demo's own test file passes unchanged apart from its import path.

If a promotion cannot be landed without editing a demo's test assertions — other than the seeded-RNG
digest fixtures — stop and report it. That is the signal that the promoted interface does not
actually cover the case the demo had, and the right response is to change the interface, not the
demo's expectations.
