# Execute goal 13: measure motion, so feel can be judged instead of guessed

## Prerequisites

- [Execute goal 01](_completed/execute-goal-01.md) is complete. This goal is a sibling to
  `scripts/frame-stats.mjs` and follows the same shape: pure functions, no I/O, unit-tested against
  synthetic signals with known answers.
- The research this goal implements is `../11-MOTION-INSPECTION-RESEARCH.md`. Read it first. This
  goal does not restate its reasoning, its comparisons of candidate encodings, or its prior-art
  survey; it implements the ranked proposals in §8 against the acceptance criteria in §11.
- No other agent is running a demo dev server. The parts of this goal that capture pixels bind
  `127.0.0.1:3010` and `:3011`.

## `/goal` objective

Make motion measurable, so that camera shake, judder, VFX timing and traversal feel can be asserted
on rather than eyeballed.

The organising insight, established and verified in the research, is that **the model does not need
video**. Motion is computed from the simulation, which knows the intended signal exactly and
cheaply, and pixels are used only to prove the renderer presented what the simulation computed.
Section 2 of the research calls these three places motion lives; this goal builds the join.

The verification in that document already proved the approach: the owner-reported camera shake
defect reproduces in a plain Node script in under a second, with no browser, no GPU and no capture.
This goal turns that one-off script into a library, a test, and an MCP-visible signal.

## Required outcome

When the work is complete, the repository must have:

1. `scripts/motion-stats.mjs` implementing the P1 surface from research §8: `deltas`, `holds`,
   `autocorrelation`, `spectrum`, `spectralConcentration`, `dominantFrequency`, `onsetShape`,
   `crossCorrelation`, `dutyCycle` and `sparkline` — pure, GPU-free, with no new dependency;
2. `scripts/tests/motion-stats.test.mjs` verifying each function against synthetic signals whose answers
   are known analytically, not against a demo;
3. a **regression test that fails on the current `combat-arena` camera and passes after goal 03's
   fix**, asserting the three properties the owner reported: the frame translates rather than
   swivels, the offset signal is not periodic, and a routine cannon hit is far weaker than a hull
   loss;
4. per-frame observation stamps on `capture_gameplay_sequence` (research §8 P2), so a captured
   frame can be tied to an exact simulation instant;
5. `readSequenceStats` in `scripts/frame-stats.mjs` (P3), returning per-frame statistics plus the
   consecutive-frame difference, with **both the mean and the standard deviation** of that
   difference — ITU-T P.910 defines Temporal Information as the standard deviation because the mean
   is moved by a uniform brightness shift that is not motion; and
6. `npm test` green, with the new tests included in the root test script and both
   `repository-policy.test.mjs` allowlists updated in the same commit.

## In scope

- **P1 first and alone if time is short.** It makes acceptance criteria that are *already written*
  in `06-WORK-PACKETS.md:324-330` and `03-ART-DIRECTION-AND-VFX.md:792-797` executable. Those
  criteria are currently prose with nothing behind them, which is the exact failure the audit was
  written to end.
- Use a plain DFT. The naive form runs in about 4 ms at n = 600. **Do not add an FFT dependency.**
- The camera regression test drives `createCombatCameraProjector` directly
  (`packages/demos/antiky/combat-arena/src/presentation.ts:25`) with the documented cadence: impact
  set to 0.45 every 0.34 s (`simulation.ts:259`, `:448-449`), decaying at 4.2/s (`:378`). The
  research verification section records the expected values: camera X range ≈ 0.0836, target X range
  exactly 0.0000, strongest autocorrelation peak 0.759 at 0.667 s.
- Note in that test that the dominant period is **0.667 s, twice the cannon cadence — not the
  1.047 s sine beat**. The metronome is the stronger defect and the retrigger rate is what must
  change most.
- P2 extends `cadence` in the sequence result with a parallel `frames` array carrying
  `offsetMilliseconds`, `completedStepCount`, `accumulatorSeconds`, `stateDigest` and
  `eventSequence`, read from `options.readState()` at each capture point. The service already reads
  that state every loop iteration for the step-wait path
  (`packages/cli/src/host/capture-sequence-service.ts:312-322`), so the data is in hand. The result
  schema is strictly validated in both directions (`packages/cli/src/development/capture-sequence.ts:329-372`)
  and has tests, so this is bounded work rather than a one-liner. The field is additive.
