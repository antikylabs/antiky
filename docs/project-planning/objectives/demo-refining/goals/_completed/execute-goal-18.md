# Execute goal 18: expose every completed simulation step to observers

## Prerequisites

- [Goal 99](execute-goal-99.md) is complete. This goal delivers A4 from its
  [summary](summary-goal-99.md).
- Preserve the fixed-step, input, fault, and authority rules in Framework ADRs 0008, 0013, 0017,
  and 0020.
- This goal can run beside Goals 16 and 17. Goal 19 waits for this goal because deterministic
  multi-step inspection needs the completed-step seam.

### Needed from the owner before starting

Nothing. This goal can start as written. It adds observation of a decision the EngineSession already
makes; it does not change simulation authority or add durable history.

## `/goal` objective

Add one bounded Framework observation point after each successful fixed simulation step. Today
`EngineSession.advance()` can finish zero, one, or three steps but exposes only the final count and
last step. A capture or diagnostic consumer therefore cannot correlate evidence with each state the
simulation actually completed.

This goal delivers A4 from [`execute-goal-99.md:69`](execute-goal-99.md) and applies the inspection
requirement in [`07-TESTING-WITH-ANTIKY-MCP.md:137-152`](../../07-TESTING-WITH-ANTIKY-MCP.md).

## Required outcome

When the work is complete, the repository must have:

1. one optional `onCompletedStep` observer in `EngineSessionOptions`, receiving the existing deeply
   immutable `CompletedEngineStep` value;
2. exactly one observer call after every successful frame-driven or tool-driven step, in completed
   step order, including each step in a multi-step catch-up frame;
3. no observer call for zero-step frames, rejected input, a failed system, a failed digest, stale
   single-step requests, paused/faulted/disposed sessions, or commands;
4. explicit failure semantics for a throwing observer that preserve the completed step's identity,
   stop later steps, and surface a named session fault instead of discarding the error;
5. Framework tests for zero, one, and maximum completed steps, single-step, partial success before a
   later failure, callback ordering, immutable input, and observer failure; and
6. Framework documentation that distinguishes live observation from an event store, checkpoint,
   replay, subscription, or durability guarantee.

## In scope

- **Contract.** Own `packages/framework/src/sessions/engine-session/contract.ts` and the public
  export/docs that describe `EngineSessionOptions`.
- **Runtime.** Own the engine-session runtime and call the observer only after systems and the state
  digest complete for that step.
- **Fault behavior.** Extend the existing named fault-source union rather than swallowing the error
  or allowing a callback exception to escape and leave counters ambiguous.
- **Tests.** Own existing EngineSession tests and protocol tests affected by a schema or fault-source
  change.
- **CLI audit.** Confirm that current pause, resume, step, status, and capture fences can consume the
  completed-step identity without a new MCP tool. Record any adapter change that is actually
  required; do not add one speculatively.

## Required tests and evidence

At minimum, prove:

- `advance(0, input)` invokes no observer;
- one fixed step invokes the observer once with step ID 1, the accepted input sequence, source
  `frame`, fixed delta, immutable input, and the digest for that exact state;
- a maximum catch-up frame invokes it three times in order with distinct step IDs and the same
  accepted frame-input sequence;
- a tool step invokes it once with source `single-step`, while a stale request invokes it zero times;
- when step 2 fails after step 1 succeeds, only step 1 is observed and the status keeps exactly that
  completed step;
- when the observer for a completed step throws, the session returns a named fault, does not run a
  later step, and reports counters that agree with the state already mutated by the completed step;
- observer code cannot mutate the captured input or the completed-step record; and
- affected Framework typecheck/tests plus the repository test suite exit zero.

## Explicit non-goals

- Do not add an event store, retained step history, replay file, checkpoint, subscription transport,
  generic telemetry bus, or cross-session stream.
- Do not let the observer change input, system order, time, commands, world authority, or whether a
  step commits.
- Do not emit one render or GPU submission per simulation step; ADR 0020 keeps presentation separate.
- Do not add a new MCP tool when the existing development service can adapt the same typed state.
- Do not change fixed-step duration, catch-up limits, input capture, or state-digest policy.

## Engineering constraints

- Follow `AGENTS.md` and `docs/GOOD_ENGINEERING_H.md`. Add the failing tests before the runtime
  change and watch them fail for the missing observation behavior.
- Keep the seam optional and deep. A session with no observer must retain byte-for-byte equivalent
  result semantics.
- Make observer ordering and failure behavior obvious in the contract; do not hide them in comments
  in the runtime only.
- Make short focused commits without coauthor tags and preserve unrelated worktree changes.

## Completion definition

The goal is complete only when zero-, one-, multi-, partial-, single-step-, and observer-failure
paths all have unambiguous tested behavior; every completed step can be observed once in order; and
the default session still has no retained history or presentation coupling.

If a safe observer requires making EngineSession depend on CLI, MCP, browser APIs, or a general event
store, stop with the failing fixture and report the boundary conflict. Do not widen Framework to make
one inspection consumer convenient.
