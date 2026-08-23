# Demo refining objective summary

**Status:** Complete

**Archived:** 2026-08-17

**Final scope:** Four Antiky demos; hybrid Antiky/BroMetal rendering remains valid

**Deferred packet:** [Goal 17 architecture reconciliation](../_deferred/demo-refine-goal-17-adrs/README.md)

**Maintained dependency record:** [BroMetal patch ledger](../../upstream/brometal-patch-ledger.md)

The demo refining objective began as a visual-quality audit of the Antiky, BroMetal, and Three.js
demo catalog. It ended as a much larger correction of the systems used to build, render, measure,
inspect, and publish Antiky demos.

The delivered result is not that every proposed visual target passed. The delivered result is that
four Antiky demos now have a real rendering stack, measured art direction, deterministic inspection
evidence, and tests that distinguish a working feature from a plausible claim. The owner accepted
the remaining visual misses as explicit technical debt and removed standalone renderer showcases
from the product scope.

The completed 20,000-line working folder was removed during archive commit `772f0a8`. Its goal
contracts, progress records, captures, audits, and per-goal summaries remain recoverable from Git
history. This document is the durable account of what shipped, what was disproved, what remains
accepted debt, and what should trigger future work.

## Executive outcome

- The packaged and public catalog now contains only Antiky Town, Combat Arena, Point Light Expo,
  and Traversal Study.
- The remaining standalone BroMetal demos - Luminous Reef, Shader Study, and Solar Forge - and the
  Three.js demos Glass Garden and Orbital Atlas were deleted. The earlier Town Study duplicate was
  also retired.
- Antiky demos may remain hybrid Antiky/BroMetal projects. This objective did not require every
  game to migrate through one Framework renderer.
- All four demos now use a linear-light rendering path with HDR scene rendering, one display-space
  tone-map boundary, directional lighting, shadows, material response, bloom, grading, and
  vignette where the demo requires them.
- Antiky Town and Point Light Expo render through the Framework's BroMetal-specific render driver.
  Combat Arena and Traversal Study retain game-owned BroMetal rendering.
- Asset conversion now preserves real material information and tests the delivered bytes rather
  than inferring fidelity from conversion-script text.
- The repository has deterministic exact-step capture, semantic visual fixtures, sealed evidence,
  pixel metrics, motion metrics, shader and material invariants, and a declared real-GPU test tier.
- BroMetal is pinned at 0.18.0. Nine local patches remain because clean-package behavior checks
  prove the published release still lacks those capabilities.
- The full repository test and typecheck gates were green at closeout. The remaining visual misses
  are stored as `pass` or `fail` data in the four sidecars instead of being hidden by weakened
  thresholds.

## Why the objective existed

The original demo commission aimed at stylized reference bars: League of Legends for the lighting
expo, Rocket League for the arena, and LittleBigPlanet for the platformer. The shipped demos were
well short of those references.

The initial audit found structural rendering faults, not merely weak assets:

- no complete linear-to-display color boundary;
- no shared HDR scene target or single post-processing boundary;
- almost no useful directional modelling across surfaces;
- no dependable shadow or ambient-occlusion evidence;
- normal, roughness, and texture information lost or ignored in parts of the asset path;
- per-material tone mapping, wash controls, fake emission, and duplicated light constants hiding
  missing pipeline capabilities;
- visual checks that could pass without observing the feature they named;
- animated capture with no exact simulation identity;
- camera motion that satisfied synthetic tests and still made the owner nauseous; and
- a public catalog that mixed Antiky projects with framework-free renderer showcases.

Antiky Town entered scope after the initial audit. It received the same measurement and rendering
review plus specific foliage, water, atlas, shadow, and depth-of-field work.

## Scope and owner decisions

The following decisions changed the direction of the objective and are part of its final meaning:

1. **Antiky-only demo catalog.** Standalone renderer showcases no longer justify their package,
   website, capture, and verification complexity.
2. **Hybrid rendering is valid.** Antiky demos can use Framework services while still owning direct
   BroMetal code. Migration is earned by a game need, not required as a cleanup pass.
3. **Measured misses can remain debt.** A failed visual criterion can be accepted without changing
   the threshold or marking the measurement as passing.
4. **Owner-visible quality wins over a flattering number.** The Town foliage sun, Town tilt-shift,
   and Combat camera work each demonstrated that a metric can improve while the picture or
   experience gets worse.
