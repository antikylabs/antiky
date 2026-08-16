# Execute goal 99: close the revisit register and route the remaining work

## Prerequisites

- [Goals 00 through 15](./) are complete. This goal needs their summaries because those
  results replace the assumptions in the original register.
- Goal 99 remains the final goal in this objective. If this goal identifies implementation that must
  stay in this objective, create a new numbered goal from 16 through 98 and complete it before Goal
  99. Do not put that implementation into this closeout goal.
- No other work may edit this file or `goals/README.md` at the same time. These two files are the
  owned-file lock for this goal.

### Needed from the owner before starting

| # | What | Why it needs you |
|---|---|---|
| 1 | Choose whether `traversal-study` must change its composition to meet its current value targets, or whether its targets must be re-derived for an open-horizon side-scroller. | This is an art-direction decision. An agent must not change either the approved frame or a visual budget to get a green test. |
| 2 | Choose whether the material-tone-map invariant applies only to Antiky demos, or whether the three framework-free BroMetal showcases must gain post-processing. | This decides whether U5 is a test-scope defect or product work. The current showcase fence is deliberate. |
| 3 | Decide whether `antiky-town` can change its meadow layout when its remaining sine hash moves to the framework hash. | The code change moves authored grass patches and invalidates the current distribution baseline. |
| 4 | Decide whether `antiky-town` must present a frame while its session is paused, stepped, or faulted. | The shared frame driver presents these frames, but the town's test enforces the old `ADVANCED`-only behaviour. |
| 5 | Decide whether concave ambient occlusion and fountain particles remain desired art work. | The convex-rock bake has poor value, while the remaining concave and fountain work is optional visual scope. |
| 6 | Authorise the two missing BroMetal pull requests and decide whether any general capability from closed PR #2 deserves a new focused pull request. | Opening pull requests changes external state. ADR 0021 requires one focused pull request for every local patch. |
| 7 | Give an explicit instruction before any edit to accepted ADR 0021. | The STE audit found real issues, but `docs/adr/AGENTS.md` forbids an agent from rewriting an accepted `_H` ADR only for conformance. |

## `/goal` objective

Close the historical register without turning it into a miscellaneous implementation goal. Verify
each prior deferral against the completed work, preserve its final disposition, and give every item
that is still current a durable home.

This goal applies the measurement critique in
`docs/objectives/scratch/demo-refining/12-VISUAL-METRICS-CRITIQUE.md:32-63`, the deterministic
capture protocol in `docs/objectives/scratch/demo-refining/07-TESTING-WITH-ANTIKY-MCP.md:137-152`,
the upstream contribution rule in `docs/objectives/scratch/demo-refining/06-WORK-PACKETS.md:138-171`,
the town work order in
`docs/objectives/scratch/demo-refining/13-ANTIKY-TOWN-COMPLEXITY.md:458-476`, and the visual work
and harness split in `docs/objectives/scratch/demo-refining/03-ART-DIRECTION-AND-VFX.md:936-994`.

The register below is the verified starting point from the 2026-08-16 audit. Recheck facts that can
change, such as package versions and pull-request states. Do not repeat investigations whose
evidence is immutable in a completed goal summary.

## Required outcome

When the work is complete, the repository must have:

1. `_completed/summary-goal-99.md`, with a final disposition and evidence for every original ID
   from A1 through G6 and every new N item below;
2. an owner decision recorded for each item in the owner table, without an agent choosing art
   direction, external publication, or accepted-record changes by implication;
3. a durable home for every applicable-now item: a new goal contract, a named active objective, or
   an explicit withdrawal approved by the owner;
4. every dormant item recorded with one observable trigger and one durable location;
5. `goals/README.md` showing goals 00 through 15 complete and Goal 99 as the only closeout goal;
6. the current test, visual-verification, dependency, pull-request, ADR-audit, and link states in the
   summary; and
7. Goal 99 and its summary moved together into `_completed/` only after no active item depends on
   this file as its sole record.

No original ID may disappear. A combined disposition is permitted only when the summary names every
ID in that group.

## Applicable now — route before closeout

These rows describe current work. Goal 99 decides and routes them. It does not implement them.

