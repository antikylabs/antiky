# Feedback 04 plan: Start development with the project

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` until Feedback 03 loads explicit projects |
| Feedback source | [Slice 00 feedback, line 4](slice-feedback.txt) |
| Outcome | Opening a project starts or attaches to its CLI-owned development session without terminal work |
| Owner input | The source feedback supplies the product direction |
| Architecture decisions | [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md) and [CLI 0001](../../../adr/cli/0001-use-mcp-tools-for-development_H.md) |
| Depends on | [Feedback 03](feedback-03-load-game-plan.md) |
| Alignment revision | `dd0eda5d8c4f4273e0cab8b3a5bfa843b8d17b40` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-04/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-04-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-04-auto-start-development-plan.md until complete
```

## Feedback

> I don't want to have to launch a separate `npm antiky dev` after opening studio. That should be
> done automatically on opening a project. The terminal should be for me starting codex or something.

## Outcome

Project open is the one command that starts everything Studio needs for development.

### Observable behavior

- Opening a valid project automatically starts its game, shader watcher, inspection service, and MCP.
- Studio attaches when the same project already has one healthy compatible session.
- Studio shows `starting`, `ready`, `failed`, `stopping`, and `stopped` states without parsing terminal text.
- A user can stop or restart the owned development session from Studio.
- The integrated terminal remains an independent shell for Codex or other developer commands.
- Closing or switching the project stops only the development process that this Studio instance owns.

### Non-goals

- Do not implement a second game launcher in Rust, React, or the terminal.
- Do not capture, parse, or retain the terminal transcript.
- Do not kill a healthy session that Studio only attached to.
- Do not add release packaging, remote development, background daemons, or production servers.

## Chosen shape

Studio starts the existing `antiky dev` executable as a narrow managed child. The CLI remains the
development host and owns the game, shader watcher, inspection, MCP, descriptor, and their cleanup.

```text
project open -> Tauri project-process adapter -> `antiky dev --project <file>`
                                              -> game and shader child processes
                                              -> inspection and MCP
Studio app <- shared DevelopmentClient <------ session descriptor
terminal -> independent PTY -> user's shell or coding agent
```

The native adapter owns only the CLI child handle and its standard lifecycle signals. It does not
reimplement CLI startup. It receives structured startup facts through the session descriptor and
DevelopmentClient, not through standard output.

Before spawning, Studio asks the shared connection service for a healthy session with the same
canonical manifest path and manifest hash. It attaches when they match. It rejects a conflicting or
incompatible session. It never starts a second session on the same fixed ports.

### Options considered

- **Supervise the CLI executable — selected.** Tauri owns one bounded child handle. The CLI keeps all
  development launch rules and its existing test surface.
- **Reimplement launch in Rust — rejected.** This creates a second host and lets CLI and Studio drift.
- **Extract a general launch framework — deferred.** Add it only if a second in-process JavaScript
  consumer proves that invoking the CLI is insufficient.

## Required reading

