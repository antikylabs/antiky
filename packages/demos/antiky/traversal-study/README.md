# Gale Post / Skyline Relay

Gale Post is a finite coastal-courier vertical slice built with Antiky Framework and rendered with
BroMetal. Carry the vermilion parcel from the post yard, through a fast sequence of spike hops and
three moving wind lifts, and up the relay-tower approach before the storm arrives. The rebuilt
course delivers its first jump in about one active second, then alternates rises, drops, narrow
landings, moving supports, seal risk, and checkpoint payoffs. A deterministic full-speed manual
trace delivers in about 28.07 seconds, 35%-strength cruise steering in about 32.55, and the attract
trace in about 38.30. The finite layout has three acts, two reached checkpoints after dispatch, seventeen
platforms, six visible spike hazards, one collectible golden courier seal, and a terminal gate.

## Play

From the repository root:

```sh
npm run antiky -- dev --open --project packages/demos/antiky/traversal-study/traversal-study.antiky
```

Antiky opens `http://127.0.0.1:3010/`. Omit `--open` for agent/headless work and open that URL
manually if needed. Run only one manifest-port demo at a time; press `Ctrl-C` before starting
another.

Focus the game canvas, then use:

- `A` / `D` or left / right arrows to steer. Full input runs fastest; lighter analog input cruises.
- `W`, up arrow, click, or tap to jump. The accepted fixed step responds immediately, with a
  0.12-second coyote window and a 0.14-second jump buffer. Release a held key early for a shorter
  hop; hold it through ascent for the full arc.
- `S` or down arrow to brake.
- After delivery or failure, release held controls and make a fresh direction or jump action to
  retry immediately. Holding a movement key through the terminal step preserves the result.

The parcel begins with three seals. Touching spikes or falling costs one seal and resets the courier
at the latest flag with a 0.32-second recovery guard. Each authored spike patch can debit only once
per attempt, so held movement after a checkpoint reset cannot chain-drain the parcel on the same
teaching hazard; distinct hazards and falls still carry their normal cost. Losing the third seal
fails the attempt.
The storm clock starts when a manual or demo run begins and fails the attempt after 48 seconds. The
golden seal in act two is collectible and restores one missing parcel seal. Reach the relay gate at
the tower to deliver. Compact geometry drawn inside the canvas encodes course progress and storm
time as two short corner bars and shows the three
parcel seals as parcel-shaped blocks. Exact timer, mode, and outcome values are available through
Framework inspection; the canvas does not pretend its color accents are textual labels.

## Manual and attract control

The simulation starts in an explicit idle mode. After 1.5 seconds without player input,
[`attract-controller.ts`](src/attract-controller.ts) supplies a deterministic showcase trace. It is
not hidden auto-jump behavior: the controller is a separate, clearly named input source, and the
simulation records the transition as `traversal.mode-change`. The canonical trace collects the seal,
reaches both checkpoints, and delivers in about 38.30 active seconds with zero falls.

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
PNG images, draws the authored Quaternius courier, animates flags and coins, leads and widens the camera with
speed, anticipates vertical motion, snaps on resets, and renders contact shadows, wind, speed dust,
land/jump/checkpoint/collection/failure/retry/delivery pulses, and the geometry gauges. The composed
environment in [`environment.ts`](src/environment.ts) layers compact, cool-graded Quaternius clouds,
rock headlands, coastal trees, and the destination tower at four explicit depths, with a smaller
Kenney tree motif tying the route foreground into the shore. Background cliffs are projection-capped
so they frame rather than cover the playable route; cloud geometry is flattened and light-graded to
read as daylight cloud banks. There are no flat sea/city/cloud panels or decorative atmosphere bars.
It cannot decide
collisions, damage, timers, collection, checkpoints, success, or failure. Renderer measurements
are derived from actual batch capacities, programs, and upload arrays rather than duplicated
constants.

## Catalog assets and provenance

