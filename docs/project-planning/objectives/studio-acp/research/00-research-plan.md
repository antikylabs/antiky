# Studio ACP research record

**Research compiled:** 2026-08-16
**Objective:** [`../objective.md`](../objective.md)

The owner said that base research was already complete and asked to proceed to an implementation
plan. This record therefore promotes the researched Studio ACP idea and reconciles it with current
source and accepted architecture. It does not start a new research fan-out.

## Questions already answered

1. What existing protocol should connect a coding agent to a Studio conversation UI?
2. Which process owns an ACP client, subprocess lifecycle, and provider-specific authentication?
3. How do ACP and Antiky MCP divide responsibility?
4. Which ACP version and SDK should the first slice use?
5. What is the smallest useful multi-agent conformance proof?
6. What semantic information exists today for a selected Framework entity?
7. Which existing objective supplies the displayed-pixel-to-stable-entity prerequisite?
8. Where should the selected-context projection live so Studio and future agent surfaces share it?
9. Which completeness, freshness, permission, and size rules prevent misleading or unsafe context?

## Evidence used

- The promoted research note formerly stored at `docs/project-planning/ideas/studio-acp.md`, compiled
  into [`01-acp-client-and-agent-boundary.md`](01-acp-client-and-agent-boundary.md).
- Current Studio, CLI, and Framework source, compiled into
  [`02-selection-context-handoff.md`](02-selection-context-handoff.md).
- Accepted Studio, CLI, and Framework ADRs and the maintained architecture guides.
- The active BroMetal request objective, whose plan supplies the GPU-pixel-to-`EntityId` prerequisite.

## Constraints applied

- Use accepted architecture as authority. Research and plans cannot overrule ADRs.
- Do not repeat web research only to restate the existing evidence.
- Do not treat a generic `WorldInspection` store value as proof of an asset dependency graph that the
  runtime did not publish.
- Do not let ACP replace MCP or let React own native process execution.
- Do not define executable goals during this phase.

## Result

All questions needed for the first implementation plan are answered. The unresolved items are
implementation evidence rather than owner decisions: exact official Rust SDK integration against the
pinned toolchain, ACP behavior across two real agents, and the exact semantic resource trace a proving
fixture can publish. The plan makes each an early falsifiable proof.