| IDs | Current evidence | Required route |
|---|---|---|
| A4 | `EngineSession.advance` still completes its fixed-step batch without a per-step observer. Three demos still document that limitation. | A framework goal for a per-step observation point, with tests for zero, one, and multiple completed steps. |
| A9, M15 | `scripts/shoot-demos.mjs` does not pause or step the simulation. It also cannot suppress scene geometry or apply the fixed camera offsets required by four Goal 08 criteria. | One capture-determinism goal. It must own the harness, re-shoot affected sidecars, and prove that repeated fixed-step captures are comparable. |
| A11 | BroMetal's published `mat4.perspective` still uses OpenGL clip-depth terms. `point-light-expo` carries the correct WebGPU form locally. | A focused BroMetal defect patch and upstream pull request, or evidence that the target release fixed it. |
| A13 | The convex-rock bake is not worth its measured 3.9% p10 change. The unresolved part is concave AO in `combat-arena` and `traversal-study`. | Withdraw the convex-rock work. Route the two concave cases only if the owner keeps them in visual scope. |
| A16 | The town fountain still uses solid spray geometry. Goal 08 recorded the unbuilt billboard-droplet and mist design. | A separate town-VFX goal if the owner keeps it; otherwise withdraw it explicitly. |
| M12 | `traversal-study` still fails its model-formation, p05, and dominant-hue targets under its current framing. | An owner-selected art goal or a measurement-contract goal. Do not combine both approaches without a new before/after baseline. |
| M13 | Frame-time, bloom-halo, vignette, and some shadow probes were not measured consistently across the carried render slice. | A bounded measurement follow-up after A9/M15 supplies deterministic controls. Name each missing probe; do not reopen all of Goal 08. |
| M16 | `packages/demos/tests/material-invariants.test.mjs` is outside the normal test scripts and fails four of seven direct tests because discovery, TypeScript loading, and old expectations have drifted. | A test-surface goal that repairs and registers live assertions, or moves them into `pipeline-invariants` and deletes the obsolete file. |
| U1 | BroMetal PRs #3 through #7 remain open. The Goal 15 patches `sampler-lod-clamp` and `texture-array-sampler` have no pull-request URL. | Keep open patches. With owner authorisation, open one focused PR for each Goal 15 contribution and record its retirement steps. |
| U2 | BroMetal PR #2 is closed without merge. Its orthographic matrix, shader-language helpers, instance-count convenience, and sprite demos did not all move into focused PRs. | Triage each capability against ADR 0021. Upstream only general renderer capabilities or defect fixes; withdraw Antiky convenience work. |
| U3 | The repository pins BroMetal 0.17.2. A newer published version existed at audit time. | Run the BroMetal `update` workflow against the latest version, recheck every patch target and PR, and retire only fixes present in that release. |
| U5 | Three framework-free BroMetal demos still tone-map in material shaders, so the global invariant remains red. | Apply the owner's scope decision from owner item 2. Do not add framework dependencies to showcase demos as a test workaround. |
| R1 | The automated STE audit of ADR 0021 reported 37 errors, 11 warnings, and 6 informational findings. Some are parser noise, but several vocabulary and sentence-length findings are real. | Preserve the audit result. Change the accepted ADR only after explicit owner instruction and the ADR revision workflow. |
| G2 | `antiky-town` still has one sine-based positional hash. Replacing it moves 74 meadow patch centres. | A town-art goal after owner item 3, including a re-derived behavioural distribution test and a capture. |
| G3 | The town still renders only for `ADVANCED`, while the shared frame-driver behaviour and three other demos present non-advanced frames. | A small behaviour goal after owner item 4, with a failing test written against the selected behaviour first. |
| G4 | `demoSources(slug)` still ignores `slug`, while its caller passes one and scans the full demo set twice. | A small regression fix in the next goal that owns `packages/demos/tests/pipeline-invariants.test.mjs`. |
| N1 | `packages/demos/antiky/antiky-town/src/town/index.ts` is approximately 1,244 lines. Goal 09 unblocked decomposition, and Goal 12 left it as follow-up debt. | A town-cohesion goal that first replaces source-text test fences with behavioural protection, then splits by scene configuration, pipeline construction, and frame submission. |

## Dormant — preserve the trigger, do not open work now

