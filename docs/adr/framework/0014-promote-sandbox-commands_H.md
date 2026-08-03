# 0014: Promote sandbox changes through commands

## Status

Accepted

## Context

Agents, previews, and tests need to experiment without risking the primary world. Copying live
sandbox objects or replacing the primary state would bypass current permissions, revisions, and
authority and could overwrite changes made after the sandbox was created.

## Decision

We will represent a sandbox as an isolated world or session fork at a known base revision. A sandbox
may run bounded commands and simulation and produce a proposed change set with validation evidence.

Promotion will re-authorize and re-dispatch the proposed commands against the primary session. The
primary session will revalidate current revisions and invariants. Sandbox runtime objects, event
sequence numbers, and mutable stores will never be copied into the primary world as authority.

## Consequences

- Agent and preview experiments can be compared, discarded, or reviewed safely.
- Promotion detects stale or conflicting work instead of silently overwriting it.
- Sandboxes need explicit budgets, capabilities, asset-sharing rules, and lifecycle cleanup.
- Large forks may require copy-on-write or partial-world strategies later.
- A successful sandbox is evidence for a change, not permission to apply it.
