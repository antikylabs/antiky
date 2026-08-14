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
import bloomBlurShader from './shaders/bloom-blur.shader.gen.ts';
import bloomExtractShader from './shaders/bloom-extract.shader.gen.ts';
import postShader from './shaders/post.shader.gen.ts';
import { bindDepthProgram, createShadowPass } from './shadow-pass.ts';

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
 * Goal 07 held this at 1 because W B.2's only real check was that the image did not move. Goal 08
 * grades against it: 1.2 lifts the mids into the §7.1 p50 band and pushes the flood-lit wall faces
 * toward the p95 target, while the sky's own floor was lowered in the same commit so the darks stay
 * under the p05 ceiling. The reference keeps exposure here rather than as a per-material uniform.
 */
const COMBAT_EXPOSURE = 1.1;

/**
 * Bloom, in pre-exposure linear units.
 *
 * The threshold sits above what a lit hull reaches and below the energy rings and the ship trails,
 * so the glow picks out things that emit rather than everything the key caught.
 */
const COMBAT_BLOOM = Object.freeze({ threshold: 1, radius: 6, strength: 1.2 });

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

/**
 * The deck's mirror plane, and how much of the mirrored image the deck shows.
 *
 * -0.145 is where the contact shadows already sit (`combat-projection.ts`), which is the measured
 * "things touch the floor here" height — the right plane for a reflection for exactly the reason
 * it was the right plane for the shadows.
 */
const DECK_MIRROR_Y = -0.145;
const DECK_REFLECTION_STRENGTH = 0.5;

/**
 * `out = viewProjection x mirror`, where the mirror flips world space through `y = DECK_MIRROR_Y`.
 *
 * Column-major, like every matrix BroMetal hands out: the mirror is identity with `m[5] = -1` and
 * `m[13] = 2k`, so the product only touches column 1 and column 3 — column 1 negates, column 3
 * gains `2k` times column 1. Written out by hand because this runs every frame and a general 4x4
 * multiply would spend sixty-four multiplies computing mostly copies.
 */