- Respect the **frequency budget** from the research. Sequence capture is capped at 30 fps
  (`capture-sequence.ts:17`), which is a hard Nyquist wall: judder and frame holds above ~15 Hz are
  invisible to it and must be measured from the simulation. Do not write an acceptance criterion
  that asks the capture path for a signal it cannot carry.

## Required tests and evidence

At minimum, prove:

- every `motion-stats` function returns the analytically correct answer for a synthetic input: a
  pure sine of known frequency reports that frequency and near-total spectral concentration; white
  noise reports low concentration and no autocorrelation peak; a constant series reports zero
  deltas and a hold run equal to its length; a step reports its onset index;
- `autocorrelation` on the **current** `combat-arena` camera path reports a peak above 0.3 outside
  lag zero, and the test states plainly that this is the defect and is expected to invert;
- the target-versus-position assertion fails today: target X range is 0.0000 while position X range
  is non-zero;
- `holds` detects a frame-held series — a 60 Hz signal sampled at 120 Hz with each value repeated —
  which is what missing render interpolation looks like;
- `readSequenceStats` returns one entry per input frame and its temporal-difference standard
  deviation is unmoved by adding a uniform brightness offset to every frame;
- the sequence `frames` array has the same length as `captureOffsetsMilliseconds`, and every entry
  carries a `completedStepCount` that is non-decreasing;
- `npm test` is green, and `npm run demos:verify` gains the camera regression without turning the
  regression gate red.

The handoff must state which proposals were built, which were deferred, and the measured values for
the camera regression before any fix.

## Explicit non-goals

- **Do not build a video pipeline, and do not send video to a model.** Research §9 and §10 establish
  that no mainstream visual testing tool asserts on motion, that models are near chance at temporal
  glitch detection, and that the repository's WebM is VP9, which exports no motion vectors at all.
- Do not add optical flow. It was benchmarked and rejected on dependency shape, not on compute.
- Do not build P4 through P7 — contact sheets, the presentation frame ring, `get_motion_report`, or
  the spatiotemporal slice — in this goal. `get_motion_report` is explicitly last and only after
  P1–P5 exist.
- Do not fix the camera shake here. Goal 03 owns that. This goal builds the instrument that proves
  it, and the instrument is more useful if it demonstrably fails first.
- Do not add a seed or any ADR 0013 remediation. Goal 11 owns it, and the research found all three
  worked defects are deterministic in `state.time` anyway, so the seed gap blocks less than assumed.
- Do not attempt to measure motion through `get_render_stats`. It carries **zero** motion
  information: `drawCalls` and `instances` are authored capacity constants reported once at startup
  (`combat-arena/src/renderer.ts:55-64`, `game.ts:89-92`), and BroMetal 0.15 exposes no draw
  statistics or GPU timing.

## Engineering constraints

- `packages/demos/antiky/antiky-town` is in scope like every other demo, though this goal changes no
  demo code.
- Tests are required for code changes (`AGENTS.md`). When fixing a reported bug, write the failing
  regression test first.
- Adding files under `scripts/` requires updating **both** allowlists in
  `scripts/tests/repository-policy.test.mjs` and the root `test` script in `package.json`, in the same
  commit, or the suite goes red.
- Use short one-line commit messages. Never add coauthor tags.
- Capture PNGs are not committed. `.antiky/` is gitignored and `*.png` is tracked by Git LFS. The
  committed artifact is a metrics sidecar.
- Preserve unrelated dirty worktree changes.
- Keep the module dependency-free and pure, matching `scripts/frame-stats.mjs`. A motion statistic
  that needs a browser is a motion statistic nobody will run.

## Completion definition

The goal is complete when `scripts/motion-stats.mjs` exists with unit tests that pass against
synthetic signals, the `combat-arena` camera regression **fails against the current code** for the
three reported properties with its measured values recorded, per-frame stamps tie captured frames to
simulation instants, `readSequenceStats` reports both mean and standard deviation of the temporal
difference, and `npm test` is green.

If P2 cannot be landed without breaking the strict sequence-result validation, ship P1 and P3, state
the exact blocking constraint, and leave the goal active. P1 alone unblocks goal 03's shake work and
is worth landing on its own.
