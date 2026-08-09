# Asset catalog MCP direction

## Current decision

Antiky Labs will not host an MCP server for the asset catalog while the website remains static-only. The deployed site has no runtime API, session service, server functions, or remote MCP endpoint.

Agents use the same static resources as every other client:

- `/llms.txt` for the canonical concise site and documentation index;
- `/llms-full.txt` for complete public documentation, generated API reference, and asset summaries;
- `/assets/catalog.json` for the full schema-versioned asset catalog;
- `/assets/{provider}/{slug}` for permanent human-readable asset pages.

Asset filtering at `/assets` runs entirely in the browser. The catalog data and all detail pages are generated during the main website build.

## Why browser-side MCP is not the answer

A browser tab can consume static files or act as a protocol client, but it cannot be a reliable MCP server for external agents. It cannot accept inbound connections after the tab closes, service workers are browser-scoped and short-lived, and most desktop or hosted agent runtimes cannot connect to a user's browser execution context.

Adding MCP to the web experience would therefore require a remotely reachable server. That conflicts with the current static-only deployment decision and is intentionally deferred.

## Future local option

If agents need MCP-specific discovery before Antiky wants hosted infrastructure, publish an optional local npm package such as `@antiky/assets-mcp`. It would:

- run on the user's machine over the MCP `stdio` transport;
- read the public static `catalog.json` file;
- expose read-only `search_assets`, `get_asset`, and `list_asset_sources` tools;
- cache the catalog locally with an explicit refresh policy;
- contain no separate catalog database and no provider crawler;
- never proxy provider archives or accept arbitrary URLs.

This would be installed and launched by the agent host. It is not client-side website code and does not add server behavior to `antikylabs.com`.

## Revisit conditions

Consider a hosted remote MCP endpoint only when at least one of these becomes necessary:

- user-specific asset collections or favorites;
- authenticated AI-generation credits or jobs;
- server-side installation or conversion workflows;
- catalog queries that are too large or expensive for static delivery;
- measured agent-client demand that cannot use static JSON or a local stdio bridge.

Until then, static files are simpler, cacheable, inspectable, and sufficient for asset discovery.
