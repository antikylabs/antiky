# 0001: Use MCP Tools for local development operations

## Status

Accepted

## Context

`antiky dev` starts a local Model Context Protocol (MCP) server for agents.

MCP supports Tools and Resources. A Tool is an operation that a model can call. A Resource is
URI-addressed context that a client selects.

Antiky first exposed five development-state projections through both primitives. Each Resource
returned the same value as one read-only Tool.

This duplicate interface increased implementation, test, documentation, and compatibility work. It
did not provide another source of truth or a distinct workflow.

Client support also differs. Tool calls work across the clients and agent harnesses that Antiky
targets. Resource discovery and attachment are less consistent.

Existing MCP servers show two useful patterns:

- [Unreal Engine 5.8](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)
  shipping toolsets advertise Tools and no Resources or Prompts.
- [Playwright](https://github.com/microsoft/playwright-mcp),
  [Context7](https://github.com/upstash/context7), and
  [Blender](https://github.com/ahujasid/blender-mcp) expose their main agent operations as Tools.
- [GitHub](https://github.com/github/github-mcp-server),
  [Unity](https://github.com/CoplayDev/unity-mcp), and
  [Terraform](https://github.com/hashicorp/terraform-mcp-server) use Resources for distinct
  browsable context.

Antiky considered a duplicate interface, a Resources-only interface, and a Tools-only interface.
Duplicate primitives preserve unnecessary state. Resources-only access depends on client-specific
selection and attachment behavior.

## Decision

Antiky will advertise local development state and actions as MCP Tools.

The read-only Tools are `get_dev_status`, `get_latest_build`, `get_runtime_status`,
`get_render_stats`, and `get_diagnostics`. The action Tools are `dev_reload` and `capture_frame`.

Read Tools will call the same typed development client as the CLI and Studio. MCP will remain an
adapter and will not own engine facts.

Antiky will not expose a Resource that duplicates a Tool result.

Each Tool description must explain:

- When an agent should call the Tool.
- Why the Tool exists.
- Which state or prerequisite the Tool needs.
- What the result means.
- Which operation is a safe next step.

Each Tool will use a strict input schema and accurate MCP annotations.

`antiky dev` will start the MCP endpoint with the configured game host and required development
services. A developer will not need a second startup command.

Antiky can add an MCP Resource when all these conditions are true:

- The Resource provides a distinct URI-based workflow.
- The content does not duplicate a Tool result.
- Target clients can discover and read the Resource correctly.
- Compatibility tests cover the supported clients and transports.

Possible examples include large documents, stable asset references, subscriptions, or context that
a user selects in the host.

This decision does not select an MCP protocol version. Protocol version support and negotiation are
separate compatibility decisions.

This decision extends the adapter boundary in
[ADR 0004](../studio/0004-share-engine-services-with-cli_H.md).

## Consequences

- Every supported MCP client can discover Antiky operations through `tools/list`.
- An agent can request fresh development state through explicit Tool calls.
- Tool descriptions give usage guidance without the user guide in model context.
- Tool and Resource projections cannot drift because duplicate Resources do not exist.
- The MCP server has fewer methods, tests, and documentation entries.
- Read operations appear as Tool calls even though they do not change state.
- Clients cannot browse Antiky development state as MCP Resources.
- A future distinct context can use Resources when it meets the stated conditions.
