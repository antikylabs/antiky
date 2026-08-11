# Execute goal 01: build the verification loop that every later goal is measured against

## Prerequisites

- [Execute goal 00](execute-goal-00.md) is complete, or the owner has explicitly released this goal
  to run ahead of it. Nothing here depends on ADR 0021 mechanically, and the two are parallel-safe,
  but the render work that consumes this harness does depend on the record.
- No other agent is running a demo dev server. Every demo manifest binds `127.0.0.1:3010` for the
  game and `127.0.0.1:3011` for inspection (`packages/demos/antiky/point-light-expo/point-light-expo.antiky:14-18`),
  so this goal owns those ports for its duration.

## `/goal` objective

Make it possible to see and measure what the demos render, then encode the current defects as tests
that fail today.

This goal delivers Track 0 from `docs/objectives/scratch/demo-refining/06-WORK-PACKETS.md:17-134`:
packets W0.1, W0.1b, W0.2, W0.2b, W0.3 and W0.4. It unblocks the capture MCP the repository already
ships, wraps it in a repeatable script, computes frame statistics, sets per-demo visual budgets, and
adds source-level invariant tests.

Every later goal's acceptance criteria are written against this harness. Until it exists, a visual
claim cannot be checked, which is exactly how the shipped demos reached their current state.

## Required outcome

When the work is complete, the repository must have:

1. a `capture_frame` path that succeeds on all three in-scope antiky demos — `point-light-expo`,
   `combat-arena` and `traversal-study` — at `warmUpFrames: 60`, three consecutive runs each, with
   no `ANTIKY_ACTION_TIMEOUT`;
2. a launch budget and a capture-action budget that are separately configurable, with neither one a
   magic number written at a call site;
3. `npm test` green at `HEAD` before any test added by this goal lands;
4. `npm run demos:shoot`, which drives the existing MCP and exits non-zero, naming the demo, when a
   demo renders a blank frame;
5. a frame-statistics module with unit tests that need no GPU, and one committed
   `visual-metrics.json` sidecar per demo; and
6. three per-demo visual budget tests and one pipeline-invariant test file, all of which **fail at
   the start of this goal for the reasons the audit documents**, and none of which is loosened to
   make it pass.

## In scope

- **W0.1 — the capture timeout.** Owns `packages/cli/src/host/actions.ts` and
  `packages/cli/src/host/capture-service.ts`. This is the first task in the whole plan and it is a
  real blocker, not a theory. `packages/cli/src/host/actions.ts:48` sets
  `DEFAULT_ACTION_TIMEOUT_MILLISECONDS = 10_000`, and that single budget wraps browser launch, page
  load, roughly 10 MB of GLB and JPEG download, WebGPU initialisation, warm-up frames, and PNG
  encoding. Verified behaviour: `capture_frame` succeeds first try on `luminous-reef`, which loads
  no assets, and returns `ANTIKY_ACTION_TIMEOUT` on `point-light-expo` at both `warmUpFrames: 90`
  and `warmUpFrames: 12` — lowering warm-up does not help, because warm-up is not the slow part.
  A managed cold start already has its own launch budget at
  `packages/cli/src/host/managed-capture-runtime.ts:385`. Separate the two, and keep a genuinely
  hung capture failing rather than hanging forever.
- **W0.1b — get `npm test` green.** Owns `scripts/repository-policy.test.mjs`. The `skills/`
  directory was deleted in commit `1062bd4` while `scripts/repository-policy.test.mjs:64-66` still
  calls `readdir` on it, so that test fails `ENOENT`. Verified: 4 pass, 1 fails. Land this before
  any other test in this goal, otherwise nobody can separate their own breakage from the existing
  failure.
