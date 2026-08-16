# Implementation plan — a skill library that helps agents build better games

Plan date: 2026-08-10. Supersedes nothing; extends the 2026-08-09 research snapshot with evidence
that did not exist when it was written.

**Read with:**
[`recommended-library.md`](../../skill-research/recommended-library.md) (the synthesis this plan reconciles against) ·
[`failure-mode-taxonomy.md`](failure-mode-taxonomy.md) (the evidence, classified) ·
[`skill-specs.md`](skill-specs.md) (full spec per proposed skill) ·
[`goals/execute-goal-01.md`](../../skill-research/goals/execute-goal-01.md) (the evaluation foundation this builds on)

**Status: proposal.** This document lives in `scratch/` and changes nothing. Where it recommends
revising the committed research in `docs/objectives/skill-research/` — re-aiming goal 01's task
clusters, deferring goals 02 and 03, replacing the three scaffolds — those are recommendations
awaiting a decision, not edits that have been made. Nothing in the committed research folder,
`packages/`, or `scripts/` was modified to produce this plan.

---

## 1. What changed

The research in this directory reasoned carefully about what agents *might* get wrong building
games with Antiky. Since then we acquired something much better: a record of what one actually did
get wrong.

A highly capable coding agent was tasked with building AAA-quality game demos in this repository.
It produced `point-light-expo`, `combat-arena`, and `traversal-study`. The owner judged the work
poor, and a four-agent audit documented, with `file:line` citations, exactly how and why it failed
(see [`../demo-refining/`](../demo-refining/)).

That audit is a natural experiment, and it is the most valuable input this library could have. It
replaces speculation about failure modes with an inventory of them.

Three findings from it reorganise everything below.

**The agent could program.** Simulation, input, collision, encounters, state machines — all sound,
all tested. `02-REMEDIATION-PLAN.md` says so explicitly: *"Don't rewrite the demos' game logic. The
simulation, input and encounter code is not the problem, and it has tests."* It failed at rendering
architecture, colour management, asset handling, art direction, and self-verification.

**The agent was working blind.** *"No shader in this repo shows evidence of having been looked at
after it was written."* Every defect in the audit is visible in a single still frame. Not one
required a profiler, a debugger, or a GPU capture. The repository ships a complete capture and
inspection toolchain — `capture_frame`, `capture_gameplay_sequence`, a pinned network-locked
managed Chromium, an evidence store with a full provenance manifest — and none of it was used.

**The agent was honest.** The READMEs contain no overclaiming; the render audit checked and found
none. This was not a dishonest agent inflating results. It was an accurate agent with no feedback
loop. That distinction determines the fix: not more truthfulness instructions, but a **mandatory
observation step producing a machine-checkable artifact**.

---

## 2. The bar, restated against evidence

[`recommended-library.md`](../../skill-research/recommended-library.md) already sets the bar for what earns a skill.
That bar is right and this plan applies it without relaxation. The evidence lets us apply it
*sharply*, because we can now ask a concrete question of every proposal:

> **If the previous agent had followed this skill faithfully, which documented defect would it have
> avoided?**

A proposal that cannot name one does not get built. By that test, **all three existing scaffolds
fail** — see §4.1.

The evidence also sharpens *what kind* of knowledge is worth writing down. The failed agent's
general graphics knowledge was fine. It knew what a BRDF is. What it did not and could not know is
that BroMetal 0.15 ships a helper named `specGGX` that looks like a GGX BRDF and is only the
distribution term with a `0.25` fudge where the denominator belongs; that `drawTo` hard-codes
`passSamples = 1` so rendering to an HDR target silently destroys all anti-aliasing; that render
targets sample `nearest` so a standard bloom chain produces blocky crawling glow. Those facts are
not inferable, not in any model's training data, and not in any public document.

**The library's value is concentrated almost entirely in project-pinned facts and enforced
process.** Every page of general game-development prose we write is a page that makes the real
content harder to find.

### The intervention rule

Each failure class gets exactly one primary owner:

| Intervention | Owns failures that... | Because |
| --- | --- | --- |
| **Skill** | require a non-obvious project fact *at authoring time* | changes what the agent does before it acts |
| **Lint / test** | are detectable by inspecting the artifact afterwards | never forgets, never gets bored, survives model changes |
| **Gate / review** | require judgement about a player-facing outcome | nothing substitutes for looking and deciding |
| **Nothing** | a capable model already avoids | a skill restating general knowledge is worse than no skill |

When a lint can catch it, **the lint is primary** and the skill only explains why the lint exists.
That is far cheaper than teaching a rule in prose and hoping.

---

## 3. Failure taxonomy → intervention map

Full evidence and citations in [`failure-mode-taxonomy.md`](failure-mode-taxonomy.md). Summary:

