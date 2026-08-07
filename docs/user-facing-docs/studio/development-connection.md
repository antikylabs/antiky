# Connect Studio to a running game

Studio connects to the local development session started by `antiky dev`. Use this boundary when
you build a Studio panel or another local client that must read and control the same game as CLI and
MCP users, without launching another copy.

## Start the game first

From the game project, run:

```sh
antiky dev
```

Wait for Antiky to print the game and inspection URLs. If you use an explicit project manifest,
pass the same manifest path when a Node.js client connects.

## Create the connection

Node.js code can use `connectDevelopmentClient` from `@antiky/cli`:

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('/path/to/harbor-lights.antiky');
const snapshot = await client.readDevelopmentSnapshot();

console.log(snapshot.connection);
console.log(snapshot.inspection?.runtime);
```

The client reads the selected project's active session descriptor and authenticates to the
loopback inspection service.

A browser or desktop webview must not read the descriptor itself. Its host discovers one bounded
`DevelopmentConnection`, then passes that value to the browser-safe client:

```ts
import { createDevelopmentClient } from '@antiky/cli/development';

const client = createDevelopmentClient({
  inspectionUrl: 'http://127.0.0.1:3011',
  developmentSessionId: 'development-01HXYZ',
  credential: sessionCredential,
});
```

The client accepts only an exact `http://127.0.0.1:{port}` origin, a bounded session ID, and a
bounded credential. The Studio Tauri host supplies this connection through a narrow command. It
does not fetch engine data or copy request logic.

## Read and change the shared session

The development client exposes the same operations used by the CLI and MCP adapters:

- `readDevelopmentSnapshot` reads build, process, connection, diagnostic, measurement, and
  framework inspection state.
- `getWorldInspection` reads the complete published hierarchy and named semantic stores.
- `getEventHistory` reads accepted event-sourcing facts and the source retention policy.
- `getMcpCallLog` reads bounded Tool-call history for this development session. It is a protected
  client query and is intentionally not an MCP Tool.
- `listPointLights` and `getPointLight` read point lights published by the game.
- `setPointLightPower` and `correctPointLightPower` submit controlled point-light changes.
- `requestReload` reloads the connected game after a ready build.
- `captureFrame` saves the current game-canvas pixels.

Read the snapshot again after an accepted action. The game remains the owner of live state; the
client does not keep a second mutable copy.

Studio uses one polling coordinator for the snapshot and MCP call log. It accepts an update only
when both responses belong to the discovered development session. A new session clears the old
game, runtime, world, event, and MCP views before it publishes new data.

Use the development-session ID to identify one `antiky dev` run. Use the runtime-instance ID to
identify the current game runtime within that session. Build revisions, captures, and actions have
their own IDs so Studio can relate a result to the exact state that produced it.

## Do not infer game state

Use `DevelopmentSnapshot` as Studio's source of truth. Do not parse terminal output, inspect the
page DOM, or infer renderer measurements from a frame capture. The game publishes semantic facts
through [runtime inspection](../framework/inspection.md); a capture supplies pixels for visual
review.

Studio can wait for `antiky dev` while its terminal remains usable. A stopped or incompatible
session makes the last accepted data visibly stale; it must not look current. Studio should not
launch a second game process, create another inspection service, parse terminal text, or bypass the
shared client's validation.

See [Inspect a running game in Studio](getting-started.md) for the complete workspace. See
[Run Antiky locally](../cli/development.md) for the project manifest and cleanup. See the [MCP tool
reference](../mcp/tools.md) for the equivalent agent and terminal operations.
