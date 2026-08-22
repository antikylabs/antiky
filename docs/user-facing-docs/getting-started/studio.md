# Open Antiky Town in Studio

Open the included Antiky Town project in the native Studio development app. At the end, you will
see the live game, terminal, inspection data, and simulation controls in one window.

Complete [Run Antiky Town from source](framework.md) first. Keep the repository and installed
dependencies, but stop its `antiky dev` session before you begin.

## Start Studio

From the Antiky repository root, run:

```sh
npm run dev:studio
```

Studio opens its project launcher. Select **Open project**, then choose:

```text
packages/demos/antiky-town/antiky-town.antiky
```

Studio validates the manifest and starts the project service automatically. Do not start
`antiky dev` in the embedded terminal.

## Check the workspace

Wait for Antiky Town to appear in **Live game**. Move through the market with WASD or the arrow
keys. Confirm that **Inspection** shows current runtime data and that the terminal remains available
below the game.

Select **Pause**, then select **Step** once. Studio advances one simulation step and presents one
frame. Select **Resume** to let the game continue.

## Stop the game

Select **Stop game**. The game and development services stop, but Studio and its terminal remain
open. Select **Restart game** and wait for Antiky Town to reconnect.

Close Studio when you finish. Studio stops the project service that it owns.

See [Inspect a running game in Studio](../studio/getting-started.md) for project switching,
responsive layout, settings, logs, and recovery.
