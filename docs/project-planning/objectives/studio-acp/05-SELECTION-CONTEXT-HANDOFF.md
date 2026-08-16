# Selection context and ACP handoff

This document selects how a Framework-selected rendered item becomes one bounded, revisioned ACP
prompt attachment. It defines semantic ownership, projection rules, eligibility, ordering, content
mapping, and truthful failure behavior.

## Boundary and owners

```text
BroMetal driver
  temporary GPU ID -> stable EntityId
Framework inspection
  selection + world -> SelectionContextInspectionV1
CLI development projection
  observation + project/build -> DevelopmentSelectionContextV1
Studio coordinator
  eligibility + preview + dedupe + latest-pending policy
AgentHost / ACP SDK
  standard prompt content -> active agent session
Agent
  optional fresh/deeper reads -> existing Antiky MCP
```

The driver owns GPU identity resolution. Framework owns world meaning. CLI owns project/development
observation identity. Studio owns user-visible dispatch policy. ACP transports content. MCP supplies
fresh engine operations. No layer reaches backward to inspect another layer's private objects.

## Framework projection

`createSelectionContextInspection(snapshot)` is a pure bounded projection. It accepts one already
validated Framework snapshot containing the current selection and world. It returns a frozen
`SelectionContextInspectionV1` or a stable typed unavailable result; it does not read a live world,
mutate selection, or call the renderer.

### Preconditions

- Selection uses the schema delivered by the BroMetal request objective and identifies a stable
  `EntityId`.
- Selection, world, and snapshot runtime identities agree.
- The world contains the selected entity in its retained entity view.
- The selected target is not a temporary GPU alias, runtime slot, hierarchy path, or display label.

### Projection algorithm

1. Build immutable maps of retained entities and one `ChildOf` parent per child.
2. Resolve the selected target entity. A missing target produces `target-not-retained`; it never falls
   back to a matching label or store key.
3. Walk parents from target to the retained root, rejecting a repeated entity even though world
   validation should already reject cycles. Reverse the result into root-to-parent order.
4. Copy the target's stable identity, label, revision, component type/schema/summary/data, plus the
   same identity/revision/component summaries needed for each ancestor.
5. For each deterministic store order, copy entries whose explicit `entityId` equals the selected
   entity. Preserve store ID, label, kind, counts, and incomplete marker.
6. Derive completeness from source counts and explicit flags. If relationships are truncated, a
   retained apparent root does not prove that its omitted parent does not exist.
7. Canonicalize ordering and calculate a deterministic context identity from semantic source
   identities and revisions. Do not include wall-clock time.
8. Enforce context-specific collection and encoded-byte bounds below the larger world-inspection
   bounds. Truncation adds stable reasons and retained/available counts.

The first proof includes related entries from authoring, runtime, and render stores. A render store can
publish stable material, geometry, pipeline, pass, asset, or batch keys in its validated JSON. The
projection carries those values but does not search arbitrary keys for supposed dependencies.

### What “full GPU<>ECS hierarchy” means here

For a successful complete proof it means:

- the clicked displayed item resolved through the GPU path to its stable owner entity;
- every ECS `ChildOf` ancestor from world root to that entity is present;
- the selected entity's published component information is present;
- every applicable retained semantic store entry explicitly owned by that entity is present; and
- any published render/asset keys needed by the proving fixture are present with their source
  completeness state.

It does not mean live WebGPU/BroMetal objects, all entities in the world, every GPU resource, or a
global asset dependency graph. If the runtime does not publish asset dependencies or render mappings,
the context says `resource-trace-unavailable` rather than calling itself full.

## CLI development envelope

`projectDevelopmentSelectionContextV1(snapshot)` follows the existing browser-safe projection
pattern. It requires `DevelopmentSnapshotV2` with:

- current connected observation;
- accepted build and development session matching the snapshot;
- Framework selection and world from the same inspection value; and
- project identity/revision from that snapshot.

It wraps, validates, and freezes the Framework context. It includes project name and revision but
does not copy manifest path, project root, inspection credential, MCP URL, executable configuration,
or arbitrary environment data into prompt context.

The CLI projection becomes reusable by Studio, tests, and a future MCP Tool or distinct selected
Resource. This objective does not expose a duplicate MCP method merely because the type exists. CLI
ADR 0001 permits a Resource later only when selected host context is a distinct URI workflow and
target clients prove attachment support.

## Studio eligibility

On each accepted development snapshot, the coordinator derives at most one context. It is eligible
for automatic submission only when:

- the ACP host and session are `ready` or have one active turn that can retain a pending context;
- selection-follow is enabled for that exact ACP session;
- the development snapshot is current, not retained stale state;
- ACP session project identity equals development project identity;
- MCP is available for the session, so the generated instruction can truthfully offer fresh reads;
- the context resolved a stable target and passed validation;
- its identity has not been submitted in this ACP session; and
- it is not older than the current pending or submitted observation.

A clear/no-hit updates the selection display but submits no prompt. A missing target, mismatched
runtime/world, stale snapshot, incompatible schema, or retired session submits nothing and records a
visible reason. A partial but valid current context can submit with prominent partial reasons.

## Automatic dispatch state machine

```text
new eligible context
  ├── no active turn -> preview/record -> submit -> submitted set
  └── active turn    -> pending latest
                         ├── newer context -> replace pending visibly
                         └── turn ends -> revalidate current identity -> submit or retire
```

The submitted set is bounded to the in-memory ACP session. Deduplication survives repeated Studio
snapshot polls and component rerenders but not a deliberately new ACP session. A world/target revision
change produces a new context even if the stable `EntityId` is unchanged.

The coordinator does not preempt an active agent turn on every click. The user can cancel explicitly.
When the turn ends, only the latest still-current pending selection is sent. This is the smallest
policy that honors automatic context submission without creating an unbounded click queue.

## Prompt content

Each generated turn is visible and contains:

1. A Studio-authored text block that identifies the action as automatic selection follow and tells
   the agent to treat the snapshot as bounded initial context and use Antiky MCP for current/deeper
   facts.
2. A human-readable target/ancestry/completeness summary.
3. Canonical JSON for `DevelopmentSelectionContextV1` as bounded text, or the equivalent standard ACP
   embedded resource content when the agent advertises it.

The semantic JSON is identical across capability projections. An embedded-resource optimization
cannot omit the baseline text meaning or create a custom ACP method. Content size is checked before
native invocation; oversized context is rejected or explicitly truncated by its owning projection,
never sliced as invalid JSON at the Tauri boundary.

## Direct asset selections

The initial GPU path returns an owner `EntityId`, so the first context target is `entity`. A clicked
mesh, sprite, voxel, or rendered asset can include its stable render/asset evidence through the
selection and semantic stores while keeping the entity as the primary target.

A later direct `AssetId` target can extend the Framework target union only after Framework publishes a
stable, validated asset inspection and dependency contract. The context envelope, ACP dispatch, and
deduplication rules can then be reused. This plan does not invent that asset system inside Studio.

## Failure matrix

| Condition | Context result | ACP action |
| --- | --- | --- |
| Current complete target and path | `complete: true` | Submit once when follow is enabled. |
| Current target with incomplete store/resource detail | `complete: false` plus reasons | Submit visibly as partial. |
| Relationship view truncated | Ancestor path retained but not claimed complete | Submit partial with relationship reason. |
| Target missing from retained world | Typed unavailable result | Do not submit. |
| Snapshot marked stale by Studio | Existing context may remain visible as stale | Do not submit or promote pending. |
| Runtime or project changes | Old context retires | Clear pending and follow state as specified. |
| Same context appears in later polls | Same identity | No new turn. |
| New context while prompting | Replace pending latest | Submit only after turn end and revalidation. |
| ACP content capability differs | Same semantic value, different standard block projection | Use baseline text or negotiated embedded form. |

## Verification

- Framework tests prove root, deep ancestry, multiple roots, target-at-root, deterministic ordering,
  component values, explicit store matching, bounds, incompleteness, missing target, and mutation
  isolation.
- CLI tests prove observation/project wrapping, path/credential omission, exact serialization, and
  local/strict-boundary equivalence.
- Studio coordinator tests prove deduplication across polls, latest-pending replacement, session and
  project fencing, clear/no-hit behavior, stale rejection, partial labels, and cancellation races.
- ACP adapter tests prove canonical semantic equivalence between text and embedded-resource paths.
- The real integration fixture proves one complete root-to-target path and applicable render/resource
  links after an actual GPU click.

## Options, cost, and exclusions

Sending the whole `DevelopmentSnapshotV2` would be easier, but it includes unrelated data, increases
cost, weakens permissions, and still does not define completeness. Letting the agent call MCP after a
bare `EntityId` is safe but misses the owner's automatic-context goal and makes the first response
depend on tool discovery. The selected bounded snapshot plus MCP refresh provides immediate exact
context and a current source for follow-up.

The cost is strict projection code and several edge-case tests across Framework, CLI, Studio, and ACP.
This work does not create a general query language, traverse opaque JSON as a graph, expose GPU
objects, include the whole world, persist selection history, implement feedback storage, or authorize
an agent action merely because context was attached.
