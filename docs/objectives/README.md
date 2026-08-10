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
| [Antiky Town](antiky-town/README.md) | [Town roadmap](antiky-town/slice-list.md) | Develops the Town game and proves reusable Framework paths through player-visible slices. |

## Archived objectives

| Objective | Summary |
| --- | --- |
| [Asset catalog](_archives/asset-catalog-summary.md) | Records the shipped static catalog, research conclusions, source posture, and durable admission rules. |
| [Antiky Studio](_archives/studio-summary.md) | Records the shipped Studio workspace, project model, shared development services, and durable boundaries. |

## Slice workflow

The [slice delivery workflow](antiky-town/SLICE_WORKFLOW_A.md) and
[plan template](antiky-town/SLICE_PLAN_TEMPLATE_A.md) apply to objectives that use slices. Read the
selected objective's `README.md`, roadmap, scoped instructions, and complete plan before
implementation.

A project folder can contain these records:

| Record | Purpose |
| --- | --- |
| `slice-list.md` | Gives the current roadmap and selects the next complete result. |
| `slice-NN/plan.md` | Defines one executable outcome, its boundaries, gates, and proof. |
| `slice-NN/slice-summary.md` | Keeps the commit, verification results, and essential measurements after closeout. |
| `_completed/` | Temporarily groups completed plans while the larger objective remains active. |
| `_superseded/` | Temporarily keeps retired plans while their historical context is still needed. Never execute these plans. |

Keep implementation in `packages/`. Keep durable usage guidance in
[`../user-facing-docs/`](../user-facing-docs/README.md). Raw run evidence and temporary verification
belong in ignored `outputs/` and `verification/` directories or in CI artifacts. Remove local
evidence directories after closeout and keep the short slice summary.

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