5. **Reactive Combat camera motion stays off.** A single reversible strength constant disables
   shake, velocity lead, aim swing, threat lurch, and dash push-in. Any value above zero requires
   another owner review.
6. **Town Study stays retired.** Antiky Town is the maintained 2.3D town project; the duplicate
   framework-free package and its drift guard were deleted.
7. **Upstream BroMetal publication is deferred.** Existing open pull requests remain as recorded,
   but Goal 16 opened no new pull requests and did not retire a patch on merge status alone.
8. **Architecture reconciliation is accepted debt.** Goal 17 was moved out of the objective with
   its evidence and restart conditions intact. Current accepted ADRs remain authoritative.

## Goal-by-goal delivery record

The goal numbers describe the work breakdown, not strict wall-clock order.

| Goal | Durable result |
| --- | --- |
| 00 | Accepted Framework ADR 0021, superseded ADR 0006, clarified Studio ADR 0007, and established Framework ownership of a BroMetal-specific render driver without a general backend abstraction. |
| 01 | Built the capture and visual-budget loop, repaired the root test chain, separated regression tests from visual target tracking, and replaced the invalid luminance-spread headline with local contrast. |
| 02 | Added BroMetal render-target filtering and offscreen multisampling patches, upgraded the dependency from 0.15.0 to 0.17.2, split the patch runner by contribution, and established guarded, idempotent local patching. |
| 03 | Completed the render sweep: camera near-plane budgets, unified per-demo sun and fog values, back-face culling, contact shadows, render interpolation, dead-code removal, and a measured Combat camera correction that ultimately disabled reactive motion. |
| 04 | Corrected the asset-fidelity model, preserved real textures and UVs where they exist, added normal-map and texture-class handling, enforced sRGB decoding, fixed a missing instance upload, and disproved the claim that flat Quaternius assets had lost textures. |
| 05 | Added real material vocabulary: detail normals, textured contact shadows, rim and wrapped diffuse, HDRI-derived SH-9 ambient, a toon ramp, catalog PBR materials, Kenney material identity, billboard VFX, impact timing, and a Town material record. |
| 06-01 | Finished Point Light Expo's color boundary with the piecewise sRGB encode and deleted the wash controls that had compensated for the missing transfer function. |
| 06-02 | Moved Point Light Expo into one multisampled RGBA16F scene target with one post tone-map and preserved its display-space onboarding overlay. |
| 06-03 | Replaced incomplete and clamped specular terms with an energy-tested GGX model and proved that the old scene had too little direct light for the BRDF change to be visible by itself. |
| 06-04 | Added one sun and a shadow map, measured ground darkening, acne, peter-panning, and bounded frame cost, and found BroMetal's OpenGL-style perspective depth error. |
| 06-05 | Kept the directional SH-9 ambient, stopped ambient occlusion from dimming direct light, and built a deterministic vertex-occlusion baker that was correctly left unwired for convex rocks with only a small measured effect. |
| 06-06 | Added pre-tone-map bloom, color grading, vignette, and removed fake self-illumination. Point Light Expo's visual budget became green on every bound. |
| 07 | Carried the render slice to Combat Arena, Traversal Study, and Antiky Town; preserved Town's superior existing shadow design; and recorded the criteria that could not honestly pass under the current framing. |
| 08 | Wrote and implemented per-demo art direction, including the arena night presentation, relay-light presentation, Traversal coastline and emissives, and Town grass, trees, water, penumbra, depth of field, and vignette. |
| 09 | Removed dead presentation knobs and duplicated concepts, consolidated course and palette data, reduced oversized modules, fixed Town bridge placement and a floating prop, and deleted uncollected source-text tests. |
| 10 | Repaired the old mixed-catalog presentation, mobile activation, posters, Three.js resize behavior, and two shader-study effects. Most of this product surface was later deleted by the Antiky-only scope decision. |
| 11 | Promoted disposal, seeded randomness, latched actions, bounded events, the game contract, and session frame driving into the Framework. Retiring Town Study removed the largest duplicate-code question. |
| 12 | Extracted `BroMetalRenderDriver`, migrated Point Light Expo and Antiky Town, added target filtering and dynamic geometry to its frame contract, and proved the same frame data can be consumed by a non-BroMetal test driver. |
| 13 | Added GPU-free motion statistics, deterministic Combat camera regressions, per-frame capture cadence metadata, and pixel-sequence Temporal Information. |
| 14 | Added one deterministic atlas builder with padded and per-layer outputs, rebuilt three Town atlases with measured gutters, and reduced measured cross-tile bleed to zero. |
| 15 | Added BroMetal LOD clamps and end-to-end 2D array texture support, migrated Town's material atlas to twelve layers, and proved upload, layer selection, and per-layer mips on a real GPU. |
| 16 | Updated every current consumer to BroMetal 0.18.0, proved all seven prior patches still necessary, added WebGPU perspective and target-readback patches, repaired whole-package idempotence, and established the declared GPU tier. |
| 17 | Deferred the architecture-reconciliation pass as acceptable debt. It made no code or ADR change and remains a separate restart packet. |
| 18 | Added an ordered observer for every completed engine step, committed observer-visible identity before callback execution, bounded observer faults, and isolated accepted input through a fresh frozen data-only graph. |
| 19 | Deleted standalone renderer demos, fixed Antiky-only discovery and material verification, added game-owned semantic capture fixtures, made capture exact-step and deterministic, and resealed four durable sidecars. |
| 99 | Closed every old revisit-register identifier as resolved, withdrawn, deferred, or routed. It stopped the historical audit tables from acting as an unbounded backlog. |