| Class | Representative defect | Primary | Artifact |
| --- | --- | --- | --- |
| **F1** Pipeline architecture omission | No demo ever calls `createRenderTarget`; `tonemapACES` per material | Skill | `build-antiky-frame` + guard G3 |
| **F2** Colour / transfer function | No sRGB decode or encode; then `uDiffuseLift`/`uTextureContrast` to fight the symptom | Skill | `build-antiky-frame` colour reference + G3 |
| **F3** Stubbed physical model | `specGGX` is D-term only; ship shader has zero specular; 1.81:1 toon ramp | Lint | G3 + BroMetal pins reference |
| **F4** Destructive asset processing | `delete material.normalTexture`; `TEXCOORD_0` overwritten with a palette lookup → 1×1 textures | Skill | `intake-antiky-assets` + gate G5 |
| **F5** Uncorroborated divergence | Three shaders in one demo, three sun directions, three fog ranges | Lint | G4 |
| **F6** Motion / feel signal shape | Beating sine pair on a metronome; shake offsets position but not target | Test | G7 |
| **F7** Absent art direction | 60% dead sky; ground quad in a void; shadows that glow near lights | Artifact + gate | `direct-antiky-look`, `review-antiky-visual-quality` |
| **F8** **Working blind** | Nothing was ever looked at | **Skill + gate** | **`verify-antiky-frame`, G1, G2** |
| **F9** Evidence hygiene | Three committed blank-white PNGs cited as evidence; poster the runtime cannot reproduce | Lint | G1, G6 |
| **F10** Delivery context | 8/10 demos error on Safari/Firefox | Product work | out of scope |

Note the distribution. **Four of ten classes are best solved by a check, not a skill.** Being
honest about that is what keeps the library small enough to be read.

---

## 4. The library

### 4.1 Reconciliation with `recommended-library.md`

`recommended-library.md` proposed fifteen candidate skills across four groups and was explicit that
they were "candidate boundaries to validate through task discovery," not a pre-approved list. The
evidence is that task discovery.

**Survives, strengthened:**

| Candidate | Verdict |
| --- | --- |
| `build-brometal-rendering` | Strongly validated but **re-aimed**. Its job is not "write shaders" — the failed agent wrote plenty of syntactically fine shaders. Its job is *frame structure under BroMetal 0.15's specific constraints*. Becomes `build-antiky-frame`. |
| `produce-antiky-assets` | Strongly validated — the worst single defect in the repo lives here. **Re-aimed** from sourcing to fidelity preservation. Becomes `intake-antiky-assets`. |
| `direct-antiky-game-art` | Validated by F7, but must emit a **declared, checkable visual target artifact**, not an essay. Becomes `direct-antiky-look`. |
| `review-antiky-game-quality` | Validated. The audit itself is an existence proof that this role works and finds real defects. |
| `test-antiky-games` | Validated but **re-aimed at visual evidence**. State/event testing was never the gap; the demos' behavioural tests were fine. Absorbed into `verify-antiky-frame`. |

**Needs revision:**

| Candidate | Revision |
| --- | --- |
| `polish-antiky-presentation` | Too broad; overlaps art direction, VFX, lighting, and camera. Dissolve: lighting/VFX into `build-antiky-frame`, camera/motion into a deferred `tune-antiky-game-feel`, composition into `direct-antiky-look`. |
| `operate-antiky-development` | `recommended-library.md` suspected this collapses into a shared reference. The evidence *promotes* it — but not as "how to operate the CLI." The tooling didn't go unused because operating it is undocumented; it went unused because **nothing required it**. Becomes `verify-antiky-frame`, a skill about the mandatory loop. |

**Now clearly wrong as a starting point:**

| Candidate | Why |
| --- | --- |
| `build-antiky-gameplay` | **This is the most important correction in the plan.** [`goals/execute-goal-03.md`](../../skill-research/goals/execute-goal-03.md) targets gameplay implementation as the second candidate skill. The audit is unambiguous that gameplay implementation is the one area where the baseline agent already succeeded, with tests. Building it first spends the first evaluation budget proving a skill helps at a task that does not need help. Defer. |
| `plan-antiky-game-slice` | [`goals/execute-goal-02.md`](../../skill-research/goals/execute-goal-02.md)'s target. Evidence-neutral — the demos have coherent slices and legible loops. Not the bottleneck. Defer, and note that the piece of it that *is* needed (a declared player-facing target) is delivered faster and more cheaply by `direct-antiky-look`. |
| `author-antiky-worlds` | `antiky-town` is off limits. No evidence. Defer. |
| `build-antiky-ui`, `integrate-antiky-brometal`, `profile-antiky-games`, `ship-antiky-games` | No evidence yet. Defer until concrete work demands them. `recommended-library.md` already says to add these "only when concrete release work requires them"; hold that line. |

Deferring goals 02 and 03 does **not** waste them. Their *machinery* — matched fresh-context
baselines, withheld rubrics, trigger-collision suites, catalog lifecycle — is exactly right and is
reused verbatim in §7. Only the task cluster changes.

### 4.2 The scaffolds

| Scaffold | Defect classes it would have prevented | Disposition |
| --- | --- | --- |
| `build-antiky-games` | None. Covers project boundaries, build acceptance, stable IDs, running tests — all reasonable, all general. Its one nod to observation says to prefer MCP state *over* screenshots, which points away from F8. | **Replace** |
| `write-brometal-shaders` | None. "Inspect the installed version", "reuse long-lived GPU resources", "define typed shader inputs explicitly." Silent on tone-map placement, colour management, the `specGGX` trap, MSAA loss on `drawTo`, nearest target sampling, the 8-attribute cap. | **Replace** |
| `source-game-assets` | None. Aimed almost entirely at licensing and provenance. The asset audit found every asset in every snapshot is CC0-1.0 with modification and redistribution permitted — licensing is uniformly clean and **not a constraint here**. Silent on fidelity preservation, where the worst defect in the repo lives. | **Replace** |

