# Framework Easy Wins — What Has Earned Promotion

**Date:** 2026-08-10
**Question:** what are the easy wins we could add to the Antiky framework to make game creation
easier in future?
**Method:** a capability qualifies when it has been *independently re-implemented in three or more
demos with the same shape*. Every claim below cites `file:line` and was verified directly. Counts
are empirical, not suspected.
**Scope:** `antiky-town/src` was not inspected when this was written. **Superseded 2026-08-10:** it
is now in scope, which strengthens several findings here — most of all the duplicated broadphase,
where the real fix is now available and not just a guard test. It appears below only as a
checksum comparison. Documentation only; no source was modified.

---

## Read this first — a correction to the framing

The brief assumed the Three.js demos "use the framework with a non-BroMetal renderer." **They do
not. Six of the ten demos do not depend on `@antiky/framework` at all, and that is enforced by
test.**

`packages/demos/tests/dev-host.test.mjs:6-17` declares the showcase matrix. Four demos are
`framework: true` (all under `antiky/`); six are `framework: false` (all four `brometal/` demos and
both `threejs/` demos). Two assertions enforce it:

```js
// dev-host.test.mjs:72
assert.equal('@antiky/framework' in dependencies, demo.framework, `${demo.slug} Framework boundary`);
// dev-host.test.mjs:95
if (!demo.framework) assert.doesNotMatch(source, /@antiky\/framework/);
```

The string may not even *appear* in their source. This is deliberate — the matrix exists to prove
BroMetal and Three.js work standalone — and it is a fence I am not proposing to knock down.

But it has a cost that is now measurable, and it changes the shape of this report:

