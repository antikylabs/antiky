# Executable requirement contracts

**Recorded:** 2026-08-11
**Status:** deferred. The demo-refining objective is complete, but this generalization still needs
evidence from another real consumer.
**Origin:** owner observation while reviewing the goal 01 visual budget tests.

## The idea

Antiky is an AI-native framework. Today that mostly means agents can *drive* the engine - the CLI
and MCP give them the run, inspect, capture and replay surfaces. It does not yet mean agents can be
*held to* what a human intended.

The opportunity: give an owner a way to state an intended requirement, and have the framework bind
that statement to a testable contract an agent must satisfy. The requirement becomes the artifact.
The test is generated from it or attached to it, and an agent cannot report the work as done
without satisfying it - and cannot quietly weaken it either.

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
instance of exactly this pattern - an authored intent ("this frame should have real value
structure") bound to an assertion that fails until it is true.

## What would have to be true first

- **The hand-written version has to prove itself.** The four `visual-budget.test.mjs` files and the
  five pipeline invariants are the manual precedent. If they turn out to measure the wrong things,
  a system for generating more of them faster makes the problem worse, not better. The
  [demo-refining archive](../objectives/_archives/2026-08-17-demo-refining-summary.md) records the first
  instrument correction and the accepted measurement limits.
- **Thresholds have to be owner-owned in practice, not just in policy.** The whole value is that an
  agent cannot loosen a contract to pass it. That rule currently exists as prose in a dispatch
  guide. It would need to be structural.
- **There should be several genuinely different contract kinds in use.** One kind is not a pattern.
  Visual budgets, motion assertions and simulation invariants are three, and only the first exists.

## Precursor: the measurement primitives are staged in `scripts/`, not housed there

`scripts/frame-stats.mjs` and `scripts/motion-stats.mjs` are pure functions with no I/O, no
browser and no repository knowledge. They measure a frame and a motion series. **They are in the
wrong place for the long term, deliberately.**

The right home is the CLI's inspection library, `packages/cli/src/development/`. That library is
where inspection lives and where twenty MCP tools already expose it to agents. Note what is
currently missing from it: every module there *acquires* something - captures, observations,
evidence, sessions, point lights - and **nothing interprets anything**. `get_render_stats` returns
numbers the game reports about itself. Nothing computes a value from pixels or from a series. These
two modules are the first interpretation this repository has, which is part of why they had no
obvious home.

**The case for moving them** is `docs/adr/framework/0003`, *"one engine API for humans and
agents"*. Today an agent working on any other Antiky project cannot measure a frame at all - the
capability exists only in this repository, as a script. That is a real inconsistency with an
AI-native framework.

**The case for waiting** is that the measurement is not proven. The headline metric has already
been replaced once: `luminanceSpread` turned out to track peak brightness rather than contrast
(r = 0.99 against p95 across ten real captures), and `localContrastMedian` replaced it. Had that
lived behind an MCP tool with a strict contract, the mistake would have been versioned and would
have needed a migration. The thresholds are still unvalidated by the owner.

**Trigger to move them.** Any one of:

- a second consumer outside this repository - another Antiky project, or Studio;
- an agent needing them through MCP rather than as a script;
- the visual budgets surviving a full render slice (goals 06 and 07) without their thresholds
  needing another rewrite.

**Cost of waiting is low.** They are pure functions with one dependency (`sharp`). Moving means a
TypeScript port, a tool surface, and a validated contract in the style of `capture-sequence.ts`.
Nothing about living in `scripts/` first makes that harder.

**What stays in `scripts/` permanently:** `shoot-demos.mjs`. It knows ten demo slugs, spawns dev
servers and writes sidecars beside demos. That is repository orchestration, not a framework
capability, and it belongs where it is.

Check `packages/cli/tests/development-import-boundary.test.mjs` before moving anything - it
constrains what the development library may depend on, and `sharp` is a native module.

## Why not now

`GOOD_ENGINEERING_H.md` is direct about this: do not abstract early, wait for a natural cut-point,
and a little duplication beats a premature abstraction. There is currently **one** implemented
contract kind, written by hand, whose thresholds are not yet validated. Building a framework for it
would be designing from a single implementation - the same mistake the `BroMetalRenderDriver`
decision (ADR 0021) explicitly avoids by extracting from two working implementations rather than
designing from zero.

## The cheapest next step, when the time comes

Do not start with a language or a schema. Start by writing the second and third contract kinds by
hand - a motion assertion and a simulation invariant - and see whether they actually rhyme with the
visual budgets. If three hand-written kinds converge on the same shape, that shape is the contract
format and it will have been discovered rather than invented. If they do not converge, the idea was
wrong and this file should be deleted with that finding recorded.

## Related

- [Demo-refining archive](../objectives/_archives/2026-08-17-demo-refining-summary.md) - the hand-written
  precedent and bounded acceptance practice
- `../scratch/skill-research/IMPLEMENTATION-PLAN.md` - the self-verification loop this would harden
- `../../adr/framework/0003-agent-native_H.md` - one engine API for humans and agents
