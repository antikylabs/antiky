# Antiky Town

**Status: Active framework composition.**

Antiky Town ports the existing [`brometal-town`](../brometal-town/) through Antiky Framework one
proven feature at a time. The current composition owns a reusable point-light authoring service and
one fixed-step `EngineSession`. A private Town host maps movement input, platform time, pause
reasons, and one render call to that session. `Market Lamp West 01` still maps to the reference
renderer's slot `0` input. The old `town-study` demo remains an independent behavior, appearance,
and performance reference.

Planning and slice documents live in the
[Antiky Town objectives](../../../../../docs/objectives/antiky-town/README.md) folder. Read the
[development-harness research](../../../../../docs/objectives/general-stuff/DEV_HARNESS_RESEARCH_A.md)
and [implementation plan](../../../../../docs/objectives/antiky-town/IMPLEMENTATION_PLAN_A.md)
before you add implementation code. The plan contains alternatives, preconditions, inspection
requirements, and acceptance criteria for each early slice.

## Layout

| Path | Intended ownership |
| --- | --- |
| `index.ts` | Registered `DemoFactory` entry point |
| `composition.ts` | Service, adapter, and reference-town lifetime composition |
| `content/` | Town-specific authored data, imports, and asset descriptions |
| `gameplay/` | Private Town host, semantic input, commands, systems, and adapters |
| `render/` | Town-specific mapping to the framework render API |
| `tests/` | Cross-package, behavior, visual, and performance evidence |

Reusable engine behavior belongs in `@antiky/framework`. BroMetal calls remain behind the narrow
reference-town seam. Framework core stays headless.
