import type { BroMetalTexture } from 'brometal';
import { loadVfxBillboard } from './vfx-billboard.ts';
import {
  createCamera,
  createPlane,
  createProgram,
  createRenderTarget,
  createRenderer as createBroMetalRenderer,
  type BroMetalProgram,
  type RenderTarget,
  type Renderer,
  type RendererOptions,
} from 'brometal';
import postShader from './shaders/post.shader.gen.ts';

import { CATALOG_ASSET_COUNT, createArenaCatalogResources } from './arena-assets.ts';
import {
  ARENA_CATALOG_CAPACITY,
  ARENA_CATALOG_INSTANCES,
  initializeArenaCatalog,
  projectArenaCatalog,
} from './arena-composition.ts';
import { ARENA_ENVIRONMENT_LAYERS } from './arena-environment.ts';
import {
  COMBAT_PROJECTION_CAPACITY,
  COMBAT_PROJECTION_INSTANCE_FLOATS,
  createCombatProjection,
  type CombatProjection,
} from './combat-projection.ts';
import { createCombatCameraProjector } from './presentation.ts';
import { disposeResources, registerResource, rollbackResources } from './resource-lifetime.ts';
import { SHIP_CATALOG_ASSET_COUNT, SHIP_INSTANCE_CAPACITY, createShipFleet, type ShipFleet } from './ship-assets.ts';
import {
  SPACE_BACKDROP_DRAWS,
  SPACE_BACKDROP_ENVIRONMENT_LAYERS,
  SPACE_BACKDROP_INSTANCES,
  createSpaceBackdrop,
  type SpaceBackdrop,
} from './space-backdrop.ts';
import type { CombatSnapshot } from './simulation.ts';

export type CombatRendererMeasurements = Readonly<{
  instances: number;
  drawCalls: number;
  uploadBytesPerFrame: number;
  catalogAssets: number;
  catalogInstances: number;
  environmentLayers: number;
  particlePacking: 'active-prefix';
}>;

export type CombatRenderer = Readonly<{
  measurements: CombatRendererMeasurements;
  render(state: CombatSnapshot, pointer: Readonly<{ x: number; y: number }>): void;
  dispose(): void;
}>;

export const COMBAT_RENDERER_OPTIONS = Object.freeze({
  clearColor: [0.012, 0.02, 0.038, 1] as const,
  cull: 'none' as const,
}) satisfies RendererOptions;

/**
 * Exposure, in one place.
 *
 * 1 for now, deliberately: W B.2's only real check is that the image did not move, and a value
 * other than 1 would move it. It exists as a named knob because W B.5 grades against it, and
 * because the reference keeps exposure here rather than as a per-material uniform.
 */
const COMBAT_EXPOSURE = 1;

/**
 * `COMBAT_RENDERER_OPTIONS.clearColor` expressed in linear light.
 *
 * The authored value is a display colour: before this packet it was written straight to the screen
 * and never passed through a shader. Now it enters an RGBA16F target and leaves through exposure,
 * ACES and the sRGB encode, so it has to be the linear value that comes back out as the authored
 * one. Solved numerically against that exact chain, which is why it is not simply the decode of the
 * display colour.
 *
 * Getting this wrong is not subtle and is not visible in a thumbnail: `drawTo` clears to
 * transparent black by default, which in this demo would turn the whole starfield behind the arena
 * from the authored void colour to pure black.
 */
const LINEAR_CLEAR = Object.freeze([0.003419, 0.005158, 0.008368, 1] as const);

