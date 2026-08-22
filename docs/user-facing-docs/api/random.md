---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:641549dc472c878c
---

# Seeded randomness API

Draw reproducible pseudo-random values from an explicit seed, with forks that do not depend on draw order.

Use one seeded stream wherever a simulation needs randomness, so a run replays exactly and its state digest means something.

For the task-first workflow, read [Run a fixed-step game session](../framework/engine-sessions.md). Import every API on this page from `@antiky/framework`.

## Example

`seed` is an explicit simulation input, carried in the snapshot. Forking by label keeps two subsystems independent of each other's draw order.

```ts
import { createRandomStream } from '@antiky/framework';

const random = createRandomStream(seed);
const scatter = random.fork(1);
const damage = random.fork(2);

const offset = scatter.unit();
```

## Seeded random streams

Hash integers reproducibly and draw from a seeded stream whose forks depend on their label alone.

### `hash32`

A reproducible 32-bit hash of one or two integers, using integer operations only.

```ts
function hash32(value: number, salt = 0): number;
```

### `hashUnit`

The same hash mapped onto `[0, 1)`.

```ts
function hashUnit(value: number, salt = 0): number;
```

### `RandomStream`

A seeded sequence that replays exactly and forks into independent child streams.

```ts
type RandomStream = Readonly<{
    seed: number;
    unit(): number;
    below(bound: number): number;
    fork(label: number): RandomStream;
}>;
```

### `createRandomStream`

Create a seeded stream for one simulation or one subsystem of it.

```ts
function createRandomStream(seed: number): RandomStream;
```
