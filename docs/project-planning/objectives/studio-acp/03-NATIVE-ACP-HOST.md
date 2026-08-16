# Native ACP host

This document selects the native process, protocol, MCP, lifecycle, security, and Tauri-boundary
design for one ACP agent. It keeps operating-system authority in Rust and editor behavior in the
portable Studio application.

## Ownership boundary

```text
React AgentPanel / agent coordinator
  -> typed AgentHost commands
  <- validated snapshots and sequenced updates
Tauri command/event adapter
  -> AgentHost state machine
  -> official ACP Rust client
  <-> one child agent over stdio
                 -> configured Antiky MCP server
```

The Rust `AgentHost` owns executable resolution, child process, protocol connection, ACP client
callbacks, session and turn identity, permission request correlation, stderr retention, timeouts, and
shutdown. It does not own transcript layout, selection-follow policy, prompt wording, or editor
workspace state.

The React-facing `AgentHost` TypeScript interface is separate from the current project `EditorHost`
and CLI development client. This keeps each surface small and allows browser builds to provide an
explicit unavailable implementation without importing Tauri.

## Native module shape

The first implementation should add one cohesive `agent` module inside `packages/studio/tauri/src/`
with private submodules only when the tested code becomes difficult to understand as one file. It
owns:

- `AgentHost` guarded by the existing application state pattern;
- exact profile/configuration input and resolved launch configuration;
- process and protocol state machine;
- normalized public snapshots and updates;
- bounded diagnostic ring;
- command handlers and event emission;
- test-only fake-agent fixtures.

Do not create a generic process supervisor or protocol bus first. Project-service and terminal
processes have different contracts, and ACP is the only current consumer of bidirectional structured
child messages.

## Profile and launch rules

The first slice supports one selected `AgentProfileV1` in user-local Studio data. Profile persistence
uses an atomic validated file behind a small store, following the recent-project store's ownership
pattern rather than changing the strict project manifest.

Launch validation requires:

- a non-empty stable profile ID and bounded label;
- an executable resolved to a regular file or a documented host path lookup result;
- no shell string, shell expansion, command substitution, or concatenated arguments;
- a bounded argument count and bounded argument values;
- the active validated project directory as `cwd`;
- a minimal documented inherited environment plus explicit pass-through names and bounded non-secret
  overrides;
- rejection or non-persistence of literal values identified as credentials, tokens, passwords, or
  private keys.

Provider authentication remains wherever the installed agent owns it. Studio can launch an agent
that uses its normal credential file, keychain, browser login, or inherited approved environment. It
does not become a provider credential store in this objective.

## Process and protocol behavior

1. `start` resolves the current profile and active project identity, increments the host generation,
   spawns one child without a shell, and captures stdin/stdout/stderr separately.
2. Protocol stdout is reserved for ACP stdio. A malformed, non-UTF-8, oversized, or out-of-sequence
   protocol message fails the connection and initiates bounded stop.
3. Stderr is not protocol. The host keeps a byte- and entry-bounded redacted tail for diagnostics and
   never forwards an unbounded stream into Tauri events.
4. The official SDK performs initialization and version/capability negotiation. Studio advertises
   only handlers it implements.
5. After initialization, the host creates one ACP session with the project directory and selected
   MCP servers. Only then does public state become `ready`.
6. `prompt` is accepted only in `ready`, transitions to `prompting`, and has one turn correlation.
   Standard ordered updates are projected until one terminal stop reason returns state to `ready`.
7. `cancel` is idempotent for the current turn. A late terminal update cannot revive a retired host
   generation or ACP session.
8. `stop` prevents new commands, answers or cancels any pending client request according to protocol
   rules, asks for graceful closure where supported, closes input, waits to a bound, kills if needed,
   reaps the child, and publishes one terminal state.

Startup, prompt-client-request, cancellation, and shutdown each need separate bounds because their
failure meanings differ. Tests can inject short bounds; product constants should be based on observed
agents and remain diagnostics, not prose-only promises.

## MCP session configuration

