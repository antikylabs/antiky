# Framework selection and Studio observation

This document selects the one-way semantic path from a stable driver result to Studio. It adds a
small runtime-scoped Framework selection record to the existing inspection snapshot and derives the
Studio view from that record. It does not create a second transport or bidirectional editor command.

## Selected path

```text
BroMetal driver resolves GPU ID to EntityId | null
  -> Framework accepts or rejects the ordered result
  -> optional validated selection in InspectionSnapshot
  -> existing game-host publication
  -> existing CLI runtime/development snapshot
  -> existing Studio coordinator poll
  -> hierarchy highlight and selected-entity details
```

This path applies ADR 0022: temporary GPU data stays in the driver, Framework receives stable
identity, and Studio examines that same entity
(`docs/adr/framework/0022-use-gpu-ids-to-select-framework-entities_H.md:25-41`).

## Alternatives considered

### Selection-specific HTTP endpoint or event stream

This duplicates authentication, session fencing, validation, client code, and freshness behavior that
the development snapshot already supplies. A transient event could also be missed by Studio polling.
Reject it.

### `postMessage` from the game iframe

This bypasses the shared CLI project service, gives detached Studio consumers a different path, and
tempts Studio to trust canvas-local data instead of Framework inspection. Reject it.

### Studio-local selected ID

This can highlight a row, but it cannot prove that Framework accepted the GPU result. It also creates
two authorities when the runtime reloads or a readback finishes out of order. Reject it.

### Selection hidden in `WorldInspection.stores`

This avoids a top-level field but disguises temporary selection as game data. More importantly,
selection can remain meaningful when a bounded world projection omits the entity. Reject it.

### Optional selection in the existing inspection snapshot

Select this option. It is the smallest semantic addition and persists long enough that the current
250-millisecond runtime publication and one-second Studio poll cannot lose it.

The cost is a lockstep schema addition across producer, validator, CLI, and Studio. It is still lower
than a second service, and this objective makes no mixed-version package guarantee.

## Framework selection state

Use a narrow in-memory controller, not a shared mutating selection service. Its responsibilities are:

- issue a monotonic request sequence for each click intent;
- record active runtime ID, world ID, and driver/device generation;
- accept a resolved `EntityId | null` only for the latest request and active identities;
- ask a caller-supplied membership check whether a non-null entity still exists;
- increment the selection revision for each accepted hit or clear;
- retain current stable selection for inspection reads;
- clear selection when the selected entity is removed or its runtime/world retires; and
- invalidate pending work on disposal.

It does not own GPU maps, camera state, the world, entity membership, commands, or events.

### Acceptance rules

1. A valid latest non-null result selects that stable entity.
2. A valid latest no-hit selects `null` and increments revision.
3. An older request result has no effect, even if it completes later.
4. A result for an old runtime, world, or driver generation has no effect.
5. A result after disposal has no effect.
6. A result for an entity that no longer exists has no effect and can emit a bounded diagnostic.
7. An unmapped nonzero GPU value is a driver error, not a no-hit.
8. A readback/decode/device failure preserves the previous selection and emits a render diagnostic.
9. A normal world revision advance does not by itself reject a result. A running simulation can
   advance many revisions while asynchronous readback is valid.

The last rule prevents selection starvation. The retained request-frame map, active identities,
request order, generation, disposal, and entity existence are the real correctness fences.

## Selection inspection record

Add a validator and immutable type in a focused module such as
`packages/framework/src/inspection/selection.ts`:

```ts
type EntitySelectionInspectionV1 = Readonly<{
  schemaVersion: 1;
  owner: 'framework';
  runtimeInstanceId: string;
  worldId: WorldId;
  revision: number;
  entityId: EntityId | null;
}>;
```

Then add `selection?: EntitySelectionInspectionV1` to `InspectionSnapshot` and to the optional details
that `createGameInspectionSnapshot` composes. Required semantics are:

- field absent: runtime does not support Framework entity selection;
- present with `entityId: null`: supported but empty;
- present with an ID: stable current selection;
- record runtime identity matches `InspectionSnapshot.runtime.instanceId`;
- record world identity matches the available session/world/event data;
- strict unknown-field, ID, owner, revision, and schema validation;
- frozen output and bounded values; and
- no GPU ID, pixel, target, format, BroMetal object, or backend resource.

