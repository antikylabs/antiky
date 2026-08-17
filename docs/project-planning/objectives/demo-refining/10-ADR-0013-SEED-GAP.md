# Recorded compliance gap — ADR 0013 explicit random seeds

**Recorded by:** goal 00, 2026-08-11.
**Implemented by:** goal 11 (`goals/execute-goal-11.md`). **Not implemented here.**

This is a record, not a plan and not a change. Goal 00 settles the architecture record. It does not
write simulation code, and it must not.

## The clause

`docs/adr/framework/0013-explicit-simulation-inputs_H.md:17-21` — status **Accepted**:

> The authoritative simulation will use a fixed time step. It will receive these inputs explicitly:
>
> - The simulation clock
> - **Random seeds or random streams**
> - External inputs
> - The system order.

The verb is "will receive". This is a requirement on the simulation, not a permission.

## The gap

**No seed exists anywhere in the repository.** No demo passes a seed or a random stream into its
simulation. Six demos hand-roll their own random number generation with six different sets of magic
constants, and none of them is an explicit simulation input.

Evidence: `../_deferred/demo-refine-goal-17-adrs/sources/08-ADR-IMPACT.md:116-147`, and
`05-FRAMEWORK-EASY-WINS.md` on the six divergent implementations.

## Why it is worse than a tidiness problem

Two consequences make this more than duplication:

1. The hand-rolled generators are built on `Math.sin`. The ECMAScript specification does not require
   `Math.sin` to be correctly rounded, so results can differ across engines and platforms.
2. That randomness feeds `getStateDigest()`, which the MCP `step_simulation` tool reports to agents
   as ground truth about simulation state. An agent reasoning about a digest is reasoning about a
   value that is not reproducible.

ADR 0013's own Consequences section anticipates exactly this: *"A system cannot read the system
clock or hidden random values when it makes an authoritative decision."*

Note that ADR 0013 does **not** promise identical binary results across platforms — it says a
subsystem may make that promise only if tests verify it. So closing this gap means making seeds an
explicit input, not guaranteeing cross-platform bit equality.

## What is explicitly not claimed here

- Missing **render interpolation** is *not* an ADR 0013 breach. `0013:30` says *"The renderer can
  estimate positions between two simulation states"* — permissive, not required. It is a real
  quality defect, and goal 03 fixes it, but it is not a compliance gap. An earlier draft of this
  audit called it one. That was wrong.
- No claim is made that any other ADR 0013 clause is violated. Only the seed clause was checked
  against evidence.

## Handoff to goal 11

Goal 11 owns the fix: one seeded generator as an explicit simulation input, replacing six local
implementations. Its acceptance criteria already require identical state for a fixed seed across
1,000 ticks.
