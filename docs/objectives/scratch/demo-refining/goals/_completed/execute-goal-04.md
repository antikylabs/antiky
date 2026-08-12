# Execute goal 04: stop the asset pipeline destroying the assets

## Prerequisites

Complete [execute goal 01](_completed/execute-goal-01.md) first. The probe tests below are measured from
captured frames using `npm run demos:shoot` and the frame-statistics library it delivers, and the
"no asset script discards `TEXCOORD_0` or `normalTexture`" invariant lives in the pipeline-invariant
test file goal 01 creates. Without those this goal cannot be proven.

[Execute goal 03](execute-goal-03.md) lands an interim `filter: 'nearest'` fix at
`packages/demos/antiky/traversal-study/src/renderer.ts:216`, and **this goal supersedes it**. That
one line is the only file overlap between the two goals, so agree its ownership before starting: if
goal 03 has already landed, replace its interim value with the durable per-texture-class decision
below; if goal 03 has not started, take the line here and tell goal 03 to skip W C.3. Everything
else in the two goals is disjoint and they are otherwise parallel-safe.

Read `../06-WORK-PACKETS.md` Track C, `../02-REMEDIATION-PLAN.md:260-287`, and
`../03-ART-DIRECTION-AND-VFX.md:166-205` (the capability ledger) before writing any code.

## `/goal` objective

Stop the three per-demo asset scripts from destroying data that was downloaded, hash-verified and
committed, and give every demo an in-shader sRGB decode so the restored data is used in a correct
colour space.

This is work packets W C.1, W C.2 and W C.3, plus the convergence of the three divergent asset
scripts onto one fidelity policy. The defects are self-inflicted and cheap to reverse. They are the
single reason `traversal-study` has no usable textures at all, and one of the reasons
`point-light-expo`'s rock reads as clay.

The scope boundary against [execute goal 05](execute-goal-05.md): **this goal restores the data and
proves one normal-mapped surface responds to light.** Goal 05 generalises triplanar sampling into a
full PBR material path across the demos. Do not build the general material system here.

### `antiky-town` has a different pipeline, in kind

`antiky-town` is in scope on the owner's instruction, and the honest answer is that **most of this
goal does not reach it, because it has no GLB packing scripts at all** — there is no `scripts/`
directory under `packages/demos/antiky/antiky-town`. Its art arrives as three texture atlases with
JSON companions (`assets/town-material-atlas-v1.png/.json`, `town-prop-atlas-v2.*`,
`town-vegetation-atlas-v2.*`) plus sprite atlases under `assets/sprites/`. There is no `TEXCOORD_0`
to overwrite, no `normalTexture` to delete, and no per-demo GLB normaliser to converge.

Forcing it into the same shape would be a fabrication. Two things genuinely do apply — the sRGB
decode and an atlas-specific filtering hazard — and they are stated as their own outcomes below.

**Effort.** Roughly 3 days for the three GLB-script demos, plus roughly 0.5 day for `antiky-town`
(one decode helper across 13 shader pairs, plus the atlas-bleed measurement). Report the town work
separately rather than folding it into the total.

## Required outcome

When the work is complete, the repository must have:

1. `packages/demos/antiky/traversal-study/scripts/normalize-quaternius.mjs` reading and preserving
   `TEXCOORD_0` from the source GLB. It currently computes
   `const paletteU = (materialIndex + 0.5) / colors.length` at `:238` and writes
   `uvs.push(paletteU, 0.5)` at `:267` for every vertex, never once consulting the source
   attribute — which is why the shipped `cloud-large`, `cloud-small` and `coastal-cliff` textures
   are literally 1×1 pixels;
2. regenerated Quaternius GLBs and their committed textures, with the source texture preserved
   rather than replaced by a palette column;
3. `delete material.normalTexture` gone from
   `packages/demos/antiky/point-light-expo/scripts/gltf-pack-lib.mjs:89`, and every derived GLB that
   had a normal map upstream still carrying one;
