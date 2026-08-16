# Summary — goal 11: promote what has earned it into the framework

**Completed:** 2026-08-14
**Commits:** `8572e99`, `8e1fe3e`, `5e6f997`, `0d6f692`, `b43c849`, `3d06365`, `7ebb474`, `6b8462b`,
`59d6664`
**Goal file:** [`execute-goal-11.md`](execute-goal-11.md)

## Action needed from the owner

Four items, **one now closed**. Two are decisions the goal reserved by design; two are conflicts this
work found between the goal's requirements and a demo's existing tests, where the goal says to stop
rather than edit the test.

> **Item 1 is closed.** The owner retired `town-study` on 2026-08-14 rather than find a shared home
> for the duplicated code. `antiky-town` is the surviving town and will absorb game-framework
> responsibilities over time. Items 2, 3 and 4 remain open.

| # | What | Why it needs you | Blocks |
|---|---|---|---|
| ~~1~~ | **RESOLVED 2026-08-14 — the owner retired `town-study`.** `antiky-town` is the town that ships and will grow into the game framework; the duplicate is deleted rather than shared, so there is nothing left to place. 12,931 lines removed in `67d6b37`, the drift guard included. Original question below. **Where the shared town code should live.** `character-motor.ts` and fifteen other files are byte-identical across `antiky-town` and `town-study` — **4,889 lines**, not the 1,286 the goal names. A drift guard is landed and running. The real fix cannot be `@antiky/framework`: `town-study` is framework-free by the fence at `dev-host.test.mjs:72,95`. | Moving that fence is a product decision about whether BroMetal demos must stay standalone. The goal explicitly reserves it. | the real de-duplication; nothing else |
| 2 | **`antiky-town`'s RNG swap redistributes its grass.** Swapping its `fract(sin(...))` hash for the framework's integer one moves the 74 meadow patch centres, and its own distribution test then reports the feather rings running 0.060 → 0.151 → 0.107 — the open field thinner than the ring beside the pavement. **Reverted**; the other four copies are promoted. | The gate itself got *better* (0.2038 against an authored 0.2, where the sin hash gave 0.1907), so this is not a regression in the rule — it is the ring statistic being confounded by plaza-distance falloff. Deciding whether to re-derive the test or accept a different meadow is art direction. | the fifth and last RNG copy |
| 3 | **Should a paused or faulted session keep painting?** Item 7 requires a non-`ADVANCED` frame to "still present". Three demos now do. `antiky-town` renders only on `ADVANCED`, and `composition.test.ts:19` asserts exactly that — "renders once per presentation". **Reverted** rather than rewrite the assertion. | The goal wants the new behaviour; the demo's test asserts the old one. Only you can say which is right for a 2.3D demo with a real post pass. | wiring `antiky-town` to the frame driver |
| 4 | **A shared-test scope defect, still open from goal 09.** `pipeline-invariants.test.mjs:425` calls `demoSources(slug)` where `demoSources()` takes no parameter, so it scans all ten demos twice instead of the two it names. | One line, in a file neither goal owns. | nothing |

## What was delivered

1. **The `character-motor.ts` guard, shipped first.** `packages/demos/tests/town-twin-parity.test.mjs`,
   wired into the root `npm test`. It fails when **either** copy is edited — verified in both
   directions — and covers all sixteen byte-identical files rather than only the one, as a set
   equality so a new copy also has to be acknowledged deliberately.
2. **One disposal scope.** `framework/src/resources/disposal-scope.ts`. Three Antiky copies (200
   lines) deleted. Reverse order, every resource released even when three of five throw, an
   `AggregateError` carrying all three causes, `rollback(cause)` rethrowing `cause` by identity, and
   both preserved when rollback also fails. `EngineSessionDisposalError` now carries its causes
   instead of a bare `failureCount` — the framework was the worst of the seven and is fixed.
3. **One seeded RNG.** `framework/src/random/seeded-random.ts`, integer-only. **Four of five copies**
   promoted; `antiky-town`'s is item 2 above. Verified: no `Math.sin`, a committed 1,000-draw golden
   array, forks that depend on their label alone and not on creation or draw order, and 100,000
   `unit()` draws within **0.92%** of uniform across ten buckets.
4. **One latched action, and the bug fixed.** All three copies deleted. The regression test was
   written first against `point-light-expo` and failed exactly as the goal predicted — a held pointer
   produced **10** triggers where it should produce 1. Edge detection now lives inside the primitive,
   so the level-triggered version cannot be expressed through the interface.
5. **One bounded event recorder.** Three rings and the character-for-character `count()` helper
   collapsed. The timestamp is an argument, so the inspection payload no longer depends on wall time.
6. **A zero-import contract module.** `framework/src/game/contract.ts`, exported as
   `@antiky/framework/contract`, asserted to have zero imports inside `import-boundary.test.mjs`.
   The `dev-host.test.mjs` fence is **untouched** and passing.
7. **One session frame driver.** Three demos wired; the fourth is item 3. `traversal-study`'s dead
   `Math.min(0.1, …)` clamp is gone with its digest unchanged, and every non-`ADVANCED` code — all
   eight, `SESSION_FAULTED` included — now reaches a fault channel that reports through
   `context.report`, instead of being dropped in every demo.

**Net:** the framework grew 1,385 lines (roughly half of it tests); the Antiky demos shrank by 265
lines net while gaining behaviour they did not have.

## What I got wrong

