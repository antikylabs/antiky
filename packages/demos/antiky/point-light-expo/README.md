# Blackout Relay

Blackout Relay is a playable Antiky vertical slice set in a derelict forest reliquary. You pilot a
small prism drone from a marked foreground launch point through a chamber patrolled by shades.
The drone begins clear of the central forge so both silhouettes read immediately. Restore the amber,
rain-glass, and plum charges to the central forge before the shades drain the drone's integrity.

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

A compact two-row in-canvas strip shows movement, the one/two/three-stone relay identifiers,
inner-ring charging, and then forge deposit in playable order. It occupies only the lower-left edge
and fades out by five seconds or immediately after the first successful deposit.

## Ownership

Antiky Framework owns the fixed 60 Hz `EngineSession`, input capture, deterministic simulation,
stable world/entity IDs, point-light authoring and correction history, gameplay world projection,
event history, and pause/resume/single-step controls. Gameplay charge-region entities have their own
stable IDs and link to—not impersonate—the authored point-light entities. Point-light MCP edits
therefore change game rules as well as presentation without creating conflicting inspection views.

BroMetal owns the WebGPU renderer, typed shaders, geometry, texture sampling, camera, and bounded
visual feedback. The default look keeps a neutral environment fill even when relay powers are zero,
then layers the authored relay lights as controlled material illumination. A fixed three-quarter
camera frames the complete elevated architecture AABB—not only its ground footprint—at the default
1280×720 review size; camera shake starts only above the contact-hit threshold. Instanced weathered
rocks and broad rooted stumps form the main side ruins, three differently massed relay shrines, and
the forge's heavy central body. Nine brighter trunk instances remain only as three rear arches; the
repeated square footing and cylinder passes were removed. Shades use a grounded, volumetric
horned-predator mesh with torso, shoulder, head, four legs, foreclaws, and a segmented tail rather
than a cone or flat wing plane. The renderer submits 212 instances in 11 draw calls and
uploads 7,380 bytes of dynamic instance data per frame. Those values are derived from the exact
batch capacities and pass list in `src/render-profile.ts`; static catalog-model buffers are not
counted as per-frame uploads.

## Catalog assets and provenance

All four source assets are official Poly Haven CC0 1.0 releases. Because their files and metadata
were delivered through the Poly Haven API, the shipped receipts preserve its required API notice.

