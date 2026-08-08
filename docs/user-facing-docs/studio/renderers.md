# Use BroMetal or Three.js in Studio

Studio is built for BroMetal, and works with Three.js and other rendering libraries. Use the
renderer that fits your game while Studio supplies the canvas, input, frame clock, reloads,
captures, runtime measurements, and local agent connection.

Every project produces the same browser-ready module:

```text
dist/antiky.game.js
```

Its default export receives a host-owned canvas and returns `frame` and `dispose` operations. The
development command in your `.antiky` manifest builds that file in watch mode. It must not start a
web server or bind the configured game port.

## Choose your integration

The renderer and the game-state layer are separate choices:

| Project style | Runtime dependencies | What Studio can inspect |
| --- | --- | --- |
| Antiky Framework + BroMetal | `@antiky/framework` and `brometal` | Host lifecycle and measurements plus any Framework session, world, store, event, or point-light state the game publishes |
| Pure BroMetal | `brometal` | Host lifecycle, renderer measurements, diagnostics, captures, and reloads |
| Three.js | `three` | Host lifecycle, renderer measurements, diagnostics, captures, and reloads |

Antiky Framework does not wrap or replace your renderer. You can add Framework inspection to a
BroMetal, Three.js, or another renderer later without changing how that renderer draws.

## Mount a pure BroMetal game

Pass Studio's canvas to `createRenderer`, draw inside the host's `frame` call, and release both the
program and renderer from `dispose`:

```ts
import { createPlane, createProgram, createRenderer } from 'brometal';
import sceneShader from './scene.shader.gen';

export default async function mountGame({ canvas, report }: HostContext) {
  const renderer = await createRenderer(canvas);
  const program = createProgram(renderer, sceneShader);
  const quad = createPlane({ width: 2, height: 2 });
  program.attributes.aPosition.set(quad.positions);
  program.setIndices(quad.indices);

  report({ drawCalls: 1, instances: 1 });

  return {
    frame(time: number) {
      renderer.present(() => {
        program.uniforms.uTime.set(time);
        program.draw();
      });
    },
    dispose() {
      program.dispose();
      renderer.destroy();
    },
  };
}
```

`HostContext` can be a small local structural type when the project intentionally has no Antiky
Framework dependency. Include only the host fields your game uses:

```ts
type HostContext = Readonly<{
  canvas: HTMLCanvasElement;
  report(values: Readonly<{
    drawCalls?: number;
    instances?: number;
    uploadBytesPerFrame?: number;
    note?: string;
  }>): void;
}>;
```

The generated module contains BroMetal runtime code, not Studio, CLI, inspection transport, or MCP
server code.

## Mount a Three.js game

Give the same host canvas to `WebGLRenderer`. Do not call `setAnimationLoop`; Studio already owns
presentation timing and calls `frame`:

```ts
import {
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

export default function mountGame({ canvas, report }: HostContext) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 100);
  const geometry = new IcosahedronGeometry(1, 1);
  const material = new MeshStandardMaterial({ color: 0x68d8ff });
  const centerpiece = new Mesh(geometry, material);
  scene.add(centerpiece);

  report({ drawCalls: 1, instances: 1 });

  return {
    frame(time: number) {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      centerpiece.rotation.y = time * 0.4;
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
```

Resize the Three.js drawing buffer from the canvas's current CSS size when it changes. Keep the CSS
size under host ownership. Dispose geometries, materials, render targets, and the renderer when the
host replaces or stops the game.

## Let an agent inspect any renderer

Studio starts the local project service and MCP endpoint for every valid project. A project without
Antiky Framework still receives a host-generated fallback snapshot with the runtime lifecycle,
frame rate, canvas size, and values sent through `report`.

An agent can use these tools with pure BroMetal, Three.js, or another renderer:

```sh
antiky tool get_runtime_status
antiky tool get_render_stats
antiky tool capture_frame
antiky tool get_diagnostics
```

Use `dev_reload` after a ready build to reload the module. Use `capture_frame` for exact game-canvas
pixels and `get_render_stats` for measurements; a capture is not a source of semantic game state.

`get_world_inspection`, event tools, point-light tools, and simulation controls return useful game
state only when the module publishes the matching Framework inspection data. To add that data,
return an optional `inspection` port and build its snapshot with `createGameInspectionSnapshot`
from `@antiky/framework/game`. This opt-in does not require BroMetal and does not change a Three.js
render path.

Studio and agents inspect validated snapshots. The boundary does not expose live renderer or GPU objects.
It also keeps the game page DOM, credentials, and private engine stores outside inspection.

See [Build a game module](../framework/game-modules.md) for the complete host lifecycle. See
[Connect an MCP client](../mcp/overview.md) for local agent setup and the [MCP tool
reference](../mcp/tools.md) for call order and results.
