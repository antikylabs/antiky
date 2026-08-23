# Capability diagnosis

This document establishes the actual gap between Studio's current terminal/MCP workflow and the
owner's requested click-to-agent workflow. It separates ACP transport, selected-context semantics,
and the existing GPU-selection prerequisite before the implementation strategy connects them.

## The desired trace

The objective needs one complete, observable path:

```text
displayed pixel
  -> temporary GPU pick value inside the render driver
  -> stable Framework EntityId
  -> current Framework selection
  -> one observed world/context projection
  -> visible ACP prompt content
  -> active coding-agent session
  -> optional fresh Antiky MCP calls
```

The active BroMetal request objective owns the first four steps through current selection in Studio.
This objective begins at that stable selected identity. It must not expose the temporary GPU value or
reimplement selection in React.

## Current capability

| Area | Current evidence | Diagnosis |
| --- | --- | --- |
| User-selected coding tool | Studio ADR 0001 keeps provider, account, and billing choice with the user. Studio already has a native terminal in the fixed workspace (`packages/studio/app/src/components/StudioShell.tsx:339-352`). | Product direction is compatible. A terminal is not a structured conversation surface. |
| Native process ownership | Tauri owns project and development hosts, resource paths, and terminal operations (`packages/studio/tauri/src/commands.rs:19-26`; `packages/studio/tauri/src/lib.rs:66-173`). | The correct authority exists, but no ACP host or state exists. |
| Portable UI boundary | `EditorHost` contains project operations only, and its Tauri adapter validates exact process-boundary values (`packages/studio/app/src/editor/types.ts:44-53`; `packages/studio/app/src/editor/tauriHost.ts:72-190`). | A narrow agent-host adapter and validated DTOs are missing. Raw ACP must not spread through React. |
| ACP dependency | Studio's Rust manifest has Tauri, Serde, and small native dependencies but no ACP SDK or async process layer (`packages/studio/tauri/Cargo.toml:17-24`). | SDK/toolchain compatibility and process integration need an early proof. |
| Conversation UI | The workspace mounts Live game, Terminal, Inspection, and Activity directly (`packages/studio/app/src/components/StudioShell.tsx:300-360`). | No agent session state, prompt composer, stream renderer, tool progress, permission UI, or cancellation exists. |
| MCP service | Each development session owns an MCP URL, and the CLI can bridge the same session over stdio (`packages/cli/src/host/session/index.ts:91-100,297-301`; `packages/cli/src/cli.ts:378-386`). | The engine API exists. ACP session setup must pass it to the agent without creating a second engine adapter. |
| World semantics | Framework validates bounded entities, `ChildOf` relations, components, and named authoring/runtime/render stores (`packages/framework/src/inspection/world.ts:14-117`). | Most inputs for an entity context exist. A selected-context projection does not. |
| Observation fencing | `DevelopmentSnapshotV2` adds an observation reference to the project, build, development-session, and Framework snapshot (`packages/cli/src/development/types.ts:46-99`). | One immutable capture can be identified. The context contract and deduplication key are missing. |
| Selection | `InspectionSnapshot` currently has no selection field (`packages/framework/src/inspection/snapshot.ts:62-119`). The BroMetal request plan defines that addition and Studio selection behavior. | Hard prerequisite for click-driven handoff; do not duplicate it here. |
| Hierarchy UI | Studio already derives parent/child maps and shows components and matching stores (`packages/studio/app/src/components/InspectionPanel.tsx:26-135`). | This logic is presentation code, not a reusable context API. |
| Asset/render dependency graph | Architecture requires inspectable asset dependencies and entity-to-render mappings, but current generic store entries only guarantee an optional owner `entityId` plus bounded JSON (`packages/framework/src/inspection/world.ts:39-50,88-100`). | Include published semantic links and explicit incompleteness. Do not claim an unimplemented global graph. |

## The actual defects

### There is no ACP client

Studio cannot initialize an ACP agent, create or resume a session, send a prompt, receive streamed
updates, answer permission requests, cancel a turn, or shut down the process. An embedded terminal
can show an agent's TUI, but Studio cannot reason about or present its structured state.

### There is no shared selected-context contract

