# Decisions and dependencies

This document records how the plan applies accepted decisions, which neighboring objectives it
depends on, which choices are implementation defaults, and which conditions would require a new
owner or architecture decision.

## Accepted-decision alignment

| Record | Constraint | Plan application |
| --- | --- | --- |
| [Studio ADR 0001](../../../adr/studio/0001-ai-integrations_H.md) | Users choose coding agents/providers; Antiky supplies no required AI subscription. | Launch one already installed ACP agent and leave authentication, model, billing, and native sandbox with it. |
| [Studio ADR 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md) | Portable editor behavior stays independent of Tauri behind a small host contract. | Rust owns ACP/process work; React uses a narrow `AgentHost` adapter and exact DTOs. |
| [Studio ADR 0006](../../../adr/studio/0006-use-cli-project-services-directly_H.md) | CLI project services remain development authority; portable UI cannot create another project service. | ACP is a separate agent process, while current CLI services still own game, inspection, and MCP. ACP receives the existing service. |
| [Framework ADR 0003](../../../adr/framework/0003-agent-native_H.md) | Humans and agents share one engine API; MCP is an adapter. | ACP carries conversation only. Agent engine operations remain Antiky MCP calls backed by shared services. |
| [Framework ADR 0009](../../../adr/framework/0009-separate-state-projections_H.md) | Authoring, runtime, and render state are distinct. | Selection context labels store kind and never merges their values into one authoritative state. |
| [Framework ADR 0010](../../../adr/framework/0010-serialize-at-boundaries_H.md) | Serialize only at real boundaries; validate JSON by default. | Framework/CLI use typed projections in process; Tauri and ACP crossings use versioned bounded data. |
| [Framework ADR 0011](../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md) | Stable UUIDv7 IDs differ from temporary aliases. | Context uses stable `EntityId`; temporary GPU IDs never cross the driver. |
| [Framework ADR 0021](../../../adr/framework/0021-brometal-render-driver-ownership_H.md) | BroMetal/GPU objects stay inside the driver. | The GPU-to-ECS trace contains semantic render keys and selected stable owner only. |
| [Framework ADR 0022](../../../adr/framework/0022-use-gpu-ids-to-select-framework-entities_H.md) | GPU IDs select Framework entities. | The BroMetal request objective supplies the selected `EntityId`; this objective begins after resolution. |
| [CLI ADR 0001](../../../adr/cli/0001-use-mcp-tools-for-development_H.md) | MCP Tools are the initial operation surface; Resources require a distinct proven workflow. | ACP gets current context directly as visible prompt content. No duplicate selected-context MCP Resource is added now. |
| [CLI ADRs 0002](../../../adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md) and [0003](../../../adr/cli/0003-make-cli-project-services-the-development-authority_H.md) | Browser-safe library projections are separate; CLI project services own lifecycle. | CLI owns `DevelopmentSelectionContextV1`; Studio consumes it without importing process modules. |

The plan does not need a new ADR to implement the first proof. It chooses an implementation of
existing vendor-neutral AI, native-host, one-engine-API, serialization, identity, and render
boundaries.

## Objective dependencies

| Dependency | Required result | What can proceed before it | What waits |
| --- | --- | --- | --- |
| BroMetal request objective | Stable displayed-pixel selection reaches Framework inspection and Studio as an `EntityId`. | ACP SDK proof, native host, manual panel, fake selection-context fixtures. | Real selection projection wiring, automatic click dispatch, GPU-to-agent acceptance. |
| Current CLI development service | Active project identity, `DevelopmentSnapshotV2`, MCP endpoint/stdio bridge. | Contract fixtures and native fake-agent work. | Real project-scoped ACP/MCP session proof. |
| Framework semantic inspection | Bounded world, hierarchy, components, and named stores. | Context schema design. | Truthful complete/partial projection from real runtime data. |
| Studio apps objective | No required result. | Entire first fixed Terminal/Agent tab slice. | Only later migration into a contribution/app system if that objective selects one. |