## Measurement and inspection system

The objective built a measurement system in layers rather than treating a screenshot as proof.

### Frame measurement

`scripts/frame-stats.mjs` measures delivered display bytes. The maintained metrics include:

- CIE L* local contrast over bounded tiles;
- Rec.709 luminance percentiles and clipped fractions;
- luminance-weighted saturation;
- hard-edge fraction for within-demo comparison;
- named region probes;
- hue clusters and dominant-cluster share;
- changed-pixel and registered control-pair differences; and
- sequence Temporal Information for pixel motion.

The original `luminanceSpread = p95 - p05` headline was withdrawn. Across ten captures it
correlated with p95 at 0.990 and therefore rewarded brightness more than modelled form. A half-black,
half-flat-grey image scored well while a low-key modelled frame scored poorly. Local contrast
replaced it.

### Motion measurement

`scripts/motion-stats.mjs` evaluates camera and simulation paths without a browser or GPU. It
measures translation, look-at motion, periodicity, spectral concentration, and event-relative
impulses. Pixel sequences remain useful for rendering-only motion, but simulation data is the
authoritative source for camera behavior.

The Combat regression originally measured a 0.697 repeat correlation at 1.750 seconds, a look-at
snap of 0.4046 units in one frame, and routine cannon motion at 52% of the hull-loss peak. The
trauma model and camera smoothing reduced the measured defects, but owner review still rejected the
experience. Reactive camera strength is therefore zero.

### Exact-step capture

`scripts/shoot-demos.mjs` now:

1. launches the CLI entry directly in a process group;
2. starts the managed browser with one bootstrap capture;
3. pauses the engine session;
4. advances to an exact completed simulation step;
5. applies only game-declared semantic fixtures;
6. fences the capture by development session, accepted build, runtime, engine session,
   completed-step count, state digest, dimensions, and source digest;
7. computes metrics and control-pair evidence; and
8. writes a sealed sidecar.

Publication time and event sequence are not part of stable simulation identity. Repeated captures
of every baseline compared 921,600 pixels and recorded zero mean, p99, and maximum luminance drift.

Raw PNGs are temporary review material and remain outside the repository. The committed
`visual-metrics.json` files retain source identity, metric inputs, thresholds, results, artifact
hashes, and evidence seals.

### Test posture

`npm test` remains the regression gate. `npm run demos:verify` owns demo discovery, pipeline,
material, shader, inspection, and evidence validity. During the objective, target tests were
allowed to be red while they represented unfinished work. At closeout the command is green because
it verifies that every criterion has valid evidence and an explicit `pass` or `fail` outcome;
it does not relabel failed visual targets as passing.

## Rendering and asset system delivered

The common Antiky rendering shape now has:

- sRGB decode at authored color inputs and a piecewise sRGB encode at the display boundary;
- an RGBA16F scene target with explicit multisampling;
- exposure, grading, one tone map, bloom composition, vignette, and final encode in one post stage;
- full GGX distribution, Smith visibility, and Schlick Fresnel where physically based response is
  wanted;
