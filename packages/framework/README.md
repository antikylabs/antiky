# `@antiky/framework`

Antiky Framework provides fixed-step game sessions, stable IDs, runtime inspection, game-host
contracts, and renderer-neutral frame data. Use it when game rules and development tools need to
share explicit, validated state without depending on Studio or the Antiky CLI.

## Install

Antiky requires Node.js 22 or newer for development tooling.

```sh
npm install @antiky/framework
```

Create stable IDs for state that must survive reloads and renderer rebuilds:

```ts
import { createEntityId, createWorldId, isUuidV7 } from '@antiky/framework';

const worldId = createWorldId();
const playerId = createEntityId();

console.log(isUuidV7(worldId), isUuidV7(playerId));
```

## Public entry points

| Import | Purpose |
| --- | --- |
| `@antiky/framework` | Sessions, IDs, inspection, point lights, input, resources, and render contracts |
| `@antiky/framework/game` | Complete game-host types and inspection integration |
| `@antiky/framework/contract` | Game-host types with no runtime imports |
| `@antiky/framework/render-driver` | The BroMetal adapter for renderer-neutral frame data |

Start with the [Framework guides](https://github.com/antikylabs/antiky/tree/main/docs/user-facing-docs/framework)
for game modules, engine sessions, inspection, and point lights. Use the
[API reference](https://github.com/antikylabs/antiky/blob/main/docs/user-facing-docs/api/reference.md)
for exported types, functions, limits, and result codes.

## License

MIT