**All six framework-free demos hand-copied the framework's host contract into a local
`src/studio-game.ts`. Five of the six are byte-identical** (verified by `md5`: `luminous-reef`,
`shader-study`, `solar-forge`, `glass-garden`, `orbital-atlas` all hash to `af245243…`; only
`town-study`'s differs, because it also needs `mode`).

So the honest picture is not "three demos duplicating things." It is **ten demos, of which six
cannot reach the framework at all and reimplement its contract, and four reach it and reimplement
everything the contract stopped short of.** Nearly every item below is duplicated across *both*
groups, which is the strongest possible argument that the missing pieces are genuinely general and
not BroMetal-shaped.

---

## Evidence summary

| Capability | Independent implementations | Agree? | Verdict |
|---|---|---|---|
| Disposal scope | **7** (3 antiky, 2 threejs, 1 brometal manual, 1 in-framework) | No — framework's is weakest | **Promote** |
| Render interpolation | **1 of 10** — correct, in `town-study` | n/a | **Promote** |
| Host contract types | **6 hand-copies**, 5 byte-identical | Drifting | **Promote (as types-only split + guard)** |
| Seeded RNG | **6** | No — 6 different constant sets | **Promote** |
| Latched input buffer | **3** | Same shape; one has a fix the others lack | **Promote** |
| Bounded event recorder | **3** | Byte-identical | **Promote** |
| Frame-loop driver | **4** | Near-identical; 3 accidental divergences | **Promote (last)** |
| Spatial broadphase | 1 (copied verbatim into a 2nd package) | n/a | Not yet — but it is the best code in the repo |
| Camera rig | 5, structurally unrelated | No | Not yet |
| Trauma / shake | 2, both wrong | No | Not yet |
| Ring-buffer pool | 4 sites, 2 lines each | Yes | Not yet |
| Phase state machine | 1 | n/a | Not yet |
| Attract mode | 0 (the real idea is "synthetic input provider") | n/a | Not yet |
| Live-tunable constants | ~1, already framework-adjacent | n/a | Not yet |
| Easing / math helpers | thin, scattered | n/a | Not yet (fold into other items) |

Two of the top items — render interpolation and seeded random streams — are already written down as
**accepted decisions that were never implemented**, in
`docs/adr/framework/0013-explicit-simulation-inputs_H.md`:

> The authoritative simulation will use a fixed time step. It will receive these inputs explicitly:
> the simulation clock, **random seeds or random streams**, external inputs, and the system order.
> […] **The renderer can estimate positions between two simulation states.**

The framework shipped the clock, the inputs and the system order. It shipped neither of the other
two, so the demos built them six and one times respectively.

---

# Ranked proposals

## 1. Render interpolation alpha

**Rank rationale:** smallest diff in the list, largest visible payoff, and exactly one demo already
proved the formula — which means this is transcription, not design.

### The recurring job

Present a 60 Hz simulation on a 120/144 Hz display without judder.

**Implementations: 1 of 10, and it is correct.**
`packages/demos/brometal/town-study/src/town/physics/character-motor.ts:836-848`:

```ts
const interpolationAlpha = clamp(this.accumulator / fixedDelta, 0, 1);
const previous = this.state.previousPosition;
const current = this.state.position;
const result: CharacterAdvanceResult = {
  fixedSteps, interpolationAlpha, droppedSeconds: this.droppedSeconds,
  renderPosition: {
    x: previous.x + (current.x - previous.x) * interpolationAlpha,
    /* y, z … */
  },
};
```

`previousPosition` is snapshotted at the top of every fixed step (`character-motor.ts:856`) and is
part of `CharacterMotorState`.

Everywhere else it is absent:

- `point-light-expo/src/game.ts:146-148`, `combat-arena/src/game.ts:136-138`,
  `traversal-study/src/game.ts:103-105` — `session.advance(...)` then render raw current state. A
  grep for `accumulator|interpolat|renderAlpha|lerp` across all three `src/` trees (excluding
  shaders) returns **zero hits**.
- `traversal-study/src/game.ts:105` does pass wall-clock `elapsed` into `render()`, but that is not
  an alpha — it is consumed at `traversal-study/src/presentation.ts:73` as a camera-damping delta
  (`1 - Math.exp(-dt * 8.4)`). The world still renders at the raw fixed-step position.
- The Three.js demos have **no simulation state to interpolate at all** — every animated quantity is
  a closed-form `f(time)` (`orbital-atlas/src/game.ts:220-239`,
  `glass-garden/src/game.ts:259-281`). This is an important constraint, handled in the design below.

Two bugs in the one demo that *does* have it, both caused by it being per-entity rather than
per-session:

1. **Nine independent accumulators.** `town-study` instantiates one motor per actor (1 hero + 8
   NPCs), so nine accumulators run in lockstep only by coincidence. Only the hero's
   `renderPosition` is consumed (`town/index.ts:777, 834-836`); the eight NPCs render from raw
   `motor.state.position` and visibly stutter.
2. **A camera/sprite shear.** The camera reads raw `hero.motor.state.position`
   (`town/index.ts:803-805, 816-818, 1009-1011`) while the sprite draws at the interpolated
   position — up to one tick of disagreement between what the camera tracks and what is drawn.

Both disappear if the alpha comes from the session clock instead of from an entity.

### Why it belongs in the framework

Because the framework **already computes the numerator and discards the meaning**.
`EngineSession.advance()` returns `accumulatorSeconds` on `EngineFrameResult`
(`packages/framework/src/sessions/engine-session/contract.ts`), and `FIXED_STEP_SECONDS` is a
framework constant. The alpha is `accumulatorSeconds / FIXED_STEP_SECONDS` — but the caller must
know that relationship, know to clamp it, and know it is invalid while paused. Three demos with
direct access to both values independently failed to derive it. That is the definition of
information that should have been hidden.

Renderer-agnostic: yes, trivially — it returns a `number`. Nothing touches a GPU, canvas, vector
type, matrix convention or handedness, which is precisely why it also serves a Three.js game whose
camera is `camera.position.y` and whose rotations are Euler angles.

### Proposed interface

```ts
// @antiky/framework
export function frameRenderAlpha(result: EngineFrameResult): number;
```

Call site:

```ts
const result = session.advance(elapsed, semanticInput());
renderer.render(simulation.view(), frameRenderAlpha(result));
```

That is the entire framework surface: one pure function over a value the caller already holds.

Deliberately **not** included: a generic `interpolate(previous, current, alpha)` over game state.
The snapshot shapes share nothing (`RelaySnapshot`, `CombatSnapshot`, `TraversalSnapshot`,
`CharacterMotorState`), a generic deep-interpolator would be a shallow module wrapping
`a + (b - a) * t`, and the Three.js demos have no snapshots at all. Demos keep their own
previous-state buffer and their own blend; the framework supplies only the number none of them could
derive. This also keeps the feature **opt-in** — an `f(t)` game ignores it and loses nothing.

Guarantees pulled downward so the caller cannot get them wrong:

- Clamped to `[0, 1)` regardless of `accumulatorSeconds`.
- Returns `0` for every non-`ADVANCED` code — paused, faulted, stepped, disposed. A paused session
  must not smear, and today the caller would have to know that.

### Acceptance criteria

- [ ] `frameRenderAlpha` exported from `@antiky/framework`; returns a value in `[0, 1)` for every
      `EngineFrameResult` reachable from `advance()`, across all eight result codes.
- [ ] Property test: for 1,000 random `elapsedSeconds` in `[0, 0.5]`, alpha is finite, in `[0, 1)`,
      and exactly `0` whenever `code !== 'ADVANCED'`.
- [ ] After `session.pause('tool')`, the next `advance()` yields alpha `0`.
- [ ] `packages/framework/tests/import-boundary.test.mjs` still passes.
- [ ] At least one demo consumes it and its existing `presentation.test.ts` passes unchanged.
- [ ] *(separate, optional)* `town-study`'s camera reads the same interpolated position its sprite
      does — verifiable by asserting both derive from one `renderPosition`.

**Effort:** ~2 hrs framework; ~2 hrs per demo to add a previous-state buffer.
**Risk:** very low. Purely additive; no existing signature changes.

---

## 2. Disposal scope

**Rank rationale:** the most-duplicated concept in the entire repository — seven implementations
across three renderers — and the framework's own is the worst of them.

### The recurring job

Acquire N resources; if construction fails partway, unwind what was acquired without losing the
original error; on teardown, dispose in reverse order and never let one failure skip the rest.

**Implementations: 7.**

| Site | Shape | On multiple failures |
|---|---|---|
| `antiky/point-light-expo/src/resource-lifetime.ts` (56 lines) | array + `registerResource`/`disposeResources`/`ResourceScope` | rethrows the **first**, silently drops the rest |
| `antiky/combat-arena/src/resource-lifetime.ts` (26 lines) | identical — `diff` shows only line-wrapping and one reworded comment | same |
| `antiky/traversal-study/src/resource-scope.ts` (118 lines) | `DisposalStack` + `acquireTransactional` + `createRendererResourceLifetime` | `AggregateError` with every cause — **correct** |
| `threejs/glass-garden/src/game.ts:75-76, 284-290` | two parallel arrays (`geometries[]`, `materials[]`) drained in `dispose` | no handling at all |
| `threejs/orbital-atlas/src/game.ts:68-69, 242-246` | identical two-array pattern | no handling at all |
| `brometal/town-study/src/town/index.ts:1031-1054` | a hand-ordered flat list of **22** `.dispose()` calls | none — if `sceneTarget?.dispose()` throws, the other 21 leak |
| `packages/framework/.../engine-session/runtime.ts` (`dispose`) | `services` array | `EngineSessionDisposalError(failureCount)` — **discards every cause, keeps only a count** |

`diff point-light-expo/src/resource-lifetime.ts combat-arena/src/resource-lifetime.ts` returns
formatting plus point-light-expo's extra `createResourceScope`. They are the same file.
`traversal-study` independently built the better version. `town-study`'s 22-line manual list is the
counterexample that proves the need. And the framework's own version does the worst job of all.

Four demos also carry dedicated tests: `combat-arena/tests/resources.test.ts`,
`point-light-expo/tests/renderer-resources.test.ts` and `onboarding-resources.test.ts`,
`traversal-study/tests/resource-scope.test.ts`.

### Why it belongs in the framework

`EngineSessionOptions.services` already puts the framework in the disposal business — this finishes
a slice that was started, it does not open a new one. The framework's version being the weakest of
seven is the clearest possible signal: the demos have already found and fixed a bug the framework
still has.

Renderer- and platform-agnostic by construction, and the Three.js evidence pins the requirement
precisely: **it must type on `{ dispose(): void }` and nothing else**, because glass-garden's stack
holds `BufferGeometry`, `Material`, `EffectComposer`, `Texture` and `PMREMGenerator` — five
unrelated Three types. The existing demo implementations already satisfy this.

The `try { … } catch (cause) { disposeEverything(); throw cause; }` skeleton in every antiky
`game.ts` (`point-light-expo:162-167`, `combat-arena:150-153`, `traversal-study:117-120`) is an
eighth expression of the same idea. `point-light-expo`'s is the only one unwinding three separate
resources — the place where getting it wrong is easiest.

### Proposed interface

Adopt `traversal-study`'s design largely as-is; it is the one that already got it right.

```ts
// @antiky/framework
export type DisposableResource = Readonly<{ dispose(): void }>;

export type DisposalScope = Readonly<{
  /** Take ownership. Disposes immediately if the scope has already closed. */
  adopt<T extends DisposableResource>(resource: T): T;
  /** Reverse order. Collects every failure into an AggregateError. */
  dispose(): void;
  /** Unwind after a construction failure, then rethrow `cause`. Never swallows either. */
  rollback(cause: unknown): never;
}>;

export function createDisposalScope(): DisposalScope;
```

Call site — the whole `try`/`catch` skeleton in `game.ts`:

```ts
const scope = createDisposalScope();
try {
  const renderer = scope.adopt(await createRenderer(context.canvas, options));
  const lights   = scope.adopt(createExpoLightService(context.runtimeInstanceId));
  const session  = scope.adopt(createEngineSession({ /* … */ }));
  return Object.freeze({ frame, inspection, dispose: () => scope.dispose() });
} catch (cause) {
  scope.rollback(cause);   // unwinds everything, rethrows `cause`, never loses it
}
```

`rollback` returning `never` is the ergonomic detail worth keeping: it makes the catch block one
line and makes "forgot to rethrow" unrepresentable.

Independently shippable sub-item: make `EngineSessionDisposalError` carry the causes, by extending
`AggregateError` or adding `causes: readonly unknown[]`. That is a one-hour fix to an existing
framework bug and does not depend on the rest.

**Note on the six framework-free demos.** They cannot import this while
`dev-host.test.mjs:72,95` stands, and I am not proposing to change that. They benefit indirectly:
proposal 3 makes a zero-dependency contract module possible, and this scope is small enough to live
there if the owner later decides it should.

### Acceptance criteria

- [ ] `createDisposalScope` exported from `@antiky/framework`.
- [ ] Framework test: resources dispose in reverse adoption order.
- [ ] Framework test: when 3 of 5 resources throw on dispose, all 5 `dispose()` methods are called
      and an `AggregateError` carrying all 3 causes is thrown.
- [ ] Framework test: `rollback(cause)` disposes everything and rethrows `cause` itself; when
      rollback *also* fails, both are preserved.
- [ ] `EngineSessionDisposalError` exposes the underlying causes; existing engine-session tests pass
      with at most an additive assertion.
- [ ] Each of the three antiky demos deletes its local module; each demo's existing resource test
      file passes unchanged after re-pointing its import.
- [ ] Import-boundary test still passes.

**Effort:** ~4 hrs framework; ~1 hr per demo.
**Risk:** low. `traversal-study`'s implementation and tests move almost verbatim, making this the
most mechanical item in the list. Fully parallelizable per demo.

---

## 3. A zero-dependency host-contract module

**Rank rationale:** six hand-copies with observable drift, and the fix is a file move plus a guard
test. This one is about the *fence*, so read the boundary discussion carefully.

### The recurring job

Type a game module's entry point, frame callback, dispose, pointer input and measurements — without
taking on the framework's simulation and inspection surface.

**Implementations: 6 hand-copies, 5 byte-identical.**
`brometal/{luminous-reef,shader-study,solar-forge}/src/studio-game.ts`,
`threejs/{glass-garden,orbital-atlas}/src/studio-game.ts` all hash to `af245243d07bb1810e1dcce4dda36dc0`.
`brometal/town-study/src/studio-game.ts` is the sixth, differing only because it also declares
`mode`.

Each is a structural re-statement of `packages/framework/src/game/host.ts`:

```ts
// threejs/glass-garden/src/studio-game.ts — the whole file
export type StudioGameEntry = (context: Readonly<{
  canvas: HTMLCanvasElement;
  pointer: Readonly<{ x: number; y: number }>;
  report(measurements: Readonly<{
    instances?: number; drawCalls?: number; uploadBytesPerFrame?: number; note?: string;
  }>): void;
}>) => Readonly<{ frame(platformTimeSeconds: number): void; dispose(): void }>
   | Promise<Readonly<{ frame(platformTimeSeconds: number): void; dispose(): void }>>;
```

The `report(...)` argument is a character-for-character duplicate of `GameMeasurements`
(`host.ts:41-46`); the return is `GameInstance` (`host.ts:168-172`) minus `inspection?`; the whole
thing is `GameModuleEntry` (`host.ts:175-177`). It type-checks only because
`packages/website/src/components/DemoStage.tsx:210-221` passes a structural superset.

**The drift is already real and already costly.** The copies declare `pointer: { x, y }`. The actual
`GamePointerInput` (`host.ts:22-30`) has seven fields — `down`, `active`, `dragX`, `dragY`,
`clicked`. Those five are invisible to six demos, as are `movement` (`host.ts:33-37`) and
`mode: 'ambient' | 'interactive' | 'thumbnail'` (`host.ts:39`). Neither Three.js demo can degrade
for thumbnail mode even though the host sets it. Note that the return type has to be written **twice
in each copy** (lines 10-12 and 13-16) because `GameInstance` has no separately copyable name.

### Why it belongs in the framework — and how to respect the fence

**Chesterton's Fence first.** `dev-host.test.mjs:6-17` deliberately makes six demos framework-free
so the showcase proves BroMetal and Three.js work standalone. That is a real product purpose
(`PRODUCT.md`), and this proposal does **not** ask to relax it.

What it asks is narrower, and it is a problem for framework users too:
`packages/framework/src/game/host.ts:1-19` imports from `inspection/snapshot`,
`point-light/commands`, `point-light/world-inspection`, `point-light/inspection` and
`sessions/engine-session/contract`. **You cannot obtain `GameModuleEntry` without pulling in the
entire point-light service type graph.** That is a coupling defect independent of the fence, and it
is why hand-copying looked cheaper than importing even to demos that *could* import.

Two changes, both small:

1. **Split the pure contract into its own import-free module** — `GameModuleEntry`,
   `GameHostContext`, `GamePointerInput`, `GameMovementInput`, `GameInstance`, `GameMeasurements`,
   `GameHostMode`. Nothing in that set needs anything from the rest of the framework. `host.ts`
   keeps the inspection-coupled pieces (`GameInspectionPort`, `createGameInspectionSnapshot`) and
   re-exports the contract, so no existing import breaks.
2. **Add a guard test that the six copies stay structurally compatible.** A type-level assertion
   that `GameModuleEntry` is assignable to each `StudioGameEntry` catches drift without adding a
   dependency and without touching the fence. This is the same tactic
   `02-REMEDIATION-PLAN.md` recommends for shaders: *"pipeline-invariant tests… enforce correctness
   across demos without forcing shared code."*

Whether the framework-free demos should later be allowed a types-only import is a **product
decision, not an engineering one**, and it belongs to the owner. Step 1 makes it possible; it does
not take it.

### Proposed interface

No new API — a file move plus re-exports:

```ts
// @antiky/framework/contract  — zero imports, types only
export type GameMeasurements = /* … */;
export type GamePointerInput = /* … */;
export type GameMovementInput = /* … */;
export type GameHostMode = 'ambient' | 'interactive' | 'thumbnail';
export type GameHostContext = /* … */;
export type GameInstance = /* … */;
export type GameModuleEntry = (context: GameHostContext) => GameInstance | Promise<GameInstance>;

// @antiky/framework/game  — unchanged for every existing caller
export * from '../contract.ts';
export type GameInspectionPort = /* … */;   // still inspection-coupled
export function createGameInspectionSnapshot(/* … */) { /* … */ }
```

### Acceptance criteria

- [ ] `@antiky/framework/contract` exists, exports the seven contract types, and imports **nothing**.
- [ ] `packages/framework/tests/import-boundary.test.mjs` gains an assertion that the contract module
      has zero import statements, and still passes.
- [ ] Every existing import of `@antiky/framework/game` compiles unchanged — verified by all four
      antiky demos typechecking with no source edits.
- [ ] A new test asserts `GameModuleEntry` is structurally assignable to each of the six
      `StudioGameEntry` declarations, and **fails** if `GamePointerInput` gains a required field.
- [ ] `packages/demos/tests/dev-host.test.mjs` passes **unchanged** — the fence is untouched.

**Effort:** ~3 hrs.
**Risk:** low, but this is the one item with a product dimension. Land the split and the guard;
leave the fence decision with the owner.

---

## 4. Deterministic seeded RNG streams

**Rank rationale:** six copies with six different constant sets, and a latent correctness bug
against the framework's own reproducibility contract.

### The recurring job

Produce reproducible pseudo-random values inside a fixed-step simulation without reading a hidden
clock or `Math.random()`.

**Implementations: 6.** Five are the same GLSL-folklore `fract(sin(a·k₁ + b·k₂) · k₃)` hash, and
**no two use the same constants**:

| Site | Constants |
|---|---|
| `antiky/point-light-expo/src/simulation.ts:131-134` | `73.17, 41.73, 43_758.5453` |
| `antiky/combat-arena/src/combat-state.ts:176-179` | `91.71, 37.13, 43758.5453` |
| `antiky/traversal-study/src/simulation.ts:173-176` | `73.91, 19.37, 41758.31` |
| `antiky/traversal-study/src/renderer.ts:277-280` (`stableNoise`) | `63.17, 17.53, 43147.19` |
| `brometal/town-study/src/town/art/town.ts:2191` (`hash`) | positional variant, hand-mixed seeds |

Two of those are in the **same package** under two names doing the same job
(`traversal-study/src/simulation.ts` and `src/renderer.ts`) — as clear a signal as this evidence
gets that nobody knew a shared one existed. `town-study` mixes its seeds by hand at call sites:
`gx * 101 + gz * 211` (`town.ts:1486`), `x * 37 + z * 71 + width * 11` (`:759`),
`gx * 79 + gz * 137` (`:1806`).

The sixth is the interesting counter-example. Both Three.js demos **deliberately avoid RNG** and use
golden-angle index hashing instead — `orbital-atlas/src/scene-layout.ts:10-24`
(`index * 2.399963229728653`, `(index * 31) % 100`), `glass-garden/src/scene-layout.ts:8-31` — and
each has a determinism test asserting two calls produce identical output
(`orbital-atlas/tests/scene-layout.test.ts:6-15`, `glass-garden/tests/scene-layout.test.ts:6-17`).
They wanted reproducibility badly enough to give up randomness for it. That is demand, expressed by
avoidance.

To confirm nobody found the right answer: `Math.random()` appears **nowhere** in any demo.

### Why it belongs in the framework

Two arguments; the second is the serious one.

**It is already an accepted decision.** ADR 0013 lists random seeds/streams as one of the four
explicit inputs an authoritative simulation must receive. The framework ships the other three. This
is the one item on that list nobody built, so six demos built it six ways.

**`Math.sin` is a determinism hazard.** ECMA-262 does not require `Math.sin` to be correctly
rounded — implementations may differ in the final bits across engines and platforms. The entire
`EngineSession` contract rests on `getStateDigest()` reproducibility
(`EngineSessionOptions.getStateDigest`, `CompletedEngineStep.stateDigest`), and the CLI surfaces
that digest to agents as ground truth via `step_simulation`
(`packages/cli/src/mcp/tools.ts:400`). In `point-light-expo`, `seeded()` feeds shade `phase` at
`simulation.ts:160` — simulated state, not decoration. Today every demo runs in one Chromium so they
agree; the bug is latent, not absent, and it is exactly the class of bug a framework exists to
prevent. An integer hash is bit-exact on every engine, forever.

Renderer- and platform-agnostic: pure integer arithmetic, no imports.

### Proposed interface

```ts
// @antiky/framework
export type RandomStream = Readonly<{
  unit(): number;                                  // [0, 1)
  range(minimum: number, maximum: number): number;
  integer(boundExclusive: number): number;
  fork(label: string): RandomStream;               // independent, reproducible substream
  save(): number;
  restore(state: number): void;
}>;

export function createRandomStream(seed: number | string): RandomStream;

/** Stateless: same inputs always give the same value. Replaces every `seeded(i, salt)` site. */
export function hashUnit(...values: readonly number[]): number;
```

The stateless form is a drop-in for all five existing hash sites:

```ts
// was: seeded(revision + burstIndex, colour + 4)
const angle = hashUnit(revision + burstIndex, colour + 4) * Math.PI * 2;
```

and the stateful form for anything wanting a real stream:

```ts
const rng = createRandomStream(EXPO_WORLD_ID);
const spawn = rng.fork('shade-spawn');   // independent of particle bursts
```

`fork` is the piece worth having: adding a new random consumer cannot perturb an existing one's
sequence, which is what makes seeded determinism survive a code change. That is genuine complexity
pulled downward, not a wrapper.

**Design-it-twice note.** The alternative was `hashUnit` alone, no stream object — simpler, and it
covers every current call site. Rejected because `fork` is the property that keeps the digest
contract holding under change, and ADR 0013 says "seeds *or* streams." But if effort is tight,
shipping `hashUnit` first is a legitimate 80/20 that captures five of the six duplications
immediately.

### Acceptance criteria

- [ ] `hashUnit` returns `[0, 1)` using only integer ops (`Math.imul`, `^`, `>>>`) — no `Math.sin`,
      no floating-point hashing.
- [ ] Determinism test: 1,000 draws from `createRandomStream('fixed-seed')` match a committed golden
      array exactly.
- [ ] Fork independence: `rng.fork('a')` produces an identical sequence whether or not
      `rng.fork('b')` was created first or drawn from.
- [ ] Distribution smoke test: 100,000 `unit()` draws land within ±1% of uniform across 10 buckets —
      the test the `sin` hash would fail.
- [ ] Each antiky copy is deleted and replaced; each demo's existing `simulation.test.ts` passes with
      **updated golden digests only**, no logic edits. Digest churn is expected and must be one
      reviewable commit per demo.
- [ ] Import-boundary test still passes.

**Effort:** ~4 hrs framework; ~1 hr per antiky demo.
**Risk:** low-medium. The only real risk is churn in committed digest fixtures — visible and
mechanical. Parallelizes cleanly across three demo agents.

---

## 5. Latched semantic input buffer

### The recurring job

A one-frame action (a click, a jump) is captured on the presentation frame but must survive until a
*fixed step* consumes it — without being consumed twice or dropped when a frame produces zero steps.

**Implementations: 3, same shape, one carrying a fix the other two never got.**

| Demo | File | Lines |
|---|---|---|
| point-light-expo | `src/input-buffer.ts` | 20 |
| combat-arena | `src/input-buffer.ts` | 26 |
| traversal-study | `src/input-buffer.ts` | 59 |

All three expose `capture(x) / read() / consume(completedSteps)`, and all three are called in the
same order at `point-light-expo/src/game.ts:145-147`, `combat-arena/src/game.ts:135-137`,
`traversal-study/src/game.ts:103-104`. `traversal-study/src/input-buffer.ts:28` documents the
contract precisely: *"Retains one-frame actions until Framework reports that a fixed step consumed
them."*

**The divergence is the argument.** `diff point-light-expo/src/input-buffer.ts
combat-arena/src/input-buffer.ts` is a rename plus exactly one behavioural change — combat-arena
added rising-edge detection:

```ts
// point-light-expo/src/input-buffer.ts:11 — latches on a HELD button
pending ||= clicked;

// combat-arena/src/input-buffer.ts:12-17 — latches once per press
if (!clicked) { armed = true; }
else if (armed) { pending = true; armed = false; }
```

Someone found and fixed a real bug in one copy and it never propagated. `point-light-expo` still
re-triggers its relay interaction on a held pointer. That is exactly the failure mode
`02-REMEDIATION-PLAN.md` warns about: *"Duplication is cheap. Duplicated bugs silently diverging is
not."*

Each demo also carries a test file for its copy — 171, 189 and 112 lines. **472 lines of test
testing the same module three times.**

### Why it belongs in the framework

The lifetime being managed is `EngineFrameResult.completedSteps` — a framework concept. The buffer
exists only because `advance()` may run 0–3 steps (`MAX_STEPS_PER_FRAME = 3`) and the caller must
reconcile presentation-rate capture against step-rate consumption. Nothing else in the system knows
that rule. Renderer-agnostic (no geometry, no draw calls) and platform-agnostic (it never touches an
event object — it receives already-semantic booleans, per ADR 0016's raw-event/semantic-input split).

### Proposed interface

Generic over the action set, covering all three payloads with one type:

```ts
// @antiky/framework
export type LatchedActions<Action extends string> = Readonly<{
  /** Presentation-rate. Edge-triggered, so holding latches exactly once. */
  press(action: Action): void;
  /** Step-rate. True if this action is pending. */
  isPending(action: Action): boolean;
  /** Clears pending actions, but only if the frame actually ran a step. */
  consume(result: Pick<EngineFrameResult, 'completedSteps'>): void;
}>;

export function createLatchedActions<Action extends string>(
  actions: readonly Action[],
): LatchedActions<Action>;
```

Call site:

```ts
const actions = createLatchedActions(['jump', 'retry'] as const);

if (context.pointer.clicked) actions.press('jump');
const result = session.advance(elapsed, {
  horizontal,
  jump: actions.isPending('jump'),
  retry: actions.isPending('retry'),
});
actions.consume(result);
```

Two choices, both pulling complexity downward:

- `press()` is **edge-triggered by construction** — the caller passes raw held state and gets press
  semantics. `point-light-expo`'s bug becomes unrepresentable rather than merely fixed.
- `consume()` takes the result object, not a number, so the wrong count cannot be passed. It also
  makes the `result.code === 'STEPPED' ? 1 : 0` incantation repeated at
  `point-light-expo/src/game.ts:130`, `combat-arena/src/game.ts:121` and
  `traversal-study/src/game.ts:89` unnecessary — the same overload accepts `EngineControlResult`.

Continuous axes (`horizontal`, `movement`) stay in the demos. They need no latching, and folding
them in would make this a general input system, which it should not be yet.

### Acceptance criteria

- [ ] All three demo `input-buffer.ts` files are **deleted**.
- [ ] Behaviours currently asserted across the three `input-buffer.test.ts` files are covered by one
      framework test file; each demo's remaining tests pass unchanged.
- [ ] Regression test for the divergence: `press()` held across 10 frames yields exactly **one**
      pending action.
- [ ] A frame with `completedSteps === 0` does **not** clear a pending action.
- [ ] `point-light-expo`'s relay interaction no longer re-triggers on hold — assert via its
      `simulation.test.ts`.
- [ ] Import-boundary test still passes.

**Effort:** ~3 hrs framework; ~1 hr per demo. Net deletion of ~105 source and ~472 test lines.
**Risk:** low. `point-light-expo` gets an intentional behaviour change (the bug fix) — call it out in
that commit.

---

## 6. Bounded event recorder

### The recurring job

Retain the last N simulation events in memory, count what was dropped, and project them into the
framework's `EventHistory` inspection shape.

**Implementations: 3, byte-identical.**
`point-light-expo/src/inspection.ts:33, 72-74, 279-293` (`EVENT_CAPACITY = 40`);
`combat-arena/src/inspection.ts:21, 48-50, 283-297` (`= 32`);
`traversal-study/src/inspection.ts:52, 71-73, 305-313` (`= 64`).

The retention loop is the same three lines in all three:

```ts
available += 1;
retained.push(Object.freeze({ event, sequence: available, occurredAt: new Date().toISOString() }));
if (retained.length > EVENT_CAPACITY) retained.shift();
```

The `createEventHistory` envelope is the same fourteen lines in all three, down to the literal
`retention: { lifetime: 'runtime-instance', storage: 'memory', overflow: 'drop-oldest', capacity,
droppedCount: available - retained.length }`.

And this helper appears **verbatim, character for character**, in all three —
`point-light-expo/src/inspection.ts:47-49`, `combat-arena/src/inspection.ts:34-36`,
`traversal-study/src/inspection.ts:62-64`:

```ts
function count(value: number): { available: number; retained: number } {
  return { available: value, retained: value };
}
```

Three files independently arriving at the identical private helper is about as unambiguous as this
gets.

### Why it belongs in the framework

The framework already owns `createEventHistory` — it validates the shape, enforces
`MAX_EVENT_HISTORY_EVENTS`, parses IDs. But it owns only the *format*. Every caller hand-assembles
`incomplete`, `counts` and the whole `retention` block, and hand-rolls the ring that makes those
fields true. **That is a shallow module**: a complex interface relative to what it hides. Owning the
recorder makes it deep, and the change is purely additive — `createEventHistory` stays.

Bonus: `.shift()` on every overflow is O(n). At capacity 64 that is irrelevant, but a real ring costs
the same to write once in the framework as the array version costs to write three times in demos.

One finding worth flagging rather than blocking: two demos call `new Date().toISOString()` inside
`record()` (`point-light-expo/src/inspection.ts:73`, `traversal-study/src/inspection.ts:72`),
reading a hidden clock during simulation. ADR 0013 forbids that for authoritative decisions; this is
inspection-only so it is legal, but the framework recorder should take the timestamp as an argument
so demos stop doing it by default.

### Proposed interface

```ts
// @antiky/framework
export type EventRecorder<Event> = Readonly<{
  record(event: Event): void;
  history(): EventHistory;
}>;

export function createEventRecorder<Event>(options: Readonly<{
  capacity: number;
  sourceId: string;
  worldId: unknown;
  runtimeInstanceId: string;
  /** Project one retained event. Sequence and worldId are supplied. */
  project(event: Event, sequence: number): Omit<EventHistoryEntryInput, 'sequence' | 'worldId'>;
}>): EventRecorder<Event>;
```

`traversal-study/src/inspection.ts:305-320` collapses to:

```ts
const recorder = createEventRecorder<TraversalEvent>({
  capacity: 64,
  sourceId: 'antiky.traversal-simulation',
  worldId: TRAVERSAL_WORLD_ID,
  runtimeInstanceId,
  project: (event, sequence) => ({
    eventSchemaVersion: 1,
    type: event.type,
    commandId: traversalCommandId(sequence),
    entityIds: entityIdsFor(event),
    revision: event.revision,
    occurredAt: event.occurredAt,
    data: event.data,
  }),
});
```

The demo keeps what is genuinely its own — which events exist, which entities they touch, how they
serialise. The framework takes the counting, the dropping, the `incomplete` flag and the retention
envelope, none of which a game author should ever think about.

### Acceptance criteria

- [ ] `createEventRecorder` exported; `createEventHistory` unchanged and still exported.
- [ ] Framework test: with `capacity: 3`, recording 10 events retains the last 3, reports
      `counts.available === 10`, `retention.droppedCount === 7`, `incomplete === true`.
- [ ] Framework test: sequence numbers are 1-based, monotonic, never reused after a drop.
- [ ] Each of the three demos deletes its local ring and `count()` helper; **each demo's existing
      `inspection.test.ts` passes unchanged** — the strongest acceptance signal available here,
      because those tests already pin the exact output shape.
- [ ] Import-boundary test still passes.

**Effort:** ~4 hrs framework; ~1 hr per demo.
**Risk:** low. Fully parallelizable per demo.

---

## 7. Session frame driver

**Rank rationale:** the largest reduction in per-game boilerplate and it fixes three accidental
divergences — but it is the interface that most rewards being designed *after* the others land, and
it carries the most risk.

### The recurring job

Everything between "the host called `frame(platformTime)`" and "the simulation stepped": derive
elapsed time from an absolute platform clock, invalidate that baseline across pause/resume, feed
`advance()`, reconcile input latches, and expose pause/resume/step to the inspection port.

**Implementations: 4.** The three antiky `game.ts` files are the same six lines
(`point-light-expo:141-144`, `combat-arena:131-134`, `traversal-study:99-102`):

```ts
const elapsed = previousPlatformTime === null || platformTimeSeconds <= previousPlatformTime
  ? 0
  : platformTimeSeconds - previousPlatformTime;
previousPlatformTime = platformTimeSeconds;
```

`brometal/town-study/src/town/index.ts:1069-1074` is a fourth, independent expression of the same
idea with a different first-frame convention (`1 / 60` instead of `0`) and its own clamp.

The inspection-port control methods are mechanical in all three antiky demos
(`point-light-expo:116-125`, `combat-arena:108-117`, `traversal-study:77-86`) — **nine identical
method bodies**:

```ts
pauseSimulation() {
  const result = session.pause('tool');
  previousPlatformTime = null;                       // <- leaked framework invariant
  return Object.freeze({ result, session: session.readStatus() });
},
```

**Three accidental divergences, all bugs or dead code:**

1. `traversal-study/src/game.ts:101` clamps elapsed with `Math.min(0.1, …)`. The framework already
   clamps at `MAX_FRAME_ELAPSED_SECONDS = 0.05`. The demo's clamp is *looser*, so it is dead code
   that reads as if it does something. The other two do not clamp at all — correctly, by accident.
2. `traversal-study/src/game.ts:90` renders only `if (result.renderRequested)`. `point-light-expo`
   (`:131`) and `combat-arena` (`:122`) always render. A framework signal that two of three ignore.
3. **No demo reads `advance()`'s result code.** All three read only `.completedSteps`.
   `SESSION_FAULTED`, `INVALID_INPUT`, `INVALID_ELAPSED_TIME` and `COUNTER_LIMIT` are returned by the
   framework and silently dropped by every caller. A faulted session presents as a frozen picture
   with no diagnostic.

That third point is the strongest argument in this document. The framework carefully returns eight
distinct error codes; the API shape makes ignoring them the path of least resistance; **every single
caller ignores them.** Per `GOOD_ENGINEERING_H.md` — *"design interfaces so error cases simply cannot
occur"* — the fix is not to ask callers to check codes, it is to route them into the diagnostics
channel the framework already owns.

### Why it belongs in the framework

`previousPlatformTime = null` on pause is a framework invariant leaking into game code, repeated at
nine sites or the simulation takes a time jump on resume. The elapsed derivation is entirely about
`EngineSession`'s contract. ADR 0020 already draws the line — the game module owns "`EngineSession`
setup and game systems", the host owns "platform time". The driver is the adapter between them, and
it is currently written four times inside game code.

Renderer-agnostic: it never renders. It hands back an alpha and calls a `present` callback the caller
supplies — which is what makes it work for Three.js as well as BroMetal.

### Proposed interface

```ts
// @antiky/framework/game
export type FrameDriver = Readonly<{
  frame(platformTimeSeconds: number): void;
  /** Drop straight into GameInspectionPort — no per-demo wrapping. */
  readonly controls: Required<Pick<
    GameInspectionPort, 'pauseSimulation' | 'resumeSimulation' | 'stepSimulation'
  >>;
  dispose(): void;
}>;

export function createFrameDriver<Input>(options: Readonly<{
  session: EngineSession<Input>;
  readInput(): Input;
  /** Present one frame. `renderAlpha` is 0 while paused or stepping. */
  present(renderAlpha: number): void;
  afterAdvance?(result: EngineFrameResult): void;
  /** Non-ADVANCED frame results land here instead of vanishing. */
  onFault?(result: EngineFrameResult): void;
}>): FrameDriver;
```

The whole of `traversal-study/src/game.ts:56-116` — 60 lines — collapses to:

```ts
const driver = createFrameDriver({
  session,
  readInput: semanticInput,
  present: (alpha) => presentation.render(simulation.view(), context.pointer, alpha),
  afterAdvance: (result) => actions.consume(result),
});

return Object.freeze({
  frame: driver.frame,
  dispose: () => { driver.dispose(); presentation.dispose(); },
  inspection: Object.freeze({
    snapshot(state) { /* demo-specific */ },
    ...driver.controls,
  }),
});
```

Note what the caller no longer has to know: that platform time is absolute and needs differencing;
that a backwards clock must yield zero; that pause invalidates the baseline; that stepping should
present with alpha `0`; that `renderRequested` exists; that `advance()` can fail.

**Design-it-twice note.** The alternative was a thin `deriveElapsed(platformTime)` helper, leaving
control wrapping in each demo. Smaller and less risky — but it removes only 6 of ~45 duplicated
lines and does nothing about the ignored result codes. It would be a shallow module, the exact thing
the rubric says to avoid. The driver hides genuinely non-obvious behaviour, which is what makes it
deep. To de-risk, ship `deriveElapsed` first and grow the driver around it.

### Acceptance criteria

Each bullet is independently verifiable, so this parallelizes across three demo agents plus one
framework agent.

- [ ] `createFrameDriver` exported from `@antiky/framework/game`.
- [ ] Framework test: with a stubbed session, `frame()` yields `0` elapsed on first call, on a
      backwards clock, and on the first call after `resumeSimulation()`.
- [ ] Framework test: a non-`ADVANCED` result invokes `onFault` exactly once and still calls
      `present`.
- [ ] `stepSimulation` presents with `renderAlpha === 0` and honours `renderRequested` uniformly.
- [ ] For **each** antiky demo independently: `game.ts` uses the driver, local elapsed/pause/step code
      is deleted, and **all of that demo's existing tests pass unchanged**.
- [ ] `packages/demos/tests/dev-host.test.mjs` passes unchanged — the real integration guard, since it
      exercises the pause/step MCP path end to end.
- [ ] `traversal-study`'s redundant `Math.min(0.1, …)` clamp is gone and its `simulation.test.ts`
      digest is unchanged, proving the clamp was dead.
- [ ] Import-boundary test still passes.

**Effort:** ~1 day framework; ~2 hrs per demo.
**Risk:** medium — the highest here. It touches the live frame loop of every framework demo and the
pause/step path the CLI and MCP tooling depend on. Land it behind the lower-risk items so the
interface is informed by them.

---

# Not yet earned

`GOOD_ENGINEERING_H.md`: *"a little code duplication is better than a premature abstraction"*, and
`02-REMEDIATION-PLAN.md`: *"Three working implementations is evidence a cut-point may be
approaching; it is not permission to take it before the framework is ready to own it."* Each of the
following was checked against real code and rejected.

### Spatial queries / collision broadphase — reject, and this is the hardest call in the document

I was wrong to expect nothing here. `brometal/town-study/src/town/physics/character-motor.ts` has
the highest-quality code in the repository:

- A clean, renderer-agnostic query interface at `:130-134` — `CharacterPhysicsWorld` with
  `sweepCapsule` / `overlapCapsule` / `probeGround`.
- A game-supplied broadphase seam at `:72-77` — `CharacterWorldAdapter.queryColliders(bounds)`.
- Three shipped implementations: a narrowphase with rounded-corner swept-circle handling
  (`:255-336`, `:359-509`), a linear-scan adapter (`:517-535`), and a **lazy cell-walking voxel
  broadphase** (`:553-603`) that materialises AABBs only for queried cells.
- Determinism engineered throughout — every result list is sorted with `compareColliderIds`
  tiebreaks (`:168-172, 330-334, 411-414, 441-445, 494-497`) so iteration order can never leak in.

**It is still one implementation.** The apparent second copy is not independent:
`brometal/town-study/.../character-motor.ts` and `antiky/antiky-town/.../character-motor.ts` are
**byte-identical** (both `md5 7d25770c0f80275956bec78e7d5c8293`, 1,286 lines each). That is a copy,
not convergence — and by the standard applied to every other item here, one implementation plus a
verbatim copy is not evidence of a general shape. Nothing in the other eight demos does spatial
queries at all: a grep for `grid|broadphase|bucket|overlap|spatial` across the three antiky demo
`src/` trees returns **zero hits**, and `combat-arena` correctly does brute-force N² over ≤6 enemies
and ≤36 projectiles (`combat-state.ts:2-3`).

**But flag it hard as a maintenance finding:** 1,286 lines of the most sophisticated code in the
repository are being maintained in two places with no test that they agree. That is worth a
same-day cheap guard — a checksum or structural-equality test asserting the two files match — long
before any promotion is considered. When a second, genuinely independent physics consumer appears,
this is the first thing that should be promoted, and `CharacterPhysicsWorld` is already the right
interface.

### Camera rigs — reject, and it is not close

Five demos position cameras. They are structurally unrelated:

- `point-light-expo` — a **static** camera (`src/presentation.ts:33-40`) plus a shake term
  (`src/renderer.ts:226-235`).
- `combat-arena` — a **stateless** per-frame projector (`src/presentation.ts:25-78`) with pointer
  drift, velocity lead, aim lead, threat-priority lead, dash pushback and a terminal-phase override.
- `traversal-study` — a **stateful** rig (`src/presentation.ts:63-85`) with exponential damping and
  reset-serial snapping.
- `town-study` — aspect-driven mode variants (`town/index.ts:233-248`) plus exponential follow
  damping (`:806-813`) driven by a *second, ad-hoc accumulator* (`:740, 764, 798-799`).
- Both Three.js demos — an identical pointer-orbit idiom (`glass-garden/src/game.ts:275-279`,
  `orbital-atlas/src/game.ts:233-237`) with **zero damping**; the camera snaps.

One is static, two are stateless, two are stateful, and the Three.js pair would visibly change
behaviour if given damping defaults. They share exactly two idioms: an `aspect < ~1.0` mobile test
and the shape `1 - Math.exp(-dt·k)`. Two idioms, not a module. A `CameraRig` general enough to cover
all five would need lead sources, priority targeting, damping, snapping, mode variants and phase
overrides as options — a complex interface hiding almost nothing, the textbook shallow module. It
must also never own the projection matrix (Three.js owns fov-in-degrees, `aspect`,
`updateProjectionMatrix`, and glass-garden must size *two* consumers because `EffectComposer` holds
its own targets, `game.ts:252-253`).

**Revisit after the camera-shake and interpolation work in `02-REMEDIATION-PLAN.md` lands** — that
work is likely to make two or three of these converge. Convergence is the signal, and it has not
happened.

### Trauma / camera shake — reject *for now*, on a technicality that matters

Two implementations, both wrong: `combat-arena/src/presentation.ts:34-35` (the beating sine pair
diagnosed at length in `02-REMEDIATION-PLAN.md`) and `point-light-expo/src/renderer.ts:226-235`
(`sin(time * 24) * shake`, gated on `dangerPulse > 0.5`). Zero hits for `shake|trauma|recoil` across
the entire brometal and threejs trees. Two is not three — and more importantly, **promoting a model
that both demos got wrong would enshrine the wrong model.** Fix combat-arena first per the plan,
using trauma² and noise; if a third demo then wants the same thing, that is the signal.

### Object pooling — reject, the ring allocator is two lines

The ring-cursor appears four times — `point-light-expo/src/simulation.ts:209-210`,
`combat-arena/src/combat-pools.ts:26-27` and `:62-63`, `traversal-study/src/simulation.ts:243-244` —
always as `cursor = (cursor + 1) % array.length`. But that *is* the implementation. A
`createRingAllocator` would wrap a modulo, and the caller would still own the array, the element
type, the reset semantics and the cursor's exposure in the state digest
(`combat-arena/src/combat-digest.ts:74-75` hashes both cursors). It adds an indirection and hides
nothing. `combat-arena` was right to extract `combat-pools.ts` *locally* — that is where the
abstraction pays, because that is where the pools are non-trivial.

`town-study/src/town/art/sprite-batch.ts:207` is a different animal — a grow-only SoA instance batch
with capacity doubling (`:277-289`), not an acquire/release pool. Promoting "pooling" would mean
merging two unrelated concepts under one name, which `GOOD_ENGINEERING_H.md` flags as a design
smell: *"If naming something is hard, the thing you're naming may not be a coherent concept."*

### Phase / round state machines — reject

Effectively one implementation. `combat-arena` has a real timer-countdown machine
(`src/combat-state.ts:11`, `src/simulation.ts:59-60, 120-144, 385-412`:
`intro → combat → clear → victory | defeat`). `traversal-study` has a three-value `outcome` enum.
`point-light-expo` has none — its `phase` field (`src/simulation.ts:72, 160`) is an oscillator angle.
`town-study` and the Three.js demos have only `let disposed = false`. One implementation is a
feature, not a pattern.

### Attract mode — reject, but note the real abstraction hiding inside it

`traversal-study/src/attract-controller.ts` is welded to its own level geometry — line 1 imports
`COURSE_HAZARDS`, `COURSE_PLATFORMS` and `platformTop`, and the body is edge-detection against that
specific course. There is no generic controller inside it.

`town-study` has the more interesting version: when `mode !== 'interactive'` it synthesises hero
input by path-following (`town/index.ts:767-775`) and does the same for NPCs (`:781-794`), producing
**the same `{x, z}` shape a human would**. The promotable idea there is not "attract mode" but
"input provider" — a seam where AI, replay, attract mode and a human all supply the same semantic
input. That is genuinely attractive and it fits ADR 0013's explicit-inputs model cleanly. It is also
*one* expression of it, and it should be prototyped as such in a demo before the framework grows a
seam for it.

### Live-tunable constants — reject, close to zero implementations

`town-study` has exactly one live-tweakable value and its plumbing is thoughtful —
`src/town/practical-light-input.ts:29-59`, a read-before-frame / commit-after-frame split with
last-known-good fallback so a faulty adapter cannot corrupt a frame. But in `town-study` the source
is always `undefined`; the mechanism is **dead code there**, live only in `antiky-town`, and it is
already fed by the framework's point-light service. Everything else in every demo is a frozen
module-level constant (`point-light-expo/src/presentation.ts:7`,
`combat-arena/src/combat-visuals.ts:4`, `traversal-study/src/visual-layout.ts:50`), plus ~200 inline
`program.uniforms.uFoo.set(0.42)` calls in `town-study` that are not reflectable at all.

There is no duplication to consolidate — only a feature request. It is an attractive one, since the
MCP transport, inspection snapshot and browser dev host all exist already, but it is a *new
capability*, not a promotion, and per the slice process it should be proposed on its own merits and
prototyped in one demo the way point lights were.

*(Worth stealing separately: `DEFAULT_CHARACTER_MOTOR_CONFIG` + `validateConfig` +
per-instance `Partial<>` overrides at `character-motor.ts:631-656, 724-766, 795-798` is a better
authored-constants pattern than anything in the antiky demos, and costs nothing to copy by hand.)*

### Easing / math helpers — reject, narrowly

There is no shared math module anywhere. `clamp` is defined twice independently
(`character-motor.ts:140-142`, `town-foliage.ts:610`) plus dozens of inline
`Math.max(-1, Math.min(1, x))`. `lerp` has no named function at all — it is open-coded three times in
the one `renderPosition` block. `1 - Math.exp(-k·dt)` appears at `traversal-study/src/presentation.ts:73`
and `town/index.ts:809`; `Math.exp(-k·dt)` velocity decay at `combat-arena/src/combat-pools.ts:84-85`.
`smoothstep`/`mix` exist only as shader builtins and are not TS-callable.

Tempting because it is trivial, but a handful of five-line pure functions is exactly the shallow
module the rubric warns about, and the sites are few and clear as-is. These will get pulled in
naturally as part of the interpolation and camera work — do them *then*, as a by-product, not now as
a package.

---

# Framework API ergonomics problems

Independent of the proposals above. Most are cheap; several caused real bugs.

### 1. `HTMLCanvasElement` in a package that claims to be platform-agnostic

`packages/framework/src/game/host.ts:159` — `canvas: HTMLCanvasElement`. This is the **only** DOM
type in the entire framework source, and `tests/import-boundary.test.mjs` does not catch it: that
test greps for `window|document|navigator` and for forbidden import specifiers, neither of which
matches a bare global type reference. The boundary is enforced everywhere except the one place it
leaks. It is type-only, so it costs nothing at runtime, but it means the central game contract cannot
describe a headless, worker or native host without a cast. Either widen to a structural surface type
the framework declares itself, or extend the boundary test to assert the leak is deliberate and
singular. The current state — an undocumented, untested exception — is the worst option.

### 2. The fixed step is baked into the *type system*, not just the value

`contract.ts` declares `FIXED_STEP_SECONDS = 1 / 60`, then uses it as a type —
`fixedDeltaSeconds: typeof FIXED_STEP_SECONDS` — in `EngineStepContext`, `CompletedEngineStep` and
`EngineSessionStatus.clock`. A game wanting a 30 Hz or 120 Hz simulation cannot have one without
editing framework source, and the literal type makes even a widening change breaking.
`MAX_STEPS_PER_FRAME = 3` and `MAX_FRAME_ELAPSED_SECONDS = 0.05` are equally fixed — and
`town-study`'s hand-rolled motor independently chose `maxCatchUpSteps: 16` and
`maxFrameDeltaSeconds: 0.25` (`character-motor.ts:631-656`), i.e. **5× and 5× the framework's
values**. That divergence is direct evidence the constants want to be per-session options. Doing it
now is small and backwards-compatible; later it is painful.

### 3. `advance()` returns errors that every caller ignores

Covered in proposal 7; restated because it is an API-shape problem, not a demo problem. Eight
distinct `EngineFrameResultCode` values are returned; all three framework demos destructure only
`.completedSteps`. A faulted session presents as a frozen picture with no diagnostic anywhere. Per
*"define errors out of existence"*, the framework should route non-`ADVANCED` results into the
diagnostics array `createGameInspectionSnapshot` already builds.

### 4. Inspection snapshots are built and validated twice

Every demo does this (`point-light-expo/src/game.ts:100-108`, `combat-arena:100-106`,
`traversal-study:69-75`):

```ts
const base = createGameInspectionSnapshot(state, { session, pointLights });
return createInspectionSnapshot({ ...base, world, events });
```

`createGameInspectionSnapshot` validates a complete snapshot, which is then spread and validated
again — two full validation passes per inspection call, in an idiom non-obvious enough that all
three demos had to discover it independently. `createGameInspectionSnapshot` should accept optional
`world` and `events` in its `details` argument and validate once.

### 5. `previousPlatformTime = null` is an invariant the framework refuses to own

Nine sites across three demos (proposal 7). The framework knows that pausing invalidates a timing
baseline; it says so nowhere except by consequence. A game that forgets takes a time jump on resume,
and because `advance()` clamps at `MAX_FRAME_ELAPSED_SECONDS` the symptom is a silently swallowed
second, not a crash.

### 6. `EngineSessionDisposalError` throws away the causes

It carries `failureCount` and nothing else. When two owned services fail to dispose you learn that
two failed and nothing about why. `traversal-study` independently built the `AggregateError` version
the framework should have (`src/resource-scope.ts:31-33`). Covered in proposal 2; independently
shippable as a one-hour fix.

### 7. Time vanishes below ~20 fps with no signal to the game

`MAX_FRAME_ELAPSED_SECONDS = 0.05` and `MAX_STEPS_PER_FRAME = 3` mean a session under ~20 fps
permanently discards simulation time. The framework does report it —
`EngineFrameResult.discardedElapsedSeconds` and `EngineSessionStatus.clock.totalDiscardedSeconds` —
and **no demo reads either field**. Good instrumentation with no consumer; the frame driver should
surface sustained discard as a diagnostic automatically.

### 8. `platformTimeSeconds` has no defined epoch

`host.ts:169` declares `frame(platformTimeSeconds: number)` and says nothing about its origin.
`packages/website/src/components/DemoStage.tsx:190` passes `now / 1000` from `requestAnimationFrame`
— monotonic since **page load**, not since mount — so a demo mounted 40 s into a session starts
mid-phase. Games that animate from absolute time (both Three.js demos do; see
`orbital-atlas/src/game.ts:220-239`) are silently affected. Either document it or pass mount-relative
time.

### 9. Canvas backing-store ownership is ambiguous, and it caused a real bug

The host writes `canvas.width/height = clientWidth * dpr`
(`packages/cli/src/host/game-server.ts:398-403`) while games call
`renderer.setPixelRatio(...)` + `setSize(...)`, which writes the same properties. Two owners, no
protocol. `orbital-atlas/src/game.ts:211-213` compares drawing-buffer pixels against CSS pixels:

```ts
const width  = Math.max(1, canvas.clientWidth  || 1280);
const height = Math.max(1, canvas.clientHeight || 720);
if (canvas.width === width && canvas.height === height) return;
```

With `setPixelRatio(2)` (line 59), `canvas.width` is `width * 2`, so the early-out **never fires on
any HiDPI display** and `setSize` + `updateProjectionMatrix()` run every single frame.
`glass-garden` avoided this by memoising its own `renderWidth/renderHeight` (`game.ts:244-256`) —
two demos re-derived the resize protocol and one got it wrong. (This bug is already listed in
`02-REMEDIATION-PLAN.md` Phase 4; the root cause is a contract gap, not a demo mistake.) Relatedly,
both demos hard-code `|| 1280` / `|| 720` fallbacks matching their project manifest viewport,
because `GameHostContext` never tells a game its intended render size.

### 10. `report()` is push-only and fire-once, so the numbers are fabricated

`glass-garden/src/game.ts:236-241` reports `instances: bloomLayout.length * 3 + 7` and the same
figure for `drawCalls`; `orbital-atlas/src/game.ts:202-207` reports a literal `drawCalls: 11`.
Three.js exposes `renderer.info.render.calls` truthfully — but only *after* a render, and there is no
pull-style `measure()` hook, so nobody wires it. The magic `+ 7` and `11` will rot silently as the
scenes change, and `get_render_stats` (`packages/cli/src/mcp/tools.ts:316`) reports them to agents as
fact. A pull hook (`measure?(): GameMeasurements`) alongside the existing push would fix it.

### 11. Inspection is structurally unavailable to non-framework games

`GameInstance.inspection?` (`host.ts:171`) requires `GameInspectionPort` and
`createGameInspectionSnapshot` from `@antiky/framework/game`. Six of ten demos cannot import those,
so the entire Studio inspection / pause / step / session surface is unreachable for them. That is the
strongest argument for proposal 3: whatever the fence decision, the inspection *contract* should live
behind a renderer-neutral, dependency-free entry point.

### 12. Demo tests must `npm run build` before `node --test`

Every demo's `"test"` script is `npm run build && node --test …`, purely so a test can `import` the
bundle and assert `typeof game === 'function'`. Two of the Three.js tests are regex-over-source
assertions (`glass-garden/tests/game.test.ts:13-22`, `orbital-atlas/tests/game.test.ts:13-19`) — a
symptom of there being no framework-provided way to instantiate a game against a headless fake host.
A tiny `createTestGameHost()` in the framework would replace the regex tests with real ones and cut
the build from the test loop.

---

# Suggested sequencing

Items 1–6 are mutually independent and can run as parallel agents. Item 7 (the frame driver) depends
on 1 and 5 for its interface and carries the most risk, so it lands last.

| Order | Item | Framework effort | Per-demo effort | Risk |
|---|---|---|---|---|
| 1 | Render interpolation alpha | ~2 hrs | ~2 hrs | very low |
| 2 | Disposal scope | ~4 hrs | ~1 hr | low |
| 3 | Zero-dependency contract module | ~3 hrs | none | low (one product decision) |
| 4 | Seeded RNG streams | ~4 hrs | ~1 hr | low-medium |
| 5 | Latched input buffer | ~3 hrs | ~1 hr | low |
| 6 | Bounded event recorder | ~4 hrs | ~1 hr | low |
| 7 | Session frame driver | ~1 day | ~2 hrs | medium |
| — | Ergonomics fixes 2, 4, 6, 10 | ~6 hrs total | none | low |
| — | `character-motor.ts` duplicate-file guard | ~30 min | none | none |

Roughly **one week of framework work plus a day per demo.** It removes on the order of 400
duplicated source lines and 500 duplicated test lines, and it fixes:

- one live bug (`point-light-expo`'s input latch re-triggering on hold),
- one latent determinism hazard (`Math.sin` in the digest path),
- one silent failure mode (ignored `advance()` codes),
- one rendering artefact affecting every demo on high-refresh displays (judder),
- one shear bug in `town-study` (camera vs. sprite reading different positions).

Every item's acceptance criteria are phrased as *"the demo's local implementation is deleted and its
existing tests pass unchanged."* That is deliberate: it makes each promotion independently
verifiable by a separate agent, and it keeps the demos as the proving ground rather than making the
framework the authority.

**One thing to do before any of this:** add the `character-motor.ts` duplicate-file guard. 1,286
lines of the best code in the repository are maintained in two packages with nothing asserting they
agree. It costs half an hour and it is the highest-risk-per-unit-effort item on the page.
