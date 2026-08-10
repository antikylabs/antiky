# Antiky CLI and MCP inspection: current state and required game-production surface

**Status:** implementation audit and proposal  
**Audited:** 2026-08-09  
**Scope:** Antiky Framework, the CLI-owned development host, Antiky Studio's shared development client, Antiky games, and BroMetal behind Antiky's `RenderDriver` boundary

This report separates two things throughout:

- **Verified current capability** means the behavior exists in the repository source and is covered by the cited implementation or tests.
- **Proposed capability** means a gap or design recommendation. Proposed tool names and schemas do not exist yet and must not be taught to a skill as though they do.

External-engine research is comparative input only, used for transferable lessons such as explicit reload barriers, structured test artifacts, narrow command authority, deterministic replay, and scoped visual evidence; it is not a proposal to add Unity, Unreal, or Godot support. Seed skills are non-authoritative scaffolding: they may organize a workflow, but current Antiky source, schemas, decisions, and observed evidence remain the authority.

## Executive finding

Antiky already has a sound narrow core for agent-native development. One CLI-owned project service starts the build watcher, game host, inspection service, and MCP endpoint. The Framework publishes validated semantic copies rather than live objects. Current tools expose stable world identities, fixed-step counters, authoring/runtime/render projections, accepted facts, diagnostics, renderer counts, controlled canvas capture, and a small command surface. Runtime replacements and publications are identity-checked. Live mutations are serialized through one action broker.

That core is sufficient to orient to a session, inspect a deliberately published world, change one point-light field, pause or single-step a game using the input already held by the browser, and capture one PNG. It is not yet sufficient for an agent or skill to build and independently prove a high-quality Antiky game across repeated edit-run-observe loops.

The most important limitations are structural, not a lack of more prose around the existing tools:

1. Reads do not carry a common observation identity, publication sequence, publication time, or freshness state. A disconnected session can retain and return an old inspection.
2. Read-before-action ordering is advisory. Reload and capture do not require the build/runtime/session/world revision that the caller observed.
3. The runtime accepts no explicit semantic input trace, seed, scenario, checkpoint, or reset. One fixed step therefore cannot become a reproducible gameplay replay.
4. The only generic world surface is a complete bounded snapshot. There is no targeted entity, component, store, event, command-schema, or changed-since query.
5. Point-light power is the only live world-authoring mutation. There is no registered general command surface, sandbox authoring session, promotion, or rollback contract.
6. Visual evidence is one uncontextualized PNG. There is no canvas-only motion capture, named game state, capture barrier, dimensions in the returned result, multimodal MCP image result, visual comparison, or frame/performance trace.
7. Builds, tests, shader validation, asset validation, and packaged artifacts are not runnable or inspectable through the development client. The current build tracker observes file/reload convergence; it is not a build or test executor.
8. Logs, browser console records, shader compiler diagnostics, and MCP call history are not all available to agents through MCP. The existing MCP history is protected and useful, but Studio-only.
9. The local HTTP MCP endpoint has no caller credential or per-client grants. Any local process that can reach the loopback port receives the same host-supplied point-light authority. There is no mutation lease tied to a principal.
10. Several current results expose absolute project/capture paths and process IDs. Those can reveal a local username or machine layout even though capture pixels are correctly scoped to the game canvas.

The recommended order is therefore: establish observation/evidence identities and authority first; add deterministic input and motion evidence second; add generic registered authoring, build/test, shader, asset, and profiling tools only on those foundations.

## Sources and architectural constraints

The current contract comes from these implementation areas:

- [`packages/cli/src/mcp/tools.ts`](../../../packages/cli/src/mcp/tools.ts) and [`server.ts`](../../../packages/cli/src/mcp/server.ts): tool catalog, schemas, annotations, dispatch, JSON-RPC behavior, and standard-input/output transport.
- [`packages/cli/src/development`](../../../packages/cli/src/development): the browser-safe typed client and read projections shared by Studio, CLI, and MCP adapters.
- [`packages/cli/src/host`](../../../packages/cli/src/host): project-session lifecycle, game host, build watcher, runtime publication ordering, action broker, inspection HTTP service, capture persistence, and MCP audit log.
- [`packages/framework/src/inspection`](../../../packages/framework/src/inspection) and [`sessions/engine-session`](../../../packages/framework/src/sessions/engine-session): validated inspection, bounded semantic JSON, event history, world views, and fixed-step session contracts.
- The user-facing [MCP overview](../../user-facing-docs/mcp/overview.md), [tool reference](../../user-facing-docs/mcp/tools.md), and [inspection guide](../../user-facing-docs/framework/inspection.md).
- Accepted decisions for [MCP Tools](../../adr/cli/0001-use-mcp-tools-for-development_H.md), [the typed project-service API](../../adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md), [CLI project-service authority](../../adr/cli/0003-make-cli-project-services-the-development-authority_H.md), [one engine API for people and agents](../../adr/framework/0003-agent-native_H.md), [commands as the mutation boundary](../../adr/framework/0007-commands-as-mutation-boundary_H.md), [separate authoring/runtime/render state](../../adr/framework/0009-separate-state-projections_H.md), and [explicit simulation input](../../adr/framework/0013-explicit-simulation-inputs_H.md).
- The production requirements synthesized in [recommended-library.md](../skill-research/recommended-library.md) and [orchestration-and-library-design.md](../skill-research/orchestration-and-library-design.md).

These constraints should remain true as the tool surface grows:

- CLI project services remain the local development authority. MCP and Studio are adapters, not alternate engines or state owners.
- Antiky owns worlds, sessions, commands, facts, inspection, and the authoring-to-runtime-to-render projection. BroMetal owns typed shader compilation, GPU resources, and WebGPU execution behind an Antiky-owned `RenderDriver`.
- External callers mutate important state only through registered, versioned commands with trusted caller identity, permission checks, deduplication, expected revisions, and structured outcomes.
- Framework core remains independent of MCP, Studio, DOM, Node.js, and BroMetal imports.
- Broad desktop or terminal capture is not an Antiky evidence path. Game-canvas, game-window, or controlled offscreen capture is the default.

## Verified current architecture

### One authority, four adapters

The actual flow is:

```text
game source / shaders / assets / .antiky manifest
              |
              v
CLI project service (`startDevelopmentSession`)
  - child process supervision
  - passive build/reload tracker
  - CLI-owned loopback game host and canvas
  - runtime publication store
  - one-at-a-time action broker
  - protected inspection HTTP API
  - unauthenticated loopback MCP POST endpoint
              |
       typed DevelopmentClient
      /          |             \
Studio       `antiky inspect`   `antiky mcp` stdio adapter
                                 and `antiky tool`
              |
              v
Framework inspection snapshot and registered game controls
```

`antiky dev` owns startup and cleanup. Studio starts the same project-service library rather than parsing a shell process. A detached client locates a live session through a protected descriptor in `.antiky/dev-session.json`. The descriptor includes the project revision, inspection origin, per-session bearer credential, development-session ID, and owner PID. It is created with mode `0600` under a `0700` directory and ignored by Git.

The public development client accepts only an exact `http://127.0.0.1:{port}` origin. Snapshot reads have a default two-second timeout; actions have a default fifteen-second client timeout. The host's action broker times out after ten seconds by default.

### Transport and trust boundaries

| Surface | Current authentication and locality | Current role |
| --- | --- | --- |
| `POST /mcp` | Bound to `127.0.0.1`; exact Host and allowed Origin checks; **no bearer credential** | Stateless Streamable HTTP-style MCP request/response; no persistent SSE stream |
| `antiky mcp` | Reads the selected project's protected session descriptor, then authenticates to the REST development client | Standard-input/output MCP adapter for clients without HTTP MCP |
| Protected development REST | Per-session bearer credential, exact loopback origin, bounded Studio/game CORS allowlist | Typed snapshots, MCP call log, and actions |
| Browser runtime REST | Bearer credential bootstrapped only from the exact game origin | Snapshot/disconnect publication, action polling, action completion |
| Game host | Exact `127.0.0.1` bind and bounded build-file serving under `dist/` | Owns the canvas, input collection, module lifecycle, capture, and runtime adapter |

