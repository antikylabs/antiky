# Implementation strategy

This document selects the delivery shape, dependency order, work-unit range, and deliberate
exclusions. The strategic choice is two proof-first vertical seams that converge: a native ACP v1
conversation path and a shared selected-context path. Automatic submission is added only after both
seams are independently truthful.

## Strategic choice

The implementation will:

- integrate the official ACP Rust SDK in a dedicated Tauri-owned `AgentHost`;
- expose a small, exact, sequenced agent view model through a portable React adapter;
- place an Agent tab beside the existing Terminal rather than redesign the workspace;
- pass the current Antiky MCP service during ACP session creation;
- add Framework and CLI selected-context projections with explicit completeness;
- add an explicit selection-follow mode with deduplication and latest-pending coalescing; and
- prove the complete behavior against deterministic fixtures, two real ACP agents or adapters, and
  the real BroMetal-selected entity path.

The work does not wait for the Studio apps objective. The fixed Terminal/Agent tab is a first
consumer that can later become an app contribution without making an unproved extension system a
prerequisite.

## Dependency graph

```text
A. Freeze ACP/profile/DTO/context contracts and prove SDK compatibility
   ├── B. Native ACP host, MCP configuration, lifecycle, diagnostics
   ├── C. Portable agent state, panel, permissions, manual prompts
   └── D. Framework context + CLI observation envelope

B + C -----------------------> manual Studio ACP conversation
C + D -----------------------> visible selected-context attachment
B + C + D + Framework selection -> E. automatic selection-follow dispatch
E + two real agents + GPU fixture -> F. integrated proof and hardening
F ---------------------------> G. evidence and documentation closeout
```

A comes first because the official SDK, pinned Rust toolchain, and normalized DTO shape must be
proved before native and React work harden incompatible assumptions. B, C, and most of D can proceed
independently afterward. E cannot start from Studio-local selection state or placeholder context; it
requires the stable Framework selection contract. F cannot claim protocol portability from a fake
agent or selection correctness from a synthetic ID alone.

## Phase A: freeze contracts and build the headless conformance shell

**Purpose:** falsify the highest-risk integration assumptions before building the panel.

1. Recheck the current stable ACP v1 Rust SDK release and official API when implementation begins.
   Pin an exact compatible version in the Tauri crate.
2. Compile a headless native test harness against Studio's Rust 1.85/Tauri dependency graph. If the
   SDK requires an incompatible runtime or toolchain, record exact evidence before evaluating the
   Node-sidecar fallback.
3. Implement deterministic fake ACP agents as test subprocesses. Cover initialize, capability
   negotiation, new session, prompt/update ordering, permission request/response, cancellation,
   malformed line, oversized line, stderr flood, child exit, and bounded shutdown.
4. Freeze `AgentProfileV1`, native command/request DTOs, sequenced event DTOs, safe error codes, and
   the lifecycle state machine from [`01-ACP-AND-SELECTION-VOCABULARY.md`](01-ACP-AND-SELECTION-VOCABULARY.md).
5. Freeze `SelectionContextInspectionV1` and `DevelopmentSelectionContextV1` fixtures without yet
   wiring them to ACP.

This phase is **2-3 work units**. One work unit is one reviewable, test-backed implementation
increment, not elapsed time. SDK/runtime incompatibility is the main expansion risk.

## Phase B: implement the native ACP host

**Purpose:** own one ACP process and project session safely outside the webview.

1. Add a dedicated Rust module with one managed child, SDK client connection, host generation,
   project identity, ACP session identity, turn state, pending permission, bounded diagnostics, and
   idempotent stop.
2. Resolve the agent executable directly, pass arguments without a shell, set the active project
   working directory, apply the documented environment policy, and separate protocol stdout from
   bounded stderr diagnostics.
3. Initialize ACP v1, advertise only implemented client capabilities, and create a session with the
   current project plus negotiated Antiky MCP configuration.
