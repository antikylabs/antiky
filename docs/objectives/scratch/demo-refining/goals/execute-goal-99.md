# Execute goal 99: the revisit register — check the things we deliberately deferred

## Prerequisites

- Every other goal in this sequence is in `_completed/`. This one runs **last**, on purpose.
- Numbered `99` rather than `14` so new goals can be added as `14`, `15`, … without ever
  renumbering the one that has to stay at the end.

## `/goal` objective

Revisit every decision this objective deliberately deferred, and either close it or record why it
stays open.

**This goal is a register, not a plan.** It exists because a long objective accumulates choices
that were correct at the time and are worth re-examining once everything has landed — a staging
location, an unvalidated threshold, a patch waiting on someone else's merge. Left implicit, those
quietly become permanent. Written down with a trigger, they get a decision.

**Add to it as you go.** Any goal that defers something should append a row rather than trusting
that someone will remember. A row costs a line; a forgotten deferral costs a rewrite.

## Required outcome

When the work is complete, every row in the register below has one of three dispositions recorded
against it:

1. **Closed** — done, with the commit;
2. **Still open, deliberately** — with a restated trigger and where it now lives;
3. **Withdrawn** — the idea was wrong, with the finding recorded rather than the row deleted.

No row may be silently dropped. A register that shrinks without explanation is worse than none.

## The register

### Architecture and placement