The MCP endpoint supports protocol headers `2025-03-26`, `2025-06-18`, and `2025-11-25`; the CLI client initializes only with `2025-11-25`. It accepts only HTTP `POST`, requires clients to accept both `application/json` and `text/event-stream`, returns JSON, and responds `202` to notifications. It does not maintain an event stream. The standard-input/output adapter accepts newline-delimited JSON with a 256 KiB per-line limit. HTTP MCP requests use the inspection server's 256 KiB message limit. `antiky tool` applies a separate 64 KiB JSON-input limit.

The endpoint advertises Tools only. It does not advertise MCP Resources or Prompts. This matches CLI ADR 0001: a Resource should be added only for a distinct URI workflow, not as a duplicate of a Tool response.

## Verified MCP tool inventory

All current tool inputs are closed JSON objects with `additionalProperties: false`. Every successful tool response includes the same value twice: JSON text in `content[0]` and the value in `structuredContent`. There are no declared MCP output schemas.

### Read tools

| Tool | Exact input | Result and identity evidence | Availability and limits |
| --- | --- | --- | --- |
| `get_dev_status` | `{}` or omitted | Schema v1; development-session ID; accepted build revision; start time; project name, absolute manifest/root paths, project hash, URL, ports and configured viewport; child states/PIDs/exit codes; connection and cleanup state; launch/cleanup timing | Reads CLI state even before a runtime exists. It does not include current runtime ID, publication sequence, last-contact age, or build attempt ID. |
| `get_latest_build` | `{}` or omitted | Schema v1; development-session ID; accepted build revision; current build record with owner, revision, change kind, result, optional changed path and duration | The tracker reports `initial`, `source`, `shader`, `asset`, or `project`; `pending`, `ready`, or `failed`. Pending attempts reuse the current accepted integer revision and have no distinct attempt identity. |
| `get_runtime_status` | `{}` or omitted | Schema v1; development-session ID; accepted build revision; connection state; complete latest Framework inspection or `null` | `null` means nothing has ever been accepted. A timed-out or explicitly disconnected runtime can leave a non-null **last retained** inspection alongside `connection.state: "unavailable"`. |
| `get_render_stats` | `{}` or omitted | Schema v1; development-session ID; runtime ID or `null`; runtime owner/frame count/optional FPS; render owner/optional canvas width, canvas height, draw calls, instances, and upload bytes per frame | Missing runtime or render facts become `null`. No CPU/GPU frame time, percentiles, hitches, memory, adapter, pass, material, texture, or shader information exists. |
| `get_diagnostics` | `{}` or omitted | Schema v1; development-session ID; CLI diagnostics and Framework diagnostics | CLI diagnostics currently represent the active build failure; Framework publishes at most 64 runtime/render diagnostics. There is no cursor, time, historical log, stack, source location, or explicit freshness. |
| `get_session_status` | `{}` or omitted | Schema v1; development-session ID and Framework engine-session schema v2: session/world/runtime IDs, mode, fault, pause reasons, immutable system order, fixed-step limits and counters, command/control/world revisions, last step and digest | Returns `ANTIKY_RUNTIME_UNAVAILABLE` only when no session view is published. It does not reject merely because the connection is currently unavailable, so retained status can be stale. |
| `get_world_inspection` | `{}` or omitted | Schema v1; development-session ID and one Framework-owned world: world/runtime IDs, revision, counts, incompleteness, entities, component summaries/data, real `ChildOf` relationships, named authoring/runtime/render stores | Returns the entire retained view. Maximums are 512 entities, 2,048 components, 1,024 relationships, 64 stores, and 2,048 total store entries. There is no selector, entity lookup, changed-since query, page cursor, or multiple-world selection. |
| `get_event_log` | `{}` or omitted | Schema v1; development-session ID and one Framework event source: source/world/runtime IDs, counts, retention, and accepted facts in source sequence order | At most 512 events. History declares lifetime, storage, overflow, capacity, and dropped count. It excludes simulation steps, rejected commands, diagnostics, and MCP calls. No filters or after-sequence input exist. |
| `list_point_lights` | `{}` or omitted | Schema v1; development-session, runtime and world IDs; point-light event sequence; all authored point-light records and revisions | Requires the optional point-light inspection extension. At most 256 lights. Retained data can be stale if connection state is not separately checked. |
| `get_point_light` | `{entityId}` where `entityId` is canonical lowercase UUIDv7 | Same envelope plus either `pointLight: null` or authoring record, runtime projection, optional render binding/slot, and accepted power-change facts for that entity | A valid unknown entity returns `null`; malformed ID is JSON-RPC invalid params. It has no expected world/runtime/revision input. |

World component data, store data, and event data are semantic JSON copies. Each copied value is bounded to 8 KiB, eight nested levels, 128 array items or object fields, 4,096 string characters, and 128-character keys. The top-level world response itself has no explicit byte/page limit, so the theoretical aggregate can still be large and is duplicated as text plus structured content by MCP.

### Mutation and action tools

| Tool | Exact input | Authority and behavior | Result/evidence and failure behavior |
| --- | --- | --- | --- |
| `dev_reload` | `{}` or omitted | Enqueues one browser reload against the currently connected runtime. The browser reloads the page; the host completes only after a different runtime ID publishes a ready/running/paused snapshot. | Returns action ID, development-session ID, current integer build revision, old/new runtime IDs, and `reloaded`. It does **not** accept or enforce an expected accepted-build revision, require `build.result: ready`, or preserve runtime-instance event history. |
| `capture_frame` | `{}` or omitted | The connected game host calls `canvas.toDataURL('image/png')`; host validates a PNG up to 32 MiB and atomically writes it under `.antiky/captures/` with file mode `0600`. | Returns action/capture/session/runtime IDs, build revision, MIME type, byte length, SHA-256, and **absolute path**. Incoming canvas dimensions are validated but not returned. No frame/session/world/event identity or capture-time barrier is returned. |
| `pause_simulation` | `{}` or omitted | Adds only the trusted local `tool` pause reason through the game's registered inspection control. One host action is active at a time. | Returns action/session IDs, structured `EngineControlResult`, and resulting complete session status. Repetition is safe and can return `NO_OP`. Other pause reasons remain. |
| `resume_simulation` | `{}` or omitted | Removes only the `tool` pause reason. | Same envelope. The session can remain paused for `user` or `visibility`; repetition can return `NO_OP`. |
| `step_simulation` | `{expectedCompletedStepCount: non-negative safe integer}` | Calls the registered game control while it is paused. The session captures the browser's **current** semantic input, advances one fixed step when accepted, and requests one paused render. | Same envelope. `STALE_COMPLETED_STEP` makes retries safe. Other domain codes include `SESSION_RUNNING`, `SESSION_BUSY`, `SESSION_FAULTED`, `SESSION_DISPOSED`, `COUNTER_LIMIT`, and direct-API invalid-input codes. No input payload or seed can be supplied through MCP. |
| `set_point_light_power` | `{commandId, worldId, entityId, expectedRevision, power}` | IDs must be lowercase UUIDv7; power is finite from 0 through 4. The CLI host, not the caller, injects principal `antiky-local-development`, receipt time, runtime ID, and `world.light.edit`. The game command service validates, deduplicates, revision-checks, projects, and records a fact. | Returns point-light result schema v1 with stable code, accepted boolean, command/world/entity/runtime IDs, current/resulting revision, event sequence, and optional fact. Rejections are normal tool results, not MCP `isError`. |
| `correct_point_light_power` | `{commandId, correctedCommandId, expectedRevision}` | Submits a new correction request; it never deletes accepted history. The service derives the prior power and records a new fact when accepted. | Same result shape and domain codes. Correction restores that field's earlier value; it is not a general transaction rollback. |

MCP annotations mark all reads as read-only, non-destructive, idempotent, and closed-world. All actions are marked non-destructive and closed-world. Pause, resume, and step are marked idempotent; other actions are not. `capture_frame` is correctly treated as state-changing because it writes a new file. The `dev_reload` non-destructive annotation deserves reconsideration because replacement discards runtime-instance in-memory state and event history even though it does not edit authored files.