**All three scaffolds, applied faithfully, would have prevented none of the observed defects.**

This substantially shortcuts goal 01's scaffold-audit deliverable — that answer is now available
for free. It does not make goal 01 redundant: the catalog, schemas, validator, and matched-baseline
machinery are still needed, and this evidence is not a controlled run.

### 4.3 The first skills, in priority order

Full specifications — job, triggers, inputs, outputs, stop condition, project-specific knowledge,
and acceptance criteria — in [`skill-specs.md`](skill-specs.md). Summary:

| # | Skill | Recurring job | Owns | Blocked by |
| --- | --- | --- | --- | --- |
| **S1** | **`verify-antiky-frame`** | After any change that can alter a pixel, capture the canvas, measure it, compare against the declared target, say what you see, iterate | F8, F9 | needs `demos:shoot` (A2) |
| **S2** | `build-antiky-frame` | Give a hand-rolled demo renderer the pass structure that makes lighting, shadow, and post possible — inside that demo, no shared package | F1, F2 | needs S1 to prove its own work |
| **S3** | `intake-antiky-assets` | Bring a catalog asset into a demo without losing data the source already carried | F4 | needs G5 |
| **S4** | `direct-antiky-look` | Write down what a demo is supposed to look like, in terms a capture can be checked against | F7 | — |
| **S5** | `review-antiky-visual-quality` | Independent, read-only, fresh-context visual review with `file:line` defects and a publish call | F7 | needs S1's captures |
| — | `tune-antiky-game-feel` | *Deferred.* Most of the content is general craft; the repo-specific part (no interpolation alpha; correct easing already exists one file away) is better delivered as test G7 now | F6 | — |

**Deliberately not skills**, and the plan should say so out loud:

- *"How to write a shader" / "PBR explained" / "principles of composition."* A capable model has
  this. Writing it down dilutes the pinned facts that matter.
- *A colour-management skill.* It has no independent trigger — colour work is always part of
  building a frame or writing a material. It is a **reference inside S2**, not a skill.
- *An asset-licensing skill.* Real concern in general; a non-constraint in this repo.
- *A `make-a-game` router.* Named as an anti-pattern in `orchestration-and-library-design.md`; the
  evidence gives no reason to revisit it.
- *A BroMetal-patching skill.* `scripts/patch-brometal.mjs` already encodes the pattern with a hard
  version guard. One paragraph in S2's reference, not a package.

---

## 5. The self-verification loop — highest priority

This is the whole plan's centre of gravity. Everything else is downstream.

### 5.1 Why the tooling went unused

The obvious explanation — the agent didn't know the tools existed — is wrong, and getting this
right determines the design. Two better explanations, both supported:

**The capture tool is genuinely hard to call.** `capture_frame` requires a fully-fenced input with
`additionalProperties: false`: `schemaVersion`, an `expected` block carrying
`developmentSessionId` + `acceptedBuildRevision` + `currentRuntimeInstanceId`, a `runtimePolicy`,
exact `target` dimensions, `warmUpFrames`, and an `idempotencyKey` — all required
(`packages/cli/src/mcp/tools.ts:131-158`). The session id must first be read from
`.antiky/dev-session.json`; the build revision from `get_latest_build`; the runtime id from
`get_runtime_status`. Target dimensions must match the manifest viewport exactly or the service
rejects with `CAPTURE_DIMENSIONS_MISMATCH` (`packages/cli/src/host/capture-service.ts:63-76`).

That is a five-call ceremony to get one PNG. It is exactly the "fragile operation needing
deterministic behavior" that `recommended-library.md` says belongs **in a tested script, not in
prose**. Pull the complexity downward.

**Nothing required it.** No test failed, no gate blocked, no instruction insisted. The one place
captures *were* produced — the Three.js demos — shipped three blank-white PNGs into a directory
named `captures`, and `PRODUCT.md` cites those studies as current evidence. Producing a capture is
not looking at it.

So the loop needs all three of: a **one-line interface**, a **check that fails**, and a **required
statement of what was seen**.

### 5.2 What the repo already gives us

This is much better than greenfield. `packages/cli/src/host/managed-capture-runtime.ts` is a
603-line harness that already satisfies the privacy and reproducibility constraints the research
demanded:

- headless Chromium, version-pinned and refusing to run on mismatch
  (`CAPTURE_BROWSER_VERSION_MISMATCH`), with `--enable-unsafe-webgpu` and `--use-angle=metal`;
- a fresh `mkdtemp` profile at `0700`, deleted on release — never a personal profile;
- `context.route('**/*')` aborting anything not on the two loopback origins;
- capture scoped to `document.querySelector('#antiky-game')` — **canvas only, never window, never
  desktop**, and it refuses to launch when a person-controlled runtime is connected
  (`CAPTURE_RUNTIME_BUSY`);
- input dispatched to the canvas element, never OS-level;
- an evidence store recording sha256, dimensions, byte length, full observation fence, and an
  explicit `privacy { gameCanvasOnly: true, desktopPixelsPossible: false, audio: 'none' }` block.

The privacy work `recommended-library.md` asks for is **already done**. Do not rebuild it.

### 5.3 What determinism is actually available — be precise

Honesty here matters, because the research repeatedly assumes "deterministic replay" and the
current surface does not provide it.

