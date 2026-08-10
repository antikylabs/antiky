# Starbreaker Circuit

Starbreaker Circuit is a finite top-down space-combat vertical slice built with Antiky Framework
and rendered with BroMetal. Pilot the cyan Starbreaker through three authored circuit rounds, let
its auto-cannon paint targets, then spend drive on blade dashes that cut through marked hostiles and
turn incoming bolts back into the formation. The cannon marks and briefly staggers; it can never
finish a target by itself.

## Play

From the repository root:

```sh
npm run antiky -- dev --open --project packages/demos/antiky/combat-arena/combat-arena.antiky
```

Antiky opens `http://127.0.0.1:3010/`. Omit `--open` for agent/headless work and open that URL
manually if needed. Run only one manifest-port demo at a time; press `Ctrl-C` before starting
another.

Focus the game canvas, then use:

- `WASD` or the arrow keys to thrust.
- Click or tap toward a target to spend 32 drive on a swept blade dash. The complete swept path is
  dangerous, not only the endpoint.
- Dash through a cyan-marked enemy to restore drive and build the chain. Dashing also grants a
  short invulnerability window and deflects hostile bolts touched by the blade.
- Click or tap after victory or defeat to retry from the intro with three hull and full drive.

Warm rings and lines are danger telegraphs. White is contact/confirmation; cyan is the player,
drive, and cannon mark. Enemy recovery is deliberately dimmer than telegraph and attack. During
the intro and the untouched opening, two floor diagrams show a short cannon pulse marking a target
and a long blade arrow crossing the marked target. Victory shows a cyan/white clear chevron;
defeat shows a warm broken-hull cross. Both results add a white circular retry arrow. Geometry also
shows three hull blocks on the back-left rail, ten drive segments on the back-right rail, three
round pips in the center, and the Warden hull bar during the finale.

An idle pilot loses: rushers charge, gunners fire aimed bolts, shield-anchors fire spreads, and the
Warden alternates charge and volley patterns. Three unguarded contacts exhaust the hull. Clear the
two-rusher opening, the mixed rusher/gunner/shield-anchor round, and the Circuit Warden finale to
win. Each round has explicit combat and clear states; the attempt also has intro, victory, and
defeat states.

## Architecture boundary

Antiky is authoritative. [`combat-state.ts`](src/combat-state.ts) defines the bounded pools, stable
combat state, roles, and authored round roster. [`simulation.ts`](src/simulation.ts) coordinates the
fixed-step rules while the demo-local encounter, AI, projectile, pool, hull-contract, and digest modules own their
cohesive parts. Together they own input, thrust, marks, stagger, drive, swept blade collision,
invulnerability, deflection, damage, enemy telegraph/attack/recovery, rounds, outcomes, retry,
events, and digest. [`inspection.ts`](src/inspection.ts) publishes semantic copies of phase, round,
hull, drive, combo, roles/states, damage, pools, and bounded deterministic simulation-fact history.
[`scripts/intake-quaternius-ships.mjs`](scripts/intake-quaternius-ships.mjs) parses every normalized
ship vertex through BroMetal and generates [`ship-footprints.gen.ts`](src/ship-footprints.gen.ts).
For each runtime X/Z scale, it records the scaled span and maximum
`hypot(position.x * scale.x, position.z * scale.z)`, including off-center pivots and diagonal
vertices. [`combat-hulls.ts`](src/combat-hulls.ts) consumes those generated radial footprints for
authoritative blade, projectile, and charge collision. The shipped/runtime-scaled farthest XZ
radii are 1.338 for the rusher, 1.387 for the gunner, 1.751 for the shield-anchor, 3.118 for the
Warden, and 1.001 for the player. Projectile contact uses the enemy radial footprint; the blade
adds a 0.16 edge allowance; charge contact adds the player's intentionally smaller 0.46 damage
core rather than making the complete rendered player rectangle vulnerable.

