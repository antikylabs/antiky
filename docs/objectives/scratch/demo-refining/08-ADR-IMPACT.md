# ADR Impact Analysis — the demo-refining plan set against accepted decisions

**Date:** 2026-08-10
**Scope:** all 30 ADRs under `docs/adr/{framework,cli,studio}/`, `docs/adr/UNDER_REVIEW_A.md`,
`docs/GOOD_ENGINEERING_H.md`, `docs/VISION_DIRECTION_H.md`, the seven plan documents in this
directory, and `docs/objectives/scratch/skill-research/IMPLEMENTATION-PLAN.md`.
**Authority:** none. This document proposes. Core Contributors write ADRs
(`docs/adr/README.md:9-10`). Contributors propose through AIPs (`docs/aip/README.md:44-46`).
**Nothing was written, edited, or created in `docs/adr/` or `docs/aip/` to produce this.**

The ADR README invites this: *"If you find something at fault in an ADR or accepted AIP, please do
raise an issue loudly! Disasterous ADRs can be disasterous for the platform."*
(`docs/adr/README.md:15`). Section 6 takes that literally, including against the plan set itself.

## How to read the labels

- **[verified]** — I ran the grep or read the file. A `file:line` citation follows.
- **[inference]** — my reading of a clause or a consequence. Reasoned, not proven.
- **[owner decision]** — cannot be resolved from the record. Needs a Core Contributor.

And the two verdicts that matter most, which are deliberately kept apart:

- **WORK** — an accepted ADR already decided this. Closing the gap needs engineering, not a
  decision, and needs no AIP.
- **DECISION** — no accepted ADR covers it. It needs an AIP, and possibly an ADR after.

---

## 0. The headline

**Six accepted ADRs and one accepted Studio ADR are load-bearing on a component that does not
exist.** `RenderDriver` appears in `framework/0006`, `0008`, `0009`, `0016`, `0019`, `0020` and
`studio/0007`. There is no `class`, `interface`, or `type` named `RenderDriver` anywhere in
`packages/**` [verified]. Every non-documentation hit is prose or a comment:

| file:line | kind |
|---|---|
| `packages/website/PRODUCT.md:85`, `:158` | product prose |
| `packages/website/src/app/page.tsx:193` | JSX prose |
| `packages/website/src/app/framework/page.tsx:124` | JSX prose |
| `packages/website/src/app/thesis/page.tsx:203` | JSX prose |
| `packages/demos/antiky/antiky-town/src/town/town-runtime.ts:9` | comment |
| `packages/demos/brometal/town-study/src/town/town-runtime.ts:9` | comment |

The two comments read `/** Game-module data plus the game-owned BroMetal render driver. */` — the
*inverse* of ADR 0006's ownership rule [verified].

This is not new information inside the repository. `docs/objectives/inspection-tooling/framework-state-and-inspection.md:160`
already states *"Framework has no implemented `RenderDriver` interface"*, and
`docs/objectives/inspection-tooling/framework-state-and-inspection.md:289` lists the
`RenderDriver` contract as an open **P1**. The gap has been observed and recorded in objectives for
some time, and the ADRs that depend on it have never been amended. That is the accountability
failure the ADR README exists to prevent, and it is worse than any single item below.

---

## 1. Compliance gaps

### 1.1 ADR framework/0006 — the render driver — **DECISION**

**Clause** (`docs/adr/framework/0006-brometal-render-driver_H.md:25-26`):

> Antiky will use BroMetal as its rendering backend. Only an Antiky-owned `RenderDriver` will use
> BroMetal directly.

and `:28-35`, the driver "will own: BroMetal programs, Textures, Render targets, Buffers, GPU
state, Disposal of these resources."

**Divergence** [verified]. No `RenderDriver` exists. All four `antiky/` demos declare
`"brometal": "0.15.0"` and import it directly in `src/`:

- `packages/demos/antiky/point-light-expo/src/game.ts:1`, `src/renderer.ts:11`,
  `src/render-batches.ts:5`
- `packages/demos/antiky/combat-arena/src/renderer.ts:6`, `src/render-batches.ts:1`
- `packages/demos/antiky/traversal-study/src/renderer.ts:14`
- `packages/demos/antiky/antiky-town/src/game.ts:1`, `src/town/town-runtime.ts:1`

Each demo owns its own programs, textures and disposal — precisely the six things `:28-35` assigns
to the driver.

**But the divergence is narrower than it first looks, and this matters.** ADR 0006's context scopes
the harm to framework concerns: *"BroMetal types and resources must not spread into those parts of
Antiky"* — world data, gameplay rules, saved data, networking, Studio behavior, agent protocols
(`:12-19`). That containment **holds today and is enforced by test**:
`packages/framework/tests/import-boundary.test.mjs:10` forbids `/^brometal(?:\/|$)/` in framework
source, and `:56` forbids `window|document|navigator` [verified]. A grep for
`webgpu|GPUDevice|getContext|requestAdapter|createRenderer` across `packages/framework/src` returns
zero hits [verified]. `packages/framework/src/index.ts` exports only identity, inspection,
point-light and engine-session modules [verified].

So ADR 0006's *consequences* (`:44-47`) are satisfied. Its *mechanism* is not built.

**And a later accepted ADR contradicts the clause head-on.**
`docs/adr/studio/0007-framework-first-allow-others_H.md:28-35`:

> Pure BroMetal is BroMetal without Antiky Framework. […] The contract lets a game module use these
> renderers: Antiky Framework with BroMetal, Pure BroMetal, Three.js, A different browser renderer.

and `:41-42`: *"The game module initializes and resizes the renderer. The game module disposes its
renderer resources."* Studio 0007 explicitly gives a game module direct renderer ownership,
including "Pure BroMetal". ADR 0006 says only an Antiky-owned `RenderDriver` may use BroMetal
directly. Studio 0007 also restates, at `:23`, that *"BroMetal will stay as the Framework render
driver."*

**A reader cannot determine from the accepted record whether a game module may hold a BroMetal
`Renderer`.** That ambiguity, not the missing class, is the compliance defect. Resolution requires a
decision, not work — see §3.1.

**Impact of the plan.** `02-REMEDIATION-PLAN.md:40` adds `createRenderTarget` + `drawTo` passes
inside each demo's own renderer; `06-WORK-PACKETS.md:201-251` (W B.2–W B.5) adds HDR targets, shadow
maps and bloom chains per demo. Each is a new GPU resource owned by game code. The plan deepens the
divergence by roughly three renderers' worth. The owner has already stated this is deliberate
(`02-REMEDIATION-PLAN.md:21-32`). The question is therefore *not* whether to stop, but what record
should exist for an interim state that is about to become substantially larger.