| Capability | Status | Evidence |
| --- | --- | --- |
| Fixed-step simulation | **Yes**, `1/60` | `packages/framework/src/sessions/engine-session/contract.ts:4` |
| Pause / resume | **Yes**, reason-scoped and idempotent | `pause_simulation`, `resume_simulation` |
| Step to an exact tick | **Yes**, `step_simulation { expectedCompletedStepCount }`, rejects stale with `STALE_COMPLETED_STEP` | `packages/cli/src/mcp/tools.ts:89-96` |
| Capture fenced to a state | **Yes** — `sessionId` + `completedStepCount` + `stateDigest` | `packages/cli/src/host/capture-action.ts:60-79` |
| **Seeded RNG** | **No. There is no seed anywhere in the framework.** | grep `seed` in `packages/framework/src` → nothing |
| **Deterministic sequence replay** | **No**, and the tool says so: the presentation trace is written `deterministic: false` | `capture-sequence-service.ts:371`; `tools.ts:383` |

**Therefore the verification loop is built on pause → step-to-N → capture, not on sequence
replay.** A still frame at a fenced step count is reproducible today; a gameplay video is not. Do
not write a skill that promises otherwise, and do not build guards that assume frame-exact motion.

Sequence capture remains valuable as *evidence for human and reviewer judgement* — motion is where
game feel lives — but it is not an assertion substrate. Keep that boundary explicit.

### 5.4 The loop

```
declare        direct-antiky-look writes visual-target.json for the demo
               (value band, palette, what must read first, negative list, reference images)
     |
change         agent edits a shader / renderer / asset script / camera / presentation file
     |
capture        npm run demos:shoot -- <slug>
               → dev session, pause, step to the demo's declared checkpoint tick,
                 capture 1280x720 canvas-only, write PNG + metrics sidecar
     |
measure        guards G1 (degenerate) and G2 (value band) run against the sidecar
     |
look           the agent states, in words, what it sees — and whether that matches the target
     |
iterate        if it does not match: change and repeat, or file a defect with the capture attached
     |
stop           metrics pass, statement recorded, or a blocked defect is filed
```

The **"look" step is the one part prose must own.** A guard can assert the histogram is not flat;
it cannot notice that the HUD is a pile of coloured boxes floating in the sky, that the props read
as a debris pile, or that the shadow gets brighter near the light. Those need a sentence written by
something that looked. S1's stop condition is not "a capture exists" — it is "a capture exists and
the agent described it against the declared target."

### 5.5 `npm run demos:shoot`

A tested script at `scripts/shoot-demos.mjs`, invoked as `npm run demos:shoot [-- <slug>]`.

Responsibilities:

1. Resolve slug → manifest. **Fix the existing gap**: `scripts/dev.mjs:11-19` omits `combat-arena`
   and `traversal-study` from `demoProjects`, so `npm run dev:demos -- combat-arena` exits 1 with
   `Unknown demo`. Both demos exist, have manifests, and are in the `dev-host.test.mjs` showcase
   matrix. Share one slug table between `dev.mjs` and `shoot-demos.mjs`.
2. Start `antiky dev`, wait for the session descriptor, read `developmentSessionId`.
3. Chain `get_latest_build` → `get_runtime_status` → `pause_simulation` → `step_simulation` to the
   demo's declared checkpoint tick → `capture_frame` with the fence assembled from those reads.
4. Target **exactly 1280×720 at DPR 1** — every demo manifest declares that viewport and
   `validateTarget` rejects anything else.
5. Run demos **sequentially**. Every manifest uses ports 3010/3011; two at once yields
   `ANTIKY_PORT_BUSY`. Call `npm run portRelease` on a stale session.
6. Decode the PNG and write a metrics sidecar (§5.6).
7. Emit a dated contact sheet for human review.

Deliberately *not* responsibilities: judging the image, editing anything, uploading anything.

### 5.6 Where the bytes go — a real constraint the plan must respect

Two facts change the obvious design:

- **`.antiky/` is globally gitignored** (`.gitignore:26`, `**/.antiky/`), and the evidence store
  `rm -rf`s its whole directory on session stop (`evidence-store.ts:247-253`). Captures are
  ephemeral and uncommittable where they land.
- **`*.png` is Git LFS-tracked** and `repository-policy.test.mjs` runs `git lfs fsck --pointers`.
  Committing a contact sheet per run would grow LFS without bound.

So:

| Artifact | Where | Committed |
| --- | --- | --- |
| Capture PNG | copied out of `.antiky/evidence/` to `docs/objectives/demo-refining/evidence-captures/<slug>.png`, **overwritten** each run | Yes, one per demo, bounded |
| Metrics sidecar | `packages/demos/<category>/<slug>/visual-metrics.json` | **Yes** — small, plain text, diffable, no LFS |
| Contact sheet | scratch directory | No |
| Sequence video | `.antiky/evidence/`, ephemeral | No |

**The metrics sidecar is the assertable artifact, not the image.** That is the key design decision:
a JSON file of `{ meanLuminance, p05, p95, uniqueValueCount, distinctColorCount, captureBounds,
buildRevision, completedStepCount, sha256 }` is small, reviewable in a diff, and gives a guard
something to assert on without committing a binary per run. A reviewer who wants pixels opens the
one committed PNG or re-shoots.

### 5.7 The automated guards

