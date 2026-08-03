# Architecture Guides

**In Progress**

These guides explain how Antiky's accepted architectural decisions fit together. They describe the
target system and the boundaries that incremental implementation must preserve. They do not claim
that every described capability exists today.

Architecture guides are fully agent-authored and use the `_A` ownership suffix. Humans review them,
and human-owned [Architecture Decision Records](../adr/README.md) remain the authority for accepted
decisions. This README stays unsuffixed so GitHub recognizes it as the directory index.

## Reading order

1. [Framework system overview](framework/overview_A.md) — the complete runtime in one pass.
2. [World and session model](framework/world-and-session-model_A.md) — identity, entities, worlds, projections,
   clocks, and sandboxes.
3. [Commands, events, and persistence](framework/commands-events-and-persistence_A.md) — mutation, selective
   event sourcing, undo, snapshots, and projection safety.
4. [Protocols and serialization](framework/protocols-and-serialization_A.md) — where encoding occurs and how
   contracts cross boundaries.
5. [Rendering and assets](framework/rendering-and-assets_A.md) — render extraction, BroMetal, assets, hot reload,
   and inspection.
6. [Authoritative online runtime](framework/authoritative-online-runtime_A.md) — server authority,
   replication, persistence, prediction, and MMO scaling.
7. [Studio and agent workflows](studio/overview_A.md) — the portable editor, MCP, modes,
   selection, feedback, and agent safety.
8. [Contextual feedback](studio/contextual-feedback_A.md) — comments bound to selected targets and
   queued for human or agent review.

## Document authority

When sources disagree, use this order:

1. [Vision and direction](../VISION_DIRECTION_H.md) defines product intent.
2. Accepted [ADRs](../adr/README.md) define architectural choices.
3. These guides explain how those choices compose.
4. Source code and tests show what is implemented now.

Open questions in a guide are not accepted decisions. Resolve a significant question through an AIP
or Core Contributor decision, then add or supersede the relevant ADR before rewriting the guide as
settled architecture.

## Shared constraints

Every guide assumes these rules:

- Antiky Framework remains useful without Studio.
- BroMetal remains the rendering backend, not the game-domain authority.
- External actors mutate authoritative state through commands.
- Authoring, runtime, and render representations have distinct owners.
- Serialization occurs at real boundaries, not between ordinary in-process modules.
- Durable history contains meaningful facts, not every live update.
- Stable public identity is separate from dense runtime indexes.
- Current demos provide the migration workload; the framework grows through working vertical slices.
