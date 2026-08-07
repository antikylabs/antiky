# Connect Studio to a project service

Studio uses the same project-service library as the `antiky dev` command. The desktop application
starts that service when it activates a validated project. It does not execute an `antiky dev`
command, parse terminal text, or wait for a session descriptor.

## Understand the local startup boundary

The native application host has permission to start local processes and bind loopback ports. It
starts a packaged worker that imports `@antiky/cli`, loads the active `.antiky` manifest, and calls
the project-service library directly. The worker returns one bounded `DevelopmentConnection` to
the native host after the service starts.

The portable Studio webview does not import Node.js modules. It receives the bounded connection
from the native host and creates the browser-safe client:

```ts
import { createDevelopmentClient } from '@antiky/cli/development';

const client = createDevelopmentClient({
  inspectionUrl: 'http://127.0.0.1:3011',
  developmentSessionId: 'development-01HXYZ',
  credential: sessionCredential,
});
```

The client accepts only an exact `http://127.0.0.1:{port}` origin, a bounded session ID, and a
bounded credential. The native host keeps ownership of project startup and cleanup. The webview
uses HTTP only to read and control the already running session.

Studio asks the native host to stop the lifecycle handle when the project changes or the workspace
closes. Repeated start and stop requests are safe. A failed startup produces a bounded error and a
Retry action; it does not ask the user to start another host.

## Connect a detached Node.js client

A separate Node.js tool can connect to a session that another approved host started:

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('/path/to/harbor-lights.antiky');
const snapshot = await client.readDevelopmentSnapshot();
```

That detached helper reads the selected project's active session descriptor and authenticates to
the loopback inspection service. This descriptor workflow is for detached clients. Studio local
startup receives its connection directly from the lifecycle handle.

## Read and change the shared session

The development client exposes the same operations used by the CLI and MCP adapters:

- `readDevelopmentSnapshot` reads build, process, connection, diagnostic, measurement, and
  Framework inspection state.
- `getWorldInspection` reads the complete published hierarchy and named semantic stores.
- `getEventHistory` reads accepted event-sourcing facts and the source retention policy.
- `getMcpCallLog` reads bounded Tool-call history for this development session.
- `listPointLights` and `getPointLight` read point lights published by the game.
- `setPointLightPower` and `correctPointLightPower` submit controlled point-light changes.
- `requestReload` reloads the connected game after a ready build.
- `captureFrame` saves the current game-canvas pixels.

Read the snapshot again after an accepted action. The game remains the owner of live state; the
client does not keep a second mutable copy.

Studio uses one polling coordinator for the snapshot and MCP call log. It accepts an update only
when both responses belong to the current development session. A new session clears the old game,
runtime, world, event, and MCP views before it publishes new data.

Use the development-session ID to identify one project-service run. Use the runtime-instance ID to
identify the current game runtime within that session. Build revisions, captures, and actions have
their own IDs so Studio can relate a result to the exact state that produced it.

## Do not infer game state

Use `DevelopmentSnapshot` as Studio's source of truth. Do not parse terminal output, inspect the
page DOM, or infer renderer measurements from a frame capture. The game publishes semantic facts
through [runtime inspection](../framework/inspection.md); a capture supplies pixels for visual
review.

See [Inspect a running game in Studio](getting-started.md) for the complete workspace. See
[Run Antiky locally](../cli/development.md) for the command adapter. See the [MCP tool
reference](../mcp/tools.md) for the equivalent agent and terminal operations.