4. normal maps applied through **triplanar projection**, which needs no tangent basis, proven by a
   grazing-angle probe test on at least one surface per affected demo;
5. an in-shader sRGB decode helper in **every** demo that samples an albedo texture, `antiky-town`
   included — BroMetal exposes no sRGB texture format and uploads everything as `rgba8unorm`
   (`node_modules/brometal/dist/runtime/webgpu.js:836-842`), so the decode must happen on sample;
6. the correct filtering decision for every texture class, superseding goal 03's interim
   `filter: 'nearest'` — real textures get mips and anisotropy, genuine palette strips do not, and
   the choice is made per texture class in one place with a comment saying why;
7. one fidelity policy shared by the three GLB-script demos, so a future script cannot silently drop
   an attribute or a map again; and
8. for `antiky-town` specifically: the sRGB decode across its 13 shader pairs, and a measured answer
   on atlas edge bleed. Its three world atlases load with `filter: 'smooth'`, `wrap: 'clamp'` and
   `anisotropy: 8` (`src/town/index.ts:258`, `:263`, `:268`). Mipped, anisotropic sampling of an
   *atlas* averages across tile boundaries at exactly the edges where tiles meet — the same class of
   defect as the palette-strip mud, arriving by a different route. Either prove it does not happen
   at this atlas's padding, or fix it with padding or a tile-clamped sample.

## In scope

- **W C.1 — fix the UV collapse.** Read `TEXCOORD_0` from the source primitive, apply the same node
  and skin transform path the positions already take, and write the real UVs. Where a source
  primitive genuinely has no `TEXCOORD_0`, fail loudly with the mesh name rather than substituting a
  palette column. Regenerate the affected GLBs and commit them.
- **W C.2 — stop deleting normal maps.** Remove the delete, carry the normal map through packing,
  and sample it. `point-light-expo`'s Poly Haven scans have genuine unwraps, so keep their UVs for
  albedo and use a triplanar basis for the normal — that combination needs neither MikkTSpace
  tangents at pack time (no source mesh ships `TANGENT`) nor screen-space derivatives.
- **W C.3 — filtering.** Decide filtering per texture class and record the classes. This packet was
  written as a five-minute interim fix and is superseded here; the deliverable is the durable
  decision, not the interim one.
- **Script convergence.** Extract one fidelity policy that
  `traversal-study/scripts/normalize-quaternius.mjs`,
  `point-light-expo/scripts/gltf-pack-lib.mjs` and
  `combat-arena/scripts/intake-quaternius-ships.mjs` all import and enforce: which attributes must
  survive, which material maps must survive, and the minimum shipped texture dimension. Keep the
  three scripts separate — they process different kits with different needs. The shared thing is the
  policy and its assertions, not a general asset framework. **`antiky-town` is excluded from this
  item** — it has no asset script to converge, and inventing one to make the set symmetrical would
  add a build step the demo does not need.
- **sRGB decode.** A `sampleAlbedo`-shaped helper in each demo's own shader source that decodes
  sRGB to linear on sample. Note the footgun from the capability ledger
  (`../03-ART-DIRECTION-AND-VFX.md:196-198`): a `texture()` call inside a DSL helper function
  compiles to `textureSampleLevel(…, 0.0)` and silently loses mips, so every material `texture()`
  call must be inlined in the `fragment()` body.
- **`antiky-town`'s half-managed colour.** This demo is the clearest case in the repository, and it
  shows the bug's shape precisely. It already **encodes** on output —
  `src/town/shaders/town-post.shader.ts:268` runs `gammaCorrect(tonemapACES(positiveGrade), 2.2)`
  in a single post pass, which is what the other three demos are still being built toward. What it
  does not do is **decode** its atlas samples, so every atlas texel is treated as linear when it is
  sRGB, and all of its lighting maths — a real sun, a real shadow term, a sky/ground ambient — runs
  in display space. Adding the decode is the whole fix here, and it will visibly darken mid-tones.
  Expect that, capture it, and re-check its post-pass grade afterwards rather than pre-compensating.