4. Prefer the direct loopback MCP endpoint when the agent supports that transport. Use a host-resolved
   `antiky mcp --project <manifest>` stdio bridge when needed. Never pass the development REST
   credential through React or prompt context.
5. Normalize supported updates, permission requests, cancellations, stop reasons, and errors into
   strictly sequenced Tauri events. Fence every command and event by host generation and active
   project/session identity.
6. Stop and reap on explicit disconnect, project replacement, failed initialization, malformed or
   oversized protocol data, child exit, and application teardown.

This phase is **3-5 work units**. Cross-platform process-group cleanup and SDK callback integration
are the likely expansion points. Details are in [`03-NATIVE-ACP-HOST.md`](03-NATIVE-ACP-HOST.md).

## Phase C: add the portable Agent panel

**Purpose:** prove useful ACP presentation without rebuilding Studio's workspace or a code editor.

1. Add a narrow `AgentHost` TypeScript interface, a Tauri implementation with exact parsers, and an
   unavailable browser/test implementation. Do not mix ACP methods into project or development
   clients.
2. Build an agent coordinator that applies ordered snapshots/events, rejects gaps and retired
   generations, and offers connect, new session, prompt, cancel, permission response, and stop.
3. Add Terminal and Agent tabs to the existing lower-left panel so the current four-panel layout,
   native terminal overlay, splitters, Inspection, and Activity remain intact.
4. Render profile/connection state, transcript items, streaming text, plans, tool progress, file or
   diff summaries, permission cards, stop reasons, cancellation, and safe diagnostics. Unsupported
   rich content remains visible as unsupported rather than disappearing.
5. Keep transcript state in memory for the active process/session. Restore or durable storage is not
   added.

This phase is **3-4 work units**. Accessible streaming, focus, permission interaction, and native
terminal tab switching are the larger UI risks. Details are in
[`04-STUDIO-AGENT-PANEL.md`](04-STUDIO-AGENT-PANEL.md).

## Phase D: add the shared selected-context path

**Purpose:** turn one stable selection and observation into context without making Studio a world
model.

1. After the BroMetal selection schema is frozen, add a pure Framework projection that validates the
   selection and world belong to the same runtime/world observation.
2. Resolve the target entity, walk `ChildOf` to a root, retain root-to-parent entity summaries, copy
   target components, and include matching bounded semantic store entries in deterministic order.
3. Detect missing targets, cycles, truncated relationship views, incomplete stores, and unavailable
   render/asset trace. Return stable completeness reasons; never synthesize resource dependencies.
4. Add a browser-safe CLI projection that wraps the Framework value with development session,
   project/build revision, and `ObservationRefV1`. Export it through the existing development package.
5. Add strict local/serialized equivalence, size, ordering, mutation-isolation, and malformed-input
   tests. Add a fixture containing at least one authoring, runtime, and render link for the selected
   entity.

This phase is **2-4 work units**. It can begin with synthetic Framework selection after its contract
is accepted, but integrated completion waits for the BroMetal objective. Asset/render semantics are
the main uncertainty. Details are in [`05-SELECTION-CONTEXT-HANDOFF.md`](05-SELECTION-CONTEXT-HANDOFF.md).

## Phase E: connect explicit automatic submission

**Purpose:** make clicking a current item create exactly one visible ACP turn.

1. Add session-scoped “Follow Studio selection” state. The user explicitly enables it; Studio does
   not silently spend agent turns for ordinary navigation outside that mode.
2. Project context from the same current snapshot that supplied selection. Show a context attachment
   preview with target, ancestry, observation, completeness, and size before or as it is dispatched.
3. Send a visible Studio-generated prompt plus the bounded versioned context through standard ACP v1
   content supported by the negotiated agent.
4. Deduplicate by ACP session and context identity. While a turn is active, retain only the latest
   eligible pending context and show when an older pending context is replaced.
5. Do not auto-submit clear, stale, missing, incompatible, or retired context. Mark partial context
   in both the transcript and payload. Stop following when the project or ACP session changes.
6. Record safe dispatch diagnostics and correlation identities without retaining prompt bodies or
   serialized context in the diagnostic log.

