# 0003: Attach queued feedback to specific targets

## Status

Accepted

## Context

General feedback such as "the grass is not green enough" forces a reviewer to guess which resource,
entity, or property the author meant. Studio already has structured selection and inspection, and
both humans and agents need a common way to submit and review feedback about that exact context.

## Decision

We will make comments a first-class Studio record attached to a stable target reference. A comment
will retain enough world, hierarchy, component, asset, property, and revision context to identify
what the author was inspecting when the comment was made.

Submitting a comment will place it in a review queue for authorized humans or agents. Comment
creation, listing, inspection, response, assignment, and resolution will use the shared Studio
command and query surface and will be available through the standard MCP adapter. A comment records
feedback; it does not mutate its target directly.

## Consequences

- Reviewers receive precise, inspectable context instead of reconstructing intent from prose.
- Humans, agents, and Studio panels operate on the same queue and lifecycle.
- Comments need stable identity, authorship, status, timestamps, permissions, and an audit trail.
- Targets may change or disappear, so the stored context must remain useful without pretending it is
  current state.
- Queue limits, sensitive context, notification policy, and retention require explicit handling.
