# Antiky objectives

This folder is the index for active implementation plans and archived objective summaries. Each
active objective owns its roadmap and executable plans in a project folder. When the objective is
complete, replace that folder with one durable summary in `_archives/`. The repository does not use
a shared objective task queue or an automated agent loop.

Before planning or implementing work, read:

- [`../VISION_DIRECTION_H.md`](../VISION_DIRECTION_H.md) for human-owned product direction.
- [`../GOOD_ENGINEERING_H.md`](../GOOD_ENGINEERING_H.md) before making design or architecture
  decisions.
- [`../README.md`](../README.md) for document ownership.
- The relevant records in [`../adr/`](../adr/README.md) and [`../aip/`](../aip/README.md). A plan
  applies accepted direction and decisions. It does not replace them.

## Active objectives

| Objective | Roadmap | Purpose |
| --- | --- | --- |
| [BroMetal request](brometal-request/README.md) | [Research summary](brometal-request/research/README.md) | Determines how Antiky should respond to the needs in BroMetal issue #8. |
| [Libraries](libraries/README.md) | [Research summary](libraries/research/README.md) | Explores semantic asset-pack enrichment and an owned, agent-usable BroMetal shader recipe library. |
| [Studio ACP](studio-acp/README.md) | [Research summary](studio-acp/research/README.md) | Adds a native ACP agent panel and automatic, revisioned selection-context handoff. |
| [Studio apps](studio-apps/README.md) | [Research summary](studio-apps/research/README.md) | Defines the first-party Studio app seam, composable workspace, and reusable WebGPU viewport boundaries. |

## Archived objectives

| Objective | Summary |
| --- | --- |
| [Asset catalog](_archives/asset-catalog-summary.md) | Records the shipped static catalog, research conclusions, source posture, and durable admission rules. |
| [Antiky Studio](_archives/studio-summary.md) | Records the shipped Studio workspace, project model, shared development services, and durable boundaries. |
| [Antiky Town (legacy)](_archives/antiky-town-summary.md) | Records the first three shipped Town slices, the superseded plans, and the current restart boundary. |

## Objective closeout and archive method

Use this method when the owner confirms that an entire objective is complete:

1. Read the full objective folder, its closeout summaries, maintained product documentation, and
   relevant repository history. Treat shipped behavior and current durable documentation as
   authoritative when old plan statuses are stale or an approach was superseded.
2. Write `_archives/<objective-name>-summary.md`. Record the delivered outcome, durable decisions and
   boundaries, important verification results and evidence limitations, work intentionally excluded,
   and the conditions under which future work should reopen the subject.
3. Keep the summary useful for future planning, but do not copy the working folder into the archive.
   Omit raw feedback, task ordering, temporary evidence paths, obsolete commands, and plan-by-plan
   detail unless a fact remains necessary to understand the shipped system.
4. Find references outside the objective folder. Point references that still need historical context
   to the archive summary. Remove references that only instructed readers to execute the completed
   plans.
5. Remove the complete objective folder, including nested `_completed/`, `_superseded/`, temporary
   verification, evidence, roadmap, and instruction files. The archive contains only the summary.
6. Update the active and archived objective indexes in this file.
7. Verify that the old folder is gone, the summary exists, no stale links remain, and
   `git diff --check` passes. Run tests only when the closeout changes code; do not add tests that
   freeze prose.
8. Commit the closeout as one focused documentation change without including unrelated worktree
   changes.

Archived summaries are historical context, not active plans. Future work starts in a new objective
folder with current requirements instead of restoring or executing an archived plan.