BroMetal is presentation only. [`arena-assets.ts`](src/arena-assets.ts) loads the textured station
GLBs and their embedded PNG images; [`ship-assets.ts`](src/ship-assets.ts) loads five normalized
Quaternius Ultimate Spaceships GLBs and samples each ship's selected authored color texture in one
draw per hull type. [`renderer.ts`](src/renderer.ts) coordinates those resources while
[`combat-projection.ts`](src/combat-projection.ts) packs live particles into the active prefix of a
bounded upload buffer, draws grounding shadows and diegetic geometry signals/gauges, and applies
the presentation hierarchy. A one-draw procedural layer behind the carrier adds restrained stars,
nebular depth, and a planet limb without adding another asset family. BroMetal cannot decide hits,
damage, deflection, resources, enemy intent, outcomes, or retry. Renderer measurements are derived
from actual capacities: 14 draws, 384 maximum instances, and 15,864 bytes of dynamic instance
upload per frame. Steady rendering
reuses its camera frame/vectors, cached role profiles, direct numeric instance writers, and a fixed
draw callback; it does not sort threats or create per-instance tuple arrays. Resource construction
is transactional at the renderer, arena-catalog, ship-fleet, backdrop, and projection layers,
including bitmap/texture/program handoffs and post-program attribute/index setup. The ship shader
uploads reciprocal per-axis scale and applies rotation after that inverse scale, the
inverse-transpose-equivalent normal transform for these diagonal-scale-plus-yaw model transforms.
The Quaternius materials all author `doubleSided: true`, so this renderer disables back-face culling
instead of silently dropping authored faces.

## Catalog assets and provenance

The production renderer loads and draws ten catalog GLBs. BroMetal `loadGlb` parses every model,
and all ten files use self-contained embedded PNG textures. The five primary combatants are one
coherent Quaternius Ultimate Spaceships family; Blaster Kit targets and grenades remain secondary
station displays, emitters, and hardpoints rather than character bodies. Every ship retains its own
authored material/texture identity instead of assuming a universal primitive order. Vite emits
every GLB as a separate, non-inlined `dist/assets` file.

| Catalog/source | File | Runtime use |
| --- | --- | --- |
| `kenney:modular-space-kit` | `room-small.glb` | Dark neutral station shell and arena walls |
| `kenney:modular-space-kit` | `template-floor-layer.glb` | Twenty-five carrier-deck panels and scale grid |
| `kenney:modular-space-kit` | `cables.glb` | Repeated perimeter cable conduits and approach-lane bundles |
| `quaternius:ultimatespaceships` | `spitfire-blue.glb` | Blue Starbreaker player hull |
| `quaternius:ultimatespaceships` | `striker-red.glb` | Narrow, forward-heavy rusher hull |
| `quaternius:ultimatespaceships` | `omen-orange.glb` | Broad orange gunner hull |
| `quaternius:ultimatespaceships` | `imperial-red.glb` | Heavy shield-anchor hull |
| `quaternius:ultimatespaceships` | `executioner-red.glb` | Enlarged Circuit Warden command hull |
| `kenney:blaster-kit` | `target-detail.glb` | Station targeting displays plus anchor/Warden shield emitters |
| `kenney:blaster-kit` | `grenade-a.glb` | Perimeter turrets plus gunner/anchor/Warden weapon hardpoints |

The two Kenney kits and Quaternius Ultimate Spaceships are CC0 1.0. The verified Modular Space Kit archive SHA-256 is
`f394f7fd9eaf29c9de7e090e55b69926f699841af33b0b116f5cc0088de8a4dc`; the verified Blaster Kit
archive SHA-256 is `91e3093e95427d59625e7e2ce2d0399b861600160fd0b4ada7714796b67cea8c`.
Ultimate Spaceships is delivered as an official Google Drive folder rather than a single archive,
so provenance records the folder URL and exact Drive file ID plus SHA-256 for every selected glTF,
color PNG, and license file. [`scripts/intake-quaternius-ships.mjs`](scripts/intake-quaternius-ships.mjs)
validates those source hashes, preserves geometry/accessors/material and UV mappings, substitutes
the selected official color texture, reproducibly packs each source into a self-contained GLB, and
regenerates the runtime radial-footprint catalog from the normalized output vertices.
Official URLs, original and derived file hashes, parser counts, bounds, normalization notes,
runtime selection, and copied license paths are recorded in
[`assets/antiky-assets.json`](assets/antiky-assets.json).

The tradeoff for authored texture detail is bundle and decoded-memory weight. The five ship GLBs
total exactly 15,375,156 bytes: 15.4 MB in decimal units, or 14.66 MiB. Each embeds one 2048×2048
PNG. Estimated decoded GPU texture storage for five RGBA8 textures with complete mip chains is
about 106.7 MiB, assuming four bytes per texel and a full mip pyramid costing roughly 4/3 of the
base level. That estimate excludes decode staging, upload copies, row alignment, and implementation
bookkeeping, so peak runtime memory can be higher. There is no runtime LOD or compressed texture
path in this vertical slice.

## Build and test

From the repository root:

```sh
npm run build --workspace @antiky/demo-combat-arena
npm test --workspace @antiky/demo-combat-arena
npm run typecheck --workspace @antiky/demo-combat-arena
```

