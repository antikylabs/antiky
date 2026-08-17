# Summary — goal 18: expose every completed simulation step to observers

**Status:** implementation complete; final repository verification is waiting for the concurrent
Goal 16 BroMetal patch reinstall.

**Completed:** not yet
**Commits:** `4743a35` (shared Goal 16 and Goal 18 delivery commit)
**Goal file:** [`execute-goal-18.md`](execute-goal-18.md)

## Action needed from the owner

Nothing in this summary needs you. The observer is an optional Framework callback on the existing
session authority. It adds no product, art-direction, publication, or architecture decision.

## What was delivered

1. `EngineSessionOptions.onCompletedStep` receives the existing deeply immutable
   `CompletedEngineStep<Input>` object once after each successful systems-and-digest cycle. It is
   optional, so sessions that do not configure it keep the existing frame and control results.
2. Frame-driven catch-up calls the observer after each completed step in order. Tool-driven
   single-step calls the same observer with `source: 'single-step'`. During the callback,
   `readStatus()` and `readLastCompletedStep()` already identify that committed step.
3. Zero-step frames, rejected input, system and digest failures, stale tool steps, paused, faulted,
   and disposed sessions, and command operations do not call the observer.
4. A throwing observer produces the bounded `completed-step-observer` session fault. The throwing
   step remains in `completedStepCount` and `lastCompletedStep`, later catch-up steps do not run,
   and thrown details do not cross the status boundary. Engine-session status is schema version 3.
5. The observer runs while the session writer is busy. It can read the committed identity, but
   reentrant frame, pause, single-step, and command work returns `SESSION_BUSY`. Its only argument
   is the immutable step record; it receives no world, renderer, host, CLI, or MCP authority.
6. The Framework guide distinguishes this live callback from retained history, subscriptions,
   checkpoints, replay, durable delivery, and rendering. The generated API reference documents the
   new option, fault source, and schema version.
7. The CLI audit required no production adapter and no MCP tool. Existing session-control actions
   already fence runtime identity, result mode, completed-step count, control revision, and pause
   reasons. Existing capture requests already fence development session, build, runtime, engine
   session, completed-step count, and state digest.

## What I got wrong

The first runtime version called the observer with the correct step object before it committed the
matching session counters. A callback that requested read-only status therefore saw step 0 while it
held step 1. A new test reproduced the mismatch. The runtime now commits `inputSequence`,
`completedStepCount`, and `lastCompletedStep` before calling the observer, while keeping the writer
busy. This also makes the throwing-observer rule precise: callback failure cannot undo the step.

The shared Git index also defeated the intended focused commit boundary. Goal 18 files were staged
while Goal 16 committed its explicit path set, so Git included both staged sets in `4743a35`. The
commit contains the complete Goal 18 implementation and the Goal 16 dependency update. Neither
agent rewrote the shared branch because that would risk the other goal's delivered work.

## Traps worth knowing

- A new fault-source literal changes the status protocol even though successful status has the same
  fields. The schema therefore moved from 2 to 3, and the Framework inspection plus two CLI status
  fixtures had to move with it.
- The observer must see committed identity before it runs, but it must run before the next system
  step. Deferring all callbacks until `advance()` returns would expose only the final state and would
  let later steps run after a callback failure.
- The generated API pages share one Framework source digest. A one-module source change updates the
  digest header on all 14 pages even when only the engine-session page changes content.
- `runtime.ts` is now 579 lines, inside the repository's cohesion-review band. It remains one
  session state machine, while validation, protocol parsing, and the public contract already live
  in separate modules. Extracting the callback would split the counters and fault transition that
  make its ordering safe.
- The anti-slop structure checker reported the new test as uncollected, but the Framework package
  command executed it by name and reported all 10 cases. The checker selected the wrong test oracle
  for this npm workspace; its finding is contradicted by the runner output.

## Evidence

| Check | Result |
|---|---|
| Test-first observer behavior | Initial focused run: 7 tests, 5 failures. Missing one-step, catch-up, single-step, partial-success, and observer-fault behavior all failed before the runtime change. |
| Status visible during callback | Follow-up test failed with `0 !== 1` before counters moved ahead of the callback; it passes now. |
| Focused observer suite | 10/10 pass. Covers zero, one, maximum catch-up, single-step/stale, later system failure, frame and tool observer failure, all non-step exclusions, construction validation, immutable identity, and reentrant authority rejection. |
| Existing EngineSession suite | 20/20 pass unchanged beside the new suite. |
| `npm run typecheck --workspace @antiky/framework` | Exits 0. |
| `npm test --workspace @antiky/framework` | 164/164 pass; generated API check is current. |
| `npm run typecheck --workspace @antiky/cli` | Exits 0 after the two status fixtures moved to schema 3. |
| `npm test --workspace @antiky/cli` | 143/143 pass with loopback test authority. |
| CLI documentation contract | 12/12 pass, including local links and generated API freshness. |
| CLI adapter audit | `projectDevelopmentSessionStatus` parses the shared Framework status; session controls and capture use the existing typed identity and fences. No adapter or MCP tool added. |
| Documentation audit | How-to guide remains task-oriented; public names and fault behavior match source. Anti-slop prose check reports 0 findings. |
| Repository `npm test` | Current run stops at 90/94 repository tests because Goal 16's concurrent patch work still has four red checks: version parity, global patch idempotence, WebGPU perspective, and render-target readback. Workspaces do not start. |
| Repository typecheck | All TypeScript workspaces pass. The independent Studio Tauri native check still stops on its stale generated permissions path under the old `emberwyrd/antikySite` checkout. |

## What this unblocks

- Goal 19 can attach game-owned live observation to every completed fixed step without adding a
  history store, browser dependency, CLI dependency, or second transport.
- A capture adapter can correlate the current Framework status with the exact immutable step record
  before another catch-up step begins.

## What remains blocked

- Goal 18 needs one final repository `npm test` exit 0 after Goal 16 finishes its concurrent patch
  reinstall. No Goal 18 behavior, owner decision, or scope boundary is blocking that run.
- Goal 19 still waits for Goal 16's BroMetal/demo file lock in addition to this Goal 18 completion.