| # | Item | Why deferred | Trigger to revisit |
|---|---|---|---|
| A1 | **Promote `frame-stats.mjs` and `motion-stats.mjs` from `scripts/` into the CLI inspection library.** They are pure functions staged in the wrong place on purpose. | The headline metric was already replaced once (`luminanceSpread` → `localContrastMedian`); promoting an unproven measurement behind an MCP tool would have versioned a mistake. | A second consumer outside this repository, an agent needing them through MCP (`get_motion_report`), or the budgets surviving goals 06–07 without another threshold rewrite. Detail in [`../../../ideas/executable-requirement-contracts.md`](../../../ideas/executable-requirement-contracts.md). Check `packages/cli/tests/development-import-boundary.test.mjs` first — `sharp` is a native module. |
| A2 | **Executable requirement contracts.** Binding an owner's stated intent to a test an agent must satisfy. | One hand-written contract kind is not a pattern. `GOOD_ENGINEERING_H.md` on premature abstraction. | Three hand-written contract kinds exist — visual budget, motion assertion, simulation invariant — and they converge on a shape. |
| A4 | **A per-step hook on `EngineSession`.** `advance` runs its whole batch of fixed steps with no way to observe each one, so three demos can only interpolate exactly when a frame ran exactly one step. `antiky-town`'s character motor shows the correct form. | Goal 03 needed it and worked around it; the framework is goal 11's tree, not goal 03's. | Goal 11. Detail in [`_completed/summary-goal-03.md`](_completed/summary-goal-03.md). |
| A5 | **A shared sun/fog uniform per demo.** BroMetal's MVP cannot read a module-level constant from a shader body, so goal 03 used agreed literals guarded by `pipeline-invariants.test.mjs`. | Three lines of duplication against machinery for a runtime-varying sun nobody asked for. | The first demo that wants a sun that changes at runtime - a day cycle, a lighting transition. Also a candidate upstream BroMetal request. |
| A6 | `antiky-town`'s local-contrast floor sits inside the capture noise — 8.50/8.50/8.46 on identical code against a 8.5 floor | When `demos:shoot` steps a paused simulation, or when the owner adjusts the floor | goal 05 |
| A7 | `courier.glb` and its Quaternius siblings are reduced to 91-byte textures by goal 04's pipeline | Before any further material work on `traversal-study`'s characters | goal 05 |
| A8 | `rock-boulder-dry` is installed and receipted for `antiky-town` but unused — its effect was inside the noise floor | When the capture instrument can resolve better than 0.05 local contrast | goal 05 || S3 | **The skill-library implementation plan** in `../../skill-research/`. | A parallel track, not a dependency of this objective. | Its own schedule. |
| A9 | **`demos:shoot` never pins the simulation.** It fences on build and runtime revision, then waits `warmUpFrames` — it never calls `pause_simulation` / `step_simulation`, which goal 06's own capture protocol specifies. About 2.2% of point-light-expo's frame moves between two captures of identical code, so no before/after comparison can attribute a change to an animated object. | Fixing it re-shoots every demo and rewrites every committed sidecar, which is a repository-wide change of evidence, and goal 06-03 was scoped to one demo. Whole-frame comparisons remain sound without it. | **Goal 06-04**, which wants per-object evidence for a shadow map. Row A6 is the same defect seen from `antiky-town`'s side and closes with this one. Numbers in [`_completed/summary-goal-06-03.md`](_completed/summary-goal-06-03.md). |
| A10 | **`point-light-expo/src/renderer.ts` is at 446 lines and still growing.** 06-04 adds a shadow pass and 06-06 a bloom chain. | `GOOD_ENGINEERING_H.md` wants a cohesion review at 500 and decomposition by 800, and splitting mid-goal would have broken 06-02's invariance comparison. | When it crosses 500, which 06-04 is likely to do. Split by responsibility, not to satisfy the count. |
| A11 | **BroMetal's `mat4.perspective` emits OpenGL clip depth.** `m[10] = (far + near) / (near - far)` puts the near plane at `z = -w`, but WebGPU clips at `0 <= z <= w`, so the near half of every frustum built with it is discarded before it is drawn. `createCamera` uses it, so this is every demo. | Invisible at near 0.1 / far 1000 — depth crosses zero at 0.2 world units. It cost goal 06-04's shadow frustum **27%**, and was fixed inside that demo because the goal was scoped to one demo. | An upstream BroMetal patch, in the shape of `scripts/patch-brometal/`. The correct terms are `m[10] = far / (near - far)` and `m[14] = far * near / (near - far)`; the working version and its regression test are in `point-light-expo/src/sun.ts` and `tests/sun.test.ts`. Until then every BroMetal camera spends half its depth range on clipped geometry. |
| A12 | **CLOSED — goal 06-04's two missing measurements were taken.** Peter-panning measures **0.47 px** against a 4 px bar, and frame time shows no measurable increase. | The first peter-panning metric was invalid: halving the bias moved it not at all. It was replaced with an aggregate one — boundary shift equals area change over perimeter, at two known biases — which needs no pixel-scale conversion and does respond. | Closed. The lesson is the row: **vary the cause and check the number responds** before trusting a measurement. Frame time is bounded rather than resolved, because the runtime is capped at the display refresh; that limit is stated in [`summary-goal-06-04.md`](_completed/summary-goal-06-04.md). |
| A13 | **The rock models have no ambient occlusion, and the bake that would give them some is written but not wired.** `rock-moss`'s material image is one greyscale channel replicated across RGB — roughness, with no occlusion in it — so the shader gives those rocks `occlusion = 1`. | Adding the vertex attribute blanked the scene. Two causes were checked and eliminated (vertex counts match; BroMetal does support a single-float vertex attribute). It was reverted rather than debugged further because the baked rock measures only **3.9% darker at p10** — a set of convex boulders has little to occlude — and a build step plus 11 KB of data for a 4% effect is a poor trade. | Any concave static asset, or a decision that the rocks' deepest crevices (45%) are worth it. The tool is at `packages/demos/scripts/bake-vertex-occlusion.mjs`, deterministic and tested against shapes whose answer is known by inspection. Detail in [`summary-goal-06-05.md`](_completed/summary-goal-06-05.md). |
| A14 | **`edges.hard` is confounded by scene contrast.** Re-derived twice for the same reason — 0.0085 to 0.0095 in 06-04, 0.0095 to 0.0115 in 06-06 — because a brighter or more contrasty frame has more neighbouring pixels separated by a quarter of the range, whatever their edges are made of. | Both rises were separated by evidence rather than assumed, and the metric still catches what it was built for: losing multisampling moved it 0.0068 to 0.0103 with the scene otherwise identical. | Goal 07, which carries this pipeline to three more demos and will hit the same confound three more times. A contrast-invariant formulation — normalising each step by the local dynamic range — would stop the ceiling needing re-derivation per lighting change. |
| A15 | **CLOSED — misdiagnosed. `sourceDigest` was working as designed.** It walks the shared `packages/demos/scripts` directory on purpose, because a change there can alter what every capture shows. Goal 06-05 added `bake-vertex-occlusion.mjs` to that directory, which correctly invalidated all ten demos' sidecars at once. | The symptom — three demos going stale with no tracked change of their own — looked like the digest hashing build output, and it was registered on that guess without reading the walk. | Closed. Two things worth keeping: the digest is **wider than one demo folder** by design, so any shared-script change means a re-shoot; and adding an unused build tool to that folder invalidates every capture, which is over-broad but is the safe direction to err in. If it becomes a nuisance, narrow the walk to scripts the demos actually import. |
| A3 | **`BroMetalRenderDriver` needs 2.3D evidence.** Goal 12 extracts it from 3D demos. | ADR 0004 gives 2D, 3D and 2.3D equal support; a driver promoted on 3D-only evidence runs against it. | Goal 12. `antiky-town` is the only 2.3D artifact and is now in scope, so this is closeable. |

