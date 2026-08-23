# Studio ACP research

**Research compiled:** 2026-08-16

This research promotes the existing ACP investigation and reconciles it with the owner's new
selection-context requirement. The owner explicitly said that base research was complete, so this
folder records provenance and current-source verification rather than a new fan-out.

## Headline conclusions

1. **Use ACP for agent-to-UI and keep MCP for agent-to-engine.** Studio becomes the ACP client; the
   coding agent receives the current Antiky MCP server during ACP session setup.
2. **Own the ACP process in Rust/Tauri.** The official Rust SDK is the preferred dependency. React
   receives bounded, validated state through a narrow host adapter and never owns executable paths,
   raw JSON-RPC, stderr, or credentials.
3. **Prove stable v1 against two agents.** One configured agent is the product slice, while two real
   ACP implementations are the conformance proof. Draft v2, registry installation, and concurrent
   sessions remain later work.
4. **Reuse the existing semantic inspection path.** Framework already publishes bounded entities,
   `ChildOf` relationships, components, and named authoring/runtime/render stores. CLI already carries
   one validated observation into Studio.
5. **Add one shared selected-context projection.** Framework should build the semantic target,
   ancestor, component, and related-store view; CLI should add project/development observation
   identity. Studio should only present and dispatch that versioned value.
6. **Never call a partial view complete.** Context includes explicit freshness, count, truncation,
   and unsupported-detail reasons. GPU IDs, live GPU objects, secrets, and arbitrary paths stay out.
7. **The GPU selection objective is a prerequisite, not duplicated work.** BroMetal request owns
   displayed pixel -> stable `EntityId` -> Framework inspection -> Studio selection. Studio ACP owns
   the context capture and ACP submission after that boundary.

## Documents

| Document | Purpose |
| --- | --- |
| [`00-research-plan.md`](00-research-plan.md) | Records the promoted research questions, evidence, and constraints. |
| [`01-acp-client-and-agent-boundary.md`](01-acp-client-and-agent-boundary.md) | Compiles protocol, SDK, native-host, trust, and proof conclusions. |
| [`02-selection-context-handoff.md`](02-selection-context-handoff.md) | Establishes the current inspection path and selects the shared context boundary. |

## Research status

Research is complete for planning. Remaining unknowns are deliberately turned into early
implementation proofs: Rust SDK compatibility, two-agent behavior, packaged MCP handoff, and the
semantic render/asset trace published by the proving fixture.

No owner decision blocks the implementation plan. The plan selects conservative defaults that can be
revised if an early proof falsifies an assumption.