### 1.2 ADR framework/0013 — no seed reaches any simulation — **WORK**

**Clause** (`docs/adr/framework/0013-explicit-simulation-inputs_H.md:17-21`):

> The authoritative simulation will use a fixed time step. It will receive these inputs explicitly:
> - The simulation clock
> - Random seeds or random streams
> - External inputs
> - The system order.

**Divergence** [verified]. `grep -rn "seed\|Seed" packages/framework/src` returns **zero hits**, and
`EngineSessionOptions` (`packages/framework/src/sessions/engine-session/contract.ts:41-50`) has no
seed field — it carries `sessionId`, `worldId`, `runtimeInstanceId`, `systems`, `captureInput`,
`getStateDigest?`, `services?`, `initialCompletedStepCount?` and nothing else. `packages/cli/src`
likewise has zero `\bseed\b` matches. Instead, `Math.sin`-based hashes are baked into demo source at
six sites — **five distinct implementations**, since the last two are byte-identical copies of each
other — plus one GLSL copy:

| file:line | constants |
|---|---|
| `packages/demos/antiky/point-light-expo/src/simulation.ts:132` | `73.17, 41.73, 43_758.5453` |
| `packages/demos/antiky/combat-arena/src/combat-state.ts:177` | `91.71, 37.13, 43758.5453` |
| `packages/demos/antiky/traversal-study/src/simulation.ts:174` | `73.91, 19.37, 41758.31` |
| `packages/demos/antiky/traversal-study/src/renderer.ts:278` | `63.17, 17.53, 43147.19` |
| `packages/demos/antiky/antiky-town/src/town/art/town.ts:2192` | `127.1, 311.7, 43758.5453` |
| `packages/demos/brometal/town-study/src/town/art/town.ts:2192` | identical copy of the above |

One more lives on the GPU: `packages/demos/antiky/combat-arena/src/shaders/space-backdrop.shader.ts:38`
uses the classic `fract(sin(dot(coordinates, vec2(12.9898, 78.233))) * 43_758.5453)`.

The clause requires the simulation to **receive** a seed. A hard-coded literal is not a received
input; there is no seed at all. That is the breach, stated precisely.

**Be careful about the adjacent claim.** ADR 0013 `:33-34` says *"Antiky does not promise identical
binary results on all platforms. A subsystem can make this promise only if tests verify it."* So
`Math.sin`'s non-correctly-rounded behaviour is a **risk**, not an ADR violation — the ADR declines
the cross-platform promise. And `seeded(index, salt)` is a pure function of explicit arguments, so
it does not breach `:39-41` (*"A system cannot read the system clock or hidden random values"*) —
nothing hidden is read.

**Where it does bite — exactly one of the four demos.** `combat-arena`'s state digest hashes
`enemy.phase` (`packages/demos/antiky/combat-arena/src/combat-digest.ts:112`), and `enemy.phase` is
set from `seeded(index, 2) * Math.PI * 2`
(`packages/demos/antiky/combat-arena/src/combat-state.ts:260`) [verified]. That digest reaches
agents through `get_session_status` (`packages/cli/src/mcp/tools.ts:339-344` →
`packages/cli/src/mcp/server.ts:404-417` → `packages/cli/src/development/observation.ts:236`), and
it is the staleness fence for captures (`packages/cli/src/host/capture-action.ts:76-78`,
`CAPTURE_OBSERVATION_STALE`). So `Math.sin` output *does* reach agent-visible ground truth in
combat-arena, and its digest is not portable across JS engines.

The other three digests do **not** depend on it [verified]: `point-light-expo`
(`src/simulation.ts:484-500`) hashes `shade.x/z/mode` and excludes `phase`; `traversal-study`
(`src/simulation.ts:549-566`) excludes the trail particles that `seeded` feeds; `antiky-town`
(`src/town/index.ts:160-201`) covers motor state only, and its physics colliders are literals.

**Verdict: WORK, no decision needed.** ADR 0013 already decided that seeds are an explicit input.
`05-FRAMEWORK-EASY-WINS.md:480-495` proposes the interface; the choice between `hashUnit` alone and
a forkable `RandomStream` is implementation, and `05:514-519` already reasons it both ways. Do not
write an ADR for this.

### 1.3 Render interpolation is **not** a compliance gap — correction

ADR 0013 `:30-31` says: *"The renderer **can** estimate positions between two simulation states. It
can also run at a different rate from the simulation."* That is a **permission**, not a requirement.

Not implementing it is a quality defect (judder on 120/144 Hz displays), covered by
`06-WORK-PACKETS.md:312` (W D.5) and `05-FRAMEWORK-EASY-WINS.md:84-193`. It is **not** an ADR
violation, and it must not be reported as one. Framing an unexercised permission as a breach
devalues the real breaches in this section.

**And the framing "no demo interpolates" is itself wrong** [verified].
`packages/demos/antiky/antiky-town/src/town/physics/character-motor.ts:836` computes
`clamp(this.accumulator / fixedDelta, 0, 1)` and `:843-847` returns a lerped `renderPosition`, which
`packages/demos/antiky/antiky-town/src/town/index.ts:777,834-836` uses to place the hero standee.
`05-FRAMEWORK-EASY-WINS.md:92` already reports this correctly ("1 of 10, and it is correct");
W D.5's scope line, "each demo's game loop" for "all three demos"
(`02-REMEDIATION-PLAN.md:122`), is the accurate scope.

Two details worth carrying into W D.5 that the plan set does not yet state:

- **The existing implementation is inert as wired.**
  `packages/demos/antiky/antiky-town/src/composition.ts:104` drives the town at exactly
  `step.fixedDeltaSeconds`, and the motor's own default is also `1/60`
  (`character-motor.ts:632`), so the accumulator drains each call and the alpha sits at ~0. The hero
  renders one *whole tick stale* rather than interpolated. Copying this pattern without fixing the
  clock feed would reproduce a latent bug.
- **The framework already publishes the numerator and no demo reads it.**
  `packages/framework/src/sessions/engine-session/contract.ts:74`, `:108` expose
  `accumulatorSeconds` and `:4` declares `FIXED_STEP_SECONDS = 1 / 60`; a grep for
  `accumulatorSeconds` across `packages/demos/**` returns **zero hits**. Also unremarked by the
  plan: `combat-arena` already carries `projectile.previousX` / `previousZ`
  (`packages/demos/antiky/combat-arena/src/combat-digest.ts:121-122`), so one demo has a
  previous-state buffer for one entity class already.

**Verdict: WORK.** No ADR, no AIP.

### 1.4 ADR framework/0009 — projection drift has no detector — **WORK**

