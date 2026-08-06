# Studio Slice 00: Open the development workspace

## Control

| Field | Value |
| --- | --- |
| Status | `READY` |
| Owner | Antiky Studio maintainers |
| Outcome | One Tauri window shows a working `libghostty` terminal beside the live Antiky Town canvas and reports the shared `antiky dev` session |
| Owner input | `NONE` |
| Architecture decisions | [Studio 0001](../../../adr/studio/0001-ai-integrations_H.md), [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md), [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md), and [CLI 0001](../../../adr/cli/0001-use-mcp-tools-for-development_H.md) |
| Depends on | The current `antiky dev` host, inspection service, and MCP server |
| Alignment revision | `ed47200bbf7e2009f8e48258bf117306f97aee03` |
| Review date | `2026-08-05` |
| Complete check | `node docs/objectives/studio/slice-00/verification/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/plan.md until complete
```

## Review summary

- Add the portable React and Vite app and the Tauri-hosted native `libghostty` terminal.
- Make Studio and the CLI use the same typed client and the existing `antiky dev` host.
- Make Studio look and feel like the current Antiky Labs website became a desktop application.
- Do not add hierarchy, editing, a second service or client stack, or release packaging.

## Outcome

A developer opens Studio for one project, uses a real shell or coding agent in the left terminal,
starts `antiky dev`, and works beside the actual running Antiky Town canvas in the same window.

### Observable behavior

- One durable Studio development command opens the selected project in the Tauri application.
- A native `libghostty` terminal accepts text, shell applications, resize, focus, and clean exit.
- When `antiky dev` creates its session descriptor, Studio attaches and shows the exact game URL,
  connection state, session ID, runtime ID, build revision, simulation mode, and diagnostics state.
- The main media field loads the configured game URL. Studio does not copy canvas pixels each frame.
- A browser build renders the same shell and game field with a clear desktop-terminal placeholder.
- A missing or stopped development session leaves the terminal usable and reports a direct recovery
  action instead of showing stale state.

### Non-goals

- Entity hierarchy, selection, inspector, comments, feedback queue, asset browser, or world editing.
- Automatic engine-process ownership, an embedded second `EngineSession`, or a new launcher.
- Bundled AI, provider accounts, terminal transcript parsing, or a Studio-specific MCP service.
- Windows and Linux packages, installers, updates, code signing, or production distribution.

## Chosen shape

```text
Node bootstrap for CLI -------+
Studio EditorHost bootstrap --+-> shared @antiky/cli DevelopmentClient
                                  -> existing antiky dev development service
                                      +-> CLI output
                                      +-> Studio status and live game URL
                                      `-> MCP adapter and tests use the same service behavior

Tauri window -> Studio app web view
             `-> native libghostty surface <-> PTY <-> user's shell or coding agent
```

| Owner | Owns in this slice | Does not own |
| --- | --- | --- |
| `packages/studio/app` | React workspace, layout, status presentation, live game frame, shared development-client use, host contract, and browser fallback | Tauri, PTY, session discovery, shell processes, engine state, or BroMetal |
| `packages/studio/tauri` | Native window, bounded local-session discovery, `libghostty` surface, PTY, focus, resize, and disposal | Development requests, DTO projections, engine rules, terminal transcript interpretation, or arbitrary web-exposed process commands |
| `@antiky/cli` development surface | Shared client contract and implementation, Node bootstrap, process, build, connection, diagnostics, capture, session, and MCP facts | Studio layout or terminal state |
| Game page and Framework | Live world, simulation, inspection, canvas, and BroMetal rendering | Studio workspace state |

`antiky dev` is the only development host. Tauri is a desktop host, not another Antiky development
host. The CLI and Studio must call the same `DevelopmentClient` methods. Environment-specific code
can find a connection, but it must not copy request logic, projections, validation, or engine rules.

Use React 19 and Vite. Both already run here, and Tauri recommends a static SPA. Next.js would bring
server concerns into the client; another UI stack would add a toolchain before a workflow proves a
need. Record an ADR before a later slice makes this a contributor-facing promise.