Point-light domain results use these current codes:

```text
ACCEPTED, NO_OP, INVALID_COMMAND, WORLD_NOT_FOUND, ENTITY_NOT_FOUND,
MISSING_PERMISSION, DUPLICATE_COMMAND, STALE_REVISION, VALUE_OUT_OF_RANGE,
HISTORY_CAPACITY_REACHED, EVENT_SEQUENCE_ERROR
```

The command and correction inputs are limited to 4 KiB at the Framework/REST boundary. The service retains at most 256 command results and 256 point-light facts.

## Verified non-MCP inspection surfaces

The MCP catalog is not the complete inspection system. These additional surfaces matter to Studio, tests, and future skills.

### CLI and exported library

| Surface | Verified behavior |
| --- | --- |
| `antiky inspect [--project]` | Reads the selected live session's protected `/v1/development` snapshot and prints the complete development plus Framework inspection JSON. It can print absolute paths and child PIDs. |
| `antiky tool <name> [json]` | Initializes the local HTTP MCP server for each invocation, calls one tool, prints `structuredContent`, and exits `1` for MCP `isError`. Unknown tools/invalid params become `ANTIKY_ARGUMENT_INVALID`. |
| `antiky mcp [--project]` | Starts only a stdio adapter. It does not start development; it reads the selected active session descriptor and forwards operations through the typed client. |
| `startDevelopmentSession` | Typed library authority for project startup, snapshots, connection descriptor, idempotent stop, and cleanup result. It is used by the CLI and Studio worker. |
| `connectDevelopmentClient` / `createDevelopmentClient` | Detached Node helper and browser-safe explicit client. Methods cover snapshots, call history, reload, capture, world/events, point lights, point-light commands, session status and control. |
| `inspectDevelopmentSession` | Convenience wrapper around one complete snapshot read. |

`antiky init`, `antiky migrate`, `antiky studio`, `antiky generate id`, and `antiky asset install` are current CLI operations but are not live inspection/MCP tools. Of particular relevance, `antiky asset install <provider:slug>` is already a bounded catalog mutation: it validates the project, downloads only a known install-verified catalog record, verifies size and upstream hashes, writes below the project's asset directory, and records provenance. Agents cannot currently discover or invoke that flow through MCP. The `.antiky` manifest declares a build command, but the live development client does not expose an operation that executes it.

### Protected development HTTP

| Route | Direction | Schema role |
| --- | --- | --- |
| `GET /v1/development` | Studio/detached client reads host | Complete `DevelopmentSnapshot` schema v1 |
| `GET /v1/mcp-calls` | Studio/detached client reads host | Bounded session-scoped MCP tools/call history |
| `POST /v1/actions/reload` | client requests host action | Exact `{schemaVersion: 1}` |
| `POST /v1/actions/capture` | client requests host action | Exact `{schemaVersion: 1}` |
| `POST /v1/actions/pause-simulation` | client requests host action | Exact `{schemaVersion: 1}` |
| `POST /v1/actions/resume-simulation` | client requests host action | Exact `{schemaVersion: 1}` |
| `POST /v1/actions/step-simulation` | client requests host action | Schema plus expected completed-step count |
| `POST /v1/actions/set-point-light-power` | client requests host action | Schema plus full Framework command |
| `POST /v1/actions/correct-point-light-power` | client requests host action | Schema plus full Framework correction request |

These routes require the per-development-session bearer credential. The typed client does not put the credential into its enumerable public object. It checks that snapshot and call-log results belong to the expected development session and reparses Framework inspection. However, action response bodies are currently cast to their TypeScript type rather than fully parsed by a shared runtime validator at the client boundary.

### Browser runtime protocol

| Route | Verified behavior |
| --- | --- |
| `GET /v1/browser/bootstrap` | Exact game Origin obtains development-session ID, game URL, and credential. |
| `POST /v1/runtime/snapshot` | Browser publishes an exact envelope with a positive per-runtime publication sequence and a fully validated Framework snapshot. |
| `POST /v1/runtime/disconnect` | Browser explicitly retires the runtime using the next publication sequence. |
| `GET /v1/runtime/action?runtimeInstanceId=...` | Browser polls every 250 ms. Polling touches the active runtime connection. It receives at most the one active broker action. |
| `POST /v1/runtime/action-result` | Browser posts a capture, point-light result, or session-control result tied to the exact action and runtime IDs. |

The browser publishes inspection every 250 ms and on important host transitions. Publications from one runtime must start at sequence 1 and increase. A replacement runtime must also start at 1. The host retains up to 32 retired runtime IDs and rejects retired IDs, duplicate/out-of-order publications, stale disconnects, mismatched development sessions, malformed snapshots, and oversized messages.

The connection state is:

- `waiting` before any snapshot is accepted;
- `connected` while publications/action polling have contacted the host within three seconds;
- `unavailable` after timeout or explicit disconnect.

The last accepted inspection is intentionally retained when state becomes unavailable. That is useful for human diagnosis, but the current narrow read projections do not label it stale or expose its publication sequence/age.

### Framework publication schema

Every runtime snapshot contains:

- runtime instance ID and lifecycle (`initializing`, `ready`, `running`, `paused`, `error`, or `stopped`);
- up to 64 stable-code Framework diagnostics;
- frame count and optional FPS;
- optional canvas/draw/instance/upload measurements;
- optional engine-session status;
- optional point-light inspection;
- optional world inspection;
- optional event history.

The validator cross-checks runtime identity across the top-level runtime, engine session, point-light projection, world view, and event source. It also cross-checks world identity among all published semantic views. Invalid publications are rejected as a whole; the host does not keep a partial snapshot.

This is an important strength: a game is free to publish useful domain components and stores, as the combat and traversal demos do, without exposing engine objects. The limitation is that publication is optional and game-authored. The CLI has no capability manifest telling an agent which component schemas, stores, commands, input schemas, scenarios, or capture modes a particular game supports.

## Identity, revision, and retention model

| Identity or counter | Current creation and lifetime | Current visibility |
| --- | --- | --- |
| Project identity | Canonical `.antiky` manifest path; manifest SHA-256 is project revision | Full absolute path/hash in development status |
| Development session | `randomUUID()` per project-service run | Present on every development projection and action result |
| Accepted build revision | Integer local to one development session; first ready runtime makes it 1 | Present on development/build/runtime reads and capture/reload result |
| Build attempt | **No stable ID**; pending state reuses the accepted revision | Change kind/path/result/duration only |
| Runtime instance | Browser `randomUUID()` per page/module lifetime | Present in Framework snapshot and runtime-backed results |
| Runtime publication sequence | Positive integer starting at 1 per runtime | Validated by host but **not exposed** in public snapshot/tool results |
| Engine session | Canonical lowercase UUIDv7 | Session status |
| World | Canonical lowercase UUIDv7 | Session, world, events, point lights, commands |
| Entity | Canonical lowercase UUIDv7 | World/entities, events, point lights, commands |
| Command | Canonical lowercase UUIDv7 | Point-light requests/results/facts and generic event entries |
| Action | `action-` plus random UUID, local to a development action | Action result and MCP call-log correlation |
| Capture | `capture-` plus random UUID | Capture result and filename |
| MCP call | Monotonic session sequence plus `mcp-call-` random UUID | Protected MCP call log only |
| World/entity/control revision | Non-negative integer owned by the applicable Framework service | Session/world/entity/point-light status and command outcomes |
| Event sequence | Contiguous positive integer owned by one event source | Event history; point-light inspection also publishes its current sequence |
| Frame count | Runtime measurement | Render stats, but not capture metadata |

UUIDv7 is required for durable world/entity/command/session identities. Names, labels, paths, render slots, and other runtime aliases are not durable identity. Current development/runtime/action/capture IDs are bounded correlation identifiers, not UUIDv7 domain IDs.

Retention is explicit for Framework event history and MCP calls:

- Framework events declare runtime-instance/session/durable lifetime, memory/persistent storage, reject-new/drop-oldest overflow, capacity, and dropped count.
- The host MCP call log is in memory for one development session, holds at most 100 calls, reports source order and dropped count, and expires on stop.

The call log records only `tools/call`, not discovery, initialization, or its own protected HTTP read. It records arguments, result or error, duration, semantic correlation IDs, and redaction/truncation markers. Fields whose names resemble authorization, credential, password, secret, token, or API key are redacted recursively. Values are bounded to 16 KiB, eight levels, and 64 items.

Two limitations matter for evidence:

- MCP labels any non-`isError` domain result as `success`, so `STALE_REVISION`, `SESSION_RUNNING`, or another structured rejection is not distinguished in the call-log outcome.
- Redaction is key-name based. Absolute project/capture paths, usernames embedded in other strings, game-authored component data, and prompt-injection-like text are not inherently removed.

## Lifecycle barriers: what is enforced and what is advisory

### Enforced today

1. Project selection validates one canonical, non-symlink `.antiky` file, project-relative working directories, loopback ports, and manifest hash.
2. A runtime publication is accepted only for the active development session and a fresh per-runtime publication sequence.
3. Initial accepted build revision appears only after a runtime publishes a ready/running/paused lifecycle.
4. After a watched source/asset/project change, a ready build requires a different runtime ID. A shader change additionally requires the expected `.shader.gen.ts` file to change before the new runtime can satisfy the barrier.
5. Only one browser action can be pending for a development session. Another request receives `ANTIKY_ACTION_BUSY`.
6. An action is tied to its development session, runtime instance, action ID, and current integer build revision. Stale or malformed browser completions cannot resolve it.
7. Reload resolves only when a different runtime connects after the reload action was delivered.
8. Fixed-step retry safety is an expected-completed-step compare-and-set.
9. Point-light mutation uses command deduplication, target world/entity IDs, an expected entity revision, permission, event sequencing, and correction facts.
10. Capture persistence is atomic. A late completion after timeout/stop is rejected and a late file is removed.

### Advisory or missing today

- `dev_reload` describes `get_latest_build -> ready -> get_runtime_status -> connected`, but its input is empty. The broker enforces connected runtime only, not ready latest build or the revision the caller observed.
- `capture_frame` describes a prior runtime check, but it accepts no expected runtime, frame, session/world revision, completed-step count, or event sequence.
- Runtime-backed read helpers check whether a view exists, not whether connection state is currently connected or whether runtime lifecycle is usable.
- The latest runtime snapshot has no public publication sequence, timestamp, or age. Separate tool calls cannot prove they observed the same publication.
- A successful session-control completion contains an internally consistent result and session status, but the next periodic complete world/event snapshot may arrive later.
- A successful point-light result includes its resulting revision and event sequence, but other world/store projections may be observed before the next publication.
- File changes can replace an earlier pending build attempt. There is no attempt ID, source digest, dirty-state snapshot, or artifact manifest.
- Child process stdout/stderr is printed, not retained as bounded structured evidence. Build failure is inferred after a timeout when no ready replacement runtime appears.
- The declared project `build.command` is not part of this live barrier. Development convergence and production/package build success are different facts.

## Error and availability semantics

### MCP protocol layer

The server uses JSON-RPC errors for malformed protocol or tool invocation:

- `-32700`: parse error;
- `-32600`: invalid request or oversized stdio line;
- `-32601`: unknown JSON-RPC method, including Resource methods;
- `-32602`: invalid tool-call shape, unknown tool, extra/missing fields, invalid UUID/range.

Operational failures are HTTP/JSON-RPC successes containing an MCP tool result with `isError: true` and:

```json
{
  "schemaVersion": 1,
  "error": { "code": "ANTIKY_RUNTIME_UNAVAILABLE", "message": "..." }
}
```

Known `AntikyCliError` code/message values pass through. Unknown failures are reduced to `ANTIKY_INTERNAL_ERROR` and a safe generic message. `AntikyCliError.path`, HTTP status, retryability, expected/actual identities, and recovery guidance are not included.

The CLI MCP client maps unknown method/invalid params to `ANTIKY_ARGUMENT_INVALID`; other protocol, HTTP, timeout, invalid JSON, or incompatible result failures become `ANTIKY_SESSION_UNAVAILABLE`. It does not throw for MCP `isError`; `antiky tool` prints the structured error and exits 1.

### Protected HTTP and typed client

The inspection server uses stable HTTP errors for invalid host/origin/credential/content type, malformed/oversized messages, stale session/publication/runtime/action, and action failures. Action status mapping currently uses 503 for runtime unavailable, 504 for timeout, 400 for invalid capture, 500 for capture persistence failure, and 409 for other `AntikyCliError` action conflicts.

The browser-safe client preserves these action errors explicitly:

```text
ANTIKY_RUNTIME_UNAVAILABLE
ANTIKY_ACTION_BUSY
ANTIKY_ACTION_TIMEOUT
ANTIKY_CAPTURE_SAVE_FAILED
```

Invalid command/message payloads become `ANTIKY_ARGUMENT_INVALID`. Other returned action codes, including some stale/invalid-capture cases, collapse to `ANTIKY_SESSION_UNAVAILABLE` at this client boundary. Read HTTP 401 becomes `ANTIKY_UNAUTHORIZED`; other read failures become session unavailable.

Point-light and engine-control rejections are domain result codes, not thrown transport errors. That is appropriate for expected conflicts, but all clients and audit views need an explicit way to distinguish accepted, no-op, and rejected results.

## Evidence available today

An agent can currently assemble this evidence packet manually:

- project manifest hash, development-session ID, accepted build revision, latest watched change and duration;
- runtime, session, and world identities;
- fixed step, input sequence, command/control/world revision, system order, and optional state digest;
- bounded entities, component summaries, semantic stores, hierarchy, and completeness counts;
- accepted domain facts and event-source retention;
- frame count/FPS and a small renderer-count set;
- one exact game-canvas PNG with SHA-256 and byte length;
- a protected, bounded MCP call history readable by Studio or a typed client;
- stable diagnostic and domain result codes.

This is substantially better than inferring state from a screenshot. It still cannot prove:

- which exact inspection publication produced a capture;
- which input sequence or seed produced a game state;
- that a path through a level is reachable or a combat interaction works;
- motion quality, input response, animation timing, VFX readability, or camera behavior;
- shader permutation validity or runtime material/pipeline state;
- build/test/package success and artifact provenance;
- frame-time percentiles, GPU time, hitches, memory, loading, or target-device performance;
- visual regression against an approved baseline;
- asset import integrity, references, scale, compression, animation, collision, or provenance;
- player comprehension, accessibility, fun, or release quality.

A successful call, green compiler, static screenshot, and self-authored explanation remain separate pieces of evidence. None should be promoted into a quality verdict on its own.

## Current test inventory

The current surface is not untested. The CLI suite has unusually good coverage of the contracts it does implement.