**Clause** (`docs/adr/framework/0009-separate-state-projections_H.md:36-38`):

> State copies can get out of sync. This error is projection drift. Sequence checks, rebuild
> operations, and tests must detect and correct it.

**Divergence** [verified], and it is exactly the shape 0009 names. `traversal-study` has three
different answers to "what is the ground height at x", one per projection
(`04-COMPLEXITY-REDUCTION.md:644-648`):

- runtime: `supportAt` — `packages/demos/antiky/traversal-study/src/simulation.ts:161-171`
  (highest platform wins, `width*0.5 − 0.05` inset)
- render: `courseTopAt` — `src/renderer.ts:282-288` (first in array order, no inset)
- inspection: `courseTop` — `src/inspection.ts:330-333`

No sequence check, rebuild, or test detects the disagreement. `combat-arena`'s three sun directions
and three fog ranges (`04-COMPLEXITY-REDUCTION.md:717-720`) are the same failure across shader
projections of one authored fact.

**What is *not* a violation.** ADR 0009 `:31-32` says *"Render code must not change runtime state
through shared references."* I checked: the renderer does **not** call `platformInstancesNear`. Its
only callers are `simulation.ts:163`, `simulation.ts:426`, and
`tests/simulation.test.ts:248,250,264` [verified]. The renderer duplicates the query instead of
mutating. Do not report a mutation violation here; there isn't one.

**Verdict: WORK.** `06-WORK-PACKETS.md:120-134` (W0.4) and `04-COMPLEXITY-REDUCTION.md:654-664` (F1)
are the correct remedies and satisfy 0009's own consequence. No ADR needed.

### 1.5 ADR framework/0008 — module-level mutable simulation state — **WORK**

**Clause** (`docs/adr/framework/0008-engine-session-owns-worlds_H.md:21-22`):

> Development also needs primary, preview, test, and agent sandbox worlds at the same time. These
> worlds must not duplicate shared services or share data that they can change.

**Divergence** [verified].
`packages/demos/antiky/traversal-study/src/simulation.ts:145-151` declares `platformInstances` at
**module scope**, and `platformInstancesNear` mutates `platform.top` on it (`:153-159`). Every
`createTraversalSimulation` in a process shares one mutable array. Two sandbox worlds of this demo
would corrupt each other.

This is not hypothetical for this plan: ADR 0014 (`docs/adr/framework/0014-promote-sandbox-commands_H.md:20-22`)
and `UNDER_REVIEW_A.md:59-68` (item 7, Sandbox isolation, **Open**) both assume a sandbox can be an
isolated world. Module-level mutable simulation state defeats that.

**Verdict: WORK.** `04-COMPLEXITY-REDUCTION.md:110-114` (A1, `course-query.ts`) already proposes the
split. It should be scoped to per-instance state, not merely moved to another file — the plan's A1
does not currently say that, and it should.

### 1.6 ADR cli/0001 — the tool enumeration is stale — **WORK (clarification)**

**Clause** (`docs/adr/cli/0001-use-mcp-tools-for-development_H.md:43-44`):

> The read-only Tools are `get_dev_status`, `get_latest_build`, `get_runtime_status`,
> `get_render_stats`, and `get_diagnostics`. The action Tools are `dev_reload` and `capture_frame`.

**Divergence** [verified]. `packages/cli/src/mcp/tools.ts` declares **twenty** tools: twelve reads
(adding `get_capture_capabilities:328`, `get_render_evidence:334`, `get_session_status:340`,
`get_world_inspection:346`, `get_event_log:352`, `list_point_lights:358`, `get_point_light:364`) and
eight actions (adding `capture_gameplay_sequence:382`, `pause_simulation:388`,
`resume_simulation:394`, `step_simulation:400`, `set_point_light_power:406`,
`correct_point_light_power:412`).

The ADR's *decision* — "advertise local development state and actions as MCP Tools" (`:41`), no
duplicating Resources (`:49`) — is fully honoured. Only the enumeration has aged. The plan depends
on eight tools the ADR does not name (`07-TESTING-WITH-ANTIKY-MCP.md:28-34`).

**Verdict: WORK.** An owner-approved clarification via `docs/adr/tag-hash.sh`, replacing the frozen
list with the rule that produces it. Low priority, but it is a decision record currently stating
something untrue.

### 1.7 Public product claims that the code does not support — **WORK**

`packages/website/PRODUCT.md:85`: *"The current Framework render driver uses BroMetal."*
`packages/website/PRODUCT.md:158`: *"BroMetal … remains the current Framework render driver."*
`packages/website/src/app/page.tsx:193`, `framework/page.tsx:124`, `thesis/page.tsx:203` repeat it
to the public [verified].

`PRODUCT.md` sets its own bar three lines later (`:87-96`): *"Every meaningful public claim belongs
to one of these states: **Current** — implemented and documented through a public boundary today.
… **Direction** — supported by an accepted decision or explicit product direction, but not a public
capability yet."*

There is no Framework render driver. By PRODUCT.md's own taxonomy this claim is **Direction**,
published as **Current**. `packages/website/PRODUCT.md:81-83` even warns: *"A hypothesis does not
become a product claim because it appears in a plan or accepted architecture direction."*

**Verdict: WORK, and it is the most urgent item in this document** because it is public, it is
already shipped, and it is cheap to fix. Downgrade the wording to Direction, or state that game
modules own the BroMetal renderer today. No ADR needed either way — this is a copy fix against an
existing product standard. It should not wait for §3.1.

---

## 2. New ADRs the plan requires

The bar, from `docs/adr/README.md:6-7`: *"An ADR is a short, permanent record. It is not a proposal,
a design specification, or an implementation plan."* Plus `:71-73`: *"An ADR must contain the facts
and requirements that support its decision. An ADR must not use an objective, goal, feedback record,
or implementation plan as authority."*

That second clause matters here. **None of the five ADRs below may cite this directory as
authority.** These plan documents can link to an ADR; an ADR cannot link back to them. Each proposed
ADR must be able to state its facts from code and dependency versions alone.

**Note on numbering:** `docs/aip/` contains only `README.md` — **zero AIPs exist** [verified], and
the AIP README defines no filename or numbering convention. Titles below, not numbers.

### 2.1 CLEARS — Interim render ownership and the framework render slice

**Decision to be made:** who owns a BroMetal `Renderer` today, and what evidence promotes rendering
into a framework slice.

**Why architectural, not implementation.** It resolves a direct contradiction between two accepted
ADRs (§1.1), it determines what six other accepted ADRs mean when they say "render driver", it
binds every current and future game module, and it is a permanent ownership boundary. It is the
single most consequential unrecorded decision in the repository.

