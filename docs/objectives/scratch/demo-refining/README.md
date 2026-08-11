# Demo Refining

Audit and remediation plan for the antiky, BroMetal and three.js demos, after the owner judged
the shipped quality well short of the AAA-stylised targets they were commissioned against
(League of Legends for the lighting expo, Rocket League for the arena, LittleBigPlanet for the
platformer).

**Scope update (2026-08-10): `antiky-town` is now in scope.** The audit documents below were
written while it was excluded, so they say otherwise — the goal files in `goals/` are authoritative
on scope. antiky-town gets the same treatment as the other demos, plus a facelift of its foliage
(grass and trees) and water effects, which the owner has called out specifically.

## Read in this order

| Document | What it is |
|---|---|
| [`00-VISUAL-DIAGNOSIS.md`](00-VISUAL-DIAGNOSIS.md) | What the demos actually look like today, read frame by frame from fresh captures, and the three root causes in the code behind every symptom. **Start here.** |
| [`01-RENDERING-VOCABULARY.md`](01-RENDERING-VOCABULARY.md) | The graphics vocabulary needed to direct this work — each term with what it means, what it looks like when it's missing, and the sentence to paste at an agent to demand it. |
| [`02-REMEDIATION-PLAN.md`](02-REMEDIATION-PLAN.md) | The phased plan: what to build, in what order, what it costs, and what not to do. |
| [`03-ART-DIRECTION-AND-VFX.md`](03-ART-DIRECTION-AND-VFX.md) | Upgrading the assets we already own with real PBR materials, plus stylised lighting and VFX direction per demo. |
| [`04-COMPLEXITY-REDUCTION.md`](04-COMPLEXITY-REDUCTION.md) | Complexity to remove from each demo, judged against `docs/GOOD_ENGINEERING_H.md`. |
| [`05-FRAMEWORK-EASY-WINS.md`](05-FRAMEWORK-EASY-WINS.md) | What has earned promotion into `@antiky/framework`, and what has not. |
| [`06-WORK-PACKETS.md`](06-WORK-PACKETS.md) | **The executable backlog.** Independently dispatchable packets with owned-file locks, dependencies, and bounded testable acceptance criteria. Hand subagents packets from here. |
| [`07-TESTING-WITH-ANTIKY-MCP.md`](07-TESTING-WITH-ANTIKY-MCP.md) | How to actually see and inspect what you build, using the capture/inspection MCP the repo already ships. Every command verified against a live server. **Read before touching a shader.** |
| [`08-ADR-IMPACT.md`](08-ADR-IMPACT.md) | ADR compliance gaps and the records this plan needs. **Read before starting Track A or Track B.** |
| [`09-RENDER-DRIVER-DECISION.md`](09-RENDER-DRIVER-DECISION.md) | The owner's `BroMetalRenderDriver` decision and the reasoning. The draft ADR it carried is now **placed** as `docs/adr/framework/0021`. |
| [`10-ADR-0013-SEED-GAP.md`](10-ADR-0013-SEED-GAP.md) | Recorded compliance gap: ADR 0013 requires explicit random seeds and none exist. Recorded by goal 00, implemented by goal 11. |

## Before you start: the architecture record and the code disagree

Seven accepted ADRs (framework/0006, 0008, 0009, 0016, 0019, 0020 and studio/0007) are load-bearing
on a `RenderDriver` component that **does not exist in the codebase**. And framework/0006:25 ("Only
an Antiky-owned `RenderDriver` will use BroMetal directly") sits against the *later accepted*
studio/0007:41-42, which says the game module "initializes and resizes the renderer" and "disposes
its renderer resources" — written across all four renderer choices, including Antiky Framework with
BroMetal. A reader cannot tell from the record whether a game module may own BroMetal directly.

**The owner has decided this** (2026-08-10): build a `BroMetalRenderDriver` owned by the framework,
BroMetal-specific with no backend abstraction, while game modules remain free to hand-write BroMetal
if they accept the framework work that comes with it. Other renderers stay compatible but unfunded.
`09-RENDER-DRIVER-DECISION.md` carries the reasoning and a draft ADR 0021 that supersedes 0006.

Track B stays per-demo regardless — the driver gets extracted from two working implementations, not
designed from zero. Place the ADR before Track B lands so the work sits on a readable decision.

## How to run this work

Start with **Track 0** in `06-WORK-PACKETS.md`. Visual acceptance criteria only mean something if
something can measure them, and nothing could measure them before — which is why the previous work
went unchecked.

Track 0's first packet is not building a harness. The repo already ships one; it is **broken for
the demos that matter** — `capture_frame` times out on every asset-heavy demo because a single
10-second action budget wraps the whole managed-browser cold start. Unblock that first, then wrap
it. See `07-TESTING-WITH-ANTIKY-MCP.md`.

Note also that **`npm test` is red on `main`** (`skills/` was deleted while a test still reads it).
Fix that before adding any test, or you cannot tell your own breakage from the existing failure.

Two packets may run in parallel if and only if their owned-file sets are disjoint. That is the
whole concurrency rule.

## Evidence

- `evidence-captures/` — canvas captures of all three antiky demos at current HEAD, taken at
  1600×900 @2× DPR in headless Chromium with WebGPU on Metal. The `combat-arena-runtime.png` at
  the repository root is **stale** (it still shows torus-knot placeholders); use these instead.
- `subagent-reports/` — the four deep-dive audits these documents are built from:
  - `01-antiky-render-audit.md` — per-demo render pipeline teardown
  - `02-brometal-capability-audit.md` — what BroMetal 0.15 can and cannot do
  - `03-asset-pipeline-audit.md` — asset catalog, GLB processing, measured asset ceiling
  - `04-baseline-demos-and-presentation.md` — BroMetal/three.js demos and the website framing

## The short version

Nothing in any antiky demo casts a shadow, and almost nothing has a bright side and a dark side.
No demo ever renders to an offscreen target, which makes shadows, HDR, bloom and grading
structurally impossible rather than merely absent. Two asset scripts delete the texture and
normal-map data we downloaded and committed. Colour is unmanaged end to end.

None of that is an asset-quality problem, and all of it is fixable on the assets we already have.
