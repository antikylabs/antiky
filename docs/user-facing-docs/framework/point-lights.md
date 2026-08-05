# Point Lights

`@antiky/framework` provides stable light identity, validated component records, and one immutable
authoring view for the point lights in a world. The framework data does not depend on a renderer.
Your game adapter decides how a point-light record maps to a render slot or engine object.

## Use stable IDs

World and entity IDs are canonical lowercase UUIDv7 strings. Create an ID when you create authored
content, then save that ID with the content. A rename, reload, or runtime rebuild must not replace
it.

```ts
import {
  createWorldId,
  parseEntityId,
} from '@antiky/framework';

const newWorldId = createWorldId();
const authoredLampId = parseEntityId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
);
```

Use `createWorldId`, `createEntityId`, or `createCommandId` for new values. Use `parseWorldId`,
`parseEntityId`, or `parseCommandId` when a value enters from a file, request, or tool. Parsing
rejects another UUID version, uppercase text, an invalid variant, or malformed text.

An ID contains no object type, name, permission, or location. Do not infer those values from its
bytes. A numeric render slot or runtime index is a temporary alias, not an authored ID.

## Create component records

`createTransform` and `createPointLight` validate, clone, and freeze their results. Both records
require `schemaVersion: 1`.

```ts
import {
  createPointLight,
  createTransform,
} from '@antiky/framework';

const transform = createTransform({
  schemaVersion: 1,
  position: [-3.5, 4.25, 6.75],
});

const pointLight = createPointLight({
  schemaVersion: 1,
  color: [1, 0.52, 0.22],
  radius: 4,
  power: 1.05,
});
```

Position and radius use your world's units. Color uses non-negative linear RGB values. Power must
be finite and must be from `0` through `4`, inclusive. Radius must be greater than zero.

Omitted component fields use these defaults:

| Field | Default |
| --- | --- |
| Transform position | `[0, 0, 0]` |
| Point-light color | `[1, 1, 1]` |
| Point-light radius | `1` |
| Point-light power | `1` |

Invalid input throws `PointLightValidationError`. Its stable code is
`ANTIKY_POINT_LIGHT_INVALID`, and its `path` identifies the rejected field. Unknown fields are an
error.

## Build the authoring service

One service owns the point-light records for one world. It supports up to 256 records and rejects
duplicate entity IDs. Storage stays private. Reads return immutable records in stable entity-ID
order.

```ts
import {
  createPointLightAuthoringService,
  parseEntityId,
  parseWorldId,
} from '@antiky/framework';

const worldId = parseWorldId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
);
const harborLampId = parseEntityId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
);
const gateLampId = parseEntityId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abe',
);

const lights = createPointLightAuthoringService({
  worldId,
  pointLights: [
    {
      entityId: harborLampId,
      label: 'Harbor Lamp',
      revision: 1,
      transform: { schemaVersion: 1, position: [-3.5, 4.25, 6.75] },
      pointLight: {
        schemaVersion: 1,
        color: [1, 0.52, 0.22],
        radius: 4,
        power: 1.05,
      },
    },
    {
      entityId: gateLampId,
      label: 'Gate Lamp',
      revision: 1,
      transform: { schemaVersion: 1 },
      pointLight: { schemaVersion: 1 },
    },
  ],
  runtimeInstanceId: 'game-runtime-001',
  renderBindings: [
    { entityId: harborLampId, renderSlot: 0 },
  ],
});

const harborLamp = lights.getPointLight(harborLampId);
const everyLamp = lights.listPointLights();
```

Do not treat a returned record as mutable game state. Build runtime and render projections from the
authoring record, and keep their numeric aliases inside their own lifetime.

`runtimeInstanceId` names the current disposable runtime. A render binding maps an authored entity
ID to a temporary numeric slot. A headless point light needs no render binding and still uses the
same authoring and runtime service.

## Publish point-light inspection

Use `inspectPointLightService` to expose one immutable view through the framework inspection source.
Direct tests, the Antiky CLI typed client, Studio integrations, and MCP tools can then read the same
authoring, runtime, render, and accepted-fact data.