**What it must decide, and nothing more:**
1. A game module may hold and dispose a renderer directly (aligning 0006 with `studio/0007:41-42`
   and `framework/0020:51-52`).
2. The framework must remain able to run without BroMetal or a DOM (already true and tested —
   `packages/framework/tests/import-boundary.test.mjs:10,56`).
3. The evidence that creates a Framework `RenderDriver`, stated as a condition.

**What it must NOT contain:** pass structure, HDR target formats, the `createStage` sketch at
`02-REMEDIATION-PLAN.md:60-75`, or any per-demo work. Those are implementation and belong in this
directory.

**AIP:** *"Per-demo render ownership and the framework render slice."* Must carry the alternatives
`02-REMEDIATION-PLAN.md:20-32` already weighed (shared `@antiky/stagecraft` package, withdrawn) so
the reasoning survives.

**Acceptance criteria for the AIP being ready to decide:**
- Names every accepted ADR whose text depends on `RenderDriver` — 0006, 0008, 0009, 0016, 0019,
  0020, studio/0007 — and states for each whether the successor changes its meaning.
- States the promotion condition in a form that can be *checked*, not judged. `05-FRAMEWORK-EASY-WINS.md:5-7`
  offers one: *"a capability qualifies when it has been independently re-implemented in three or
  more demos with the same shape."*
- States explicitly whether a 2.3D demo must be among those implementations (see §4.3).
- ≤ 500 lines (`docs/aip/README.md:50`).

### 2.2 CLEARS, narrowly — Colour management and transfer-function boundaries

**Decision to be made:** Antiky performs lighting in linear colour, and applies the sRGB transfer
function at defined boundaries — once on texture decode, once on final output.

**Why it clears.** It is technology-independent, it outlives the demos, it binds any future
`RenderDriver`, and getting it wrong has already cost thirteen documented compensation knobs
(`04-COMPLEXITY-REDUCTION.md:317-331`). It has a compatibility surface: a shader either honours it
or does not, and a repo-wide test can prove which (`06-WORK-PACKETS.md:127-128`). The root cause is
a permanent fact about the stack, not a tuning choice — BroMetal hard-codes `rgba8unorm`
(`00-VISUAL-DIAGNOSIS.md:181`), so the decode must live somewhere, and *where* is architectural.

**Scope it hard.** The ADR decides the transfer-function boundary and the rule *material shaders
return linear HDR and never tone-map* (`02-REMEDIATION-PLAN.md:104-107`). It must **not** decide the
pass graph, the HDR target format, bloom, exposure, or grading. Those are implementation and will
change.

**Sequencing note that matters:** `docs/adr/README.md:110-111` — *"Core Contributors make the
decision before they add the ADR."* So land W B.1(point-light-expo) first as the evidence, then
record. Do not write this ADR speculatively.

**AIP:** *"Linear colour and transfer-function boundaries for Antiky rendering."*

**Acceptance criteria:**
- W B.1(point-light-expo) passes its own criterion (`06-WORK-PACKETS.md:194-195`: analytic result
  within 2/255) before the ADR is written.
- The ADR text contains no reference to a render target, a bloom chain, or a tone-map operator name.
- `06-WORK-PACKETS.md:127` W0.4's assertion is derivable from the ADR's decision sentence alone.

### 2.3 CLEARS — Asset intake fidelity policy

**Decision to be made:** an asset intake step preserves what the source carried; the runtime adapts
to the source, not the reverse. Any deliberate loss is declared with a reason and is verifiable.

**Why architectural.** It is a boundary contract with a durable, versioned surface — the per-demo
`assets/antiky-assets.json` receipts and hash verification
(`packages/asset-catalog/src/node/install.ts:45-63`, cited at `03-ART-DIRECTION-AND-VFX.md:408`).
It binds every current and future importer including Studio's. It is the same *shape* of question as
`UNDER_REVIEW_A.md:100-108` (item 11, Voxel authoring and runtime-asset boundary, **Open**), and the
two should be decided together or explicitly separated — two overlapping ADRs on the asset boundary
would be a real cost.

**The evidence is unusually strong.** Two shipped scripts destroy committed data:
`traversal-study/scripts/normalize-quaternius.mjs:237-238` overwrites `TEXCOORD_0` with a palette
column, producing 1×1-pixel shipped textures; `point-light-expo/scripts/gltf-pack-lib.mjs:89` runs
`delete material.normalTexture` on hash-verified committed maps
(`00-VISUAL-DIAGNOSIS.md:166-175`).

**AIP:** *"Asset intake fidelity and declared-loss policy."* Should state its relationship to
review item 11 in its first paragraph.

**Acceptance criteria:**
- Guard G5 / W A.4 (`IMPLEMENTATION-PLAN.md:553`) exists and **fails at HEAD** against
  `traversal-study`'s 1×1 textures and against `gltf-pack-lib.mjs:89`, before the ADR is written.
- The ADR decides the *policy*, not the manifest schema. A schema change must not require a new ADR.
- W C.3 (`02-REMEDIATION-PLAN.md:269-270`, converge the three divergent asset scripts) is not started
  until the policy is recorded — converging three scripts *is* choosing the policy.

### 2.4 CLEARS, reframed — Local modification of a pinned dependency

**Assess the BroMetal patches against ADR 0006's own clause first**
(`docs/adr/framework/0006-brometal-render-driver_H.md:40`):

> Changes that Antiky contributes to BroMetal must help renderers in general or correct an error.

- **P1** — render-target sampler `nearest` → `linear` (`webgpu.js:761`,
  `02-REMEDIATION-PLAN.md:186`). Point-sampled render targets break bloom, planar reflection and any
  downsample chain for *every* renderer, not just Antiky's. **Passes "help renderers in general."**
- **P2** — honour MSAA in `drawTo`, which hard-codes `passSamples = 1` (`webgpu.js:235`,
  `02-REMEDIATION-PLAN.md:187`). Silently discarding a caller's requested sample count is a
  correctness defect. **Passes "correct an error."**

**So contributing them needs no new decision. ADR 0006 already permits both.** Say that plainly and
do not write an ADR for it.

**What ADR 0006 does not cover is the thing we actually do.**
`package.json:17` runs `"postinstall": "node scripts/patch-brometal.mjs"`, which **rewrites
`node_modules/brometal/dist/**` in place on every install** [verified], guarded by an exact version
assertion (`scripts/patch-brometal.mjs:23-25`: throws unless `0.15.0`). Two patches ship today
(`discard()` at `:45-49`, and `present()`); the plan adds two more and roughly doubles the surface
(`06-WORK-PACKETS.md:138-172`, Track A).

