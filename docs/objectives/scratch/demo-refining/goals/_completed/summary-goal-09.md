# Summary — goal 09: remove the scar tissue and the within-demo divergence

**Completed:** 2026-08-14
**Commits:** `83149bc`, `b82a97a`, `effd619`, `fffdfca`, `94868e4`, `7646c2e`, `75f21cc`, `faaf202`,
`6761df4`, `6b4ca12`, `bce490a`, `10213e1`, `29dfb05`, `cfd4d93`, `19280ab`
**Goal file:** [`execute-goal-09.md`](execute-goal-09.md)

## Action needed from the owner

Eight items. Five are the owner questions the goal named and reserved; three are things this goal
found and is not entitled to decide. Items 6 and 7 are the ones that block other work.

| # | What | Why it needs you | Blocks |
|---|---|---|---|
| 1 | **The 27 "ambience" filler instances** in `point-light-expo` (`render-profile.ts:48-50`, populated at `relay-visuals.ts:222-235`, `:329-340`, `:424-437`) — delete, or deliberate set dressing? | Taste. The code cannot say whether decorative geometry with no gameplay meaning is a defect or the point. | ~55 lines of section-A cleanup |
| 2 | **Per-instance `iTint` micro-variation** on the catalog models — compensation or authored art? | **Already moot, and you should know why.** Goals 06–08 deleted every `iTint`, `roughnessBias` and rock/stump `emissive` before this goal ran. The question is now retrospective: if any of it *was* authored art, it is gone and wants re-authoring deliberately. | nothing — but a look you may have lost |
| 3 | **`markedScale` 1.38 / `markedMinimumAlpha` 0.7** (`combat-arena/src/combat-projection.ts:53-54`) — gameplay affordance, or contrast patch? | The goal explicitly reserved this. Bloom and a real value range have now landed, so it is re-derivable — but only you can say whether "this is the marked one" is a readability requirement independent of contrast. | the last un-deleted knob of the thirteen |
| 4 | **`RELAY_ONBOARDING_CUES.relayMarkerCounts`** — was it meant to drive the relay identity markers? | Product intent. **I deleted the dead field** because required outcome 5 and the evidence list both demand it by name; recoverable from `effdf619^`. Verified first that it changed nothing: `relay-visuals.ts:237-239` derives 1/2/3 from `relayIndex + 1`, exactly matching the deleted `[1, 2, 3]`. If the answer is "yes, it was the source", that is a feature to build, not a revert. | nothing today |
| 5 | **`backgroundCompositionAt`'s ignored `_cameraX`** (`traversal-study/src/environment.ts`) — survives or dies with the parallax decision. | Gated on a decision you have not made. **Left in place**, as the goal directs. | the parallax decision |
| 6 | **`antiky-town`'s local-contrast budget: 7.75 against a floor of 8.5.** | **A pre-existing failure, not caused by this goal** — the sidecar committed before any of this work read 7.7854, also below the floor. The budget's own doc says the floor was set because the demo "already measures 8.61", so something regressed it between then and now. The goal forbids me loosening a budget. | any goal that requires antiky-town's budget green |
| 7 | **Two antiky-town test files never run** — `tests/ambient-contract.test.ts` and `tests/water-depth-contract.test.ts` are referenced by no runner anywhere in the repo. | One of them describes itself as existing "so the audit's conclusion cannot be quietly undone". It can be. Whether to wire them up or rewrite them against behaviour is a call about what they are for. | safely decomposing `town.ts` and `index.ts`, whose only stated protection is these two files |
| 8 | **A shared test's scope is broader than it reads.** `packages/demos/tests/pipeline-invariants.test.mjs:425` loops over `['combat-arena', 'point-light-expo']` and calls `demoSources(slug)` — but `demoSources()` (`:235`) takes **no parameter**, so the argument is silently dropped and the invariant scans all ten demos, twice. | The file is outside this goal's owned tree, so fixing it is a scope breach. It is a real defect and it produced a false positive against my work (see *What I got wrong*). | nothing, but it will bite the next person who adds a `render-batches.ts` |

## What was delivered

Against the goal's ten required outcomes:

1. **The thirteen knobs — 12 of 13 resolved, 1 reserved.** The goal's inventory was written against a
   pre-goal-06/07 tree and **ten of the thirteen were already gone** when this goal started
   (`uSaturation`, `uTextureContrast`, `uDiffuseLift`, `floorTextureContrast`, `uGradeColor`,
   `uGradeMix`, `vWash`, `iTint`, `roughnessBias`, rock/stump `emissive`, and both point-light-expo
   `min(specGGX)` clamps). Two more are **re-derived and recorded rather than deleted**, which the
   goal permits: `floorDiffuseTint` is now `(0.55, 0.6, 0.59)`, re-authored by goal 08 as a
   documented palette decision (`reliquary-floor.shader.ts:287-292` states the intent), and its old
   three-multiply wash chain is genuinely gone — the fixed-grey `mix(vec3(0.38,0.36,0.31), …, 0.56)`
   no longer exists; and `uExposure` 1.24 is no longer a per-material uniform at all — it survives
   only on `post.shader.ts`, which is exactly the "exposure moves to the single post stage"
   relocation the plan asked for. `markedMinimumAlpha` is item 3 above.
