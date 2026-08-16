# Studio ACP

<!-- Generated. Regenerate when a phase completes. -->

**Phase:** Planning
**Started:** 2026-08-16

The owner wants Studio to host an ACP conversation so clicking a rendered item can automatically give
the active coding agent its exact GPU-to-ECS context. The plan selects a native Rust/Tauri ACP v1
client, keeps Antiky MCP as the agent-to-engine API, adds one shared Framework/CLI selected-context
projection, and places the first Agent surface beside Terminal without waiting for a general Studio
app system. The owner's words and requested success state are preserved in
[`objective.md`](objective.md).

## Needs the owner

Nothing blocks `create-goals` or the first implementation proofs. The plan uses one configured local
agent in the product, tests the same boundary against two real ACP agents/adapters, and keeps provider
choice in configuration rather than making a permanent support-list decision.

| # | What | Blocks |
| --- | --- | --- |
| — | None | Nothing blocks `create-goals`. |

## Plan documents

| # | Document | What it decides |
| --- | --- | --- |
| 00 | [`Capability diagnosis`](00-CAPABILITY-DIAGNOSIS.md) | Separates current ingredients, missing ACP/context behavior, the GPU prerequisite, and completion claims. |
| 01 | [`ACP and selection vocabulary`](01-ACP-AND-SELECTION-VOCABULARY.md) | Defines agent, development, selection, context, completeness, lifecycle, and dispatch identities. |
| 02 | [`Implementation strategy`](02-IMPLEMENTATION-STRATEGY.md) | Selects the two converging vertical seams, dependency order, work-unit range, risks, and exclusions. |
| 03 | [`Native ACP host`](03-NATIVE-ACP-HOST.md) | Selects Rust SDK/process ownership, profile policy, MCP setup, permissions, Tauri DTOs, and cleanup. |
| 04 | [`Studio Agent panel`](04-STUDIO-AGENT-PANEL.md) | Selects the Terminal/Agent workspace, portable coordinator, rendered states, and accessibility behavior. |
| 05 | [`Selection context and ACP handoff`](05-SELECTION-CONTEXT-HANDOFF.md) | Selects Framework/CLI projections, complete/partial rules, follow mode, dedupe, coalescing, and prompt mapping. |
| 06 | [`Integration proof and verification`](06-INTEGRATION-PROOF-AND-VERIFICATION.md) | Defines fake and real agent fixtures, GPU-to-agent acceptance, failure/security matrices, and evidence. |
| 07 | [`Decisions and dependencies`](07-DECISIONS-AND-DEPENDENCIES.md) | Records ADR alignment, objective dependencies, reversible defaults, and later owner decisions. |

## Research

[`research/`](research/README.md) compiles the already completed ACP investigation and current-source
selection-context audit. It established that ACP should remain agent-to-UI, MCP should remain
agent-to-engine, Tauri should own the agent process, Framework/CLI should own context semantics, and
the BroMetal request objective supplies the selected stable entity prerequisite.

## Goals

The next lifecycle phase is `create-goals`, which will cut bounded implementation contracts from the
dependency order in [`02-IMPLEMENTATION-STRATEGY.md`](02-IMPLEMENTATION-STRATEGY.md).

**Open**

| Goal | Delivers | Prerequisites | Needs owner |
| --- | --- | --- | --- |
| — | No executable goals exist yet. | Run `create-goals`. | No |

**Completed**

| Goal | Summary | Outcome |
| --- | --- | --- |
| — | None | No goals have been executed for this objective. |

## What this objective will not do

- Install or update agents, browse the ACP Registry, or create a marketplace/support catalog.
- Provide Antiky model accounts, billing, provider tokens, or a Studio-owned AI service.
- Run more than one live agent/session, persist transcripts, synchronize history, or enable
  background unattended agents.
- Enable ACP v2 by default, add custom ACP methods, or give Studio general filesystem/shell powers.
- Replace Antiky MCP, duplicate CLI project services, or create another Framework selection source.
- Expose temporary GPU IDs, BroMetal/WebGPU objects, credentials, unrestricted paths, or unbounded
  world/protocol content.
- Build a general code editor, diff application system, contextual-feedback queue, asset dependency
  graph, render graph, Studio app framework, or workspace redesign.
- Treat a partial bounded hierarchy/resource view as complete or use CPU/synthetic picking as the
  final click-to-agent proof.
