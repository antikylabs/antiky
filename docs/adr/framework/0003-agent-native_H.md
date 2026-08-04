# 0003: Use one engine API for humans and agents

## Status

Accepted

## Context

If an agent can only edit files, use UI controls, and inspect screenshots, it cannot reliably
understand a game while it runs.

Studio must not use a separate private engine API. A private API would create two sets of behavior
to maintain and test.

## Decision

Studio, agents, tests, and other clients will use the same engine services. These services include:

- Commands
- Queries
- Events
- Diagnostics
- Image and video capture.

The Model Context Protocol (MCP) adapter will translate requests for these services. It will not
contain engine rules. It will not control the Studio UI.

Permissions will limit the changes that an agent can make. An agent will usually make changes in a
sandbox world first. A separate command can then apply approved changes to the primary world.

Screenshots can add visual information. They will not replace structured world data.

## Consequences

- A feature is not complete until clients can inspect and use it through the shared engine API.
- UI and agent behavior can use tests for the same contracts.
- Engine APIs must supply stable IDs, inspection, diagnostics, and structured errors.
- Agent features must define permissions, data-size limits, and sandbox rules.
- Some visual work will still need images or video.
- Normal engine control will not depend on UI automation.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Formalized the shared human and agent engine surface.
- `cb8ecc4b54e5607130c94fc64d568b58c9937e96` — Prior version before the plain-language rewrite.
