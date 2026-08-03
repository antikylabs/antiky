# 0003: Give humans and agents one engine surface

## Status

Accepted

## Context

An agent that can only edit files, click UI controls, and inspect screenshots cannot reliably
understand a running game. Giving Studio privileged engine access would also create two behaviors to
maintain and test.

## Decision

We will expose editor capabilities through shared commands, queries, events, diagnostics, and visual
capture services. Studio, agents, tests, and other clients will use those same underlying services.
MCP will be a thin adapter over them and will not contain engine logic or automate Studio controls.

Agent writes will be capability-scoped and will normally target a sandbox world before promotion.
Screenshots will supplement structured state rather than replace it.

## Consequences

- A feature is incomplete until its relevant state and operations are available through the shared
  engine surface.
- UI and agent behavior can be tested against the same contracts.
- Engine APIs must provide stable identity, inspection, diagnostics, and structured errors.
- Permissions, payload budgets, and sandbox policies become part of agent-facing design.
- Visual-only workflows may still require captures, but normal control will not depend on UI
  automation.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Formalized the shared human and agent engine surface.
