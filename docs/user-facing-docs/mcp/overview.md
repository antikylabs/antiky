# Connect an MCP client

Antiky's Model Context Protocol (MCP) server lets an agent inspect and control the same local game
session that you use from the CLI and Studio. `antiky dev` automatically starts the MCP server
with the rest of the development environment.

## Connect over Streamable HTTP

Start the development session:

```sh
antiky dev
```

Antiky prints the MCP URL after startup. It uses the inspection origin followed by `/mcp`, such as
`http://127.0.0.1:3011/mcp`.

Point an MCP client that supports Streamable HTTP at that URL. The outer configuration format
depends on the client, but a typical entry looks like this:

```json
{
  "mcpServers": {
    "antiky": {
      "type": "http",
      "url": "http://127.0.0.1:3011/mcp"
    }
  }
}
```

The endpoint is stateless and implements MCP protocol version `2025-11-25`. It returns JSON
responses and does not keep a Server-Sent Events connection open.

## Connect a standard-input/output client

If a client cannot connect to a Streamable HTTP URL, configure it to launch Antiky's
standard-input/output adapter:

```json
{
  "mcpServers": {
    "antiky": {
      "command": "antiky",
      "args": ["mcp", "--config", "/absolute/path/to/antiky.config.json"]
    }
  }
}
```

The MCP client owns the `antiky mcp` subprocess. Do not run that command in another terminal.
The adapter connects to the session already started by `antiky dev` and writes protocol JSON only
to standard output.

## What the server exposes

Antiky exposes development operations as MCP tools. Read tools report session, build, runtime,
render, diagnostic, world, store, event, and point-light state. Action tools reload the game,
capture a frame, control simulation, or submit a point-light change.

The server does not publish the same state again as MCP Resources. Tools fit both kinds of Antiky
work:

- An agent can discover an operation and call it directly.
- A person can call the identical operation with `antiky tool`.
- Studio can use the typed development client behind the same service boundary.
- Every input goes through the same validation and permission checks.

Start with `get_dev_status` when an agent first connects. See the [MCP tool
reference](tools.md) for the complete catalog, inputs, results, and recommended call order.

The local development host also keeps a bounded in-memory record of handled `tools/call` requests
for Studio. That record is a protected development-client query, not an MCP Tool or Resource.
Reading it cannot make the history record itself. It expires with the `antiky dev` session and does
not become game event history.

## Call a tool yourself

You do not need an MCP client to check an endpoint. Keep `antiky dev` running, then use the CLI in
another terminal:

```sh
antiky tool get_dev_status
```

For a tool with input, pass one quoted JSON object:

```sh
antiky tool get_point_light '{"entityId":"018f0f3a-7b2c-7a1d-8e2f-123456789abd"}'
```

See [Run Antiky locally](../cli/development.md) for CLI configuration and errors.

## Keep the endpoint local

Antiky binds development services to `127.0.0.1` and checks the request's Host header. If a
browser sends an Origin header, it must match the configured game origin.

The `/mcp` route does not use the rotating inspection credential. This lets MCP clients keep one
local URL across development-session restarts. The trust boundary is the loopback bind plus the
Host and Origin checks, which means any process running as your local user can reach the endpoint.
Do not expose the inspection port through a LAN bind, tunnel, or reverse proxy.

Inspection requests outside MCP use the per-session bearer credential stored in
`.antiky/dev-session.json`. Trusted identity, permissions, receipt time, and runtime identity do
not enter MCP tool arguments or inspection output. Point-light commands are limited to 4 KiB.

Exclude the browser adapter, inspection endpoint, development environment key, and credential
bootstrap code from a production game build.

## Troubleshoot a connection

- Confirm that `antiky dev` is still running and use the MCP URL it printed for this project.
- Confirm that the client uses Streamable HTTP, not the retired HTTP-plus-SSE transport.
- If the client supports only standard input/output, use the adapter configuration above.
- Keep the configured host as `127.0.0.1`; `localhost`, a LAN address, and `0.0.0.0` do not
  match the service boundary.
- Run `antiky tool get_dev_status` to separate an Antiky session problem from an MCP-client
  configuration problem.
- Run `antiky tool get_diagnostics` when the session is reachable but the game or latest build is
  not ready.

Press `Ctrl-C` in the `antiky dev` terminal to stop the MCP endpoint and the rest of the
development session together.
