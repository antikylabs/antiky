# Starbreaker Circuit

Starbreaker Circuit is a finite top-down space-combat vertical slice built with Antiky Framework
and rendered with BroMetal. Pilot the cyan Starbreaker through three authored circuit rounds, let
its auto-cannon paint targets, then spend drive on blade dashes that cut through marked hostiles and
turn incoming bolts back into the formation. The cannon marks and briefly staggers; it can never
finish a target by itself.

## Play

From the repository root:

```sh
npm run antiky -- dev --project packages/demos/antiky/combat-arena/combat-arena.antiky
```

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
fixed-step rules while the demo-local encounter, AI, projectile, pool, and digest modules own their
cohesive parts. Together they own input, thrust, marks, stagger, drive, swept blade collision,
invulnerability, deflection, damage, enemy telegraph/attack/recovery, rounds, outcomes, retry,
events, and digest. [`inspection.ts`](src/inspection.ts) publishes semantic copies of phase, round,
hull, drive, combo, roles/states, damage, pools, and bounded deterministic simulation-fact history.

BroMetal is presentation only. [`arena-assets.ts`](src/arena-assets.ts) loads the catalog GLBs and
embedded PNG images; [`renderer.ts`](src/renderer.ts) projects snapshots into instanced meshes,
packs live particles into the active prefix of its upload buffer, draws grounding shadows and
diegetic geometry signals/gauges, and applies bounded impact plus velocity/aim camera lead. It
cannot decide hits, damage, deflection, resources, enemy intent, outcomes, or retry. Renderer
measurements are derived from the actual capacities and catalog model set.

## Catalog assets and provenance

The production renderer loads and draws all five normalized catalog files. BroMetal `loadGlb`
parses each model, `createImageBitmap` decodes its embedded PNG, and BroMetal `createTexture`
uploads it. Vite emits every GLB as a separate, non-inlined `dist/assets` file.

| Catalog/source | File | Runtime use |
| --- | --- | --- |
| `kenney:modular-space-kit` | `room-small.glb` | Dark neutral station shell and arena walls |
| `kenney:modular-space-kit` | `template-floor-layer.glb` | Nine authored circuit-floor panels |
| `kenney:modular-space-kit` | `cables.glb` | Eight perimeter cable clusters that ground the room |
| `kenney:blaster-kit` | `target-detail.glb` | Repeated enemy role silhouettes, scaled by role/Warden status |
| `kenney:blaster-kit` | `grenade-a.glb` | Perimeter props and gunner/anchor/Warden weapon silhouettes |

Both kits are by Kenney under CC0 1.0. The verified Modular Space Kit archive SHA-256 is
`f394f7fd9eaf29c9de7e090e55b69926f699841af33b0b116f5cc0088de8a4dc`; the verified Blaster Kit
archive SHA-256 is `91e3093e95427d59625e7e2ce2d0399b861600160fd0b4ada7714796b67cea8c`. Intake preserved the
archive geometry, UVs, materials, and texture mappings while embedding each kit's `colormap.png` so
the selected GLBs are self-contained. Official URLs, original and derived file hashes, image
hashes, parser counts, bounds, normalization notes, and copied license paths are recorded in
[`assets/antiky-assets.json`](assets/antiky-assets.json).

## Build and test

From the repository root:

```sh
npm run build --workspace @antiky/demo-combat-arena
npm test --workspace @antiky/demo-combat-arena
npm run typecheck --workspace @antiky/demo-combat-arena
```

`npm test` compiles the production shaders, builds the game, verifies every selected GLB parses
with its embedded image, verifies all five GLBs ship separately, and runs deterministic simulation,
inspection, camera, renderer-measurement, risk, dash, deflection, victory, defeat, retry, and digest
tests. The canonical test traces prove that 40 seconds of idle input loses with a score of zero and
that a deterministic marked-target trace clears round one with hull remaining. Session-boundary
regressions prove that a click arriving on a 120 Hz render frame with zero fixed steps is latched,
consumed by at most one completed fixed step, and cannot skip clear through victory during catch-up.
Retry and the next combat action require release followed by a fresh press.

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
