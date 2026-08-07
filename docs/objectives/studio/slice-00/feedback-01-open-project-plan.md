# Feedback 01 plan: Open an Antiky project

## Control

| Field | Value |
| --- | --- |
| Status | `IN PROGRESS — FINAL VERIFICATION` |
| Feedback source | [Slice 00 feedback, line 1](slice-feedback.txt) |
| Outcome | A user opens one `<name>.antiky` file and Studio binds one workspace to that file's project root |
| Owner input | The source feedback supplies the product direction |
| Architecture decisions | [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md) and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md) |
| Depends on | Completed Studio Slice 00 |
| Alignment revision | `306435a1647901d0021035746c9fe623d9ea27ac` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-01/verify.mjs` |
| Evidence | [Run `studio-s00-feedback-01-20260806T233318Z`](outputs/studio-s00-feedback-01-20260806T233318Z/receipt.json) |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-01-open-project-plan.md until complete
```

## Feedback

> I want to have it "open a project" which means we need a project boundry etc, and when that
> opens a `<name>.antiky` file it opens the studio, or the studio you open project and find a
> `.antiky` file to open.

## Outcome

A `.antiky` file is the one visible and machine-readable boundary for an Antiky game project.

### Observable behavior

- A user can double-click a `.antiky` file to open it in the packaged desktop Studio.
- A user can select **Open project** in Studio and choose a `.antiky` file.
- The parent directory of the selected file becomes the project root.
- Studio shows the validated project name, manifest path, schema version, and project root.
- CLI and Studio give the same result for the same manifest.
- Studio rejects a missing, oversized, malformed, incompatible, or ambiguous manifest before it
  starts a development process.

### Non-goals

- Do not add a project template gallery, cloud project list, source-control client, or package manager.
- Do not support multiple open projects in one Studio window.
- Do not keep `antiky.config.json` as a second source of project truth.
- Do not add game-authoring state to the project manifest.

## Chosen shape

Use strict JSON inside a custom `.antiky` file. Keep value validation in one browser-safe CLI module.

```text
Finder or Studio file picker -> bounded Tauri file read -> shared project parser
CLI explicit path or current directory ----------------^ -> immutable project description
                                                        -> Studio workspace
```

The manifest contains the project display name, schema version, development launch data, local
network data, viewport, and build data. Paths are relative to the manifest. The parser rejects
unknown fields and paths that escape the project root. The implementation records the complete
schema in a project-boundary ADR before it changes code.

The named `<name>.antiky` file is tracked project input. The hidden `.antiky/` directory remains
temporary host state. The CLI creates an ignore marker inside that directory before it writes a
session credential. Documentation must show this distinction without calling both items “the config.”

An explicit manifest path wins. Without a path, the CLI accepts exactly one `.antiky` file in the
current directory. It does not walk parent directories. Zero or multiple files return a stable error.

The Tauri adapter owns native file selection, file association, canonical paths, and bounded file
reads. It does not own the manifest schema. `@antiky/cli/project` owns the pure schema parser. The
Node CLI owns file discovery and loading. The Studio app imports the same pure parser.

### Options considered

- **One named manifest — selected.** One file holds identity and launch/build configuration. It gives
  Finder, Studio, CLI, and source control the same boundary.
- **A `.antiky` pointer plus `antiky.config.json` — rejected.** Two files can disagree and every client
  needs precedence rules.
- **A directory-only project — rejected.** It cannot supply the requested named file association and
  makes project discovery depend on hidden folder conventions.

## Required reading

