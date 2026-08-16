# Summary — goal 01: build the verification loop that every later goal is measured against

**Completed:** 2026-08-11
**Commits:** `93f18ab`, `e2d3962`, `bbc89ef`, `e1ebf4e`, `905ba24`
**Goal file:** [`execute-goal-01.md`](execute-goal-01.md)

## Action needed from the owner

Two items. Neither blocks starting goals 02, 03, 04 or 10.

| # | What | Why it needs you | Blocks |
|---|---|---|---|
| 1 | **Approve or adjust the visual budget bounds.** They are in the four `packages/demos/antiky/*/tests/visual-budget.test.mjs` files. | The failing assertions are gated on a floor I chose (local contrast 8.5). It is defensible — `antiky-town` already clears it — but it is not your art direction. If a demo eventually lands a look you are happy with and its budget still fails, **the budget is wrong** — and it should be changed by you, not by the agent that is failing it. | Judging goals 06 and 07 as done |
| 2 | ~~**Decide whether motion capture gets unblocked.**~~ **ANSWERED 2026-08-11: yes.** Motion capture is wanted as part of the inspection tooling. Research is in [`../../11-MOTION-INSPECTION-RESEARCH.md`](../../11-MOTION-INSPECTION-RESEARCH.md), and it becomes a goal of its own rather than being folded into goal 03. | — | Resolved |

**No bug in this summary needs you.** All three found during the work were fixed inside the goal
and are covered by tests. They are recorded below because they are traps worth knowing about, not
because anything is outstanding.

## Correction — the first version of this measurement was wrong

**Superseded 2026-08-11 by the critique in [`../../12-VISUAL-METRICS-CRITIQUE.md`](../../12-VISUAL-METRICS-CRITIQUE.md), and fixed.**

The metric this summary originally led with, `luminanceSpread` (p95 minus p05 in linear light),
does not measure contrast. Across the ten real captures it correlates with `p95` at **r = 0.990**,
because p05 is near zero for any scene containing shadows. Asserting on it was very nearly
asserting "be brighter".

Verified independently rather than taken on the critic's word:

- A **genuinely low-key but well-modelled** frame scores spread **0.0865** — statistically
  identical to `point-light-expo`'s 0.0899, which the budget was calling a failure. The budget
  would have failed legitimately moody art.
- A frame that is **half black void and half flat grey** scores spread **0.578**, which would have
  ranked it second of ten, while having no modelling anywhere.
- `clippedHigh` counted any channel at maximum, so `rgb(255,10,10)` — a saturated red at *mid*
  luminance — reported as 100% blown. It punished exactly the vivid effects these demos need.
- `meanSaturation` was unweighted, so `rgb(1,0,0)` scored a perfect 1.000. Colour budgets were
  being passed by darkness.
- Probes clamped silently when partly off-frame, returning a plausible pixel count **from the wrong
  region**. Every probe-based criterion in goal 06 depended on that.

All five are fixed in `scripts/frame-stats.mjs`, with tests for each. The headline measure is now
**local contrast**: the median, across 32-pixel tiles, of how much perceptual lightness (CIE L\*)
varies inside a tile. It asks whether light models form across surfaces, and it is independent of
overall brightness.

## The headline, restated on the corrected metric

| Demo | Local contrast | p95 | Blown | Crushed |
|---|---|---|---|---|
| antiky-town | **8.61** | 0.370 | 0.00% | 0.00% |
| combat-arena | 5.47 | 0.085 | 0.00% | 0.00% |
| point-light-expo | 2.97 | 0.104 | 0.00% | 0.00% |
| traversal-study | **0.00** | 0.400 | 0.00% | 0.00% |

The ranking **inverts** against the original spread-based table, and the new order matches the
visual diagnosis where the old one contradicted it:

- **`traversal-study` measures 0.00** — no modelling anywhere. Under the old metric it ranked third
  of four and looked healthy. `00-VISUAL-DIAGNOSIS.md` says of it: "Every surface is one flat
  colour." The corrected metric agrees; the original did not.
- **`antiky-town` leads at 8.61**, which matches the visual read that it is much the strongest work.
- The budget floor is now **8.5**, and it is not an aspiration: `antiky-town` already clears it with
  no PBR materials and hard-edged shadows. A demo below it is behind work already done here.

**The 9.8× glass-garden claim is withdrawn.** It was computed on the discredited metric, and the
critique shows the same comparison is 2.48× in L\* and 0.62× in stops. The ranking it supported was
an artefact of scene brightness.

**`demos:verify` now reports 8 failures rather than 13.** The original 13 were 4 facts
double-counted through correlated metrics. Each of the 8 is now a distinct claim.

## What changed

| Artifact | Change |
|---|---|
| `packages/cli/src/host/actions.ts` | Capture actions get their own budget, separate from the interactive action budget. |
| `packages/cli/src/host/session.ts` | `captureActionTimeoutMilliseconds` threaded through session options. |
| `packages/cli/tests/actions.test.ts` | Two regression tests for the budget split, written before the fix. |
| `scripts/frame-stats.mjs` + test | Local contrast in CIE L\*, luminance percentiles, blown/crushed fractions, luminance-weighted saturation, named probes. GPU-free, 13 tests. |
| `scripts/shoot-demos.mjs` + test | Drives the capture MCP, serially, with the fence-retry sequence. |
| `scripts/dev.mjs` | `combat-arena` and `traversal-study` added; they could not be started before. |
| `scripts/tests/repository-policy.test.mjs` | Allowlists updated; the dead published-skills test removed. |
| `packages/demos/*/*/visual-metrics.json` | Committed baseline for all ten demos. |
| `packages/demos/antiky/*/tests/visual-budget.test.mjs` | Four per-demo budgets, failing on purpose. |
| `packages/demos/tests/pipeline-invariants.test.mjs` | Five source-level invariants, failing on purpose. |

## Two test suites, on purpose

- **`npm test` is green** and stays the regression gate.
- **`npm run demos:verify` is red** — 9 pass, 8 fail — and is the target tracker.

The budgets and invariants encode defects that goals 03, 04, 06 and 07 remove. They must fail now,
or they measure nothing. Putting them in `npm test` would make the regression gate permanently red
and therefore useless, so they live in their own command. Neither is picked up by the demo
workspaces' `tests/*.test.ts` globs, which is why `npm test` stays clean.

The 8 failures are specific and non-overlapping: **three demos fail local contrast**
(`traversal-study` 0.00, `point-light-expo` 2.97, `combat-arena` 5.47 against a floor of 8.5), and
**five pipeline invariants fail**. No demo fails on clipping. `antiky-town` passes its budget. That
is a precise statement of what is wrong — surfaces are not modelled by light — rather than the
earlier claim, which was mostly restating that the frames are dark.

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
| `capture_gameplay_sequence` untouched, so motion and feel have no measurement path | **Resolved 2026-08-11** — the owner wants motion capture in the inspection tooling. Becomes its own goal, informed by `11-MOTION-INSPECTION-RESEARCH.md`. |
| Visual budget bounds are unapproved | **Needs owner** — item 1 above |
| The blank-frame guard has not fired on real data. Every live capture rendered; the three committed blank-white three.js captures are stale artifacts of a capture-timing bug, not a current render failure | **Goal 10** removes them. No action. |
| Budgets exist only for the four antiky demos. The other six have committed metrics but no authored bounds | **No action.** The six are not targeted against a reference look. Add bounds if that changes. |
