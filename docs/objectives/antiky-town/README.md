# Antiky Town Objectives

This folder is the system of record for the Antiky Town port. It holds project research, the port
plan, the shared slice workflow, and executable slice plans.

The implementation stays in
[`packages/demos/src/demos/antiky-town`](../../../packages/demos/src/demos/antiky-town/README.md).
Keep module READMEs beside that code. Keep plans, owner-input files, and delivery evidence in this
objective folder.

## Documents

| Document | Purpose |
| --- | --- |
| [`DEV_HARNESS_RESEARCH_A.md`](DEV_HARNESS_RESEARCH_A.md) | Researches the development host, inspection, reload, and GPU tools. |
| [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md) | Defines the staged Antiky Town port and its feature choices. |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines how to plan, run, and close each slice. |
| [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) | Supplies the copyable contract for a new slice. |
| [`slice-00-owner-input_H.md`](slice-00-owner-input_H.md) | Contains the three Slice 00 questions for the project owner. |
| [`slice-00-plan.md`](slice-00-plan.md) | Starts the Antiky CLI, development host, and framework inspection. |
| [`slice-01-owner-input_H.md`](slice-01-owner-input_H.md) | Contains the two Slice 01 questions for the project owner. |
| [`slice-01-plan.md`](slice-01-plan.md) | Applies the contract to the first complete market-lamp object. |

## Start here

1. Read the development-harness research if you need the design background.
2. Answer the three questions in the Slice 00 owner-input file.
3. Run the Slice 00 goal after its owner-input status is `ANSWERED`.
4. Answer the two questions in the Slice 01 owner-input file.
5. Run the Slice 01 goal after Slice 00 is complete.

```text
/goal implement docs/objectives/antiky-town/slice-00-plan.md until complete
```

```text
/goal implement docs/objectives/antiky-town/slice-01-plan.md until complete
```

Agents maintain the workflow and plans in ASD-STE100 style. The project owner controls the inline
answers in each `_H` owner-input file.