- **`antiky-town`'s sprite atlas is not a material.** `src/town/index.ts:482` loads the actor atlas
  with `filter: 'nearest'` and no anisotropy. That is correct for pixel-art sprites and must stay.
  Sprite albedo still needs the sRGB decode; it does not need, and must not get, mips or
  anisotropy.
- Regenerating every touched `*.shader.gen.ts` and extending each demo's existing asset tests.

## Required tests and evidence

- **W C.1** — every regenerated GLB has more unique UV pairs than it has materials. Today
  `cloud-large`, `cloud-small` and `coastal-cliff` each have exactly one. Assert it in
  `traversal-study/tests/assets.test.ts` so it cannot regress.
- **W C.1** — no shipped texture is smaller than 64×64. Where a source texture is genuinely a
  palette strip, the script must record the source dimensions in the asset receipt and fail rather
  than emit a 1×1 image silently.
- **W C.2** — a source-level assertion that no script under `packages/demos/antiky/*/scripts/`
  contains `delete material.normalTexture`, and a data assertion that every derived GLB whose
  upstream source had a normal map still declares one.
- **W C.2** — probe test: on a normal-mapped surface lit at a grazing angle, the luminance standard
  deviation inside a named probe rectangle is at least 3× that of the same surface with normal
  mapping disabled. Probe rectangles are addressed by name from the per-demo config file goal 01
  creates, never by magic numbers in the test body.
- **W C.3** — no colour appears in the capture that is absent from the source palette, within
  4/255, for any surface still drawn from a palette strip.
- **sRGB decode** — a unit test of the decode against known values: 0, 0.5 and 1.0 in sRGB map to
  the analytic linear results within 1/255, and the round trip through the demo's encode is
  identity within 1/255. A static assertion that every shader sampling an albedo texture calls the
  decode, across all four demos and `antiky-town`'s 13 shader pairs — this is the check that catches
  the one shader somebody forgets.
- **Convergence** — a test that all three GLB scripts import the shared policy and that violating it
  (a fixture GLB missing `TEXCOORD_0`, a fixture material with a dropped normal map) produces a
  stable, named failure rather than a silent pass. The assertion must not fail `antiky-town` for
  having no script; encode that exclusion explicitly, with the reason, so it reads as a decision
  rather than an oversight.
- **`antiky-town` atlas bleed** — sample a probe rectangle spanning a known atlas tile boundary on
  a world surface at a distance where mip level 2 or lower is selected, and assert no pixel takes a
  colour absent from either adjacent tile within 4/255. If the atlas already carries enough padding
  to make this pass, record the measurement and change nothing.
- **`antiky-town` colour** — the demo's `visual-metrics.json` before and after the decode, with the
  mid-tone shift stated as a number. A decode that changes nothing means it is not wired in.
- Each demo's existing asset tests stay green: `traversal-study/tests/assets.test.ts` and the
  `assets/antiky-assets.json` receipts must still validate, including hashes.
  `antiky-town/tests/composition.test.ts` and `point-light-adapter.test.ts` must also stay green.
- One `npm run demos:shoot` run per affected demo at the end with a committed `visual-metrics.json`
  sidecar, and an explicit statement that the frames were looked at.
- `npm test` green.

### The rejection rule for this goal

**Any solution built on screen-space derivatives must be rejected in review.** BroMetal's DSL
exposes no `dpdx`, no `dpdy` and no `fwidth` — verified against
`node_modules/brometal/dist/dsl/builtins.d.ts`, whose complete builtin list contains no derivative
function. An earlier draft of `../02-REMEDIATION-PLAN.md` proposed deriving a tangent basis
in-shader with derivatives; that draft is superseded at `../02-REMEDIATION-PLAN.md:274-283` and the
approach is impossible, not merely discouraged.

