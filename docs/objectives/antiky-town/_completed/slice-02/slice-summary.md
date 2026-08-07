# Slice 02 Summary

Slice 02 is complete. Antiky Town now runs through one fixed-step `EngineSession`. A developer can
pause the session, resume it, or advance it by one fixed step without rebuilding the game state.

The session uses a `1/60`-second fixed step. It accepts at most `0.05` seconds from one presentation
frame and runs at most three fixed steps for that frame. It reports discarded time instead of doing
unbounded catch-up work.

## What changed in the repository

### Framework

`@antiky/framework` gained:

- A stable `SessionId` and one Framework-owned ID generator for world, entity, command, and session
  IDs.
- A headless `EngineSession` with one fixed clock, one immutable system order, explicit step input,
  pause reasons, retry-safe single-step control, revisions, inspection, and one-time disposal.
- An ordered command boundary. Antiky Town routes its point-light commands through this boundary.
- Immutable session status with session, world, and runtime IDs, clock counters, revisions, and the
  latest optional state digest.

The Framework does not contain Antiky Town keyboard rules, browser lifecycle code, a general game
host, or a durable event for each step. A game can add a bounded server input journal or checkpoint
policy later without making high-frequency history a Framework default.

See [Engine Sessions](../../../../user-facing-docs/framework/engine-sessions.md) and
[Runtime Inspection](../../../../user-facing-docs/framework/inspection.md).

### CLI and MCP

`antiky dev` starts the game, shader watcher, inspection service, and MCP service together. The
typed development client, HTTP actions, MCP, and `antiky tool` use the same session operations.

Slice 02 added these MCP Tools:

- `get_session_status`
- `pause_simulation`
- `resume_simulation`
- `step_simulation`

The MCP interface uses Tools only. It does not duplicate the session as MCP Resources. Single-step
requires the expected completed-step count, so a repeated request returns `STALE_COMPLETED_STEP`
instead of advancing twice.

The CLI also supports `antiky generate id <world|entity|command|session>`. It delegates ID creation
to the Framework.

See [Antiky Development CLI](../../../../user-facing-docs/cli/development.md) and
[MCP Tools](../../../../user-facing-docs/mcp/tools.md).

### Demo and rendering

Antiky Town has a private browser host that maps semantic movement input and presentation time into
the `EngineSession`. Town update work runs once for each fixed step. Town render work runs at most
once for each browser presentation callback.

Pause keeps CPU and GPU resources alive but stops the continuous BroMetal loop. A single-step runs
one temporary BroMetal presentation callback, draws the paused result, and stops again. The final
browser verification found and fixed an earlier path that tried to draw outside `renderer.loop()`.

The Town UI now shows `Step once` while paused. `town-study` remains available as the reference.

### Studio

No Studio screen or connection workflow changed. A future Studio control can use
`connectDevelopmentClient` and the same `getSessionStatus`, `pauseSimulation`, `resumeSimulation`,
and `stepSimulation` methods. It does not need another session service.

### BroMetal

BroMetal remains at the verified current version `0.15.0`. BroMetal owns derived GPU resources and
draw submission. `EngineSession` owns authoritative CPU state and never reads GPU state to decide a
step or command.

The completed browser run measured zero normal GPU readback before and after reload. The Town image
matched the Slice 01 reference with `0.995923` similarity.

## Architecture decision

[ADR 0016](../../../../adr/framework/0016-give-platform-work-to-game-host_H.md) was required and is
accepted. It keeps platform events and presentation callbacks in the client host. It gives fixed
time, system order, and step IDs to `EngineSession`. Slice 02 did not publish a general host API.

## How to test

Run all repository checks:

```sh
npm run check
```

Start the complete development stack:

```sh
npm run antiky dev
```

Open `http://127.0.0.1:3010/`. Pause the Town with the UI and select `Step once`. The Town must draw
one paused frame and stay paused.

Use the same controls from another terminal:

```sh
npm run antiky tool get_session_status
npm run antiky tool pause_simulation
npm run antiky tool step_simulation '{"expectedCompletedStepCount": 0}'
npm run antiky tool resume_simulation
npm run antiky generate id session --json
```

Replace `0` with the completed-step count returned by `get_session_status`. Press `Ctrl-C` in the
first terminal when done. The CLI must stop its child processes and remove the development-session
descriptor.

The completed run is recorded in the
The Slice 02 closeout checks passed.