2. **One ground-height function in `traversal-study`.** `supportAt`, `courseTopAt` and `courseTop`
   are collapsed into `src/course-query.ts`. `groundTopAt` is now literally
   `supportAt(x, ABOVE_THE_COURSE, time)?.top ?? 0`, so the drawn ground and the stood-on ground
   cannot diverge again by construction rather than by discipline.
3. **One palette in `combat-arena`.** `arena-signals.ts` imports `COMBAT_PALETTE` and declares no
   colour of its own; `COMBAT_PALETTE` gained `ink` for the near-black the cues rule their bars in.
4. **`ROLE_SHAPES` reads generated data.** `roleShape(role)` derives width and length from
   `ENEMY_HULL_CONTRACTS[role].span`; only `hardpoints` stays authored.
5. **Section C dead code removed** — `BACKGROUND_LAYERS`, `EnvironmentLayerId`, `BackgroundLayer`,
   the `layer` field, the `procedural` landmark channel, `PlatformInstance.lap`, three quarters of
   `RelayOnboardingCue`, and the `SHIP_PRESENTATION_SPANS` double re-export. The rest of section C
   was already gone.
6. **Constants pretending to be parameters** — `uModel` and `uTint` were both already removed by
   earlier goals; verified zero hits including `.gen.ts`.
7. **Uniform pruning in `point-light-expo`.** `setLights` writes exactly three uniforms. Per-frame
   uniform writes dropped **51 → 24**, not the goal's predicted 62 → 26 — that prediction was
   measured against a `renderer.ts` that has since grown from ~300 to 550 lines.
8. **The `antiky-town` inventory is written and committed** —
   [`13-ANTIKY-TOWN-COMPLEXITY.md`](../../13-ANTIKY-TOWN-COMPLEXITY.md), covering all seven required
   rubric dimensions with `file:line`, and labelling every finding SPRITE / VOXEL / neither. Its
   ungated head item is landed: the superseded pre-EngineSession game loop and its live
   module-level default export are gone.
9. **Shader regeneration verified.** One shader source changed (comments only);
   `npm run shaders:prod` twice produces no `.gen.ts` diff.
10. **No re-tuning.** No knob was changed to a different number to make anything pass, and no budget
    was loosened.

**Also delivered, from the goal's in-scope file splits:** `traversal-study/src/simulation.ts`
568 → 499, `renderer.ts` 930 → 614. No file in the three original demos now exceeds 800 lines.

**Not delivered:** `point-light-expo/src/simulation.ts` (503 lines) was left alone — the goal names
it "the lowest-value item in the goal — do it last or not at all".

## What I got wrong

**I named a new file `render-batches.ts` and broke a shared invariant.** Splitting
`traversal-study/src/renderer.ts` produced a batch-factory module, and `render-batches.ts` was the
obvious name — it is what the plan called it and what the other two demos call theirs. That tripped
`pipeline-invariants.test.mjs:425`, "the batch factories expose one instance writer, not two",
which matches on that filename. My first instinct was that I had introduced a duplicate writer. I
had not: traversal-study's three factories each expose exactly **one** writer, named `set`. The test
flags the name `set` because in the other two demos `set` was the *dead twin* beside a live
`setValues`. Renamed to `course-batches.ts`, which fits this demo's own `course.ts` /
`course-query.ts` naming better anyway. Chasing it is what surfaced owner item 8.

**The goal's own witness for the ground-height test does not witness the bug.** The goal requires
the test to "fail first" on "every checkpoint and delivery `x` in `COURSE_BEATS`". I wrote it and
measured before trusting it: at all four of those x values the renderer and the simulation
**already agreed**, so that test as specified passes vacuously. The divergence is real but lives
elsewhere — at `x ∈ [8.4, 10]` (post-yard against sail-step, 0 versus 0.5) and `x ∈ [166.6, 167.5]`
(gate-stair against relay-tower, 2.35 versus 3.0). Luckily `x = 8.4` **is** in `COURSE_BEATS`, as a
`risk` beat rather than a checkpoint, so widening the test from "checkpoints and delivery" to "every
beat" makes it fail first exactly as intended. It did: `dispatch-hop-beat at x=8.4` expected 0.5,
got 0. Had I written only what the goal specified and not checked, I would have shipped a green test
that proved nothing.

**"Pixel-identical captures" is not achievable with this harness, and I should say so rather than
claim it.** The goal requires provable no-ops to produce pixel-identical captures. They do not,
because the capture is not deterministic for animated demos. Shooting `point-light-expo` **twice
with no code change at all** moved luminance p95 by 0.00296 and flipped `hue.clusters` from 5 to 4 —
a larger delta than my uniform hoist produced (0.00271). So the honest statement is *the change is
smaller than the harness's own run-to-run noise*, not *the capture is identical*. The one place the
requirement is fully met is `traversal-study`, whose capture **is** deterministic: its metrics after
the ground-height fix, both file splits and the environment removals are byte-identical to the
committed pre-change sidecar, to every digit.

