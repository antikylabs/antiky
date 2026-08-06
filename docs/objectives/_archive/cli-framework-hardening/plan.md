# Goal: Harden CLI and Framework Lifecycle Boundaries

## Control

| Field | Value |
| --- | --- |
| Status | `COMPLETE` |
| Owner | Antiky Framework and CLI maintainers |
| Outcome | CLI and Framework lifecycle failures are bounded, observable, retry-safe, and easier to maintain. |
| Scope | `packages/framework` and `packages/cli` |
| Completed | August 5, 2026 |

Goal command:

```text
/goal implement docs/objectives/cli-framework-hardening/plan.md until complete
```

## Required reading

- [`../../GOOD_ENGINEERING_H.md`](../../GOOD_ENGINEERING_H.md)
- [ADR 0007: Use commands to change world state](../../adr/framework/0007-commands-as-mutation-boundary_H.md)
- [ADR 0008: Let EngineSession own worlds](../../adr/framework/0008-engine-session-owns-worlds_H.md)
- [ADR 0010: Serialize at boundaries](../../adr/framework/0010-serialize-at-boundaries_H.md)
- [ADR 0016: Give platform work to the game host](../../adr/framework/0016-give-platform-work-to-game-host_H.md)
- [`world-and-session-model_A.md`](../../architecture/framework/world-and-session-model_A.md)
- [`overview_A.md`](../../architecture/framework/overview_A.md)

Read the relevant tests before changing behavior. Treat every pre-existing worktree change as
human-owned and preserve it.

## Work

Complete these as small, independently tested commits. For every confirmed defect, add a regression
to an existing test suite, observe it fail for the expected reason, and then fix it.

### 1. Fail closed when EngineSession work throws

- Define an explicit terminal fault contract for unexpected failures from systems, command
  handlers, input capture, and state-digest callbacks.
- Give input capture one explicit expected-rejection path that returns `INVALID_INPUT`; do not
  classify an arbitrary programming error as invalid player input.
- Do not allow a partially applied step or command to be retried as though nothing happened.
- Keep inspection and disposal available after a fault; reject later mutation with a stable result.
- Publish bounded fault information without exposing arbitrary callback data or stack traces.
- Update the lifecycle ADR and user-facing EngineSession documentation if the public mode or result
  contract changes.

### 2. Observe complete development source trees

- Make the build tracker detect created, modified, deleted, and renamed tracked files.
- Detect new tracked subdirectories after `antiky dev` starts.
- Preserve ignored dependency, output, VCS, and `.antiky` trees.
- Prove that a newly created source file moves the build snapshot to `pending` and that the next
  ready runtime advances the accepted revision.

### 3. Make development-session cleanup unconditional

- Attempt descriptor removal, watcher shutdown, child-process shutdown, and inspection-server
  shutdown even when an earlier cleanup operation fails.
- Always settle `session.stopped` and report a bounded cleanup result.
- Do not report cleanup complete while an owned child group, listener, or descriptor remains.
- Cover normal stop, signal stop, child failure, partial startup, and one injected cleanup failure.

### 4. Make action completion identity-safe

- Ensure an asynchronous capture completion can resolve or reject only the action that started it.
- Handle timeout, session stop, persistence failure, and a later action without cross-completing
  promises or writing a successful result after the action is stale.
- Use deterministic coordination in tests; do not add timing sleeps that can become flaky.

### 5. Keep disposed point-light services immutable

- Make every command path, including correction of an unknown command, leave all observable state
  unchanged after disposal.
- Do not fabricate an unrelated entity ID when a correction target does not exist.
- Include command-result history and duplicate-command behavior in the regression coverage.

### 6. Add useful diagnostics without building a logging framework

- Record major CLI lifecycle transitions and unexpected internal failures through one small,
  injectable diagnostic sink.
- Relate logs to the available development-session, runtime, action, or request identity.
- Never log credentials, authorization headers, full command payloads, or capture bytes.
- Keep user-facing errors concise while retaining enough internal context to debug a failure.

### 7. Reduce proven maintenance friction

- Split EngineSession transport parsing from the runtime state machine. Keep the shared mutable
  clock, lifecycle, controls, and command ordering together.
- Extract browser-envelope validation from `inspection-server.ts`; keep HTTP ownership and routing
  coherent.
- Apply the file-size guidance pragmatically. Do not split the point-light service merely to reach
  a line target if it remains one deep module.
- Remove exact source-file-layout assertions and prose-content assertions from the CLI test suite.
  Keep behavior tests, security-boundary tests, Framework import-boundary tests, and valuable
  end-to-end development-session tests.
- Do not replace removed assertions with standalone verification scripts or permanent slice-style
  package commands.

## Non-goals

- New gameplay, rendering, Studio, MCP tool, or Antiky Town behavior.
- A general scheduler, transaction framework, logging framework, or file-watching abstraction.
- Rollback of arbitrary mutations performed inside game callbacks.
- Broad renaming or formatting unrelated to the reviewed boundaries.

## Completion checks

- [x] An unexpected system, command-handler, input-capture, or digest failure cannot leave a session
      runnable with partially applied work and an unchanged logical counter.
- [x] New, changed, renamed, and deleted tracked files are observed after the watcher starts.
- [x] Cleanup attempts every owned resource, settles exactly once, and leaves test ports,
      descriptors, watchers, and child groups clean even when one cleanup step fails.
- [x] A timed-out or stopped capture cannot complete a later action.
- [x] Every point-light command path preserves all observable state after disposal.
- [x] Unexpected CLI failures produce safe correlated diagnostics.
- [x] `sessions/engine-session/runtime.ts` is below the 800-line decomposition threshold and has
      one clear runtime responsibility; every remaining production file above 500 lines has a
      documented cohesion judgment in the final handoff.
- [x] Brittle source-layout and documentation-prose assertions are gone without losing meaningful
      behavioral or security coverage.
- [x] Framework and CLI typechecks and tests pass, followed by one clean `npm run check`.
- [x] One real `antiky dev` start and stop leaves its configured ports free and removes the session
      descriptor.
- [x] No temporary verifier, ad hoc test outside the package suites, slice-specific script, or
      verification package command remains in the repository.

The implementation details and verification evidence are recorded in [the handoff](handoff.md).

Finish with a short handoff describing behavior changes, file moves, tests run, and any public API
or ADR changes.