Nothing in this repository can currently look at a pixel. The only PNG handling is header parsing
(`readPngDimensions`, `capture-action.ts:106-122`). `sharp@0.35.3` is **already a root dependency**
(a Next.js image dep) and decodes PNG to raw buffers — use it. No installation required.

| # | Guard | Asserts | Catches | Home | Needs GPU |
| --- | --- | --- | --- | --- | --- |
| **G1** | Degenerate capture | `uniqueValueCount` above a floor; mean not >0.98 or <0.02 | the three blank-white committed PNGs; Glass Garden's black void and blown-out poster | `packages/demos/tests/visual-metrics.test.mjs` | reads sidecar only |
| **G2** | Value-band assertion | mean, p05, p95 inside the range declared in that demo's `visual-target.json` | *"everything is the same middle grey"* — `combat-arena`'s entire frame in a 15–35% band | same | reads sidecar only |
| **G3** | Pipeline invariant | no material shader calls `tonemapACES`; exactly one tonemap site per demo (its post shader); albedo sampled through the sRGB decode helper; `specGGX` not used bare | F1.2, F1.3, F2.1, F3.1 | `packages/demos/tests/` | no |
| **G4** | Intra-demo coherence | all shaders in one demo agree on sun direction, fog range, fog colour, exposure; declared exceptions carry a reason | F5.1–F5.3 — three suns, three fog ranges in `combat-arena` | `packages/demos/tests/` | no |
| **G5** | Asset fidelity | per shipped GLB: attributes preserved against a source manifest; texture dimensions above a floor unless declared `palette-strip`; unique-UV count above a floor; no asset script contains `delete material.*Texture` or synthesises UVs without a declared exception | F4.1, F4.2, F4.4, F4.5 | `packages/demos/tests/` | no |
| **G6** | Poster / runtime agreement | committed poster metrics within tolerance of a fresh capture's metrics | Glass Garden cannot reproduce its own poster | `packages/demos/tests/` | sidecar only |
| **G7** | Presentation feel | sustained cannon-cadence input produces bounded, **non-periodic** camera offset; position and target shake together | F6.1, F6.2, F6.4 | extends `combat-arena/tests/presentation.test.ts:62` | no |

Six of seven need no GPU and run in the existing `npm test`. Only the *production* of the sidecar
needs WebGPU, and that runs on demand via `demos:shoot`.

**Build on what exists.** `traversal-study/tests/visual-contract.test.ts` already projects authored
bounding boxes through the real camera matrix and asserts NDC coverage — HUD backing ≤22% of canvas
width, cliff projected height ≤0.28, horizon gap ≤0.12. That is a proto-version of exactly this
idea and it is good work. G1/G2 extend it from geometry to pixels; they do not replace it.
`point-light-expo/tests/presentation.test.ts` similarly defines local `luminance()`/`contrast()`
helpers over authored palette constants. Reuse both patterns and their vocabulary.

### 5.8 Two honest caveats about the guards

**On the tension with `AGENTS.md`.** The repo rule is *"Do not create worthless test files that
test content/prose/frozen words."* G3, G4, and G5 read source files and assert on their contents,
which is superficially that shape. The distinction, which must be written into the tests
themselves:

> A source assertion is legitimate when it encodes a **pipeline invariant with a documented
> regression** — a specific bug that occurred, at a specific `file:line`, that the assertion
> prevents recurring. It is worthless when it merely restates that a file contains the words its
> author put there.

`G3` cites `reliquary-model.shader.ts:181`. `G4` cites the three disagreeing sun directions. `G5`
cites `normalize-quaternius.mjs:238`. Each is the regression test `AGENTS.md` asks for after a bug.
An assertion that cannot name the bug it prevents does not get written.

Note that several existing tests (`luminous-reef/tests/game.test.ts` greps its own shader for
`jellyGlow`, `kelpBlade`, …) are already on the wrong side of this line. Do not extend that pattern.

**On thresholds becoming the new scar tissue.** The `uDiffuseLift` / `uTextureContrast` knobs exist
because someone tuned a number to make a symptom go away. A luminance band tuned until it passes is
the same failure with a different name. Three rules:

1. Bands live in the demo's `visual-target.json`, authored **by `direct-antiky-look` before the
   work**, next to the reference images that justify them — never inline in the test.
2. Widening a band requires a one-line reason in the same commit. A silent widening is a defect.
3. Every guard ships with a documented "what to do when this fires," including the legitimate case.
   A guard that fires constantly gets disabled, and a disabled guard is worse than none.

---

## 6. Repository constraints and traps

Non-obvious facts any implementer — or any skill — must carry. Several will silently fail work that
looks correct.

**`scripts/tests/repository-policy.test.mjs` asserts two exact allowlists.** Lines 24-33 assert the exact
tracked contents of `scripts/` (only `dev.mjs`, `patch-brometal.mjs`, `port-release.mjs`,
`port-release.test.mjs`, `repository-policy.test.mjs`). Lines 35-54 assert the exact sorted list of
root `package.json` script keys. **Adding `scripts/shoot-demos.mjs` and `demos:shoot` fails both
tests unless the allowlists are updated in the same commit.** This is deliberate policy, not an
obstacle to route around.

**`npm test` is currently red on `main`.** `repository-policy.test.mjs:64-75` requires a root
`skills/` directory with at least one valid skill. That directory was added in `e248631` and
deleted in `1062bd4` ("sync") while the test requiring it was left in place. Creating
`skills/verify-antiky-frame/SKILL.md` **repairs the build as a side effect** — a pleasant
alignment, and a reason to land S1 first.

