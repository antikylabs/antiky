# Slice 01 Summary

Slice 01 is complete. Antiky can now find one market lamp by a stable ID, change its power through
the framework, show the change in the running town, inspect the result, and restore the earlier value
with a correction.

The lamp used by this slice is `Market Lamp West 01`:

- Entity ID: `018f0f3a-7b2c-7a1d-8e2f-123456789abd`
- Starting power: `1.05`
- Allowed power: `0` through `4`
- Town render slot: `0`

The completed test changed the power from `1.05` to `2`, then corrected it back to `1.05`. Bad,
unauthorized, repeated, and out-of-date requests left the lamp unchanged. These edits are local,
in-memory development state. Rebuilding the runtime starts again from the authored value of `1.05`.

## What changed in the repository

### Framework

`@antiky/framework` gained:

- Stable UUIDv7 IDs for worlds, entities, and commands.
- Validated `Transform` and `PointLight` data.
- A reusable point-light service that supports more than one light.
- A command for changing point-light power, including permission, revision, duplicate, range, and
  input checks.
- A bounded in-memory history and correction support. Corrections add a new record instead of
  deleting the old change.
- Separate authoring, runtime, and render views, plus point-light inspection data.

The public usage guide is in [Point Lights](../../../user-facing-docs/framework/point-lights.md),
with inspection details in [Runtime Inspection](../../../user-facing-docs/framework/inspection.md).

### CLI and MCP

The typed development client gained methods to list lights, inspect one light, change its power, and
correct an earlier change. `antiky inspect` now includes point-light state.

`antiky dev` starts the game, shader watcher, inspection service, and MCP service together. The MCP
endpoint is `http://127.0.0.1:3011/mcp` with the default configuration. Slice 01 added four MCP tools:

- `list_point_lights`
- `get_point_light`
- `set_point_light_power`
- `correct_point_light_power`

The MCP interface uses tools only; it does not duplicate this data as MCP Resources. See
[Antiky Development CLI](../../../user-facing-docs/cli/development.md) for the client API and tool
arguments.

### Demo and rendering

The repository now has a standalone `antiky-town` demo. It connects the stable lamp entity to the
existing town renderer without putting town-specific names or render slots in the framework. The
older `town-study` demo remains available.

Changing the lamp updates the next rendered frame without reloading the page. Pausing the demo also
stops its GPU render loop, and resuming starts that loop once.

### Studio

No Studio screen or panel was added in this slice. A future Studio interface can use the same
`connectDevelopmentClient` methods as the CLI and MCP service; it does not need a separate game
runtime or a copy of the lamp state. See [Studio Development Connection](../../../user-facing-docs/studio/development-connection.md).

## How to test

Run the repository checks:

```sh
npm run check
```

Start the full development session from the repository root:

```sh
npm run antiky dev
```

Then:

1. Open `http://127.0.0.1:3010/` and confirm that Antiky Town loads.
2. In another terminal, run `npm run antiky inspect` and find `Market Lamp West 01` in the
   point-light data.
3. Connect an MCP client to `http://127.0.0.1:3011/mcp`.
4. Call `list_point_lights`, then `get_point_light` with the entity ID above.
5. Call `set_point_light_power` with the returned world ID, entity ID, current revision, a new
   UUIDv7 command ID, and a power from `0` through `4`.
6. Confirm the light changes without a page reload, then call `get_point_light` again to confirm the
   new value and revision.
7. Call `correct_point_light_power` with a new UUIDv7 command ID, the accepted command ID, and the
   current revision. Confirm the original power is restored.
8. Press `Ctrl-C` in the development terminal and confirm all services stop.

If ports `3010` or `3011` are already in use, stop the existing process before starting this test.

The completed Slice 01 run and its detailed checks are saved in
[Slice 01 Confirmation Checks](outputs/s01-20260805T014602Z/confirmation-checks.md). The exact
implementation contract remains in [the Slice 01 plan](plan.md).