## Traps worth knowing

- **A grep for these identifiers is a trap in both directions.** `uSaturation` and `min(specGGX)`
  now match only in `antiky-town`, where they mean something different — a post-pass grade control
  and the town's own un-fixed clamps — not the point-light-expo knobs the goal named.
  `traversal-study/src/renderer.ts:156` has a local named `procedural` meaning "the non-catalog
  batches", unrelated to the deleted landmark channel. Deleting on a name match would have been
  wrong three times.
- **`demoSources(slug)` ignores its argument** (owner item 8). Any invariant written as
  "check only these demos" is actually checking all of them.
- **The visual-budget tests fail closed on a source-digest mismatch.** Restoring an older sidecar
  makes *all* of a demo's budgets fail on the digest assertion, not on the metric — which reads
  like a catastrophic regression and is not one. Re-shoot before diagnosing.
- **`traversal-study` has a fourth ground inset nobody mentions.** `simulation.ts:429`'s landing
  test uses `width*0.5 − 0.06` where `supportAt` uses `−0.05`. Left alone: it answers a genuinely
  different question ("did the courier cross this top while falling"), but the two constants should
  probably be named and related.
- **The shader generator reports three unused uniforms in `traversal-study`** that no test surfaces:
  `uTime` in `course-sky.shader.ts`, and `uSunDirection` in **both** `traversal-model.shader.ts` and
  `traversal-surface.shader.ts`. A sun direction declared and never read in a shader that has a sun
  may be dead code or may be a missing feature — worth a look, not assumed.

## Evidence

| Check | Result |
|---|---|
| `rg` zero hits for `uDiffuseLift`, `uTextureContrast`, `vWash`, `uModel`, `uTint`, `lap`, `catalogParts`, `SHIP_PRESENTATION_SPANS`, `BACKGROUND_LAYERS`, `relayMarkerCounts`, `ARENA_ENERGY_INSTANCES`, `uGradeColor`, `uGradeMix` | **0 each**, including `.gen.ts` |
| `rg` for `uSaturation`, `uDiffuseTint`, `min(specGGX)` | **not zero, and correctly so** — antiky-town's post grade and clamps (gated on its inventory), and point-light-expo's re-derived floor tint |
| `rg` for `procedural` | landmark channel gone; remaining hits are a pre-existing unrelated local and prose |
| `arena-signals.ts` declares no colour literal; `rg '\[0\.08, 0\.72, 0\.92\]' combat-arena` | **0 hits**; the two bracket matches left are `color[0..2]` indexing |
| Ground-height test written first, watched fail, then passed | **RED** at `dispatch-hop-beat x=8.4` (expected 0.5, got 0) → **GREEN** |
| `presentation.test.ts`'s `* 0.9` tolerance replaced by exact equality | replaced by five `assert.equal` against `SHIP_FOOTPRINTS`; passes |
| `environment.test.ts` rewritten assertions fail when the removed thing returns | verified both: reintroducing a non-catalog panel fails the catalog assertion; collapsing every landmark to one `z` fails the depth assertion |
| `setLights` writes exactly three uniforms | 3 (`uEmberPower`, `uIonPower`, `uVioletPower`) |
| Per-frame uniform-write count | **51 → 24** (goal predicted 62 → 26 against a smaller, older `renderer.ts`) |
| antiky-town removal covered by a test that fails on reintroduction | verified — re-adding `export default` fails `the town module exposes one runtime factory and no second game entry` |
| `npm run shaders:prod` twice → no `.gen.ts` diff | confirmed |
| `tsc --noEmit` across all workspaces | **clean** |
| Full `npm test` | **0 failing tests** repo-wide |
| `npm run demos:verify` | 54/60. The 6 failures are **all pre-existing**: antiky-town local contrast (owner item 6), three traversal-study budgets whose metrics are byte-identical to the pre-change sidecar, and two source-scanning invariants (atlas gutter, material tone-map) in files this goal never touched — `git diff --name-only b42a721 HEAD` matches no shader or atlas |
| Capture pairs + committed sidecars | all four demos re-shot and committed |

## What this unblocks

- The `antiky-town` inventory now exists, so any goal that wants to touch that demo has a rubric-
  scored map with call-site evidence instead of nothing. Its ranked worklist is ready to cut goals
  from — ranks 6–8 are ungated and mechanical.
- `traversal-study`'s renderer and simulation are both back under the decomposition threshold, so
  further work there is a smaller diff.
- The single `groundTopAt` is the natural place to hang any future course-geometry question.

## What remains blocked

- The last of the thirteen knobs (`markedMinimumAlpha` / `markedScale`) waits on owner item 3.
- `antiky-town`'s highest-value finding — **three bridge-height rules disagreeing by up to 1.03 m**
  (inventory §5.1) — is scoped and measured but not fixed. It needs the equality test written first,
  and that test does not exist and would fail today. It is a goal of its own.
- The floating `map-kit` sprite prop over the canal (inventory §5.2) is a live one-line fix that
  wants a "every prop stands on ground" test first.
- Decomposing `town.ts` (2292) and `index.ts` (1224) is blocked on owner item 7.
