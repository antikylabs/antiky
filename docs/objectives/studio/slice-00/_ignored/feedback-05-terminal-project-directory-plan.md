# Feedback 05 plan: Start the terminal in the project

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` until Feedback 03 supplies an explicit project context |
| Feedback source | [Slice 00 feedback, line 5](../slice-feedback.txt) |
| Outcome | Each Studio terminal starts in the root of the project open in that window |
| Owner input | The source feedback supplies the product direction |
| Architecture decisions | [Studio 0001](../../../../adr/studio/0001-ai-integrations_H.md) and [Studio 0002](../../../../adr/studio/0002-tauri-portable-web-editor_H.md) |
| Depends on | [Feedback 03](../feedback-03-load-game-plan.md) |
| Alignment revision | `dd0eda5d8c4f4273e0cab8b3a5bfa843b8d17b40` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-05/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-05-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-05-terminal-project-directory-plan.md until complete
```

## Feedback

> Terminal should init in folder that the `.antiky` project is open in.

## Outcome

The terminal's initial working directory always equals the canonical parent of the active `.antiky` file.

### Observable behavior

- The terminal does not open before a project is valid and active.
- A new shell starts in the active project root, independent of how Studio itself was launched.
- Reopening the terminal uses the same project root.
- Switching projects closes the old PTY and opens a new PTY in the new project root.
- The terminal remains for the user's shell, Codex, or another coding agent.

### Non-goals

- Do not run `antiky dev` in the terminal.
- Do not capture or parse terminal output.
- Do not restore shell processes across a project switch or Studio restart.
- Do not change the user's shell, profile, environment, or command history.

## Chosen shape

Pass the canonical `ProjectContext.root` to the existing libghostty terminal adapter. The native
adapter sets that path as the PTY working directory before it starts the user's shell.

```text
validated `.antiky` path -> canonical parent -> ProjectContext.root
                                             -> terminal open -> PTY cwd -> user shell
```

No React component calculates or rewrites the path. The browser app requests a terminal for the
current project identity. Tauri verifies that identity against native state before it opens the PTY.

## Required reading

- [Source feedback](../slice-feedback.txt)
- [Studio objective guidance](../../AGENTS.md) and [slice workflow](../../../antiky-town/SLICE_WORKFLOW_A.md)
- [Feedback 03](../feedback-03-load-game-plan.md)
- [Studio architecture](../../../../architecture/studio/overview_A.md)
- [Studio 0001](../../../../adr/studio/0001-ai-integrations_H.md) and [Studio 0002](../../../../adr/studio/0002-tauri-portable-web-editor_H.md)
- [Studio getting started](../../../../user-facing-docs/studio/getting-started.md)
- [ADRs under review](../../../../adr/UNDER_REVIEW_A.md) and [Good Engineering](../../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Unity Hub](https://docs.unity.com/en-us/hub/project-manage), [Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/opening-an-existing-unreal-engine-project),
  and [Godot](https://docs.godotengine.org/en/latest/tutorials/editor/project_manager.html) treat the
  selected project root as the context for project tools.
- [Phaser](https://phaser.io/tutorials/create-game-app) and [Bevy](https://github.com/bevyengine/bevy/blob/main/examples/README.md)
  commands run from their normal package roots. Antiky preserves that expectation.
- PlayCanvas keeps editable project commands in its downloaded npm project. Antiky uses the same
  explicit working-directory rule.
- [Studio 0001](../../../../adr/studio/0001-ai-integrations_H.md) makes the terminal the user's coding-tool
  surface. A correct working directory lets Codex see the intended project without an extra `cd`.
- The existing libghostty bridge already accepts a project directory. This plan replaces the inferred
  `INIT_CWD` value with the explicit validated project root.
- `npm ls brometal` and the [npm registry](https://registry.npmjs.org/brometal/latest) both report
  BroMetal `0.15.0` on `2026-08-06`. Terminal CWD changes no shader or GPU behavior.
- No item in `UNDER_REVIEW_A.md` is necessary for this bounded native lifecycle correction.

## Current state

- `packages/studio/tauri/src/lib.rs` derives `project_directory` from `INIT_CWD` or process CWD.
- `terminal_open` passes that inferred directory to the native terminal bridge.
- The native contract test proves directory preference, not `.antiky` project identity.

## Deliverables

- Replace inferred startup CWD with the canonical root in the active `ProjectContext`.
- Require the project identity on terminal open and reject a stale project request.
- Close and dispose the PTY before project state changes.
- Keep terminal error, reopen, focus, resize, Unicode input, and clean-exit behavior unchanged.
- Update Studio terminal guidance and remove instructions that require a manual `cd`.

## Safe behavior

- Canonicalize the manifest and parent before terminal creation. Reject missing roots and file paths.
- Do not accept a webview-supplied arbitrary directory.
- Do not change CWD of the Studio process or development host.
- Dispose the old shell exactly once before opening one for another project.
- Keep the rest of Studio usable after a shell-start or CWD failure.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Add a failing explicit-project CWD regression | Red Rust/native contract test | `Specify project terminal context` |
| `CP-01` | Bind terminal open, reopen, and switch to ProjectContext | Rust, app, and PTY tests | `Open terminals in project roots` |
| `CP-02` | Update docs and verify native interaction | Native usability run and receipt | `Verify project terminals` |

## Test plan

- Add the reported regression first. Launch Studio from one directory and open a project in another.
- Test normal path, spaces, Unicode, symlinked selection, deleted root, stale project identity, reopen,
  switch, close during startup, child exit, and disposal.
- Use a bounded test child to report its CWD. Do not add transcript capture to the product.
- Use Computer Use or owner review to type `pwd`, start a coding-agent command, focus the canvas, return
  to the terminal, switch projects, and confirm the new root. Save actual interaction evidence.
- Run Studio app tests, Rust tests, native build, and `npm run check`.

## Completion checks

- [ ] Every new terminal starts in the active `.antiky` project root.
- [ ] Launch directory and repository directory cannot override project context.
- [ ] A project switch cannot keep the old PTY or CWD.
- [ ] Studio does not capture terminal output or use it to start development.
- [ ] Focus, resize, reopen, exit, and cleanup remain correct.
- [ ] Actual native usability evidence, docs, tests, and complete check pass.
- [ ] The receipt validates and records paths only in redacted form.

## Run and evidence rule

- Use two disposable project roots outside the repository and one PTY at a time.
- Keep the passing libghostty embed commit as the rollback point.
- Roll back if a webview can choose an arbitrary CWD, a PTY survives a switch, or transcript capture appears.
- Studio native maintainers own terminal lifecycle and feedback.
