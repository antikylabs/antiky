# 0001: Use semantic entities and components

## Status

Accepted

## Context

World data must be understandable to games, Studio, agents, persistence, and tests. Simulation also
needs storage that can become data-oriented without exposing that storage as the public model. A
scene tree alone cannot represent every relationship, and a general-purpose archetype ECS would add
complexity before measurements justify it.

## Decision

We will model world concepts with stable entities, versioned component schemas, typed relationships,
systems, and queries. Components hold data and systems hold behavior. Storage is private and may
evolve from simple maps to dense or specialized stores without changing the semantic interface.

The scene hierarchy will be derived from parent-child relationships. Dense data such as voxels,
vertices, particles, and render batches will remain in specialized stores rather than becoming an
entity per element.

## Consequences

- Humans and agents share a stable vocabulary for inspection and editing.
- Runtime schemas must provide validation and reflection that TypeScript types cannot provide alone.
- Storage can be optimized from profiles without breaking authoring or protocol contracts.
- The framework must maintain explicit mappings between semantic entities and specialized data.
- Antiky will not attempt to reproduce a full general-purpose ECS before real workloads require it.

## Revision history

- `d5512a91c2c6719a7488b03feebe01bd24eaf93b` — Expanded the placeholder and corrected the ECS title and filename.
