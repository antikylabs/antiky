# Execute goal 06-03: a specular model that does not need a ceiling

Part 3 of 6 of [goal 06](execute-goal-06.md). This is the parent goal's **required outcome 6**,
which `06-WORK-PACKETS.md` does not carry as a packet of its own. It sits here because it needs the
headroom 06-02 built and because 06-04 is large enough already.

## Prerequisites

- **[06-02](execute-goal-06-02.md)** landed and captured. A specular model with no ceiling produces
  values well above 1.0, which is only safe once there is a high-precision target and a tone-map to
  land them. Doing this before 06-02 would clip every highlight and the change would look worse
  rather than better.

## `/goal` objective

BroMetal's `specGGX` is not a full specular model. It is the distribution term only — the part that
says how tightly a highlight focuses — with no Fresnel term, no geometry term, and a hard-coded
`0.25` sitting where the real denominator belongs.

The consequence is visible in this demo's own source: every call site wraps it in a ceiling and
scales it down to keep it from blowing out. Those ceilings are not tuning, they are a workaround.
Replace the model with one that conserves energy, and the ceilings become unnecessary.

## The state today, verified

| Where | What it says |
| --- | --- |
| `src/shaders/reliquary-model.shader.ts:64` | `min(specGGX(normal, light, view, roughness), 1.5) * 0.12` |
| `src/shaders/foundry.shader.ts:36` | `min(specGGX(normal, light, view, roughness), 2.4) * (0.16 + metalness * 0.84)` |
| `src/shaders/reliquary-floor.shader.ts:36` | `specGGX(normal, light, view, roughness) * 0.12` — no ceiling, but the same `* 0.12` |

Three call sites, two ceilings, three arbitrary scale factors. A model that conserved energy would
need none of them, because the energy leaving a surface would already be bounded by the energy
arriving at it.

## Required outcome

1. **An energy-conserving GGX** — distribution, Fresnel (Schlick is fine) and a geometry/visibility
   term, with the correct denominator rather than a constant. Declared per shader for the same DSL
   reason `decodeSrgb` is: module-level helpers only, no imports.
2. **The ceilings and the scale factors gone.** No `min(specGGX(…), …)` anywhere in the demo, and no
   bare `* 0.12` standing in for a normalisation term. If a scale factor survives, it must have a
   stated physical meaning, not a value that looked right.
3. **Metalness means something.** `foundry.shader.ts` already blends a factor by metalness; with
   Fresnel present, metals take their specular colour from albedo and dielectrics use a fixed F0.
   That is the change that makes the brass and the stone stop looking like the same material.
4. **One copy of the model, asserted identical** across the three shaders, in the same shape as the
   existing decode assertion in `pipeline-invariants.test.mjs`.

## Required tests and evidence

- **An energy test.** Integrate the model over a hemisphere for a few roughness values and assert
  outgoing energy never exceeds incoming. This is the assertion that replaces the ceiling — it
  proves the ceiling is not needed rather than assuming it.
- **A grep test: no `min(specGGX`** anywhere under the demo's `src/`.
- **Roughness behaves monotonically.** A rougher surface produces a wider, dimmer highlight; assert
  peak intensity falls and the lit area grows as roughness rises.
- **Fresnel does something at grazing angles.** A probe near a surface's silhouette is measurably
  brighter than the same material face-on under the same light.
- **`clippedHigh` stays inside its budget** (ceiling 2%). Removing a clamp is exactly the change
  that could blow this, and if it does, the tone-map or the exposure is wrong rather than the model.
- A capture before and after, looked at, with the numbers stated. **This one is allowed to move the
  image** — unlike 06-02 — but it should move it toward "materials look different from each other",
  not toward "everything is shinier".
- `npm test` green; `shader-output-parity` green with `.gen.ts` regenerated.
- A committed `visual-metrics.json` sidecar.

## Explicit non-goals

- **Do not patch BroMetal to fix `specGGX` itself.** Tempting, and arguably the right home, but a
  BroMetal patch is a separate reviewed change with an upstream PR, and this goal is about one
  demo's render slice. If it proves worth upstreaming, add a row to
  [`execute-goal-99.md`](execute-goal-99.md) with the trigger.
- Do not add image-based lighting, a BRDF lookup table, or multi-scatter compensation. Each is a
  real improvement and none is needed to delete a clamp.
- Do not accept anything needing screen-space derivatives. That gap also blocks Toksvig and LEAN
  specular anti-aliasing — record it as a known limitation, do not design around it.
- Do not touch lights, shadows or ambient. Those are 06-04 and 06-05.

## Engineering constraints

- Only `packages/demos/antiky/point-light-expo`. Touching `combat-arena`, `traversal-study` or
  `antiky-town` is a scope error — those are goal 07.
- Tests are required for code changes. For a reported bug, write the failing test first.
- Short one-line commit messages. No coauthor tags. One commit for this step.
- Capture PNGs are not committed. The sidecar is.
- Preserve unrelated dirty worktree changes.
- Keep handwritten files under 500 lines.
- Do not loosen a budget bound to pass.

## Capture protocol

Use the Antiky MCP, not a hand-rolled script. Fence with `get_latest_build` → `get_runtime_status`
→ `get_capture_capabilities`; retry `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and
`CAPTURE_DIMENSIONS_MISMATCH`; drive `pause_simulation` → `step_simulation` to the same fixed step
count used in the previous steps.

## Completion definition

Complete when the three call sites use one energy-conserving model with no ceiling and no unexplained
scale factor, the energy test passes, roughness and Fresnel behave as asserted, `clippedHigh` is
inside budget, `npm test` is green, and a fresh capture has been looked at beside 06-02's.