`InspectionSnapshot` currently uses exact allowed keys and schema version 1
(`packages/framework/src/inspection/snapshot.ts:162-175,297-307`). Adding selection is an explicit
lockstep extension to that local schema. Update Framework, game-host ingress, CLI client parsing,
Studio types, and serialized contract fixtures together. Snapshots without selection must remain
valid for renderer-only and older game modules in the same source tree.

Do not create a root-schema migration or new development-protocol endpoint unless implementation
discovers a real mixed-version detached client requirement. If that requirement appears, stop and
version the boundary deliberately; do not weaken strict parsing.

## Existing transport

No new `GameInspectionPort` operation is necessary. The game already supplies its complete semantic
snapshot through `GameInspectionPort.snapshot()` (`packages/framework/src/game/host.ts:58-74`). The
development host already:

- reads that snapshot (`packages/cli/src/host/game-server.ts:144-150`);
- publishes it every 250 milliseconds (`packages/cli/src/host/game-server.ts:152-177,343-371`);
- validates browser envelopes before accepting them;
- rejects older publication sequences and retired runtime instances; and
- exposes the accepted inspection through `DevelopmentSnapshotV2`
  (`packages/cli/src/development/types.ts:46-99`).

The browser-safe CLI client reparses the nested Framework snapshot with
`createInspectionSnapshot` (`packages/cli/src/development/browser-client.ts:221-249`). Studio polls and
atomically replaces the whole development snapshot (`packages/studio/app/src/development/coordinator.ts:170-207`).

Implementation work at this cut point is validation and pass-through testing, not a new route.

## Studio behavior

Studio derives the authoritative selection from `snapshot.inspection.selection`. Do not copy it into
`StudioDevelopmentState`.

Update `InspectionPanel` so that it:

- finds the selected entity by exact stable ID;
- reveals its ancestor path and highlights its hierarchy row;
- uses accessible selected state such as `aria-current` plus a visible style;
- shows a dedicated selected-entity area with label, stable ID, entity revision, and component
  summaries/details;
- switches to or reveals the hierarchy on a new selection revision, but does not repeat that effect
  on every identical poll;
- removes the highlight for a supported empty selection;
- distinguishes unsupported selection from supported empty selection;
- states “selected entity is outside the retained view” when an incomplete bounded world omits it;
- shows an explicit inconsistent/missing state when a complete world omits it; and
- retains the last observed highlight under the existing stale banner when the connection is stale.

The current panel already builds a stable-ID hierarchy and renders components
(`packages/studio/app/src/components/InspectionPanel.tsx:26-103`). It has no selection input or state
(`packages/studio/app/src/components/InspectionPanel.tsx:137-175`). `LiveGameFrame` needs no bridge or
DOM change; the click occurs in the
development runtime and the result returns through inspection
(`packages/studio/app/src/components/LiveGameFrame.tsx:1-20`).

The first proof accepts the current polling latency. It measures observed latency but does not add a
push transport without evidence.

## Required tests

### Framework

- valid selected and cleared records are frozen;
- invalid schema, owner, UUID, revision, unknown fields, and runtime/world mismatches fail;
- a snapshot without selection remains valid;
- local and JSON-round-tripped records are equivalent;
- latest request wins under reversed completion order;
- latest no-hit clears and a stale no-hit does not;
- runtime/world replacement, entity removal, driver generation change, and disposal fence results;
- ordinary world revision progress does not starve a valid result; and
- `createGameInspectionSnapshot` carries selection only when supplied.

### CLI and host

- a browser-published stable ID crosses snapshot ingress, runtime connection, V2 development
  snapshot, serialization, and browser-client parsing unchanged;
- malformed selection is rejected at browser ingress;
- an older publication cannot replace a newer selection;
- runtime replacement cannot inherit prior selection;
- disconnect retains the last observation only with existing unavailable/stale freshness; and
- serialized data contains no GPU ID or renderer object.

### Studio

- selected row and exact entity details;
- clear versus unsupported selection;
- incomplete-view missing versus complete-view inconsistent;
- stale retained display;
- runtime replacement clears old selected UI atomically; and
- repeated polls with one selection revision do not repeat focus/view effects.

## Explicitly not covered

This path does not add hierarchy-to-canvas selection, Studio commands, canvas focus/outline effects,
multi-select, persistent editor selection, selection history, gameplay targeting, MCP tools, feedback
comments, or a push channel. Future feedback can refer to selection, but implementing the feedback
queue is not part of this objective.
