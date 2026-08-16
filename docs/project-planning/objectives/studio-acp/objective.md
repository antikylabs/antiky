# Objective: Studio ACP

**Started:** 2026-08-16
**Status:** Defined

## What we want

> "This idea aligns with the Studio and Framework/CLI/host improvements to allow for click of an
> asset and get its full GPU<>ECS hierarchy. Once we have ACP, I can click and have that context
> pulled into the ACP chat automatically and submitted to the agent."
>
> — Owner, 2026-08-16

Studio should contain an ACP agent conversation surface that works with the user's installed coding
agent. A selected rendered item must resolve to the stable Framework target and its available ECS,
render, and asset context. Studio must be able to attach that context to the active ACP conversation
and submit it to the agent automatically.

## Why now

The ACP work and the current Studio, Framework, CLI, native-host, and GPU-selection improvements meet
at the same boundary. Planning them together now prevents the agent panel from inventing a second
selection model or a second engine API.

## What good looks like

- A user can run an already installed ACP-compatible coding agent in Studio without an Antiky AI
  subscription.
- The agent uses Antiky MCP for current engine inspection and operations.
- Clicking a rendered item yields one stable target and a bounded, revisioned context record that
  includes its complete available parent hierarchy and applicable semantic render or asset links.
- Studio visibly attaches that record to the active ACP thread and submits it automatically when the
  user has enabled the selection-follow workflow.
- The context never contains live GPU objects, secrets, or an undocumented second source of truth.

## What worries me

No additional worries were stated. The implementation plan must preserve the accepted Studio,
Framework, CLI, render-driver, and MCP ownership boundaries while connecting them.

## Constraints

- Base ACP research is already complete. Proceed directly to an implementation plan.
- The selected target and context must use the same Framework inspection path that Studio and agents
  already consume.
- ACP is the agent-to-UI protocol. Antiky MCP remains the agent-to-engine protocol.

## Explicitly not this

The owner did not request adjacent registry, marketplace, agent-installation, provider-billing, or
general IDE work. Research-based exclusions are recorded in the numbered plan.

## Open questions for research

None. Existing research is sufficient to plan the first implementation slice.
