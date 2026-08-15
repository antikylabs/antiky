# BroMetal request objective

**Phase:** Research complete; ready for `create-plan`.

The owner asked whether Antiky already covers the needs in
[BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8), whether Framework is a good
fit, and whether implementation should be planned. The original intent and concerns remain in
[`objective.md`](objective.md).

Research found that Antiky's direction fits the request, but its current product does not fulfill
it. Stable entity identity, normalized pointer input, position values, and several camera-follow
implementations exist as ingredients. A reusable transform tracker, pointer-to-stable-entity path,
and 2D pan/zoom/follow camera do not. Antiky Framework itself is open source under MIT and available
from the repository today; the separate distribution finding is only that it has not yet been
published as a versioned npm package.

The research recommends building a small working Framework example first. It should use simple CPU
click detection and a basic 2D pan/zoom/follow camera while avoiding a general ECS, Studio selection,
GPU picking, and package-release work. Read the
[`research summary`](research/README.md) for the evidence map, technical options, ownership
boundary, unresolved external facts, and recommended defaults for `create-plan`.

## Current records

| Record | Purpose |
| --- | --- |
| [`objective.md`](objective.md) | Owner intent and concerns; preserve as supplied |
| [`research/00-research-plan.md`](research/00-research-plan.md) | Research questions, evidence lines, and constraints |
| [`research/README.md`](research/README.md) | Headline conclusions, question status, open evidence, and recommended next step |
| [`research/01-request-and-current-coverage.md`](research/01-request-and-current-coverage.md) | Request and exact current capability coverage |
| [`research/02-minimum-slice-and-technical-options.md`](research/02-minimum-slice-and-technical-options.md) | Minimum behavior, tracker shapes, picking options, and camera split |
| [`research/03-delivery-ownership-and-decisions.md`](research/03-delivery-ownership-and-decisions.md) | Delivery choices, ownership, ADR alignment, and planning gates |

No implementation plan or executable goal exists yet. The next lifecycle phase is `create-plan`.
No additional technical questionnaire is required from the owner.
