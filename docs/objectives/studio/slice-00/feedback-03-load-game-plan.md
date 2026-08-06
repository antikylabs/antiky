# Feedback 03 plan: Load a game as a project

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` until Feedback 01 defines project identity |
| Feedback source | [Slice 00 feedback, line 3](slice-feedback.txt) |
| Outcome | Studio starts as a project launcher and loads one selected game into one complete workspace |
| Owner input | The source feedback supplies the product direction |
| Architecture decisions | Feedback 01 project-boundary ADR, [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md), and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md) |
| Depends on | [Feedback 01](feedback-01-open-project-plan.md) and [Feedback 02](feedback-02-init-project-plan.md) |
| Alignment revision | `dd0eda5d8c4f4273e0cab8b3a5bfa843b8d17b40` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-03/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-03-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-03-load-game-plan.md until complete
```

## Feedback

> I want this to work like unity or unreal engine where you open a game and it loads.

## Outcome

Studio presents a clear launcher when no game is open and one project-owned workspace after selection.

### Observable behavior

- Starting Studio without a file shows recent projects and **Open project**.
- Selecting a recent project or `.antiky` file loads that game into the existing Studio workspace.
- The window title and workspace header show the project name and current load state.
- Studio remembers a bounded recent-project list outside project source control.
- Missing and incompatible recent entries stay visible with a useful recovery action.
- Opening another project performs an explicit project switch. It never mixes data from both games.

### Non-goals

- Do not copy Unity Hub, Epic Games Launcher, asset stores, templates, accounts, or cloud features.
- Do not add multi-project tabs or multiple projects in one workspace.
- Do not open a scene, world, or save file independently of its project.
- Do not start development through the integrated terminal. Feedback 04 owns automatic development.

## Chosen shape

Use a small host-owned project state machine. Keep portable presentation in the Studio app.

```text
no project -> launcher -> validating -> loading -> project workspace
                                |             |
                                v             v
                              error       switching -> cleanup -> validating
```

One Studio window has zero or one `ProjectContext`. A context includes the canonical manifest path,
project root, name, schema version, and manifest hash. It does not contain credentials, engine state,
or mutable game objects.

The Tauri host owns the recent-path store because it is local application state. The project manifest
does not contain recents. The Studio app owns launcher presentation and load-state transitions. The
shared parser owns project meaning.

## Required reading

- [Source feedback](slice-feedback.txt)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Feedback 01](feedback-01-open-project-plan.md) and [Feedback 02](feedback-02-init-project-plan.md)
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md) and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md)
- [Website design](../../../../packages/website/DESIGN.md) and [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Unity Hub](https://docs.unity.com/en-us/hub/projects-window-reference) lists recent projects,
  missing paths, editor versions, and open state. Antiky uses the clear list and recovery patterns.
- [Unreal Engine 5.8](https://dev.epicgames.com/documentation/unreal-engine/opening-an-existing-unreal-engine-project)
  supports recent projects, browse, direct `.uproject` open, and optional last-project loading.
- [Godot Project Manager](https://docs.godotengine.org/en/latest/tutorials/editor/project_manager.html)
  opens, imports, searches, and reports invalid projects before the editor workspace appears.
- [Phaser](https://phaser.io/tutorials/create-game-app) and [Bevy](https://github.com/bevyengine/bevy/blob/main/examples/README.md)
  projects stay normal source projects. Studio must not hide their package files.
- PlayCanvas separates project editing from static builds. Studio loads the source project here.
- `npm ls brometal` and the [npm registry](https://registry.npmjs.org/brometal/latest) both report
  BroMetal `0.15.0` on `2026-08-06`. Project loading causes no GPU work until the game's existing
  development host starts it.
- `UNDER_REVIEW_A.md` candidate 5 was reviewed. It does not block this plan because load state is
  editor state and engine authority remains in the CLI-owned process.

## Current state

- Studio immediately renders `App` and infers the project directory from `INIT_CWD`.
- There is no launcher, recent-project store, project switch, or visible validation state.
- Connection polling starts without an explicit project-selection state.
- The native terminal is global and must be closed before any project switch.

## Deliverables

- Add a versioned `EditorHost` contract for open, recent, forget, and switch operations.
- Add a bounded Tauri recent-project store with canonical paths, last-opened time, and manifest hash.
- Add a website-aligned launcher that works with keyboard, pointer, zoom, and reduced motion.
- Add one project-load coordinator. It sequences validation, workspace reset, terminal reset, and
  development startup without putting those rules in React panels.
- Clear the canvas, connection, hierarchy, stores, events, MCP calls, diagnostics, and terminal before
  publishing a different project context.
- Update the Studio getting-started and project-opening documentation.

## Safe behavior

- Persist at most 20 recent canonical manifest paths. Do not persist manifest contents or credentials.
- Do not automatically delete a missing project from recents. Let the user forget it.
- Cancel leaves the current project unchanged.
- A failed switch keeps the old project open when cleanup has not started. After cleanup starts, show
  an honest launcher error and never restore stale engine data as current.
- A manifest hash change causes complete revalidation before load.
- Project load must not use terminal output, DOM inspection, or a second engine control path.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Capture the current startup reference and add failing launcher-state tests | Reference capture and red tests | `Specify Studio project loading` |
| `CP-01` | Add host contract, recent store, and project state machine | Rust and coordinator tests | `Add Studio project lifecycle` |
| `CP-02` | Add launcher, switch, errors, and accessibility behavior | App tests and visual usability run | `Add Studio project launcher` |
| `CP-03` | Update docs and save complete evidence | Clean native run and receipt | `Verify Studio project loading` |

## Test plan

- Test no-project, first open, recent open, same-project reopen, cancel, forget, moved project, invalid
  schema, manifest change, and project switch.
- Test rapid selections and stale async results. Only the latest accepted selection can become active.
- Test that every old project-specific panel clears before the new context appears.
- Test recent-list capacity, ordering, duplicate canonical paths, corrupt store recovery, and no secrets.
- Use Computer Use or an owner-reviewed capture for first launch, keyboard navigation, open dialog,
  loading, ready, missing project, incompatible project, and switch. Visual usability evidence is a hard
  gate and cannot be replaced by component tests.
- Run Studio app tests, Rust tests, native build, CLI compatibility tests, and `npm run check`.

## Completion checks

- [ ] Studio has an honest project launcher instead of an inferred repository workspace.
- [ ] One user action loads one complete project context.
- [ ] Recent projects are bounded, local, recoverable, and never project state.
- [ ] A project switch cannot mix terminal, connection, game, or inspection data.
- [ ] Actual visual usability evidence covers the launcher and project workspace.
- [ ] User docs, tests, native build, cleanup, and the complete check pass.
- [ ] The receipt validates and the slice summary records the new workflow.

## Run and evidence rule

- Use two isolated fixture projects and distinct port pairs. Fail when either pair is busy.
- Keep the last passing single-project workspace as the rollback point.
- Roll back if a switch leaks state, the recent store enters the project, or an invalid project starts code.
- Studio maintainers own launcher health. Human feedback stays in `slice-feedback.txt`.