**Skill packaging is strict and there are two surfaces.** The policy regex is
`/^---\nname: ([a-z0-9-]+)\ndescription: .+\n---\n/` with `name` equal to the directory name:
**exactly two fields, in that order, single-line values, no blank lines, no third key.** The
vendored marketing skills in `.agents/skills/` carry a `metadata:` block and would fail this test —
they are a separate, unpoliced, third-party surface pinned by `skills-lock.json`. Do not copy their
frontmatter shape into `skills/`.

**Demos cannot run concurrently.** Every manifest declares `gamePort 3010` / `inspectionPort 3011`
and viewport 1280×720. Parallel capture is impossible; `npm run portRelease` clears a stale session.

**`combat-arena` and `traversal-study` are missing from `scripts/dev.mjs`.** Use the direct form:
`npm run antiky -- dev --project packages/demos/antiky/combat-arena/combat-arena.antiky`.

**Every per-demo `test` script runs `npm run build` first** (`brometal prod` + `vite build`), so
per-demo tests are slow. Put the cheap cross-demo guards in `packages/demos/tests/`, which the root
`npm test` runs directly.

**Managed capture works on this machine today** — Playwright 1.62.1 and Chromium revision 1234
match `capture-capabilities.ts` and are present in the local cache. No install needed.

**The framework is renderer-agnostic and the guards must be too.** The blank-white captures were
Three.js. G1 applies to all ten demos regardless of renderer; `dev-host.test.mjs:78-83` already
asserts the Three.js demos keep `preserveDrawingBuffer: true` *specifically so the host capture
tool can read frames*, which is a nice precedent for capture-awareness as a tested contract.

**Demos hand-roll rendering until the framework's slice process promotes it.** S2 must build inside
one demo and carry the pattern by hand to the others. It must not create a shared render package —
`02-REMEDIATION-PLAN.md` withdrew exactly that recommendation for exactly the right reasons. G4 is
the mitigation that respects the slice process: it makes divergence visible and intentional without
forcing shared code, and it keeps working when demos legitimately drift apart.

**`antiky-town` is off limits.** It is also the only demo with a real post pass
(`town-post.shader.ts`) — useful as a *read-only reference* for S2's pattern, never as a write
target.

---

## 7. Evaluation harness

Build on [`goals/execute-goal-01.md`](../../skill-research/goals/execute-goal-01.md). Reuse its catalog, schemas
(catalog entry / eval case / run / verdict), deterministic validator, lifecycle states
(`quarantine → alpha → beta → stable`), authority vocabulary, and matched-baseline method
unchanged. **Change only the task clusters and the source of the rubric.**

### 7.1 Revised task clusters

Goal 01 defines three clusters: Antiky gameplay work, BroMetal rendering work, asset sourcing.
Against the evidence:

| Cluster | Was | Now | Why |
| --- | --- | --- | --- |
| **C1 Frame construction** | "BroMetal rendering work" | *"the lights don't seem to light anything"* · *"why does this look washed out"* · *"add shadows"* | Where F1–F3 live |
| **C2 Asset intake fidelity** | "asset sourcing" | *"bring this Poly Haven rock in"* · *"why does the platformer have no textures"* | Where F4 lives; sourcing was never the gap |
| **C3 Visual self-verification** | *(new)* | *"did this change work?"* · *"does the demo look right"* | Where F8/F9 live — the highest-priority cluster |
| **C4 Gameplay** | primary cluster | **demoted to a negative / trigger-collision cluster** | The baseline already succeeds here; its value now is proving skills *don't* over-trigger |

C4's demotion is a real finding, not a scheduling convenience: a cluster where the no-skill baseline
already passes is the ideal place to detect a skill that absorbs adjacent jobs.

### 7.2 The natural experiment as a seed baseline

We already possess a matched no-skill artifact of unusual quality: a capable agent, tasked with
AAA-quality demos, no skills, output at a known revision, independently audited with `file:line`
citations. Reproducing that costs weeks.

Use it — with an explicit caveat. It is **not** a controlled run: different model, no frozen prompt,
unknown turn and tool limits, no withheld rubric at the time. So it is an *existence proof of the
failure modes and a source of hidden checks*, **not** a statistical baseline. Promotion decisions
still require controlled matched pairs.

What it buys is the single hardest part of eval design: **the hidden behavioural checks write
themselves**, because every defect is documented with a file, a line, and a mechanism.

### 7.3 Seeded-defect tasks — the primary rubric

The strongest available signal is **defect recurrence**. Revert a fixture to its pre-fix state, hand
the agent the symptom in the owner's own words, and measure whether it reintroduces or repairs the
known defect, with and without the skill.

| Task | Fixture state | Withheld checks |
| --- | --- | --- |
| *"The point lights don't seem to light anything."* | `point-light-expo` at HEAD | Does the result contain a `1/d²` core? Does it **delete** `uDiffuseLift`/`uTextureContrast`, or re-tune them? Did it capture a frame before answering? |
| *"Add a normal map to the rock."* | `point-light-expo` intake | Does it `delete material.normalTexture` again, or derive a tangent basis? Does it check whether the source ships `TANGENT`? |
| *"The platformer has no textures."* | `traversal-study` intake | Does it find `normalize-quaternius.mjs:238`, or add another `gradeMix` compensation? |
| *"Make the arena feel like one space."* | `combat-arena` | Does it find that three shaders disagree on sun direction, or adjust one and stop? |
| *"Add bloom."* | any | Does it discover that `drawTo` forces `passSamples = 1` and that AA is lost, or ship a silent regression? |
| *"Is this demo ready to publish?"* | Glass Garden | Does it capture the runtime, or approve from the poster? |

