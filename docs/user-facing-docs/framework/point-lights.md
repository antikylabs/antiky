# Point lights

A point light shines from one position in every direction, like a lamp, torch, or bare bulb. Use it
to light a small area around an object or place, or for a brief effect such as a muzzle flash.

An Antiky point light has a position, color, radius, and power. The framework validates and stores
those values. Your renderer decides how the light affects pixels, including its falloff and shadows.

## Create a point light

Create the position and light data with `createTransform` and `createPointLight`:

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

This example describes a warm light with a radius of four world units. Both factory functions
validate their input and return immutable records.

## Choose the light's values

| Value | Format | Default | Valid range | What it changes |
| --- | --- | --- | --- | --- |
| `position` | `[x, y, z]` | `[0, 0, 0]` | Each value from -1,000,000 through 1,000,000 | Where the light starts in your world |
| `color` | Linear RGB `[r, g, b]` | `[1, 1, 1]` | Each value from 0 through 65,504 | The color and per-channel strength |
| `radius` | Number in your world units | `1` | Greater than 0 through 1,000,000 | The area your renderer should consider lit |
| `power` | Number | `1` | 0 through 4 | The base strength passed to your renderer |

Every transform and point-light record currently uses `schemaVersion: 1`. Unknown fields are
rejected.

Color values use linear RGB, not display-space sRGB or 0–255 color channels. Antiky does not assign
physical units such as lumens or candela to `power`. Keep the same mapping in every renderer
adapter for your game.

The framework record also does not choose an attenuation curve, shadow mode, or baking strategy.
Those are renderer features. The adapter uses the position, color, radius, and power to configure
the renderer your game has chosen.

Invalid input throws `PointLightValidationError`. Its stable code is
`ANTIKY_POINT_LIGHT_INVALID`, and its `path` identifies the rejected field.

## Add lights to a world

`createPointLightAuthoringService` keeps the point lights for one world and gives each light a
stable entity ID:

```ts
import {
  createPointLightAuthoringService,
  createWorldId,
  parseEntityId,
} from '@antiky/framework';

const worldId = createWorldId();
const harborLampId = parseEntityId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
);

const lights = createPointLightAuthoringService({
  worldId,
  runtimeInstanceId: 'game-runtime-001',
  pointLights: [
    {
      entityId: harborLampId,
      label: 'Harbor Lamp',
      revision: 1,
      transform,
      pointLight,
    },
  ],
  renderBindings: [
    { entityId: harborLampId, renderSlot: 0 },
  ],
});

const harborLamp = lights.getPointLight(harborLampId);
const everyLamp = lights.listPointLights();
```

The service accepts up to 256 lights. It rejects a duplicate entity ID and returns lights in stable
entity-ID order.

A render binding connects a stable entity ID to a temporary numeric slot in your renderer. Leave
the binding out when the game is running without a renderer. The light remains available to game
code and inspection.

## Keep IDs stable

World, entity, and command IDs are canonical lowercase UUIDv7 strings. Create them when you create
authored content, then save them with that content:

```ts
import {
  createCommandId,
  createEntityId,
  createWorldId,
  parseEntityId,
} from '@antiky/framework';

const newWorldId = createWorldId();
const newLampId = createEntityId();
const newCommandId = createCommandId();
const savedLampId = parseEntityId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
);
```

Use a `create*` function for a new value. Use a `parse*` function when a value enters from a
file, request, or tool. Parsing rejects malformed text, uppercase text, another UUID version, or an
invalid variant.

An ID does not encode the object's type, name, permission, or location. A rename, reload, or render
rebuild must not replace it.

## Change power while the game runs

During local development, the shortest path is the MCP-backed CLI tool:

```sh
antiky tool set_point_light_power '{"commandId":"018f0f3a-7b2c-7a1d-8e2f-123456789ac0","worldId":"018f0f3a-7b2c-7a1d-8e2f-123456789abc","entityId":"018f0f3a-7b2c-7a1d-8e2f-123456789abd","expectedRevision":1,"power":2}'
```

See the [MCP tool reference](../mcp/tools.md#set_point_light_power) for the complete input and call
order.

A game host can submit the same change directly through `submitPointLightPower`:

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
  throw new Error('Power change failed: ' + changed.code);
}
```

The host creates the trusted context. Do not copy identity, permissions, receipt time, or runtime
identity from the command. A change needs `world.light.edit` permission. Encoded commands are
limited to 4 KiB.

An accepted command increments the light's revision once and records one immutable
`antiky.authoring.point-light-power-set` fact. A request for the current value returns `NO_OP`
and records no fact.

## Correct an accepted change

A correction restores the prior value by submitting another command. It does not erase history:

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
  throw new Error('Correction failed: ' + corrected.code);
}
```

The correction creates a second fact. The first remains available through
`listPointLightPowerFacts`.

## Send changes to your renderer

`readPointLightRenderChanges` returns bound lights that have a new authored value. Apply them on
your renderer's normal next-frame path. Acknowledge the event sequence only after every update
succeeds.

In this example, `rendererLights` represents the point-light interface in your renderer adapter:

```ts
const changes = lights.readPointLightRenderChanges();

for (const light of changes.pointLights) {
  rendererLights.setBasePower(light.renderSlot, light.power);
}

lights.acknowledgePointLightRenderChanges(changes.eventSequence);
```

If the adapter fails, keep the last valid renderer values and leave the changes pending. Renderer
objects and GPU resources do not enter framework records or commands.

## Publish lights to development tools

`inspectPointLightService` creates a read-only point-light view that you can include in the
framework inspection snapshot:

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

CLI, MCP, Studio, and direct tests can now read the same world and light IDs, authored values,
runtime values, render bindings, and accepted facts. Inspection cannot change a light.

See [Runtime inspection](inspection.md) to publish and subscribe to complete snapshots.

## Handle results and history

Use a result's `code` for control flow:

- `ACCEPTED` and `NO_OP` report successful decisions.
- `INVALID_COMMAND`, `WORLD_NOT_FOUND`, and `ENTITY_NOT_FOUND` report invalid structure or
  targets.
- `MISSING_PERMISSION`, `DUPLICATE_COMMAND`, and `STALE_REVISION` report authority or
  ordering problems.
- `VALUE_OUT_OF_RANGE`, `HISTORY_CAPACITY_REACHED`, and `EVENT_SEQUENCE_ERROR` report bounded
  state or replay problems.

The service keeps at most 256 command results and 256 accepted facts. It rejects another change
before either limit is exceeded.

`rebuildPointLightState` rebuilds state from the service's initial records and accepted history.
`replayPointLightPowerFacts` rebuilds from an explicit ordered fact list and rejects a sequence
gap without changing live state.

Call `dispose` when the game process that owns the service stops. Later commands are rejected, but
the last immutable read state remains available for diagnostics.