When Framework selection arrives, React could independently search the world, walk ancestors, filter
stores, and serialize JSON. That is attractive because the necessary values are already in memory,
but it makes the panel a semantic authority. Contextual feedback and future MCP resource attachment
would then need to copy or disagree with the same rules.

### Automatic submission needs policy, not only wiring

Snapshot polling can report the same selection many times, selection can change faster than an agent
turn finishes, a retained snapshot can become stale, and bounded world inspection can omit an
ancestor or store value. Sending on every render would create duplicate paid turns and would call
partial data complete. The workflow needs one stable context identity, explicit freshness and
completeness, and latest-pending coalescing.

### ACP permission is not engine or filesystem authority

An ACP agent can have native coding tools beyond what it requests through the client. Conversely,
approving an ACP tool call does not bypass Antiky MCP permissions or revision checks. The UI must
show which authority a prompt refers to and must not market ACP permission presentation as a full
sandbox.

## Approaches considered

| Approach | Benefit | Failure or cost | Decision |
| --- | --- | --- | --- |
| Keep only the embedded terminal | No protocol or panel work. | Cannot attach structured context, present ACP state, or satisfy the requested automatic submission. | Reject as completion path. |
| Run the ACP TypeScript SDK in React | Direct UI integration. | A browser cannot safely own the local executable; Tauri details and secrets leak into presentation code. | Reject. |
| Add a Node ACP sidecar | Keeps process work outside React. | Adds a second long-lived bridge and splits lifecycle/validation between Node and Rust. | Fallback only after a proved Rust incompatibility. |
| Write JSON-RPC by hand in Rust | Avoids an SDK dependency. | Recreates capability negotiation, bidirectional request correlation, cancellation, and protocol evolution. | Reject. |
| Use the official Rust SDK in a native ACP host | Matches Studio process ownership and uses the protocol's typed implementation. | Adds Rust async/process integration and a meaningful event projection. | Select. |
| Build context only in the panel | Small initial patch. | Creates Studio-local world semantics and divergent future feedback/MCP behavior. | Reject. |
| Framework semantic context plus CLI observation envelope | Preserves one API and reuses browser-safe development data. | Adds two versioned projections and strict boundary tests. | Select. |

## Completion diagnosis

The objective is complete only when all of these statements are true:

1. The native host starts one configured installed ACP v1 agent without a shell, negotiates
   capabilities, and creates one session scoped to the active project.
2. The same host projection works against two distinct real ACP agents or adapters without
   vendor-specific branches above profile configuration and advertised capabilities.
3. Studio sends text prompts and renders bounded streamed text, plans, tool-call state, permission
   requests, cancellation, stop reasons, and safe diagnostics.
4. The ACP session receives the active Antiky MCP service, and agent engine work appears in the same
   development-session MCP call log.
5. A current selected `EntityId` becomes one versioned context with target revision, complete retained
   ancestor path, components, applicable semantic authoring/runtime/render entries, and explicit
   freshness/completeness state.
6. Enabling selection-follow causes a new current context to appear visibly in the transcript and be
   submitted once. Repeated polls do not duplicate it, and rapid pending selections coalesce to the
   latest context.
7. Stale, missing, incompatible, or cleared selection does not auto-submit. Partial bounded context
   is labeled partial to the user and agent.
8. Project change, runtime reload, child exit, malformed output, cancellation, and Studio close
   leave no publishable stale session and reap the managed process within a bound.
9. GPU objects, temporary GPU IDs, REST credentials, provider credentials, unrestricted paths, full
   environment values, and unbounded protocol/stderr content never enter the context or React state.

## Cost of the selected direction

This is cross-language and cross-package work. It changes Framework inspection projections, CLI
development projections, the Rust native host, the Tauri boundary, React state and UI, packaging,
and integration evidence. It also needs deterministic fake-agent tests and conditional proofs against
real installed agents. The cost is justified because smaller approaches either fail the owner's
workflow or establish a second semantic authority.

## Not covered by this diagnosis

This diagnosis does not select a registry, install or update agents, define a public support list,
build a general IDE, implement ACP v2, persist transcripts, create contextual-feedback storage, or
finish the global asset/render dependency system. Those are separate product capabilities.
