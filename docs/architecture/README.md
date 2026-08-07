# Architecture Guides

**In Progress**

These guides explain how the accepted Antiky architecture decisions work together. They describe
the target system and the boundaries that new code must keep.

Some features in these guides do not exist yet. Each guide tells readers about the intended system,
not only the current code.

Agents write architecture guides, and humans review them. Guide file names use the `_A` ownership
suffix. Human-owned [Architecture Decision Records (ADRs)](../adr/README.md) contain the accepted
decisions.

This README has no ownership suffix because GitHub uses it as the directory index.

## Reading order

1. [Framework System Overview](framework/overview_A.md) gives a short view of the complete runtime.
2. [World and Session Model](framework/world-and-session-model_A.md) explains IDs, entities, worlds,
   state copies, clocks, and sandboxes.
3. [Commands, Events, and Persistence](framework/commands-events-and-persistence_A.md) explains state
   changes, stored events, undo, snapshots, and state-copy safety.
4. [Protocols and Serialization](framework/protocols-and-serialization_A.md) explains when Antiky
   encodes data and how data crosses boundaries.
5. [Rendering and Assets](framework/rendering-and-assets_A.md) explains BroMetal, render data, assets,
   live resource updates, and inspection.
6. [Authoritative Online Runtime](framework/authoritative-online-runtime_A.md) explains server
   authority, client updates, stored state, prediction, and large online games.
7. [Studio and Agent Workflows](studio/overview_A.md) explains the portable editor, MCP, modes,
   selection, feedback, and agent safety.
8. [Contextual Feedback](studio/contextual-feedback_A.md) explains comments that identify an exact
   target and enter a review queue.

## Document authority

When sources disagree, use this order:

1. [Vision and direction](../VISION_DIRECTION_H.md) defines the product goals.
2. Accepted [ADRs](../adr/README.md) define architecture decisions.
3. These guides explain how the decisions work together.
4. Source code and tests show the current implementation.

An open question in a guide is not an accepted decision. Resolve an important question through an
AIP or a Core Contributor decision. Then, add or replace the related ADR before you describe the
decision as settled architecture.

## Writing standard

All architecture guides must use
[ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/). Use the current issue of the
standard.

Follow the practical rules in the [ADR writing standard](../adr/README.md#writing-standard). Keep
necessary architecture terms, but explain an uncommon term when it first occurs.

## Shared constraints

Every guide assumes these rules:

- Antiky Framework must work without Studio.
- BroMetal controls rendering. It does not control game rules or true world state.
- An external caller must use a command to change authoritative state.
- Authoring, runtime, and render state have different owners.
- Antiky serializes data at real boundaries. It does not serialize data between normal modules in one
  process.
- Durable history stores important facts. It does not store every live update.
- Stable public IDs are different from compact runtime numbers.
- Current demos supply real migration work. The framework grows through complete working features.
