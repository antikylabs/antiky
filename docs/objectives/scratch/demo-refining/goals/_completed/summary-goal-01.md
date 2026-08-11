# Summary — goal 01: build the verification loop that every later goal is measured against

**Completed:** 2026-08-11
**Commits:** `93f18ab`, `e2d3962`, `bbc89ef`, `e1ebf4e`, `905ba24`
**Goal file:** [`execute-goal-01.md`](execute-goal-01.md)

## Action needed from the owner

Two items. Neither blocks starting goals 02, 03, 04 or 10.

| # | What | Why it needs you | Blocks |
|---|---|---|---|
| 1 | **Approve or adjust the visual budget bounds.** They are in the four `packages/demos/antiky/*/tests/visual-budget.test.mjs` files. | The 13 currently-failing assertions are gated on numbers I chose, not on your art direction. They are deliberately reachable but not trivial. If a demo eventually lands a look you are happy with and its budget still fails, **the budget is wrong** — and it should be changed by you, not by the agent that is failing it. | Judging goals 06 and 07 as done |
| 2 | **Decide whether motion capture gets unblocked.** `capture_gameplay_sequence` was not touched; only still capture was. | Goal 03 rebuilds the camera shake you reported. Shake cannot be judged from a still frame. Either goal 03 gets a motion measurement path first, or it ships on a still-frame proxy plus your eyes. That is a scope call. | Verifying goal 03's shake fix |

**No bug in this summary needs you.** All three found during the work were fixed inside the goal
and are covered by tests. They are recorded below because they are traps worth knowing about, not
because anything is outstanding.

## The headline

The demos can now be measured, and the first measurement confirms the audit outright.

| Demo | Luminance spread | p95 | Clipped high | Saturation |
|---|---|---|---|---|
| glass-garden (three.js) | **0.830** | 0.838 | 1.51% | 0.313 |
| antiky-town | 0.342 | 0.370 | 0.00% | 0.315 |
| town-study | 0.342 | 0.370 | 0.00% | 0.314 |
| traversal-study | 0.278 | 0.386 | 0.00% | 0.435 |
| luminous-reef | 0.158 | 0.160 | 0.00% | 0.964 |
| solar-forge | 0.153 | 0.153 | 0.83% | 0.796 |
| shader-study | 0.107 | 0.108 | 0.00% | 0.879 |
| **point-light-expo** | **0.090** | 0.094 | 0.09% | 0.414 |
| **combat-arena** | **0.085** | 0.085 | 0.13% | 0.688 |
| orbital-atlas | 0.062 | 0.063 | 2.52% | 0.879 |

Values are linear light, 0 to 1. Spread is p95 minus p05.

Three things fall out of this table:

1. **The two demos commissioned against AAA references sit at the bottom.** `point-light-expo` and
   `combat-arena` have less value range than the small procedural shader studies. This is the
   audit's central claim — "no value structure" — as a number.
2. **`glass-garden` has 9.8× the luminance spread of `combat-arena`.** The three.js demo gets PBR,
   IBL and bloom from its engine for free. That is the damaging comparison the audit predicted,
   now measured rather than asserted. Note its 1.51% high clipping: it is wide *and* somewhat blown,
   which matches the poster/runtime mismatch already recorded.
3. **`antiky-town` and `town-study` report identical numbers to three decimal places.** They are
   near-copies, which independently confirms the duplicated-code finding from a completely
   different direction.

## What changed

