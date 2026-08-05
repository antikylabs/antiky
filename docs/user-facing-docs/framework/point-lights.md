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
});

const harborLamp = lights.getPointLight(harborLampId);
const everyLamp = lights.listPointLights();
```

Do not treat a returned record as mutable game state. Build runtime and render projections from the
authoring record, and keep their numeric aliases inside their own lifetime.

See [Runtime Inspection](inspection.md) for the shared diagnostics and measurement source. See the
[framework system overview](../../architecture/framework/overview_A.md) for authoring, runtime,
and render ownership.
