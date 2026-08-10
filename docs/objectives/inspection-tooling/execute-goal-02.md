# Execute goal 02: semantic world discovery

## Prerequisite

Complete [execute goal 01](execute-goal.md) first. Reuse its versioned observation reference and
freshness semantics; do not create a competing context or revision envelope.

## `/goal` objective

Implement one read-only Antiky semantic-world discovery slice for the existing Transform and Point
Light authoring data.

Add a small Framework-owned component schema registry and revision-fenced world query service, then
project that same service through the CLI development client and a capability-grouped MCP read
surface. An agent must be able to discover what Transform and Point Light mean, query exact entities
or bounded sets by stable identity and component type, request selected fields, page honestly, and
know which authoring revision it read—without parsing the whole `WorldInspection`, reading game
source, or receiving live engine objects.

This is the first generic semantic **read** slice. It must prove the reusable seam using the current
point-light authoring service without introducing a general ECS or any generic mutation.

## Required outcome

When the work is complete, an agent must be able to:

1. discover the registered `antiky.transform` and `antiky.point-light` component schemas, including
   stable type ID, schema version, state class, field paths/types, units or coordinate semantics,
   bounds, visibility, and whether a field is authorable;
2. read a world head that distinguishes world identity, schema-set revision, durable authoring
   revision, observation identity, and available entity count;
3. query one entity by stable `EntityId` or a bounded set by declared component-type filters;
4. select only declared component fields and receive strict immutable values with stable ordering;
5. continue a bounded query through an opaque cursor without mistaking a page for the whole world;
6. receive a stable stale-cursor, unknown-schema, unavailable-projection, invalid-filter, or
   budget-exceeded result instead of partial ambiguity; and
7. verify that the dedicated point-light reads and the existing whole-world inspection describe the
   same authoring records and revisions as the new generic read service.

## In scope

- Add the smallest Framework-owned identity and descriptor contracts needed for component schemas,
  schema-set revision, world head, semantic targets, query inputs, and query pages.
- Register exactly two initial component definitions:
  `antiky.transform` version 1 and `antiky.point-light` version 1. Reuse their existing parsers,
  constants, immutable records, and limits rather than duplicating validation rules.
- Describe semantic fields only. Do not expose TypeScript reflection, private class structure,
  storage layout, callbacks, mutable references, BroMetal/WebGPU handles, or arbitrary JSON paths.
- Build the read service from one immutable point-light authoring snapshot. Its world head and every
  page must represent one committed authoring revision and carry the prerequisite observation
  reference where the request crosses the development boundary.
- Keep the initial query grammar intentionally small: explicit world ID, optional explicit entity
  IDs, `all`/`any` component-type filters, declared field selection, deterministic entity-ID order,
  bounded page size, and opaque continuation cursor. Support authoring projection only.
- Bind each cursor to the world, schema-set revision, authoring revision, normalized query, and
  expiry. Reject rather than continue when any binding is stale or incompatible.
- Return `availableCount` when it can be known safely, retained count, next cursor, and an explicit
  completeness/incomplete reason on every page. Enforce row, byte, query-cost, and cursor-retention
  limits below the current transport ceiling.
- Define a small versioned `TargetRef` for world, entity, component, and declared component-field
  identities. Query results may return these references, but this goal does not create selection or
  editing state.
- Add no more than two capability-grouped MCP reads: one for world/schema capabilities and one for
  semantic world queries. The direct Framework and development-client services are authoritative;
  MCP is an adapter.
- Preserve `get_world_inspection`, `list_point_lights`, and `get_point_light` for compatibility.
  Refactor their point-light authoring projection to share the new read source where practical so
  divergent hand-maintained copies cannot emerge.
- Update relevant Framework/CLI/MCP user documentation and mark only the implemented Transform and
  Point Light authoring-query capability as current.

## Required tests and evidence

Add or update tests at existing ownership boundaries. At minimum, prove:

- schema descriptors and target references are strictly parsed, deeply immutable, bounded,
  deterministically ordered, and reject duplicate types/fields, unknown keys, invalid versions,
  invalid units/bounds, and unsafe field paths;
- schema metadata agrees with the existing Transform and Point Light parsers and range constants;
- exact-ID, `all`, `any`, selected-field, empty-result, multi-page, final-page, and maximum-page
  queries return correct stable results;
- synthetic worlds larger than one page—and large enough that a whole legal inspection would exceed
  transport limits—remain queryable through bounded responses;
- cursors cannot be forged, reused with another world/query/schema set, continued after authoring
  mutation or expiry, or used to request undeclared fields;
- unavailable runtime/render projections, unknown component types, excessive filters, excessive
  fields, excessive page sizes, malformed cursors, and mismatched world/observation identities fail
  with stable structured results;
- point-light set/correct operations advance the appropriate authoring head and make an old cursor
  stale without corrupting or partially returning the next page;
- the new generic entity result, dedicated point-light result, and legacy whole-world point-light
  projection agree for identity, Transform, Point Light values, and revisions;
- Framework import-boundary tests still exclude CLI, MCP, Studio, DOM, Node, and BroMetal; and
- the direct service, development client, HTTP/stdio MCP adapters, and Studio-facing types agree on
  the shared result semantics where they currently share the client.

Run the affected Framework, CLI, Studio type/build, and documentation checks. In the final handoff,
include sanitized examples of schema discovery, an exact entity query, a multi-page query, and one
stale-cursor result. No visual capture is required for this read-only goal.

## Explicit non-goals

- Do not implement a general ECS, replace all game-owned simulation storage, or migrate Combat
  Arena, Traversal Study, Town, or other demos to a new world model.
- Do not add component/entity mutation, command batches, previews, change sets, correction, undo,
  leases, sandboxes, persistence, snapshots, diffs, subscriptions, or replay.
- Do not add hierarchy/relationship traversal, spatial queries, text search, arbitrary predicates,
  selection, canvas picking, gizmos, an editor camera, or a generated Studio inspector.
- Do not add more component schemas beyond Transform and Point Light, even if another demo has a
  convenient JSON component.
- Do not add asset, scene, prefab, terrain, navigation, physics, AI, animation, audio, UI,
  render-graph, shader, material, GPU-profile, or release tooling.
- Do not redesign Studio, create or polish a game, change website marketing, or capture desktop,
  terminal, window, microphone, or unrelated-application content.
- Do not add Unity, Unreal, Godot, or other external-engine support.
- Do not preserve or redesign the seed skills; they remain non-authoritative scaffolding.

## Engineering constraints

- Preserve Framework's dependency and import boundaries. Framework owns semantic contracts and the
  read service; CLI owns development transport; MCP and Studio remain adapters.
- Prefer simple maps and immutable snapshots for this first slice. Do not choose a permanent storage
  engine or optimize without a measured bottleneck.
- A schema registry describes semantic meaning and validation; it must not automatically authorize
  mutation or become a second copy of domain rules.
- Keep labels and summaries discoverable but never use them as mutation or cursor identity.
- Use stable identities, explicit completeness, strict schemas, bounded work, safe errors, and the
  observation contract from goal 01 at every external boundary.
- Add a failing regression test before fixing any reproduced current bug. Keep incremental changes
  working, make short focused commits without coauthor tags, and preserve unrelated worktree changes.

## Completion definition

The goal is complete only when the Transform/Point Light schema and bounded authoring-query path are
implemented through Framework, the shared development client, and MCP; legacy reads agree with that
path; and all required successful, limit, stale, malformed, and compatibility tests pass.

Do not broaden the goal to make another game queryable. If the point-light authoring service cannot
provide one coherent revision-fenced read without a general storage rewrite, stop with the failing
fixture and a narrowly reasoned follow-up proposal instead of building the rewrite inside this goal.