Use a native host-owned `libghostty` surface in the reserved terminal rectangle. The app sends only
bounds, focus, and lifecycle intent to this surface. `EditorHost` supplies bounded connection data,
but it does not mirror the development API. Page code gets no arbitrary command API.

## Required reading

- [Studio objective guidance](../AGENTS.md)
- [Shared slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [Studio 0001](../../../adr/studio/0001-ai-integrations_H.md), [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md), and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [CLI 0001: Use MCP Tools for local development](../../../adr/cli/0001-use-mcp-tools-for-development_H.md)
- [Current Studio connection guide](../../../user-facing-docs/studio/development-connection.md)
- [Website design system](../../../../packages/website/DESIGN.md) and [implemented CSS](../../../../packages/website/src/app/globals.css)
- [Studio concept render](../../../user-facing-docs/assets/antiky-studio-town-concept.png)
- [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

The research used current primary sources on `2026-08-05`.

| Source | Relevant approach | Antiky result |
| --- | --- | --- |
| [Phaser Editor 5](https://docs.phaser.io/phaser-editor/v4/scene-editor/intro) | The editor uses Phaser and the browser for a close match with the game, while generated code stays readable. | Show the actual Antiky game URL. Do not build a second Town renderer in Studio. |
| [Godot Inspector](https://docs.godotengine.org/en/stable/tutorials/editor/inspector_dock.html) and [tool scripts](https://docs.godotengine.org/en/stable/tutorials/plugins/running_code_in_the_editor.html) | Scene selection drives the inspector, but in-editor scripts can make permanent unsafe changes. | Defer selection and mutation. Later panels must use shared commands and queries, not direct storage access. |
| [Bevy Remote Protocol](https://docs.rs/bevy/latest/bevy/remote/index.html) | A remote JSON-RPC boundary inspects and changes ECS state without sharing internal objects. | Keep Studio on the existing typed development boundary and away from Framework internals. |
| [Unity 6 Hierarchy](https://docs.unity3d.com/6000.0/Documentation/Manual/Hierarchy.html) | Hierarchy, Scene, Game, Inspector, and play controls share selection and mode context. | Preserve room for one shared selection and session-mode service, but do not fake either in Slice 00. |
| [Unreal Engine 5.8 editor](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-editor-interface) | The viewport, Outliner, Details panel, console, and output log are adjacent parts of one workspace. | Put the real terminal beside the canvas. Keep it a client, not the source of engine facts. |
| [PlayCanvas editor](https://developer.playcanvas.com/user-manual/editor/interface/) | The viewport, hierarchy, inspector, and assets use one visible selection context. | Use the composition as later direction. Slice 00 proves only the terminal and live media field. |
| [Tauri frontend guidance](https://v2.tauri.app/start/frontend/) and [capabilities](https://v2.tauri.app/security/capabilities/) | Tauri hosts static SPAs and limits native access through explicit capabilities. | Use React and Vite behind `EditorHost`; expose no general shell API to the web view. |
| [`libghostty`](https://github.com/ghostty-org/ghostty) and [Ghostling](https://github.com/ghostty-org/ghostling) | `libghostty` is embeddable and its terminal core is proven, but it has no tagged library version and API signatures still move. `libghostty-vt` supplies state, not a full renderer or session UI. | Pin one reviewed Ghostty commit and isolate it in Tauri. Prove the native surface before building the workspace around it. |

`npm ls brometal --all` reports the installed `0.15.0`; it matches the
[latest package](https://registry.npmjs.org/brometal/latest). Its
[README](https://github.com/ericdrowell/brometal) and
[changelog](https://github.com/ericdrowell/brometal/blob/main/CHANGELOG.md) keep shaders and WebGPU
resources below game rules. Studio imports no BroMetal API, sends no per-frame data, and reads no GPU
state. The existing game page keeps GPU work without a canvas copy or readback. Upgrade work is `N/A`.

The accepted Studio and CLI ADRs above control the slice. The complete
[`UNDER_REVIEW_A.md`](../../../adr/UNDER_REVIEW_A.md) was reviewed. Candidates 5, 6, 7, and 12 do not
block this attach-only, read-only slice: Studio does not choose new engine authority, expose engine
mutation, create a sandbox, or store feedback. If the `libghostty` probe requires a new process or
authority model, stop and create owner input before implementation continues.

## Current state and reference

The owner fixed the package locations, `libghostty`, concept-render use, and seamless website visual
language before this plan. No owner question remains. Town Slices 01 and 02 are complete in the
[Town slice list](../../antiky-town/slice-list.md).

| Capability | Decision | Source and proof |
| --- | --- | --- |
| Development session and typed client | `USE` | [`@antiky/cli` export](../../../../packages/cli/src/index.ts), [`DevelopmentClient`](../../../../packages/cli/src/development/client.ts), and [`development-session.test.ts`](../../../../packages/cli/tests/development-session.test.ts) |
| CLI and MCP service parity | `USE` | [`mcp/server.ts`](../../../../packages/cli/src/mcp/server.ts) and [`mcp-server.test.ts`](../../../../packages/cli/tests/mcp-server.test.ts) |
| Actual Town browser runtime | `USE` | [`LiveDemoStage.tsx`](../../../../packages/demos/src/react/LiveDemoStage.tsx) and current development-session integration tests |
| Shared development client | `EXTEND` | [`client.ts`](../../../../packages/cli/src/development/client.ts) combines reusable HTTP behavior with Node-only config and descriptor discovery |
| Portable Studio app and Tauri terminal host | `CREATE` | `packages/studio` contains only its license and placeholder; root workspaces also miss `packages/studio/*` |
| Hierarchy, inspection editing, and feedback | `DEFER` | Architecture describes them; this slice has no implementing capability or outcome need |

| Hypothesis | Probe | Result rule |
| --- | --- | --- |
| `HYP-00`: full `libghostty` can supply the native terminal surface without a custom renderer | Build one clipped, resizable macOS surface in `CP-00` and exercise its PTY, input, focus, and disposal | `CREATE` the isolated Tauri adapter only after it passes; otherwise record `AUTHORITY_BLOCK` and stop |

- The website supplies the canonical mark, fonts, near-black surfaces, violet action color,
  hairlines, status colors, spacing, and radii.
- The concept render supplies the top frame, adjacent work areas, dominant Town view, and compact
  status direction. In Slice 00, the terminal replaces its left hierarchy. Hierarchy, inspector,
  comments, and feedback rows are approved omissions. Website violet replaces the render's cyan.

## Deliverables

### Framework

- No Framework code. If a fact is missing, stop and plan its service instead of deriving it from
  terminal text, the DOM, or pixels.

### Integration and tools

- Add `packages/studio/*` workspace discovery and one durable `dev:studio` command. Add no slice-only
  package script.
- Create `packages/studio/app` with a narrow `EditorHost`, explicit browser capabilities, connection
  states, a game-frame adapter, and a responsive two-area workspace.
- Keep the website's exact colors, fonts, radii, focus, status meanings, and brand artwork. Add a
  token-parity test, not a separate palette. Import no Next.js component or page stylesheet.
- Add a browser-safe `@antiky/cli/development` export that creates the same `DevelopmentClient` from
  validated connection data. Keep `connectDevelopmentClient(configPath)` as the CLI Node bootstrap.
  Both paths must use one request, validation, error, and projection implementation.
- Give `EditorHost` one connection-bootstrap capability. Each platform finds bounded connection
  data and gives it to the shared client. Keep credentials out of React state, logs, and errors.
- Create `packages/studio/tauri` as a Tauri 2 Rust package for native file access and the terminal.
  It must not fetch development snapshots or duplicate Antiky service routes.
- Allow the exact Studio origin on the existing protected host routes. Add no second service.
- At `CP-00`, pin a Ghostty commit and prove a clipped, resizable native `libghostty` surface on the
  current macOS development target. Prefer the full native surface. Reject a custom
  `libghostty-vt` web renderer because it would make Antiky own text rendering, shaping, and session UI.
- Start one PTY and login shell only after the terminal opens. Keep its stream in the native surface;
  expose no transcript reader or general `runCommand` bridge.
- Watch the existing `.antiky` session descriptor. Create or dispose the shared client when
  `antiky dev` starts or stops. Load only its validated game URL.

### User-facing documentation

- Add `docs/user-facing-docs/studio/getting-started.md` as a general how-to for browser and Tauri use.
- Update `docs/user-facing-docs/studio/development-connection.md` for attach, recovery, and cleanup.
- Update the root package/status README and user-facing documentation index. Do not describe Slice 00.
- Check prose, commands, and links manually. Do not add tests that only test documentation prose.

## Data and authority path

```text
selected project -> platform bootstrap finds bounded local connection data
  -> shared @antiky/cli DevelopmentClient validates it
  -> existing antiky dev service returns the authoritative development snapshot
  -> the same shared client validates and projects the result for CLI or Studio
  -> Studio presents status and the exact configured game URL

terminal input -> libghostty -> PTY -> user's shell or agent -> Antiky CLI or MCP
```

Session and runtime IDs come from `antiky dev`; Studio creates neither. The game and Framework stay
authoritative. Bootstrap data stays inside the shared client and does not enter UI state, logs, or
evidence. Snapshot order follows published revisions, and stale state stays visibly stale.

## Safe behavior

| Event | Required result |
| --- | --- |
| No session descriptor or `antiky dev` is stopped | Keep the terminal usable, show `Not connected`, and retry with a bounded interval |
| Invalid config, descriptor, credential, host, origin, URL, schema, or session ID | The shared client rejects it, loads no frame, exposes no secret, and returns one stable error |
| Game or inspection service disconnects | Remove stale live state, keep the shell open, and reconnect only to the selected project |
| `libghostty` cannot initialize or its pinned API does not support the native surface | Save the probe evidence and stop; do not substitute another terminal or renderer |
| Terminal child exits | Show its exit state and require an explicit reopen; do not disturb the game session |
| Window resize, scale change, focus change, or hidden terminal | Clip and resize the native surface, send input to one owner, and keep the game frame unobscured |
| Studio window closes | Close the PTY and terminal surface once; a child `antiky dev` receives normal terminal teardown and performs its own cleanup |

Use default-deny Tauri capabilities. Grant page code only named Studio host operations, never the
generic shell plugin. Allow exact configured loopback URLs. Keep Tauri, bootstrap adapters, and
Studio code out of game artifacts.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Capture website, Town, session, and package baselines; compare native surface and custom-render options; pin and prove `libghostty` | Native macOS terminal probe, dependency receipt, and recorded decision | `Qualify Studio terminal host` |
| `CP-01` | Extract the browser-safe shared development client; add nested workspaces, React and Vite app, `EditorHost`, visual tokens, brand, and responsive shell | Shared client contract, CLI regression, import-boundary, accessibility, token-parity, browser build, and reference captures | `Add Studio workspace` |
| `CP-02` | Add Tauri host, native terminal surface, PTY, focus, resize, and exact cleanup | Rust unit tests plus terminal input, resize, child-exit, and three-cycle smoke checks | `Embed Studio terminal` |
| `CP-03` | Add thin browser and Tauri bootstraps, exact-origin host access, session watch, live game frame, status, and general docs | Shared client contract tests; Studio attach, disconnect, reconnect, canvas, CLI, and MCP parity | `Connect Studio to Antiky dev` |
| `CP-04` | Run the temporary complete verifier and write the receipt and slice summary | One clean complete run with desktop and browser captures | `Verify Studio Slice 00` |

## Test plan

- Run one contract suite against the Node-bootstrapped and direct browser-safe client. Prove equal
  methods, requests, projections, results, errors, session checks, and current CLI behavior.
- Test `EditorHost` bootstrap and every connection state, exact loopback URL validation, rejected
  data, and the ban on Tauri, Node, MCP, Framework internals, demo, and BroMetal imports in the app.
- Test the Studio token contract against the website's canonical CSS variables, font packages,
  radii, focus color, and status colors. Capture desktop and narrow browser layouts.
- Test the Tauri file boundary with missing, oversized, malformed, escaped, stale, mismatched, and
  non-loopback inputs. Confirm credential redaction and no duplicated development request routes.
- Unit-test the small `libghostty` Rust boundary with a fake. Smoke-test shell startup, Unicode,
  color, modifiers, scrollback, resize, scale, focus, child exit, reopen, and exact disposal.
- From the embedded terminal, run `npm run antiky -- dev`. Confirm Studio attaches to that session,
  the Town is interactive, and Studio IDs and status match `antiky inspect`, `antiky tool
  get_dev_status`, and one MCP call. Do not parse those command outputs inside Studio.
- Stop and restart `antiky dev`, kill the game child, cause a build error, and close Studio. Confirm
  honest state, bounded retry, released ports, descriptor cleanup, and no orphan process.
- Compare the game inspection facts with and without Studio. Draw count, static uploads, simulation
  steps, and GPU readback behavior must not change. Record Studio start time, terminal input-to-echo,
  resize behavior, and process memory as evidence, without inventing a release budget.
- Check keyboard focus, reduced motion, 44-pixel primary targets, zoom, and non-color status text.
- Run affected package tests, Rust tests, browser and Tauri builds, `npm run check`, and the temporary
  complete check from one clean start.

For a reported error, add a failing regression test before the fix. Keep all temporary complete
verification under this slice's `verification/` folder. Do not add it to a package manifest or a
shared script folder. Delete it after final outputs pass.

## Completion checks

- [ ] The Tauri application opens from one durable Studio development command for the selected project.
- [ ] The pinned `libghostty` terminal runs a shell or user-selected agent and handles focus, resize,
  exit, reopen, and disposal.
- [ ] Starting `antiky dev` in the terminal attaches the status display and actual Town game frame to
  the same session used by CLI and MCP.
- [ ] Studio and CLI use the same `DevelopmentClient` implementation; Tauri contains no second
  development service, HTTP client, projection layer, or engine rule.
- [ ] Browser mode uses the same website-aligned workspace, identifies unavailable native features,
  and shows no unimplemented hierarchy, inspector, or feedback UI.
- [ ] Missing, invalid, stale, disconnected, failed-build, busy-port, and close paths leave an honest,
  recoverable state with no credential or transcript exposure.
- [ ] Town draw, upload, simulation, and zero-readback behavior remains unchanged.
- [ ] General Studio docs match; package and Rust tests, builds, `npm run check`, and completion pass.
- [ ] The evidence receipt validates, links every proof, and `slice-summary.md` explains what changed,
  what Studio gained, how to test it, and any decision that may need an ADR.

## Run and evidence rule

Use the shared workflow for normal isolation, permissions, retries, rollback, and receipt content.

- Isolation: use one worktree, fixed `3010` and `3011` ports, one window, one PTY, one pinned Ghostty
  checkout, and one output directory. Fail on a busy port; do not choose another silently.
- Retry: use the shared retry limits. A failed native embed is a design result, not a reason to add a
  fallback implementation.
- Rollback: credential exposure, an orphan process, a native crash, or failed checkpoint proof starts
  rollback. Stop Studio and its PTY, let `antiky dev` clean up, correct or revert to the last passing
  checkpoint, and rerun its proof. The slice adds no schema or durable game-data migration.
- Special authority: dependency downloads and native tool installation need the normal owner or
  environment permission. The slice needs no new engine mutation authority.
- After completion: Studio maintainers own the behavior and use the complete check plus attach smoke
  as health signals. Put human feedback in `docs/objectives/01-FEEDBACK_H.txt` and agent findings in
  `02-AGENT-FINDINGS_A.txt`. Replace or retire the native terminal only through an approved direction.

Record revisions, platform and dependency versions, path labels, ports, session IDs, attempts,
measurements, and artifacts. Redact credentials and private paths. List every changed user page.

Write `receipt.json`, `confirmation-checks.md`, and `facts.json` under `outputs/{run-id}/`. Add
measurements, captures, and bounded logs only when required. Update `../slice-list.md` before
closeout. Write `slice-summary.md` in this slice folder for the owner.
