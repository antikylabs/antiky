---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:641549dc472c878c
---

# BroMetal render driver API

Draw render contract frames with BroMetal, and own the programs, targets and their disposal.

Use this entry from a game host that renders with BroMetal. It is the only framework module that uses BroMetal, and it is reached by its own entry so a headless consumer never loads one.

For the task-first workflow, read [Build a game module](../framework/game-modules.md). Import every API on this page from `@antiky/framework/render-driver`.

## Example

Pipelines are supplied once, keyed. After that the game describes frames as data and never names a graphics object.

```ts
import { createBroMetalRenderDriver } from '@antiky/framework/render-driver';

const driver = createBroMetalRenderDriver({
  renderer,
  pipelines: {
    world: { shader: worldShader, setup: (program) => program.attributes.aPosition.set(positions) },
    post: { shader: postShader, options: { blend: 'alpha' } },
  },
});

driver.configureTargets([{ key: 'scene', scale: 1, depth: true, samples: 4 }]);
```

## BroMetal render driver

Own every BroMetal program and render target, and draw a contract frame pass by pass.

### `PipelineProgram`

The binding records a pipeline setup callback is handed.

```ts
type PipelineProgram = Readonly<{
    attributes: Record<string, {
        set(value: unknown): void;
    } | undefined>;
    instanceAttributes: Record<string, {
        set(value: unknown): void;
    } | undefined>;
    uniforms: Record<string, {
        set(value: unknown): void;
    } | undefined>;
    setIndices(indices: unknown): void;
}>;
```

### `PipelineDefinition`

One pipeline the BroMetal driver can draw, supplied when it is constructed.

```ts
type PipelineDefinition = Readonly<{
    shader: unknown;
    options?: Readonly<{
        blend?: 'none' | 'alpha' | 'additive';
    }>;
    setup?(program: PipelineProgram): void;
}>;
```

### `BroMetalRenderDriverOptions`

The renderer and pipelines a BroMetal render driver is built from.

```ts
type BroMetalRenderDriverOptions = Readonly<{
    renderer: Renderer;
    pipelines: Readonly<Record<string, PipelineDefinition>>;
    textures?: Readonly<Record<string, TextureSource>>;
    createProgram?: typeof createProgram;
    createRenderTarget?: typeof createRenderTarget;
    createTexture?: typeof createTexture;
    loadTexture?: typeof loadTexture;
    loadTextureArray?: typeof loadTextureArray;
}>;
```

### `TextureSource`

Where a texture comes from: a URL the driver fetches, a list of URLs it fetches as the layers of one array texture, or an already-decoded source.

```ts
type TextureSource = Readonly<{
    url?: string;
    urls?: readonly string[];
    source?: TexImageSource;
    options?: TextureOptions;
}>;
```

### `BroMetalRenderDriver`

A render driver that also accepts pipelines registered after it is built.

```ts
type BroMetalRenderDriver = RenderDriver & Readonly<{
    registerPipeline(key: string, definition: PipelineDefinition): void;
    registerTexture(key: string, source: TextureSource): void;
    loadTextures(): Promise<void>;
}>;
```

### `createBroMetalRenderDriver`

Create the render driver that owns Antiky BroMetal resources and draws contract frames.

```ts
function createBroMetalRenderDriver(options: BroMetalRenderDriverOptions): BroMetalRenderDriver;
```