| Test file | Verified coverage |
| --- | --- |
| [`mcp-server.test.ts`](../../../packages/cli/tests/mcp-server.test.ts) | Exact 17-tool order, rich descriptions, strict input schemas, annotations, dispatch for every read/action, UUID/range rejection, absence of duplicate Resources, unknown methods/tools, stdio request handling, and stable tool-failure envelope |
| [`development-session.test.ts`](../../../packages/cli/tests/development-session.test.ts) | Real loopback HTTP MCP startup; protocol and Origin behavior; protected REST; CLI tool parity; call-log integration; browser snapshot boundary; direct/typed/HTTP/MCP/human CLI parity for point lights and session controls; runtime disconnect/reconnect; reload/capture identity; large PNG persistence; cleanup and child lifecycle |
| [`actions.test.ts`](../../../packages/cli/tests/actions.test.ts) | Trusted point-light context separation, result validation, exact session-control relay, single-action timeout, stale completion, stop cancellation, late-capture removal, atomic persistence failure, and freeing the broker |
| [`build-tracker.test.ts`](../../../packages/cli/tests/build-tracker.test.ts) | Accepted revision only after a newer ready runtime, ignored dependency/output trees, create/rename/delete/nested-file detection, and repeated source/shader convergence timing |
| [`runtime-connection.test.ts`](../../../packages/cli/tests/runtime-connection.test.ts) | Timeout, explicit disconnect, reconnect, retired runtime, and stale publication distinctions |
| [`mcp-call-log.test.ts`](../../../packages/cli/tests/mcp-call-log.test.ts) | Source order, capacity/drop count, outcome projection, recursive secret redaction, truncation markers, correlation IDs, self-read exclusion, and shared-client validation |
| [`development-browser-client.test.ts`](../../../packages/cli/tests/development-browser-client.test.ts) | Exact loopback input, bearer use without enumerable exposure, session matching, invalid snapshot/call history, and browser-safe import boundary |
| [`world-development.test.ts`](../../../packages/cli/tests/world-development.test.ts) | World/event projection from the shared Framework snapshot and unavailable optional views |
| [`point-light-development.test.ts`](../../../packages/cli/tests/point-light-development.test.ts) | Shared point-light projection, null render binding, no copied authority, invalid IDs, and unavailable optional view |
| [`session-development.test.ts`](../../../packages/cli/tests/session-development.test.ts) | Shared session-status projection and missing-view availability error |
| [`browser-envelope.test.ts`](../../../packages/cli/tests/browser-envelope.test.ts) | Exact browser publication/action envelopes and bounded failures that do not echo secrets |

Framework tests additionally validate immutable cloning, cross-view identity agreement, bounded JSON, hierarchy cycles, store completeness, event retention/sequence, fixed-step concurrency, command deduplication, point-light projection, and correction history.

The important missing tests correspond to missing capabilities rather than simple holes in the existing suite: there is no observation-token contract, stale-read policy, expected-build reload, capture-state barrier, explicit input replay, motion capture, visual diff, structured log stream, build/test job, shader/material inventory, asset import validation, generic command registry, sandbox promotion, performance trace, or per-client MCP authority to test.

## Concrete gaps across the edit-run-observe loop

### 1. Orient: capabilities and freshness are implicit

An agent starts with `get_dev_status`, but it still must guess which optional Framework views and game controls exist. Missing session/world/events/point-lights are discovered only by trying a tool and receiving runtime unavailable. Tool discovery says what Antiky globally implements, not what this game/runtime currently publishes.

There is also no common read token. `get_session_status`, `get_world_inspection`, `get_event_log`, and `get_render_stats` can each represent a different 250 ms publication. They cannot be joined without inference. The hidden publication sequence is the natural missing identity.

### 2. Edit: only one hard-coded authoring field is writable

Point-light power proves the right mutation architecture: registered schema, command ID, target world/entity, expected revision, trusted authority, structured outcome, one accepted fact, and a correction rather than erased history. But the tool catalog hard-codes this one domain. Agents cannot discover or submit a game's own registered commands for transforms, encounters, UI tuning, materials, camera parameters, animation, audio, spawn rules, or other authored components.

Direct generic JSON property writes would violate the command ADR. The missing abstraction is a versioned command/capability registry plus bounded command submission—not access to live objects or arbitrary JavaScript.

There is no sandbox world/session, mutation lease, change set, preview diff, promotion, or discard operation. The global action broker serializes delivery but does not establish which agent owns the right to mutate or prevent simultaneous file edits/browser input.

### 3. Run: a passive reload watcher is not build/test automation

The build tracker is valuable as a development convergence barrier. It watches known extensions, expects generated shader output, waits for a replacement ready runtime, and emits a stable failure after a timeout. It does not execute the manifest's build command, know a compiler exit code, collect structured diagnostics, identify all source inputs, produce an artifact manifest, run unit or integration tests, validate every shader permutation, validate assets, or launch a packaged game.

There is no long-running job protocol, progress, cancellation, artifact retention, or distinction between development hot reload and package/release build.

### 4. Control: stepping is deterministic only with respect to the browser's current input

`EngineSession` has the correct fixed-step model and explicit captured input internally. MCP can pause, resume, and compare-and-set one step, but cannot supply the semantic input, seed, or scenario state. Hidden keyboard/pointer state in the host can therefore change the result. There is no recorded input trace, checkpoint expectation, reset, replay, soft-lock timeout, or state/event delta bundle.

The missing tool must consume a game-registered semantic input schema. It must not emulate arbitrary desktop keyboard/mouse input or invent a universal game input object.

### 5. Observe: whole snapshots and one PNG do not support fast diagnosis

Whole-world reads are useful for small fixtures but inefficient for production worlds and model context. An agent needs stable-ID lookups, component/store selectors, changed-since revisions, event filters, explicit pages, and completeness at every query boundary. Labels can aid discovery but must never become mutation identity.

The current PNG is canvas-scoped and exact, which is the correct privacy boundary. Its evidence metadata is too weak for reproducible review. It omits dimensions, device pixel ratio, capture-time frame/session/world/event state, color/alpha information, and whether the requested paused frame had actually presented. The MCP response is JSON text plus a path, not an MCP image content block.

Most gameplay quality is visible in motion. There is no controlled canvas-only sequence capture, encoded frame count/rate, dropped-frame report, input trace link, or start/end observation. Static images cannot establish movement, anticipation, contact, recovery, input latency, camera motion, animation, VFX timing, or game-loop readability.

### 6. Diagnose: logs and profiles are absent or too shallow

The host turns game startup/frame exceptions into a safe Framework diagnostic, and CLI/build failures have stable codes. Child stdout/stderr and browser console records are not retained as a bounded structured log. Shader diagnostics are inferred from a timeout. The agent-visible renderer stats are averages/counts rather than a scenario trace.

There is no source cursor, timestamped fault sequence, code location, sanitized stack, pipeline creation error, WebGPU validation/error-scope record, GPU adapter capability summary, frame-time distribution, hitch record, loading time, or memory/resource budget.

### 7. Decide and audit: evidence is manually assembled

The protected MCP log is a good audit primitive, but agents cannot read it through the MCP surface. It treats domain rejection as call success and has no change-set, build job, trace, capture-sequence, or review identity. No operation returns a complete evidence manifest linking inputs, observations, artifacts, hashes, and outcomes.

Absolute paths in development and capture results can reveal a username or local layout. Returning them is unnecessary for most agent decisions. Captures themselves are safely scoped, but metadata also needs privacy minimization.

## Proposed common contracts

The following are proposals, not current schemas. Define these shared contracts before adding many new tools so every later tool has the same identity, authority, failure, and evidence behavior.

### `ObservationRefV1`

Every runtime-backed read and action should carry one immutable observation reference:

```ts
type ObservationRefV1 = Readonly<{
  schemaVersion: 1;
  developmentSessionId: string;
  projectRevision: string;
  acceptedBuildRevision: number;
  runtimeInstanceId: string | null;
  runtimePublicationSequence: number | null;
  publishedAt: string | null;
  connection: 'waiting' | 'connected' | 'unavailable';
  stale: boolean;
  sessionId?: SessionId;
  worldId?: WorldId;
  completedStepCount?: number;
  commandSequence?: number;
  controlRevision?: number;
  worldRevision?: number;
  eventSequences?: Readonly<Record<string, number>>;
  frameCount?: number;
}>;
```

The host, not each tool, should create it from one accepted publication. `stale` must be true when the connection is unavailable, the snapshot exceeds a declared age, or the runtime lifecycle cannot satisfy the operation. Tools should reject stale state by default and accept an explicit `allowStale: true` only for diagnosis-oriented reads.

### Expected observation and compare-and-set

Every live mutation should accept the narrow identities it relies on:

```ts
type ExpectedObservationV1 = Readonly<{
  developmentSessionId: string;
  acceptedBuildRevision: number;
  runtimeInstanceId: string;
  runtimePublicationSequence?: number;
  sessionId?: SessionId;
  worldId?: WorldId;
  completedStepCount?: number;
  controlRevision?: number;
  worldRevision?: number;
}>;
```

