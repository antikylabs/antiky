# Antiky Studio objectives

This folder holds executable slices for Antiky Studio. Studio is a visual client of the same Antiky
development and engine services used by the CLI, MCP, and tests. It does not own a second game
runtime or a second set of engine rules.

Studio source has two product boundaries:

- `packages/studio/app` is the portable web application.
- `packages/studio/tauri` is the native Tauri host and `libghostty` integration.

The website is the visual source of truth. Studio uses the website's typography, palette, spacing,
brand assets, sparse violet accent, status language, and media-first composition. The
[Studio concept render](../../user-facing-docs/assets/antiky-studio-town-concept.png) supplies
workspace and workflow direction. It does not replace the website design system or define features
that a slice has not implemented.

## Documents

| Document | Purpose |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Directs agents to the shared workflow and Studio-specific sources. |
| [`slice-list.md`](slice-list.md) | Lists active Studio slices. |
| [`slice-00/plan.md`](slice-00/plan.md) | Opens the first live development and inspection workspace. |
| [Shared slice workflow](../antiky-town/SLICE_WORKFLOW_A.md) | Controls planning, implementation, evidence, and closeout. |
| [Studio architecture](../../architecture/studio/overview_A.md) | Defines the editor, host, and shared-service boundaries. |

## Start here

Read the complete Slice 00 plan, then run:

```text
/goal implement docs/objectives/studio/slice-00/plan.md until complete
```

Do not create later Studio slices until Slice 00 evidence and owner feedback show the next complete
workflow.
