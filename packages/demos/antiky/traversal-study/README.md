# Gale Post / Skyline Relay

Gale Post is a finite coastal-courier vertical slice built with Antiky Framework and rendered with
BroMetal. Carry the vermilion parcel from the broad post yard, across the moving wind lifts, and up
the final relay-tower approach before the storm arrives. A clean run is about 51 active seconds;
the authored course has three acts, two reached checkpoints after dispatch, four visible spike
hazards, one collectible golden courier seal, and a terminal delivery gate.

## Play

From the repository root:

```sh
npm run antiky -- dev --project packages/demos/antiky/traversal-study/traversal-study.antiky
```

Focus the game canvas, then use:

- `A` / `D` or left / right arrows to steer. Full input runs fastest; lighter analog input cruises.
- `W`, up arrow, click, or tap to jump. The controller provides a 0.11-second coyote window and a
  0.13-second jump buffer.
- `S` or down arrow to brake.
- After delivery or failure, release held controls and make a fresh direction or jump action to
  retry immediately. Holding a movement key through the terminal step preserves the result.

The parcel begins with three seals. Touching spikes or falling costs one seal and resets the courier
at the latest flag; losing the third seal fails the attempt. The storm clock starts when a manual or
demo run begins and fails the attempt after 64 seconds. The golden seal in act two is collectible
and restores one missing parcel seal. Reach the relay gate at the tower to deliver. Geometry drawn
inside the canvas encodes course progress and storm time as two positioned bars and shows the three
parcel seals as parcel-shaped blocks. Exact timer, mode, and outcome values are available through
Framework inspection; the canvas does not pretend its color accents are textual labels.

## Manual and attract control

The simulation starts in an explicit idle mode. After 2.5 seconds without player input,
[`attract-controller.ts`](src/attract-controller.ts) supplies a deterministic showcase trace. It is
not hidden auto-jump behavior: the controller is a separate, clearly named input source, and the
simulation records the transition as `traversal.mode-change`. The canonical trace collects the seal,
reaches both checkpoints, and delivers in about 50.58 active seconds with zero falls.

Any player action immediately and permanently takes manual authority for that attempt. Manual mode
never calls the attract controller and never jumps on its own. Releasing the controls slows to a
stop; missing a jump therefore has a clear authored fall/checkpoint cost. A completed attract run
waits at the delivery state until a released, fresh player action starts a manual retry. One-frame
clicks are latched until a Framework fixed step consumes them, so high-refresh zero-step frames do
not discard jumps or retries.

## Architecture boundary

Antiky is authoritative. [`simulation.ts`](src/simulation.ts) owns fixed-step input authority,
movement, coyote time, jump buffering, platform support, hazards, checkpoints, parcel seals, the
storm timer, collection, outcome, retry, events, and digest. [`course.ts`](src/course.ts) is the one
finite authored layout. [`inspection.ts`](src/inspection.ts) publishes semantic copies of that state
and bounded accepted facts through Framework inspection.

BroMetal is presentation only. [`renderer.ts`](src/renderer.ts) loads catalog GLBs and their embedded
PNG images, draws the courier diorama, animates flags and coins, eases the speed/vertical camera,
snaps it on resets, and renders contact shadows, wind, dust, checkpoint/delivery effects, and the
geometry gauges. It cannot decide collisions, damage, timers, collection, checkpoints, success, or
failure. Renderer measurements are derived from the actual batch capacities, programs, and upload
arrays rather than duplicated constants.

## Catalog assets and provenance

Every model comes from catalog ID `kenney:platformer-kit`, the Kenney Platformer Kit official
source (<https://kenney.nl/assets/platformer-kit>), under CC0 1.0. The verified archive SHA-256 is
`899605d237367688c6b42e41fff2206c0fb8d626163158294556353f7baa7c1b`. Intake preserved meshes,
materials, UVs, and material-to-texture mappings while embedding the archive's `colormap.png`
(SHA-256 `439dfcac935cfd75dc16f28333a4c8284fffcc4b24f857c61cfb4c8a964a15bd`) in each GLB so the files
are self-contained. Exact original/derived hashes, parser counts, bounds, official URLs, and the
copied license are in [`assets/antiky-assets.json`](assets/antiky-assets.json).

The production renderer actually loads and draws all seven normalized files:

| File | Use in the course |
| --- | --- |
| `block-grass-large.glb` | Broad grass teaching platforms |
| `block-grass-overhang-long.glb` | Overhang silhouettes and tower ledges |
| `block-moving.glb` | The two animated wind lifts |
| `flag.glb` | Dispatch, checkpoint, and relay-tower flags with wind sway |
| `coin-gold.glb` | Spinning/bobbing courier seal and delivered seal marker |
| `trap-spikes.glb` | All four parcel-damage hazards |
| `tree.glb` | Authored coastal depth landmarks |

BroMetal `loadGlb` parses the geometry and embedded images; `createImageBitmap` plus BroMetal
`createTexture` uploads each embedded image. Vite ships every GLB as a separate, non-inlined
`dist/assets` file. Tests verify manifest hashes, parsing, embedded image/material references, and
production emission.

## Build and test

From the repository root:

```sh
npm run build --workspace @antiky/demo-traversal-study
npm test --workspace @antiky/demo-traversal-study
npm run typecheck --workspace @antiky/demo-traversal-study
```

`npm test` compiles production shaders, builds the game, verifies shipped assets, and runs the
simulation, camera, asset, and inspection suites.

## CLI and MCP inspection workflow

Keep the development command running. In a second repository-root terminal, orient to the same
session and inspect the authoritative course, individual platforms/hazards/checkpoints/collectible,
current act/control/checkpoint/seals/storm/progress/outcome, accepted events, and renderer counts:

```sh
npm run antiky -- tool get_dev_status --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool get_session_status --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool get_world_inspection --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool get_event_log --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool get_render_stats --project packages/demos/antiky/traversal-study/traversal-study.antiky
```

Pause the fixed-step session, read `session.clock.completedStepCount` from the returned status, and
pass that exact value in place of `42` for one guarded step. A repeated request with the stale count
changes nothing:

```sh
npm run antiky -- tool pause_simulation --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool get_session_status --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool step_simulation '{"expectedCompletedStepCount":42}' --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool resume_simulation --project packages/demos/antiky/traversal-study/traversal-study.antiky
```

Discover the managed canvas-capture formats and limits before requesting private evidence:

```sh
npm run antiky -- tool get_capture_capabilities --project packages/demos/antiky/traversal-study/traversal-study.antiky
npm run antiky -- tool get_runtime_status --project packages/demos/antiky/traversal-study/traversal-study.antiky
```

`capture_frame` schema 3 can cold-launch Antiky's isolated managed Chromium. Use a three-to-six
second `capture_gameplay_sequence` cadence window to observe attract motion without input. Use a
managed-only presentation trace with explicit `D` and one-frame `W` press/release edges to prove
manual-authority takeover and a jump. Results expose private opaque still, lossless PNG-master,
poster, manifest, trace, and WebM identities for `get_render_evidence`, never a local path or
unbounded base64 JSON. WebM is a review derivative, presentation input is not deterministic semantic
replay, and all canvas evidence remains `private-unreviewed`. See the [MCP capture
reference](../../../../docs/user-facing-docs/mcp/tools.md#capture_frame) for exact request JSON and
limits.

An MCP client calls the identical tool names and JSON inputs. While this project is running, connect
its Streamable HTTP server at `http://127.0.0.1:3011/mcp`.
