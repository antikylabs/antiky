# Studio Slice 00: Inspect the development workspace

## Control

| Field | Value |
| --- | --- |
| Status | `READY` |
| Owner | Antiky Studio maintainers |
| Outcome | One Studio window combines the live game, native terminal, session controls, world inspection, event-sourcing log, and MCP call log from one `antiky dev` session |
| Owner input | `NONE` |
| Architecture decisions | [Studio 0001](../../../adr/studio/0001-ai-integrations_H.md), [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md), [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md), [Framework 0001](../../../adr/framework/0001-entity-component-system_H.md), [Framework 0002](../../../adr/framework/0002-event-sourcing_H.md), [Framework 0009](../../../adr/framework/0009-separate-state-projections_H.md), and [CLI 0001](../../../adr/cli/0001-use-mcp-tools-for-development_H.md) |
| Depends on | The completed Antiky Town Slices 01 and 02, plus the current `antiky dev` host |
| Alignment revision | `02874d3291bef15f7b8838d1381d0798926e0760` |
| Review date | `2026-08-05` |
| Complete check | `node docs/objectives/studio/slice-00/verification/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/plan.md until complete
```

## Review summary

- Add the React and Vite Studio app and the Tauri-hosted native `libghostty` terminal.
- Use the existing `antiky dev` host and the same typed services as CLI and MCP.
- Show the live game, session controls, inspection data, entity hierarchy, and state stores.
- Keep the event-sourcing log separate from the development-session MCP call log.
- Do not add authoring edits, a general ECS, durable storage, another host, or release packaging.

## Outcome

A developer opens one useful Studio workspace, starts `antiky dev` in its terminal, inspects the
running world and its history, and controls the fixed-step session beside the live game.

### Observable behavior

- One durable Studio command opens the selected project in Tauri.
- A native `libghostty` terminal supports a shell or coding agent, resize, focus, and clean exit.
- Studio attaches to the selected `antiky dev` session and shows its game, build, runtime, session,
  connection, diagnostic, and render facts.
- The toolbar can pause, resume, and advance a paused session by exactly one fixed step.
- The inspection rail shows the complete published entity hierarchy, component summaries, named
  store views, and the complete bounded inspection snapshot.
- A user can expand an entity, store, event, or MCP call to inspect its bounded structured record.
- The event panel shows accepted event-sourcing facts in source order. It states the event source's
  lifetime and does not imply that in-memory history survives a runtime restart.
- The MCP panel shows each Tool call handled by the `antiky dev` MCP endpoint and the structured
  arguments and response that crossed that boundary, subject only to visible secret redaction.
- A browser build shows the same workspace with an unavailable native-terminal state.
- A missing, incompatible, or stopped session leaves the terminal usable and never shows stale data
  as current.

### Non-goals

- Component or world editing, canvas selection, feedback, assets, undo, or authoring controls.
- A physical ECS layout, public component-schema system, generic query engine, or raw store access.
- A durable event-store adapter, database, snapshot policy, or history that survives a game rebuild.
- MCP Resources, protocol-traffic tracing, inferred AI identity, terminal parsing, or transcript capture.
- A second engine runtime, Studio backend, launcher, or Windows and Linux distribution.

## Chosen shape

```text
Framework world, session, and event sources
  -> versioned inspection queries -> antiky dev development service
  -> shared @antiky/cli DevelopmentClient -> CLI and Studio views
  `-> MCP Tool adapter --------------------^ -> bounded MCP call log -> Studio

Tauri window -> portable Studio app -> live game frame and read-only panels
             `-> native libghostty surface <-> PTY <-> shell or coding agent
```

| Owner | Owns in this slice | Does not own |
| --- | --- | --- |
| Framework | Session authority, semantic world inspection, store views, and accepted event history | Studio layout, MCP traffic, private storage exposure, or BroMetal |
| `@antiky/cli` | Sole development host, shared client, validation, MCP adapter, and MCP call log | Studio presentation or Framework rules |
| `packages/studio/app` | Workspace, controls, read-only panels, display state, and browser fallback | Engine facts, credentials, Tauri, PTY, or direct Framework access |
| `packages/studio/tauri` | Native window, bounded connection discovery, terminal surface, PTY, and disposal | Development requests, projections, or engine rules |
| Game and BroMetal | Actual world adapter, game canvas, render state, and GPU work | Studio or development-host state |

`antiky dev` is the only development host. CLI, Studio, MCP, and tests use the same query and command
behavior. Platform code can discover a connection, but it cannot copy engine or request logic.

The hierarchy is a view of stable entities and real `ChildOf` relationships. An unparented entity
stays visible. A store panel shows a bounded semantic view of authoring, runtime, render, or
specialized state. It never exposes Maps, live objects, runtime handles, or GPU resources.