- directional sun and shadow maps with explicit projection, filtering, bias, and sampling policy;
- directional SH-9 or purpose-built ambient light rather than one flat wash;
- ambient occlusion applied to ambient contribution rather than direct light;
- typed texture classes so palette strips, color textures, and data textures receive appropriate
  filtering, mip, anisotropy, and transfer behavior;
- real material identity from Kenney atlases and catalog materials;
- generated detail normals, billboard sprites, ramps, and atlas products with deterministic tests;
  and
- one-post-tone-map invariants over the exact Antiky demo graph.

The asset work also corrected several false premises. Quaternius' flat platformer models did not
lose missing textures; their authored color is flat material data. Kenney models did contain real
atlas structure. A conversion test must therefore inspect the shipped GLB and texture receipt, not
look for a token in a source script.

## Framework, CLI, and BroMetal capabilities

### Framework

The objective left reusable Framework primitives rather than copies in each demo:

- disposal scopes that release every resource and preserve multiple failures;
- integer-only seeded random streams with label-stable forks and a golden sequence;
- latched actions that cannot retrigger from a held level;
- bounded event recorders with dropped-event accounting;
- a zero-import game contract;
- session frame driving and fault reporting;
- a BroMetal-specific render contract and driver;
- target filtering, static and per-frame geometry, texture keys, and driver-owned resource
  lifetime; and
- `EngineSessionOptions.onCompletedStep`.

The completed-step observer receives the already-committed step identity once after every
successful systems-and-digest cycle. A throwing observer faults the session through
`completed-step-observer` without undoing the completed step or running later catch-up steps.

Accepted input is not merely checked with `Object.isFrozen`. Callables, accessors, unsafe own
properties, and mutable graph shapes are rejected. Valid records and arrays are copied into one
Framework-owned recursively frozen data graph, preserving symbols, non-enumerable data, sparse
arrays, custom array properties, and normal prototypes. This closes mutation through closures,
descriptors, and proxies.

### CLI and capture authority

Games declare semantic scene groups, camera translations, and named visual variants. The CLI
validates and transports those values through its existing development-session authority. A
fixture cannot expose a renderer, browser, process, filesystem path, or arbitrary evaluation
surface. Tests prove that presentation fixtures do not change the simulation digest.

The capture-sequence contract also gained explicit frame cadence. Browser console, page error, and
request-failure logging can be enabled through `ANTIKY_BROWSER_LOG`, which turned otherwise opaque
startup timeouts into actionable runtime faults during the driver migration.

### BroMetal

The maintained version is 0.18.0 across five consumers: the Framework and four Antiky demos. One
deduplicated installed copy is expected.

Nine local contributions remain:

1. render-target filtering;
2. offscreen multisampling;
3. fragment discard;
4. one-frame presentation;
5. attribute-buffer defect fixes;
6. sampler LOD clamps;
7. 2D array texture sampling and per-layer mip generation;
8. WebGPU-correct perspective depth; and
9. bounded render-target pixel readback.

Clean 0.18.0 behavior probes fail for all nine capabilities and patched probes pass. Patch
retirement depends on an installed published release passing the clean behavior check; a merged
pull request alone is not enough.

The old idempotence check hashed only `dist/runtime/webgpu.js`. It missed repeated declaration
insertion in `dist/dsl/builtins.d.ts` where two patches shared one anchor. The runner now uses
independent anchors and hashes the complete `dist/` tree. A second postinstall changes no bytes.

The current audited upstream state and exact upgrade procedure remain in the
[BroMetal patch ledger](../../upstream/brometal-patch-ledger.md).

## Per-demo result

### Antiky Town

Town retained its existing strengths and gained targeted corrections:

- piecewise display encoding and one post boundary;
- its existing orthographic, two-channel, slope-biased shadow design, which measured better than
  the proposed replacement;
- Framework `BroMetalRenderDriver` use across voxel surfaces, sprites, and sprite shadows;
- deterministic clustered grass with slope, pavement, plaza-distance, and near-field controls;
- one species table, grove placement, per-tree wind, and bounded back-scatter;
- GGX water at dielectric F0 0.02, flow-striated color travel, and crest foam;
- Vogel-disk penumbra sampling on seven receivers;
- measured tilt-shift depth of field and vignette;
- padded prop and vegetation atlases plus a twelve-layer material texture array;
- a split between structural macro height and actual object-placement surface, fixing bridge
  placement; and
