# Antiky Town Objectives

This folder is the system of record for the Antiky Town port. It holds project research, the port
plan, the shared slice workflow, and executable slice plans.

The implementation stays in
[`packages/demos/src/demos/antiky-town`](../../../packages/demos/src/demos/antiky-town/README.md).
Keep module READMEs beside that code. Keep planning, gates, owner choices, and delivery evidence in
this objective folder.

## Documents

| Document | Purpose |
| --- | --- |
| [`DEV_HARNESS_RESEARCH_A.md`](DEV_HARNESS_RESEARCH_A.md) | Researches the development host, inspection, reload, and GPU tools. |
| [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md) | Defines the staged Antiky Town port and its owner choices. |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines how to plan, run, and close each slice. |
| [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) | Supplies the copyable contract for a new slice. |
| [`slice-01-plan.md`](slice-01-plan.md) | Applies the contract to the first complete market-lamp object. |

## Start here

1. Read the development-harness research.
2. Review the implementation plan and resolve its owner choices.
3. Complete Slice 0.
4. Review the slice workflow and Slice 01 plan.
5. Run the Slice 01 goal only after every readiness gate passes.

```text
/goal implement docs/objectives/antiky-town/slice-01-plan.md until complete
```

Agents maintain these documents in ASD-STE100 style. The project owner controls product choices,
approved differences, and completion decisions.