A Studio-only parser would duplicate engine meaning. A full ECS or event database would decide too
much too early. This slice adds the smallest reusable read-only projection between those options.

Use a top control bar, native terminal beside the game, a right inspection rail with `Hierarchy`,
`Stores`, and `Snapshot` views, and a bottom activity dock with `Events`, `MCP calls`, and
`Diagnostics`. A narrow layout can turn the rails into tabs without changing their data sources.

## Required reading

- [Studio objective guidance](../AGENTS.md) and [shared slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Studio architecture](../../../architecture/studio/overview_A.md) and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [World and session model](../../../architecture/framework/world-and-session-model_A.md) and [commands, events, and persistence](../../../architecture/framework/commands-events-and-persistence_A.md)
- [Framework 0001](../../../adr/framework/0001-entity-component-system_H.md), [0002](../../../adr/framework/0002-event-sourcing_H.md), and [0009](../../../adr/framework/0009-separate-state-projections_H.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md)
- [CLI 0001](../../../adr/cli/0001-use-mcp-tools-for-development_H.md) and [Studio connection guide](../../../user-facing-docs/studio/development-connection.md)
- [Slice 01 summary](../../antiky-town/_completed/slice-01/slice-summary.md) and [Slice 02 summary](../../antiky-town/_completed/slice-02/slice-summary.md)
- [Website design](../../../../packages/website/DESIGN.md), [Studio render](../../../user-facing-docs/assets/antiky-studio-town-concept.png), and [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

The research used current primary sources on `2026-08-05`.

| Reference | Useful pattern | Antiky result |
| --- | --- | --- |
| [Phaser Editor](https://docs.phaser.io/phaser-editor/v4/scene-editor/intro) | Its browser view uses the actual Phaser runtime. | Frame the configured game URL. Do not build a second renderer. |
| [Godot Inspector](https://docs.godotengine.org/en/stable/tutorials/editor/inspector_dock.html) | The scene tree, inspector, and running game share clear modes. | Show real entity data and keep this slice read-only except session control. |
| [Bevy Remote Protocol](https://docs.rs/bevy/latest/bevy/remote/index.html) | Remote clients inspect ECS state through a bounded protocol. | Publish semantic views instead of sharing internal objects. |
| [Unity Hierarchy](https://docs.unity3d.com/6000.0/Documentation/Manual/Hierarchy.html) | Hierarchy and play controls stay visible beside the game view. | Keep session mode and hierarchy visible together. |
| [Unreal editor](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-editor-interface) | Viewport, Outliner, Details, console, and output are one workspace. | Use adjacent inspection and activity docks without copying engine state. |
| [PlayCanvas editor](https://developer.playcanvas.com/user-manual/editor/interface/) | Hierarchy and inspector present one shared entity model. | Use stable entity IDs and real relationships, not DOM or render nodes. |
| [Tauri capabilities](https://v2.tauri.app/security/capabilities/) and [`libghostty`](https://github.com/ghostty-org/ghostty) | Native access is explicit, and the terminal core is embeddable but unstable. | Default-deny Tauri; pin and isolate one Ghostty commit. |

BroMetal `0.15.0` is installed and matched its latest package on the review date. Studio imports no
BroMetal API and causes no GPU readback. The game page keeps its normal GPU work and resources.

Accepted ADRs already select stable entities, `ChildOf` hierarchy, separate state copies, selective
event sourcing, shared services, and MCP Tools. `UNDER_REVIEW_A.md` candidates 2, 3, 6, and 8 were
reviewed. They do not block a read-only, bounded projection with local development authority. This
slice does not select a public runtime-schema system, physical ECS layout, principal model, or event
database. If implementation needs one of those decisions, add owner input and stop that work.

## Current state and hypotheses

| Capability | Decision | Current proof or missing result |
| --- | --- | --- |
| Session inspection and pause, resume, and step | `USE` | Framework `EngineSession`, shared client, HTTP, CLI, and MCP tests passed in Town Slice 02. |
| Point-light state and accepted facts | `USE` | Framework inspection publishes authoring, runtime, render, and fact arrays from Slice 01. |
| Development snapshot and shared client | `EXTEND` | The client mixes browser-safe requests with Node discovery; split one reusable core. |
| Semantic hierarchy and store inspection | `CREATE` | No general versioned projection exists. Do not infer it from the canvas or DOM. |
| Event-sourcing inspection | `EXTEND` | Point-light facts exist, but no general read-only event-history view exists. |
| MCP call log | `CREATE` | `processMcpRequest` returns Tool calls without keeping a bounded per-session log. |
| Studio app and native terminal | `CREATE` | Only the package location, architecture, website language, and concept render exist. |

- `HYP-00`: A pinned full `libghostty` surface can embed without a custom terminal renderer. Prove
  input, focus, resize, clipping, child exit, and disposal before building around it.
- `HYP-01`: A semantic world and event projection can show current Antiky data without choosing a
  general ECS or event database. Prove it with the existing point-light service before expanding it.

## Deliverables

### Framework

- Add immutable, versioned world inspection for entity headers, component summaries, `ChildOf`
  relationships, and bounded named store views. Include counts and explicit incomplete status.
- Add immutable, versioned event-history inspection. Preserve the source event type, sequence,
  command identity, world and entity identities, revision, time, and bounded event data.
- Adapt the current point-light service as the first producer. Show its authoring, runtime, and
  render projections as stores and its accepted facts as event history.
- Extend `InspectionSnapshot` with optional world and event views. Reject incompatible identities,
  duplicate entities, invalid hierarchy, sequence gaps, unknown fields, and excessive data.
- Add no generic ECS storage, reflection, persistence adapter, Studio import, or renderer object.

### Integration, CLI, and Studio

- Add `packages/studio/*` workspace discovery and one durable `dev:studio` command. Add no
  slice-only package command.
- Extract one browser-safe `@antiky/cli/development` client core. Keep the current Node bootstrap.
  Add shared world-inspection and event-history reads and matching read-only MCP Tools.
- Add a bounded in-memory log for `tools/call` requests handled by the `antiky dev` MCP endpoint.
  Record a host call ID, JSON-RPC ID, time, duration, tool name, arguments, result or error, and
  available correlation IDs. Mark redaction and truncation. Reset the log with the dev session.
- Expose the MCP call log through a protected development-client query, not an MCP Tool. This avoids
  a call that records and returns its own growing history. Do not add it to `DevelopmentSnapshot`.
- Build the React and Vite workspace, one polling coordinator, session controls, live game frame,
  hierarchy, stores, raw snapshot, event history, MCP calls, diagnostics, and honest empty states.
- Build the Tauri 2 host and pinned native terminal. Tauri supplies only native capabilities and
  bounded connection discovery. It does not fetch or project engine data.
- Use the website tokens and brand assets. Keep the concept render's media-first composition.

### User-facing documentation

- Add a general Studio getting-started guide and update the Studio connection guide.
- Update Framework inspection, CLI development, and MCP Tool guides for the new shared reads.
- Explain the difference between the event-sourcing log and MCP call log. State each retention rule.
- Update Studio architecture with the two log owners. Add an ADR only if implementation changes
  authority, persistence, or a public contract beyond the accepted decisions.
- Check prose, commands, and links manually. Do not add tests that only test documentation text.

## Data and authority paths

```text
world/session/event authority -> Framework inspection -> antiky dev -> shared client -> Studio
Studio pause/resume/step -> shared client -> host action -> EngineSession -> result -> all clients
MCP client -> Tool adapter -> same query or command -> response -> host MCP call log -> Studio
terminal input -> libghostty -> PTY -> shell or coding agent
```

The event panel contains accepted domain facts used for event-sourced state. It does not contain
simulation steps, rejected commands, diagnostics, or MCP traffic. The MCP panel is a temporary
record of development calls. It does not become world history or prove caller identity.

## Safe behavior

| Event | Required result |
| --- | --- |
| No session or stopped `antiky dev` | Keep the terminal usable, clear live panels, and show one recovery action. |
| Invalid connection or inspection section | Reject it as incompatible. Do not show partial or stale state as current. |
| Missing parent, hierarchy cycle, duplicate ID, bad store, or event gap | Reject the world or event view with a stable path and code. Keep the last view visibly stale. |
| Concurrent or repeated control | Disable while pending and honor the returned result. A stale step advances nothing. |
| Runtime replacement | Clear old runtime, store, and in-memory event views before the new identity appears. |
| MCP call exceeds a log limit or contains a secret | Mark truncation or redaction visibly; never place the value in logs, errors, or evidence. |
| MCP call log reaches its cap | Evict oldest complete entries and report retained range and dropped count. |
| Terminal failure or child exit | Keep other panels usable and require explicit terminal reopen. |
| Studio close | Dispose polling, frame, terminal, and PTY once. Let `antiky dev` perform its cleanup. |

Use exact loopback origins, the existing session credential, default-deny Tauri capabilities, and
bounded JSON values. The MCP call log is local development state only. Never persist it or include it
in a shipped game, capture receipt, diagnostic, event stream, or terminal transcript.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Record package, session, payload, visual, and Ghostty baselines; prove the native surface | Baseline receipt and terminal probe | `Qualify Studio foundations` |
| `CP-01` | Add world/store and event-history inspection with the point-light adapter | Framework contract, ordering, limit, and replay tests | `Add world inspection views` |
| `CP-02` | Add shared browser client, MCP read Tools, React shell, layout, and design tokens | Client parity, UI, import, build, and reference tests | `Add Studio workspace` |
| `CP-03` | Add the Tauri host, native terminal, PTY, focus, resize, and cleanup | Rust tests and three-cycle desktop smoke | `Embed Studio terminal` |
| `CP-04` | Add connection, controls, panels, MCP call log, polling, recovery, and general docs | Live CLI, Studio, MCP, event, and call-log parity | `Connect Studio inspection` |
| `CP-05` | Run the temporary verifier and save the receipt and slice summary | One clean browser and desktop run | `Verify Studio Slice 00` |

## Test plan

- Test immutable entities, components, real `ChildOf` trees, unparented entities, stable ordering,
  store kinds, bounded values, counts, incomplete results, bad identities, cycles, and limits.
- Set and correct one point light. Confirm two ordered accepted facts in the event panel and matching
  Framework, CLI, and MCP reads. Pause and step must not add domain events.
- Test successful, rejected, malformed, unknown, concurrent, and maximum-size MCP Tool calls. Prove
  request and response parity, ordering, redaction, eviction, reset, and no recursive log growth.
- Test pause, resume, independent pause reasons, one step, stale step, rapid clicks, disconnect during
  control, immediate refresh, and parity with CLI and MCP results.
- Test one poll owner, runtime replacement, reconnect, incompatible data, honest stale and empty UI,
  expanded rows, long values, keyboard use, reduced motion, zoom, and non-color status text.
- Test Tauri file limits, exact origins, terminal input, Unicode, resize, focus, child exit, reopen,
  disposal, and the ban on duplicated request routes or Framework rules.
- Confirm Studio changes no Town draws, uploads, fixed steps, GPU resources, or readback behavior.
- Run affected package tests, Rust tests, browser and Tauri builds, `npm run check`, and the temporary
  complete check. Review user documentation links and commands manually.

For a reported error, add a failing regression test before the fix. Keep temporary verification in
this slice's `verification/` folder. Do not add it to package manifests or shared script folders.
Delete it after the final outputs pass.

## Completion checks

- [ ] `AC-01` Tauri opens the website-aligned workspace with the native terminal and live Town game.
- [ ] `AC-02` Studio attaches through the shared client to the same session used by CLI and MCP.
- [ ] `AC-03` The hierarchy, component summaries, stores, snapshot, and diagnostics show all current
  published data without exposing or inventing engine internals.
- [ ] `AC-04` Pause, resume, and one-step controls return the same safe results as CLI and MCP.
- [ ] `AC-05` The event panel shows the real ordered event-sourcing facts and their retention scope.
- [ ] `AC-06` The MCP panel shows bounded, ordered Tool arguments and returned results, with visible
  redaction, errors, source scope, dropped count, and no recursive self-log.
- [ ] `AC-07` Browser mode keeps the same panels and clearly marks the native terminal unavailable.
- [ ] `AC-08` Invalid, stale, disconnected, failed, busy-port, and close paths are honest and recoverable.
- [ ] `AC-09` Town rendering, simulation, resources, and zero normal GPU readback remain unchanged.
- [ ] `AC-10` General docs, tests, builds, repository check, receipt, and `slice-summary.md` pass.

## Run and evidence rule

Use the shared workflow for isolation, permissions, retries, rollback, and receipt content.

- Isolation: use one worktree, fixed `3010` and `3011` ports, one Studio window, one PTY, one pinned
  Ghostty checkout, and one output directory. Fail on a busy port.
- Retry: use shared limits. A failed native embed or missing semantic inspection boundary is a design
  result, not permission to add a substitute renderer, raw reflection, or private-state access.
- Rollback: credential exposure, wrong authority, orphan process, native crash, event-order error, or
  MCP-log recursion returns work to the last passing checkpoint before verification continues.
- Special authority: dependency downloads and native tool installation need normal permission. No
  new production, persistence, world-mutation, or agent authority is granted.
- After completion: Studio, Framework, and CLI maintainers own their boundaries and health checks.

Record revisions, dependency versions, ports, IDs, retained ranges, dropped counts, redaction and
truncation facts, measurements, captures, and changed user pages. Do not save call payloads, secrets,
private paths, or terminal contents in slice evidence.

Write `receipt.json`, `confirmation-checks.md`, and `facts.json` under `outputs/{run-id}/`. Add only
required measurements, captures, and bounded logs. Update `../slice-list.md` before closeout. Write
`slice-summary.md` in this slice folder for the owner.
