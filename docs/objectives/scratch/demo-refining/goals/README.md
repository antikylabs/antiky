# Demo Refining — Goal Sequence

**Date:** 2026-08-10
**Purpose:** this is the **contract**. The audit in `../` says what is wrong; these thirteen goals
say what will actually get built. Review this file and the goal files before any code is written.

Run them with `/goal` in order. Where goals are parallel-safe, this document says so explicitly.

---

## The sequence

| # | Goal | Depends on | Parallel-safe with | Rough size |
|---|------|-----------|--------------------|-----------|
| **00** | Settle the architecture record and the public claims | — | 01, 02, 10 | ~half a day |
| **01** | Build the verification loop (Track 0) | — | 00, 02 | ~2 days |
| **02** | Unblock the render pipeline in BroMetal (Track A) | — | 00, 01, 04, 05, 10 | ~1 day |
| **03** | Quick wins, motion feel, safe dead-code removal (Track D) | 01 | 04, 05, 10 | ~2 days |
| **04** | Stop the asset pipeline destroying the assets (Track C) | 01 | 02, 03, 05, 10 | ~3 days |
| **05** | Give the existing assets real materials — triplanar PBR | 01, 04 | 02, 03, 06, 07, 10 | ~14 days |
| **06** | The reference render slice in `point-light-expo` (Track B) | 00, 01, 02 | 05, 10 | ~5 days |
| **07** | Carry the render slice to `combat-arena`, `traversal-study` and `antiky-town` | 06 | 05, 10 | ~10 days |
| **08** | Art direction and VFX per demo, `antiky-town` included | 05, 07 | 10 | ~16 days |
| **09** | Remove scar tissue and within-demo divergence | 06, 07 | 10, 11 | ~5 days |
| **10** | Fix how the work is presented (Track F) | 01 | everything | ~3 days |
| **11** | Promote what has earned it into the framework | 03, 06, 07 | 09, 10 | ~4 days |
| **12** | Extract the `BroMetalRenderDriver` | 06, 07, 11 | 10 | ~5 days |

**Critical path:** `00 → 01 → 02 → 06 → 07 → 11 → 12`.
**Start today, in parallel:** 00, 01, 02, 10. Then 03, 04, 05 once 01 lands.

Goal **05** is the largest single visual win and needs neither the HDR buffer nor the BroMetal
patches — do not let it sit behind the render work.

## Why this order

**00 first** because the architecture record currently contradicts itself, and goals 06–07 build
exactly the thing the record is ambiguous about. Cheap to settle, awkward to retrofit.

**01 second because nothing else can be verified without it.** Every later goal's acceptance
criteria are measurements, and today nothing measures pixels. This is also the fix for the root
cause of the entire audit: the previous work was done blind. Goal 01's first packet is not building
a harness — the repo already ships one, and it is **broken for the demos that matter**.

**02 before 06** because rendering to an HDR target silently destroys the 4× MSAA the demos have
today. Doing 06 first would be a visible regression.

**06 before 07** because `point-light-expo` is the reference implementation. Prove the approach on
the demo whose entire premise is lighting, then carry it.

**12 last** because the driver is extracted from two working implementations, never designed from
zero. Designing from one implementation is the failure the decision in
`../09-RENDER-DRIVER-DECISION.md` exists to avoid.

---

## Coverage matrix — every audit finding maps to a goal

If a finding is not in this table, it is not being fixed, and that is a gap to raise.

