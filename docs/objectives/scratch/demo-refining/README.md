# Demo Refining

Audit and remediation plan for the antiky, BroMetal and three.js demos, after the owner judged
the shipped quality well short of the AAA-stylised targets they were commissioned against
(League of Legends for the lighting expo, Rocket League for the arena, LittleBigPlanet for the
platformer).

`antiky-town` is out of scope and was not touched.

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