**The goal's central guard test asserts an impossible direction, and I wrote it before checking.**
Item 6 requires a guard that "`GameModuleEntry` stays structurally assignable to each of the six
`StudioGameEntry` declarations". It cannot be, and not because of anything this goal changed: a real
`GameHostContext` **requires** `runtimeInstanceId`, `movement` and `mode`, and the five narrow copies
supply none of them. A function demanding more than its call site provides is unusable there. I wrote
the assertion as specified, watched TypeScript reject it, and only then worked out that the useful
direction is the reverse — a module written against a copied contract still satisfies the real host,
because the host supplies everything the copy asks for and more. That is what the landed guard
asserts, with the reasoning written into it.

**And the same item's premise about which copy differs is backwards.** The goal says five copies are
byte-identical and "only `town-study`'s differs, because it also needs `mode`". `town-study`'s copy
is in fact the *complete* contract — seven-field pointer, `movement`, `runtimeInstanceId` and `mode`.
So the drift is not one demo ahead by a field; it is **five demos stuck on a two-field pointer while
the sixth kept pace**. The five are the ones that cannot see `clicked`, `down`, `active`, `dragX`,
`dragY`, `movement` or `mode`. The guard now models both shapes and counts them, so a seventh shape
appearing fails the test.

**I over-matched a regex and briefly deleted a working call.** Converting `combat-arena` to the
disposal scope, `disposeResources(batches)` became `batches.dispose()` — but `batches` was a plain
array of hulls, not a scope. Fixing it surfaced a **real pre-existing leak**: that call disposed the
five hulls and walked straight past the shared detail normal the scope also owned, which was
therefore never released. It now disposes the scope, and the comment says why.

**I claimed a verification I had not performed.** Checking that the twin guard fails when either copy
is edited, my first run used a relative path from the wrong directory, so `node --test` found no file
and printed nothing — which I read as "no failures". Re-run properly, it fails in both directions.
A test command that produces no output is not a passing test.

## Traps worth knowing

- **`demoSources(slug)` still ignores its argument** (owner item 4).
- **The framework's API reference is generated and checked.** Any new export needs a description and
  a module-to-area assignment in `scripts/api-reference-content.mjs`, or `npm test` fails at
  `docs:api:check` before a single test runs. A module reachable through two package entries must be
  listed under both areas.
- **`src/town/index.ts` cannot be imported by the Node test runner.** It uses extensionless relative
  imports, which Vite resolves and Node does not — which is why every antiky-town test reaches for
  `town-runtime.ts` or `dist/` instead. Discovered the same way twice now.
- **`antiky-town` has a fourth elapsed-time derivation** the goal did not count, in
  `src/gameplay/game-host.ts:57-74`, with two deliberate differences: it forwards a non-finite
  platform time so the session can reject it, and it renders only on `ADVANCED`.
- **`antiky-town/src/town/index.ts` holds another `Math.sin`-shaped hash** beyond the one at
  `town.ts:2322`. Not counted in the goal's six and not touched.

## Evidence

| Check | Result |
|---|---|
| Guard fails when either `character-motor.ts` copy is edited | verified both directions; passes when restored |
| Disposal: 3 of 5 throw | all 5 released, `AggregateError` with exactly 3 causes |
| `rollback(cause)` rethrows `cause` itself | asserted by identity, not message |
| `hashUnit` uses no `Math.sin`, no float hashing | asserted against the source text; `Math.imul` required |
| 1,000 draws match a committed golden array | `seeded-random.golden.json`, exact |
| Fork independence | identical sequence whether or not a sibling was created and drawn from first |
| 100,000 `unit()` draws across 10 buckets | max deviation **0.92%**, inside ±1% |
| Held-press regression, written first | **RED at 10 triggers** → GREEN at 1 |
| Capacity 3, 10 events | retains last 3, `available` 10, `droppedCount` 7, `incomplete` true, sequences 8/9/10 |
| Contract module import count | **0**, asserted in `import-boundary.test.mjs` |
| `dev-host.test.mjs` | **unchanged**, 7 passing |
| Non-`ADVANCED` frame | fault channel invoked once, frame still presented; all 8 codes covered |
| `stepSimulation` | presents with alpha 0 |
| `traversal-study`'s dead clamp removed | 73 tests pass unchanged, digest included |
| `tsc --noEmit` all workspaces | clean |
| Full `npm test` | **0 failures** |
| `npm run demos:verify` | 55/60 — the same 5 pre-existing failures as before this goal, none new |

**One deviation from "unchanged apart from the import path".** Collapsing two differently-named APIs
means at least one demo's test must rename a method — there is no name satisfying both
`createDisposalStack().adopt` and `createResourceScope().register`. `point-light-expo`'s
`renderer-resources.test.ts` and `traversal-study`'s `resource-scope.test.ts` each had mechanical
renames. **No assertion changed in either.** Flagging it because the goal's bar is literal and this
does not meet it literally.

## What this unblocks

- Goal 12's `BroMetalRenderDriver` extraction: the disposal scope, the frame driver and the
  import-free contract are three of the seams it would otherwise have to invent.
- ADR 0013's compliance gap is closed in the framework — a seeded stream now exists and is explicit.
  Threading a seed through each demo's simulation options is the follow-on.

## What remains blocked

- The four owner items above. Items 2 and 3 are each one demo's worth of work behind a decision.
- The **real** de-duplication of 4,889 lines between the two town packages, behind item 1.
