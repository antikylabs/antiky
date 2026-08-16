# Execute goal 09: remove the scar tissue and the within-demo divergence

## Prerequisites

- **Goal 06 (colour management) and goal 07 (HDR target, key light, ambient) must be landed in a
  demo before that demo's scar tissue is deleted.** Every knob in section B of
  `04-COMPLEXITY-REDUCTION.md` exists to fight a bug that lives somewhere else. Deleting first makes
  the demo visibly darker and muddier, not better (`04-COMPLEXITY-REDUCTION.md:88-90`, `:221-223`).
- Goal 01's capture loop is required transitively: the scar-tissue deletions have no test coverage
  and are judged from a captured frame plus its metrics sidecar
  (`04-COMPLEXITY-REDUCTION.md:777`).
- The pure-removal items in section C and D are **not** gated and may start as soon as goal 06 is
  under way; they change no pixels.
- `antiky-town` has the same prerequisites as the other three demos: goals 06 and 07 must land in it
  before its scar tissue, if any, is deleted.

Owned files: `packages/demos/antiky/{point-light-expo,combat-arena,traversal-study,antiky-town}/src/**`
and `tests/**`. This goal conflicts with any packet that owns those trees. It is parallel-safe
against goal 10, which owns `packages/website/**` and the non-Antiky demos.

## `/goal` objective

Delete the compensation knobs, the dead code and the second-way-to-do-the-same-thing from the four
Antiky demos, and collapse `traversal-study`'s three divergent "ground height at x" functions into
one correct function.

The headline finding is that **file size is not the problem**. No file in `point-light-expo`,
`combat-arena` or `traversal-study` exceeds 800 lines and only three exceed 500
(`04-COMPLEXITY-REDUCTION.md:36-46`). The weight is roughly 350–450 lines that exist to compensate
for the colour and lighting bugs, plus roughly 250 lines that are dead, vestigial, or a duplicate
path (`04-COMPLEXITY-REDUCTION.md:48-51`).

**`antiky-town` is the exception and it changes the size of this goal honestly.** It is the largest
Antiky demo at roughly 12,500 lines of `src/`, and it was deliberately excluded from every audit
this goal is built on (`04-COMPLEXITY-REDUCTION.md:5`), so no inventory of its complexity exists
yet. This goal must produce that inventory before it deletes anything there. Expect the town sweep to
cost at least as much as the other three demos combined, and plan it as its own pass rather than
folding it into their line items.

Nothing here proposes a shared package, a shared helper, or moving code between demos. Duplication
*across* demos is accepted and intentional. Only duplication and divergence **inside one demo** is a
defect here (`04-COMPLEXITY-REDUCTION.md:11-22`).

## Required outcome

When the work is complete, the repository must have:

1. **thirteen named knobs gone, not re-tuned.** `uSaturation` 0.90, `uTextureContrast` 0.78 and
   `uDiffuseLift` 0.14 (`point-light-expo/src/shaders/reliquary-model.shader.ts:84-86`);
   `floorTextureContrast` 0.56 and `floorDiffuseTint` (`point-light-expo/src/presentation.ts:19-20`);
   `uGradeColor` / `uGradeMix` ≤ 0.90 (`traversal-study/src/renderer.ts:307-314`,
   `src/shaders/traversal-model.shader.ts:24-25`); `vWash` at ±4% and measured invisible
   (`traversal-model.shader.ts:42`, consumed `:54`); per-instance `iTint` micro-variation at ±8%,
   `roughnessBias` −0.02…−0.08, and an `emissive` of 0.018–0.035 **on rocks and tree stumps**
   (`point-light-expo/src/reliquary-model-layout.ts:34,42,76,90,105-107,123,131,143-145`); the
   `min(specGGX(...), 1.5)` and `min(specGGX(...), 2.4)` clamps
   (`reliquary-model.shader.ts:60`, `foundry.shader.ts:36`); the per-material `uExposure` 1.24
   (`point-light-expo/src/presentation.ts:9`); and `markedMinimumAlpha` 0.7
   (`combat-arena/src/combat-projection.ts:30`) either deleted or re-derived with the new number
   recorded. Self-illuminating rock is not art direction — it props up geometry whose occlusion is
   forced to `1` at `reliquary-model.shader.ts:162`;
