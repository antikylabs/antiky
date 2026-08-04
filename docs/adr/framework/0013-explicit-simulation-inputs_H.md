# 0013: Give the simulation all inputs explicitly

## Status

Accepted

## Context

Simulation code can get data from hidden sources. Examples include the system clock, random values,
the environment, and systems that run in an undefined order.

Hidden data makes the simulation difficult to test, pause, replay, predict, or reproduce. The
renderer can also run at a different speed from the simulation.

## Decision

The authoritative simulation will use a fixed time step. It will receive these inputs explicitly:

- The simulation clock
- Random seeds or random streams
- External inputs
- The system order.

During a simulation step, only one writer can change each world. This writer will apply changes in a
defined order.

Workers can calculate results at the same time. The session will apply a worker result at a safe
point only if its source revision still matches. It will reject a stale result.

The renderer can estimate positions between two simulation states. It can also run at a different
rate from the simulation.

Antiky does not promise identical binary results on all platforms. A subsystem can make this promise
only if tests verify it.

## Consequences

- Pause, single-step controls, headless tests, replay, prediction, and debugging use one time model.
- A system cannot read the system clock or hidden random values when it makes an authoritative
  decision.
- After a long frame, catch-up work must have a limit. Diagnostics must report work that exceeds its
  time budget.
- System APIs must receive their inputs and use a stable order.
- A reproducibility claim must identify the build, content, physics version, and parts that promise
  the same results.

## Revision history

- `6facfccaf4614340a4181b4361f77117e59a5e76` — Prior version before the plain-language rewrite.
