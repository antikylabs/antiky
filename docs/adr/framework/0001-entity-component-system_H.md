# 0001: Represent world data with entities and components

## Status

Accepted

## Context

Games, Studio, agents, storage systems, and tests must use the same world model.

Simulation code also needs fast storage. We must be able to change this storage without changing
the public world model.

A scene tree shows parent-child relationships. It cannot show every type of relationship. An
archetype entity component system (ECS) groups entities by their component types. It would add
complexity before measurements show that we need it.

## Decision

The world model will use:

- Stable entities
- Versioned component schemas
- Typed relationships
- Systems
- Queries.

Components contain data. Systems contain behavior.

The framework will keep its storage private. It can start with simple maps. It can later use dense
or specialized storage without changing the public world model.

Parent-child relationships will define the scene hierarchy. Specialized storage will contain dense
data such as voxels, vertices, particles, and render batches. Antiky will not create an entity for
each item.

## Consequences

- Humans and agents use the same terms to inspect and change world data.
- Runtime schemas must supply validation and type information. TypeScript types cannot supply this
  information at runtime.
- Performance measurements can guide changes to private storage. These changes will not break
  authoring or protocol contracts.
- The framework must map entities to related data in specialized storage.
- Antiky will not build a general ECS until real workloads show that it is necessary.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Expanded the placeholder and corrected the ECS title and filename.
- `cb8ecc4b54e5607130c94fc64d568b58c9937e96` — Prior version before the plain-language rewrite.
