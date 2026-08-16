# ACP client and agent boundary research

This document compiles the existing ACP research that the owner promoted into the objective. The
original idea was evidence, not authority; the numbered plan applies the conclusions to current
Antiky decisions.

## Established conclusions

### ACP fills the agent-to-UI gap

Studio has an embedded terminal and Antiky has an MCP server, but neither is a structured
conversation protocol. ACP defines a client owned by the user interface and an agent that normally
runs as a subprocess. Its session protocol covers prompts, streamed content, plans, tool-call
presentation, permission requests, cancellation, and stop reasons.

ACP and MCP have different jobs:

```text
person -> Studio panel -> ACP client -> coding agent
                                  coding agent -> Antiky MCP -> engine services
```

ACP must not become an Antiky engine API. The agent receives the current project working directory
and an Antiky MCP server configuration when the ACP session starts. Antiky commands, queries,
diagnostics, and captures remain MCP operations backed by the existing typed development client.

### The native host is the process owner

The researched options were the official Rust SDK in Tauri, the TypeScript SDK in a Node sidecar,
hand-written JSON-RPC, and a vendor SDK. The official Rust SDK in Tauri is the selected starting
point because Studio already gives its native host responsibility for local processes and because it
keeps executable paths, environment policy, stderr, and provider authentication outside React.

A Node sidecar remains a fallback only if an early headless proof establishes a concrete Rust SDK or
runtime incompatibility. Hand-written JSON-RPC and a vendor SDK are rejected because they recreate
protocol behavior or bind Studio to one provider.

### Stable ACP v1 is the first contract

Both official SDKs reached 1.0 in June 2026. ACP v2 was still a draft in the research snapshot and
its migration guidance recommended a feature-gated, v1-compatible rollout. The first slice therefore
uses stable v1 through the official SDK and advertises only capabilities Studio implements.

Studio does not implement ACP client filesystem or general terminal execution methods in the first
slice. Coding agents keep their own coding tools. Antiky engine operations remain behind MCP.

### The first proof is intentionally small

The smallest useful product slice is one user-configured installed agent, one process connection,
one active ACP session for the open project, text prompts, streamed text and plans, tool-call status,
permission decisions, cancellation, stop reasons, and bounded diagnostics.

The same host and UI projection must work against two ACP-compatible agents or adapters. A single
agent proves only one integration. The proof does not require those two agents to become a permanent
support list.

## Trust conclusions

Three authorities remain separate:

| Authority | Owner |
| --- | --- |
| Whether Studio answers an ACP permission request | Studio ACP policy and the user's explicit choice |
| Whether the agent may call an Antiky engine tool | Antiky MCP permissions and revision checks |
| Whether the agent may edit files or execute its own commands | The selected agent's sandbox and permission model |

ACP permission presentation is not a sandbox claim. Studio resolves an explicit executable without a
shell, passes arguments as an array, uses the project directory, applies a documented bounded
environment, separates stderr from protocol stdout, caps messages, and reaps the child on failure or
project close. Provider credentials remain agent-owned and never enter project state, React state, or
diagnostic content.

## Primary sources checked in the promoted research

- [ACP architecture](https://agentclientprotocol.com/get-started/architecture)
- [ACP v1 overview](https://agentclientprotocol.com/protocol/v1/overview)
- [Initialization](https://agentclientprotocol.com/protocol/v1/initialization)
- [Session setup](https://agentclientprotocol.com/protocol/v1/session-setup)
- [Tool calls and permissions](https://agentclientprotocol.com/protocol/v1/tool-calls)
- [stdio transport](https://agentclientprotocol.com/protocol/v1/transports)
- [Official Rust SDK](https://github.com/agentclientprotocol/rust-sdk)
- [SDK 1.0 releases](https://agentclientprotocol.com/announcements/sdk-1-0-releases)
- [ACP v2 draft](https://agentclientprotocol.com/announcements/acp-v2-draft)
- [ACP v2 migration](https://agentclientprotocol.com/protocol/v2/migration)
- [Zed external agents](https://zed.dev/docs/ai/external-agents)
- [ACP Registry](https://agentclientprotocol.com/rfds/acp-agent-registry)

These sources were checked on 2026-08-16. Registry contents, package versions, and draft protocol
status must be rechecked when implementation begins because they can change.

## Remaining evidence gaps

- The official Rust SDK has not been compiled in Studio's Rust 1.85/Tauri dependency set.
- Two installed agents have not run through one Antiky host projection.
- Packaged Studio has not proved the direct HTTP MCP configuration and stdio bridge fallback.
- Permission semantics vary by agent and must be labeled from observed behavior.
- Studio has not rendered ACP updates or recovered from malformed protocol output and child exit.

These gaps justify a headless conformance slice. They do not require more planning research.