- [Source feedback](slice-feedback.txt)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md) and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md)
- [Development harness research](../../general-stuff/DEV_HARNESS_RESEARCH_A.md)
- [Website design](../../../../packages/website/DESIGN.md) and [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Unreal Engine 5.8](https://dev.epicgames.com/documentation/unreal-engine/opening-an-existing-unreal-engine-project)
  opens a named `.uproject` file from disk or its project browser. Antiky uses this visible-file pattern.
- [Godot](https://docs.godotengine.org/en/latest/tutorials/editor/project_manager.html) imports a
  project folder or `project.godot`. Antiky uses the root-file pattern and a small launcher state.
- [Unity Hub](https://docs.unity.com/en-us/hub/project-manage) opens validated project folders and
  reports incompatible or missing versions. Antiky reports schema incompatibility before load.
- [Phaser](https://phaser.io/tutorials/create-game-app) and [Bevy](https://github.com/bevyengine/bevy/blob/main/examples/README.md)
  use normal source projects and build tools. Antiky keeps the manifest declarative and does not put
  engine state in it.
- [PlayCanvas](https://developer.playcanvas.com/user-manual/editor/projects/downloading/) separates
  editable projects from runnable builds. Antiky keeps the source manifest separate from build output.
- [Tauri 2](https://v2.tauri.app/reference/config/#fileassociation) supports custom file associations.
  Its macOS `RunEvent::Opened` supplies the selected file URL.
- `npm ls brometal` reports BroMetal `0.15.0`. The [npm registry](https://registry.npmjs.org/brometal/latest)
  reports the same latest version on `2026-08-06`. This plan changes no render or GPU path. Project
  loading must preserve the current BroMetal shader commands.
- `UNDER_REVIEW_A.md` candidates 5 and 16 were reviewed. Candidate 5 is not required because the
  CLI development host remains a separate authority. Candidate 16 belongs to Feedback 07.

## Current state

- `packages/cli/src/config.ts` reads only `antiky.config.json` and combines project and launch data.
- `packages/studio/tauri/src/connection.rs` accepts a directory and reads only `.antiky/dev-session.json`.
- `packages/studio/tauri/src/lib.rs` infers a directory from `INIT_CWD`.
- `packages/studio/app/src/development/native.ts` has no project-open host operation.
- `packages/studio/tauri/tauri.conf.json` has no `.antiky` file association.

## Deliverables

- Record the versioned `.antiky` manifest, discovery, path, migration, and ownership rules in an ADR.
- Add a pure, bounded project parser and immutable project description under `@antiky/cli/project`.
- Add Node file discovery and explicit project-path loading without shell execution.
- Replace the repository `antiky.config.json` with one named `.antiky` manifest.
- Add a narrow `EditorHost` project-open operation and its Tauri adapter.
- Add the `.antiky` file association and handle cold-start and already-running open events.
- Enable a local macOS application bundle for file-association proof. Do not add release distribution.
- Add an empty launcher view with **Open project** when Studio starts without a project.
- Update the CLI and Studio user guides. Include the manifest schema and migration command.

## Safe behavior

- Read at most 64 KiB. Reject control characters, unknown fields, unsupported versions, unsafe paths,
  non-files, and symlink escapes.
- Never run project code while Studio only validates a manifest.
- Never put the hidden `.antiky/` runtime directory or its credential under source control.
- Keep the current workspace unchanged when a new manifest fails validation.
- Treat the canonical manifest path as the local project identity. Treat its content hash as its revision.
- Clear connection and inspection data before a different valid project becomes active.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Capture current config, Studio startup, and file-open baselines; record the ADR | Baseline facts and ADR review | `Define Antiky projects` |
| `CP-01` | Add the shared parser, loader, discovery, migration, and regression tests | CLI contract tests | `Add Antiky project manifests` |
| `CP-02` | Add Tauri file selection, association, open events, and launcher UI | Rust, app, cold-open, and warm-open tests | `Open projects in Studio` |
| `CP-03` | Update general docs and complete evidence | Clean complete check and visual capture | `Verify Studio project opening` |

## Test plan

- Add failing tests first for the current directory-only behavior and missing file association.
- Test valid input, exact keys, size limits, schema mismatch, malformed JSON, zero files, multiple files,
  explicit paths, symlink escape, Unicode names, and canonical paths.
- Prove CLI and Studio parse one fixture into the same immutable project description.
- Test cold Finder open, in-app open, same-project reopen, different-project switch, cancel, and invalid file.
- Use Computer Use or an owner-reviewed capture to verify the launcher, picker return, project identity,
  focus, keyboard access, error state, and website-aligned visual language. Do not pass this gate from
  source review alone.
- Run affected CLI, Studio app, Rust, build, and repository checks.

## Completion checks

- [x] One `.antiky` file defines one project root and one validated project description.
- [x] Finder and Studio can open the same valid manifest.
- [x] CLI and Studio reject the same invalid manifests with stable, useful errors.
- [x] Studio never starts project code during validation.
- [x] The old config does not remain as a second source of truth.
- [x] Actual visual usability evidence is linked in the receipt.
- [ ] User-facing docs, builds, tests, cleanup, and the complete check pass.
- [ ] The receipt validates and the slice summary records the change.

## Run and evidence rule

- Use the shared slice workflow for isolation, retries, failure classes, and receipt content.
- Use fixture project roots outside the repository for path and file-association tests.
- Keep the prior config loader commit as the rollback point until migration parity passes.
- Roll back if Studio runs unvalidated project code, opens the wrong root, loses the current workspace
  after a failed open, or accepts path escape.
- Studio and CLI maintainers own the delivered boundary. Record feedback in `slice-feedback.txt`.