### Measurement not yet validated

| # | Item | Why deferred | Trigger to revisit |
|---|---|---|---|
| M1 | **The visual budget thresholds are the agent's proposal, not the owner's art direction.** Local contrast floor of 8.5, clipping ceiling of 2%. | 8.5 is defensible — `antiky-town` already clears it — but it is not a stated look. | After goals 06–08. **If a demo lands a look the owner is happy with and its budget still fails, the budget is wrong.** Changed by the owner, never by the agent failing it. |
| M5 | **CLOSED — `antiky-town`'s foliage sun is load-bearing.** The owner confirmed nobody authored it deliberately, so it was unified onto `SUN_COLOR` at 2.65 and captured. The canopy turned yellow: a strongly orange key clips green leaves' red channel first, changing 8.3% of the frame. `SUN_COLOR` at 1.05 avoids the clip but drains the greens. Reverted, with the measurement written beside the values. | — | Closed. The reported "horrid" trees are a geometry and texture problem (flat alpha cards), not a lighting one — that belongs to the foliage and art-direction goals. |
| M10 | **`town-study` shipped with no sRGB decode at all**, sampling an atlas byte-identical to `antiky-town`'s while its twin decoded it. Found only when test discovery widened past the `antiky` category. Fixed, along with the same 563:1 camera goal 03 corrected in its twin. | The invariants defaulted to one of three demo categories, so 16 of 44 shipped shaders were checked by nothing. | Closed. The lesson is the row: **a default argument scoped the entire verification surface**, and nothing said so. |
| M11 | **The visual-metrics seal stops carelessness, not intent.** Re-sealing an edited number is one call to an exported function. | Closing it needs a committed capture to recompute from, and `repository-policy.test.mjs` forbids tracking capture evidence. | Only if measurements ever need to be trustworthy against a motivated editor. The fix is a trusted capture step, not a longer hash. The boundary is written at `sealMetrics`. |
| M9 | **`antiky-town` still misses the 8.5 local-contrast floor at 7.98 after its exposure was re-derived.** Reaching 8.67 needs exposure 1.8, which puts the median frame luminance 29% above what the scene was authored at. | Clearing the floor would mean over-brightening the town to satisfy a threshold the agent proposed. | This is M1. The owner decides whether 8.5 is the right floor for a golden-hour scene, or whether the town's look is right and the number is wrong. |
| M8 | **The normal-map probe target of 3x is not calibrated.** Goal 04 measured 1.46x on lit rock with a 0.000 noise floor, flat across triplanar scales 0.55-9.0. | The implementation is correct and the number is not reachable in that scene; lowering it to pass would have been fitting the target to the result. | Whoever sets budgets for goals 06-08. Either the probe needs a surface where the normal dominates, or the threshold needs deriving from a measurement. |
| M7 | **A metric can move the wrong way.** The yellow canopy measured *higher* local contrast (9.25 against 8.63) while looking clearly worse. | Found while testing M5, and again in goal 04: the sRGB decode cost `antiky-town` 1.4 of local contrast while visibly improving the frame. | Feeds M1: a budget number rising is not on its own evidence that a change helped. Look at the frame. |
| M6 | **Glass Garden's poster master is 14.7% brighter than a fresh runtime capture**, against a 10% budget. Clipping is within budget on both by ~200x. | The scene animates, so two frames differ by design; closing it means recapturing a 2560x1440 master, which is a media task. | Any poster refresh. Numbers in `packages/demos/threejs/glass-garden/poster-parity.json`. |
| M2 | **Budgets exist only for the four antiky demos.** The other six have committed metrics and no bounds. | They are not targeted against a reference look. | If any of the six gets a stated visual target. |
| M3 | **Motion proposals P4–P7 not built** — contact sheets, presentation frame ring, `get_motion_report`, spatiotemporal slice. | Explicit non-goals of goal 13. `get_motion_report` is ranked last and only after P1–P5. | When P1–P3 have been used in anger and a specific gap is felt, not before. |
| M4 | **The 30 fps sequence-capture cap is a hard Nyquist wall** above ~15 Hz. Judder is invisible to the capture path. | Judder is measured from the simulation instead, which P1 does. | Only if a defect appears that the simulation cannot see. Raising the cap is not obviously worth it. |

### Upstream and dependencies

