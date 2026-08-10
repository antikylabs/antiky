# MCP tool reference

Antiky's MCP tools let agents and people inspect one local development session and perform
controlled development actions. Start `antiky dev` before calling a tool. If you are new to the
connection, read [Connect an MCP client](overview.md) first.

## Choose a tool

Start with `get_dev_status`. Then choose the narrowest tool that answers the question or performs
the action you need.

| Tool | Use it when | Changes state |
| --- | --- | --- |
| `get_dev_status` | You need to orient to a session | No |
| `get_latest_build` | A source, shader, asset, or project file changed | No |
| `get_runtime_status` | You need the game connection or complete framework snapshot | No |
| `get_render_stats` | You need renderer measurements, not an image | No |
| `get_diagnostics` | A build, runtime, or action is not working | No |
| `get_session_status` | You need fixed-clock state or a completed-step count | No |
| `get_world_inspection` | You need the published entity hierarchy or named stores | No |
| `get_event_log` | You need accepted event-sourcing facts and their retention | No |
| `list_point_lights` | You need to discover point lights and their stable IDs | No |
| `get_point_light` | You need the complete state and history for one light | No |
| `dev_reload` | A ready build should reload the connected game runtime | Yes |
| `capture_frame` | You need the exact current game-canvas pixels | Yes |
| `pause_simulation` | You need the game rules to stop advancing | Yes |
| `resume_simulation` | You want to remove the tool pause reason | Yes |
| `step_simulation` | You need exactly one paused fixed tick | Yes |
| `set_point_light_power` | You need to change a light's power | Yes |
| `correct_point_light_power` | You need to restore the value before an accepted power change | Yes |

Read tools are advertised as read-only, non-destructive, idempotent, and closed-world. All action
tools are non-destructive. The three session-control actions are also advertised as idempotent:
pause and resume become `NO_OP`, while a repeated step is rejected by its expected count. Other
action tools are not marked idempotent.

## Call tools from a terminal

`antiky tool` calls the same endpoint as an MCP client and prints the structured result as JSON:

```sh
antiky tool get_dev_status
antiky tool get_session_status
antiky tool get_world_inspection
antiky tool get_event_log
antiky tool list_point_lights
antiky tool get_point_light '{"entityId":"018f0f3a-7b2c-7a1d-8e2f-123456789abd"}'
```

Use `--input '<json>'` instead of positional JSON if that is easier for your shell. Add
`--project path/to/harbor-lights.antiky` when you are outside the project directory.

## Development state tools

### `get_dev_status`

Call this first. It takes no input and returns the development-session ID, accepted build revision,
validated project, process health, runtime connection, cleanup state, and CLI timing measurements.

```sh
antiky tool get_dev_status
```

### `get_latest_build`

Call this after a source, shader, asset, or project-manifest change. It takes no input and returns
the accepted revision plus the latest build attempt, change kind, result, changed path, and duration. Use the
accepted revision—not file timing—to decide whether a reload is safe.

```sh
antiky tool get_latest_build
```

### `get_runtime_status`

Call this before `dev_reload` or `capture_frame`, or when runtime-backed state is missing. It
takes no input and returns the game connection plus the latest framework inspection snapshot.
The version-two result also carries an `observation` that identifies the accepted build, runtime
instance, publication sequence and time, connection state, freshness, and any published
session/world counters. A `null` inspection and observation mean no game snapshot has been accepted.
An observation with `freshness: "retained-unavailable"` is retained diagnostic context, not current
runtime authority.

```sh
antiky tool get_runtime_status
```

### `get_render_stats`

Call this to read available frame, canvas, draw-call, instance, and upload measurements. It takes no
input. Missing measurements are `null`. This tool does not capture pixels or prove what the game
looks like; use `capture_frame` for an image. Its version-two result carries the same observation
identity as the runtime publication from which the measurements were projected.

```sh
antiky tool get_render_stats
```

### `get_diagnostics`

Call this when the latest build is not ready, the game is unavailable, or an action fails. It takes
no input and returns development and framework diagnostics. Use each diagnostic's stable `code`
for recovery; show its `message` to a person.

```sh
antiky tool get_diagnostics
```

## Engine-session tools

These tools are available when the connected game publishes an `EngineSession`. They return the
same status and control results as the typed development client and the game's direct session API.

### `get_session_status`

Call this before changing simulation state. It takes no input:

```sh
antiky tool get_session_status
```

