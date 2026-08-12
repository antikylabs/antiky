# Demo Refining — Goal Sequence

**Date:** 2026-08-10
**Purpose:** this is the **contract**. The audit in `../` says what is wrong; these thirteen goals
say what will actually get built. Review this file and the goal files before any code is written.

Run them with `/goal` in order. Where goals are parallel-safe, this document says so explicitly.

## When a goal completes

1. Move its file into [`_completed/`](_completed/) with `git mv`, keeping the same filename.
2. Write `_completed/summary-goal-<num>.md` beside it. The summary states what changed, the commit,
   the evidence that each acceptance criterion was met, any owner decisions taken during the goal,
   and — most importantly — **what is still outstanding**. A summary that only lists successes is
   not a record, it is a press release.

   **Every summary must carry an `## Action needed from the owner` section, and it comes first,
   directly under the headline.** The owner should never have to read a summary to work out what is
   on their plate. The rules:

   - If nothing needs them, the section says exactly **"None."** Say it explicitly rather than
     omitting the section, so its absence is never ambiguous.
   - Each item states **what** is being asked, **why it cannot be decided by an agent**, and
     whether it **blocks** a later goal or is merely open.
   - **Every bug reported anywhere in the summary must say whether it was fixed.** A bug the agent
     already fixed is not an action item and must not read like one. If it was not fixed, it goes
     in this section with the reason.
   - Everything in `Outstanding` must be classified as either *handled by goal N* or *needs the
     owner*. Nothing may be left unassigned.
3. Repoint any links to the moved file. Later goals reference earlier ones in their Prerequisites,
   so a move breaks links: `grep -rn "execute-goal-<num>"` and fix every hit.
4. Mark the row Done in the sequence table below.
5. **If the goal deferred anything, add a row to [`execute-goal-99.md`](execute-goal-99.md)** with
   its trigger. A row costs a line; a forgotten deferral costs a rewrite. Goal 99 runs last and is
   numbered 99 so new goals can be 14, 15, … without ever renumbering the one that must stay at
   the end.

`_completed/` mirrors the convention already used at `docs/objectives/antiky-town/_completed/`.

---

## The sequence

| # | Goal | Status | Depends on | Parallel-safe with | Rough size |
|---|------|--------|-----------|--------------------|-----------|
| **00** | [Settle the architecture record and the public claims](_completed/execute-goal-00.md) | **Done** `288cd76` — [summary](_completed/summary-goal-00.md) | — | 01, 02, 10 | ~half a day |
| **01** | [Build the verification loop (Track 0)](_completed/execute-goal-01.md) | **Done** `e1ebf4e` — [summary](_completed/summary-goal-01.md) | — | 00, 02 | ~2 days |
| **02** | [Unblock the render pipeline in BroMetal (Track A)](_completed/execute-goal-02.md) | **Done** `57166ea` — [summary](_completed/summary-goal-02.md) | — | 00, 01, 04, 05, 10 | ~1 day |
| **03** | [Quick wins, motion feel, safe dead-code removal (Track D)](_completed/execute-goal-03.md) | **Done** `4b6ecaa` — [summary](_completed/summary-goal-03.md) | 01 | 04, 05, 10 | ~2 days |
| **04** | [Stop the asset pipeline destroying the assets (Track C)](_completed/execute-goal-04.md) | **Done** `bf56f6c` — [summary](_completed/summary-goal-04.md) | 01 | 02, 03, 05, 10 | ~3 days |
| **05** | Give the existing assets real materials — triplanar PBR | Not started | 01, 04 | 02, 03, 06, 07, 10 | ~14 days |
| **06** | The reference render slice in `point-light-expo` (Track B) | Not started | 00, 01, 02 | 05, 10 | ~5 days |
| **07** | Carry the render slice to `combat-arena`, `traversal-study` and `antiky-town` | Not started | 06 | 05, 10 | ~10 days |
| **08** | Art direction and VFX per demo, `antiky-town` included | Not started | 05, 07 | 10 | ~16 days |
| **09** | Remove scar tissue and within-demo divergence | Not started | 06, 07 | 10, 11 | ~5 days |
| **10** | [Fix how the work is presented](_completed/execute-goal-10.md) | **Done** `079c325` — [summary](_completed/summary-goal-10.md) | 01 | everything | ~3 days |
| **11** | Promote what has earned it into the framework | Not started | 03, 06, 07 | 09, 10 | ~4 days |
| **12** | Extract the `BroMetalRenderDriver` | Not started | 06, 07, 11 | 10 | ~5 days |
| **13** | [Measure motion, so feel can be judged instead of guessed](_completed/execute-goal-13.md) | **Done** `d241cf6` — [summary](_completed/summary-goal-13.md) | 01 | everything | ~4 days |
| **14** | [Give Antiky a way to build and check texture atlases](execute-goal-14.md) | Not started | 04 | everything except 15 | — |
| **15** | [Give BroMetal the texture capabilities WebGPU already has](execute-goal-15.md) | Not started | 14 | everything except 14 | — |
| **99** | [The revisit register — check what we deliberately deferred](execute-goal-99.md) | Not started | all | — | ~1 day |

**Critical path:** `00 → 01 → 02 → 06 → 07 → 11 → 12`.
**Next up, in parallel:** 03, 04, 10 (00, 01, 02 and 13 are done). Then 05, then 06.

**Goal 03 now has an instrument.** Goal 13 landed `scripts/motion-stats.mjs` and a camera-shake
regression that fails against the current code with three named defects. Goal 03's job is to turn
it green.

Goal **05** is the largest single visual win and needs neither the HDR buffer nor the BroMetal
patches — do not let it sit behind the render work.

## Why this order

**00 first** because the architecture record contradicted itself, and goals 06–07 build exactly
the thing it was ambiguous about. Cheap to settle, awkward to retrofit. **Done** — ADR 0021 now
supersedes 0006 and `studio/0007` is clarified.

**01 second because nothing else can be verified without it.** Every later goal's acceptance
criteria are measurements, and nothing measured pixels. This was also the fix for the root cause of
the entire audit: the previous work was done blind. **Done** — `npm run demos:shoot` captures every
demo through the existing MCP and `npm run demos:verify` tracks the targets. The first measurement
put `point-light-expo` and `combat-arena` at the bottom of all ten demos for luminance spread.

**02 before 06** because rendering to an HDR target silently destroyed the 4× MSAA the demos have
today. Doing 06 first would have been a visible regression. **Done** — render targets now take a
per-target `filter` and `samples`, and BroMetal is on 0.17.2.

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
| Motion, feel and judder have no measurement path at all | `11-MOTION-INSPECTION-RESEARCH.md` | 13 |
| `get_render_stats` carries zero motion information | `11-MOTION-INSPECTION-RESEARCH.md` | 13 |
| Sequence capture stamps only start and end, so no frame ties to a simulation instant | `11-MOTION-INSPECTION-RESEARCH.md` | 13 |
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