The Studio ACP plan must coordinate schema timing with BroMetal request goals once those goals exist.
It must not edit that objective's plan, create a competing selection field, or claim GPU acceptance
before its proof completes.

## Selected implementation defaults

| Decision | Selected default | Alternative and revisit condition |
| --- | --- | --- |
| ACP client implementation | Official Rust SDK in Tauri. | Node sidecar only after a recorded exact SDK/toolchain/process incompatibility. |
| Protocol | Stable ACP v1. | Feature-gated v2 only in a later decision after the draft stabilizes and two-version cost is justified. |
| Agent count | One live configured process/session. | Concurrency after a real workflow needs it and background-state semantics exist. |
| Product proof | Same code against two real agents/adapters. | A single agent is insufficient evidence that ACP is the boundary. |
| Workspace | Agent tab beside Terminal. | App contribution after Studio apps ships; fifth panel/docking only with owner-approved workspace work. |
| MCP transport | Compatible loopback HTTP first; existing stdio bridge fallback. | New proxy/transport only if both fail with recorded agent evidence. |
| Context owners | Framework semantic projection plus CLI development envelope. | No Studio-local world projection. A new shared service only if typed pure projection cannot meet permissions/freshness. |
| Automatic behavior | Explicit session-scoped selection-follow, one active turn, latest pending context. | Every-click queue or preemption only after measured user need and cost controls. |
| Context target | Selected owner entity plus published resource evidence. | Direct `AssetId` after stable asset inspection and dependency contracts exist. |
| Transcript | In-memory bounded projection. | Durable storage after ownership, privacy, restore, migration, and cross-agent semantics are decided. |

## Decisions that would require new authority

Stop and seek an owner decision and, where architectural, propose an ADR before:

- making Studio install, update, verify, remove, or recommend agents from a registry;
- storing provider credentials or selling/proxying model access;
- adding project-manifest agent configuration that affects collaborators or builds;
- replacing the native ACP host with a permanent Node process boundary without a proved compatibility
  reason and recorded ownership decision;
- persisting transcripts, synchronizing them, or claiming Studio owns agent session history;
- enabling multiple concurrent/background agents or automatic unattended work;
- enabling draft/new ACP versions by default with different semantics;
- exposing general filesystem, shell, or editing powers through Studio's ACP client;
- adding a second engine/selection service or letting ACP methods mutate Framework directly;
- changing GPU/resource ownership or exposing BroMetal/WebGPU objects outside the driver;
- defining a general asset dependency model as a side effect of prompt context.

None of these choices blocks the planned first slice.

## Cost of the selected decision posture

Preserving these boundaries costs a native ACP module, a portable adapter, two strict context
projections, and layered integration tests instead of one browser-only prompt bridge. It also means
the first slice cannot claim direct stable asset selection or durable threads. That cost is explicit
and preferable to moving process authority into React, duplicating engine semantics, or leaking GPU
objects into agent context.

## Needs the owner now

Nothing. The owner selected promotion, automatic click-context handoff, and immediate planning. The
plan supplies reversible conservative defaults for agent configuration, workspace placement,
selection-follow, and context bounds. Exact two-agent commands are execution-environment fixtures,
not permanent product choices.

## Deliberately deferred

- Registry and supply-chain policy.
- Public supported-agent catalog and compatibility promises.
- Durable or shared conversation history.
- Multi-agent/background workflows.
- ACP v2 and custom protocol extensions.
- General Studio filesystem/shell capabilities.
- Contextual feedback queue, assignment, resolution, and persistence.
- General asset graph, render graph, and direct stable asset selection.
- Studio app/plugin migration and workspace customization.
- Provider analytics, usage/billing aggregation, or model-quality evaluation.

These are deferred because none is necessary to prove one user-selected ACP agent receiving the exact
current selected Framework context through Studio.
