# BroMetal request objective

**Phase:** Research complete; ready for `create-plan`.

The owner asked whether Antiky already covers the needs in
[BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8), whether Framework is a good
fit, and whether implementation should be planned. The original intent and concerns remain in
[`objective.md`](objective.md).

Research found that Antiky's direction fits the request, but the complete behavior does not exist.
Antiky already has stable entity IDs, pointer input, render passes, inspection data, and several
camera-follow examples. It does not have the complete path from a clicked GPU pixel to a stable
Framework entity and then to Studio selection. A reusable transform tracker and 2D pan/zoom/follow
camera are also missing. Antiky Framework is open source under MIT and available from the repository
today; npm publication is a separate concern.

The research recommends checked-in Framework behavior, automated tests, and one runnable
Antiky/BroMetal integration example. The example must prove GPU picking through stable Framework
identity into Studio selection, together with the requested transform and 2D-camera behavior. A
fixture of roughly a few dozen objects matches the issue's use case. It is not a package version,
product limit, or scalability promise. Read the
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
