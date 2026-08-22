# Inspect Antiky Town with development tools

Use Antiky's local tools to inspect the same running game that a person sees in the browser. At the
end, you will have called a development tool from the CLI and connected an MCP client to that tool
service.

Complete [Run Antiky Town from source](framework.md) first. Start its development command again if
it is not still running.

## Check the tool service

Open a second terminal in the repository root and run:

```sh
npm run antiky -- tool get_dev_status --project packages/demos/antiky-town/antiky-town.antiky
```

The command prints the current development status as JSON. Confirm that the latest build succeeded
and the runtime is connected. This command calls the same MCP tool that an agent can use.

## Add the local MCP server

Open the MCP server settings in your client and add this entry:

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

Restart or reconnect the MCP client so it reads the new configuration. The client should list an
`antiky` server and its development tools.

Ask the client to use `get_dev_status` and report whether the Antiky Town runtime is connected. Its
answer should match the status returned by the CLI.

## Stop the session

Press `Ctrl-C` in the terminal that runs Antiky Town. The MCP endpoint stops with the rest of the
development session.

See [Connect an MCP client](../mcp/overview.md) for the standard-input/output adapter, local
security boundary, and troubleshooting steps.