| Finding | Source | Goal |
|---|---|---|
| No demo ever renders to an offscreen target | `00-VISUAL-DIAGNOSIS.md` | 06, 07 |
| `tonemapACES` called per-material instead of once per frame | `00`, `01-antiky-render-audit` | 06, 07 |
| No sRGB/linear colour management anywhere | `00`, `03-asset-pipeline-audit` | 04, 06, 07 |
| No shadows, no AO, no post of any kind | `00` | 06, 07 |
| Stub BRDF — no Fresnel, no geometry term | `01-antiky-render-audit` | 06, 07 |
| Fake contact shadows get *brighter* near a light | `01-antiky-render-audit` | 03 |
| MSAA silently lost on any offscreen pass | `02-brometal-capability-audit` | 02 |
| Render targets sample nearest, crippling bloom | `02-brometal-capability-audit` | 02 |
| `normalize-quaternius.mjs` destroys every UV → 1×1 textures | `03-asset-pipeline-audit` | 04 |
| `gltf-pack-lib.mjs:89` deletes committed normal maps | `03-asset-pipeline-audit` | 04 |
| Palette textures mipmapped and filtered into mud | `01-antiky-render-audit` | 03 |
| Assets carry no PBR materials at all (triplanar fix) | `03-ART-DIRECTION-AND-VFX.md` | 05 |
| 332 catalogued HDRIs unused | `03-asset-pipeline-audit` | 05 |
| VFX read as flat decals; all on one metronome | `03-ART-DIRECTION-AND-VFX.md` | 08 |
| Camera shake too strong, periodic, swivels the frame | owner report + `02-REMEDIATION-PLAN.md` | 03 |
| No render interpolation → judder at 120/144 Hz | `01-antiky-render-audit` | 03 |
| Camera `near` wastes depth precision (2400:1) | `01-antiky-render-audit` | 03 |
| Three shaders disagree on sun direction and fog | `01-antiky-render-audit` | 03 |
| `cull: 'none'` renders every back face | `00` | 03 |
| 13 scar-tissue correction knobs | `04-COMPLEXITY-REDUCTION.md` | 09 |
| Three divergent "ground height" functions (real bug) | `04-COMPLEXITY-REDUCTION.md` | 09 |
| Dead code, provable no-ops, uniform bloat | `04-COMPLEXITY-REDUCTION.md` | 03 (safe subset), 09 (rest) |
| Composition, framing, dead space, prop scale | `00`, `03-ART-DIRECTION-AND-VFX.md` | 08 |
| No sky, no aerial perspective, floating ground quad | `00` | 07, 08 |
| WebGPU-only demos read as "only non-Antiky works" | `04-baseline-demos-and-presentation` | 10 |
| `town-study` under-promoted despite being the best work | `04-baseline-demos-and-presentation` | 10 |
| Blank white committed captures cited as evidence | `04-baseline-demos-and-presentation` | 10 |
| Glass Garden cannot reproduce its own poster | `04-baseline-demos-and-presentation` | 10 |
| Orbital Atlas per-frame `setSize` perf bug | `04-baseline-demos-and-presentation` | 10 |
| Reef plankton squares, Shader Study crater squares | `04-baseline-demos-and-presentation` | 10 |
| Mobile thumbnails hover-only; posters cropped | `04-baseline-demos-and-presentation` | 10 |
| No seed anywhere (**ADR 0013 compliance gap**) | `05`, `08-ADR-IMPACT.md` | 11 (recorded in 00) |
| Disposal scope reimplemented 7× | `05-FRAMEWORK-EASY-WINS.md` | 11 |
| Input buffer 3×, with an unpropagated bug fix | `05-FRAMEWORK-EASY-WINS.md` | 11 |
| Event recorder 3× byte-identical | `05-FRAMEWORK-EASY-WINS.md` | 11 |
| `advance()` result codes silently dropped everywhere | `05-FRAMEWORK-EASY-WINS.md` | 11 |
| 1,286 duplicated broadphase lines, no agreement test | `05-FRAMEWORK-EASY-WINS.md` | 11 |
| ADR 0006 vs studio/0007 contradiction | `08-ADR-IMPACT.md` | 00 |
| Seven ADRs load-bearing on a nonexistent `RenderDriver` | `08-ADR-IMPACT.md` | 00, 12 |
| `PRODUCT.md` ships a Direction claim as Current | `08-ADR-IMPACT.md` | 00 |
| `capture_frame` times out on every asset-heavy demo | `07-TESTING-WITH-ANTIKY-MCP.md` | 01 |
| `npm test` red on `main` | `07-TESTING-WITH-ANTIKY-MCP.md` | 01 |
| `combat-arena`/`traversal-study` missing from `dev.mjs` | `07-TESTING-WITH-ANTIKY-MCP.md` | 01 |
| Agents work blind despite shipped capture tooling | `00`, skill research | 01 + skill library |
| `antiky-town` grass: one tuft stamped at uniform scatter, no variation | owner report + capture | 08 |
| `antiky-town` trees: too few, inconsistent species, no translucency or rim light | owner report + capture | 08 |
| `antiky-town` water: flat opaque, no flow/foam/reflection; fountains are solid geometry | owner report + capture | 08 |
| `antiky-town` shadows are hard-edged with no penumbra | capture | 07 |
| `antiky-town` DOF and vignette implemented but tuned to invisibility | owner request + capture | 08 |
| `antiky-town` never audited (~12,500 LOC) | scope change 2026-08-10 | 09 (inventory first) |

## Deliberately not in these goals

- **The skill library.** Tracked separately in `../../scratch/skill-research/IMPLEMENTATION-PLAN.md`,
  which has its own phased plan. It is a parallel track, not a dependency. Goal 01 delivers the
  capture loop its highest-priority skill depends on.
- *(Withdrawn 2026-08-10: `antiky-town` was excluded here by owner instruction. That instruction is
  withdrawn — it is fully in scope. Goal 09 sweeps it, goal 11 may de-duplicate its broadphase, and
  goal 12 requires it as the 2.3D evidence for the driver.)*
- **New asset purchases** (KayKit, Synty). No evidence they are needed until goal 05 completes.
- **Deferred rendering, SSAO, TAA, DOF.** These scenes are small and forward rendering is correct.
- **A shared render package between demos.** Ruled out — capabilities stay in demos until the
  `BroMetalRenderDriver` (goal 12) is ready to own them.

## Open risks the owner should decide on

1. ~~**2.3D evidence.**~~ **Closed 2026-08-10.** `antiky-town` is in scope, and goal 12 now requires
   it as the 2.3D evidence for the driver alongside a 3D demo. The driver is not complete until it
   serves both. Note the consequence: goals 09, 11 and 12 each gained a fourth Antiky demo — the
   largest one, at ~12,500 lines of `src/` — that **no audit in `../` ever read**. Their sizes in
   the table above are pre-scope-change estimates and are now low.
2. **Five open questions** in `04-COMPLEXITY-REDUCTION.md` need answers before parts of goal 09
   proceed. They were left unanswered rather than guessed.
3. **Goal 05 is the largest single goal (~12 days).** If it needs splitting, split by demo, not by
   technique — the technique is shared and the demos are not.
4. **Effort totals roughly 8–10 engineer-weeks** across all thirteen goals. Goals 00, 01, 02, 03
   and 05 carry most of the visible return; 08 through 12 are the durable ones.

## The rule that matters most

Every goal ends with a capture that someone **actually looks at**, plus a committed
`visual-metrics.json` sidecar. A visual change that has not been captured and viewed is not done.
The absence of that single discipline produced every finding in this audit.

If a goal's acceptance criteria cannot be met, the executing agent reports that plainly and leaves
the goal active. It does not loosen the criteria. Budgets are changed by the owner.