ACP session setup receives one Antiky MCP server named and described as the current project
development service.

Preferred order:

1. Use the current loopback `${inspectionUrl}/mcp` endpoint when the agent advertises the compatible
   HTTP transport. Validate that the origin is exactly the current development loopback origin.
2. Otherwise use the existing stdio bridge through a host-resolved Antiky CLI executable and explicit
   `['mcp', '--project', manifestPath]` arguments.
3. If neither transport is compatible, create the ACP session without falsely claiming Antiky engine
   access and show a blocking capability issue before selection-follow can be enabled.

The loopback MCP route intentionally does not use the inspection REST credential. The credential
remains inside the existing Studio development client. The stdio bridge receives the manifest path as
launch configuration, not as prompt content or log output.

## Permission requests

The host projects each standard ACP permission request with:

- host generation, ACP session, turn, and request identity;
- bounded subject/tool/title information the protocol supplies;
- exactly the choices the agent offered, normalized without adding broader grants;
- a deadline or terminal state when the request is no longer answerable.

Only the active matching request accepts a response. Closing the project, canceling the turn, child
exit, or a new host generation invalidates it. “Allow always” is not turned into a persistent Studio
grant in the first slice even if an agent presents that option; the UI must label the agent-defined
scope rather than implying global enforcement.

## Tauri contract

Commands should be coarse and stateful:

- read configuration and current snapshot;
- save/select one validated profile;
- start and stop the configured agent;
- create a new session when the process supports it;
- submit one bounded prompt-content request;
- cancel the active turn;
- answer the active permission request.

Events carry an exact schema version, host generation, monotonic sequence, event kind, and one bounded
payload. The web adapter reads an initial snapshot before subscribing, detects a sequence gap, and
recovers by reading a fresh snapshot. It does not accept arbitrary SDK-shaped maps.

Full prompt text and context can cross the command boundary because they are the requested operation,
but event diagnostics do not echo them. Protocol request IDs, method/update kind, direction, byte
count, duration, redaction/truncation flags, and safe correlation IDs are sufficient for diagnosis.

## Failure rules

| Failure | Required behavior |
| --- | --- |
| Executable unavailable | Remain stopped with a profile-specific safe error; do not search or install software automatically. |
| ACP version/capability mismatch | Kill and reap the child; report supported/received protocol facts without raw payloads. |
| MCP transport unavailable | Keep ACP capability truthful; block engine-dependent follow mode and explain the recovery. |
| Malformed or oversized stdout | Fail the connection, stop and reap, retain only bounded redacted diagnostic metadata. |
| Stderr flood | Truncate the diagnostic tail without blocking stdout or growing memory. |
| Permission response races cancellation | Exactly one terminal action wins; the other receives a stable retired-request error. |
| Child exits during a turn | End the turn and session once, preserve visible in-memory history, and require explicit restart. |
| Project/runtime changes | Project change retires the ACP session; runtime change keeps the thread but invalidates old Antiky context and pending selection dispatch. |
| Studio exits | Best-effort graceful stop followed by operating-system/process cleanup; no detached ACP child is intentional. |

## Verification

- Rust unit tests cover state transitions, generation fences, validation, redaction, bounds, and
  idempotent stop.
- Fake subprocess tests cover every bidirectional protocol branch and cleanup after crash/malformed
  output.
- Tauri serialization tests lock exact public DTOs, not internal SDK types.
- A packaged-app proof resolves both direct HTTP MCP and stdio fallback where supported.
- Process inspection after stop/project switch confirms no managed child remains.

## Options, cost, and exclusions

A generic shared process host could reduce superficial duplication with the project service, but it
would need to encompass request/response streaming, permissions, stderr policy, and ACP state that no
other child needs. A dedicated deep module is cheaper to reason about. The cost is Rust async and
process test infrastructure plus a meaningful Tauri projection.

This design does not install agents, execute through a shell, persist transcripts, own provider
credentials, expose raw JSON-RPC, add arbitrary native tools, support multiple processes, or promise
that ACP permissions sandbox agent-native behavior.
