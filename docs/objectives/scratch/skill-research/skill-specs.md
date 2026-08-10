# Skill specifications

Supporting detail for [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Proposal only — none of
these packages exist yet.

Each spec answers the questions
[`recommended-library.md`](../../skill-research/recommended-library.md) requires before a proposal
becomes a skill: the recurring job, the trigger, inputs and outputs, the stop condition, the
non-obvious project knowledge it carries, and what would make it wrong. Each also answers the
question the demo audit added:

> **Which documented defect would this have prevented?**

A proposal that cannot name one does not get built.

## Packaging rules for all of them

Enforced by `scripts/repository-policy.test.mjs:64-75`:

```
skills/<name>/SKILL.md          frontmatter is EXACTLY:
                                ---
                                name: <kebab-case, must equal the directory name>
                                description: <single line, non-empty>
                                ---
skills/<name>/references/*.md   detail, loaded only when the task needs it
skills/<name>/evals/evals.json  { skill_name, evals: [{ id, prompt, expected_output, assertions, files }] }
```

No third frontmatter key. No blank line inside the block. The vendored marketing skills in
`.agents/skills/` carry a `metadata:` block and would fail this regex — that is a separate,
unpoliced, third-party surface pinned by `skills-lock.json`. Do not copy their shape.

Keep every `SKILL.md` under ~120 lines. Revision-sensitive detail goes one reference level away, so
it can be version-guarded independently of the workflow prose.

---

# S1 — `verify-antiky-frame`

**Priority: highest.** Everything else in the plan is downstream of this one.

### Recurring job

After any change that can alter a pixel, capture the game canvas, measure it, compare it against
the demo's declared visual target, say in words what you see, and iterate until it matches or a
defect is filed.

### Defects it would have prevented

F8 in its entirety — *"no shader in this repo shows evidence of having been looked at after it was
written"* — and therefore, indirectly, the discovery of F1 through F7 months earlier. Directly: F9,
the three blank-white capture PNGs committed into a directory named `captures` and cited by
`PRODUCT.md:113` as current evidence, and Glass Garden shipping a poster its runtime cannot
reproduce.

### Realistic trigger prompts

Positive:
- *"I changed the ship shader — does it look right?"*
- *"Add bloom to point-light-expo."* (the capture step is part of the job, not a follow-up)
- *"Is combat-arena ready to put on the site?"*
- *"Why does the platformer look flat?"*
- explicit: *"Use verify-antiky-frame on traversal-study."*

Near-miss that must **not** trigger: *"Why does `simulation.test.ts` fail?"* — a behavioural test
failure is not a visual question.

Collision: with `review-antiky-visual-quality` (S5). S1 is the author verifying their own work; S5
is an independent read-only party who did not see the author's rationale. S1 must not claim to
satisfy S5, and must say so.

### Inputs

- a demo slug
- that demo's `visual-target.json` (from S4). **If it does not exist, S1 stops and says so** — you
  cannot verify against an undeclared target, and inventing one here reproduces the original
  failure with extra ceremony.
- a WebGPU-capable machine

### Outputs

- one PNG per demo at the committed evidence-captures path, overwritten each run
- `packages/demos/<category>/<slug>/visual-metrics.json` — the assertable artifact:
  `{ meanLuminance, p05, p95, uniqueValueCount, distinctColorCount, captureBounds, buildRevision,
  completedStepCount, sha256 }`
- **a written statement of what the agent sees**, compared against the declared target

### Stop condition

All three of:
1. metrics exist and guards G1/G2 pass, **or** a defect is filed with the capture attached;
2. the agent has stated in words what it sees and whether it matches the target;
3. no capture was taken of anything but the game canvas.

A capture with no statement is not evidence. That is the direct lesson of F9: captures *were*
produced for the Three.js demos, and nobody looked at them.

### Non-obvious project knowledge it carries

This is the whole reason it earns a skill rather than a line in `AGENTS.md`.

- The one-line entry point is `npm run demos:shoot -- <slug>`; the five-call MCP ceremony behind it
  (`get_latest_build` → `get_runtime_status` → `pause_simulation` → `step_simulation` →
  `capture_frame` with a fence assembled from all of them) is in the script, not in the agent's
  head. `capture_frame`'s input is `additionalProperties: false` with six required fields
  (`packages/cli/src/mcp/tools.ts:131-158`).
- **Target dimensions must be exactly 1280×720 at DPR 1** — the manifest viewport — or
  `validateTarget` rejects with `CAPTURE_DIMENSIONS_MISMATCH`
  (`packages/cli/src/host/capture-service.ts:63-76`).
- **Only one demo can run at a time.** Every manifest declares ports 3010/3011. `ANTIKY_PORT_BUSY`
  means a stale session; `npm run portRelease` clears it.
- **There is no seed.** `grep seed` in `packages/framework/src` returns nothing, and the sequence
  tool writes `deterministic: false` (`capture-sequence-service.ts:371`). Reproducibility comes
  from pause + `step_simulation { expectedCompletedStepCount }` + capture fenced on `sessionId` /
  `completedStepCount` / `stateDigest`. **Do not promise replay.**
- `.antiky/` is globally gitignored and the evidence store `rm -rf`s itself on session stop
  (`evidence-store.ts:247-253`). Anything worth keeping must be copied out.
- Capture is already canvas-only and privacy-safe by construction — a throwaway `0700` profile,
  loopback-only routing, `document.querySelector('#antiky-game')`, and refusal when a
  person-controlled runtime is connected (`CAPTURE_RUNTIME_BUSY`). **Never reach for a screenshot
  tool that can see a desktop, a window, or a terminal.**
- A capture that is 100% one value is a *capture bug*, not a render result. Both Three.js demos set
  `preserveDrawingBuffer: true` and still produced blank PNGs — the capture fired against an
  un-composited canvas.

### Acceptance criteria

- passes `repository-policy.test.mjs` (and repairs it — see below)
- `SKILL.md` ≤ 120 lines
- `evals/evals.json` covers ≥2 positive, 1 near-miss, 1 collision with S5, 1 missing-`visual-target`
  case, 1 missing-runtime case, 1 adversarial case attempting desktop capture
- on a seeded run against a demo with a deliberately broken exposure, the agent captures, reports
  the value band is out of range, and does not declare success
- on a run with no `visual-target.json`, it stops rather than inventing a target

### What would make it wrong

If agents run `demos:shoot` and then describe the image without opening it, the skill has failed
and the fix is a guard, not more prose. Watch for statements that restate the code's intent rather
than the image's content — *"the scene now has a directional key light"* is a claim about the diff;
*"the platform tops are now clearly brighter than their sides"* is a claim about the picture.

### Side effect worth knowing

`repository-policy.test.mjs:64-75` requires a root `skills/` directory with at least one valid
skill. That directory was added in `e248631` and deleted in `1062bd4` ("sync") while the test
requiring it was left in place, so **`npm test` is red on `main` today**. Landing S1 repairs it.

---

# S2 — `build-antiky-frame`

### Recurring job

Give one hand-rolled demo renderer the frame structure that makes lighting, shadow, and post
possible — an HDR scene target, exactly one tone map, a shadow pass, hemispheric ambient, bloom and
grade — inside that demo, with no shared package.

### Defects it would have prevented

F1 and F2 in full. No demo ever calls `createRenderTarget`, so shadows, HDR, bloom, AO, DOF and
grading are all *structurally impossible* rather than merely absent. `tonemapACES` is called
per-material in 3 of 5, 4 of 5, and 1 of 3 shaders across the three demos, so every additive effect
composites onto clamped values and every VFX reads as a flat sticker. Colour is unmanaged in both
directions, and the errors cancel exactly for unlit passthrough — which is precisely why the defect
survived review.

### Realistic trigger prompts

- *"Add shadows to point-light-expo."*
- *"Nothing glows — the energy effects look like stickers."*
- *"The lights don't seem to light anything."*
- *"Everything looks washed out and milky."*

Must **not** trigger on: *"Write a shader that draws a hexagon grid"* (no frame structure involved),
or *"Why is the frame rate low?"* (profiling, which does not exist yet).

### Inputs

- one demo, plus its `visual-target.json`
- the current BroMetal version, asserted not assumed

### Outputs

- changes confined to that demo's `src/`
- captures at each delivery step, via S1
- for the reference slice, a note in the demo's README naming it canonical

### Stop condition

The declared step is delivered, S1 has captured and described it, and G3/G4 pass. Specifically for
step 1 (HDR target + single tone map): **the capture must prove the image is unchanged.** That step
is plumbing; a visual difference means something else moved and must be found before continuing.

### Non-obvious project knowledge it carries

The `references/brometal-0.15-pins.md` file is the densest single piece of value in the library.
None of it is inferable, none of it is in any model's training data, and every item below is a trap
that produces plausible-looking broken code:

| Pin | Consequence |
| --- | --- |
| `drawTo` hard-codes `passSamples = 1` (`webgpu.js:235`) | **The moment you render to an HDR target you silently lose all 4× MSAA.** Must be solved as part of the HDR step, not after |
| Render targets sample `nearest` (`webgpu.js:761`) | A standard bloom downsample chain produces blocky crawling glow; either patch it (2 lines) or hand-roll bilinear |
| `TARGET_FORMAT = 'rgba16float'`, hardcoded | HDR works today; nothing else is available |
| `drawTo` always `loadOp: 'clear'` | You cannot accumulate across calls; everything into one target draws inside one `drawTo` |
| Single colour attachment, no MRT | **Deferred and Forward+ are off the table.** Design for forward |
| Depth attachments are `RENDER_ATTACHMENT` only | No sampled depth ⇒ no SSAO, DOF, soft particles, or screen-space contact shadows. Use a linear-depth colour prepass or bake AO |
| `createTexture` hardcodes `rgba8unorm` (`webgpu.js:848`); `getPreferredCanvasFormat()` never returns `-srgb` | **No hardware sRGB in either direction.** Decode albedo in-shader; encode once at present |
| `specGGX` is the D term only, with `0.25` where `1/(4·NdotL·NdotV)` belongs | **A helper that looks like a GGX BRDF and is a trap.** Not energy-conserving; spikes as roughness → 0 |
| `depthWriteEnabled` is derived from `blend === 'none'`; `depthCompare` is hardcoded `'less'` | No z-prepass, no reverse-Z, no `less-equal` skybox |
| Culling is renderer-global, not per-program | Two-sided foliage and single-sided meshes cannot coexist cleanly |
| One vertex buffer per attribute, default `maxVertexBuffers: 8` | **Hard 8-attribute cap**, vertex + instance combined |
| No `mat4()` constructor in the DSL | Per-instance transforms must decompose to position/scale/axis-angle via `rotate3` |
| Setting a texture uniform nulls the bind group (`webgpu.js:542`) | Swapping a texture per draw allocates a fresh `GPUBindGroup` per draw, every frame. **Bind textures once at setup** |
| Geometry cannot be shared between programs | A shadow pass uploads and stores the vertex data a second time |

And the two contracts that fix the deepest bugs:

- **Material shaders return linear HDR colour and never tone-map.** The stage tone-maps exactly
  once, at the end, after bloom.
- **Albedo is decoded from sRGB; roughness, AO and ARM maps are not.** They are authored as
  non-colour data — the byte *is* the linear value. Decoding them is a new bug.

Plus one policy: `uDiffuseLift`, `uTextureContrast`, `uSaturation` and the `mix(vec3(0.48), …)`
grey-wash are **scar tissue** — they exist to fight the unmanaged colour pipeline and reduce
algebraically to `albedo_out = 0.78·albedo + 0.2456`. Once colour is managed they are actively
harmful. **Delete, do not re-tune.**

### Explicit prohibition

**Do not create a shared render package.** Capabilities stay hand-rolled inside demos until the
framework promotes the slice on its own schedule. Three working implementations are evidence a
cut-point may be approaching, not permission to take it. G4 is the mitigation that respects this:
it makes divergence visible without forcing shared code. `antiky-town` is off limits as a write
target, though its `town-post.shader.ts` is a legitimate read-only reference for the pattern.

### Acceptance criteria

- `references/brometal-0.15-pins.md` cites `file:line` for every claim and is guarded by a version
  assertion mirroring `shader-output-parity.test.mjs`'s existing `0.15.0` check, so a BroMetal bump
  fails loudly rather than silently invalidating the reference
- applied end-to-end to `point-light-expo` as the reference slice, delivering the four remediation
  steps in order, each with a before/after capture
- step 1's capture proves the image unchanged
- G3 passes for `point-light-expo` afterwards
- `evals/evals.json` includes an adversarial case that tempts extracting a shared package, and one
  that tempts using `specGGX` directly

---

# S3 — `intake-antiky-assets`

Replaces the `source-game-assets` scaffold, which is aimed at licensing — uniformly clean CC0
across every catalog snapshot, and not a constraint in this repository.

### Recurring job

Bring a catalog asset into a demo without losing data the source already carried, and record what
was preserved and what was not.

### Defects it would have prevented

F4 in full, including the worst single defect in the repository:
`normalize-quaternius.mjs:238,267` overwrites every source UV with a palette-column lookup,
producing shipped textures that are literally **1×1 pixels** for `cloud-large`, `cloud-small`, and
`coastal-cliff`. Also `gltf-pack-lib.mjs:89` running `delete material.normalTexture` on normal maps
that were downloaded, hashed, and committed.

### The one policy it exists to carry

> **Intake preserves. The runtime adapts. A renderer limitation is never a reason to delete source
> data.**

That inversion is the entire lesson, and it is not something a model derives on its own — deleting
an unusable binding is locally the reasonable-looking choice every single time. The recorded
rationale in `pack-catalog-models.mjs:126` is *"Omit the tangent-space normal binding because the
runtime shader has no tangent basis"*, which is true, locally sensible, and wrong. The correct move
is to keep the binding and derive a tangent basis at runtime, or to record the gap and leave the
data in place.

### Realistic trigger prompts

- *"Bring the Poly Haven dead tree into point-light-expo."*
- *"Why does the platformer have no textures?"*
- *"Add a normal map to the rock."*
- *"Use one of the HDRIs for ambient."* (332 are cataloged; zero are used)

Must **not** trigger on: *"Is this asset CC0?"* — a metadata lookup, not an intake.

### Non-obvious project knowledge it carries

- **`parseGlb` reads only `POSITION`, `NORMAL`, `TEXCOORD_0` and indices, plus
  `pbrMetallicRoughness.baseColorTexture`.** `TANGENT`, `COLOR_0`, normal/MR/occlusion/emissive
  textures, `baseColorFactor`, and `KHR_texture_transform` are all silently dropped.
- **`parseGlb` never reads `json.nodes`**, so any GLB with non-identity node TRS assembles wrong.
  *This is why `normalize-quaternius.mjs` exists* — and understanding that is what stops the next
  agent from deleting it wholesale. Chesterton's fence: the baking is necessary, the UV collapse is
  not.
- **The catalog installer cannot install any crawled asset.** `install.ts:71-73` accepts only
  `install-verified` entries, and all 1,450 crawled assets are `source-verified` with
  `downloads: []`. Bespoke per-demo scripts are the norm, not a smell.
- **BroMetal ignores glTF samplers entirely** and builds its own with `filter: 'linear'` plus a full
  mip chain. A 6-pixel palette strip gets `mipLevels = 3`; mip 2 is the average of all six colours,
  so the courier's blue, orange and teal smear together at distance. The GLB *declares* `nearest`
  and it is ignored. **Pass `filter: 'nearest'` for palette strips** — one line, large payoff.
- Kenney kits ship `TANGENT`; nothing reads it. Poly Haven meshes do not, so tangents must be
  generated at pack time or derived in-shader.
- Counting **unique UVs** is the fastest fidelity diagnostic available: an 8,184-vertex Kenney room
  has 40 unique UVs (40 flat swatches); a 4,107-vertex Quaternius ship has 1,521 (a genuine
  unwrapped albedo). One number separates "textured" from "palette-indexed".

### Outputs

- the intake script change
- a per-asset fidelity manifest: attributes present, attributes dropped **with a reason**, texture
  dimensions, unique-UV count
- G5 passing, or a declared exception carrying a reason string

### Stop condition

The asset is in the demo, the fidelity manifest is written, G5 passes or an exception is declared
with a reason, and S1 has captured the result.

### Acceptance criteria

- a run against `traversal-study`'s intake produces a repaired script preserving `TEXCOORD_0` and
  the source texture, after which G5 passes
- `evals/evals.json` includes the `delete material.normalTexture` adversarial case and a case that
  tempts adding another `gradeMix` compensation instead of fixing the extraction
- refuses to widen scope to "replace these assets with better ones" — that is a separate decision
  with a separate owner, and the audit is explicit that asset fidelity is the *last* 40%, not the
  first

---

# S4 — `direct-antiky-look`

### Recurring job

Write down what one demo is supposed to look like, in terms specific enough that a capture can be
checked against it.

### Defects it would have prevented

F7 — but indirectly, and the spec should be honest about that. The failed agent did not lack
composition knowledge. What was missing was a **declared target to have failed against**, and
therefore any possibility of noticing. 60% dead sky, a ground quad with crisp corners cut against
pure black, props at mismatched scales reading as a debris pile, and a lighting demo that fails to
demonstrate its own headline feature are all obvious *once someone has written down what the frame
was supposed to do*.

### What it is not

Not an art-direction essay. A capable model already knows key/fill/rim, value structure, focal
hierarchy, and aerial perspective — and
[`01-RENDERING-VOCABULARY.md`](../demo-refining/01-RENDERING-VOCABULARY.md) already writes the
shared language down better than a skill would. S4's job is the **artifact**, not the education.

### Outputs

One schema-valid `visual-target.json` per demo:

```
referenceImages[]        with a sentence each on what specifically is being borrowed
valueBand                { meanLuminance, p05, p95 } + one sentence justifying each
palette                  and what each colour is for
focalHierarchy[]         what the eye should find first, second, third
mustRead[]               e.g. "the player silhouette at gameplay distance"
negativeList[]           what this demo must not look like
checkpointTick           the fenced step count S1 captures at
```

The value band is the load-bearing field: it is what G2 asserts, and it is what turns *"make it look
better"* into a checkable claim.

### Non-obvious project knowledge it carries

- **The honest ceiling analysis.** ~35% of the gap is rendering, ~25% is self-inflicted pipeline
  damage, ~40% is genuine asset ceiling. Kenney flat-palette geometry cannot produce a League of
  Legends or Rocket League signal at any polygon count; **best-in-class stylised** — Astro Bot,
  Untitled Goose Game, Monument Valley — is reachable through lighting and grading. A target that
  ignores this produces work that fails by construction.
- Bands are authored **before** the work, from the reference, never back-fitted from the current
  capture. A band tuned until it passes is `uDiffuseLift` with a new name.
- Widening a band requires a one-sentence reason in the same commit.

### Stop condition

A schema-valid target exists and every numeric field has a stated justification. If no reference or
brief exists, S4 offers **at most two** bounded alternatives and stops — it does not invent an art
direction, a target audience, or a platform.

### Acceptance criteria

- schema rejects unknown fields and unbounded text
- three filled instances exist for the three Antiky demos
- each band's justification is present and traceable to a reference image
- on a request with no reference material, the skill produces alternatives rather than a target

---

# S5 — `review-antiky-visual-quality`

### Recurring job

Independent, read-only, fresh-context visual review: look at the captures, name defects with
`file:line`, rank them by visual gain per unit of effort, and make a publish / no-publish call.

### Defects it would have prevented

None directly — S5 is a detector, not a preventer. Its justification is different and strong: **the
demo audit is an existence proof that this role works.** Four fresh-context read-only reviewers
found every defect in the taxonomy, with citations, from artifacts a self-reviewing author had
already declared finished.

### Hard constraints

- **Read-only.** It cannot mutate what it reviews. `orchestration-and-library-design.md` is right
  that an author cannot be its own reviewer, and F8 is what that looks like in practice.
- **Must not see the author's rationale**, intended solution, or expected score. The audit's value
  came precisely from fresh eyes on the artifact.
- Judges **in motion at delivery size and compression** where a sequence exists, not from repeated
  static images. A still frame cannot prove timing, game feel, or that a starfield will crawl.

### Acceptance criteria

- on a fixture seeded with three of the audit's documented defects, independently rediscovers ≥3
  with correct `file:line`
- refuses a write request against the artifact under review
- output carries rubric version, timestamped findings, severity, confidence, and a decision
- an `evals` case confirms it does not approve from a poster when a runtime capture is available —
  the Glass Garden failure

---

# Deferred, with the reason recorded

| Candidate | Why deferred | What would revive it |
| --- | --- | --- |
| `tune-antiky-game-feel` | Most of the content is general craft — trauma-squared shake, noise instead of beating sines, easing curves — which a capable model produces on request. The repo-specific parts are two facts (no interpolation alpha; correct framerate-independent easing already exists at `traversal-study/src/presentation.ts:73` and was not copied) and are better delivered as guard G7 now | Evidence that G7 plus those two facts in a reference is insufficient |
| `build-antiky-gameplay` | Targets the one area the baseline agent already did well, with tests. [`goal 03`](../../skill-research/goals/execute-goal-03.md)'s machinery is reused; only its cluster is deferred | A gameplay defect class with evidence behind it |
| `plan-antiky-game-slice` | Evidence-neutral. The demos have coherent slices and legible loops. The piece that *is* needed — a declared player-facing target — is delivered faster by S4 | A slice-scoping failure with evidence behind it |
| `author-antiky-worlds` | `antiky-town` is off limits; no evidence | Access plus evidence |
| `build-antiky-ui`, `integrate-antiky-brometal`, `profile-antiky-games`, `ship-antiky-games` | No evidence yet. `recommended-library.md` already says to add release-side skills "only when concrete release work requires them" | Concrete work that demands them |
| A colour-management skill | No independent trigger — colour work is always part of building a frame or writing a material. It is a reference inside S2 | It acquiring a trigger of its own |
| An asset-licensing skill | Every asset in every catalog snapshot is CC0-1.0 with modification and redistribution permitted. A real concern in general; a non-constraint here | A non-CC0 source entering the catalog |
| A BroMetal-patching skill | `scripts/patch-brometal.mjs` already encodes the pattern with a hard version guard. One paragraph in S2's reference | The patch set growing beyond what one paragraph covers |
