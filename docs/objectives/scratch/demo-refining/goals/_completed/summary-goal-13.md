# Summary — goal 13: measure motion, so feel can be judged instead of guessed

**Completed:** 2026-08-11
**Commits:** `8a3dd26`, `2195845`, `3b92c42`, `d241cf6`
**Goal file:** [`execute-goal-13.md`](execute-goal-13.md)

## Action needed from the owner

**None.**

No bug found during this goal is outstanding. Everything below is either landed or explicitly
assigned to a later goal.

## The headline

**The camera shake you reported is now measured, not argued about**, and the measurement runs in
under a second with no browser, no GPU and no capture. Three of the five assertions fail against
the current code, each naming the defect and what to do:

```
✗ the frame translates rather than swivelling
    camera position moves 0.0988 but the look-at target moves 0.0000
✗ the shake is not periodic
    the camera offset repeats itself every 1.750s with correlation 0.697
✗ a routine cannon hit is far weaker than losing hull
    cannon peaks at 0.0494 against 0.0944 for a hull loss (52% of it)
```

That is the whole point of the goal: goal 03 now has a target it can hit and prove, rather than a
change someone squints at.

## What changed

| Artifact | Change |
|---|---|
| `scripts/motion-stats.mjs` + test | P1. Pure, GPU-free series analysis. 13 tests against synthetic signals with analytic answers. |
| `packages/demos/antiky/combat-arena/tests/camera-shake.test.mjs` | The regression. Fails today, passes after goal 03. |
| `packages/cli/src/host/capture-sequence-service.ts` | P2. Per-frame observation stamps. |
| `packages/cli/src/development/capture-sequence.ts` | P2. `cadence.frames` in the contract, strictly validated both ways. |
| `scripts/frame-stats.mjs` + test | P3. `readSequenceStats` with ITU-T P.910 Temporal Information. |
| `package.json`, `scripts/repository-policy.test.mjs` | Registration and allowlists. |

## Why this landed in `scripts/` and not in the CLI inspection library

Worth stating, because the file list reads oddly against an AI-native framework: measurement lives
in `scripts/`, while inspection lives in `packages/cli/src/development/` and reaches agents through
twenty MCP tools.

**`scripts/` is a staging area here, not the destination.** Three different things landed and they
do not share an answer:

| Artifact | Where it belongs |
|---|---|
| `frame-stats.mjs`, `motion-stats.mjs` — pure functions, no I/O | **Eventually the CLI.** Staged in `scripts/` until the measurement is proven. |
| `shoot-demos.mjs` — knows demo slugs, spawns servers, writes sidecars | **`scripts/`, permanently.** Repository orchestration, not a framework capability. |
| Budgets and the camera regression | **Beside their demos.** Already correct. |

The reason to wait on the first row is specific rather than general: **the headline metric has
already been replaced once.** `luminanceSpread` measured peak brightness rather than contrast
(r = 0.99 against p95 across ten captures), and `localContrastMedian` replaced it after the
critique in `../../12-VISUAL-METRICS-CRITIQUE.md`. Behind an MCP tool with a strict contract, that
mistake would have been versioned and needed a migration. The thresholds are still unvalidated.

Note also that the CLI's inspection library currently *acquires* and never *interprets* — every
module there fetches captures, observations, evidence or sessions, and `get_render_stats` returns
numbers the game reports about itself. These two modules are the first interpretation in the
repository, which is part of why they had no obvious home.

The trigger to promote them, the cost, and the import-boundary caveat are recorded in
[`../../../../ideas/executable-requirement-contracts.md`](../../../../ideas/executable-requirement-contracts.md)
and carried on the revisit register in
[`../execute-goal-99.md`](../execute-goal-99.md) so it cannot be forgotten.

## Design decisions worth keeping

**Motion is computed from the simulation, not from video.** Every visible camera value in
`combat-arena` is a pure function of the snapshot and `state.time`, so driving the projector
directly gives the exact camera path in milliseconds. Pixels remain the only place a *rendering*
bug appears, which is what P2 and P3 are for — but they are not where motion is best measured.

**Temporal difference reports standard deviation as well as mean.** P.910 defines Temporal
Information as the standard deviation of the frame difference, because the mean is moved by a
uniform brightness change — a fade, an exposure shift, a light turning on — which is not motion.
Both are reported: their disagreement is itself the signal that the whole frame got brighter and
nothing moved. A test asserts exactly that.

**The regression lives in `.test.mjs`, not `.test.ts`.** The demo's own test script globs
`tests/*.test.ts`, so a `.ts` file would have turned `npm test` red. `npm test` stays the green
regression gate; `npm run demos:verify` is the red target tracker, now at 11 failures across
budgets, invariants and the camera.

## Two tests that pass today, and are labelled as such

`the shake is not a single tone` and `the camera is not shaking for most of the fight` both pass
now. They are kept as guards — against a future shake written as one pure sine, and against a fix
that raises the amplitude until the shake becomes ambient — and each carries a comment saying it
currently passes and why. **They are not part of the failing contract**, and the file says so
rather than letting a reader assume all five are red.

The spectral one is worth a note: two beating frequencies plus the cannon retrigger spread energy
across several bins, so concentration alone does **not** catch this defect. The autocorrelation
test is what does. A metric that seems obviously right can still fail to discriminate.

## A refinement to the earlier diagnosis

The strongest repeat measures at **1.750 s**, not the 1.047 s beat predicted from `|47 − 41|` and
not the 0.667 s found in the earlier one-off script. The difference is the impact-decay model: this
test decays impact *before* applying the cannon retrigger, which is the ordering `simulation.ts`
uses. The conclusion is unchanged and the direction is the same — the signal is strongly periodic
and the retrigger cadence dominates — but the exact period depends on how the two are sequenced,
so **the number to trust is the one this test prints**, not either earlier estimate.

## Also landed, at the owner's request

- **Every local patch module now names its upstream PR** (#3–#7) with the PR title and a
  retirement instruction listing the three places to edit when it merges.
- **`docs/objectives/ideas/skill-text.md`** captures the whole workflow — local patch organisation,
  the runner's four jobs, fork-and-upstream mechanics, the PR body format we used, and the five
  things that bit us. Raw material for a reusable skill.

## Outstanding

| Item | Disposition |
|---|---|
| P4–P7 (contact sheets, presentation frame ring, `get_motion_report`, spatiotemporal slice) | **Not built, by design.** `execute-goal-13.md` lists them as explicit non-goals; `get_motion_report` is last and only after P1–P5. |
| The 30 fps sequence-capture cap is a hard Nyquist wall above ~15 Hz | **No action.** Judder must be measured from the simulation, which P1 does. Recorded in `11-MOTION-INSPECTION-RESEARCH.md`. |
| No deterministic seed | **Goal 11.** All three worked defects are deterministic in `state.time`, so this blocked nothing here. |
| The camera regression is red | **Goal 03** turns it green. That is the contract. |
