# CLI and Framework Hardening Handoff

The [CLI and Framework hardening goal](plan.md) was completed on August 5, 2026. The work makes
unexpected game-code and development-host failures stop at explicit boundaries. It also keeps
cleanup, inspection, and retry behavior predictable.

## What changed

### Framework

- `EngineSession` now enters a terminal `faulted` mode when an input-capture callback, system,
  state-digest callback, or command operation fails unexpectedly. Later mutation is rejected, but
  inspection and disposal remain available.
- Returning `null` from input capture is the explicit recoverable path for invalid input. It returns
  `INVALID_INPUT` without faulting the session.
- Engine-session inspection contains bounded fault data without copying callback messages, stacks,
  input, or command data across the boundary.
- EngineSession is now a nested module under
  [`sessions/engine-session`](../../../packages/framework/src/sessions/engine-session/index.ts).
  Contract, protocol parsing, validation, and runtime behavior are separate, while the clock and
  lifecycle state remain together. Imports from `@antiky/framework` did not change.
- Every point-light command path now preserves all observable state after service disposal. An
  unknown correction reports no entity, and repeated corrections do not grow history.

### CLI

- The build tracker observes created, modified, renamed, and deleted files, including files in a
  tracked directory created after `antiky dev` starts. Dependency, output, VCS, and `.antiky` trees
  remain ignored.
- Development-session cleanup attempts every owned operation even if one operation fails. The
  settled result reports bounded cleanup failure information.
- Capture completion is bound to the exact action that started it. A timeout, stop, late write, or
  persistence failure cannot complete a later action.
- A small injectable diagnostic sink records major lifecycle transitions and unexpected failures.
  Events carry available session, runtime, action, or request identities without credentials,
  authorization values, payloads, capture bytes, or arbitrary thrown messages.
- Browser-envelope parsing moved to
  [`browser-envelope.ts`](../../../packages/cli/src/host/browser-envelope.ts). The inspection server
  remains the owner of HTTP routing, authorization, CORS, body limits, and responses.
- Exact source-layout assertions and documentation-prose assertions were removed. Behavioral,
  security-boundary, import-boundary, and end-to-end lifecycle coverage remains.

No gameplay, Studio feature, or MCP tool was added by this goal.

## Public contract and documentation

Engine-session status now uses schema version 2. `EngineSessionMode` includes `faulted`, status has a
bounded `fault` field, and mutation results can return `SESSION_FAULTED`. A host must dispose the
faulted session and create a new one because the Framework cannot know how much game state changed
before a callback failed.

The decision is recorded in
[ADR 0017: Stop an engine session after a game-code fault](../../adr/framework/0017-stop-engine-session-after-game-code-fault_H.md).
Developer guidance is in
[Run a fixed-step game session](../../user-facing-docs/framework/engine-sessions.md), and CLI
cleanup and diagnostics are covered in
[Run Antiky locally](../../user-facing-docs/cli/development.md).

## Verification

The final `npm run check` passed after all changes. It included all workspace typechecks, 149 tests,
the production website build, shader generation, and the production inspection-boundary test.

The final real-session check did the following:

1. Started `antiky dev` from the current code.
2. Confirmed the game server on `127.0.0.1:3010`, inspection service on `127.0.0.1:3011`, shader
   watcher, and MCP endpoint on `127.0.0.1:3011/mcp` all started.
3. Fetched the game successfully, ran `antiky inspect`, and invoked the MCP `get_dev_status` tool
   through `antiky tool`.
4. Sent `Ctrl-C` and confirmed both ports were free, the session descriptor was removed, and both
   owned child processes had exited.

The repository was also checked for temporary verifiers, ad hoc tests outside package suites,
slice-specific scripts, and verification-only package commands. None remain.

## Files above 500 lines

No handwritten production file is above the 800-line decomposition threshold. The remaining files
above 500 lines were reviewed for cohesion:

| File | Lines | Cohesion judgment |
| --- | ---: | --- |
| [`point-light/service.ts`](../../../packages/framework/src/point-light/service.ts) | 642 | One authoritative point-light command, history, and projection module. Splitting its shared state would expose more coordination to callers. |
| [`inspection-server.ts`](../../../packages/cli/src/host/inspection-server.ts) | 542 | One HTTP trust boundary that owns authorization, CORS, body limits, routing, and responses. Browser-envelope parsing has already moved out. |
| [`engine-session/runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts) | 538 | One runtime state machine whose clock, lifecycle, controls, and command order share mutable session state. |
| [`host/session.ts`](../../../packages/cli/src/host/session.ts) | 528 | One development-session lifecycle owner for children, listeners, the descriptor, watcher, and cleanup. |
| [`host/actions.ts`](../../../packages/cli/src/host/actions.ts) | 505 | One pending-action state machine, including capture identity, timeout, persistence, completion, and stop behavior. |

## Incremental commits

- `7b11792` Fail closed on session faults
- `a6313db` Track build file topology
- `c46fb19` Settle every cleanup operation
- `448feb2` Bind captures to their actions
- `9ec5354` Nest the EngineSession module
- `245fae6` Freeze disposed light commands
- `d678cbc` Harden CLI host boundaries
- `895bbc9` Remove brittle repository assertions

## Run the checks again

```sh
npm run check
npm run antiky -- dev
```

With the development session running, use another terminal:

```sh
npm run antiky -- inspect
npm run antiky -- tool get_dev_status
```

Press `Ctrl-C` in the development-session terminal when finished.
