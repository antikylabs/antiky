# Blackout Relay

Blackout Relay is a playable Antiky vertical slice set in a derelict forest reliquary. You pilot a
small prism drone through a chamber patrolled by shades. Restore the amber, rain-glass, and plum
charges to the central forge before the shades drain the drone's integrity.

## Play

- Move with **WASD** or the **arrow keys**.
- Stay inside a relay's inner marked ring to align the prism and build that relay's color. The eight
  motes above the drone show carried charge. One, two, or three neutral stone beads identify the
  amber, rain-glass, and plum relays without relying on color alone.
- Light repels nearby shades. In the blackout they turn toward the drone; the five orbiting green
  beads show remaining integrity.
- Carried charge is stable in light and decays in darkness. Bring a sufficiently full charge to the
  central forge and **click** to deposit it. The three forge sockets show completed colors; an
  empty or undercharged attempt produces a brief red rejection pulse and event.
- Depositing all three colors wins. Losing every integrity bead fails the run. After either terminal
  state, release and **click** again to restart immediately.

The subdued outer relay ring marks its safe and shade-retreat field; the brighter inner ring marks
its charge field. These ground-plane rings define the authoritative gameplay field: simulation
sampling and ring radii share the same thresholds and use the three authored point-light positions,
radii, and current powers. BroMetal separately computes full 3D illumination for material
presentation from fragment position, surface normal, and view direction. That presentation is not
an exact attenuation preview of the abstract ground-plane gameplay field. Lowering a light's power
through Antiky shrinks the authoritative rings and changes both gameplay and material presentation.

A short in-canvas legend shows movement, the one/two/three-stone relay identifiers, inner-ring
charging, and then forge deposit in playable order. It fades after fourteen seconds or the first
successful deposit.

## Ownership

Antiky Framework owns the fixed 60 Hz `EngineSession`, input capture, deterministic simulation,
stable world/entity IDs, point-light authoring and correction history, gameplay world projection,
event history, and pause/resume/single-step controls. Gameplay charge-region entities have their own
stable IDs and link to—not impersonate—the authored point-light entities. Point-light MCP edits
therefore change game rules as well as presentation without creating conflicting inspection views.

BroMetal owns the WebGPU renderer, typed shaders, geometry, texture sampling, camera, and bounded
visual feedback. The renderer submits 228 instances in eight draw calls and uploads 7,120 bytes of
dynamic instance data per frame. Those are derived from the actual batch capacities in
`src/renderer.ts`, not estimated scene counts.

The floor uses the installed `poly-haven:forest-floor` catalog asset. Its diffuse, ambient-occlusion,
and roughness JPEGs are emitted as separate production assets and sampled by the dedicated floor
shader. The installed OpenGL normal map is intentionally not sampled because this floor path does
not yet publish a correct tangent-space basis. Exact upstream URLs, retrieval metadata, hashes,
sizes, CC0 terms, and the required Poly Haven API notice are recorded in
[`assets/antiky-assets.json`](assets/antiky-assets.json).

## Develop and verify

From the repository root, start the complete game host, shader watcher, inspection service, and
loopback MCP endpoint:

```sh
npm run antiky -- dev --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
```

The configured game canvas is `http://127.0.0.1:3010/`; Streamable HTTP MCP is
`http://127.0.0.1:3011/mcp`. The public CLI equivalent is `antiky dev --project ...`.

Build, run all demo tests, or type-check only with:

```sh
npm run build --workspace @antiky/demo-point-light-expo
npm test --workspace @antiky/demo-point-light-expo
npm run typecheck --workspace @antiky/demo-point-light-expo
```

## Inspect, edit, correct, and capture

Keep the development command running. In a second repository-root terminal, use the CLI below.
`antiky tool` calls the same MCP tools an agent calls at `http://127.0.0.1:3011/mcp`.

First orient to the live runtime and read its game rules, event history, renderer counts, and three
stable lights:

```sh
npm run antiky -- tool get_dev_status --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool get_session_status --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool get_world_inspection --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool get_event_log --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool get_render_stats --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool list_point_lights --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool get_point_light '{"entityId":"0197f27e-1000-7000-8000-000000000002"}' --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
```

This one-time example sets the amber relay from revision 1 to power 0.8, then submits a correction
against the current revision 2. An accepted correction restores its prior 2.5 power and produces
revision 3. The world and light IDs are shipped identities.
The two command IDs are valid UUIDv7 examples and must be replaced with newly generated IDs if they
have already been accepted in the current runtime:

```sh
npm run antiky -- tool set_point_light_power '{"commandId":"0197f27e-3000-7000-8000-000000000001","worldId":"0197f27e-1000-7000-8000-000000000001","entityId":"0197f27e-1000-7000-8000-000000000002","expectedRevision":1,"power":0.8}' --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool correct_point_light_power '{"commandId":"0197f27e-3000-7000-8000-000000000002","correctedCommandId":"0197f27e-3000-7000-8000-000000000001","expectedRevision":2}' --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
```

For later edits, generate each new command identity with
`npm run antiky -- generate id command`, and always read the light again for its current revision.
An accepted correction appends a new fact; it never deletes the changed fact.

Pause and single-step the deterministic rules by passing the exact
`session.clock.completedStepCount` returned by `get_session_status` or `pause_simulation`:

```sh
npm run antiky -- tool pause_simulation --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool step_simulation '{"expectedCompletedStepCount":42}' --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool resume_simulation --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
```

Replace `42` with the returned count. Finally, capture the exact current canvas; Antiky writes the
PNG under `.antiky/captures/` and returns its path and digest:

```sh
npm run antiky -- tool get_runtime_status --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool capture_frame --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
```

An MCP client uses the identical tool names and JSON inputs. Configure its Streamable HTTP server as
`{"type":"http","url":"http://127.0.0.1:3011/mcp"}` while this project is running.