```ts
import {
  createInspectionSnapshot,
  inspectPointLightService,
} from '@antiky/framework';

const pointLightInspection = inspectPointLightService(lights);
const inspection = createInspectionSnapshot({
  schemaVersion: 1,
  runtime: {
    instanceId: pointLightInspection.runtime.instanceId,
    lifecycle: 'running',
  },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 1 },
    render: { owner: 'framework' },
  },
  pointLights: pointLightInspection,
});
```

The view includes a bound light's temporary render slot. A headless light remains in the authoring
and runtime projections without a render entry. Inspection is read-only; submit changes through the
command methods or the typed development client.

## Change power through a command

Call `submitPointLightPower` for an important authoring change. Do not modify a record returned by
`getPointLight`.

```ts
const trustedContext = {
  principalId: 'local-developer',
  permissions: ['world.light.edit'],
  receivedAt: new Date().toISOString(),
  runtimeInstanceId: 'game-runtime-001',
};

const changed = lights.submitPointLightPower({
  protocolVersion: 1,
  commandVersion: 1,
  type: 'antiky.authoring.set-point-light-power',
  commandId: '018f0f3a-7b2c-7a1d-8e2f-123456789ac0',
  worldId,
  entityId: harborLampId,
  expectedRevision: 1,
  data: { power: 2 },
}, trustedContext);

if (changed.code !== 'ACCEPTED') {
  throw new Error(`Power change failed: ${changed.code}`);
}
```

The host creates the trusted context. Do not copy identity, permissions, receipt time, or runtime
identity from command data. A change needs `world.light.edit`. A process or MCP boundary must reject
an encoded command larger than 4 KiB; the framework service enforces the same limit for direct
calls.

An accepted command increments the lamp revision once and records one immutable
`antiky.authoring.point-light-power-set` fact. The runtime and render projections receive that
revision once. A same-value request returns `NO_OP` and records no fact.

## Correct an accepted change

A correction does not delete history. It reads the prior value from an accepted fact and submits a
new power change.

```ts
const corrected = lights.correctPointLightPower({
  protocolVersion: 1,
  commandVersion: 1,
  commandId: '018f0f3a-7b2c-7a1d-8e2f-123456789ac1',
  correctedCommandId: changed.commandId,
  expectedRevision: 2,
}, {
  ...trustedContext,
  receivedAt: new Date().toISOString(),
});

if (corrected.code !== 'ACCEPTED') {
  throw new Error(`Correction failed: ${corrected.code}`);
}
```

The correction creates a second fact. The first fact remains available through
`listPointLightPowerFacts`.

## Apply render changes safely

`readPointLightRenderChanges` reports only bound slots that have an unacknowledged authoring
change. Apply each returned value through your renderer's normal next-frame path. Acknowledge the
matching event sequence only after the adapter succeeds.

```ts
const changes = lights.readPointLightRenderChanges();

for (const light of changes.pointLights) {
  rendererLights.setBasePower(light.renderSlot, light.power);
}

lights.acknowledgePointLightRenderChanges(changes.eventSequence);
```

If the adapter fails, keep the last valid renderer values and leave the changes pending. Renderer
objects and GPU resources do not enter the command, fact, or authoring record.

## Handle results and history

Use `code` for control flow. The stable result codes are:

- `ACCEPTED` and `NO_OP` for successful decisions.
- `INVALID_COMMAND`, `WORLD_NOT_FOUND`, and `ENTITY_NOT_FOUND` for invalid targets or structure.
- `MISSING_PERMISSION`, `DUPLICATE_COMMAND`, and `STALE_REVISION` for authority and ordering.
- `VALUE_OUT_OF_RANGE`, `HISTORY_CAPACITY_REACHED`, and `EVENT_SEQUENCE_ERROR` for bounded state
  and replay failures.

The service keeps at most 256 command results and 256 accepted facts. It rejects another change
before either limit is exceeded. `rebuildPointLightState` replays the service history from the
initial authored records. `replayPointLightPowerFacts` accepts an explicit ordered fact list and
rejects a sequence gap without changing live state.

Call `dispose` when the owning runtime stops. Later commands are rejected, while the last immutable
read state remains available for diagnostics.

See [Runtime Inspection](inspection.md) for the shared diagnostics and measurement source. See the
[framework system overview](../../architecture/framework/overview_A.md) for authoring, runtime,
and render ownership.
