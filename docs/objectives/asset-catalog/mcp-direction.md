# Asset catalog MCP direction

## Recommendation

Expose Antiky Assets as a read-only remote MCP server backed by the existing catalog API. The public endpoint should live at `https://antikylabs.com/assets/mcp` or `https://assets.antikylabs.com/mcp` and use MCP's Streamable HTTP transport.

This should not be implemented as a browser-only or “client-side MCP server.” Browser code can act as an MCP client or call the asset JSON API, but it cannot reliably accept inbound connections from agents after the tab closes. Service workers are also browser-scoped, short-lived, and inaccessible to most desktop and hosted agent runtimes. The remotely reachable Next.js backend is the server.

For agent hosts that only support local `stdio` MCP servers, publish a small optional npm bridge later. The bridge would run locally, speak MCP over stdin/stdout, and call the same public Antiky Assets API. It should contain no second catalog implementation.

## Why MCP helps

The JSON API is already sufficient for agents that can make HTTP requests. MCP adds standardized capability discovery, typed tool inputs, predictable results, and a connection flow supported by agent hosts. It should be a thin protocol adapter, not a new database or search system.

The three surfaces have different jobs:

| Surface | Job |
| --- | --- |
| `/assets` | Human browsing and permanent asset pages |
| `/assets/llms.txt` | Lightweight instructions, API discovery, licensing, and correct agent behavior |
| `/api/assets` | Canonical paginated catalog data |
| `/assets/mcp` | MCP capability negotiation and typed access to the same catalog data |

## Initial MCP capabilities

Start read-only. Do not expose archive installation or arbitrary URL fetching from the public server.

### Tools

1. `search_assets`
   - Inputs: `query`, `type`, `provider`, `limit`, and `offset`
   - Returns: schema version, counts, and compact asset records
   - Uses the same filtering and pagination as `GET /api/assets`
2. `get_asset`
   - Inputs: `provider` and `slug`
   - Returns: the complete permanent catalog record
3. `list_asset_sources`
   - Inputs: none
   - Returns: supported providers, record counts, asset types, and verification coverage

### Resources

- `antiky-asset://guide` — the content of `/assets/llms.txt`
- `antiky-asset://catalog/{provider}/{slug}` — one permanent asset record
- Optionally, a resource template for paginated searches once client support is proven

Prompts are unnecessary in the first version. The agent guide already describes the recommended search and provenance workflow.

## Protocol and deployment

Use the stable MCP protocol revision supported by the selected official TypeScript SDK. As of August 2026, Streamable HTTP is the standard remote transport. The 2025-11-25 specification expects one HTTP endpoint supporting POST and GET, with JSON-RPC lifecycle and capability negotiation. A newer stateless transport revision is approaching release and fits serverless Next.js deployments better, but the implementation should not target a release candidate unless the supported agent clients and SDKs have adopted it.

The first implementation should:

- use the official TypeScript MCP SDK rather than hand-rolling JSON-RPC;
- mount one Next.js route at `/assets/mcp`;
- keep tools stateless and delegate directly to the catalog library or API handlers;
- return deterministic tool ordering and bounded result sizes;
- avoid SSE unless a supported client requires it;
- deploy in the Node.js runtime if the SDK or transport depends on Node APIs;
- expose a health check separately rather than treating a browser GET as an MCP session.

Official references:

- [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [Server primitives](https://modelcontextprotocol.io/specification/2025-11-25/server/index)
- [Remote server registry format](https://modelcontextprotocol.io/registry/remote-servers)

## Security and operational requirements

Even a read-only catalog endpoint needs controls:

- Validate the `Origin` header when present. The MCP transport specification requires rejecting invalid origins to prevent DNS-rebinding attacks.
- Apply request size, tool argument, pagination, concurrency, and rate limits.
- Never accept an arbitrary upstream URL from tool input.
- Return catalog records only; do not proxy provider archives or previews through the MCP endpoint.
- Keep errors structured and avoid leaking stack traces or deployment details.
- Add authentication before exposing user-specific collections, generation credits, writes, or installation jobs. Public read-only search can remain anonymous if rate-limited.
- Log tool name, duration, result count, and failure category without logging sensitive client content unnecessarily.

CORS is not the security boundary for MCP. Hosted agents are not necessarily browsers, and server-side clients do not rely on browser CORS enforcement.

## Discovery and installation

When the endpoint is production-ready:

1. Add its connection URL to `/assets/llms.txt`.
2. Publish a `server.json` manifest with a `streamable-http` remote entry.
3. Add copyable connection instructions on the asset page.
4. Register it with the MCP Registry after the registry and endpoint behavior are stable.
5. Optionally publish `@antiky/assets-mcp` as a local stdio bridge for older clients.

Do not advertise the MCP URL before interoperability tests pass in the agent hosts Antiky intends to support.

## Verification plan

Completion requires more than responding to one POST request:

- MCP Inspector can initialize the server and list capabilities.
- `tools/list` is deterministic and returns the three documented tools.
- Search results exactly match the public API for the same inputs.
- Detail lookup preserves license, provenance, preview hosting, and verification state.
- Invalid origins, methods, malformed JSON-RPC, oversized input, and excessive limits are rejected correctly.
- Anonymous rate limiting behaves predictably.
- At least two remote-MCP-capable agent hosts connect successfully.
- The stdio bridge, if built, passes the same contract tests against the hosted API.

## Suggested sequence

1. Ship and observe `/assets/llms.txt` and the JSON API.
2. Add shared service functions so the API and MCP adapter cannot drift.
3. Prototype the read-only Streamable HTTP route with the official SDK.
4. Verify host compatibility and serverless transport behavior.
5. Add registry metadata and public connection instructions.
6. Consider write tools only after authentication, authorization, quotas, and durable job execution exist.