| IDs | Present trigger and durable home |
|---|---|
| A1 | Revisit measurement-module promotion only when a second consumer exists, an MCP consumer needs it, or the metrics survive another target revision. Keep it in the objective archive and `docs/objectives/ideas/executable-requirement-contracts.md`. |
| A2 | Revisit executable requirement contracts only when visual, motion, and simulation contracts all exist and converge on one shape. Two kinds are not enough evidence. |
| A5 | Revisit shared sun/fog bindings when a demo varies them at runtime. Literal agreement remains the smaller design today. |
| A8 | Revisit `rock-boulder-dry` when a new town-material pass can resolve its effect or directly needs that material. Do not touch the town only to consume an installed receipt. |
| A10 | Revisit `point-light-expo/src/renderer.ts` when it crosses 500 lines or a cohesion problem appears. It is approximately 462 lines after its shadow-pass split. |
| A14 | Revisit `edges.hard` when it produces a false result under a lighting-only change. Preserve its documented contrast confound until then. |
| M2 | Add visual targets to the five remaining non-Antiky demos only when one receives a stated reference look. `town-study` is retired, so the old count of six is obsolete. |
| M3 | Build another motion representation only when P1 through P3 leave a named diagnostic gap for a real consumer. |
| M4 | Revisit the 30 fps sequence limit only for a pixel-only defect above its approximately 15 Hz Nyquist limit that simulation evidence cannot resolve. |
| M6 | Revisit the 14.7% Glass Garden poster difference during the next poster-master refresh. |
| M11 | Strengthen the visual-metrics seal only if the threat model expands from accidental edits to a motivated editor. |
| S2 | Write a measurement-tooling skill only after traversal targets and missing probes are settled. Do not teach unstable contracts. |
| S3 | The skill-library implementation plan stays in `docs/objectives/scratch/skill-research/` and follows its own schedule. |
| G6 | Revisit the framework's BroMetal dependency if the framework is published or a headless consumer cannot accept the optional render-driver subpath. |
| N2 | Revisit traversal's ignored `_cameraX` parallax input and unused shader uniforms when the next traversal camera or shader goal owns those files. |
| N3 | Keep `texture-array-sampler.mjs` as one contribution even though it is approximately 714 lines. Revisit only if the upstream contribution itself splits; one patch module must still map to one pull request. |
| N4 | Revisit Goal 15's hand-written layer URL list and test-only `atlasGridUniform` when the atlas layer set changes or a replacement validator exists. |

## Resolved baseline — record, then take no new action

| IDs | Final disposition and evidence |
|---|---|
| A3, G5 | **Closed.** Goal 12 moved `point-light-expo` and `antiky-town` onto `BroMetalRenderDriver`, including the required 2.3D evidence. See [`summary-goal-12.md`](summary-goal-12.md). |
| A6, M1, M9, M14 | **Closed as a general budget dispute.** The owner-approved town floor is 7.5 and is green. The one remaining demo-specific decision is M12. |
| A7 | **Withdrawn.** Goal 04 showed that the Quaternius courier uses authored palette/material colour; the asset pipeline did not destroy a rich character texture. See [`summary-goal-04.md`](summary-goal-04.md). |
| A12 | **Closed.** Goal 06-04 measured peter-panning at 0.47 px and bounded frame-time impact. See [`summary-goal-06-04.md`](summary-goal-06-04.md). |
| A15 | **Closed.** `sourceDigest` includes shared demo scripts by design; no build-output bug exists. See [`summary-goal-06-05.md`](summary-goal-06-05.md). |
| M5 | **Closed.** The town's separate foliage sun was measured and retained because unifying it damaged the canopy. |
| M7 | **Withdrawn as work; retained as a finding.** A metric moving in the preferred direction does not prove a visual improvement. |
| M8 | **Withdrawn.** The proposed 3x normal-map target was not calibrated and the completed material work did not validate it. |
| M10 | **Closed.** Test discovery was widened and the retired `town-study` colour defects no longer represent active work. |
| U4 | **Closed.** Goals 14 and 15 reduced the atlas boundary measurement to zero. See [`summary-goal-14.md`](summary-goal-14.md) and [`summary-goal-15.md`](summary-goal-15.md). |
| R2 | **Closed.** Studio ADR 0007 now points readers to ADR 0021 for the framework-plus-BroMetal case. |
| R3 | **Closed at `Emerging`.** Two of four Antiky demos use the driver. The public claim is accurate and must not move to `Current` without broader evidence. |
| R4 | **Closed as the Goal 09 umbrella.** Its five questions were disposed. The surviving parallax detail is dormant N2, and the shared scope bug is active G4. |
| S1 | **Closed.** `.agents/skills/team-brometal/` now carries the patch, PR, update, and retirement workflow. |
| G1 | **Closed.** The owner retired `town-study`; no shared-town-code placement decision remains. |