- correction of a map prop that had been authored over open canal.

Town's art-direction lock passed its value and hue row, but the accepted control evidence still
shows weak translucency, bloom, and shadow response. The owner accepted the current visual result
and the local-contrast floor was re-derived from 8.5 to 7.5 rather than forcing a sharper image over
the approved tilt-shift look.

### Combat Arena

Combat gained:

- a neutral night stadium with red and cyan team ends;
- a low, long-lensed camera;
- GGX hull response and an always-on team rim;
- one sun, directional earthshine, shadow mapping, and a single HDR post path;
- a half-resolution planar deck reflection;
- ruled emissive trim, ribbon trails, impact distortion, bloom, grade, and vignette;
- one palette and generated hull footprint authority;
- deletion of cables and duplicated presentation knobs; and
- camera motion regressions tied to the real simulation.

The art-direction pass reached four hue clusters with a 46% dominant share and a hull
p95-to-median ratio of 3.88. The remaining failures are in controlled VFX falloff, translated-camera
registration, and bloom strength. Shadow and vignette controls pass.

### Point Light Expo

Point Light Expo served as the reference render slice and gained:

- the full linear/HDR/post pipeline;
- energy-tested GGX materials;
- an authored low sun and shadow map;
- directional SH-9 ambient with correct AO placement;
- pre-tone-map bloom, a night grade, and vignette;
- inverse-square relay falloff with bounded core behavior;
- bounce lobes in the floor ambient;
- additive relay rings instead of visibly faceted lit tori;
- a horizon dome and camera-distance fog;
- a redesigned status plate; and
- Framework `BroMetalRenderDriver` ownership.

Its final visual-budget row was green during the reference slice. The exact Goal 19 controls still
show that VFX falloff and translated-camera registration do not meet their stricter evidence
thresholds.

### Traversal Study

Traversal gained:

- the shared linear/HDR/post rendering shape;
- a toon ramp with measured brightness and hue separation;
- a real sky dome, warm horizon band, sea haze, higher camera, and a second coastline rank;
- one course-height query shared by simulation and rendering;
- an additive checkpoint and delivery-glyph batch that can exceed display white before bloom;
- screen-space HUD presentation on a plate;
- re-anchored cliffs with a projected-landmark contract;
- contact shadows, sun and shadow structure, grading, bloom, and vignette; and
- renderer and simulation decomposition below the repository's mandatory threshold.

Its open-horizon framing made median-tile local contrast and the original value row unsuitable:
64.4% of an earlier frame was flat sky. The objective did not invent darkness or weaken the
criterion to make that composition pass. The final exact controls show one passing VFX-falloff
criterion and misses for translated-camera registration, bloom signal, vignette, and shadow.

## Exact accepted visual debt

These failures are accepted debt, not hidden regressions. The durable evidence lives in:

- [Antiky Town sidecar](../../../../packages/demos/antiky/antiky-town/visual-metrics.json)
- [Combat Arena sidecar](../../../../packages/demos/antiky/combat-arena/visual-metrics.json)
- [Point Light Expo sidecar](../../../../packages/demos/antiky/point-light-expo/visual-metrics.json)
- [Traversal Study sidecar](../../../../packages/demos/antiky/traversal-study/visual-metrics.json)

| Demo | Criterion | Outcome | Final measurement |
| --- | --- | --- | --- |
| Town | Tree translucency | Fail | 7.28% of the region changed; on/off luminance ratio 1.005 against 1.4. |
| Town | Bloom | Fail | 9.08% changed; on/off ratio 1.002 against 1.2. |
| Town | Vignette | Pass | Corner attenuation 11.46%, inside the 10–25% band. |
| Town | Shadow | Fail | On/off ratio 0.792 against a maximum of 0.75. |
| Combat | VFX falloff | Fail | Boundary p99 gradient 0.256 per pixel against 0.1. |
| Combat | Translated camera | Fail | Registered p99 difference 0.404 against 0.1 after a known 0.5 m world delta. |
| Combat | Bloom | Fail | On/off ratio 1.187 against 1.2. |
| Combat | Vignette | Pass | Corner attenuation 17.74%, inside the 10–25% band. |
| Combat | Shadow | Pass | On/off ratio 0.662 against a maximum of 0.75. |
| Point Light | VFX falloff | Fail | Boundary p99 gradient 0.617 per pixel against 0.1. |
| Point Light | Translated camera | Fail | Registered p99 difference 0.184 against 0.1 after a known 0.5 m world delta. |
| Traversal | VFX falloff | Pass | Boundary p99 gradient 0.0903 per pixel against 0.1. |
| Traversal | Translated camera | Fail | Registered p99 difference 0.204 against 0.1 after a known 0.5 m world delta. |
| Traversal | Bloom | Fail | No captured signal: zero changed pixels and an on/off ratio of 1.0. |
| Traversal | Vignette | Fail | Corner attenuation 3.80%, below the 10–25% band. |
| Traversal | Shadow | Fail | On/off ratio 0.997 against a maximum of 0.75. |