Triplanar projection deletes the problem instead of working around it: it derives texture
coordinates from world position and normal and needs no tangent basis at all. Two mechanics that
are easy to get wrong and must be handled explicitly:

- Vec3 exposes only `.xy`, `.xz` and `.yz` swizzles
  (`node_modules/brometal/dist/dsl/types.d.ts:13-24`), so reoriented normals must be built with
  explicit constructors such as `vec3(a.z, a.y, a.x)`.
- Props with per-instance yaw swim under world-space projection. Project those in object space and
  rotate the resulting world normal by the same yaw.

Kenney's models do ship `TANGENT` and nothing currently reads it, so a tangent-space path stays
available for those specific meshes if triplanar proves wrong for a surface. Choosing it must be
argued in a comment, not defaulted into.

## Explicit non-goals

- Do not build the general triplanar PBR material path, material-ID routing, detail normals, SH-9
  irradiance or the catalog material intake. Those are goal 05.
- Do not add an HDR render target, a shadow map, bloom or a colour grade. The sRGB decode here is
  the sample-side half of colour management only; the encode-once-on-output half belongs to the
  render-pipeline goal — except in `antiky-town`, which already has it
  (`src/town/shaders/town-post.shader.ts:268`) and where the decode therefore completes the
  round trip on its own.
- Do not build `antiky-town` an asset script, a GLB pipeline, or a normal-map intake to make it
  match the other three. It does not have those problems.
- Do not re-tune `antiky-town`'s post-pass grade to hide the mid-tone shift the decode causes. Land
  the decode, capture it, and leave grading to the art-direction goal.
- Do not apply or modify the BroMetal patches in `scripts/patch-brometal.mjs`.
- Do not re-UV any kit in Blender. Triplanar makes it unnecessary and hand-UV work does not survive
  an asset refresh.
- Do not download new assets, evaluate new kits, or add new catalog entries. This goal restores what
  is already owned.
- Do not change simulation, input, encounter or presentation code.
- Do not delete the scar-tissue knobs — they are gated on the colour fix, which this goal does not
  complete.

## Engineering constraints

- `packages/demos/antiky/antiky-town` is **in scope**, on the owner's instruction. Its pipeline is
  different in kind, not merely behind: no GLB scripts, atlas-and-sprite art, colour already
  encoded on output. Say that plainly in the handoff rather than reporting a low change count as
  though the demo were skipped.
- Demos hand-roll rendering per demo until the `BroMetalRenderDriver` exists. **Do not extract a
  shared render package.** The shared thing this goal creates is an asset-script fidelity policy,
  which is build-time tooling, not a render abstraction. The sRGB decode helper is written once per
  demo, four times total, and that is correct.
- Tests are required for every code change. When fixing a reported bug, write the regression test
  first, watch it fail against current code, then fix.
- Commit incrementally with short one-line messages. No coauthor tags. Regenerated GLBs and textures
  are large — commit them separately from source changes so the source diff stays reviewable.
- Capture PNGs are **not** committed. `.antiky/` is gitignored and `*.png` is LFS here. The
  committed artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes. Note that `assets/antiky-assets.json`,
  `src/asset-catalog.ts` and `tests/assets.test.ts` in `traversal-study` are already dirty in the
  worktree; read them before editing and do not revert that work.
- Every visual change ends with a fresh capture that is actually looked at.

## Completion definition

The goal is complete when all eight required outcomes are landed, the UV, normal-map, texture-size,
filtering, sRGB, convergence and atlas-bleed tests all pass, each demo's asset receipts still
validate with correct hashes, `npm test` is green, and one post-change `visual-metrics.json` sidecar
per affected demo is committed.

If a source asset genuinely cannot satisfy a criterion — a Quaternius model whose upstream texture
really is a palette strip, for example — report that with the measured evidence and leave the
criterion failing. Do not lower the threshold, and do not substitute a generated texture for a
missing one.
