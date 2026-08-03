# 0013: Make simulation inputs explicit

## Status

Accepted

## Context

Hidden wall clocks, randomness, environment reads, and unordered system execution make simulation
difficult to test, step, replay, predict, or reproduce. Rendering cadence also varies independently
from gameplay timing.

## Decision

We will run authoritative simulation on a fixed timestep with explicit clocks, random seeds or
streams, external inputs, and system ordering. Each world will have one ordered writer for a tick.
Concurrent worker results will be applied at a safe boundary only when their source revision still
matches.

Rendering may interpolate between simulation states and run at a different cadence. Exact
cross-platform bitwise determinism is not assumed unless a subsystem explicitly guarantees and tests
it.

## Consequences

- Pause, frame stepping, headless tests, replay, prediction, and debugging share one time model.
- Systems cannot read ambient time or randomness when making authoritative decisions.
- Long frames require bounded catch-up and over-budget diagnostics.
- Stable ordering and injected inputs add discipline to system APIs.
- Reproducibility claims must name the build, content, physics version, and determinism boundary.