`npm test` compiles the production shaders, builds the game, verifies the five station/prop assets
and all five textured ship hulls parse through BroMetal with embedded images, verifies all ten GLBs ship
separately, and runs deterministic simulation, inspection, camera, renderer-measurement, risk,
dash, deflection, victory, defeat, retry, and digest tests. Fault-injection tests prove that partial
arena, ship, backdrop, projection, and top-level renderer construction rolls back all successfully-created
resources and repeated disposal does not double-destroy them. Allocation regressions prove that the steady camera reuses references without sorting,
role profiles are cached, and digesting succeeds with `JSON.stringify` disabled; digest hashing
writes live fields directly into a reusable four-lane hash state. The canonical test traces prove that 40
seconds of idle input loses with a score of zero, that a deterministic marked-target trace clears
round one with hull remaining, and that the opening trace produces a mark by four seconds, dash by
eight, hostile telegraph by thirteen, round-one clear by eighteen, and the next formation by
twenty-one. Response regressions require 90% cruise speed within 116.7 ms, decay to 20% within 150
ms after release, and a dash position change in its accepted fixed step. Session-boundary
regressions prove that a click arriving on a 120 Hz render frame with zero fixed steps is latched,
consumed by at most one completed fixed step, and cannot skip clear through victory during catch-up.
Retry and the next combat action require release followed by a fresh press.
Asset and cross-contract regressions also verify the exact five-GLB byte total, 2048² texture
dimensions and stated mip estimate, authored two-sided material flags, reciprocal normal-scale
uploads/generated shader layout, geometry-derived radial radii for every ship, and tangent/just-
outside Warden blade, cannon, and charge contacts.

## CLI and MCP inspection workflow

Keep the development command running. In a second repository-root terminal, inspect the complete
development snapshot and the connected Framework views:

```sh
npm run antiky -- inspect --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool get_dev_status --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool get_session_status --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool get_world_inspection --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool get_event_log --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool get_render_stats --project packages/demos/antiky/combat-arena/combat-arena.antiky
```

`get_world_inspection` exposes the Starbreaker, hostile roles/states, hull/drive, round/phase,
damage, projectiles, particles, and render projection. `get_event_log` exposes phase, round start and
clear, cannon mark, dash, dash hit, deflection, enemy/player damage, defeat, retry, and victory
facts, subject to the declared drop-oldest runtime retention.

The Framework event-history schema requires `commandId` and `occurredAt` fields, but combat events
are simulation facts, not commands or wall-clock records. Each event therefore labels itself
`deterministic-simulation`: `commandId` is a deterministic schema identity derived from fact
sequence, and `occurredAt` encodes simulation seconds from the Unix epoch. The event data includes
both mapping explanations plus the exact simulation time and revision; neither field claims real
command or clock provenance.

Pause the fixed-step session, read `session.clock.completedStepCount` from the returned status, and
pass that exact value in place of `42` for one guarded tick:

```sh
npm run antiky -- tool pause_simulation --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool get_session_status --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool step_simulation '{"expectedCompletedStepCount":42}' --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool resume_simulation --project packages/demos/antiky/combat-arena/combat-arena.antiky
```

An accepted step advances and renders exactly one fixed tick. Reusing the stale count returns
`STALE_COMPLETED_STEP` and changes nothing. Discover capture support before requesting private
canvas evidence:

```sh
npm run antiky -- tool get_capture_capabilities --project packages/demos/antiky/combat-arena/combat-arena.antiky
npm run antiky -- tool get_runtime_status --project packages/demos/antiky/combat-arena/combat-arena.antiky
```

`capture_frame` schema 3 can launch Antiky's isolated managed Chromium when
`currentRuntimeInstanceId` is `null`; otherwise fence the exact connected runtime reported by the
current observation. `capture_gameplay_sequence` accepts a three-to-six-second managed-only cadence
window or a bounded pointer/keyboard presentation trace. For this game, move the normalized pointer
toward a marked target and use an explicit primary press, frame wait, and release to record a dash.
The result contains no path or base64 JSON: it returns private opaque still, PNG-master, poster,
manifest, trace, and WebM identities for `get_render_evidence`. The WebM is a review derivative,
the presentation trace is not deterministic semantic replay, and every artifact remains
`private-unreviewed`. See the [MCP capture reference](../../../../docs/user-facing-docs/mcp/tools.md#capture_frame)
for exact request JSON and limits.

An MCP client calls the identical tool names and JSON inputs. While this project runs, connect to
its Streamable HTTP endpoint at `http://127.0.0.1:3011/mcp`.
