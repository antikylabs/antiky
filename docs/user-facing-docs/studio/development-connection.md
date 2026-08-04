# Studio Development Connection

A Studio integration attaches to the development session already owned by `antiky dev`. It does not
launch a second game runtime or create a separate inspection service.

Use `connectDevelopmentClient` from `@antiky/cli`. The client reads the same versioned
`DevelopmentSnapshot` returned by `antiky inspect` and the MCP adapters. It also exposes the same
controlled reload and frame-capture operations.

```ts
import { connectDevelopmentClient } from '@antiky/cli';

const client = await connectDevelopmentClient('/path/to/antiky.config.json');
const snapshot = await client.readDevelopmentSnapshot();
```

Start `antiky dev` before connecting. The typed client discovers the active session descriptor,
authenticates to its loopback inspection service, rejects a descriptor that does not match the
selected config, and verifies the development-session ID returned by the service.

A Studio integration must treat `DevelopmentSnapshot` as the source of truth. It must not parse
terminal output, read application-framework state, inspect the DOM, or infer render facts from a
frame capture. Subscribe or poll through the shared client boundary and identify state by its
development-session, runtime-instance, build-revision, capture, and action IDs.

See the [CLI development guide](../cli/development.md) for startup, MCP, security, and cleanup, and
[ADR 0004](../../adr/studio/0004-share-engine-services-with-cli_H.md) for the service-ownership
decision.