| Artifact | Change |
|---|---|
| `packages/cli/src/host/actions.ts` | Capture actions get their own budget, separate from the interactive action budget. |
| `packages/cli/src/host/session.ts` | `captureActionTimeoutMilliseconds` threaded through session options. |
| `packages/cli/tests/actions.test.ts` | Two regression tests for the budget split, written before the fix. |
| `scripts/frame-stats.mjs` + test | Luminance percentiles, clipping, saturation, named probes. GPU-free. |
| `scripts/shoot-demos.mjs` + test | Drives the capture MCP, serially, with the fence-retry sequence. |
| `scripts/dev.mjs` | `combat-arena` and `traversal-study` added; they could not be started before. |
| `scripts/repository-policy.test.mjs` | Allowlists updated; the dead published-skills test removed. |
| `packages/demos/*/*/visual-metrics.json` | Committed baseline for all ten demos. |
| `packages/demos/antiky/*/tests/visual-budget.test.mjs` | Four per-demo budgets, failing on purpose. |
| `packages/demos/tests/pipeline-invariants.test.mjs` | Five source-level invariants, failing on purpose. |

## Two test suites, on purpose

- **`npm test` is green** and stays the regression gate.
- **`npm run demos:verify` is red** — 8 pass, 13 fail — and is the target tracker.

The budgets and invariants encode defects that goals 03, 04, 06 and 07 remove. They must fail now,
or they measure nothing. Putting them in `npm test` would make the regression gate permanently red
and therefore useless, so they live in their own command. Neither is picked up by the demo
workspaces' `tests/*.test.ts` globs, which is why `npm test` stays clean.

The 13 failures are specific: **spread and highlights fail on all four antiky demos; clipping and
saturation already pass.** That is a precise statement of what is wrong — value structure, not
colour and not exposure.

## Evidence

- **W0.1:** `capture_frame` succeeds at `warmUpFrames: 60` on `point-light-expo`, `combat-arena`
  and `traversal-study`, three consecutive runs each, with no `ANTIKY_ACTION_TIMEOUT`. All ten
  demos captured successfully at least once.
- **W0.1b:** `npm test` exits 0 with zero failures, and the workspace suites now actually run — the
  `&&` chain had been short-circuiting before the failing test, so ~500 tests behind it had not
  executed in this session. They were all green.
- **W0.2b:** 8 unit tests over synthetic images with known histograms. No GPU, no demo.
- **W0.2:** Serial capture, blank-frame guard, metrics sidecars. 9 unit tests covering slug
  resolution, fence assembly, evidence path layout and metrics computation.

## Decisions taken during the goal

1. **The dead `skills/` test was deleted** rather than the directory restored. Owner decision. It
   encodes that the repository no longer publishes skills from root.

## Three bugs found while building the harness — all fixed in this goal, none need action

1. **`npm run antiky -- tool <name> <json>` cannot be parsed by a script.** npm echoes the resolved
   command line, which contains the input JSON, so a reader scanning for the first `{` parses the
   input it just sent. Tools with no input argument happen to work, which makes this easy to miss.
   `shoot-demos.mjs` invokes `packages/cli/src/bin.ts` directly instead.
2. **`webGpu.status` is `unknown-until-launch` until a managed browser has started.** Treating
   anything other than `available` as failure rejects every first capture in a session.
3. **A first invariant passed while its defect was present.** The UV test matched a bare mention of
   `TEXCOORD_0`, and `normalize-quaternius.mjs` mentions it at line 328 where it *writes* the output
   attribute map. Tightened to require `attributes.TEXCOORD_0`, an actual read. A test that
   green-lights a live defect is worse than no test, and this one was caught only because the
   expected-failing suite reported an unexpected pass.

## Outstanding

Each item is either assigned to a later goal or listed in **Action needed** above. Nothing is
unassigned.

| Item | Disposition |
|---|---|
| `capture_gameplay_sequence` untouched, so motion and feel have no measurement path | **Needs owner** — item 2 above |
| Visual budget bounds are unapproved | **Needs owner** — item 1 above |
| The blank-frame guard has not fired on real data. Every live capture rendered; the three committed blank-white three.js captures are stale artifacts of a capture-timing bug, not a current render failure | **Goal 10** removes them. No action. |
| Budgets exist only for the four antiky demos. The other six have committed metrics but no authored bounds | **No action.** The six are not targeted against a reference look. Add bounds if that changes. |
