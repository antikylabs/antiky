# 0005: Build a reusable Antiky Ability System

## Status

Accepted

## Context

Antiky games will repeatedly need active abilities, passive abilities, attributes, costs, cooldowns,
effects, and related rules. Rebuilding those foundations per game would duplicate difficult behavior
and make tools and agents learn a new model each time.

## Decision

We will build the Antiky Ability System (AAS) as a programmable framework capability shared by our
games. It will provide reusable ability and attribute primitives while leaving game-specific content
and rules in the game that owns them.

We will extract AAS incrementally from real gameplay slices rather than attempt feature parity with
another engine's complete ability system.

## Consequences

- Games gain a common vocabulary that Studio and agents can inspect and edit.
- The framework owns reusable execution and state semantics; games own their abilities and balance.
- AAS must integrate with commands, durable outcomes, deterministic simulation, and authority rules.
- The initial system will be intentionally smaller than Unreal Engine's Gameplay Ability System.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Formalized the initial Antiky Ability System boundary.
