# An agent panel in Studio through ACP

**Recorded:** 2026-08-16
**Status:** researched and plausible; prove one local-agent vertical slice before making it a Studio
objective.
**Origin:** use the Agent Client Protocol already supported by Zed and coding-agent adapters instead
of creating an Antiky-specific conversation protocol.

## The opportunity

Studio already has the two hard pieces of an agent workflow: an embedded terminal for the user's
current coding tool and an MCP surface through which an agent can inspect and operate the running
game. What it does not have is a structured conversation surface. Terminal output cannot reliably
represent streaming messages, plans, tool progress, diffs, permission prompts, cancellation, or
restorable sessions.

[Agent Client Protocol (ACP)](https://agentclientprotocol.com/protocol/v1/overview) is the existing
boundary for that missing surface. An ACP **Client** owns the user interface and environment; an ACP
**Agent** owns its model loop and normally runs as a subprocess. They exchange bidirectional
JSON-RPC messages. The protocol standardizes session and presentation behavior without making
Studio own an AI provider or subscription.

The useful product promise is narrow: **use an already installed ACP-compatible coding agent in a
native Studio panel, with the running Antiky project available through the same MCP tools that other
clients use.** The agent keeps its own authentication, model selection, billing, instructions, and
provider configuration.

## ACP and MCP have different jobs

ACP must not replace Antiky's MCP API. The two protocols sit on opposite sides of the agent:

```text
person
  -> Studio agent panel
  -> ACP client in the native host
  -> coding-agent subprocess
  -> Antiky MCP server
  -> shared engine commands, queries, diagnostics, and captures
```

- **ACP is agent-to-UI:** prompts, streamed messages, plans, tool-call presentation, permission
  requests, session state, and cancellation.
- **MCP is agent-to-engine:** the structured game tools already required by
  [ADR 0003](../../adr/framework/0003-agent-native_H.md).
- **The embedded terminal remains direct CLI access:** it is still the right surface when the user
  wants the agent's native TUI or a normal shell rather than a Studio-hosted thread.

ACP session setup accepts a working directory and MCP server configuration. Studio can therefore
give the agent the open project's directory and the existing Antiky MCP endpoint. When an agent
cannot consume the development host's HTTP transport, the existing `antiky mcp --project ...`
command is the stdio bridge to that same development session. This preserves one engine API instead
of translating engine operations into ACP extensions.

## What the ecosystem already provides

This is no longer a protocol that Antiky would have to pioneer:

- The official [`agent-client-protocol` Rust
  crate](https://agentclientprotocol.com/libraries/rust) implements both client and agent roles,
  stdio, and process integration. It powers Zed's external-agent support.
- The official [`@agentclientprotocol/sdk` TypeScript
  package](https://agentclientprotocol.com/libraries/typescript) implements the same roles with
  typed handlers. [Both official SDKs reached
  1.0](https://agentclientprotocol.com/announcements/sdk-1-0-releases) in June 2026.
- The [ACP Registry](https://agentclientprotocol.com/get-started/registry) publishes installation
  metadata for authenticated agents. Its current catalog includes adapters or native support for
  Codex, Claude Agent, Gemini CLI, OpenCode, Copilot, Cursor, and others.
- [Zed's external-agent integration](https://zed.dev/docs/ai/external-agents) is the most relevant
  production reference: it spawns separate agent processes, leaves agent-native auth and settings
  with each agent, forwards configured MCP servers, supports custom command/argument entries, and
  exposes ACP logs for diagnosis.
- The protocol has spread beyond code editors to desktop, web, CLI, and game-editor clients. The
  official [client catalog](https://agentclientprotocol.com/get-started/clients) includes other
  Tauri/Rust desktop implementations and Unity integrations, so Studio's application shape is not
  exceptional.

## Recommended integration boundary

Put the ACP client and subprocess lifecycle in Studio's **Rust/Tauri host**, and send bounded,
validated view models to React through Tauri commands and events.

```text
React agent panel
  <-> typed Studio agent state and commands
Rust/Tauri ACP host
  <-> official Rust SDK
agent subprocess stdin/stdout

agent subprocess
  <-> configured Antiky MCP server
current `antiky dev` session
```

This matches the boundary Studio already uses for the managed project service: the native host owns
child processes, startup timeouts, shutdown, and validation, while the webview receives only the
state it needs. It also keeps executable paths, environment variables, stderr, and provider login
flows out of the browser surface.

The alternatives are weaker:

| Approach | Benefit | Cost | Verdict |
| --- | --- | --- | --- |
| Official Rust SDK in the Tauri host | Reuses Studio's process owner; official typed protocol; same implementation family as Zed | Adds an async protocol dependency and a native-to-React event projection | **Preferred** |
| Official TypeScript SDK in a Node sidecar | Familiar types beside the React application | Requires another long-lived bridge because the browser cannot own the process safely; duplicates lifecycle and validation across Node and Rust | Keep as fallback if the Rust SDK conflicts with Studio's runtime |
| Hand-written JSON-RPC | No SDK dependency | Must recreate bidirectional request correlation, capability negotiation, cancellation, streaming order, and protocol evolution | Do not do this |
| Embed one vendor's SDK | Potentially richer vendor-specific UI | Couples Studio to one provider, authentication scheme, and release cadence | Keep vendor features behind ACP adapters |

Do not reuse Zed's UI or integration code as a library. Use it as a behavioral reference and use the
official SDK as the dependency. Zed's implementation includes editor-specific buffers, terminals,
settings, and thread storage that Studio should not inherit.

## Start with stable v1

The first implementation should negotiate and run ACP v1. ACP v2 was published as a draft in July
2026; its maintainers explicitly advise feature-gating it, keeping v1 beside it, and not enabling it
by default in production. The SDK must own versioned protocol types so a later v2 path does not leak
conditionals through the React panel.

One v2 change reinforces the proposed boundary: [v2 removes ACP's client filesystem and command
execution methods](https://agentclientprotocol.com/protocol/v2/migration) and directs agents toward
client-provided MCP servers for client-side tools. Do not build Studio implementations of v1
`fs/*` or `terminal/*` for the first slice. Agents can use their own coding tools, while Antiky
operations remain behind Antiky MCP. Studio should initially advertise only capabilities it
genuinely implements.

## The smallest useful slice

The first slice should support one user-configured, already installed agent, one connection, and one
active session for the open project:

1. The user selects an agent command, arguments, and optional explicit environment overrides.
2. The native host starts the agent over newline-delimited stdio, captures stderr separately, and
   performs ACP initialization and capability negotiation.
3. Studio creates a session with the project directory and an Antiky MCP server configuration.
4. The panel sends text prompts and renders streamed agent text, plans, tool-call status, affected
   file locations or diffs, and stop reasons.
5. Permission requests block on an explicit user choice. Cancellation reaches the agent, and closing
   the project terminates and reaps the process.
6. A bounded diagnostic view records message direction, method, request ID, timing, and redaction
   state. Full prompt, result, environment, and stderr content is not persisted by default.

That slice is complete only when it works against at least two different ACP agents or adapters.
One agent proves a vendor integration; two agents test whether ACP is actually the boundary.

Deliberately leave these out:

- registry browsing, automatic downloads, and automatic updates;
- multiple simultaneous agent processes or sessions;
- durable Studio-owned transcript storage or cross-client session import;
- ACP proxy chains and custom ACP methods;
- Studio-provided general filesystem or shell tools;
- ACP v2 support enabled by default.

## Permission and trust boundaries

ACP describes permission requests, but it is not a sandbox. Its own architecture assumes a coding
agent that the user trusts, and an agent may also have native tools and native permission settings.
Studio must not claim that an ACP permission dialog constrains work that the selected agent performs
outside the client-provided capability.

Keep three authorities visibly separate:

| Authority | Enforced by |
| --- | --- |
| Whether Studio answers an ACP permission request | Studio's ACP policy and the user's choice |
| Whether an agent may call an Antiky engine tool | Antiky MCP permissions, revision checks, and the agent sandbox workflow |
| Whether the agent may execute arbitrary local commands or edit project files directly | The selected agent's own sandbox and permission model |

The native host should resolve an explicit executable rather than invoke a shell, pass arguments as
an array, start in the open project directory, apply a documented and sanitized baseline
environment plus explicit overrides, cap protocol and stderr messages, reject incompatible
messages, and kill the child on failed initialization or project close. Provider credentials remain
agent-owned. Studio should prefer the agent's native authentication and must not persist or surface
credentials in project files, ACP logs, MCP logs, or React state.

Registry support is a later supply-chain feature, not part of protocol support. A curated manifest
can describe where an agent comes from and how to run it, but Studio still needs an explicit policy
for download verification, executable placement, updates, rollback, removal, and user consent
before it installs anything.

## Risks and open questions

- **UI scope can grow into an IDE.** The ACP schema can express rich diffs, terminal output, file
  locations, commands, modes, usage, and history. The first panel should render what is needed to
  understand and approve the agent's work, not recreate a general code editor.
- **Permission meaning varies by agent.** Test and label what each supported adapter actually
  enforces. Never turn an agent's requested `allow_always` option into a global Studio grant.
- **Agent ownership of history varies.** Prefer the agent's session IDs and resume/list capabilities
  before inventing a second transcript store. Studio may need only lightweight local metadata.
- **MCP transport support varies.** Negotiate the agent's advertised MCP transports and use the
  existing stdio bridge when the direct HTTP endpoint is not compatible.
- **Draft v2 solves real future needs.** Background work, state upserts, improved diffs, and clearer
  permission subjects matter for parallel agents, but adopting the draft now would trade a small v1
  slice for dual-version product work.
- **Process isolation is not settled by ACP.** Studio still needs a product decision about whether a
  configured agent runs on the host, in a project sandbox, or through a remote environment.

## Cheapest proof

Build a headless spike in the Tauri crate before building the panel. It should use the official Rust
SDK to start two locally available ACP agents in turn, initialize v1, open a session for a fixture
project, pass the Antiky MCP server, send one prompt, collect streamed updates, exercise one denied
permission request and cancellation, and verify bounded shutdown after a malformed message or child
exit.

If this requires vendor-specific branches above command configuration and capability projection,
ACP is not providing the boundary Studio needs and the idea should stop. If the same host and state
projection work for both agents, the next artifact should be an AIP defining the agent panel's user
experience and permission semantics—not a larger protocol abstraction.

## Research sources

Checked 2026-08-16:

- [ACP architecture and subprocess model](https://agentclientprotocol.com/get-started/architecture)
- [ACP v1 overview and lifecycle](https://agentclientprotocol.com/protocol/v1/overview)
- [Initialization and capability negotiation](https://agentclientprotocol.com/protocol/v1/initialization)
- [Session setup and MCP configuration](https://agentclientprotocol.com/protocol/v1/session-setup)
- [Tool-call updates and permission requests](https://agentclientprotocol.com/protocol/v1/tool-calls)
- [stdio transport requirements](https://agentclientprotocol.com/protocol/v1/transports)
- [Official Rust SDK](https://github.com/agentclientprotocol/rust-sdk)
- [Official TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)
- [ACP v2 draft status and migration guidance](https://agentclientprotocol.com/announcements/acp-v2-draft)
- [Zed external agents](https://zed.dev/docs/ai/external-agents)
- [ACP Registry format and distribution model](https://agentclientprotocol.com/rfds/acp-agent-registry)

## Related Antiky decisions

- [Studio architecture](../../architecture/studio/overview_A.md) — integrated terminal, agent
  workflow, AI policy, diagnostics, and process-execution boundaries.
- [ADR 0003](../../adr/framework/0003-agent-native_H.md) — Studio and agents share one engine API;
  MCP is an adapter and does not control Studio UI.
- [Contextual feedback](../../architecture/studio/contextual-feedback_A.md) — agent-visible comments,
  queueing, untrusted input, and separate read/write permissions.
