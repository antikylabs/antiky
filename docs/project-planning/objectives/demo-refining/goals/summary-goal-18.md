# Summary — goal 18: expose every completed simulation step to observers

**Status:** implementation and affected suites complete; the repository completion gate is blocked
by the independent Studio Tauri native-cache failure described below.

**Completed:** not yet
**Commits:** `4743a35` (shared Goal 16 and Goal 18 delivery commit), `733eeae`, `c4375c6`,
`d4f790e`
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

A later audit disproved the claim that every accepted captured input was deeply immutable. The
validator treated functions as primitive leaves and inspected objects with `Object.values` and
arrays with `Array.every`. A frozen outer object could therefore hide mutable closure state,
accessors, symbol or non-enumerable properties, and custom array properties. An observer mutation
made later systems see markers `[0, 1, 1]` in five cases and `[0, 1, 2]` for a frozen closure. The
validator now rejects callables and accessors and recursively inspects every own data descriptor
from `Reflect.ownKeys` before a system or observer can receive the input.

That descriptor fix still returned the caller's object. A later audit used a frozen `Proxy` over an
empty frozen object whose virtual `marker` read changed through its `set` trap. The proxy satisfied
the frozen-object checks, and catch-up systems again saw `[0, 1, 1]`. JavaScript does not expose a
reliable general Proxy detector. The session now enforces the same data-only policy by copying the
validated descriptor graph into fresh frozen plain objects and arrays. Systems and the observer
receive the one owned copy, so proxy traps do not cross the capture boundary. A separate regression
proves that the copy preserves ordinary records and arrays, symbol and non-enumerable keys, custom
array properties, and normal prototypes.

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
- `runtime.ts` is 566 lines, inside the repository's cohesion-review band. It remains one session
  state machine because extracting the callback would split the counters and fault transition that
  make its ordering safe. The bounded captured-input validation and copying responsibility has a
  private 69-line module; protocol parsing and the public contract remain separate.
- The anti-slop structure checker reported the new test as uncollected, but the Framework package
  command executed it by name and reported all 18 cases. The checker selected the wrong test oracle
  for this npm workspace; its finding is contradicted by the runner output.

## Evidence

| Check | Result |
|---|---|
| Test-first observer behavior | Initial focused run: 7 tests, 5 failures. Missing one-step, catch-up, single-step, partial-success, and observer-fault behavior all failed before the runtime change. |
| Status visible during callback | Follow-up test failed with `0 !== 1` before counters moved ahead of the callback; it passes now. |
| Immutable-input audit regressions | Before `c4375c6`: 10 pass and 6 fail. Nested mutable callable, accessor, symbol property, non-enumerable property, and custom array property cases exposed `[0, 1, 1]`; the frozen callable closure exposed `[0, 1, 2]`. After descriptor validation: 16/16 pass. |
| Proxy test-first regression | Before `d4f790e`: 16 pass and 2 fail. The frozen Proxy exposed `[0, 1, 1]` instead of three absent values, and the ordinary-shape guard proved the caller's object was still crossing the boundary. After owned canonicalization: 18/18 pass. |
| Focused observer suite | 18/18 pass. Covers zero, one, maximum catch-up, single-step/stale, later system failure, frame and tool observer failure, all non-step exclusions, construction validation, immutable identity, reentrant authority rejection, six rejected unsafe graph paths, Proxy isolation, and ordinary-shape preservation. |
| Core and observer EngineSession suites | 38/38 pass. The existing core contributes 20 unchanged cases beside the observer suite. |
| `npm run typecheck --workspace @antiky/framework` | Exits 0. |
| `npm test --workspace @antiky/framework` | 172/172 pass; generated API check is current at 14 pages. |
| `npm run typecheck --workspace @antiky/cli` | Exits 0 after the two status fixtures moved to schema 3. |
| `npm test --workspace @antiky/cli` | 143/143 pass with loopback test authority. |
| CLI documentation contract | 12/12 pass, including local links and generated API freshness. |
| CLI adapter audit | `projectDevelopmentSessionStatus` parses the shared Framework status; session controls and capture use the existing typed identity and fences. No adapter or MCP tool added. |
| Documentation audit | How-to guide remains task-oriented and now states the accepted captured-input graph. Public names and fault behavior match source. Anti-slop prose check reports 0 findings. |
| Anti-slop code and structure review | Manual code/test review found no disabled or tautological tests, placeholders, swallowed failures, or unexplained suppressions in the correction. The repository has no installed Oxlint anti-slop plugin. The structure checker selected a wrong monorepo test oracle and reported executed tests as uncollected; Framework 172/172 and CLI 143/143 contradict that finding. |
| Repository `npm test` under repository Node 22 | Root 106/106, camera 10/10, Framework 170/170, CLI, and all other JavaScript, web, and demo workspaces pass. The overall command exits 1 only after Studio Tauri's 25/25 JavaScript tests, when `cargo test` reads a stale generated permissions path under the old `emberwyrd/antikySite` checkout. No Goal 18 behavior fails. |
| Repository typecheck | All TypeScript workspaces pass. The independent Studio Tauri native check still stops on its stale generated permissions path under the old `emberwyrd/antikySite` checkout. |

## What this unblocks

- Goal 19 can attach game-owned live observation to every completed fixed step without adding a
  history store, browser dependency, CLI dependency, or second transport.
- A capture adapter can correlate the current Framework status with the exact immutable step record
  before another catch-up step begins.

## What remains blocked

- Goal 18 cannot satisfy the repository-exit-zero completion clause until the independent Studio
  Tauri generated-permissions cache stops referring to the old `emberwyrd/antikySite` checkout.
  Fixing Studio's native build cache is outside Goal 18's owned Framework, CLI protocol, and
  documentation files.
- Goal 19 still waits for Goal 16's BroMetal/demo file lock in addition to this Goal 18 completion.