This phase is **2-3 work units**. Agent differences in embedded resource support are the likely
expansion; the canonical text fallback must remain complete.

## Phase F: integrated proof and hardening

**Purpose:** prove that ACP is the real boundary and that click context reaches the intended thread.

1. Reuse the BroMetal request integration fixture. Do not create a second CPU or synthetic picking
   system for acceptance.
2. Prove click -> GPU resolution -> stable Framework entity -> selected context -> visible ACP turn ->
   agent receipt. Confirm the same development session records any follow-up Antiky MCP calls.
3. Run the host and panel against two installed ACP v1 agents or adapters in turn. Configuration and
   advertised capabilities may differ; native host and React state semantics may not branch by vendor.
4. Exercise no-hit, repeat poll, rapid clicks, active-turn coalescing, incomplete world, target
   deletion, runtime reload, project switch, denied permission, cancellation, child crash, malformed
   output, and Studio restart.
5. Measure message/context sizes, event queue depth, dispatch latency, stderr truncation, process
   cleanup, and UI responsiveness. Record observed baselines before choosing permanent budgets beyond
   hard safety bounds.

This phase is **2-4 work units**. Availability and behavior of two real agents plus the real GPU/UI
harness are the largest evidence risks. Details are in
[`06-INTEGRATION-PROOF-AND-VERIFICATION.md`](06-INTEGRATION-PROOF-AND-VERIFICATION.md).

## Phase G: reconcile and close the slice

**Purpose:** leave source-based documentation and no overstated support claims.

1. Update maintained Studio and Framework architecture where the shipped workflow resolves current
   open decisions.
2. Document agent profile setup, permission boundaries, selection-follow behavior, completeness
   labels, diagnostics, MCP availability, and recovery.
3. Record exact agents, versions, operating systems, transports, and evidence used. Do not turn those
   observations into a permanent compatibility promise.
4. Audit dependency versions and any SDK workaround for retirement conditions.
5. Keep deferred registry, persistence, concurrency, feedback, and asset-graph work explicit.

This phase is **1-2 work units**, depending on whether implementation evidence requires a later ADR or
compatibility note.

## Effort range and assumptions

The phases total approximately **15-25 work units**, expected to become roughly **6-8 bounded goals**
during `create-goals`.

The range assumes:

- the current official ACP Rust SDK compiles with Studio's pinned Rust/Tauri environment;
- at least two ACP v1 agents or adapters are available for conditional integration proof;
- an agent accepts either the current loopback MCP endpoint or the existing stdio bridge;
- the BroMetal request objective delivers stable entity selection through the existing snapshot;
- the selected fixture publishes enough semantic store information for one truthful render/resource
  trace; and
- adding Terminal/Agent tabs does not require the Studio apps extension system.

The two largest blow-up risks are native SDK/process integration and the combined real-agent plus
real-GPU Studio harness. If either assumption fails, preserve protocol and identity correctness; do
not replace them with hand-written protocol code or synthetic selection and call the objective done.

## Deliberate exclusions

- ACP Registry browsing, downloads, updates, signatures, rollback, or a public marketplace.
- More than one live agent process, ACP connection, or session; background and parallel agent work.
- Durable Studio transcript ownership, cross-client thread import, or session synchronization.
- ACP v2 enabled by default, proxy chains, custom ACP methods, or Studio-provided general filesystem
  and shell operations.
- Provider billing, API tokens, model selection, or a Studio-hosted AI service.
- A general code editor, full diff editor, terminal emulator, or replacement for agent-native tools.
- A second selection service, durable selection history, selection as gameplay input, or CPU picking
  as acceptance evidence.
- Contextual-feedback queue/storage, automatic code changes, or automatic feedback resolution.
- A general asset system or render graph. This objective carries explicitly published semantic links
  and reports unavailable detail honestly.
- Rebuilding the workspace or waiting for the Studio apps objective before proving the Agent panel.
- Public claims that every ACP agent is supported merely because two implementations passed the proof.
