# 0014: Apply approved sandbox changes through commands

## Status

Accepted

## Context

Agents, previews, and tests need a safe place to experiment. Their experiments must not put the
primary world at risk.

Antiky must not copy live sandbox objects into the primary world. It must not replace the primary
state with sandbox state. These operations could bypass current permissions, revisions, and
authority rules.

These operations could also overwrite changes that occurred after Antiky created the sandbox.

## Decision

A sandbox will be an isolated world or session that starts at a known base revision. The sandbox can
run limited commands and simulation. It can produce a proposed set of changes and validation
results.

To apply the proposed changes, the primary session will check permissions again and run the proposed
commands. It will check the current revisions and world rules again.

Antiky will not copy these sandbox items into the primary world as true state:

- Runtime objects
- Event sequence numbers
- Storage that the sandbox can change.

## Consequences

- Users can safely compare, discard, or review agent and preview experiments.
- The apply process detects old or conflicting work. It does not silently overwrite that work.
- Each sandbox needs limits, permissions, asset-sharing rules, and cleanup rules.
- Large sandboxes can later use copy-on-write, which copies only changed data. They can also copy
  only part of a world.
- A successful sandbox supplies evidence for a change. It does not give permission to apply the
  change.

## Revision history

- `6facfccaf4614340a4181b4361f77117e59a5e76` — Prior version before the plain-language rewrite.
