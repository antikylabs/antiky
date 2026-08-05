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
| `get_latest_build` | A source, shader, asset, or config file changed | No |
| `get_runtime_status` | You need the game connection or complete framework snapshot | No |
| `get_render_stats` | You need renderer measurements, not an image | No |
| `get_diagnostics` | A build, runtime, or action is not working | No |
| `list_point_lights` | You need to discover point lights and their stable IDs | No |
| `get_point_light` | You need the complete state and history for one light | No |
| `dev_reload` | A ready build should reload the connected game runtime | Yes |
| `capture_frame` | You need the exact current game-canvas pixels | Yes |
| `set_point_light_power` | You need to change a light's power | Yes |
| `correct_point_light_power` | You need to restore the value before an accepted power change | Yes |

Read tools are advertised as read-only, non-destructive, idempotent, and closed-world. Action tools
are non-destructive but are not marked read-only or idempotent.

## Call tools from a terminal

`antiky tool` calls the same endpoint as an MCP client and prints the structured result as JSON:

```sh
antiky tool get_dev_status
antiky tool list_point_lights
antiky tool get_point_light '{"entityId":"018f0f3a-7b2c-7a1d-8e2f-123456789abd"}'
```

Use `--input '<json>'` instead of positional JSON if that is easier for your shell. Add
`--config path/to/antiky.config.json` when you are outside the project directory.

## Development state tools

### `get_dev_status`

Call this first. It takes no input and returns the development-session ID, accepted build revision,
resolved config, process health, runtime connection, cleanup state, and CLI timing measurements.

```sh
antiky tool get_dev_status
```

### `get_latest_build`

Call this after a source, shader, asset, or config change. It takes no input and returns the accepted
revision plus the latest build attempt, change kind, result, changed path, and duration. Use the
accepted revision—not file timing—to decide whether a reload is safe.

```sh
antiky tool get_latest_build
```

### `get_runtime_status`

Call this before `dev_reload` or `capture_frame`, or when runtime-backed state is missing. It
takes no input and returns the game connection plus the latest framework inspection snapshot. A
`null` inspection means no game snapshot is available.

```sh
antiky tool get_runtime_status
```

### `get_render_stats`

Call this to read available frame, canvas, draw-call, instance, and upload measurements. It takes no
input. Missing measurements are `null`. This tool does not capture pixels or prove what the game
looks like; use `capture_frame` for an image.

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

Call `get_runtime_status` first to confirm that a game is connected:

```sh
antiky tool capture_frame
```

The tool writes the exact game-canvas pixels as a PNG under `.antiky/captures/`. Its result
contains the path, digest, byte count, capture ID, action ID, development-session ID,
runtime-instance ID, and build revision. Use `get_render_stats` for renderer measurements.

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

See [Point lights](../framework/point-lights.md) for the framework API behind the point-light tools.