- [Source feedback](slice-feedback.txt)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Feedback 03](feedback-03-load-game-plan.md)
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md) and [CLI 0001](../../../adr/cli/0001-use-mcp-tools-for-development_H.md)
- [Studio connection guide](../../../user-facing-docs/studio/development-connection.md) and [CLI development guide](../../../user-facing-docs/cli/development.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md) and [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Unity Hub](https://docs.unity.com/en-us/hub/project-manage), [Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/opening-an-existing-unreal-engine-project),
  and [Godot](https://docs.godotengine.org/en/latest/tutorials/editor/project_manager.html) make
  project open the entry to editor services. They do not require a second terminal for the editor host.
- [Phaser](https://phaser.io/tutorials/create-game-app) and [Bevy](https://github.com/bevyengine/bevy/blob/main/examples/README.md)
  delegate build and run work to normal project commands. Antiky continues to use the commands
  declared in the project manifest.
- [PlayCanvas](https://developer.playcanvas.com/user-manual/editor/projects/downloading/) keeps the
  editable project and its runnable output explicit. Automatic startup operates on the source project.
- Tauri's native layer can supervise a bounded child, but [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md)
  requires the same CLI launch behavior. Therefore Tauri invokes the CLI instead of copying it.
- [CLI 0001](../../../adr/cli/0001-use-mcp-tools-for-development_H.md) requires `antiky dev` to start
  MCP with the game host. Automatic Studio startup keeps this one-command rule.
- `npm ls brometal` and the [npm registry](https://registry.npmjs.org/brometal/latest) both report
  BroMetal `0.15.0` on `2026-08-06`. The CLI continues to run the project's existing BroMetal watcher.
  Studio adds no compile or GPU behavior.
- `UNDER_REVIEW_A.md` candidate 5 was reviewed. This plan resolves the immediate use case without
  embedding engine authority: authority remains in the separate CLI development host.

## Current state

- `antiky dev` already starts and cleans the game, shader watcher, inspection, and MCP services.
- Studio only polls for `.antiky/dev-session.json`; it cannot start or stop the CLI.
- The current user guide tells the user to type `npm run antiky -- dev` in the embedded terminal.
- The terminal and Studio connection are independent, but the manual command makes them look coupled.

## Deliverables

- Add an explicit project-path form to every development command. Remove config-only wording.
- Add one native `ProjectDevelopmentProcess` adapter for start, status, graceful stop, forced stop after
  timeout, and disposal.
- Add structured Studio host commands for start, stop, restart, and ownership status.
- Add a project-development coordinator that starts after project validation and connects after readiness.
- Add clear recovery actions for busy ports, missing commands, child exit, incompatible session,
  connection timeout, and cleanup failure.
- Remove instructions and UI that use the integrated terminal to start normal Studio development.
- Update Studio, CLI, MCP, and architecture documentation in the same checkpoint.

## Safe behavior

- Pass the canonical manifest path as one argument. Never use a shell command string.
- Start only after full project validation and fixed-port reservation.
- Record whether the session is `owned` or `attached`. Stop only an owned session.
- Send graceful termination first. Use one bounded timeout before forced termination of the owned
  process group. Record any forced stop as a failure disposition.
- Dispose one owned process exactly once on project switch, window close, app exit, or failed startup.
- Keep the terminal and launcher usable after development fails.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Add failing auto-start and ownership tests; record current manual baseline | Red integration tests and baseline | `Specify Studio development startup` |
| `CP-01` | Add CLI project-path parity and native process adapter | CLI and Rust lifecycle tests | `Share Studio development launch` |
| `CP-02` | Add coordinator, states, attach, stop, restart, and recovery UI | Studio integration and fault tests | `Start projects from Studio` |
| `CP-03` | Update docs and verify clean open-to-ready cycles | Three-cycle native run and receipt | `Verify Studio development startup` |

## Test plan

- Add the reported manual-start regression first. Prove project open currently never starts a session.
- Test fresh start, existing matching attach, stale descriptor, mismatched project, busy ports, missing
  command, child crash, readiness timeout, stop, restart, project switch, and app close.
- Prove CLI, Studio, MCP, and human `antiky tool` commands observe the same session and results.
- Prove the terminal opens and runs an independent command while automatic development is active.
- Run three open-ready-close cycles. Confirm no descriptor, process, listener, port, or PTY remains.
- Use Computer Use or owner-reviewed capture to verify startup progress, ready state, failure recovery,
  restart, and terminal independence. This visual usability gate requires actual interaction.
- Run CLI tests, Studio app tests, Rust tests, native build, and `npm run check`.

## Completion checks

- [ ] Opening a project starts all required development services without terminal input.
- [ ] A matching existing session attaches without duplication.
- [ ] Owned and attached sessions have correct, tested stop behavior.
- [ ] The terminal is free for Codex or normal shell work.
- [ ] Start, failure, restart, switch, close, and cleanup states are honest and recoverable.
- [ ] CLI, Studio, and MCP use one development host and one service meaning.
- [ ] Actual visual usability evidence and three clean lifecycle cycles pass.
- [ ] User docs, repository checks, receipt, and slice summary pass.

## Run and evidence rule

- Use one fixture project, fixed isolated ports, one Studio window, and one CLI process group per attempt.
- Keep the passing manual `antiky dev` behavior as the rollback point until Studio parity passes.
- Roll back if Studio duplicates launch rules, kills an attached session, leaks a child, or needs terminal text.
- CLI maintainers own launch behavior. Studio maintainers own child supervision and presentation.
