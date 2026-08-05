# Connect Studio to a running game

Studio connects to the local development session started by `antiky dev`. This gives Studio the
same live game state and controlled actions as the CLI and MCP tools, without launching another
copy of the game.

## Start the game first

From the game project, run:

```sh
antiky dev
```

Wait for Antiky to print the game and inspection URLs. If you use a non-default config file, pass
the same absolute config path when Studio connects.

## Create the connection

Use `connectDevelopmentClient` from `@antiky/cli`:

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('/path/to/antiky.config.json');
const snapshot = await client.readDevelopmentSnapshot();

console.log(snapshot.connection);
console.log(snapshot.inspection?.runtime);
```

The client finds the active session descriptor, authenticates to the loopback inspection service,
and confirms that the service belongs to the selected config and development-session ID.

## Read and change the shared session

The development client exposes the same operations used by the CLI and MCP adapters:

- `readDevelopmentSnapshot` reads build, process, connection, diagnostic, measurement, and
  framework inspection state.
- `listPointLights` and `getPointLight` read point lights published by the game.
- `setPointLightPower` and `correctPointLightPower` submit controlled point-light changes.
- `requestReload` reloads the connected game after a ready build.
- `captureFrame` saves the current game-canvas pixels.

Read the snapshot again after an accepted action. The game remains the owner of live state; the
client does not keep a second mutable copy.

Use the development-session ID to identify one `antiky dev` run. Use the runtime-instance ID to
identify the current game runtime within that session. Build revisions, captures, and actions have
their own IDs so Studio can relate a result to the exact state that produced it.

## Do not infer game state

Use `DevelopmentSnapshot` as Studio's source of truth. Do not parse terminal output, inspect the
page DOM, or infer renderer measurements from a frame capture. The game publishes semantic facts
through [runtime inspection](../framework/inspection.md); a capture supplies pixels for visual
review.

Studio should connect only after `antiky dev` starts. It should not launch a second game process,
create another inspection service, or bypass the shared client's validation.

See [Run Antiky locally](../cli/development.md) for configuration and cleanup. See the
[MCP tool reference](../mcp/tools.md) for the equivalent agent and terminal operations.