Failure must state which field differed without exposing secrets. Stable conflicts should include `STALE_DEVELOPMENT_SESSION`, `STALE_BUILD_REVISION`, `STALE_RUNTIME_INSTANCE`, `STALE_PUBLICATION`, `STALE_SESSION`, `STALE_WORLD_REVISION`, and `STALE_COMPLETED_STEP`.

### `EvidenceArtifactRefV1`

Binary/large evidence should not be duplicated into giant MCP JSON text or expose an absolute home path:

```ts
type EvidenceArtifactRefV1 = Readonly<{
  schemaVersion: 1;
  artifactId: string;
  kind: 'image' | 'video' | 'trace' | 'log' | 'test-report' | 'build' | 'diff';
  mimeType: string;
  byteLength: number;
  sha256: string;
  createdAt: string;
  projectRelativePath?: string;
  observation?: ObservationRefV1;
  metadata: Readonly<Record<string, InspectionJsonValue>>;
}>;
```

Return an MCP `image` content block for bounded still images when the client supports it. Otherwise return a protected artifact reference and an explicit retrieval mechanism. Never return an absolute path by default. Every artifact class needs retention, maximum size, cleanup, and consent rules.

### Standard operation/error envelope

Long operations need a job identity and a queryable status rather than holding one MCP request open:

```ts
type OperationStatusV1 = Readonly<{
  operationId: string;
  kind: string;
  state: 'queued' | 'running' | 'succeeded' | 'rejected' | 'failed' | 'cancelled';
  startedAt: string | null;
  completedAt: string | null;
  progress?: Readonly<{ completed: number; total?: number; unit: string }>;
  observation?: ObservationRefV1;
  artifacts: readonly EvidenceArtifactRefV1[];
  result?: InspectionJsonValue;
  error?: ToolErrorV1;
}>;
```

`ToolErrorV1` should include stable code, category (`argument`, `authority`, `availability`, `conflict`, `timeout`, `capacity`, or `internal`), retryable boolean, bounded human message, optional schema path, expected/actual non-secret identities, related IDs, and safe recovery tool names. Domain commands should still return expected rejections as domain results, but operation/audit logs must classify them as `accepted`, `no-op`, or `rejected`, not simply `success`.

### Capability and authority model

Every callable capability should declare:

- capability ID and schema version;
- read, test, capture, sandbox-mutation, primary-world mutation, filesystem-write, network, or process-execution class;
- whether it is currently available and why not;
- supported game input, command, component, store, scenario, renderer, shader, asset, and evidence schema IDs;
- required trusted permission and whether human approval is needed;
- supported limits, idempotency key, expected-observation fields, and correction/rollback behavior.

HTTP MCP should authenticate a local client principal and grant only the requested capability set. Loopback is a network boundary, not caller identity. The existing per-session descriptor credential can be adapted, or the host can issue short-lived client grants during initialization. A stable URL does not require anonymous mutation.

## Prioritized proposed additions

### P0 — make every current observation and action trustworthy

These changes should precede new high-authority tools.

#### `get_game_capabilities`

- **Input:** `{allowStale?: boolean}`.
- **Output:** `ObservationRefV1`; Framework/CLI/tool schema versions; runtime lifecycle; available optional views; registered input, command, component, store, event-source, scenario, capture, renderer, shader, asset, test and build capability descriptors; limits and unavailable reasons.
- **Authority:** authenticated read; no mutation.
- **Failures:** `SESSION_NOT_FOUND`, `RUNTIME_NOT_CONNECTED` unless stale diagnosis is explicitly allowed, `CAPABILITY_SCHEMA_INCOMPATIBLE`.
- **Evidence:** one hash of the capability manifest, project/tool revisions, and observation ref.

This replaces trial-and-error feature detection and lets a skill refuse unsupported work instead of inventing a tool.

#### Extend all current reads with `ObservationRefV1`

`get_runtime_status`, `get_render_stats`, `get_diagnostics`, `get_session_status`, `get_world_inspection`, `get_event_log`, and point-light reads should all identify the exact publication used. For backward compatibility, add the observation field in a new result schema version rather than silently changing schema v1.

- **Authority:** read.
- **Failure/default:** stale runtime-backed reads reject with `RUNTIME_OBSERVATION_STALE`; callers can opt into stale diagnosis and receive `stale: true` plus age.
- **Evidence:** publication sequence/time and all relevant identities.

#### Strengthen `dev_reload`, `capture_frame`, and session controls

- **Inputs:** add `expected: ExpectedObservationV1`; `dev_reload` must require the caller's accepted build revision; capture must require runtime and optionally exact completed step/frame/world/event state; pause/resume should accept expected control revision; step retains expected completed step.
- **Authority:** authenticated `development.reload`, `evidence.capture`, or `simulation.control`; one principal holds the session mutation lease.
- **Failures:** stable stale-field codes, `BUILD_NOT_READY`, `RUNTIME_LIFECYCLE_UNAVAILABLE`, `MUTATION_LEASE_REQUIRED`, `ACTION_BUSY`, `ACTION_TIMEOUT`.
- **Evidence:** before/after observation, action ID, delivered/completed times, domain outcome, and artifact reference where relevant.

`dev_reload` should be annotated/described as potentially discarding runtime-instance state. It should never reload a pending/failed build merely because a runtime is still connected.

#### `get_operation_log`

- **Input:** `{afterSequence?: number, limit?: number, outcomes?: string[], operationId?: string, correlationId?: string}`.
- **Output:** paged, source-ordered operations across MCP, typed-client, Studio, and browser actions; accepted/no-op/rejected/protocol/transport outcomes; redaction/truncation; observation/artifact correlations; retention.
- **Authority:** authenticated audit read. Exclude this read from recursively logging itself.
- **Failures:** invalid cursor/filter only; return explicit incomplete/retention instead of silently pretending history is complete.
- **Evidence:** call/operation ID, principal ID, capability grant ID, duration and result code, with secrets and private paths removed.

This generalizes the useful existing MCP-call log and makes it available to runtime QA without giving access to credentials.

#### Privacy-minimize current results

This is a schema correction rather than a new tool:

- replace `projectRoot`, `manifestPath`, capture absolute `path`, and raw PID in agent-facing projections with project-relative display paths, opaque process IDs/status, and artifact IDs;
- offer exact local paths only through a separately authorized local-filesystem client method;
- sanitize logs and game-authored text as untrusted data without destroying stable domain facts;
- test synthetic usernames, emails, home paths, terminal prompts, hostnames, credentials, and prompt injection.

### P1 — complete a reproducible play-and-observe loop

#### `get_entity`

- **Input:** `{expected?: ObservationRefV1, worldId, entityId, include?: ('components'|'relationships'|'stores'|'events')[], allowStale?: boolean}`.
- **Output:** exact entity label/revision, selected components, parent/children IDs, selected store entries, completeness, and observation ref.
- **Authority:** read.
- **Failures:** distinguish `WORLD_NOT_FOUND`, `ENTITY_NOT_FOUND`, `VIEW_NOT_PUBLISHED`, `OBSERVATION_STALE`, and query capacity.
- **Evidence:** stable IDs/revisions, not label/path selectors.

#### `query_world`

- **Input:** `{worldId, componentTypeIds?, parentEntityId?, storeIds?, changedAfterRevision?, cursor?, limit, allowStale?: boolean}` with strict maximums.
- **Output:** deterministic stable-ID order, requested entities/components/stores, page cursor, available/retained/matched counts, `incomplete`, and observation ref.
- **Authority:** read.
- **Failures:** invalid selector/cursor, unavailable view, stale observation. No arbitrary code or query language in v1.
- **Evidence:** query echo/hash, page bounds, observation.

#### `query_events`

- **Input:** `{sourceId?, afterSequence?, entityId?, commandId?, types?, cursor?, limit, allowStale?: boolean}`.
- **Output:** matching facts in source order; source/world/runtime IDs; retention/dropped counts; available/matched/returned counts; next cursor; observation ref.
- **Authority:** read.
- **Failures:** source not published, cursor expired, stale observation, invalid filters.
- **Evidence:** exact source sequence bounds and retention. Do not combine diagnostics, steps, or MCP calls into game event history.

#### `execute_input_trace`