| # | Item | Why deferred | Trigger to revisit |
|---|---|---|---|
| U1 | **Retire local patches as their PRs land.** [#3](https://github.com/ericdrowell/brometal/pull/3)–[#7](https://github.com/ericdrowell/brometal/pull/7). | Not ours to schedule. | Each merge or release. Every module in `scripts/patch-brometal/` names its PR and the three places to edit. |
| U2 | **PR #2 will be closed** in favour of the focused PRs. | Owner's call, and it carries work the five PRs do not: `mat4.orthographic`, `Swizzles<C>`, component-wise intrinsics, `draw({ instanceCount })`, and four sprite demos. | When #2 closes, decide whether any of that unmerged work is worth its own PR. |
| U4 | **Atlas tile bleeding, and the BroMetal capability behind it.** Measured at 25.3% of samples taken across a tile boundary in `antiky-town`'s material atlas. | Split on a rule: asset packing and measurement are Antiky ([goal 14](execute-goal-14.md)), array textures and mip clamping are BroMetal ([goal 15](execute-goal-15.md)). | Both goals. Close this row when the measurement reads zero rather than "under budget". |
| U3 | **BroMetal version guard is pinned to 0.17.2.** | A version bump is a separate reviewed change. | Any upgrade. All 19 patch targets must be re-checked; the last upgrade also silently changed dependency placement. |

### Records

| # | Item | Why deferred | Trigger to revisit |
|---|---|---|---|
| R1 | **ASD-STE100 Issue 9 audit of ADR 0021, and four flagged terms.** | `docs/adr/AGENTS.md` forbids an agent claiming compliance without reading the standard, which was not read. | Owner, with the standard. Blocks nothing. |
| R2 | **`studio/0007` may want a clarification** pointing at 0021 for the framework-plus-BroMetal case. | Done — clarification added in goal 00. Kept here only to confirm it still reads correctly once a driver exists. | Goal 12. |
| R3 | **`PRODUCT.md` and three website pages** described a `RenderDriver` that does not exist. Corrected to Direction. | Corrected in goal 00. | When the driver ships, they move from Direction to Current. |
| R4 | **Five open questions in `04-COMPLEXITY-REDUCTION.md`** were left unanswered rather than guessed. | They need owner intent about ambience filler, tint variation, `markedScale` and `relayMarkerCounts`. | Goal 09. |

### Skills and knowledge

| # | Item | Why deferred | Trigger to revisit |
|---|---|---|---|
| S1 | **`docs/objectives/ideas/skill-text.md` → a real skill.** Patching a dependency and upstreaming the fix. | Written from doing it once, across five PRs. | Owner intends to turn it into a skill. Worth a second run first to see what generalises. |
| S2 | **Skills teaching agents to use the measurement tooling** — `demos:shoot`, `frame-stats`, `motion-stats`, `demos:verify`, and how to read a budget failure. | The tooling is days old and one metric has already been replaced. A skill teaching a wrong measurement is worse than none. | After goals 06–08, when the budgets have survived a real render slice. See [`../../../ideas/agent-legible-quality-measurement.md`](../../../ideas/agent-legible-quality-measurement.md). |


## In scope

- Walk every row. For each, state the disposition and the evidence.
- Where a row closes, do the work if it is small, or open a goal if it is not.
- Where a row stays open, restate the trigger in present tense and say where it now lives, so this
  file does not become the only thing holding it.
- Add rows discovered while walking the register. Finding a deferral nobody recorded is a result.

## Required tests and evidence

- `npm test` green.
- `npm run demos:verify` reports its state, and every remaining failure is explained — either it is
  a target not yet reached, or it is a row in this register.
- Every local patch still under `scripts/patch-brometal/` names an open, unmerged PR. A patch whose
  PR merged is a defect this goal catches.
- Every link in this file resolves.

## Explicit non-goals

- Do not use this goal to do deferred work that deserves its own goal. Deciding is the job here;
  a row that needs a week of work becomes a new goal, not a task inside this one.
- Do not delete a row to make the register look finished.
- Do not change a visual budget threshold. That is M1, and it is the owner's.
- Do not promote `frame-stats`/`motion-stats` on the strength of this goal alone. A1 has a trigger;
  check whether it fired.

## Engineering constraints

- Tests are required for code changes (`AGENTS.md`).
- Short one-line commit messages. No coauthor tags.
- Preserve unrelated dirty worktree changes.
- If a row's trigger has not fired, leaving it open is the correct outcome, not a failure.

## Completion definition

Complete when every row has a recorded disposition, any row that closed has its commit, any row
still open has a restated trigger, and the summary lists what is genuinely left over for the owner.

If walking the register turns up more work than it closes, that is a successful run of this goal.
Say so plainly rather than presenting a tidy list.