That is a supply-chain and dependency-trust boundary. `GOOD_ENGINEERING_H.md` is direct about it:
*"Dependencies are code you didn't write and probably didn't read. Pin versions, audit what
matters."* No accepted ADR decides whether Antiky may modify a pinned dependency's build output,
under what conditions, or what happens when upstream accepts, rejects, or diverges from a patch.

**AIP:** *"Local modification of pinned third-party runtime dependencies."*

**Acceptance criteria:**
- States the current surface exactly: 2 patches today, 4 proposed, one version pin at
  `scripts/patch-brometal.mjs:23-25`.
- Decides what happens on a version bump when a patch target has moved — today
  `scripts/patch-brometal.mjs:31` throws `BroMetal patch target changed`, which is good behaviour
  and should be recorded as intended, not incidental.
- Decides whether an unmerged upstream PR blocks a dependency upgrade.
- Does **not** enumerate the patches. A fifth patch must not require a new ADR.

### 2.5 CLEARS, weakly — May a delivery host branch on a game module's renderer?

`studio/0007:26-27` decides: *"Studio and the CLI will use the game-module contract to load each
project. The game host will not select, import, or call a renderer."* Its consequence `:60`:
*"Studio and the CLI have no renderer-specific branch."*

**The website host has one** [verified]:
`packages/website/src/components/DemoStage.tsx:91` reads `findDemo(slug)?.requiresWebGpu ?? true`
and `:106` branches `if (requiresWebGpu && !('gpu' in navigator))`. The flag is website-owned
metadata (`packages/website/src/lib/demos.ts:23`, values at `:69`–`:216`), and a test pins the
branch shape (`packages/website/tests/demo-delivery.test.mjs:81`).

ADR 0020 `:55` requires *"A delivery target will supply a game host when it operates a compiled game
module"*, and `:73` calls the game module interface *"a compatibility boundary"* — but no accepted
ADR says whether that boundary carries a capability declaration, or whether a non-Studio host may
branch on renderer requirements.

W F.1 (`06-WORK-PACKETS.md:359`) works directly in this gap.

**Honest ranking: lowest of the five.** If W F.1 turns out to be copy and CSS, no decision is
needed. If it moves `requiresWebGpu` from website metadata onto the game-module contract, that is a
change to the compatibility boundary ADR 0020 names, and it needs an AIP first. **[owner decision]**
on which of the two it is.

### 2.6 Rejected — candidates that do **not** clear the bar

A bloated ADR backlog is a real cost. These four were assessed and should not become ADRs.

| Candidate | Why it fails |
|---|---|
| **Visual budgets and capture evidence as a required quality gate** | This is *process*, not architecture. `docs/aip/README.md:3-6` explicitly covers "development process" and `:37` allows an AIP to produce zero ADRs. `IMPLEMENTATION-PLAN.md:565` (B3) already routes it correctly — an `AGENTS.md` amendment. **AIP yes, ADR no.** One caveat: if frame statistics are to become an *engine service* reachable by agents, ADR 0003 has already decided that (§4.2) and it is WORK, still not a new ADR. |
| **Seeded RNG interface** | ADR 0013 decided it (§1.2). Choosing between `hashUnit` and a forkable `RandomStream` is implementation. |
| **Framework-slice promotion criteria (the general rule)** | Governance/process. It belongs in an AIP and possibly `VISION_DIRECTION_H.md`, which already states the slice philosophy at `:37-50`. The *rendering-specific* form of it is inside §2.1, which is where it is load-bearing. |
| **Making `FIXED_STEP_SECONDS` a per-session option** (`05-FRAMEWORK-EASY-WINS.md:1079-1089`) | ADR 0013 `:17` says "a fixed time step" and never fixes the rate. Widening `fixedDeltaSeconds: typeof FIXED_STEP_SECONDS` (`contract.ts:27,55,71`) from a literal type is work, not a decision. |

---

## 3. ADRs needing amendment or supersession

### 3.1 framework/0006 — recommendation, with the judgement call named

**Three options were considered.**

**(a) Change the code to meet the ADR — build a `RenderDriver` now. Reject.** It contradicts the
owner's stated direction (`02-REMEDIATION-PLAN.md:21-24`), and it is precisely the premature
abstraction `GOOD_ENGINEERING_H.md` forbids: *"Let structure emerge from working code… Wait for
natural cut-points… A little code duplication is better than a premature abstraction."* The plan
already withdrew the shared-package proposal for exactly this reason
(`02-REMEDIATION-PLAN.md:26-32`). Building a driver on one implementation would enshrine the wrong
interface.