- **Input:** registered `inputSchemaId` and version, caller-generated trace/command UUIDv7, expected paused sandbox observation, fixed seed/stream IDs where the game declares them, bounded run-length-encoded tick inputs, named checkpoints, maximum steps, and stop conditions.
- **Output:** accepted/rejected state; initial/final observations; per-checkpoint completed-step, state digest, selected world assertions, event-sequence ranges, render-request counts, and trace artifact hash.
- **Authority:** `simulation.trace.execute` on a test/sandbox session by default; primary interactive session requires explicit mutation lease. Never synthesize OS-level desktop input.
- **Failures:** `INPUT_SCHEMA_NOT_REGISTERED`, `SCENARIO_NOT_RESETTABLE`, `SESSION_NOT_PAUSED`, `STALE_COMPLETED_STEP`, `TRACE_TOO_LARGE`, `CHECKPOINT_FAILED`, `SOFT_LOCK_TIMEOUT`, and normal engine fault/busy/counter codes.
- **Evidence:** immutable trace artifact, build/runtime/session/world identity, initial state digest, exact tick/input sequence, checkpoint results, facts, diagnostics, and final digest.

This is the minimum bridge from Antiky's explicit-input ADR to reproducible agent QA.

#### `capture_gameplay_sequence`

- **Input:** expected observation, either a linked trace/operation ID or bounded duration/step range, capture FPS, maximum dimensions/bytes/duration, output format supported by the runtime, and `includeAudio: false` by default.
- **Output:** video artifact ref; exact canvas dimensions and device pixel ratio; encoding, frame count/rate, dropped frames, duration, start/end observations, linked input trace, and optional still thumbnails as MCP image content.
- **Authority:** `evidence.capture.motion`; game canvas/offscreen surface only. Audio/voice requires a separate consented grant. No desktop, terminal, notification, or unrelated window access.
- **Failures:** `CAPTURE_MODE_UNAVAILABLE`, `OBSERVATION_STALE`, `CAPTURE_LIMIT_EXCEEDED`, `ENCODER_UNAVAILABLE`, `CAPTURE_DROPPED_FRAMES`, `CAPTURE_SAVE_FAILED`.
- **Evidence:** video hash/bytes, dimensions, encoded FPS, actual frame count, time/step bounds, dropped frames, build/runtime/session/world/trace identities.

Keep `capture_frame`, but return dimensions and an image content/artifact reference tied to one observation. Motion capture is additive; it does not turn an automated trace into human playtest evidence.

#### `get_runtime_logs`

- **Input:** `{sources?: ('game'|'framework'|'render'|'webgpu'|'build'|'shader')[], severities?, afterSequence?, limit?, relatedId?}`.
- **Output:** paged timestamped structured records, stable code, source, bounded/sanitized message, optional safe source location/stack frames, related identities, retention and observation.
- **Authority:** authenticated read; raw child streams and arbitrary console objects never pass through unbounded.
- **Failures:** cursor expired/source unavailable; incompleteness is explicit.
- **Evidence:** source sequence, diagnostic code, observation, redaction/truncation markers.

### P1 — execute declared checks without arbitrary shell authority

#### `start_project_check`

- **Input:** `{checkProfileId, expectedProjectRevision, expectedDirtyState?, target?, configuration?}`. `checkProfileId` must name a command/profile declared and validated by the Antiky project schema; no arbitrary executable, argument, environment, cwd, or shell string is accepted.
- **Output:** `OperationStatusV1` in queued/running state.
- **Authority:** `project.check.execute`; local process execution but no network unless the selected profile separately declares an approved need. One check scheduler owns the process.
- **Failures:** `CHECK_PROFILE_NOT_FOUND`, `PROJECT_REVISION_STALE`, `DIRTY_STATE_MISMATCH`, `CHECK_BUSY`, `PROCESS_START_FAILED`, `CHECK_TIMEOUT`.
- **Evidence:** profile/tool/package versions, sanitized command identity, project/source revision, start/end time, exit/signal, structured diagnostics, test counts, and artifact refs.

#### `get_operation_status` and `cancel_operation`

- **Input:** operation ID; cancellation also requires expected state/revision.
- **Output:** common operation envelope with progress, terminal result, and artifacts.
- **Authority:** status read is narrow; cancellation requires the originating principal or explicit `operation.cancel` grant.
- **Failures:** not found/expired, already terminal (`NO_OP`), wrong principal, cancellation unsafe.
- **Evidence:** cancellation request/result and any partial artifacts marked incomplete.

Initial declared profiles should cover Antiky package typecheck/unit/integration tests, the manifest production build, BroMetal shader generation/validation, and asset validation. Packaged builds and platform signing/publishing remain separate higher-authority workflows.

### P2 — generalize safe authoring through Antiky commands

#### `list_command_schemas`

- **Input:** `{worldId?, componentTypeId?, includeUnavailable?: boolean}`.
- **Output:** registered command ID/type/version, bounded input JSON Schema, target kinds, permission, expected-revision fields, result codes/schema, deduplication, fact type, correction support, sandbox/primary availability, and observation.
- **Authority:** read.
- **Failures:** registry unavailable/schema incompatible.
- **Evidence:** registry hash tied to build/runtime/world identity.

#### `submit_world_command`

- **Input:** `{commandSchemaId, commandId: UUIDv7, worldId, targetEntityIds, expectedWorldRevision?, expectedEntityRevisions?, data}` validated against a registered bounded schema.
- **Output:** command result with accepted/no-op/rejected status, resulting revisions, emitted fact/delta references, affected stable IDs, before/after observation, and correction capability.
- **Authority:** host-injected principal and the exact registered permission; sandbox mutation by default. The caller cannot supply its own permissions, principal, receipt time, runtime ID, or handler name.
- **Failures:** malformed/unregistered command, missing permission/lease, duplicate ID, stale target, capacity, game/session fault, and handler-specific stable rejections.
- **Evidence:** command/fact IDs, expected/current/resulting revisions, affected projections, audit operation, and subsequent readback barrier.

This should absorb point-light power as one registered command while preserving convenience tools where their guided workflow materially helps. It must never become arbitrary object property set, JavaScript evaluation, or direct BroMetal/GPU mutation.

#### `create_sandbox_session`, `discard_sandbox_session`, `promote_change_set`

- **Inputs:** base build/world/revision, purpose, bounded lifetime and resource limits; promotion names a reviewed change-set hash and expected primary-world revision.
- **Outputs:** distinct sandbox session/world IDs, copied/reference state manifest, operation log, semantic diff and promotion result.
- **Authority:** sandbox create/discard is scoped; promotion requires primary-world mutation grant, one-writer lease, and human approval policy. Discard cannot target primary state.
- **Failures:** stale base, unsupported copy, resource capacity, conflicting writer, failed command, unreviewed change set, promotion conflict, partial application. Promotion should be atomic or explicitly compensate with evidence.
- **Evidence:** base/sandbox/primary identities, ordered commands/facts, diff, tests/captures, reviewer approval reference, and rollback/correction plan.

Antiky's current EngineSession types describe multiple independent worlds conceptually, but this sandbox lifecycle is not implemented by the current CLI and should not be implied by skills yet.

### P2 — BroMetal-native shader, material, and render inspection

#### `get_render_pipeline`

- **Input:** expected observation plus optional pass/material/shader/entity filters and page limit.
- **Output:** Antiky render-projection IDs, visible/drawn counts, render passes, material/shader schema IDs and versions, pipeline/bind-group/resource summaries, texture/mesh budgets, dirty ranges, WebGPU capability requirements, incompleteness, and observation. Never return raw GPU handles.
- **Authority:** read through Antiky's `RenderDriver` inspection adapter.
- **Failures:** `RENDER_INSPECTION_NOT_PUBLISHED`, stale observation, unsupported metrics.
- **Evidence:** render-projection revision, pipeline/shader hashes, resource counts and frame.

#### `start_shader_validation`

