# Antiky Town

**Status: Scaffolded; implementation choices are pending.**

Antiky Town will port the existing [`brometal-town`](../brometal-town/) through Antiky Framework.
The old demo remains the reference until the new demo matches its required behavior and appearance.

Read [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md) before adding implementation code. The
plan contains two or three alternatives for each early slice. The project owner will select the
direction.

## Scaffold

| Path | Intended ownership |
| --- | --- |
| `index.ts` | Future `DemoFactory` entry point and composition root |
| `content/` | Town-specific authored data, imports, and asset descriptions |
| `gameplay/` | Town-specific commands, systems, and adapters |
| `render/` | Town-specific mapping to the framework render API |
| `tests/` | Cross-package, behavior, visual, and performance evidence |

Reusable engine behavior belongs in `@antiky/framework`. BroMetal calls remain in this demo or a
future framework render adapter. Framework core must stay headless.
