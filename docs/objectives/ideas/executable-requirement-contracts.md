# Executable requirement contracts

**Recorded:** 2026-08-11
**Status:** too early. Revisit once the demo-refining goals have landed and the visual harness has
been used in anger for a while.
**Origin:** owner observation while reviewing the goal 01 visual budget tests.

## The idea

Antiky is an AI-native framework. Today that mostly means agents can *drive* the engine — the CLI
and MCP give them the run, inspect, capture and replay surfaces. It does not yet mean agents can be
*held to* what a human intended.

The opportunity: give an owner a way to state an intended requirement, and have the framework bind
that statement to a testable contract an agent must satisfy. The requirement becomes the artifact.
The test is generated from it or attached to it, and an agent cannot report the work as done
without satisfying it — and cannot quietly weaken it either.

The generalisation is that a contract can bind to any measurable surface the framework already
exposes: pixels, simulation state, events, render statistics, timing, or motion.

## Why it is plausible here rather than generic

Two things in this repository make it more than a wish.

**The measurement surfaces already exist.** `scripts/frame-stats.mjs` measures frames,
`packages/demos/tests/pipeline-invariants.test.mjs` measures source-level pipeline properties, and
the MCP already exposes render statistics, world inspection, event logs and deterministic stepping.
A contract system does not need new sensors, only a way to bind intent to the ones there are.

**The failure mode it addresses is documented, not hypothetical.** The demo audit found an agent
that built plausible-looking work with no way to check itself, and shipped defects that survived
review because nothing measured them. Goal 01's visual budgets are, in effect, one hand-written
instance of exactly this pattern — an authored intent ("this frame should have real value
structure") bound to an assertion that fails until it is true.

## What would have to be true first

- **The hand-written version has to prove itself.** The four `visual-budget.test.mjs` files and the
  five pipeline invariants are the manual precedent. If they turn out to measure the wrong things,
  a system for generating more of them faster makes the problem worse, not better. The critique in
  `../scratch/demo-refining/12-VISUAL-METRICS-CRITIQUE.md` is the first check on that.
- **Thresholds have to be owner-owned in practice, not just in policy.** The whole value is that an
  agent cannot loosen a contract to pass it. That rule currently exists as prose in a dispatch
  guide. It would need to be structural.
- **There should be several genuinely different contract kinds in use.** One kind is not a pattern.
  Visual budgets, motion assertions and simulation invariants are three, and only the first exists.

## Why not now

`GOOD_ENGINEERING_H.md` is direct about this: do not abstract early, wait for a natural cut-point,
and a little duplication beats a premature abstraction. There is currently **one** implemented
contract kind, written by hand, whose thresholds are not yet validated. Building a framework for it
would be designing from a single implementation — the same mistake the `BroMetalRenderDriver`
decision (ADR 0021) explicitly avoids by extracting from two working implementations rather than
designing from zero.

## The cheapest next step, when the time comes

Do not start with a language or a schema. Start by writing the second and third contract kinds by
hand — a motion assertion and a simulation invariant — and see whether they actually rhyme with the
visual budgets. If three hand-written kinds converge on the same shape, that shape is the contract
format and it will have been discovered rather than invented. If they do not converge, the idea was
wrong and this file should be deleted with that finding recorded.

## Related

- `../scratch/demo-refining/goals/_completed/summary-goal-01.md` — the hand-written precedent
- `../scratch/demo-refining/06-WORK-PACKETS.md` — bounded acceptance criteria as a working practice
- `../scratch/skill-research/IMPLEMENTATION-PLAN.md` — the self-verification loop this would harden
- `../../adr/framework/0003-agent-native_H.md` — one engine API for humans and agents