The result contains session, world, and runtime IDs; running or paused mode; all pause reasons;
immutable system order; fixed-clock limits and counters; command, control, and world revisions;
and the latest completed-step digest. The surrounding version-two observation binds those values to
one accepted runtime publication. World, event, point-light, render, and diagnostic runtime reads
use the same observation contract.

### `pause_simulation`

This tool adds the `tool` pause reason without rebuilding game state:

```sh
antiky tool pause_simulation
```

The first accepted call returns `PAUSED`. Repeating it returns `NO_OP`. A user or visibility pause
can already be present; all reasons remain in the returned session status.

### `resume_simulation`

This tool removes only the `tool` pause reason:

```sh
antiky tool resume_simulation
```

The result can still report `mode: "paused"` when a user or visibility pause remains. Repeating the
call after the tool reason is gone returns `NO_OP`.

### `step_simulation`

First pause the session and read its current completed-step count. Pass that exact count:

```sh
antiky tool step_simulation '{"expectedCompletedStepCount":42}'
```

| Input | Type or range | Meaning |
| --- | --- | --- |
| `expectedCompletedStepCount` | Integer, 0 or greater | The count from the latest session status |

An accepted call returns `STEPPED`, advances exactly one fixed tick, and renders one paused frame.
The count makes a retry safe. If the first call succeeded but its response was lost, retrying with
the same input returns `STALE_COMPLETED_STEP` and changes nothing.

Session-control results use these stable codes:

- `PAUSED`, `RESUMED`, and `STEPPED` report an accepted control change.
- `NO_OP` means the requested pause reason was already in the requested state.
- `STALE_COMPLETED_STEP` means the expected count no longer matches.
- `SESSION_RUNNING` means a step was requested while the session was running.
- `SESSION_DISPOSED`, `SESSION_BUSY`, and `COUNTER_LIMIT` report an unavailable session state.
- `INVALID_EXPECTED_STEP` and `INVALID_INPUT` report invalid direct API input. MCP rejects malformed
  tool arguments before it calls the session.

Every action result includes the action ID, development-session ID, control result, and resulting
session status. Use the stable code for control flow and the returned status for the next request.

## World and event inspection tools

These read tools expose semantic copies published by the Framework. They do not expose live engine
objects, private stores, renderer handles, or GPU resources.

### `get_world_inspection`

Call this to read the complete bounded world view:

```sh
antiky tool get_world_inspection
```

The result contains the development-session ID and a Framework-owned world record. The world record
contains stable entity IDs, labels, revisions, component summaries, real `ChildOf` relationships,
and named authoring, runtime, or render stores. Counts and `incomplete` state show whether the
published view retained everything available at its source.

An entity without a `ChildOf` parent remains a root. Store entries are bounded JSON copies, not raw
game storage.

### `get_event_log`

Call this to read accepted event-sourcing facts in source sequence order:

```sh
antiky tool get_event_log
```

The result contains the development-session ID and one Framework event-history record. Each fact
keeps its event type and schema, sequence, command ID, world and entity IDs, resulting revision,
time, and bounded data.

The retention record states the source lifetime, storage, overflow behavior, capacity, and dropped
count. For example, `lifetime: "runtime-instance"` with `storage: "memory"` means the history can
disappear when the game runtime reloads. This Tool does not return simulation steps, rejected
commands, diagnostics, MCP traffic, or a durable audit log.

Both Tools return `ANTIKY_RUNTIME_UNAVAILABLE` when the connected game does not publish the requested
view.

## Point-light read tools

### `list_point_lights`

Call this to discover the point lights published by the connected game. It takes no input and
returns the world ID, stable entity IDs, authored values, revisions, and current event sequence.

```sh
antiky tool list_point_lights
```

### `get_point_light`

Call this after `list_point_lights` with one returned entity ID:

```sh
antiky tool get_point_light '{"entityId":"018f0f3a-7b2c-7a1d-8e2f-123456789abd"}'
```

| Input | Type | Meaning |
| --- | --- | --- |
| `entityId` | Lowercase UUIDv7 string | The stable point-light entity ID |

The result contains the matching authoring record, current game value, optional render binding, and
accepted change facts. A well-formed ID that is not present returns `null`.

## Development action tools

### `dev_reload`

First call `get_latest_build` and confirm that the newest build is ready. Then call
`get_runtime_status` and confirm that a game is connected. `dev_reload` takes no input:

```sh
antiky tool dev_reload
```

The result relates the action ID, development session, accepted build revision, and old and new
runtime-instance IDs. The tool does not start a development session or rebuild source.

### `capture_frame`

Read `get_runtime_status` and `get_render_stats` first. Copy the development session, accepted
build, and runtime instance from a `current` observation, and request the exact drawing-buffer size
reported by the game:

```sh
antiky tool capture_frame '{
  "schemaVersion":2,
  "expected":{
    "developmentSessionId":"development-session-id",
    "acceptedBuildRevision":1,
    "runtimeInstanceId":"runtime-instance-id"
  },
  "runtimePolicy":"current-or-managed",
  "target":{"width":1280,"height":720,"deviceScaleFactor":1},
  "warmUpFrames":2,
  "idempotencyKey":"capture-review-001"
}'
```

To fence an exact simulation state, also supply the observation's `sessionId`,
`completedStepCount`, and `stateDigest`. Exact-step capture requires a paused session. A changed
build, runtime, session, or step fails with a stable capture code instead of returning unrelated
pixels.

The structured result contains the observation actually captured, source, DPR, dimensions, byte
length, SHA-256, and an opaque `antiky-evidence://` artifact identity. It never contains a local
path. MCP clients also receive the bounded PNG as an image content block; the typed development
client can retrieve the same artifact through its authorized opaque lookup.

Evidence is private to the development session, is removed when that session stops, and starts with
`reviewState: "private-unreviewed"`. Canvas-only capture prevents desktop, terminal, and browser
chrome pixels from entering through the capture mechanism, but Antiky does not scan arbitrary text
or secrets rendered by the game itself. Do not upload or publish the artifact without a separate
review.

The current implementation uses a connected game runtime. `runtimePolicy: "managed-only"` is
reserved for the managed capture runtime and currently returns a stable unavailable result rather
than launching a personal browser.

### `set_point_light_power`

Call `get_point_light` first so you have the current IDs and revision. Then submit a new UUIDv7
command ID and the desired power:

```sh
antiky tool set_point_light_power '{"commandId":"018f0f3a-7b2c-7a1d-8e2f-123456789ac0","worldId":"018f0f3a-7b2c-7a1d-8e2f-123456789abc","entityId":"018f0f3a-7b2c-7a1d-8e2f-123456789abd","expectedRevision":1,"power":2}'
```

| Input | Type or range | Meaning |
| --- | --- | --- |
| `commandId` | Lowercase UUIDv7 string | A stable ID for this request |
| `worldId` | Lowercase UUIDv7 string | The world returned by point-light inspection |
| `entityId` | Lowercase UUIDv7 string | The light returned by `list_point_lights` |
| `expectedRevision` | Integer, 0 or greater | The light revision you read |
| `power` | Number from 0 through 4 | The new light power |

The local host supplies `world.light.edit` permission, receipt time, principal, and runtime
identity separately from the tool input. An `ACCEPTED` result changes the authored value and
records one fact. A rejected result changes nothing.

Keep `commandId` unchanged only when retrying the same request. Use a new command ID for a new
change.

### `correct_point_light_power`

A correction restores the value from before an accepted command by recording another fact. It does
not delete history:

```sh
antiky tool correct_point_light_power '{"commandId":"018f0f3a-7b2c-7a1d-8e2f-123456789ac1","correctedCommandId":"018f0f3a-7b2c-7a1d-8e2f-123456789ac0","expectedRevision":2}'
```

| Input | Type or range | Meaning |
| --- | --- | --- |
| `commandId` | Lowercase UUIDv7 string | A new ID for the correction |
| `correctedCommandId` | Lowercase UUIDv7 string | The accepted command to correct |
| `expectedRevision` | Integer, 0 or greater | The light's current revision |

Use the corrected command ID from the accepted fact and read the current revision before sending the
correction.

## Interpret action results

Point-light action results use stable codes:

- `ACCEPTED` means the change was recorded.
- `NO_OP` means the requested value already matched.
- `INVALID_COMMAND`, `WORLD_NOT_FOUND`, and `ENTITY_NOT_FOUND` report invalid structure or
  targets.
- `MISSING_PERMISSION`, `DUPLICATE_COMMAND`, and `STALE_REVISION` report authority or
  ordering problems.
- `VALUE_OUT_OF_RANGE`, `HISTORY_CAPACITY_REACHED`, and `EVENT_SEQUENCE_ERROR` report bounded
  state or history problems.

Use the stable code for control flow. The accompanying message is for a person.

If a tool cannot run because the game or build is not ready, call `get_runtime_status`,
`get_latest_build`, and `get_diagnostics` before retrying.

See [Engine sessions](../framework/engine-sessions.md) for the Framework API and host lifecycle.
See [Point lights](../framework/point-lights.md) for the framework API behind the point-light tools.
