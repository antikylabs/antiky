# Antiky Town objective

This folder records the Antiky Town direction, slice workflow, completed slice history, and one
current roadmap. The game project is in
[`packages/demos/antiky-town`](../../../packages/demos/antiky-town/README.md).

Antiky Town is a standalone game project. It owns game rules, state, systems, shaders, assets,
render data, tests, and one game-module entry. CLI, Studio, website, and test hosts mount its
compiled game module.

## Current state

- Slices 00 through 02 are complete.
- The old Slice 03 character plan and Slice 04 asset plan are superseded and are not executable.
- The next slice is in planning. It must first qualify the Nexus and BroMetal integration.
- [`slice-list.md`](slice-list.md) is the only active Town roadmap.

## Documents

| Document | Purpose |
| --- | --- |
| [`slice-list.md`](slice-list.md) | Gives the current result, next slice, and unordered backlog. |
| [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md) | Defines the stable Town direction and boundaries. |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines how to plan, run, and close a slice. |
| [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) | Supplies the plan template for a new slice. |
| [`_completed/`](_completed/) | Keeps completed Slice 00 through 02 plans and summaries. |
| [`_superseded/`](_superseded/) | Keeps retired plans for history. Do not run them. |
| [`../general-stuff/`](../general-stuff/) | Keeps shared research for development and inspection. |

## Start here

1. Read [`slice-list.md`](slice-list.md).
2. Read [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md).
3. Read the accepted Framework ADRs named by the implementation plan.
4. Complete current Nexus and BroMetal research and a bounded qualification probe.
5. Create a fresh slice plan from [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md).

Do not run a plan under `_superseded/`. Do not create a new numbered plan until its visible outcome,
dependency qualification, ownership, tests, and safe failure behavior are ready.