2. **one ground-height function in `traversal-study`.** Today there are three with different rules:
   `supportAt` (`src/simulation.ts:161-171`, highest-wins, a `width*0.5 − 0.05` inset and a 0.14
   vertical tolerance), `courseTopAt` (`src/renderer.ts:282-288`, first match in array order, no
   inset, no height test) and `courseTop` (`src/inspection.ts:330-333`, a third loop). Where two
   platforms overlap in `x` the courier stands on one platform and the contact shadow, checkpoint
   flags, delivery flag and landing rings are drawn against another, and the inspector reports a
   third. The simulation's rule wins;
3. **one palette in `combat-arena`.** `src/arena-signals.ts:4-7` declares its own `CYAN`, `WHITE`
   and `WARM` that differ from `COMBAT_PALETTE` (`src/combat-visuals.ts:4-13`) — most visibly the
   warm, `[1, 0.24, 0.07]` against `[1, 0.19, 0.035]`;
4. **`ROLE_SHAPES` reading generated data instead of transcribing it.**
   `combat-arena/src/combat-visuals.ts:83-88` hand-codes per-role `width`/`length` rounded from
   `ship-footprints.gen.ts`, which is already reachable as `ENEMY_HULL_CONTRACTS[role].span`
   (`src/combat-hulls.ts:42`) and is regenerated by `scripts/intake-quaternius-ships.mjs`;
5. **the dead code in section C removed**: `ARENA_ENERGY_INSTANCES`
   (`combat-arena/src/arena-environment.ts:6`), `DEFAULT_OFFSETS`
   (`combat-arena/src/arena-signals.ts:9`, whose default gauge offset is also *wrong*),
   `ROLE_SHAPES[*].height`, `catalogParts` (`combat-visuals.ts:79`), the dead `set()` twin on both
   batch factories (`combat-arena/src/render-batches.ts:53,125`,
   `point-light-expo/src/render-batches.ts:90,168`), the vestigial `procedural` landmark channel and
   `BACKGROUND_LAYERS` (`traversal-study/src/environment.ts:26,28-33,96`), `PlatformInstance.lap`
   (`traversal-study/src/simulation.ts:75`), three quarters of `RelayOnboardingCue`
   (`point-light-expo/src/onboarding-cues.ts:1-33`) and the `SHIP_PRESENTATION_SPANS` double
   re-export (`combat-arena/src/combat-hulls.ts:80-86`, `src/ship-assets.ts:16,33`);
6. **constants that pretend to be parameters removed**: `uModel`, always the identity matrix, costing
   two dead 4×4 multiplies per vertex across four programs (`point-light-expo/src/renderer.ts:171`,
   `:246`, `foundry.shader.ts:55,88,99,111`), and `uTint`, always `[1,1,1]` at all thirteen call
   sites (`traversal-study/src/renderer.ts:200,302-314`, `traversal-model.shader.ts:23,46,54`);
7. **uniform pruning in `point-light-expo`.** `reliquary-model.shader.ts` declares 30 uniforms and
   **3 vary at runtime**. Nine of the twelve per-frame light uniforms are frozen constants from
   `EXPO_LIGHT_DEFINITIONS` (`src/lights.ts:19-53`) re-uploaded every frame across five programs;
   only the three `Power` values change (`04-COMPLEXITY-REDUCTION.md:589-610`);
8. **a first complexity inventory for `antiky-town`, produced and then acted on.** No audit of it
   exists. The inventory must apply the same rubric the other three received and report, with
   `file:line`: every file over the 500-line cohesion threshold and every file over the 800-line
   decomposition threshold in `docs/GOOD_ENGINEERING_H.md`; every scar-tissue knob (a constant that
   exists to fight a bug living elsewhere); every dead or vestigial export, checked by **call site,
   not type name**; every shallow module whose interface is larger than what it hides; every uniform
   that never varies at runtime; and every case of the same question answered two different ways
   inside the demo. Known starting points: `src/town/art/town.ts` is the same file that measures
   2,194 lines in its `town-study` twin, and `src/town/art/town.ts:2192` carries a sixth copy of the
   `fract(sin(...))` hash with constants `127.1, 311.7, 43758.5453`. Removals follow the same gates
   as the other demos — ungated for dead code, gated on goals 06 and 07 for anything compensating;