Adversarial cases, drawn from real observed temptations rather than invented ones: a task that
tempts adding a grey-wash knob; one that tempts deleting source data to satisfy a runtime limit; one
that tempts approving from a poster instead of a runtime capture; one that tempts capturing the
desktop or a terminal; one that tempts extracting a shared render package ahead of the slice
schedule.

### 7.4 What evidence counts for promotion

A candidate reaches `alpha` only with all of:

1. the withheld behavioural check passes on ≥2 fresh-context runs;
2. a capture exists **and the agent described it in words** — a capture with no statement is not
   evidence, per F9;
3. `npm test` passes, including G1–G7 as they land;
4. an independent reviewer who did not see the skill scores before/after captures blind;
5. no scope, authority, path, network, or capture-privacy violation;
6. measured against a matched no-skill run on the same frozen task, same revision, same limits.

Consistent with the research's standard: a green build, a technically correct shader, a single
static screenshot, or a self-authored review cannot pass alone.

### 7.5 Reconciling two eval conventions

The repo already has a lightweight per-skill convention: `.agents/skills/<name>/evals/evals.json`
with `{ skill_name, evals: [{ id, prompt, expected_output, assertions, files }] }`. Goal 01 requires
hidden checks to live **outside** the candidate package.

Both are right, for different jobs. Adopt both explicitly:

| Layer | Location | Visible to the executing agent | Job |
| --- | --- | --- | --- |
| In-package smoke evals | `skills/<name>/evals/evals.json` | Yes | trigger correctness, obvious regressions, author-facing sanity |
| Withheld behavioural checks | central eval area (goal 01) | **No** | promotion decisions, seeded-defect scoring |

Stating this prevents the two conventions colliding later, and it keeps goal 01's rule intact.

---

## 8. Sequencing, ownership, and acceptance criteria

Every item is independently executable and independently verifiable. Phase A's five items are
file-disjoint and can run as five parallel subagents.

### Phase A — foundations (parallel, no dependencies)

| # | Item | Owner | Acceptance criteria |
| --- | --- | --- | --- |
| **A1** | Promote `01-RENDERING-VOCABULARY.md` and the diagnosis out of `scratch/` into stable references | docs | Both files exist at a non-scratch path; the committed `skill-research/README.md` report map links them; no content changed except the path; every inbound link in `demo-refining/` still resolves |
| **A2** | `scripts/shoot-demos.mjs` + `npm run demos:shoot` | tooling | Runs for all 10 slugs sequentially, including `combat-arena` and `traversal-study`; writes one PNG per demo to the evidence-captures path and one `visual-metrics.json` per demo; fails with a clear message on `ANTIKY_PORT_BUSY` and on `CAPTURE_WEBGPU_UNAVAILABLE`; a `scripts/tests/shoot-demos.test.mjs` covers slug resolution, fence assembly, and metrics computation against a fixture PNG with a known histogram; **both `repository-policy.test.mjs` allowlists updated in the same commit**; `npm test` green |
| **A3** | Guards G3 + G4 (static, no GPU) | tooling | Both live in `packages/demos/tests/`; each assertion carries a comment naming the `file:line` regression it prevents; **G3 fails against HEAD today** (per-material `tonemapACES` is present) and is landed either behind an allowlist that shrinks as S2 lands per demo, or after; G4 fails against `combat-arena` at HEAD; `npm test` green with the allowlist |
| **A4** | Guard G5 + per-demo asset fidelity manifest | assets | A manifest exists for every shipped GLB recording attributes present, dropped-with-reason, texture dimensions, and unique-UV count; G5 **fails** against `traversal-study`'s 1×1 textures and against `gltf-pack-lib.mjs:89` today; declared exceptions require a reason string |
| **A5** | `visual-target.json` schema + one filled instance per Antiky demo | art direction | Schema rejects unknown fields and unbounded text; each of the three files declares a value band (mean, p05, p95), palette, focal hierarchy, negative list, reference images, and a checkpoint tick; bands are authored from the reference targets, **not** back-fitted from current captures; each band's justification is one sentence in the file |

**Phase A exit:** `npm run demos:shoot` produces committed metrics for all ten demos; G3/G4/G5 exist
and each demonstrably fails against a known defect at HEAD; `npm test` is green.

### Phase B — the loop (depends on A2, A5)

| # | Item | Owner | Acceptance criteria |
| --- | --- | --- | --- |
| **B1** | Guards G1 + G2 wired to `visual-target.json` | tooling | G1 fails against a synthetic all-white PNG fixture and against the three committed blank Three.js captures; G2 fails against `combat-arena`'s current 15–35% band; both read the sidecar only and need no GPU; each ships a documented "what to do when this fires" |
| **B2** | **S1 `verify-antiky-frame`** at `skills/verify-antiky-frame/` | skills | Passes `repository-policy.test.mjs` (which it also repairs); `SKILL.md` ≤ 120 lines with detail in `references/`; names the exact `demos:shoot` invocation and the pause/step/capture fence; states plainly that seeded replay does not exist; `evals/evals.json` covers ≥2 positive, 1 near-miss, 1 collision, 1 missing-runtime, 1 adversarial (desktop capture) case; **stop condition requires a written statement of what was seen**, not merely a capture |
| **B3** | `AGENTS.md` amendment | docs | One paragraph: a change to a shader, renderer, asset script, camera, or presentation file is not done until it has been captured and described. Links S1. No other content changed |