export function deriveCombatRendererMeasurements(): CombatRendererMeasurements {
  const arenaInstances = Object.values(ARENA_CATALOG_CAPACITY)
    .reduce((total, capacity) => total + capacity, 0);
  const projectionInstances = Object.values(COMBAT_PROJECTION_CAPACITY)
    .reduce((total, capacity) => total + capacity, 0);
  const instances = arenaInstances + SHIP_INSTANCE_CAPACITY + projectionInstances + SPACE_BACKDROP_INSTANCES;
  const dynamicInstances = ARENA_CATALOG_CAPACITY.targets
    + ARENA_CATALOG_CAPACITY.grenades
    + SHIP_INSTANCE_CAPACITY;
  const floatsPerInstance = 12;
  const projectionFloats = (Object.keys(COMBAT_PROJECTION_CAPACITY) as (keyof typeof COMBAT_PROJECTION_CAPACITY)[])
    .reduce((total, name) => total + COMBAT_PROJECTION_CAPACITY[name] * COMBAT_PROJECTION_INSTANCE_FLOATS[name], 0);
  return Object.freeze({
    instances,
    drawCalls: Object.keys(ARENA_CATALOG_CAPACITY).length + SHIP_CATALOG_ASSET_COUNT
      + Object.keys(COMBAT_PROJECTION_CAPACITY).length + SPACE_BACKDROP_DRAWS,
    uploadBytesPerFrame: (dynamicInstances * floatsPerInstance + projectionFloats + SHIP_INSTANCE_CAPACITY * 3)
      * Float32Array.BYTES_PER_ELEMENT,
    catalogAssets: CATALOG_ASSET_COUNT + SHIP_CATALOG_ASSET_COUNT,
    catalogInstances: ARENA_CATALOG_INSTANCES + SHIP_INSTANCE_CAPACITY,
    environmentLayers: ARENA_ENVIRONMENT_LAYERS + SPACE_BACKDROP_ENVIRONMENT_LAYERS,
    particlePacking: 'active-prefix',
  });
}

export type CombatRendererDependencies = Readonly<{
  createRenderer(canvas: HTMLCanvasElement): Promise<Renderer>;
  createCatalog: typeof createArenaCatalogResources;
  createShips: typeof createShipFleet;
  createProjection(renderer: Renderer, billboard: BroMetalTexture): CombatProjection;
  /** Injected like every other GPU resource here, so tests can build a renderer without a DOM. */
  loadVfxBillboard(renderer: Renderer): Promise<BroMetalTexture>;
  createBackdrop(renderer: Renderer): Promise<SpaceBackdrop>;
  /**
   * The HDR scene target and the pass that resolves it.
   *
   * Injected for the same reason every other GPU owner here is: `tests/resources.test.ts` drives
   * construction and disposal against a renderer that is not WebGPU-backed, and a direct call to
   * `createRenderTarget` throws before the test can observe anything.
   */
  createSceneTarget(renderer: Renderer, width: number, height: number): RenderTarget;
  createPostProgram(renderer: Renderer): BroMetalProgram;
}>;

const COMBAT_RENDERER_DEPENDENCIES: CombatRendererDependencies = Object.freeze({
  createRenderer: (canvas) => createBroMetalRenderer(canvas, COMBAT_RENDERER_OPTIONS),
  createCatalog: createArenaCatalogResources,
  createShips: createShipFleet,
  createProjection: createCombatProjection,
  createSceneTarget: (renderer, width, height) => createRenderTarget(renderer, {
    width,
    height,
    depth: true,
    // The canvas is 4x multisampled and a render target is not by default. Leaving this off
    // silently removes anti-aliasing from everything the demo draws.
    samples: 4,
  }),
  createPostProgram: (renderer) => createProgram(renderer, postShader, { blend: 'alpha' }),
  loadVfxBillboard,
  createBackdrop: createSpaceBackdrop,
});