- **W0.2 — `demos:shoot`.** Owns `scripts/shoot-demos.mjs`, `scripts/shoot-demos.test.mjs`, root
  `package.json`, `scripts/repository-policy.test.mjs` allowlists, and `scripts/dev.mjs`. The script
  **wraps the existing MCP, it does not replace it with Playwright.** The verified working sequence
  is `get_latest_build` → `get_runtime_status` → `get_capture_capabilities` → `capture_frame`, with
  a retry on `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and `CAPTURE_DIMENSIONS_MISMATCH`. The
  first two are expected traffic, not failures — the managed browser attaching is itself what
  advances the build revision.
- **W0.2 constraints, all established by hands-on testing.** Capture is strictly serial because the
  demos share `127.0.0.1:3010` and `:3011`. `target` must equal the manifest viewport (1280×720 for
  these demos) and `deviceScaleFactor` must be `1` — 1280×720 at scale factor 2 is rejected with
  `CAPTURE_DIMENSIONS_MISMATCH` even though it sits inside the reported limits.
  `scripts/repository-policy.test.mjs:24-33` asserts an exact allowlist of tracked files under
  `scripts/`, and `:35-54` asserts an exact list of root script keys, so both must change in the
  same commit as the new script or the suite goes red. The root `test` script at
  `package.json:27` enumerates test files by name, so every new `.test.mjs` must be added there too.
  `scripts/dev.mjs:11-20` is missing `combat-arena` and `traversal-study` from `demoProjects`; add
  both, pointing at `packages/demos/antiky/combat-arena/combat-arena.antiky` and
  `packages/demos/antiky/traversal-study/traversal-study.antiky`.
- **W0.2b — frame statistics.** Owns `scripts/frame-stats.mjs` and `scripts/frame-stats.test.mjs`.
  Compute from a PNG: mean luminance, the 5th, 50th and 95th luminance percentiles, the fraction of
  pixels clipped at 0 and at 1, mean saturation, and the value of a named probe rectangle. Luminance
  is `0.2126R + 0.7152G + 0.0722B` on linearised channels. Probe rectangles are addressed by name
  from a per-demo config file, never by magic numbers scattered through tests.
- **W0.3 — per-demo visual budgets.** Owns one `tests/visual-budget.test.mjs` per demo under
  `packages/demos/antiky/*/`, three independently ownable files. Each declares `luminanceP05`,
  `luminanceP95`, `clippedHigh` and `meanSaturation` bounds, set to the **target** value with a
  comment naming the reference look.
- **W0.4 — pipeline invariants.** Owns `packages/demos/tests/pipeline-invariants.test.mjs`.
  Source-level assertions that encode the defects the audit found so they cannot return.

## Required tests and evidence

At minimum, prove:

- `capture_frame` returns a valid artifact for `point-light-expo`, `combat-arena` and
  `traversal-study` at `warmUpFrames: 60`, three consecutive runs each, with the raw tool output
  recorded for all nine runs;
- an explicitly too-small timeout still produces `ANTIKY_ACTION_TIMEOUT` — the fix raises a budget,
  it does not remove the guard;
- `npm test` is green at the W0.1b commit, before any later test in this goal is added;
- `npm run demos:shoot` exits 0 on a healthy run and produces one capture plus one committed
  `visual-metrics.json` sidecar per demo;
- `demos:shoot` exits non-zero and names the demo when a frame is blank. Three committed three.js
  captures are currently uniform white, so this check has a real subject;
- unit tests cover slug resolution, fence assembly and metrics computation against a fixture PNG
  with a known histogram, with no GPU required;
- frame statistics behave on synthetic images: a pure mid-grey image reports `p05 == p95`, a
  black-to-white ramp reports `p05 < 0.1` and `p95 > 0.9`, and a fully clipped white image reports
  `clippedHigh == 1.0`;
- each of the three visual budget tests **fails at the end of this goal**, and the failure output is
  recorded. Combat Arena's whole frame currently sits in a 15–35% luminance band. A budget that is
  green on day one measures nothing and is evidence that the bound was fitted to the defect;
- the pipeline invariants pass or fail exactly as expected: no file matching
  `packages/demos/antiky/*/src/shaders/*.shader.ts` imports `tonemapACES`; no asset script deletes
  `normalTexture` or writes UVs without reading `TEXCOORD_0`; within one demo, all shaders declaring
  a sun or key direction agree and all shaders declaring fog ranges agree — `combat-arena` violates
  both today; and every `*.shader.ts` has an up-to-date `*.shader.gen.ts`, extending the existing
  `packages/demos/tests/shader-output-parity.test.mjs` rather than duplicating it; and
- `npm test` is green at the end of this goal for everything except the W0.3 budgets, whose failure
  is the deliverable. State plainly in the handoff how the budgets are excluded from the default
  test run, or that they are expected-red and tracked as such.

## Explicit non-goals

- Do not write a Playwright capture harness. The repository already ships a purpose-built capture
  and inspection MCP, and the earlier proposal to replace it was withdrawn in
  `docs/objectives/scratch/demo-refining/07-TESTING-WITH-ANTIKY-MCP.md:165-183`.
- Do not change any shader, any renderer, or any demo `src/` file. This goal measures. It does not
  fix what it measures.
- Do not loosen a budget to make a test green. Budgets are changed by the owner, never by the agent
  that is failing them.
- Do not add a determinism assertion of the form "the same inputs produce the same frame". No seed
  exists and `capture_gameplay_sequence` declares itself non-deterministic. The comparable-frame
  recipe is pause, step to a fixed step count, then capture.
- Do not commit a capture PNG as the evidence artifact.
- Do not parallelise demo capture. The shared ports make it unsafe, not merely slow.
- Do not add tests that assert prose, copy, or frozen wording anywhere.

## Engineering constraints

- `packages/demos/antiky/antiky-town` is in scope, like every other demo. `demos:shoot` must capture
  it along with the other nine, and it needs a visual budget of its own. It is the repository's only
  2.3D artifact, so its budget bounds are authored against a 2.3D reference, not a 3D one.
- Demos hand-roll rendering per demo until `BroMetalRenderDriver` exists. Do not extract a shared
  render package, and do not move demo render code into the framework as a side effect of adding
  tests.
- Tests are required for every code change (`AGENTS.md`). When fixing a reported bug — the
  `capture_frame` timeout and the `skills/` `ENOENT` are both reported bugs — write the failing
  regression test first, watch it fail, then fix the code.
- Use short one-line commit messages. Never add coauthor tags.
- Capture PNGs are not committed. `.antiky/` is gitignored and `*.png` is tracked by Git LFS. The
  committed artifact is the `visual-metrics.json` sidecar.
- Preserve unrelated dirty worktree changes.
- W0.1b lands first and alone. W0.2 and W0.2b own disjoint files and may run in parallel. W0.2 and
  goal 02 both edit `scripts/repository-policy.test.mjs` and root `package.json`, so those two goals
  must not run their commits concurrently.
- Keep each new script under 500 lines (`docs/GOOD_ENGINEERING_H.md`). Prefer one deterministic
  script plus fixture-driven unit tests over a plugin framework.

## Completion definition

The goal is complete only when `capture_frame` succeeds nine times out of nine across the three
demos, `npm test` was green at the W0.1b commit, `demos:shoot` runs end to end and catches a blank
frame, frame statistics pass their synthetic-image tests, three visual budget files exist and fail
with recorded output, and the pipeline invariants encode all four assertions.

If the capture timeout cannot be fixed within this goal, stop and report it. Do not substitute a
hand-rolled screenshot script, and do not write budgets against captures taken by other means. The
harness is the deliverable, and a harness nobody trusts is the exact failure this whole plan exists
to correct.
