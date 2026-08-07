# Antiky objectives

This folder is the index for active implementation plans and durable delivery records. Each
objective owns its roadmap, executable plans, and closeout summaries in a project folder. The
repository does not use a shared objective task queue or an automated agent loop.

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
| [Antiky Studio](studio/README.md) | [Studio roadmap](studio/slice-list.md) | Develops Studio workflows with the shared slice process. |

## Slice workflow

The [slice delivery workflow](antiky-town/SLICE_WORKFLOW_A.md) and
[plan template](antiky-town/SLICE_PLAN_TEMPLATE_A.md) apply to Town and Studio. Read the selected
objective's `README.md`, `slice-list.md`, scoped instructions, and complete slice plan before
implementation.

A project folder can contain these records:

| Record | Purpose |
| --- | --- |
| `slice-list.md` | Gives the current roadmap and selects the next complete result. |
| `slice-NN/plan.md` | Defines one executable outcome, its boundaries, gates, and proof. |
| `slice-NN/slice-summary.md` | Keeps the commit, verification results, and essential measurements after closeout. |
| `_completed/` | Keeps completed plans and their durable summaries. |
| `_superseded/` | Keeps retired plans for history. Never execute these plans. |

Keep implementation in `packages/`. Keep durable usage guidance in
[`../user-facing-docs/`](../user-facing-docs/README.md). Raw run evidence and temporary verification
belong in ignored `outputs/` and `verification/` directories or in CI artifacts. Remove local
evidence directories after closeout and keep the short slice summary.