**(b) Supersede 0006 outright with a successor ADR.** Clean per `docs/adr/README.md:146` (*"When a
decision changes, create a new ADR"*) and `docs/adr/AGENTS.md` (*"Do not change an accepted decision
in place"*). Cost: 0006 carries content that is still correct and still enforced — the containment
rule (`:12-19`), the no-DOM guarantee (`:44-45`), and the contribution clause (`:40`) that §2.4 uses.
A successor would have to restate all of it, and six ADRs plus studio/0007 cite 0006 by number.

**(c) Owner-approved clarification in place, scoping `:25-26` to framework code, plus one new ADR
recording interim game-module ownership and exit criteria.** Preserves 0006's still-true content,
resolves the studio/0007 contradiction, and creates one new record instead of one supersession plus
six citation repairs.

**Recommendation: (c), and I want to name the risk in it honestly.** Scoping "Only an Antiky-owned
`RenderDriver` will use BroMetal directly" down to framework code is arguably a *clarification*
(0006's own context already scopes the harm to framework concerns, `:12-19`) and arguably a *change
of decision*. `docs/adr/AGENTS.md` permits clarification in place only with explicit owner
instruction and requires `docs/adr/tag-hash.sh` to be run while `HEAD` still holds the prior text.
**[owner decision]** — if the owner reads it as a decision change, (b) is correct and (c) is not
available. I lean (c) because studio/0007 has *already* made the substantive decision for game
modules; 0006's text simply never caught up.

**Either way, one thing is not optional:** ADR 0006's status must stop implying that a
`RenderDriver` exists, because `PRODUCT.md:85` and three website pages are repeating that claim to
the public on its authority (§1.7).

**Acceptance criteria for whichever path:**
- `grep -rn "RenderDriver" docs/adr/` returns no clause that asserts the component exists today.
- Every ADR citing `RenderDriver` (0008 `:35`, 0009 `:21`, 0016 `:24,71`, 0019 `:27`, 0020 `:51-52`,
  studio/0007 `:9,23`) still resolves to a readable, non-contradictory statement afterwards. This is
  mechanically checkable: read each citation and confirm it names something the record defines.
- `packages/framework/tests/import-boundary.test.mjs` passes unchanged. The framework's BroMetal-free
  guarantee is the part of 0006 that is real, and it must survive.

### 3.2 framework/0016 — already superseded, still being cited

`docs/adr/framework/0016-give-platform-work-to-game-host_H.md:5` — *"Superseded by ADR 0020"*.
`docs/adr/README.md:107` — a superseded decision *"does not control new work."*

`05-FRAMEWORK-EASY-WINS.md:590` cites it as authority: *"(it never touches an event object — it
receives already-semantic booleans, per ADR 0016's raw-event/semantic-input split)"* [verified].

The substance survives — `framework/0020:48` says *"The game host will change raw device events into
semantic input"* — so the plan's reasoning is sound and only its citation is wrong. **No ADR action.
Fix the citation in the plan.** Flagged here because a plan set built on superseded authority is
precisely the failure mode the ADR README warns about, and it was one line from being a real
problem.

### 3.3 cli/0001 — clarification, low priority

See §1.6. Replace the frozen tool enumeration at `:43-44` with the rule that generates it. Run
`docs/adr/tag-hash.sh` first. Not urgent, but it is currently a record that states something false.

---

## 4. ADRs that constrain the plan and must be respected

### 4.1 framework/0015 — WebGPU only — **constrains W F.1, does not block it**

`docs/adr/framework/0015-webgpu-support-only_H.md:13`: *"Antiky will only support WebGPU. Antiky
will not support WebGL2."*

`studio/0007:37` resolves the apparent conflict: *"This decision does not add Three.js or WebGL to
Antiky Framework"*, while `:30-35` permits a **game module** to choose Three.js. The website's
`demos.ts:50` describing the Three.js group as *"Pure WebGL projects"* is therefore accurate and
permitted [verified].

**Constraint on W F.1** (`06-WORK-PACKETS.md:359`): fixing the fallback *framing* is free. Adding any
WebGL path to the Framework, to a `brometal/` demo, or to an `antiky/` demo breaches 0015 and
studio/0007 `:69` (*"Antiky Framework stays WebGPU-only"*). The plan text at
`02-REMEDIATION-PLAN.md:309-313` is careful about this and says "Fix the fallback framing… or lead
with posters" — no divergence. Keep it that way.

### 4.2 framework/0003 — agent-native — **constrains Track 0's shape**

`docs/adr/framework/0003-agent-native_H.md:17-23`: Studio, agents, tests and other clients use the
same engine services, which include *"Image and video capture"* and *"Diagnostics"*. Consequence
`:35`: *"A feature is not complete until clients can inspect and use it through the shared engine
API."*

`07-TESTING-WITH-ANTIKY-MCP.md:17-21` already caught the important half of this — Track 0 was
rewritten to *wrap* the MCP rather than build a parallel Playwright harness. That correction is
exactly right and is 0003 working as intended.

**Remaining constraint** [inference]: `06-WORK-PACKETS.md:91` puts frame statistics in
`scripts/frame-stats.mjs`, and `IMPLEMENTATION-PLAN.md:330` commits metrics to a per-demo
`visual-metrics.json`. If frame statistics become the acceptance substrate for W0.3, W B.1–B.5, and
every AC in `03-ART-DIRECTION-AND-VFX.md`, then an agent working through Studio or MCP cannot reach
them, only an agent running repo scripts can. That is the split-surface 0003 exists to prevent.

**Verdict: WORK, and a scoping call.** [owner decision] — either (i) declare frame statistics a
repo test utility, not an engine feature, in which case 0003 does not apply and `scripts/` is
correct; or (ii) treat it as a diagnostic capability, in which case 0003 already requires it be
reachable through the shared API. **No new ADR either way.** Decide it before W0.2b, so the code
lands on the right side of the line once.

### 4.3 framework/0004 — 2D, 3D and 2.3D — **the plan's biggest blind spot**

`docs/adr/framework/0004-23d_H.md:14`: *"Antiky will give equal framework support to 2D, 3D, and
2.3D games."* `:22`: *"Framework code must not assume that every object is a mesh, sprite, voxel, or
rigid body."* `:24`: *"Demos for each mode will test shared features and specialized features."*
`:26`: *"Emberwyrd is the primary use case."* And `VISION_DIRECTION_H.md:5`: *"Build our own online
ARPG using the 2.3D art direction we have established for the game."*

**Every plan document excludes the only 2.3D artifact** [verified]:

- `03-ART-DIRECTION-AND-VFX.md:4` — "`antiky-town` is out of scope"
- `04-COMPLEXITY-REDUCTION.md:5` — "`antiky-town` was not read and is out of scope"
- `05-FRAMEWORK-EASY-WINS.md:9` — "`antiky-town/src` was not inspected"
- `IMPLEMENTATION-PLAN.md:609` — "Not touching `antiky-town`"
- `IMPLEMENTATION-PLAN.md:446` — notes it is *"the only demo with a real post pass"*, i.e. the one
  artifact that has already solved part of what Track B is about

`antiky-town` and `town-study` are the sprite-plus-voxel demos —
`src/town/art/sprite-batch.ts` alongside `src/town/art/voxel-surface-mesh.ts` [verified], which is
2D characters in a 3D world, the definition at `0004:14`. Separately, **no demo declares itself
2.3D anywhere in `packages/` source** — the term appears only in `PRODUCT.md` and website copy
[verified].

**Two consequences the plan must absorb.**

1. **Immediate.** Excluding `antiky-town` is a defensible scoping choice for a visual audit. It is
   not defensible as the evidence base for a framework slice. `05-FRAMEWORK-EASY-WINS.md:5-7` sets
   the promotion bar at *"independently re-implemented in three or more demos with the same shape"* —
   and its three are all 3D. A rendering capability promoted on 3D-only convergence will violate
   `0004:22` on contact with sprites.
2. **Structural.** `UNDER_REVIEW_A.md:39-47` (item 4, 2.3D depth policy, **Open**) says
   *"The Town renderer gives evidence, but it does not set shared policy."* The plan set is about to
   generate a large amount of render evidence that deliberately excludes the demo that item 4 depends
   on.

**Recommendation (no new ADR):** add `antiky-town` as a **read-only reference** to Track B's shadow,
ambient and post packets, and require §2.1's AIP to state whether a 2.3D implementation is required
before rendering is promoted. **Acceptance criterion:** the AIP for §2.1 answers that question in one
sentence, either way.

### 4.4 framework/0020 — module boundaries — **satisfied, with one thing to watch**

`0020:60-61`: *"The game module will not import CLI, Studio, website, or server code."* `:63-64`:
*"The compiled output will contain the game module and all necessary runtime files. It will not
contain a development game host."*

The plan is compliant: `scripts/shoot-demos.mjs` (`06-WORK-PACKETS.md:63`) is repo tooling, and
`packages/demos/tests/` guards are cross-demo tests, not game-module code.

**Watch item.** `05-FRAMEWORK-EASY-WINS.md:388-402` proposes splitting a zero-dependency
`@antiky/framework/contract` module. That directly touches what `0020:73` calls *"a compatibility
boundary."* `05:381-383` already flags it as *"a product decision, not an engineering one"* and
leaves it with the owner — correct. **Do not let a subagent land the fence half of that proposal
(the guard test) and the boundary half (a types-only import for framework-free demos) in the same
change.** `packages/demos/tests/dev-host.test.mjs:72,95` is the fence [verified]; the split is safe,
opening the fence is not.

### 4.5 cli/0001 and cli/0002 — **satisfied**

W0.1 (`06-WORK-PACKETS.md:30`) edits `packages/cli/src/host/actions.ts` and
`capture-service.ts` — host services, not the MCP adapter, so `cli/0001:46-47` (*"MCP will remain an
adapter and will not own engine facts"*) holds. `cli/0002:49` (*"The library API will not read
`process.argv`, write terminal output, or call `process.exit`"*) is untouched. W0.1's own criterion
— *"neither is a magic number at a call site"* (`06-WORK-PACKETS.md:46`) — is well aligned with
`cli/0002:50` requiring timeouts and configuration to arrive through typed inputs.

### 4.6 framework/0002 and 0010 — checked, no constraint

ADR 0002 `:24-34` keeps render state and diagnostics transient by default. A committed
`visual-metrics.json` sidecar is a test fixture, not a domain event, and ADR 0002 governs the
durable event log. ADR 0010 `:20-27` governs serialization at real boundaries; a JSON file written
by a script is `import and export` and `durable storage`, both already listed. **No divergence.**

---

## 5. Sequencing against `06-WORK-PACKETS.md`

`06-WORK-PACKETS.md` currently has **no packet for ADR or AIP work**. That is the sequencing gap:
the critical path at `:371` runs straight from W0.1 to W E(point-light-expo) with no decision point,
so the owner would first meet §2.1 and §2.3 mid-flight, at the moment three demos are already
diverging.

**Recommendation: add a Track G to `06-WORK-PACKETS.md`.** Its packets own only
`docs/aip/**` and are therefore disjoint from every existing packet — the concurrency rule at
`06-WORK-PACKETS.md:8-10` is satisfied trivially, and Track G runs fully in parallel.

### Not blocked by anything. Start now.

- **All of Track 0** (W0.1, W0.1b, W0.2, W0.2b, W0.3, W0.4). Tooling and tests only. W0.4's
  invariant assertions are regression tests for documented bugs and are permitted by
  `AGENTS.md` on that basis — `IMPLEMENTATION-PLAN.md:372-380` reasons this correctly.
- **All of Track D.** W D.5 (interpolation) closes no ADR gap (§1.3) and needs no decision.
- **W C.1, W C.2, W C.3-interim.** Specific bug repairs.
- **Track E items 1–9** (`03-ART-DIRECTION-AND-VFX.md:960-962`).
- **`05-FRAMEWORK-EASY-WINS.md` items 1, 2, 4, 5, 6.** Items 1 and 4 close the ADR 0013 gap (§1.2)
  and should be pulled *early*, not left at their listed order, because W0.3's and Track B's
  acceptance criteria all rest on comparable frames, and `07-TESTING-WITH-ANTIKY-MCP.md:150-154`
  correctly notes there is no seed today.
- **§1.7 — the public product claim.** Independent of everything. Fix this week.

### Decision should precede the work

| Work | Blocked on | Why, and the cost of getting it wrong |
|---|---|---|
| **W A.1, W A.2** (Track A, BroMetal patches) | §2.4 AIP | Doubles the local-patch surface on a pinned dependency with no recorded policy. Both patches individually clear ADR 0006 `:40` (§2.4), so the *contributions* are fine — it is the local `postinstall` rewriting of `node_modules` that is unrecorded. **[owner decision]:** the existing `discard()`/`present()` precedent may be judged sufficient. If so, say so in one line and unblock. This is a one-sitting decision, not a research project. |
| **Carrying W B.1 to demos 2 and 3** | §2.2 ADR | W B.1(point-light-expo) is the evidence and must land *first* (`docs/adr/README.md:110-111`). But three demos landing three colour contracts before the ADR is exactly the divergence `02-REMEDIATION-PLAN.md:81-99` warns about. **Land one, record, then carry.** |
| **W C.3** (converge the three asset scripts) | §2.3 ADR | Converging three scripts into one fidelity policy *is* choosing the policy. W C.1 and W C.2 are point repairs and are not blocked. |
| **W F.1** (WebGPU fallback framing) | §2.5, conditionally | Not blocked if the fix is copy and CSS. Blocked if it moves `requiresWebGpu` onto the game-module contract (§2.5). |
| **Any framework promotion from `05-FRAMEWORK-EASY-WINS.md` item 3** | §4.4 / owner product call | `05:381-383` already routes this correctly. |
| **Any promotion of rendering into `@antiky/framework`** | §2.1 ADR **and** §4.3 | This is the far end of the plan and is not near-term, but the AIP should exist before three demos finish converging, not after. |

### Recommended Track G packets

**W G.1 — AIP: per-demo render ownership and the framework render slice.**
**Owns:** `docs/aip/**` (one file). **Depends on:** nothing. **Do first.**
**Acceptance:** meets §2.1's four criteria; ≤500 lines; cites only code, ADRs and dependency
versions as authority, never this directory (`docs/adr/README.md:71-73`).

**W G.2 — AIP: local modification of pinned third-party dependencies.**
**Depends on:** nothing. **Unblocks:** W A.1, W A.2.
**Acceptance:** meets §2.4's four criteria. Should be short — this is a policy, not a design.

**W G.3 — Correct the public render-driver claim.**
**Owns:** `packages/website/PRODUCT.md`, `src/app/page.tsx`, `src/app/framework/page.tsx`,
`src/app/thesis/page.tsx`. **Depends on:** nothing.
**Acceptance:** no committed public text asserts a Framework render driver as a **Current**
capability; `packages/website/tests/site-shell.test.mjs` passes; the wording matches PRODUCT.md's own
evidence taxonomy at `:87-96`.

**W G.4 — AIP: asset intake fidelity policy.**
**Depends on:** W A.4 / G5 existing and failing at HEAD. **Unblocks:** W C.3.
**Acceptance:** meets §2.3's three criteria; states its relationship to `UNDER_REVIEW_A.md` item 11
in its first paragraph.

**W G.5 — AIP: colour management and transfer-function boundaries.**
**Depends on:** W B.1(point-light-expo) passing. **Unblocks:** W B.1(combat-arena),
W B.1(traversal-study).
**Acceptance:** meets §2.2's three criteria; contains no pass-graph content.

**W G.6 — ADR clarifications (owner-executed).**
`cli/0001:43-44` tool enumeration (§1.6); `framework/0006` per §3.1.
**Acceptance:** `docs/adr/tag-hash.sh` run while `HEAD` holds the prior text, per
`docs/adr/README.md:149-157`; ASD-STE100 audit reported separately from format and link checks, per
`docs/adr/AGENTS.md`.

---

## 6. Faults in the plan set itself

Raised loudly, as `docs/adr/README.md:15` asks. None of these invalidate the plan; all of them
would mislead an agent executing it.

1. **Superseded ADR cited as authority.** `05-FRAMEWORK-EASY-WINS.md:590` cites ADR 0016, whose
   status is *"Superseded by ADR 0020"* (`0016:5`). Substance survives at `0020:48`. **Fix the
   citation to 0020.**

2. **Overstated determinism claim.** `05-FRAMEWORK-EASY-WINS.md:473` says *"In `point-light-expo`,
   `seeded()` feeds shade `phase` at `simulation.ts:160` — simulated state, not decoration."*
   Verified: `phase` is written at `point-light-expo/src/simulation.ts:160` and read **only** by
   `src/relay-visuals.ts:102` and `:421` — presentation. The digest at `simulation.ts:485-498` does
   not include it, and shade `x`/`z` come from `initialShadePositions`, not from `seeded`. The claim
   is **true for `combat-arena`**, where `combat-digest.ts:112` hashes `enemy.phase`, set from
   `seeded(index, 2)` at `combat-state.ts:260`. **Cite combat-arena.** The argument survives intact;
   only the example is wrong.

3. **A permission reported as a requirement.** Render interpolation is permitted by ADR 0013 `:30`
   (*"can estimate"*), not required. `05-FRAMEWORK-EASY-WINS.md:70-79` frames both interpolation and
   seeds as *"accepted decisions that were never implemented."* That is exact for seeds and
   overstated for interpolation. See §1.3.

4. **The two plan documents contradict each other on committed captures.**
   `06-WORK-PACKETS.md:83-85`: *"**The PNG is not the committed artifact** — `.antiky/` is
   gitignored, evidence retention is session-scoped, and `*.png` is LFS here."*
   `IMPLEMENTATION-PLAN.md:329`: capture PNG committed to
   `docs/objectives/demo-refining/evidence-captures/<slug>.png`, *"Yes, one per demo, bounded."*
   Both cite the same LFS constraint and reach opposite conclusions. **[owner decision].** A subagent
   handed both documents will pick one at random.

5. **A path that does not exist.** `02-REMEDIATION-PLAN.md:346` and `IMPLEMENTATION-PLAN.md:329`
   both write to `docs/objectives/demo-refining/evidence-captures/`. The captures are at
   `docs/objectives/scratch/demo-refining/evidence-captures/`. `IMPLEMENTATION-PLAN.md:550` (A1)
   proposes promoting files out of `scratch/`, which may be the intent — but the two documents
   already write the post-promotion path as though it exists.

6. **A withdrawn figure still carried as an acceptance criterion.**
   `IMPLEMENTATION-PLAN.md:576` requires S4 `direct-antiky-look` to carry *"the honest ceiling
   analysis (35% rendering / 25% self-inflicted pipeline / 40% asset ceiling)"*.
   `03-ART-DIRECTION-AND-VFX.md:64-72` revised that to 35 / 25 / 30 / **10**, and `:31-33` calls the
   40% figure *"the most consequential error"* in the doc set. The skill plan would bake the
   retracted number into a skill.

7. **`04-COMPLEXITY-REDUCTION.md` A1 under-scopes a real defect.** The proposed `course-query.ts`
   split (`:112`) moves `platformInstances` to another file but does not say to make it
   per-instance. As module state it breaches ADR 0008 `:21-22` (§1.5) and blocks sandbox isolation
   (`UNDER_REVIEW_A.md` item 7). **Add "per simulation instance" to A1's acceptance criteria.**

8. **No plan document mentions ADRs at all.** Seven documents, ~4,300 lines, roughly sixty work
   packets. `05-FRAMEWORK-EASY-WINS.md` is the only one that cites an accepted ADR as a driver
   (`:70-79`, ADR 0013). `AGENTS.md` requires ADR compliance and `CONTRIBUTING.md:14` says *"Follow
   accepted ADRs"* — but nothing in the executable backlog routes an agent to them. That is the
   structural reason §1.1 and §2.4 went unnoticed for the length of a four-agent audit, and adding
   Track G is only half a fix. **The other half:** add "names the ADRs it touches, or states that it
   touches none" to `06-WORK-PACKETS.md:376-384`'s dispatch rules.

---

## 7. Summary table

| # | Item | ADR | Verdict | Blocks |
|---|---|---|---|---|
| 1.1 | No `RenderDriver`; 0006 vs studio/0007 contradiction | fw/0006, st/0007 | **DECISION** | promotion, not near-term work |
| 1.2 | No seed reaches any simulation | fw/0013 | **WORK** | pull early — Track 0 + B rest on it |
| 1.3 | Interpolation absent in 3 of 4 antiky demos, inert in the 4th | fw/0013 | **WORK** (permission, not breach) | nothing |
| 1.4 | Three ground-height projections, no drift detector | fw/0009 | **WORK** | W0.4, F1 already cover it |
| 1.5 | Module-level mutable simulation state | fw/0008 | **WORK** | sandbox isolation |
| 1.6 | Stale MCP tool enumeration | cli/0001 | **WORK** (clarification) | nothing |
| 1.7 | Public "Framework render driver" claim | — | **WORK** | nothing — do it now |
| 2.1 | Interim render ownership + exit criteria | new | **AIP → ADR** | framework promotion |
| 2.2 | Linear colour / transfer boundaries | new | **AIP → ADR** | W B.1 carry to demos 2, 3 |
| 2.3 | Asset intake fidelity | new | **AIP → ADR** | W C.3 |
| 2.4 | Local patching of a pinned dependency | new | **AIP → ADR** | W A.1, W A.2 |
| 2.5 | Delivery-host renderer branching | new | **conditional** | W F.1, if contract changes |
| 2.6 | Capture gate / seeds / promotion rule / fixed-step type | — | **rejected as ADRs** | — |
| 4.3 | Plan excludes the only 2.3D demo | fw/0004 | **constraint** | §2.1 AIP must answer it |