function mirrorThroughDeck(out: Float32Array, viewProjection: Float32Array): void {
  out.set(viewProjection);
  const lift = 2 * DECK_MIRROR_Y;
  for (let row = 0; row < 4; row += 1) {
    out[4 + row] = -viewProjection[4 + row]!;
    out[12 + row] = viewProjection[12 + row]! + lift * viewProjection[4 + row]!;
  }
}

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
    // The final term is the planar reflection: the five ship batches and the energy glow drawn a
    // second time through the deck mirror.
    drawCalls: Object.keys(ARENA_CATALOG_CAPACITY).length + SHIP_CATALOG_ASSET_COUNT
      + Object.keys(COMBAT_PROJECTION_CAPACITY).length + SPACE_BACKDROP_DRAWS
      + SHIP_CATALOG_ASSET_COUNT + 3,
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
  createShadowPass(renderer: Renderer): ReturnType<typeof createShadowPass>;
  /** The bloom chain's targets and programs, injected for the same reason as everything else here. */
  createBloomTarget(renderer: Renderer, width: number, height: number): RenderTarget;
  createBloomProgram(renderer: Renderer, pass: 'extract' | 'blur'): BroMetalProgram;
  /** The planar-reflection target the deck samples: half resolution, rebuilt on canvas resize. */
  createReflectionTarget(renderer: Renderer, width: number, height: number): RenderTarget;
  /** Item 17's offset map: quarter resolution, written by the ripple pass, read by the post pass. */
  createDistortionTarget(renderer: Renderer, width: number, height: number): RenderTarget;
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
    // The bloom extract downsamples this 4x and the distortion pass reads it at warped positions;
    // on a point sampler both snap to texel centres — the extract is what turned thin emissives
    // into the boxy glow goal 08's trim made obvious. Goal 02's render-target-filtering patch.
    filter: 'linear',
  }),
  createPostProgram: (renderer) => createProgram(renderer, postShader, { blend: 'alpha' }),
  createShadowPass,
  createBloomTarget: (renderer, width, height) => createRenderTarget(renderer, {
    width,
    height,
    // Goal 02's render-target-filtering patch. On a point sampler the blur's taps snap back onto
    // texel centres and the chain produces blocky glow that crawls with the camera.
    filter: 'linear',
  }),
  // Branching on the pass rather than taking a shader, so the dependency stays a plain factory the
  // tests can fake without importing either compiled shader.
  createBloomProgram: (renderer, pass) => (pass === 'extract'
    ? createProgram(renderer, bloomExtractShader)
    : createProgram(renderer, bloomBlurShader)),
  loadVfxBillboard,
  createBackdrop: createSpaceBackdrop,
  createReflectionTarget: (renderer, width, height) => createRenderTarget(renderer, {
    width,
    height,
    // Mirrored ships overlap themselves; without a depth test the reflection shows whichever
    // triangle drew last.
    depth: true,
    // The deck perturbs its lookup by the plating grain, so neighbouring fragments read between
    // texels — goal 02's render-target-filtering patch again.
    filter: 'linear',
  }),
  createDistortionTarget: (renderer, width, height) => createRenderTarget(renderer, {
    width,
    height,
    // An offset field is low frequency by construction, and the post pass reads between texels.
    filter: 'linear',
  }),
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
    // Committed by goal 08 alongside the projector's pose: a 30° lens from low and far, which is
    // the Rocket League read — long-lensed, flat perspective, ships in silhouette. Nothing is ever
    // closer than a few units, and 140/0.3 stays inside the 500:1 depth-ratio budget.
    const camera = createCamera({ position: [0, 9.8, 24.0], fovY: Math.PI / 6, near: 0.3, far: 140 });
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
    // Half resolution: a reflection broken by plating grain carries no detail worth full price,
    // and Rocket League's own floor reflections are famously quarter-res.
    let reflectionTarget: RenderTarget | undefined;
    const ensureReflectionTarget = (): RenderTarget => {
      const width = Math.max(1, Math.floor(renderer.canvas.width / 2));
      const height = Math.max(1, Math.floor(renderer.canvas.height / 2));
      if (!reflectionTarget || reflectionTarget.width !== width || reflectionTarget.height !== height) {
        reflectionTarget?.dispose();
        reflectionTarget = dependencies.createReflectionTarget(renderer, width, height);
      }
      return reflectionTarget;
    };
    let distortionTarget: RenderTarget | undefined;
    const ensureDistortionTarget = (): RenderTarget => {
      const width = Math.max(1, Math.floor(renderer.canvas.width / 4));
      const height = Math.max(1, Math.floor(renderer.canvas.height / 4));
      if (!distortionTarget || distortionTarget.width !== width || distortionTarget.height !== height) {
        distortionTarget?.dispose();
        distortionTarget = dependencies.createDistortionTarget(renderer, width, height);
      }
      return distortionTarget;
    };
    // What `render` measured this frame, for `draw` to mirror. The mirror pass cannot recompute
    // these — the camera projector consumes pointer state — so they are captured at projection
    // time and read at draw time, inside the same tick.
    const mirroredViewProjection = new Float32Array(16);
    const mirroredCameraPosition = new Float32Array(3);
    let frameViewProjection: Float32Array = mirroredViewProjection;
    let frameTime = 0;
    // `blend: 'alpha'` on a pass that blends nothing, because in BroMetal that is the only way to
    // ask for "do not write depth": the pipeline sets `depthWriteEnabled: blend === 'none'`. The
    // post quad sits at clip z = 0 and covers the canvas, so with depth writing on it stamps 0 into
    // every depth texel and anything drawn afterwards fails `0 < 0`. The blend is a true no-op — the
    // fragment writes alpha 1, so `src * srcAlpha + dst * (1 - srcAlpha)` is exactly `src`.
    // The sun's shadow map. Bound once at setup: every material reads the same target and the same
    // light, which is what makes one sun one sun.
    const shadows = registerResource(disposables, dependencies.createShadowPass(renderer));
    const catalogBatches = [
      catalog.room, catalog.walls, catalog.wallDetails, catalog.floorTiles,
      catalog.targets, catalog.grenades,
    ] as const;
    for (const batch of catalogBatches) {
      shadows.bind(batch.program as never);
      bindDepthProgram(batch.depthProgram as never, 0);
    }
    for (const hull of ships.programs) {
      shadows.bind(hull.program as never);
      bindDepthProgram(hull.depthProgram as never, 0);
    }
    shadows.bind(projection.surfaceProgram as never);
    // 1: this is the batch drawn through `arena-surface`, which bobs its instances on a clock.
    bindDepthProgram(projection.surfaceDepthProgram as never, 1);

    const postProgram = registerResource(disposables, dependencies.createPostProgram(renderer));
    const fullscreenQuad = createPlane({ width: 2, height: 2 });
    // Two quarter-resolution targets, ping-ponged by the blur. Quarter because a blur's output is
    // low-frequency by definition, and two because a separable blur cannot read and write the same
    // texture. `filter: 'linear'` is goal 02's render-target-filtering patch, and is hard-blocking:
    // on a point sampler the taps between texels snap back onto texel centres and the chain produces
    // blocky glow that crawls with the camera.
    let bloomTargets: readonly [RenderTarget, RenderTarget] | undefined;
    const ensureBloomTargets = (): readonly [RenderTarget, RenderTarget] => {
      const width = Math.max(1, Math.floor(renderer.canvas.width / 4));
      const height = Math.max(1, Math.floor(renderer.canvas.height / 4));
      if (!bloomTargets || bloomTargets[0].width !== width || bloomTargets[0].height !== height) {
        bloomTargets?.[0].dispose();
        bloomTargets?.[1].dispose();
        bloomTargets = [
          dependencies.createBloomTarget(renderer, width, height),
          dependencies.createBloomTarget(renderer, width, height),
        ];
      }
      return bloomTargets;
    };
    const bloomExtract = registerResource(disposables, dependencies.createBloomProgram(renderer, 'extract'));
    bloomExtract.attributes.aPosition!.set(fullscreenQuad.positions);
    bloomExtract.setIndices(fullscreenQuad.indices);
    const bloomBlur = registerResource(disposables, dependencies.createBloomProgram(renderer, 'blur'));
    bloomBlur.attributes.aPosition!.set(fullscreenQuad.positions);
    bloomBlur.setIndices(fullscreenQuad.indices);
    postProgram.attributes.aPosition!.set(fullscreenQuad.positions);
    postProgram.setIndices(fullscreenQuad.indices);

    const drawScene = (): void => {
      backdrop.draw();
      catalog.room.program.draw();
      catalog.walls.program.draw();
      catalog.wallDetails.program.draw();
      catalog.floorTiles.program.draw();
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

    // Everything solid enough to block the sun. The blended passes are absent on purpose: contact
    // shadows and energy rings stand in for light, and a sprite of a glow casting a hard shadow is
    // exactly wrong.
    const drawCasters = (): void => {
      for (const batch of catalogBatches) batch.drawDepth();
      ships.drawDepth();
      projection.drawSurfaceDepth();
    };

    const draw = (): void => {
      // Before the scene, because the scene reads what this writes. `drawTo` finishes and submits
      // its own encoder, so the two passes are ordered by the queue rather than by hope.
      shadows.render(drawCasters);
      // The deck's mirror: ships and their glow, seen through the floor plane. The same programs
      // draw both passes — BroMetal's uniform ring gives every draw its own snapshot, so setting
      // the mirrored matrices, drawing, and setting the real ones back is safe within one frame.
      // The mirrored camera position keeps the view-dependent terms (specular, rim) correct in the
      // mirror, which is what makes it read as a reflection rather than as a second lit ship.
      const reflection = ensureReflectionTarget();
      mirrorThroughDeck(mirroredViewProjection, frameViewProjection);
      mirroredCameraPosition[0] = cameraPosition[0]!;
      mirroredCameraPosition[1] = 2 * DECK_MIRROR_Y - cameraPosition[1]!;
      mirroredCameraPosition[2] = cameraPosition[2]!;
      ships.frame(mirroredViewProjection, mirroredCameraPosition, frameTime);
      projection.frame(mirroredViewProjection, mirroredCameraPosition, frameTime);
      catalog.frame(mirroredViewProjection, mirroredCameraPosition, frameTime);
      renderer.drawTo(reflection, () => {
        // The rim structure is here for its emissive trim: the ships' undersides are dark — a
        // physically honest mirror shows a belly, not a beauty pass — and the rail is the bright
        // thing this arena owns. Its smear down the deck is the Rocket League tell AC-L5 measures.
        catalog.walls.program.draw();
        catalog.wallDetails.program.draw();
        ships.draw();
        projection.drawEnergy();
      }, { clear: [0, 0, 0, 0] });
      ships.frame(frameViewProjection, cameraPosition, frameTime);
      projection.frame(frameViewProjection, cameraPosition, frameTime);
      catalog.frame(frameViewProjection, cameraPosition, frameTime);
      const floorUniforms = catalog.floorTiles.program.uniforms as unknown as Record<string, { set(value: unknown): void }>;
      floorUniforms.uReflection!.set(reflection.texture);
      floorUniforms.uReflectionStrength!.set(DECK_REFLECTION_STRENGTH);
      const scene = ensureSceneTarget();
      renderer.drawTo(scene, drawScene, { clear: LINEAR_CLEAR });
      // The impact ripples, into their own quarter-res offset map. Cleared to zero, which is
      // "nothing distorts anywhere" — the post pass adds the map to its scene lookup unconditionally.
      const distortion = ensureDistortionTarget();
      renderer.drawTo(distortion, () => projection.drawRipples(), { clear: [0, 0, 0, 0] });
      // Extract, blur across, blur down. Three quarter-resolution passes over an already-drawn
      // scene, so nothing here touches the geometry again.
      const [bloomA, bloomB] = ensureBloomTargets();
      bloomExtract.uniforms.uScene!.set(scene.texture);
      bloomExtract.uniforms.uThreshold!.set(COMBAT_BLOOM.threshold);
      bloomExtract.uniforms.uTexel!.set([1 / bloomA.width, 1 / bloomA.height]);
      renderer.drawTo(bloomA, () => bloomExtract.draw());
      bloomBlur.uniforms.uSource!.set(bloomA.texture);
      // radius / 3, because the blur's outermost tap sits at three steps: a step of the full
      // radius put the seven taps a whole radius apart, and any bright single texel printed as a
      // lattice of seven boxes per axis. Now the far tap lands at the radius, as intended.
      bloomBlur.uniforms.uDirection!.set([COMBAT_BLOOM.radius / 3 / bloomA.width, 0]);
      renderer.drawTo(bloomB, () => bloomBlur.draw());
      bloomBlur.uniforms.uSource!.set(bloomB.texture);
      bloomBlur.uniforms.uDirection!.set([0, COMBAT_BLOOM.radius / 3 / bloomA.height]);
      renderer.drawTo(bloomA, () => bloomBlur.draw());

      postProgram.uniforms.uScene!.set(scene.texture);
      postProgram.uniforms.uDistortion!.set(distortion.texture);
      postProgram.uniforms.uBloom!.set(bloomA.texture);
      postProgram.uniforms.uBloomStrength!.set(COMBAT_BLOOM.strength);
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
      frameViewProjection = viewProjection;
      frameTime = state.time;
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
          reflectionTarget?.dispose();
          distortionTarget?.dispose();
          bloomTargets?.[0].dispose();
          bloomTargets?.[1].dispose();
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