The gameplay route uses catalog ID `kenney:platformer-kit`, the Kenney Platformer Kit official
source (<https://kenney.nl/assets/platformer-kit>), under CC0 1.0. Its verified archive SHA-256 is
`899605d237367688c6b42e41fff2206c0fb8d626163158294556353f7baa7c1b`. Intake preserved meshes,
materials, UVs, and material-to-texture mappings while embedding the archive's `colormap.png`
(SHA-256 `439dfcac935cfd75dc16f28333a4c8284fffcc4b24f857c61cfb4c8a964a15bd`) in each GLB so the files
are self-contained.

The character and coastal presentation use one coherent catalog family,
`quaternius:ultimateplatformer`, from the official
[Ultimate Platformer Pack](https://quaternius.com/packs/ultimateplatformer.html) and its
[publisher-hosted source folder](https://drive.google.com/drive/folders/1NDZn_aGnn0vfFV3M22Y8GPcDjO8BVcLs?usp=sharing),
also under CC0 1.0. The exact selected source files are Character, Cloud_2, Cloud_3,
RockPlatforms_Large, Tree, Tower, and the publisher's license. The publisher's complete 17 MB
itch.io archive (upload `4975456`) was verified at SHA-256
`2d0cac0f3cb58f6845f779a4c6b4a92be6fa27d118ee0b976ead55c6834a53d4`. Intake also records a
deterministic archive of that exact seven-file selection at SHA-256
`a3735d04295a40cf2d24fdc297cd7032e37407934c35fb7388d3ce098ea40aea`.
[`scripts/build-quaternius-selection.mjs`](scripts/build-quaternius-selection.mjs) is the executable
recipe: it sorts the seven exact publisher files by bytewise name, stores them without compression,
and writes fixed 1980-01-01 ZIP timestamps. Run
`node scripts/build-quaternius-selection.mjs SOURCE_DIRECTORY OUTPUT.zip` from this package after
retrieving the files whose official URLs and original hashes are recorded in the manifest.
[`scripts/normalize-quaternius.mjs`](scripts/normalize-quaternius.mjs) applies source node transforms,
merges color-material primitives into a single embedded-PNG palette primitive, and emits one
indexed BroMetal-safe draw per file. The courier additionally bakes the source rig's `Run`
animation at 0.18 seconds; the source's 18 animations are provenance, not runtime animation clips.
Exact official file URLs, original and derived hashes, transformation history, parser counts,
bounds, and copied licenses for both catalogs are in
[`assets/antiky-assets.json`](assets/antiky-assets.json).

The production renderer actually loads and draws all thirteen normalized files:

| File | Use in the course |
| --- | --- |
| `block-grass-large.glb` | Readable route platforms |
| `block-grass-overhang-long.glb` | Route ledges and overhangs |
| `block-moving.glb` | The three animated wind lifts |
| `flag.glb` | Dispatch, checkpoint, and relay-tower flags with wind sway |
| `coin-gold.glb` | Spinning/bobbing courier seal and delivered seal marker |
| `trap-spikes.glb` | All six parcel-damage hazards |
| `tree.glb` | Repeated near-shore depth landmarks |
| `courier.glb` | Authored humanoid courier silhouette, baked in a running pose |
| `cloud-small.glb`, `cloud-large.glb` | Layered far-sky cloud forms |
| `coastal-cliff.glb` | Repeated middle and far rock headlands/sea-depth forms |
| `coastal-tree.glb` | Near-shore vertical landmarks |
| `relay-tower.glb` | Act-three destination landmark behind the delivery gate |

BroMetal `loadGlb` parses the geometry and embedded images; `createImageBitmap` plus BroMetal
`createTexture` uploads each embedded image. Vite ships every GLB as a separate, non-inlined
`dist/assets` file. Tests verify both catalog manifests and licenses, hashes, parsing, embedded
image/material references, one-draw Quaternius normalization, and production emission.

## Build and test

From the repository root:

```sh
npm run build --workspace @antiky/demo-traversal-study
npm test --workspace @antiky/demo-traversal-study
npm run typecheck --workspace @antiky/demo-traversal-study
```

`npm test` compiles production shaders, builds the game, verifies shipped assets, and runs the
response-budget, jump-window, canonical/manual trace, course, camera, environment-composition,
asset, measurement, input-session, and inspection suites. Those deterministic gates do not replace
gameplay-speed canvas review; the running presentation still needs independent visual judgment.

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