9. **every shader that changed regenerated**, with `*.shader.gen.ts` committed and a second
   `npm run shaders:prod` producing no diff; and
10. **no re-tuning anywhere.** A knob is deleted or it is re-derived from a measured on-screen value
    that is written down. Changing 0.90 to 0.95 is not an outcome of this goal.

## In scope

- All four Antiky demos' `src/` and `tests/` trees, and their committed generated shader files.
  `antiky-town` is fully in scope for modification.
- Producing and committing the `antiky-town` complexity inventory before deleting anything in it.
  `antiky-town` is the repository's only 2.3D artifact, so its inventory must say explicitly which
  findings are sprite-related and which are voxel-related; a "dead" path there may be the only 2.3D
  expression of something the other demos do in 3D.
- Section B (scar tissue), section C (dead code), section D (shallow modules), section E
  (over-parameterisation) and section F (within-demo divergence) of `04-COMPLEXITY-REDUCTION.md`.
- The file splits in section A **only where a test already protects them**:
  `traversal-study/src/simulation.ts` (568 lines) into `course-query.ts` + `trail-particles.ts` +
  `simulation.ts`, protected by `tests/simulation.test.ts` (385 lines); and
  `traversal-study/src/renderer.ts` (524 lines), protected by `tests/visual-contract.test.ts`.
  `point-light-expo/src/simulation.ts` at 503 lines is borderline and is the lowest-value item in
  the goal — do it last or not at all.
- Recording the five owner questions below and stopping on the items they gate.

## Required tests and evidence

At minimum, prove:

- **the ground-height regression test is written first and fails first.** For every checkpoint and
  delivery `x` in `COURSE_BEATS`, the value the renderer uses equals the top of the platform the
  simulation would land the courier on. `tests/simulation.test.ts:264` already reaches into
  `platformInstancesNear` and is the right home. Watch it fail against today's `courseTopAt`, then
  make it pass;
- `rg` returns **zero** hits, including in `*.gen.ts`, for each of: `uDiffuseLift`,
  `uTextureContrast`, `uSaturation`, `uDiffuseTint`, `uGradeColor`, `uGradeMix`, `vWash`, `uModel`,
  `uTint`, `min\(specGGX`, `lap`, `catalogParts`, `SHIP_PRESENTATION_SPANS`, `BACKGROUND_LAYERS`,
  `procedural`, `relayMarkerCounts`, `ARENA_ENERGY_INSTANCES`;
- `arena-signals.ts` declares no colour literal, and `rg '\[0\.08, 0\.72, 0\.92\]' combat-arena`
  returns zero hits;
- `tests/presentation.test.ts:187-188`'s `* 0.9` tolerance — which exists only to detect the drift
  the `ROLE_SHAPES` duplication created — is replaced by an exact equality that passes;
- the `environment.test.ts` assertions that encoded the *old* shape are rewritten in the same commit
  to assert the surviving intent (every background landmark is a real catalog asset; the background
  has at least three distinct `z` buckets spanning ≥ 15 units), and each rewritten assertion is
  verified to fail when the removed thing is reintroduced;
- `setLights` writes exactly three uniforms and the per-frame uniform-write count in `render` drops
  from 62 to 26, countable by grep on `point-light-expo/src/renderer.ts:243-274`;
- provable no-ops produce **pixel-identical captures**: `uModel`, `uTint`, the uniform hoist, and
  both file splits. Any pixel movement means the change was not a no-op — revert;
- for the gated deletions, a before/after capture pair plus committed `visual-metrics.json` sidecars
  showing the demo's goal-01 visual budget still passes;
- in `antiky-town`, every removal is covered by an existing test that passes unchanged, or by a test
  written before the removal that fails when the removed thing is reintroduced. It has no audit
  behind it, so a grep is never sufficient evidence there; and
