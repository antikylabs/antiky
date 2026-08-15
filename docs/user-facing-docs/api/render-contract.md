---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:282d16b6dee7eb62
---

# Render contract API

Describe a frame as passes, targets and pipeline keys, so a render driver can draw it without the game naming a graphics object.

Use this to hand rendering to a driver. A game that builds graphics resources itself is taking an exception, not the default path.

For the task-first workflow, read [Build a game module](../framework/game-modules.md). Import every API on this page from `@antiky/framework`.

## Example

A scene drawn into a floating-point target, reduced through a bloom step, then resolved to the canvas. `scene` and `bloom` are keys; the driver owns what they are made of.

```ts
import type { RenderFrame } from '@antiky/framework';

const frame: RenderFrame = {
  passes: [
    { target: 'scene', clear: [0, 0, 0, 1], draws: [{ pipeline: 'world' }] },
    { target: 'bloom', draws: [{ pipeline: 'extract', uniforms: { uScene: { target: 'scene' } } }] },
    { draws: [{ pipeline: 'post', uniforms: { uBloom: { target: 'bloom' }, uExposure: 1.24 } }] },
  ],
};

driver.submit(frame);
```

## Render frame contract

Name pipelines and targets by key and describe a frame as data, so a driver can be replaced without changing the framework.

### `ClearColor`

A clear colour in linear light, with alpha.

```ts
type ClearColor = readonly [
    number,
    number,
    number,
    number
];
```

### `PipelineKey`

Names one pipeline a render driver was constructed with.

```ts
type PipelineKey = string;
```

### `TargetKey`

Names one render target a driver owns, or the canvas when absent.

```ts
type TargetKey = string;
```

### `UniformValue`

A uniform a game sets for a draw: a number, a number list, or a reference to a target.

```ts
type UniformValue = number | readonly number[] | Readonly<{
    target: TargetKey;
}> | Readonly<{
    texture: TextureKey;
}>;
```

### `TextureKey`

Names one texture the driver was given to sample.

```ts
type TextureKey = string;
```

### `DrawCall`

One pipeline drawn, with the uniforms set immediately before it.

```ts
type DrawCall = Readonly<{
    pipeline: PipelineKey;
    uniforms?: Readonly<Record<string, UniformValue>>;
    instanceData?: Readonly<Record<string, Float32Array>>;
    instances?: number;
}>;
```

### `TargetRequest`

A render target a frame will use, sized as a fraction of the canvas.

```ts
type TargetRequest = Readonly<{
    key: TargetKey;
    scale: number;
    depth?: boolean;
    samples?: number;
}>;
```

### `RenderPass`

One target, what to clear it to, and the draws that write into it.

```ts
type RenderPass = Readonly<{
    target?: TargetKey;
    clear?: ClearColor;
    draws: readonly DrawCall[];
}>;
```

### `RenderFrame`

One frame, as an ordered list of passes.

```ts
type RenderFrame = Readonly<{
    passes: readonly RenderPass[];
}>;
```

### `RenderDriver`

What every render driver implements: configure targets, submit a frame, dispose.

```ts
type RenderDriver = Readonly<{
    configureTargets(requests: readonly TargetRequest[]): void;
    submit(frame: RenderFrame): void;
    dispose(): void;
}>;
```

### `isContractValue`

Whether a value carries only contract data rather than a backend handle.

```ts
function isContractValue(value: unknown): boolean;
```