Reopen a row only when a future Antiky visual-quality objective changes that demo or deliberately
adopts the criterion. Do not restore the retired standalone demo scope to address these rows.

## Major corrections and failures that changed the work

The objective repeatedly found that a plausible test or explanation was wrong. These are the
lessons worth carrying forward:

- **Brightness was not contrast.** Luminance spread rewarded bright flat frames and failed
  modelled low-key frames. Local CIE L* contrast replaced it.
- **A number moving in the preferred direction was not proof.** The yellow Town foliage sun raised
  local contrast while making the trees visibly worse. A linear contrast curve cleared its target
  while clipping 33.5% of Point Light Expo to black.
- **Vary the cause before trusting the instrument.** Halving shadow bias without moving the
  peter-panning measure proved that the first measure observed penumbra and shaded geometry, not
  bias. Turning features off exposed several other invalid probes.
- **A region name did not prove region content.** Camera changes moved shadow, reflection, depth of
  field, and VFX probes onto walls, sky, or unrelated geometry. Control captures and region-content
  inspection became mandatory.
- **Two rendering defects can mask each other.** Point Light Expo's post quad hid its onboarding
  panel while the offscreen target lost multisampling. Removing the hard-edged panel made the
  anti-aliasing metric look better.
- **A captured frame can be stale.** Build failures can leave the last good artifact available.
  Identity fencing and accepted-build checks are required before interpreting a screenshot.
- **A startup timeout can be a caught constructor error.** Browser logging exposed undeclared
  uniforms, string values passed as textures, and dynamic asset URLs resolving to `undefined`.
- **A frozen object can still cross mutable authority.** Callables, accessors, symbol properties,
  custom array properties, and proxies all defeated weaker captured-input checks before canonical
  copying closed the boundary.
- **An idempotence hash can cover the wrong file.** The old BroMetal test passed while declarations
  accumulated elsewhere in `dist/`.
- **An atlas probe can avoid the boundary.** The first bleed measurement inspected boxes that never
  crossed a tile edge and reported a clean result. The corrected measure reached one texel beyond
  the inner rectangle and showed 25.3% contamination before the atlas work.
- **Non-vacuity at one layer is not collection.** Material assertions existed but were outside the
  normal command, and `demoSources(slug)` ignored its argument while scanning an incorrect root.
- **A synthetic camera model can agree with itself.** The camera snap appeared only when real enemy
  priorities changed. Later, even correct motion tests could not decide whether the camera was a
  good experience; the owner's discomfort remained the decisive result.
- **Refresh-capped statistics are bounds.** Final frame-time values - Town 8.303 ms, Combat 8.333 ms,
  Point Light 8.786 ms, Traversal 8.333 ms - are upper bounds near one display interval, not resolved
  GPU costs.
- **Production asset URLs need static discovery.** Dynamic `new URL()` expressions in Combat and
  Traversal built successfully but resolved through an empty Vite map at runtime. Static literal
  URLs and production-bundle tests now cover both.
- **Verification state can be environmental.** A running development server collided with a
  website build; hand-running Vite removed staged manifests; stale Cargo output retained an old
  checkout path; and Node 25 crashed in the Playwright/Chromium launch where mise Node 22.14 worked.

## Durable restart triggers

The old Goal 99 register is closed. These are the remaining useful triggers, not an active backlog.