- [`poly-haven:forest-floor`](https://polyhaven.com/a/forest_floor), by eye-candy.xyz, supplies the
  floor's diffuse, ambient-occlusion, and roughness JPEGs. Vite emits all three as production assets
  and the dedicated floor shader samples them. Reduced UV repetition and a 0.56 texture-contrast
  blend keep the real surface response below the gameplay silhouettes. The installed OpenGL normal
  map is intentionally not sampled because this floor path does not publish a tangent-space basis.
- [`poly-haven:dead-tree-trunk`](https://polyhaven.com/a/dead_tree_trunk), by Rob Tuytel, supplies
  the three secondary rear arches. Its derived GLB is 3,733,260 bytes with SHA-256
  `0f3b4db64db1209590ce75ccecd5f72fed3938a669c729b750c27fcb23e1619a`.
- [`poly-haven:rock-moss-set-01`](https://polyhaven.com/a/rock_moss_set_01), by Kless Gyzen,
  supplies the 27 primary shrine, forge, and ruin rocks. The deterministic derivative selects source
  mesh index 4 (`rock05`) from the six-rock set, leaves its vertex/normal/UV/index data unchanged,
  and embeds its diffuse and red-channel roughness JPEGs. The GLB is 1,721,680 bytes with SHA-256
  `0bf52ded7d769acee77fd65ea08e2eae9e8f95a5fea5155778f9fed5fae033de`.
- [`poly-haven:tree-stump-01`](https://polyhaven.com/a/tree_stump_01), by Rob Tuytel, supplies eight
  broad rooted bodies: one at each relay, the forge heart, and four ruin anchors. The derivative
  embeds its diffuse and ARM JPEGs. The GLB is 2,700,076 bytes with SHA-256
  `8a246ccbef52ecbe6d90f6991d9db6a14bd2580a4558fd34044727805ab893c7`.

The rock and stump records currently have `source-verified` catalog status with empty installer
download arrays. `scripts/intake-poly-haven-primary.mjs` therefore queries only their canonical
`https://api.polyhaven.com/files/{asset}` and `https://api.polyhaven.com/info/{asset}` records,
derives each creator and catalog file hash from the saved info response, allowlists the official
`https://dl.polyhaven.org/file/ph-assets/` URLs, and verifies every API size and MD5 before writing
the source. [`assets/source-assets.json`](assets/source-assets.json) records that installer gap,
canonical pages, both API endpoints/snapshots, catalog SHA-1 values, creators, retrieval time,
source MD5/SHA-256 values, sizes, license, and API notice.

BroMetal 0.15 accepts embedded GLB resources rather than external glTF buffer/image references.
`scripts/pack-catalog-models.mjs` uses an explicit source URI/shape allowlist, rejects unexpected
buffers, images, or URI-bearing extensions, selects the recorded mesh, and embeds the verified
binary/diffuse/material bytes. All three model normal bindings are intentionally omitted because the
runtime shader has no tangent basis. A lifted, lower-contrast catalog material response reveals the
bark, rock, moss, and root albedo without pretending to support tangent-space normals.

Exact installer-managed download URLs, upstream MD5 values, installed SHA-256 values, sizes,
retrieval metadata, CC0 terms, and the API notice for Forest Floor and Dead Tree Trunk are in
[`assets/antiky-assets.json`](assets/antiky-assets.json). Exact input-to-output hashes and every
original→derived transformation are in
[`assets/derived-assets.json`](assets/derived-assets.json). `npm run assets:build` reproduces the
three derived GLBs offline and is already part of `npm run build`.

`poly-haven:fern-02` remains unshipped: its catalog record has the same automated-installer gap, and
the rock/stump pair already provides the two distinct primary forms needed by this composition.
`poly-haven:forest-slope` is an install-verified HDRI, but BroMetal currently exposes no supported
HDR environment/cubemap intake for this demo; no cubemap support is claimed or improvised.

The current Framework `GameHostContext` does not expose an owned audio service, so this slice keeps
feedback visual rather than creating an ad hoc browser-audio path outside the Antiky contract.

## Develop and verify

From the repository root, start the complete game host, shader watcher, inspection service, and
loopback MCP endpoint:

```sh
npm run antiky -- dev --open --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
```

The configured game canvas is `http://127.0.0.1:3010/`; Streamable HTTP MCP is
`http://127.0.0.1:3011/mcp`. Omit `--open` for agent/headless work. Run only one manifest-port demo
at a time and press `Ctrl-C` before starting another.

Build, run all demo tests, or type-check only with:

```sh
npm run build --workspace @antiky/demo-point-light-expo
npm test --workspace @antiky/demo-point-light-expo
npm run typecheck --workspace @antiky/demo-point-light-expo
```

Rebuild only the deterministic catalog derivative, or regenerate typed shaders and verify that the
checked-in generated modules remain in parity, with:

```sh
npm run assets:build --workspace @antiky/demo-point-light-expo
npm run shaders:prod --workspace @antiky/demo-point-light-expo
git diff --exit-code -- packages/demos/antiky/point-light-expo/src/shaders/*.shader.gen.ts
```

`npm run assets:intake --workspace @antiky/demo-point-light-expo` intentionally performs the
networked official-API intake again and refreshes `assets/source-assets.json`; normal build and test
commands never require the network.

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

Replace `42` with the returned count. Discover the managed canvas-capture formats and limits before
requesting private evidence:

```sh
npm run antiky -- tool get_capture_capabilities --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
npm run antiky -- tool get_runtime_status --project packages/demos/antiky/point-light-expo/point-light-expo.antiky
```

`capture_frame` schema 3 can cold-launch Antiky's isolated managed Chromium. A
`capture_gameplay_sequence` presentation trace can use explicit WASD edges and a primary pointer
press/release to record relay charging, forge rejection, or deposit feedback while remaining inside
the managed game page. Results expose only private opaque still, lossless PNG-master, poster,
manifest, trace, and WebM identities; retrieve an exact authorized artifact with
`get_render_evidence`. No filesystem path or unbounded base64 appears in JSON. Canvas-only evidence
does not approve dark or game-rendered content for publication, WebM is a review derivative, and
presentation input is not deterministic semantic replay. See the [MCP capture
reference](../../../../docs/user-facing-docs/mcp/tools.md#capture_frame) for exact request JSON and
limits.

An MCP client uses the identical tool names and JSON inputs. Configure its Streamable HTTP server as
`{"type":"http","url":"http://127.0.0.1:3011/mcp"}` while this project is running.
