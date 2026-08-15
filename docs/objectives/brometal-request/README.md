# BroMetal request objective

**Phase:** Research complete; awaiting owner direction before planning.

The owner asked whether Antiky already covers the needs in
[BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8), whether Framework is a good
fit, and whether implementation should be planned. The original intent and concerns remain in
[`objective.md`](objective.md).

Research found that Antiky's direction fits the request, but its current product does not fulfill
it. Stable entity identity, normalized pointer input, position values, and several camera-follow
implementations exist as ingredients. A reusable transform tracker, pointer-to-stable-entity path,
2D pan/zoom/follow camera, and installable Framework package do not.

If Antiky intends to provide a supported capability, the supported research direction is a bounded,
renderer-neutral proof first. That proof should avoid a general ECS, full Studio selection,
render-driver dependency, and premature package promise. Read the
[`research summary`](research/README.md) for the evidence map, technical options, ownership
boundary, unresolved external facts, and decisions required before `create-plan`.

## Current records

| Record | Purpose |
| --- | --- |
| [`objective.md`](objective.md) | Owner intent and concerns; preserve as supplied |
| [`research/00-research-plan.md`](research/00-research-plan.md) | Research questions, evidence lines, and constraints |
| [`research/README.md`](research/README.md) | Headline conclusions, question status, open evidence, and owner decisions |
| [`research/01-request-and-current-coverage.md`](research/01-request-and-current-coverage.md) | Request and exact current capability coverage |
| [`research/02-minimum-slice-and-technical-options.md`](research/02-minimum-slice-and-technical-options.md) | Minimum behavior, tracker shapes, picking options, and camera split |
| [`research/03-delivery-ownership-and-decisions.md`](research/03-delivery-ownership-and-decisions.md) | Delivery choices, ownership, ADR alignment, and planning gates |

No implementation plan or executable goal exists yet. The next lifecycle phase is `create-plan`
after the owner answers the decisions in the research summary.
