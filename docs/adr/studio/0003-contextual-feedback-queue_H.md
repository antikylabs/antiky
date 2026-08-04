# 0003: Attach each feedback comment to its exact target

## Status

Accepted

## Context

A general comment such as "the grass is not green enough" does not identify its target. A reviewer
must guess which resource, entity, or property the author meant.

Studio already knows what the author selected and inspected. Humans and agents need one way to send
and review comments with that information.

## Decision

A Studio comment will be a stored record with a stable link to its target. The comment will keep the
context that identifies what the author inspected:

- The world
- The hierarchy location
- The component
- The asset
- The property
- The revision.

Studio will add a new comment to a review queue. Only humans and agents with permission can use the
queue.

The shared Studio API will support all comment operations:

- Create
- List
- Inspect
- Respond
- Assign
- Resolve.

The standard MCP adapter will also supply these operations. A comment records feedback. It does not
change its target directly.

## Consequences

- Reviewers get the exact context instead of trying to reconstruct the author's intent.
- Humans, agents, and Studio panels use the same queue and comment states.
- Each comment needs an ID, an author, a status, timestamps, permissions, and an audit history.
- A target can change or disappear. The stored context must stay useful, but it must not appear to
  be current state.
- The system needs clear rules for queue limits, sensitive context, notifications, and retention.

## Revision history

- `5ccd6638aa0124b286c5dc7562884f5c2d707f79` — Prior version before the plain-language rewrite.