## In scope

- **Reconcile the register.** Re-run only the evidence that can change. Compare every original ID and
  N item with the tables above, then put its final disposition in `summary-goal-99.md`.
- **Record owner decisions.** Put each answer beside the affected IDs. If an answer creates work,
  use the objective workflow to give that work a goal contract derived from an existing plan source.
- **Repair the objective index.** Keep `goals/README.md` accurate, point all completed-goal links
  into `_completed/`, and remove claims that Goals 12, 14, or 15 remain unfinished.
- **Route current work.** An active row can live in a new goal in this objective, a named separate
  objective, or an owner-approved withdrawal. “Later” and “backlog” without a path are not homes.
- **Preserve history.** Do not edit completed goal files or summaries. Cite them as evidence.

## Required tests and evidence

At minimum, prove:

- `npm test` exits zero;
- `npm run demos:verify` reports its exact state, and every failure maps to M12 or U5 unless a new
  failure is investigated and routed;
- `node --test packages/demos/tests/material-invariants.test.mjs` records the current M16 state;
- each module in `scripts/patch-brometal/` has an open pull-request URL or is named explicitly as an
  ADR 0021 violation in U1;
- every BroMetal pull request in U1 and U2 has a freshly checked state, and the latest published
  BroMetal version is recorded before U3 is routed;
- the STE linter result for ADR 0021 is recorded separately from the human judgment required by
  `docs/adr/AGENTS.md`;
- every relative Markdown link in this file and `goals/README.md` resolves;
- the final summary contains each of `A1` through `A16`, `M1` through `M16`, `U1` through `U5`,
  `R1` through `R4`, `S1` through `S3`, `G1` through `G6`, and `N1` through `N4`; and
- `git diff --check` reports no whitespace errors.

## Explicit non-goals

- Do not implement any active row inside Goal 99. Cut a bounded goal or route it elsewhere.
- Do not change visual targets, scene composition, RNG-authored layout, or paused-frame behaviour
  without the corresponding owner decision.
- Do not edit accepted ADR 0021 without explicit owner instruction and the ADR revision workflow.
- Do not open, close, or comment on an upstream pull request without owner authorisation.
- Do not upgrade BroMetal as an incidental part of the register audit. U3 requires the full update
  workflow and its own reviewable commits.
- Do not promote measurement code or write a measurement skill while A1, A2, and S2 remain dormant.
- Do not reopen or rewrite a completed goal to make its original prediction match the result.
- Do not modify code merely to make `demos:verify` or the direct M16 test green during this goal.

## Engineering constraints

- This is a documentation-only goal. If code must change, stop and cut a separate goal with failing
  tests first, as required by `AGENTS.md`.
- Use the `team-brometal` workflow for U1 through U3. Do not weaken a patch guard or retire a patch
  because a pull request is merged but unreleased.
- Use the ADR workflow and the Simplified Technical English skill if the owner authorises R1 work.
- Use short one-line commit messages and no coauthor tags.
- Preserve unrelated dirty worktree changes.
- Keep one durable record per item. Do not copy an active item into several backlogs with different
  triggers.

## Completion definition

The goal is complete only when all owner decisions are recorded, every original and new register ID
has evidence and a final disposition, every applicable item has a durable home, every dormant item
has one observable trigger, the objective index and links are accurate, the required verification
states are recorded, and Goal 99 plus its summary are together in `_completed/`.

If an owner decision is missing, a current failure cannot be reproduced, an external action is not
authorised, or an active item has no acceptable home, stop and report that exact blocker. Do not
invent a decision or mark the register closed to make the objective look complete.

## Amendment note

Rewritten on 2026-08-16 after Goals 12, 14, and 15 completed. The earlier register mixed resolved
history, dormant triggers, and current implementation work; it also contained stale links and one
malformed A8/S3 row. This version preserves every original ID, adds the unregistered N items found
in the completed summaries, and limits Goal 99 to closeout and routing.