- `tsc --noEmit` clean and every demo's existing test suite passing, with import-path edits only.

## Explicit non-goals

- Do not create a shared package, module or helper between demos. Not once.
- Do not remove the resource-lifetime / disposal-stack modules
  (`point-light-expo/src/resource-lifetime.ts`, `combat-arena/src/resource-lifetime.ts`,
  `traversal-study/src/resource-scope.ts`). Consolidating them is goal 11's promotion, not a
  deletion here.
- Do not remove any `*Dependencies` seam. All six are injected by resource-leak tests
  (`04-COMPLEXITY-REDUCTION.md:489-500`). Chesterton's fence holds.
- Do not delete `combat-digest.ts`, the simulation `*Options` seams, or `RELAY_RENDER_PROFILE`'s
  slot allocator. Each has a stated, verified reason.
- Do not delete the unpacked normal maps under `point-light-expo/assets`. They are ~3 MB referenced
  by nothing **on purpose**, with a documented reason and a scheduled consumer.
- Do not rewrite game logic in any demo, `antiky-town` included.
- Do not delete anything in `antiky-town` before its inventory is written and committed. It is the
  one demo where nobody has yet checked which fences have reasons.
- Do not re-tune a knob instead of deleting it, and do not loosen a visual budget to make a deletion
  pass. Budgets are changed by the owner.

## Engineering constraints

- `antiky-town` is in scope for modification. It is also the only 2.3D artifact in the repository and
  the only demo with a real post pass, so treat a removal there as higher risk than the same removal
  elsewhere, and pair every one with a capture.
- Tests are required for code changes. When fixing a reported bug, write the regression test first,
  run it, watch it fail, then fix the code.
- Short one-line commit messages. No coauthor tags.
- Capture PNGs are **not** committed — `.antiky/` is gitignored, evidence retention is
  session-scoped and `*.png` is LFS here. The committed artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes.
- The framework is renderer-agnostic and platform-agnostic.
  `packages/framework/tests/import-boundary.test.mjs:6-13` forbids `brometal`, `node:`, `react` and
  `next` imports in framework source. This goal proposes no framework change; if one is discovered,
  it must respect that boundary or state where else it belongs.
- **Method lesson, carried forward:** a dead-code sweep must check **call sites, not type names**.
  `RelayOnboardingDependencies` greps as dead because
  `tests/onboarding-resources.test.ts:8-11` injects its fake through an `as unknown as` cast that
  never names the type. One finding was withdrawn for exactly this reason
  (`04-COMPLEXITY-REDUCTION.md:502-506`). A grep is a hypothesis, not evidence.

## Completion definition

The goal is complete when every knob in the thirteen-item inventory is deleted or re-derived with
its new value recorded, the ground-height equality test is committed and passing, the section C, D
and E removals are done with `tsc --noEmit` clean, the `antiky-town` inventory is committed and its
ungated removals are landed, and each of the four demos has a before/after capture pair with
committed metrics sidecars showing its visual budget still green.

**Five owner questions gate part of this work. Do not answer them yourself.** Stop and report on:

1. the 27 "ambience" filler instances in `point-light-expo` (`src/render-profile.ts:48-50`,
   populated at `relay-visuals.ts:222-235`, `:329-340`, `:424-437`) — delete, or deliberate set
   dressing;
2. per-instance `iTint` micro-variation on the catalog models — compensation, or authored art;
3. `markedScale` / `markedMinimumAlpha` (`combat-arena/src/combat-projection.ts:25-33`) — gameplay
   affordance, or contrast patch;
4. `RELAY_ONBOARDING_CUES.relayMarkerCounts` — was it meant to drive the relay identity markers,
   which today derive their count independently at `relay-visuals.ts:204-221`; and
5. `backgroundCompositionAt`'s ignored `_cameraX` parameter — it survives or dies with the parallax
   decision, so it is gated, not merely low priority.

A sixth question from that document is already answered and needs no owner time:
`tests/onboarding-resources.test.ts` does inject a fake overlay dependency, so the proposal to
delete that seam is withdrawn.