export async function createCombatRendererWith(
  canvas: HTMLCanvasElement,
  dependencies: CombatRendererDependencies,
): Promise<CombatRenderer> {
  const renderer = await dependencies.createRenderer(canvas);
  const disposables: { dispose(): void }[] = [];
  try {
    const catalog = registerResource(disposables, await dependencies.createCatalog(renderer, ARENA_CATALOG_CAPACITY));
    const ships: ShipFleet = registerResource(disposables, await dependencies.createShips(renderer));
    initializeArenaCatalog(catalog);
    // The renderer owns the effect sprite; the projection borrows it. Loaded here because this is
    // the async boundary and `createCombatProjection` is not one.
    const billboard = registerResource(disposables, await dependencies.loadVfxBillboard(renderer));
    const projection = registerResource(disposables, dependencies.createProjection(renderer, billboard));
    const backdrop = registerResource(disposables, await dependencies.createBackdrop(renderer));

    const cameraPosition = new Float32Array(3);
    const cameraProjector = createCombatCameraProjector();
    // near 0.2 against far 60 is 300:1. The camera is a fixed high three-quarter view roughly 20
    // units from the arena floor, so nothing is ever closer than a few units.
    const camera = createCamera({ position: [0, 13.4, 14.8], fovY: Math.PI / 3.85, near: 0.3, far: 140 });
    const measurements = deriveCombatRendererMeasurements();
    let disposed = false;

    // One RGBA16F target for the whole scene, and one pass that turns it into an image. Copied from
    // `point-light-expo`, the reference implementation goal 07 names.
    //
    // `samples: 4` because the canvas is 4x multisampled and a render target is not by default.
    // Leaving it off silently removes anti-aliasing from everything the demo draws — that happened
    // in the reference and took hard luminance steps from 6,356 to 9,449 while every other metric
    // stayed inside budget.
    let sceneTarget: RenderTarget | undefined;
    const ensureSceneTarget = (): RenderTarget => {
      const width = Math.max(1, renderer.canvas.width);
      const height = Math.max(1, renderer.canvas.height);
      if (!sceneTarget || sceneTarget.width !== width || sceneTarget.height !== height) {
        sceneTarget?.dispose();
        sceneTarget = dependencies.createSceneTarget(renderer, width, height);
      }
      return sceneTarget;
    };
    // `blend: 'alpha'` on a pass that blends nothing, because in BroMetal that is the only way to
    // ask for "do not write depth": the pipeline sets `depthWriteEnabled: blend === 'none'`. The
    // post quad sits at clip z = 0 and covers the canvas, so with depth writing on it stamps 0 into
    // every depth texel and anything drawn afterwards fails `0 < 0`. The blend is a true no-op — the
    // fragment writes alpha 1, so `src * srcAlpha + dst * (1 - srcAlpha)` is exactly `src`.
    const postProgram = registerResource(disposables, dependencies.createPostProgram(renderer));
    const fullscreenQuad = createPlane({ width: 2, height: 2 });
    postProgram.attributes.aPosition!.set(fullscreenQuad.positions);
    postProgram.setIndices(fullscreenQuad.indices);

    const drawScene = (): void => {
      backdrop.draw();
      catalog.room.program.draw();
      catalog.walls.program.draw();
      catalog.wallDetails.program.draw();
      catalog.floorTiles.program.draw();
      catalog.cables.program.draw();
      projection.drawSurface();
      catalog.grenades.program.draw();
      catalog.targets.program.draw();
      ships.draw();
      // Blended passes last, once every opaque surface has written depth. Shadows before glows so
      // a glow reads as light sitting on top of the shadow rather than under it.
      projection.drawShadows();
      projection.drawEnergy();
      projection.drawHud();
    };

    const draw = (): void => {
      const scene = ensureSceneTarget();
      renderer.drawTo(scene, drawScene, { clear: LINEAR_CLEAR });
      postProgram.uniforms.uScene!.set(scene.texture);
      postProgram.uniforms.uExposure!.set(COMBAT_EXPOSURE);
      postProgram.draw();
    };

    const render = (state: CombatSnapshot, pointer: Readonly<{ x: number; y: number }>): void => {
      if (disposed) return;
      projectArenaCatalog(catalog, state);
      ships.project(state);
      projection.project(state);

      const cameraFrame = cameraProjector.project(renderer.aspect, state, pointer);
      cameraPosition.set(cameraFrame.position);
      camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
      camera.lookAt(...cameraFrame.target);
      const viewProjection = camera.viewProjection(renderer.aspect);
      catalog.frame(viewProjection, cameraPosition, state.time);
      ships.frame(viewProjection, cameraPosition, state.time);
      projection.frame(viewProjection, cameraPosition, state.time);
      backdrop.frame(viewProjection, state.time, cameraPosition);

      renderer.present(draw);
    };

    return Object.freeze({
      measurements,
      render,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        try {
          // Not registered with the scope: it is rebuilt on canvas resize, so the scope would hold
          // whichever one happened to exist at construction.
          sceneTarget?.dispose();
          disposeResources(disposables);
        } finally {
          renderer.destroy();
        }
      },
    });
  } catch (cause: unknown) {
    rollbackResources(disposables);
    renderer.destroy();
    throw cause;
  }
}

export function createCombatRenderer(canvas: HTMLCanvasElement): Promise<CombatRenderer> {
  return createCombatRendererWith(canvas, COMBAT_RENDERER_DEPENDENCIES);
}