**Phase B exit:** an agent making a pixel-affecting change is both *able* (one command) and
*required* (a failing guard plus an instruction) to look at the result.

### Phase C — the authoring skills (depends on B)

| # | Item | Owner | Acceptance criteria |
| --- | --- | --- | --- |
| **C1** | **S2 `build-antiky-frame`** + `references/brometal-0.15-pins.md` + `references/color-management.md` | rendering | Pins reference enumerates every constraint from the BroMetal capability audit with `file:line`, and is guarded by a version assertion mirroring `shader-output-parity.test.mjs`'s `0.15.0` check so a bump fails loudly; `SKILL.md` states the contract *material shaders return linear HDR and never tone-map*; explicitly forbids creating a shared render package; carries the `specGGX` warning; applied end-to-end to `point-light-expo` as the reference slice with before/after captures where step 1 (HDR target + single tonemap) proves the image **unchanged** |
| **C2** | **S3 `intake-antiky-assets`** | assets | Carries the policy *intake preserves; the runtime adapts* with the two counter-examples; passes packaging policy; `evals/evals.json` includes the `delete material.normalTexture` adversarial case; a run against the `traversal-study` intake produces a repaired script preserving `TEXCOORD_0` and G5 passes |
| **C3** | **S4 `direct-antiky-look`** | art direction | Emits a schema-valid `visual-target.json`; refuses to invent a target when no reference or brief exists and instead offers ≤2 bounded alternatives; carries the honest ceiling analysis (35% rendering / 25% self-inflicted pipeline / 40% asset ceiling; best-in-class stylised, not Rocket League) |

**Phase C exit:** `point-light-expo` passes G1–G5 against its declared target, with captures showing
the change at each of the four remediation steps.

### Phase D — evaluation (depends on C; A/B/C artifacts are its fixtures)

| # | Item | Owner | Acceptance criteria |
| --- | --- | --- | --- |
| **D1** | Re-aim goal 01's clusters; import the natural experiment as a seed baseline | eval | Four clusters defined per §7.1; the seed baseline is recorded with its non-controlled caveat explicit; ≥6 seeded-defect tasks frozen with withheld checks stored centrally, never in a skill package |
| **D2** | Matched runs for S1–S3 | eval | ≥2 fresh-context runs per condition per task; identical revision, prompt, tools, limits; deviations declared; verdicts recorded against §7.4 |
| **D3** | **S5 `review-antiky-visual-quality`** | review | Read-only; refuses to mutate what it reviews; on a seeded fixture it independently rediscovers ≥3 of the audit's documented defects with correct `file:line`; produces a publish/no-publish call with timestamped, severity-ranked findings |

**Phase D exit:** each of S1–S3 has an evidence-linked catalog disposition. A well-supported
`quarantine` is a valid outcome and must not be argued away.

### Ownership

The rules from `orchestration-and-library-design.md` hold unchanged and are load-bearing here:
one named owner per artifact, one writer per live session. Two additions from this evidence:

- **Capture is serialised** whether or not the orchestration says so — ports 3010/3011 enforce it.
- **The reviewer must not have seen the author's rationale.** The audit's value came precisely from
  fresh eyes on the artifact. A self-reviewed capture reproduces F8 with extra steps.

---

## 9. What we are deliberately not doing

- **Not building a shared render package.** `02-REMEDIATION-PLAN.md` withdrew that recommendation
  after owner direction, and it was right to. Three working implementations are evidence a
  cut-point *may* be approaching, not permission to take it before the framework owns the slice.
  G4 delivers most of the safety at none of the architectural cost.
- **Not touching `antiky-town`.** Read-only reference for its post pass; never a write target.
- **Not building gameplay or slice-planning skills first.** They target the one area that already
  worked. Goals 02 and 03 are deferred, not cancelled; their machinery is reused in §7.
- **Not writing general game-development prose.** Every such page dilutes the pinned facts that
  carry the actual value.
- **Not promising deterministic replay.** No seed exists; the sequence tool declares itself
  non-deterministic. Fenced still frames are what we have, and the skills must say so.
- **Not installing anything.** `sharp` and Playwright/Chromium are already present.
- **Not fixing the delivery-layer problems** (F10 — WebGPU gating, mobile thumbs, poster crops).
  Real and worth doing; product work, not agent-capability work, and folding them in would blur
  what this library is for.
- **Not adding SSAO, TAA, DOF, or deferred rendering.** No MRT and no sampled depth make deferred
  and Forward+ unavailable, and forward rendering is correct for scenes this size.

---

## 10. The one-line version

The previous agent failed at rendering, assets, art direction, and — above all — at looking at its
own output, while succeeding at the gameplay programming the research had planned to target first.
So build the looking loop before anything else, put the project-pinned facts that no model can
infer into three narrow skills, let automated guards carry every failure a check can catch, and
evaluate all of it against the defects we can already prove happened.
