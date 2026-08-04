# Antiky Town Objectives

This folder is the system of record for the Antiky Town port. It holds project research, the short
slice roadmap, the shared workflow, and one folder for each executable slice.

The implementation stays in
[`packages/demos/src/demos/antiky-town`](../../../packages/demos/src/demos/antiky-town/README.md).
Keep module READMEs beside that code. Keep each plan, owner-input file, and delivery output in its
numbered slice folder.

When a slice changes how people use the framework, CLI, or Studio, update the matching area in
`docs/user-facing-docs/` during the same implementation checkpoint.

## Documents

| Document | Purpose |
| --- | --- |
| [`DEV_HARNESS_RESEARCH_A.md`](DEV_HARNESS_RESEARCH_A.md) | Researches the development host, inspection, reload, and GPU tools. |
| [`INSPECTION_TOOLING_A.md`](INSPECTION_TOOLING_A.md) | Defines the native inspection scope and the ideas kept from WebGPU Inspector. |
| [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md) | Defines the staged Antiky Town port and its feature choices. |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines how to plan, run, and close each slice. |
| [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) | Supplies the copyable contract for a new slice. |
| [`slice-list.md`](slice-list.md) | Lists the next ten slices in one short line each. |
| [`slice-00/`](slice-00/plan.md) | Contains the Slice 00 plan, owner input, and run outputs. |
| [`slice-01/`](slice-01/plan.md) | Contains the Slice 01 plan, owner input, and run outputs. |

## Start here

1. Read [`slice-list.md`](slice-list.md) for the short active sequence.
2. Read the development-harness research if you need the design background.
3. Review the accepted decisions in [`slice-00/owner-input_H.md`](slice-00/owner-input_H.md).
4. Run the ready Slice 00 goal.
5. Review the accepted decisions in [`slice-01/owner-input_H.md`](slice-01/owner-input_H.md).
6. Run the Slice 01 goal after Slice 00 is complete.

```text
/goal implement docs/objectives/antiky-town/slice-00/plan.md until complete
```

```text
/goal implement docs/objectives/antiky-town/slice-01/plan.md until complete
```

Agents maintain the workflow and plans in ASD-STE100 style. The project owner controls the inline
answers in each `_H` owner-input file.
