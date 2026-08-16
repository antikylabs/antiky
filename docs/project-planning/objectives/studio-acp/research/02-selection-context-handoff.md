# Selection context handoff research

This document establishes the existing Antiky path from runtime inspection to Studio and the exact
gap between a selected entity and an ACP prompt.

## Existing semantic path

`WorldInspection` already provides stable entity IDs, labels, revisions, component summaries and
values, `ChildOf` relationships, and bounded authoring/runtime/render store entries
(`packages/framework/src/inspection/world.ts:14-117`). It records available and retained counts plus
`incomplete` markers, so a consumer can distinguish a complete parent path from a truncated view.

`InspectionSnapshot` can carry world inspection beside runtime identity, diagnostics, measurements,
session state, point lights, and events (`packages/framework/src/inspection/snapshot.ts:62-119`).
`DevelopmentSnapshotV2` already wraps that inspection with the project revision, development session,
accepted build, connection state, and an observation reference
(`packages/cli/src/development/types.ts:46-99`). CLI projections validate world inspection before
returning it (`packages/cli/src/development/inspection.ts:16-83`).

Studio already consumes this path. Its inspection panel constructs parent and child maps from
`ChildOf`, identifies roots, and renders entity components and named semantic stores
(`packages/studio/app/src/components/InspectionPanel.tsx:26-135`). It warns when the world or a store
is incomplete (`packages/studio/app/src/components/InspectionPanel.tsx:84-121`).

## Missing capability

The current `InspectionSnapshot` has no selection section
(`packages/framework/src/inspection/snapshot.ts:62-119`), and Studio's hierarchy has no selected
state (`packages/studio/app/src/components/InspectionPanel.tsx:26-103`). The BroMetal request plan
owns that prerequisite: a displayed pixel resolves through the driver to a stable `EntityId`, then
Framework inspection carries it to Studio.

Even after that work lands, no API currently turns the selected ID and one observed snapshot into a
single, bounded context record. React could walk the hierarchy and copy matching store entries, but
that would make the panel the semantic owner and invite future feedback and MCP surfaces to implement
different rules.

The maintained Studio architecture requires one selection service and says a selected target can
include an entity or asset, owner entity, specialized pick data, material, pipeline, and render pass
(`docs/architecture/studio/overview_A.md:247-263`). Contextual feedback defines complete parent
hierarchy as every parent from world root to target—not the whole world—and requires explicit size,
permission, and incompleteness behavior
(`docs/architecture/studio/contextual-feedback_A.md:74-116`).

## Selected boundary

Framework should own a pure, validated `SelectionContextInspectionV1` projection from one immutable
inspection snapshot. It resolves the selected stable entity, complete retained ancestor path,
component summaries, and matching named semantic store entries. It reports completeness and reasons;
it never infers a complete asset or render dependency graph from opaque data.

CLI should wrap that Framework value in a browser-safe `DevelopmentSelectionContextV1` containing
the development session, project/build revision, and observation identity. This is the exact value
Studio attaches to ACP. The split keeps world meaning in Framework, process/session meaning in CLI,
and presentation/dispatch policy in Studio.

The first target is the entity selected by the BroMetal objective. Applicable render or asset
records are included only when the runtime publishes them as semantic inspection. Later direct asset,
component, property, voxel, render-item, or diagnostic targets can extend the target union when their
stable inspection contracts exist. GPU IDs and BroMetal objects never enter the context.

## MCP handoff

The development host already exposes MCP at the stable loopback `/mcp` route without the REST
credential (`packages/cli/src/host/inspection/server.ts:346-357`). The running development session
also exposes its `mcpUrl` (`packages/cli/src/host/session/index.ts:91-100,297-301,717-731`), while the
current browser connection carries only inspection URL, development session ID, and REST credential
(`packages/cli/src/development/browser-client.ts:76-80`). Studio can derive the current MCP URL from
the validated loopback origin for ACP agents that support the HTTP transport.

For agents that require stdio MCP, `antiky mcp --project <manifest>` connects to the same development
session and bridges stdin/stdout (`packages/cli/src/cli.ts:378-386`). Implementation still must prove
that packaged Studio can resolve the CLI entry point without a shell.

## Context dispatch conclusions

- A context is captured from one current `DevelopmentSnapshotV2`; data from different polls must not
  be merged.
- The context key includes the ACP session plus development, runtime, world, selection, and observation
  identity. Repeated polling cannot create duplicate turns.
- A stale snapshot, missing target, or incompatible selection does not auto-submit.
- A bounded partial snapshot may be submitted only with explicit `complete: false` reasons visible to
  both the user and agent.
- Rapid selections coalesce to the latest not-yet-submitted context while a turn is active.
- Context enters ACP as visible prompt content using negotiated standard content blocks. It is not a
  hidden custom method. The agent can use Antiky MCP to refresh or deepen inspection.

## Remaining evidence gaps

- The BroMetal request objective has a plan but has not yet delivered selection into the snapshot.
- Current generic stores do not establish the full future asset dependency and render graph described
  by architecture. The first proof must publish explicit semantic links or mark them unavailable.
- No test yet proves complete ancestry, truncation, deletion, runtime reload, deduplication, or rapid
  selection coalescing through ACP.