- **Input:** declared BroMetal shader-validation profile, source/project revision, shader IDs or `all`, permutation/feature set, and target WebGPU capability profile.
- **Output:** operation status; terminal structured compile/generation/pipeline results and artifacts.
- **Authority:** declared check execution and generated-output write only; no arbitrary compiler or source mutation.
- **Failures:** source/generated mismatch, compile/type/binding/layout/pipeline error, unsupported feature, timeout, stale source revision.
- **Evidence:** source and generated hashes, compiler/tool revision, every validated entry point and permutation, diagnostics with safe source locations, and output artifact hashes.

#### `profile_scenario`

- **Input:** registered scenario/input-trace ID, expected build/runtime, warm-up steps, measured steps/duration, sampling detail, declared budgets, and output limits.
- **Output:** operation/artifact with CPU and GPU frame-time percentiles where supported, hitch count/threshold, draw/instance/upload/resource/load/memory measurements, dropped frames, profiler overhead note, budget pass/fail, and start/end observation.
- **Authority:** test/profile session by default; profile capability can alter timing and must not be confused with normal gameplay.
- **Failures:** metric unsupported, scenario mismatch, trace fault, sample too small, profiler capacity, budget exceeded (a structured failed gate, not transport failure).
- **Evidence:** exact scenario/trace, device/runtime capability class without personal machine name, resolution, configuration, raw trace ref, summarized percentiles, baseline/delta.

BroMetal tools must report through Antiky-owned render identities and projections. They do not get authority over gameplay rules, world identity, event history, Studio selection, or the agent protocol.

### P2 — asset inventory and import evidence

#### `get_asset_inventory`

- **Input:** `{assetIds?, kinds?, referencedByEntityId?, status?, cursor?, limit?}`.
- **Output:** stable asset/catalog IDs, project-relative paths, source/license/attribution, source and installed hashes, dimensions/format/color space/compression/LOD/animation metadata where known, references, import profile/version, validation status, incompleteness, and project revision.
- **Authority:** read; do not follow symlinks or read outside the project/approved cache.
- **Failures:** registry missing/incompatible, reference graph unavailable, cursor expired.
- **Evidence:** asset registry hash, per-file hashes, import/profile versions and provenance.

#### `start_asset_validation`

- **Input:** declared profile, asset IDs or changed-since project revision, target budget/platform profile, and expected project revision.
- **Output:** operation with format/reference/hash/license/import/compression/runtime-budget results, sanitized diagnostics, and artifacts.
- **Authority:** read/check by default; deterministic generated import output requires a separate project-write grant. No download.
- **Failures:** missing reference/file/license/hash, import incompatibility, budget failure, stale project, unsupported converter.
- **Evidence:** input/output hashes, tool versions, transformations, warnings/errors, before/after size and runtime proof.

The current verified catalog installer can later gain a narrow `install_catalog_asset` MCP wrapper: catalog ID only, expected project revision, explicit network/filesystem approval, verified source record, atomic replacement, provenance receipt, and post-install validation. Never accept an arbitrary URL or silently download while answering an inspection request.

### P3 — repeatable visual-regression evidence

#### `compare_visual_artifacts`

- **Input:** two capture artifact IDs, optional approved masks/regions, comparison method/version, color-space policy and thresholds.
- **Output:** exact pixel and perceptual metrics, changed regions, dimension/color mismatch, threshold result, and a diff image artifact.
- **Authority:** local evidence read/write only; no runtime mutation.
- **Failures:** artifact missing/hash mismatch, incompatible dimensions/color policy, unsupported method, threshold exceeded as a structured gate result.
- **Evidence:** both immutable input hashes, method/tool version, threshold/masks, metrics, diff hash, and explicit baseline-approval identity.

Automated comparison detects regressions; it does not approve art direction, game feel, readability, or fun. Those still require independent visual/design review and, where claimed, representative human play evidence.

## Suggested implementation sequence

1. Add publication sequence/time to runtime connection snapshots and define `ObservationRefV1`. Make stale behavior explicit in every existing projection.
2. Add output validators/schemas and a common error/evidence envelope. Stop returning absolute paths and raw PIDs through agent-facing tools.
3. Authenticate HTTP MCP clients, issue capability grants, and add a principal-bound one-writer mutation lease. Preserve loopback/Host/Origin defense in depth.
4. Require expected observation/build/runtime context for reload, capture, control, and point-light operations. Enforce ready build/lifecycle in the host, not only descriptions.
5. Expose the operation log with semantic rejected/no-op outcomes and non-recursive read behavior.
6. Add targeted entity/world/event queries with deterministic pagination before the semantic world grows beyond current whole-snapshot sizes.
7. Standardize game capability registration for semantic input, scenarios, commands, component schemas, stores, event sources, render inspection, and capture.
8. Implement explicit paused input traces and state/event checkpoints, then canvas-only motion capture linked to the same trace and observations.
9. Add declared long-running check jobs for tests, build, shader validation, and assets. Do not expose arbitrary commands.
10. Generalize versioned world commands, then add sandbox/change-set/promotion workflows before primary-world authoring breadth.
11. Add BroMetal-native render pipeline inspection and scenario profiling behind Antiky's `RenderDriver`.
12. Add artifact comparison and independent review workflows. Packaged builds, signing, deployment, publishing, telemetry, and community data remain separately approved systems.

## Minimum acceptance scenarios for the expanded surface

No proposed tool should ship on schema shape alone. At minimum, test these end-to-end cases:

1. A source change produces build attempt A; another change supersedes it with attempt B. Reload rejects A and accepts only B's ready revision/artifact.
2. A runtime times out while retaining its last snapshot. Normal reads reject it; a diagnosis read explicitly returns `stale: true`, publication age and identities.
3. Two agents request the mutation lease. Exactly one can submit commands; the other gets a stable conflict without any world change.
4. A fixed seed/input trace run twice on the same declared deterministic subsystem produces the same checkpoints, facts and digests. A deliberately changed input produces an attributable delta.
5. A lost trace/step response can be retried without advancing twice.
6. A capture requested for completed step N cannot silently return N+1. Its pixels, dimensions, frame count, observation, trace and hash agree.
7. Motion capture contains only the game canvas/offscreen surface, reports actual frames/drops, and rejects any desktop/window/terminal target.
8. A world larger than one page returns deterministic pages, stable cursors, correct matched/retained/available counts and explicit incompleteness. Mutation still targets stable IDs.
9. A registered world command is accepted once, duplicated safely, rejected on stale revision, recorded as a fact, read back across projections, corrected where supported, and classified accurately in the operation log.
10. A sandbox change set can be discarded without touching primary state. Promotion fails on a changed primary revision and succeeds only with the required review/authority.
11. A declared test/build/shader/asset job returns structured artifacts and safe logs. Arbitrary command, cwd, environment, URL, symlink escape and unapproved network inputs are rejected.
12. Synthetic secrets, usernames, absolute home paths, terminal prompts, emails, hostnames and prompt injection in logs/component data never leak through a privileged action or evidence export.
13. Shader source/generated hash drift and a bad WebGPU binding fail validation before visual review. A valid pipeline reports Antiky render identities without GPU handles.
14. Performance evidence declares scenario, warm-up, sample size, resolution, configuration, metric support and profiler overhead. Unsupported GPU timing is `unavailable`, never invented.
15. Visual diff detects a seeded regression, retains immutable inputs/method/threshold/diff, and still refuses to claim that the approved image represents enjoyable gameplay.

## Final assessment

The current CLI/MCP implementation is a credible foundation, not a complete autonomous game studio. Its strongest choices should be preserved: one development authority, exact loopback boundaries, validated semantic inspection, stable domain IDs, separate state projections, fixed-step session control, command-based mutation, explicit fact retention, canvas-only capture, bounded audit logs, and aggressive rejection of malformed/stale browser messages.

The next milestone should not be dozens of ad hoc component setters. It should be a trustworthy observation and evidence layer: freshness identities, enforced expected-state barriers, scoped authority, privacy-minimized artifacts, deterministic semantic input, motion capture, targeted queries, and declared build/test/log jobs. Once those exist, a registered Antiky command surface, sandbox promotion, BroMetal inspection, shader validation, asset evidence, and profiling can grow without turning MCP into a second engine or an arbitrary local-code executor.
