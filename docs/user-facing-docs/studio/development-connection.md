# Studio Development Connection

## Slice 00 status: N/A for Studio UI

Slice 00 does not add a Studio panel, desktop host, or Studio-specific launcher. The approved work
proves the connection boundary that a later Studio host will use.

Studio must attach through `connectDevelopmentClient` from `@antiky/cli`. That client reads the same
versioned `DevelopmentSnapshot` used by `antiky inspect` and the MCP adapter. It also exposes the
same controlled reload and frame-capture operations.

Studio must not parse terminal output, read React state, inspect the DOM, or create a second engine
service. See the [CLI development guide](../cli/development.md) and
[ADR 0004](../../adr/studio/0004-share-engine-services-with-cli_H.md) for the shipped boundary and
ownership decision.
