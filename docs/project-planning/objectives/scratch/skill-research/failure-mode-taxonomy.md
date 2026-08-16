# Failure-mode taxonomy — what agents actually get wrong building games in this repo

Derived: 2026-08-10. Supporting detail for [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

## Where this evidence comes from

In August 2026 a highly capable coding agent (GPT 5.6) was tasked with building AAA-quality game
demos in this repository. It produced `point-light-expo`, `combat-arena`, and `traversal-study`.
The owner judged the result poor. A four-agent audit then documented, with `file:line` citations,
exactly how and why it failed:

- [`00-VISUAL-DIAGNOSIS.md`](../demo-refining/00-VISUAL-DIAGNOSIS.md) — what the frames look like
- [`01-RENDERING-VOCABULARY.md`](../demo-refining/01-RENDERING-VOCABULARY.md) — the shared language
- [`02-REMEDIATION-PLAN.md`](../demo-refining/02-REMEDIATION-PLAN.md) — the repair sequence
- [`subagent-reports/01-antiky-render-audit.md`](../demo-refining/subagent-reports/01-antiky-render-audit.md)
- [`subagent-reports/02-brometal-capability-audit.md`](../demo-refining/subagent-reports/02-brometal-capability-audit.md)
- [`subagent-reports/03-asset-pipeline-audit.md`](../demo-refining/subagent-reports/03-asset-pipeline-audit.md)
- [`subagent-reports/04-baseline-demos-and-presentation.md`](../demo-refining/subagent-reports/04-baseline-demos-and-presentation.md)

This is a **natural experiment**, and it is the most valuable input a skill library for this
repository could have. Everything else in `skill-research/` reasons about what agents *might* get
wrong. This tells us what one actually did get wrong, on this codebase, with these constraints.

## The shape of the failure

The single most important observation is what did **not** fail.

> The demos' game logic — simulation, input, encounters, collision, state machines — is sound and
> tested. `02-REMEDIATION-PLAN.md` is explicit: *"Don't rewrite the demos' game logic. The
> simulation, input and encounter code is not the problem, and it has tests."*

The agent could program. It failed at **rendering architecture, colour management, asset handling,
art direction, and self-verification**. Any skill library that spends its first budget on gameplay
implementation is optimising the one thing that already worked.

The second most important observation is the meta-failure:

> *"No shader in this repo shows evidence of having been looked at after it was written."*
> — `02-REMEDIATION-PLAN.md`

The repository ships a capture and inspection toolchain. It went entirely unused. Every other
failure below is downstream of that one, because every one of them is visible in a single frame.

## Classification principle

Each failure is assigned to the intervention that would actually have caught it:

| Intervention | Catches | Because |
| --- | --- | --- |
| **Skill** | Failures that require a non-obvious, project-pinned fact *at authoring time* | Prose changes what the agent does before it acts |
| **Lint / test** | Failures detectable by inspecting the artifact after the fact | A check changes what survives; it never forgets, and it never gets bored |
| **Gate / review** | Failures that require judgement about a player-facing outcome | No amount of prose or assertion substitutes for looking and deciding |
| **Nothing** | Failures a capable model already avoids given the above | A skill restating general knowledge is worse than no skill |

A failure class may map to more than one, but every class has exactly one **primary** owner. When a
lint can catch it, the lint is primary and the skill only explains *why the lint exists* — that is
much cheaper than teaching the rule in prose and hoping.

---

## F1 — Pipeline architecture omission

**The agent never created the structure a capability requires, so the capability became
structurally impossible rather than merely absent.**

| # | Observed | Evidence |
| --- | --- | --- |
| F1.1 | No demo ever calls `createRenderTarget`. Every frame draws straight to the swapchain. Shadow maps, HDR, bloom, AO, DOF and colour grading all need at least one offscreen pass, so all six are impossible, not unimplemented. | `00-VISUAL-DIAGNOSIS.md` root cause 1; render audit §0 |
| F1.2 | `tonemapACES()` is called inside each material's fragment shader. Tone mapping is by definition the last step of a frame. Every effect compositing afterwards composites onto crushed, `[0,1]`-clamped values — which is why every VFX reads as a flat sticker. | render audit §1.2; `point-light-expo` `reliquary-model.shader.ts:181`, `reliquary-floor.shader.ts:129`, `foundry.shader.ts:191`; `combat-arena` `ship-model.shader.ts:78` and three more |
| F1.3 | Tone mapping is applied *inconsistently*: 3 of 5 shaders in `point-light-expo`, 4 of 5 in `combat-arena`, **1 of 3** in `traversal-study`. Two families of objects sit on different response curves in the same frame. | render audit §1.2 |
| F1.4 | Exposure control exists in exactly one demo (`uExposure = 1.24`, `point-light-expo/src/presentation.ts:9`). The other two have no exposure dial at all. | render audit §5.2 |
| F1.5 | No render interpolation anywhere. A fixed 60 Hz simulation is presented raw, so every 120/144 Hz display shows judder in all continuous motion. | render audit §5.1; `framework/src/sessions/engine-session/contract.ts:4` |

**Primary intervention: skill** (`build-antiky-frame`), because the correct pass structure under
BroMetal 0.15's specific constraints is not inferable — see F2 and the capability audit.
**Secondary: lint** (G3, pipeline-invariant test) to hold the line once established.

**Not a skill:** "what an HDR pipeline is." A capable model knows. The skill carries the *pin list*
and the *pass order for this renderer*.

---

## F2 — Colour and transfer-function errors, then compensation for them

**The agent got the colour pipeline wrong, did not detect it, and then added knobs to fight the
symptom — which destroyed material definition in the process.**

| # | Observed | Evidence |
| --- | --- | --- |
| F2.1 | Textures upload as `rgba8unorm`, never `-srgb`. The swapchain uses `getPreferredCanvasFormat()`, spec-restricted to non-sRGB variants. So there is **no decode on read and no encode on write**, and all lighting maths happens in display space. | BroMetal audit §1, §5; `webgpu.js:848`, `webgpu.js:79-80` |
| F2.2 | The two errors *cancel exactly* for unlit passthrough and stop cancelling the moment you multiply by a light. This is precisely why the defect survived review: an untextured or unlit surface looks fine. | `02-REMEDIATION-PLAN.md`, "Note on the colour bug's shape" |
| F2.3 | `uDiffuseLift: 0.14`, `uTextureContrast: 0.78`, `uSaturation: 0.9` reduce to `albedo_out = 0.78·albedo + 0.2456` — a 25% black-point lift with contrast cut to 78%, baked in *before* lighting. The floor is worse: only 56% of the Poly Haven texture's contrast survives. | render audit §2.2; asset audit §4.3; `presentation.ts:20-26` |
| F2.4 | `uGradeMix` replaces 90% of the cloud texture and 78% of the cliff texture with a flat constant, compensating for a broken asset intake (see F4.3). | render audit §4.2; asset audit §4.2 |

**Primary intervention: skill** (`build-antiky-frame`, `references/color-management.md`). This is
genuinely non-obvious and genuinely project-pinned: a capable model knows sRGB theory perfectly
well, but it cannot know that *this* renderer offers no hardware path in either direction, that the
fix must be an in-shader `srgbToLinear` on albedo only, and that roughness/AO/ARM maps must **not**
be decoded because they are authored as non-colour data.

**Secondary: lint** (G3) — every albedo sample goes through the decode helper; the demo's post
shader is the only site that encodes.

**The compensation knobs are the tell.** Their existence is the strongest available signal that an
agent is fighting a symptom without a mental model. The skill should name them as scar tissue and
say: *delete, do not re-tune.*

---

## F3 — Incomplete or stubbed physical model

| # | Observed | Evidence |
| --- | --- | --- |
| F3.1 | BroMetal's `specGGX` is the **microfacet distribution term only**. No Fresnel, no geometry/shadowing term, and a flat `0.25` where `1/(4·NdotL·NdotV)` belongs. It is not energy-conserving and spikes toward infinity as roughness → 0, so every call site has to clamp it. | render audit §0; BroMetal audit item 7; `toon.shader.gen.js:19-29` |
| F3.2 | `combat-arena`'s ship shader has **zero specular of any kind** — `specGGX` is not imported by any combat-arena shader. Against a Rocket League target, whose read is almost entirely a sharp specular lobe on curved car paint, this is fatal. | render audit §3.1 |
| F3.3 | `traversal-study`'s model shader (all 13 GLBs) is a three-step toon ramp spanning 0.54→0.98 — a maximum contrast ratio of **1.81:1**, with no view-dependent term at all. That ramp alone explains the flat look. | render audit §4.1 |
| F3.4 | Point-light falloff is `clamp(1 - d²/r², 0, 1)²` — windowed, but with **no `1/d²` core**, so the light has no bright centre. Coverage is three radius-3.5 spheres over a 16×11 set; everything outside them is ambient only. | render audit §2.1 |
| F3.5 | No Fresnel anywhere in any demo. Ambient is a flat constant or a two-term fake hemisphere with a 1.8× range. | render audit §5.2 |

**Primary intervention: lint + reference, not a prose skill.** Cook-Torrance GGX is textbook
knowledge a capable model reproduces on request. The *non-obvious* part is one sentence: **BroMetal
ships a helper named `specGGX` that looks like a GGX BRDF and is a trap.** That belongs in a
reference and in a lint asserting no material shader uses it bare.

This class is the clearest example of the discipline the library needs: the failure looks like a
graphics-knowledge gap and is actually a project-fact gap.

---

## F4 — Destructive asset processing

**The agent resolved runtime limitations by destroying source data at intake.** This is the
single most concrete and most reversible category, and it is entirely self-inflicted.

| # | Observed | Evidence |
| --- | --- | --- |
| F4.1 | `gltf-pack-lib.mjs:89` runs `delete material.normalTexture` on normal maps that were downloaded, hashed, and committed. Rationale recorded in the script: *"the runtime shader has no tangent basis."* A renderer limitation leaked backwards into the pipeline and cost the highest-fidelity assets in the repo all their surface detail. | asset audit §2.1 |
| F4.2 | `normalize-quaternius.mjs:238,267` never reads `TEXCOORD_0`. It overwrites every UV with `paletteU = (materialIndex + 0.5) / colors.length`, a lookup into an N×1-pixel PNG built from `baseColorFactor` alone. Shipped results: `cloud-large`, `cloud-small` and `coastal-cliff` textures are literally **1×1 pixels**. | asset audit §2.3, §3 |
| F4.3 | Because the extraction produced olive-drab clouds, the renderer was then tuned to blend them 90% toward white. A hack papering over a broken extraction — and the reason the fix requires touching both files. | asset audit §2.3, §4.2 |
| F4.4 | Kenney models ship `TANGENT` attributes. Nothing reads them. `point-light-expo`'s intake claims no tangent basis exists while a different demo's assets ship one. | asset audit §3; render audit §0 |
| F4.5 | Palette textures are created without `filter`, so BroMetal builds a mip chain and samples linearly with 4× anisotropy. Mip 2 of a 6-pixel palette is the average of all six colours — the courier's blue, orange and teal literally smear together at distance. The generated GLB *declares* `nearest`; BroMetal ignores glTF samplers. | asset audit §2.3; `traversal-study/src/renderer.ts:216` vs `webgpu.js:844-856` |
| F4.6 | Three divergent per-demo intake scripts with three different fidelity policies. Two of the three are lossy. | asset audit §2 |
| F4.7 | 332 cataloged CC0 HDRIs, zero used at runtime. | asset audit §7 |

**Primary intervention: skill** (`intake-antiky-assets`) carrying one non-obvious *policy*:
**intake preserves; the runtime adapts. A renderer limitation is never a reason to delete source
data.** That inversion is the whole lesson and it is not something a model derives on its own —
deleting the unusable binding is locally the reasonable-looking choice every time.

**Secondary: hard gate** (G5, asset fidelity manifest). This class is unusually well suited to
automation because the defects are all measurable from the shipped artifact: attribute presence,
texture dimensions, unique-UV count.

**Note on what is *not* the problem:** licensing. Every asset in every snapshot is CC0-1.0 with
modification and redistribution permitted (asset audit §1.3). The existing `source-game-assets`
scaffold is aimed almost entirely at licensing and provenance — a real concern in general, and a
non-constraint here.

---

## F5 — Uncorroborated divergence between duplicated implementations

**Duplication is cheap and deliberate in this repo. Duplicated bugs silently diverging is not.**

| # | Observed | Evidence |
| --- | --- | --- |
| F5.1 | `combat-arena` has **three shaders that disagree on sun direction**: `(-0.44, 0.86, 0.42)` + fill, `(0.38, 0.9, 0.28)`, `(0.46, 0.88, 0.3)`. Objects lit by different suns cannot read as one space. | render audit §3.1 |
| F5.2 | The same three shaders carry **three different fog ranges** — `(17,34)×0.55`, `(15,28)×0.72`, `(13,26)×0.8` — and fade toward three slightly different colours. Objects at equal distance fade by different amounts depending on which shader drew them. | render audit §3.5 |
| F5.3 | `traversal-study` fog fades toward `(0.55,0.65,0.66)` while the clear colour is `(0.38,0.57,0.68)`, so distant geometry fades toward a grey visibly different from the sky behind it. | render audit §4.5 |
| F5.4 | Inverse instance scale is applied correctly in `ship-model.shader.ts:47` and omitted in four other shaders, so scaled glow geometry gets wrong facing and rim values. | render audit §3.4, §4.3 |

**Primary intervention: lint** (G4, intra-demo coherence). This is the cleanest lint-not-skill case
in the whole taxonomy. No prose reliably prevents three files drifting apart over months; a test
that asserts they agree does, and it keeps working when demos legitimately diverge — provided
divergence must be declared with a reason.

`02-REMEDIATION-PLAN.md` reaches the same conclusion independently and for the right reason: this
gives most of the safety a shared module would give, at none of the architectural cost, and it does
not front-run the framework's slice schedule.

---

## F6 — Motion and feel built from the wrong signal shape

| # | Observed | Evidence |
| --- | --- | --- |
| F6.1 | Camera shake is `sin(t·47)` and `cos(t·41)`. The frequencies differ by 6 rad/s, so X and Z beat with a ~1.05 s period: the camera traces a slowly precessing Lissajous figure. Pure periodic motion reads as *malfunction*, not impact. | `02-REMEDIATION-PLAN.md`; `combat-arena/src/presentation.ts:34-35` |
| F6.2 | The shake is driven by a metronome. The auto-cannon fires every 0.34 s and each hit sets impact 0.45, decaying at 4.2/s — a pulse ~3×/second, continuously, for the whole fight. Shake stops punctuating and becomes the ambient state. | `simulation.ts:448-449, 259, 378` |
| F6.3 | It is mis-scaled: a routine cannon tick delivers 0.45 against 1.0 for losing hull. The most frequent event is nearly the most violent. | `simulation.ts:203` |
| F6.4 | The shake offsets camera **position but not its look-at target**, so the view *rotates* rather than translating — the whole frame swivels, including far arena edges. This is most of the felt "judder". | `presentation.ts:70-75` |
| F6.5 | `combat-arena` has zero camera smoothing; every value is assigned directly each frame, so the camera snaps. `traversal-study/src/presentation.ts:73` already contains the correct framerate-independent exponential easing. | render audit §3.5, §4.5 |
| F6.6 | Squash/stretch exists but at ±6–7%, well below the threshold where it reads as personality. | render audit §4.6 |

**Primary intervention: test** (G7), **secondary: skill** later (`tune-antiky-game-feel`), and a
large fraction is **nothing** — trauma-squared and noise-based shake is standard, well-documented
craft a capable model produces on request.

What earns repository-specific treatment is narrow: the fixed-step session presents with no
interpolation alpha (F1.5), and a correct easing implementation already exists one file away and
was not copied. `tests/presentation.test.ts:62` already covers camera impact bounds, so the
regression test has a home. Build the test now; defer the skill until there is evidence a skill
adds anything the test does not.

---

## F7 — Absent art direction and composition

| # | Observed | Evidence |
| --- | --- | --- |
| F7.1 | `point-light-expo`'s ground is a hard-edged quad floating in pure black, with crisp trapezoid corners cut against the void. No horizon, no backdrop, no fog fading the boundary. The loudest "unfinished student project" signal an image can send. | `00-VISUAL-DIAGNOSIS.md` §2 |
| F7.2 | The lighting demo **fails to demonstrate its own headline feature**: no falloff gradient across any surface, no coloured bounce, no shadow cast away from any light. | ibid |
| F7.3 | ~60% of the platformer frame is empty sky; the player is small and off-centre-left; the bottom-right quadrant is dead. | ibid §1 |
| F7.4 | `combat-arena` sits entirely in a 15–35% luminance band — no bright side, no dark side to anything. | ibid §3 |
| F7.5 | Rim props at mismatched scales and arbitrary rotations, so a stadium reads as a debris pile. Yellow squiggle cables read as random noodles. | ibid |
| F7.6 | The HUD is a cluster of coloured 3D boxes floating in the sky. `point-light-expo`'s overlay is a hard 1px-red-bordered black box with terminal typography — debug output presented as game UI. | ibid §1, §2 |
| F7.7 | Fake contact shadows are routed through the **lit** path, so a blob directly under a relay light receives radiance ≈1.65 and gets roughly **6× brighter** near a light. A shadow that glows. | render audit §2.3; `foundry.shader.ts:181`, `combat-projection.ts:240` |

**Primary intervention: artifact + gate.** Not a "how to do art direction" essay — the model has
that knowledge and did not lack it. What was missing is a **declared, checkable visual target** to
have failed against, and an independent reviewer to notice. F7.7 is the exception and is really an
F1/F3 bug wearing an art-direction costume; a lint catches it.

The realistic target is stated honestly in the diagnosis and should be carried into the target
artifact verbatim: the gap is *not* an asset-fidelity gap; roughly 35% is rendering, 25% is
self-inflicted pipeline damage, and 40% is genuine asset ceiling. **Best-in-class stylised** —
Astro Bot, Untitled Goose Game, Monument Valley — is reachable. Rocket League is not, and chasing
it is the wrong goal.

---

## F8 — Working blind (the root cause)

**No capture, no comparison, no iteration. The agent shipped what it believed the code would do.**

| # | Observed | Evidence |
| --- | --- | --- |
| F8.1 | *"No shader in this repo shows evidence of having been looked at after it was written."* The repository ships `antiky tool capture_frame`, `capture_gameplay_sequence`, a managed WebGPU Chromium, and an evidence store. None is in the loop. | `02-REMEDIATION-PLAN.md`, "The process fix that matters more than any of the above" |
| F8.2 | Every defect in F1–F7 is visible in a single still frame. Not one required a debugger, a profiler, or a GPU capture. | `00-VISUAL-DIAGNOSIS.md` in its entirety |
| F8.3 | The READMEs are unusually honest and contain no overclaiming — the agent described what it built accurately. It simply never checked whether what it built looked like anything. | render audit §5.3 |

F8.3 is worth dwelling on. This was not a dishonest agent producing inflated claims. It was an
accurate agent with no feedback loop. That distinction matters for the library design: the fix is
not more truthfulness instructions, it is a **mandatory observation step with a machine-checkable
artifact**.

**Primary intervention: skill + hard gate, at the top of the priority order.** This is the highest
leverage item in the entire plan and everything else is downstream of it.

---

## F9 — Evidence hygiene: artifacts produced and never validated

| # | Observed | Evidence |
| --- | --- | --- |
| F9.1 | Three of six committed Three.js runtime captures are **100% blank white PNGs**, sitting in a directory named `captures`, and `PRODUCT.md:113` cites those studies as current evidence. Both demos set `preserveDrawingBuffer: true`, so it is a capture-timing bug, not a render failure. | presentation audit §3.1 |
| F9.2 | Glass Garden **cannot reproduce its own poster**. The poster is ~40% clipped white; the runtime capture is a near-black void. Same scene, same code, no exposure control. | presentation audit §1.6 |
| F9.3 | The root `combat-arena-runtime.png` is stale — it shows torus-knot placeholders that no longer exist. | `00-VISUAL-DIAGNOSIS.md` header |
| F9.4 | Capture aspect is ~2.14:1 while every poster master is 16:9 and every stage container is `aspect-ratio: 16/9`. The capture pipeline and the presentation pipeline disagree about frame shape. | presentation audit §3.1 |

**Primary intervention: lint** (G1 degenerate-capture guard, G6 poster/runtime agreement). This is
the most mechanically catchable class in the taxonomy — a capture that is 100% one value is a
one-line assertion — and it is also the most damaging to credibility, because it is *published*.

It also proves an important point about F8: the loop failed even in the one place where captures
*were* being produced. Producing a capture is not looking at it. The guard must assert the capture
is non-degenerate, and the skill must require the agent to state in words what it sees.

---

## F10 — Delivery-context failures

| # | Observed | Evidence |
| --- | --- | --- |
| F10.1 | Eight of ten demos are `requiresWebGpu: true`. On Safari and Firefox a page headlined "Run the work / Ten live studies" is eight error cards and two working three.js scenes. The unintended message is *"only the non-Antiky demos work."* | presentation audit §2.4 |
| F10.2 | Demo thumbnails are hover-activated only, so mobile `/demos` is ten static posters. | presentation audit P1 |
| F10.3 | `background-size: cover` crops 16:9 posters to their middle ~35% on a portrait stage. Only one demo has a mobile poster. | presentation audit P2, P3 |
| F10.4 | Developer error strings surface to public visitors. | presentation audit P9 |
| F10.5 | `town-study` — ~9,000 lines, a real voxel mesher, twelve shader pairs including dedicated shadow passes, the strongest artifact in the repository — is billed identically to three fullscreen 2D shader quads. | presentation audit §1.4, Tier 2 |

**Primary intervention: none of the above — this is product work, not a skill target.** Listed for
completeness so that the plan does not silently absorb it. The one transferable lesson is F10.5's
inverse of F8: the demo that *did* have a full pipeline got no credit, which is a presentation
decision, not an agent-capability decision.

---

## Summary map

| Class | Primary | Secondary | Skill or check |
| --- | --- | --- | --- |
| F1 Pipeline architecture omission | Skill | Lint | `build-antiky-frame`; G3 |
| F2 Colour / transfer function | Skill | Lint | `build-antiky-frame` + colour reference; G3 |
| F3 Stubbed physical model | Lint | Reference | G3 (`specGGX` trap); BroMetal pins reference |
| F4 Destructive asset processing | Skill | Gate | `intake-antiky-assets`; G5 |
| F5 Uncorroborated divergence | Lint | — | G4 |
| F6 Motion / feel signal shape | Test | Skill (deferred) | G7; `tune-antiky-game-feel` later |
| F7 Absent art direction | Artifact + gate | — | `direct-antiky-look`; `review-antiky-visual-quality` |
| F8 **Working blind** | **Skill + gate** | — | **`verify-antiky-frame`; G1, G2** |
| F9 Evidence hygiene | Lint | Skill | G1, G6; `verify-antiky-frame` |
| F10 Delivery context | Product work | — | out of scope |

## What this taxonomy says about the existing scaffolds

Read each scaffold against the classes above and ask: *if the previous agent had followed this
skill faithfully, which defect would it have avoided?*

| Scaffold | Classes it addresses | Verdict |
| --- | --- | --- |
| `build-antiky-games` | None. It covers project boundaries, build acceptance, stable IDs, and running tests — all reasonable, all general. Its one nod to observation says to prefer MCP state *over* screenshots, which points away from F8. | Replace |
| `write-brometal-shaders` | None. "Inspect the installed version", "reuse long-lived GPU resources", "define typed shader inputs explicitly." Nothing about tone-map placement, colour management, the `specGGX` trap, MSAA loss on `drawTo`, nearest sampling on targets, or the 8-attribute cap. | Replace |
| `source-game-assets` | None of the observed defects. Aimed at licensing and provenance, which the audit found to be uniformly clean and not a constraint. Silent on fidelity preservation, which is where the worst defect in the repo lives. | Replace |

**All three scaffolds, applied faithfully, would have prevented none of the observed defects.**

That is a stronger conclusion than the matched no-skill baseline runs planned in
[`goals/execute-goal-01.md`](../../skill-research/goals/execute-goal-01.md) would have produced, and it is available now
for free. It does not make goal 01 redundant — the catalog, schemas, validator, and matched-baseline
*machinery* are still needed, and this evidence cannot substitute for a controlled run. But goal
01's scaffold-audit deliverable can be answered largely from this document, and its task clusters
should be re-aimed before any runs are executed. See the plan's evaluation section.
