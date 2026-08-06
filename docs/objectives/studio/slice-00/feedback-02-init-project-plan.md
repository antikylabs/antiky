# Feedback 02 plan: Initialize an Antiky project

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` until Feedback 01 defines the project manifest |
| Feedback source | [Slice 00 feedback, line 2](slice-feedback.txt) |
| Outcome | `antiky init` creates one safe `.antiky` project manifest in a selected game folder |
| Owner input | The source feedback supplies the product direction |
| Architecture decisions | Feedback 01 project-boundary ADR and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md) |
| Depends on | [Feedback 01](feedback-01-open-project-plan.md) |
| Alignment revision | `dd0eda5d8c4f4273e0cab8b3a5bfa843b8d17b40` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-02/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-02-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-02-init-project-plan.md until complete
```

## Feedback

> cli should have an init project command to create the `.antiky` file for studio to open

## Outcome

A developer can turn an existing game folder into an Antiky project with one predictable CLI command.

### Observable behavior

- `antiky init` creates `<folder-name>.antiky` in the current directory.
- `antiky init <name>` uses the supplied safe project name and file slug.
- `--directory <path>` selects another existing directory.
- The command prints the created manifest path and the next `antiky dev` and Studio actions.
- The created file passes the shared project parser and opens in Studio.
- A repeated command never overwrites a project file.

### Non-goals

- Do not install dependencies, run package scripts, initialize Git, or create remote services.
- Do not scaffold game source, assets, scenes, or a framework example in this feedback item.
- Do not add an interactive wizard before non-interactive use is complete.
- Do not infer arbitrary shell commands from project files.

## Chosen shape

`antiky init [name] [--directory path]` creates only the canonical manifest. It uses conservative npm
script defaults that the manifest names explicitly. A later template command can create source code.

The initializer calls the same manifest builder and parser used by CLI and Studio. It writes to a
temporary sibling file, validates that file, and creates the final path without replacement. It cleans
the temporary file after any failure.

```text
CLI arguments -> normalized name and target -> manifest builder -> shared parser
                                                      -> atomic create -> `<name>.antiky`
```

## Required reading

- [Source feedback](slice-feedback.txt)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Feedback 01](feedback-01-open-project-plan.md) and its accepted project-boundary ADR
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [CLI development guide](../../../user-facing-docs/cli/development.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md)
- [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Phaser Create Game](https://phaser.io/tutorials/create-game-app) separates project creation from
  later `npm run dev` use. Antiky first supplies a smaller manifest-only initializer.
- [Godot Project Manager](https://docs.godotengine.org/en/latest/tutorials/editor/project_manager.html)
  creates a named folder and project file, and rejects an invalid target.
- [Unreal Project Browser](https://dev.epicgames.com/documentation/en-us/unreal-engine/create-your-first-project-in-unreal-engine)
  creates the directory structure and named `.uproject` file together. Antiky defers templates but
  keeps the named project file.
- [Unity Hub](https://docs.unity.com/en-us/hub/projects) separates New Project from Open Project.
  Antiky keeps `init` separate from `dev` and Studio open.
- [Bevy](https://github.com/bevyengine/bevy/blob/main/examples/README.md) uses normal Cargo projects.
  This supports an initializer that does not hide the package manager.
- PlayCanvas offers editable npm projects and separate static builds. Feedback 06 owns project templates.
- `npm ls brometal` and the [npm registry](https://registry.npmjs.org/brometal/latest) both report
  BroMetal `0.15.0` on `2026-08-06`. Initialization records the normal shader command but does not run
  it or change GPU behavior.
- No item in `UNDER_REVIEW_A.md` is needed after Feedback 01 fixes the project contract.

## Current state

- `packages/cli/src/cli.ts` has `dev`, `inspect`, `mcp`, `tool`, and `generate`; it has no `init` command.
- The current loader accepts only an existing `antiky.config.json`.
- CLI tests have no atomic project-creation or overwrite coverage.

## Deliverables

- Add `antiky init [name] [--directory path]` and concise help output.
- Add a pure project-manifest builder beside the shared parser.
- Normalize the default display name and safe lowercase file slug without hiding the result.
- Use schema defaults approved in Feedback 01. Do not duplicate schema literals in the CLI command.
- Add stable errors for invalid names, invalid targets, an existing project, and create failure.
- Update CLI development and Studio getting-started documentation.

## Safe behavior

- Accept only an existing writable directory. Do not follow a selected path outside it during writes.
- Permit one `.antiky` file at the project root. Reject a second file even when its name differs.
- Use create-only file semantics. Do not add `--force` in this plan.
- Leave no partial file after validation, write, rename, interrupt, or permission failure.
- Do not execute `package.json`, scripts, dependency installers, or project code.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Add failing CLI behavior tests and freeze the generated manifest fixture | Red tests and fixture digest | `Specify project initialization` |
| `CP-01` | Add manifest builder, atomic create, errors, and CLI output | CLI and filesystem tests | `Add antiky init` |
| `CP-02` | Prove the generated project opens and update docs | CLI-to-Studio integration and docs review | `Verify project initialization` |

## Test plan

- Add the reported missing-command test first and confirm it fails before implementation.
- Test default name, explicit name, Unicode display name, slug normalization, selected directory, and help.
- Test existing same-name file, different `.antiky` file, unwritable target, target file instead of directory,
  interrupted write, malformed generated value, and cleanup.
- Parse the produced file through CLI and Studio. Confirm both report the same project root and name.
- Run `antiky init`, `antiky dev`, and Studio open against one minimal fixture project.
- Run affected CLI, Studio contract, type, build, and repository checks.

## Completion checks

- [ ] One command creates one valid `.antiky` file without other side effects.
- [ ] The command never overwrites or leaves a partial project file.
- [ ] CLI and Studio accept the generated file without translation.
- [ ] Output states what was created and what the user can do next.
- [ ] General CLI and Studio docs use the new command.
- [ ] Tests and the complete check pass from a clean fixture directory.
- [ ] The receipt validates and records the generated manifest digest without private paths.

## Run and evidence rule

- Use the shared slice workflow. Use disposable fixture directories for all creation tests.
- Keep Feedback 01's passing manifest parser as the rollback point.
- Roll back if initialization overwrites data, runs project code, or produces a file Studio cannot open.
- CLI maintainers own the initializer. Project creation feedback stays in `slice-feedback.txt`.
