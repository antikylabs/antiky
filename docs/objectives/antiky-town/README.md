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
| [`RELEASE_VERSIONING_A.md`](RELEASE_VERSIONING_A.md) | Defines the independent version and release direction for Slice 12. |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines how to plan, run, and close each slice. |
| [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) | Supplies the copyable contract for a new slice. |
| [`slice-list.md`](slice-list.md) | Lists the short active slice sequence. |
| [`slice-00/`](slice-00/plan.md) | Contains the Slice 00 plan, owner input, and run outputs. |
| [`slice-01/`](slice-01/plan.md) | Contains the Slice 01 plan, owner input, and run outputs. |

## Start here

1. Read [`slice-list.md`](slice-list.md) for the short active sequence.
2. Read the development-harness research if you need the design background.
3. Review the completed [Slice 00 receipt](slice-00/outputs/s00-20260804T205140Z/receipt.json).
4. Review the accepted decisions in [`slice-01/owner-input_H.md`](slice-01/owner-input_H.md).
5. Run the ready Slice 01 goal.

```text
/goal implement docs/objectives/antiky-town/slice-01/plan.md until complete
```

Agents maintain the workflow and plans in ASD-STE100 style. The project owner controls the inline
answers in each `_H` owner-input file.