| Subject | Reopen only when |
| --- | --- |
| Visual-measurement promotion | A second consumer exists, an MCP consumer needs computed metrics, or the measures survive another real target revision. |
| Executable requirement contracts | Visual, motion, and simulation contracts converge on one demonstrably shared shape. |
| Shared sun or fog uniforms | A demo needs to vary them at runtime. |
| Vertex ambient occlusion | A concave asset with a meaningful measured occlusion gap needs it. |
| More motion representations | Simulation-path measures and current pixel Temporal Information leave a named diagnostic gap. |
| Sequence rate above 30 fps | A real pixel-only defect exceeds the approximately 15 Hz observable limit. |
| Stronger evidence seals | The threat model expands beyond accidental edits and stale evidence. |
| Town random-hash replacement | The owner commissions a new meadow layout or art baseline. |
| Town paused or faulted presentation | A Town host-integration goal owns the behavior and selects whether presentation continues. |
| Framework's BroMetal dependency | Framework publication or a headless consumer proves the optional render-driver subpath is insufficient. |
| Town module decomposition | The next functional change owns the large Town renderer or a dedicated cohesion objective begins. |
| Traversal parallax and unused uniforms | A camera or shader goal needs those paths. |
| Atlas layer-list generation | The material layer set changes or a replacement validator exists. |
| BroMetal upstream work | The owner asks to resume contributions or a published release can retire a patch. |
| Goal 17 architecture packet | One of the packet's evidence-authority, provenance, Studio routing, presentation lifetime, or color-boundary triggers occurs. |

## Work deliberately not done

This objective did not:

- build a general replay, scenario, retained-history, subscription, or durable-delivery system;
- expose arbitrary evaluation through capture fixtures;
- claim deterministic pixels across devices or GPU implementations;
- migrate every Antiky demo through the Framework render driver;
- build a renderer-neutral backend abstraction;
- restore or maintain visual targets for the deleted BroMetal and Three.js demos;
- add a general MCP motion-report tool;
- wire the vertex-occlusion bake into convex assets for a roughly 4% deep-crevice effect;
- build Town fountain spray without an owner commission;
- resolve the deferred ADR language and architecture review; or
- open the four unsubmitted BroMetal pull requests.

## Closeout verification

All authoritative final commands used the repository's declared machine toolchain:
`mise exec node@22.14.0 -- …`.

| Check | Final result |
| --- | --- |
| Demo graph and pipeline | Antiky-only discovery, strict nonempty and scope guards, and the combined graph/pipeline surface passed 30/30. |
| Material invariants | Initial exact run was 1 pass / 6 fail; corrected loader and graph produced 5/2; registered final suite passed 7/7. |
| Capture orchestration | `scripts/tests/shoot-demos.test.mjs` passed 19/19. |
| Deterministic capture | Four baselines, 921,600 pixels each; mean, p99, and maximum luminance drift were all zero. |
| Demo verification | `npm run demos:verify` passed 73/73. |
| Demo packages | Town 46 Node tests plus 11 Vitest tests; Combat 78; Point Light 89; Traversal 75. |
| Demo typechecks | All four passed. |
| Framework | Final Goal 19 run passed 173/173, including capture authority and completed-input isolation. |
| Website | Build and publication tests passed 51/51 and exposed only the four Antiky routes. |
| Workspace typecheck | `npm run typecheck` exited 0, including Studio's Rust check. |
| Real GPU | `npm run test:gpu` passed 4/4 for readback, array binding, layer selection, and per-layer mip separation. |
| Repository | `npm test` exited 0: root 112/112, camera 10/10, all workspaces, Studio app 58/58, Tauri JavaScript 25/25, Rust unit 11/11, and native contract 7/7. |
| Anti-slop review | Manual review found no disabled or tautological tests, placeholders, swallowed failures, or unexplained suppressions in the final goal changes. |

The anti-slop structure checker selected a root-only test oracle that does not model this npm
workspace and reported executed tests as uncollected. It also reported imported private capture
modules as orphan scripts. The direct package commands, root allowlist, 19 capture tests, 73 demo
checks, and full repository run contradict those findings. No global structure-clean claim was
made.

## Historical recovery and current authority

Current code, accepted ADRs, maintained user documentation, the four sidecars, and the BroMetal
patch ledger are authoritative.

The removed objective folder remains available in Git immediately before archive commit
`772f0a8`. For example:

```sh
git show 772f0a8^:docs/project-planning/objectives/demo-refining/goals/_completed/summary-goal-19.md
```

Use that history for detailed implementation archaeology, not as an executable backlog. Future
visual work starts as a new dated Antiky objective with current requirements. It should reuse the
measurement, capture, material, and evidence contracts without restoring the old planning folder or
the retired standalone demo families.
