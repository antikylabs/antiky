import {
  type RenderTarget,
  createRenderTarget,
  createPlane,
  createCamera,
  createCube,
  createProgram,
  createRenderer,
  createSphere,
  createTorus,
  type BroMetalTexture,
  type Renderer,
} from 'brometal';

import {
  COURSE_CHECKPOINTS,
  COURSE_COLLECTIBLES,
  COURSE_HAZARDS,
  COURSE_PLATFORMS,
  DELIVERY_X,
  hazardTop,
  platformTop,
} from './course.ts';
import { groundTopAt } from './course-query.ts';
import {
  GROUND_QUAD,
  createCatalogBatch,
  createGlowBatch,
  createSurfaceBatch,
  rollbackAndRethrow,
  writeVec3,
  type CatalogProgram,
  type Vec3,
} from './course-batches.ts';
import {
  backgroundCompositionAt,
} from './environment.ts';
import { createTraversalCameraRig } from './presentation.ts';
import { TRAVERSAL_BATCH_CAPACITIES } from './render-plan.ts';
import {
  acquireTransactional,
  createRendererResourceLifetime,
} from '@antiky/framework';
import { summarizeTraversalMeasurements } from './measurements.ts';
import { COURSE_SKY } from './ambient.ts';
import { loadKitMaterialMaps } from './kit-material-maps.ts';
import { createHudBatch } from './traversal-hud.ts';
import { createKitMaterialLookup } from './kit-materials.ts';
import { createLightingRamp } from './lighting-ramp.ts';
import { loadVfxBillboard } from './vfx-billboard.ts';
import { loadDetailNormal } from './detail-normal.ts';
import { SHADOW_MAP_SIZE, SUN_DIRECTION, createCourseSunShadow } from './sun.ts';
import contactShadowShader from './shaders/contact-shadow.shader.gen.ts';
import bloomBlurShader from './shaders/bloom-blur.shader.gen.ts';
import bloomExtractShader from './shaders/bloom-extract.shader.gen.ts';
import postShader from './shaders/post.shader.gen.ts';
import courseSkyShader from './shaders/course-sky.shader.gen';
import { RUNNER_RADIUS, type TraversalSnapshot } from './simulation.ts';
import {
  HAZARD_SPIKE_SCALE,
  HAZARD_TELEGRAPH_DEPTH,
  HAZARD_TELEGRAPH_HALF_DEPTH,
  HAZARD_TELEGRAPH_HALF_HEIGHT,
  HUD_BAR_GAP,
  HUD_BAR_HALF_HEIGHT,
  HUD_BAR_HALF_WIDTH,
  HUD_LABEL_CELLS,
  HUD_LABEL_CELL_HALF_HEIGHT,
  HUD_LABEL_CELL_HALF_WIDTH,
  HUD_LABEL_CENTER_X_OFFSET,
  HUD_METER_CENTER_X_OFFSET,
  HUD_METER_HALF_WIDTH,
  hazardTelegraphHalfWidth,
} from './visual-layout.ts';

type PointerState = Readonly<{ x: number; y: number }>;

const SEA_GREY: Vec3 = [0.46, 0.58, 0.6];
const ULTRAMARINE: Vec3 = [0.08, 0.22, 0.5];
const OCHRE: Vec3 = [0.76, 0.48, 0.13];
const CLAY: Vec3 = [0.58, 0.28, 0.2];
const VERMILION: Vec3 = [0.86, 0.16, 0.08];
const CREAM: Vec3 = [0.88, 0.76, 0.55];
const GRASS: Vec3 = [0.2, 0.42, 0.25];
const INK: Vec3 = [0.055, 0.075, 0.085];


function stableNoise(index: number, salt: number): number {
  const value = Math.sin(index * 63.17 + salt * 17.53) * 43147.19;
  return value - Math.floor(value);
}

export type TraversalRenderer = Readonly<{
  measurements: Readonly<{ instances: number; drawCalls: number; uploadBytesPerFrame: number; note: string }>;
  render(state: TraversalSnapshot, pointer: PointerState, deltaSeconds: number): void;
  dispose(): void;
}>;

export async function createTraversalRenderer(canvas: HTMLCanvasElement): Promise<TraversalRenderer> {
  // Back-face culling: the course geometry is closed, so every back face drawn was fragment work
  // thrown away. If a specific mesh ever needs double-siding, draw that mesh in its own pass rather
  // than reverting this for the whole demo.
  const renderer = await createRenderer(canvas, { clearColor: [0.38, 0.57, 0.68, 1], cull: 'back' });
  const lifetime = createRendererResourceLifetime(() => renderer.destroy());
  const owned = lifetime.resources;
  try {
    // Loaded once and shared by all thirteen catalog batches. Thirteen uploads of the same 512x512
    // image is twelve wasted, and the renderer outlives every batch that borrows it.
    const detailNormal = owned.adopt(await loadDetailNormal(renderer));
    // One ramp for every catalog batch: it is the demo's lighting model, not a per-object
    // material, so there is exactly one of it.
    const ramp = owned.adopt(createLightingRamp(renderer));
    const kitMaterials = owned.adopt(createKitMaterialLookup(renderer));
    const materialMaps = await loadKitMaterialMaps(renderer);
    owned.adopt(materialMaps.diffuse);
    owned.adopt(materialMaps.roughness);
    // One sprite for every effect: it is the demo's effect texture, not a per-effect material.
    const vfxBillboard = owned.adopt(await loadVfxBillboard(renderer));
    const catalogTransaction = await acquireTransactional([
      () => createCatalogBatch(renderer, 'grass', TRAVERSAL_BATCH_CAPACITIES.grass, detailNormal, ramp, kitMaterials, materialMaps, 1),
      () => createCatalogBatch(renderer, 'overhang', TRAVERSAL_BATCH_CAPACITIES.overhang, detailNormal, ramp, kitMaterials, materialMaps, 1),
      () => createCatalogBatch(renderer, 'moving', TRAVERSAL_BATCH_CAPACITIES.moving, detailNormal, ramp, kitMaterials, materialMaps, 1),
      () => createCatalogBatch(renderer, 'flag', TRAVERSAL_BATCH_CAPACITIES.flag, detailNormal, ramp, kitMaterials, materialMaps),
      () => createCatalogBatch(renderer, 'coin', TRAVERSAL_BATCH_CAPACITIES.coin, detailNormal, ramp, kitMaterials, materialMaps),
      () => createCatalogBatch(renderer, 'spikes', TRAVERSAL_BATCH_CAPACITIES.spikes, detailNormal, ramp, kitMaterials, materialMaps),
      () => createCatalogBatch(renderer, 'tree', TRAVERSAL_BATCH_CAPACITIES.tree, detailNormal, ramp, kitMaterials, materialMaps),
      () => createCatalogBatch(renderer, 'courier', TRAVERSAL_BATCH_CAPACITIES.courier, detailNormal, ramp, kitMaterials, materialMaps),
      () => createCatalogBatch(renderer, 'cloud-small', TRAVERSAL_BATCH_CAPACITIES['cloud-small'], detailNormal, ramp, kitMaterials, materialMaps, 0, 0.65),
      () => createCatalogBatch(renderer, 'cloud-large', TRAVERSAL_BATCH_CAPACITIES['cloud-large'], detailNormal, ramp, kitMaterials, materialMaps, 0, 0.65),
      () => createCatalogBatch(renderer, 'coastal-cliff', TRAVERSAL_BATCH_CAPACITIES['coastal-cliff'], detailNormal, ramp, kitMaterials, materialMaps),
      () => createCatalogBatch(renderer, 'coastal-tree', TRAVERSAL_BATCH_CAPACITIES['coastal-tree'], detailNormal, ramp, kitMaterials, materialMaps),
      () => createCatalogBatch(renderer, 'relay-tower', TRAVERSAL_BATCH_CAPACITIES['relay-tower'], detailNormal, ramp, kitMaterials, materialMaps),
    ]);
    owned.adopt(catalogTransaction);
    const catalogEntries = catalogTransaction.resources;
    const grass = catalogEntries[0]!;
    const overhang = catalogEntries[1]!;
    const moving = catalogEntries[2]!;
    const flags = catalogEntries[3]!;
    const coins = catalogEntries[4]!;
    const spikes = catalogEntries[5]!;
    const trees = catalogEntries[6]!;
    const courier = catalogEntries[7]!;
    const cloudSmall = catalogEntries[8]!;
    const cloudLarge = catalogEntries[9]!;
    const coastalCliffs = catalogEntries[10]!;
    const coastalTrees = catalogEntries[11]!;
    const relayTowers = catalogEntries[12]!;
    const contactShadow = owned.adopt(createSurfaceBatch(renderer, GROUND_QUAD, TRAVERSAL_BATCH_CAPACITIES.contactShadow, vfxBillboard, contactShadowShader));
    const hud = owned.adopt(createHudBatch(renderer));
    const trail = owned.adopt(createGlowBatch(renderer, createSphere({ radius: 1, widthSegments: 8, heightSegments: 6 }), TRAVERSAL_BATCH_CAPACITIES.trail, vfxBillboard));
    const effects = owned.adopt(createGlowBatch(renderer, createTorus({ radius: 1, tube: 0.055, radialSegments: 8, tubularSegments: 48 }), TRAVERSAL_BATCH_CAPACITIES.effects, vfxBillboard));
    // The emissive glyphs — checkpoint rings and the delivery pulse — drawn additively into HDR so
    // they can bloom. The dust puffs stay in the alpha batch above: dust is matter, not light.
    const emissives = owned.adopt(createGlowBatch(renderer, createTorus({ radius: 1, tube: 0.055, radialSegments: 8, tubularSegments: 48 }), 4, vfxBillboard, 'additive'));
    const procedural = [contactShadow, hud, trail, effects, emissives];
    const cameraRig = createTraversalCameraRig();
    // near 0.5 against far 240 is a 480:1 depth ratio, inside the 500:1 budget. The old 0.1 gave
    // 2400:1 and spent most of the depth buffer's precision on the first half-metre, which nothing
    // in a side-on platformer ever occupies — the camera sits 12 units back and never approaches
    // the course.
    const camera = createCamera({ position: [0, 5, 12], fovY: Math.PI / 3.6, near: 0.5, far: 240 });
    const cameraPosition = new Float32Array(3);

    const measurements = summarizeTraversalMeasurements([...catalogEntries, ...procedural]);
    // Everything solid enough to block the sun. The clouds are absent — they sit far behind the
    // course and would shadow the whole slice — and so are the blended passes: contact shadows,
    // trails and glows stand in for light, and a sprite of a glow casting a hard shadow is wrong.
    const drawCasters = (): void => {
      coastalCliffs.drawDepth(); relayTowers.drawDepth(); coastalTrees.drawDepth(); trees.drawDepth();
      grass.drawDepth(); overhang.drawDepth(); moving.drawDepth();
      spikes.drawDepth(); flags.drawDepth(); coins.drawDepth();
      courier.drawDepth();
    };

    const skyProgram = owned.adopt(createProgram(renderer, courseSkyShader));
    {
      // Inside the camera's 240-unit far plane, following the camera like the arena's sky.
      const dome = createSphere({ radius: 170, widthSegments: 24, heightSegments: 16 });
      // Seen from inside, and this renderer culls back faces: reversing the index order flips
      // every triangle's winding so the sphere's inside is its front. Without this the whole dome
      // is silently culled and the sky stays the flat clear colour — which is exactly what the
      // first capture showed.
      dome.indices.reverse();
      skyProgram.attributes.aPosition.set(dome.positions);
      skyProgram.setIndices(dome.indices);
    }

    const drawScene = (): void => {
      skyProgram.draw();
      cloudLarge.draw(); cloudSmall.draw();
      coastalCliffs.draw(); relayTowers.draw(); coastalTrees.draw(); trees.draw();
      grass.draw(); overhang.draw(); moving.draw();
      contactShadow.draw();
      spikes.draw(); flags.draw(); coins.draw();
      effects.draw(); emissives.draw(); courier.draw(); trail.draw(); hud.draw();
    };

    /**
     * Exposure, in one place. 1 for now: W B.2's only real check is that the image did not move.
     */
    const TRAVERSAL_EXPOSURE = 1;

    /**
     * Bloom, in pre-exposure linear units.
     *
     * The threshold sits above the lit platform tops and below the coins and the sky's brightest
     * cloud edges, so the glow picks out what is actually bright rather than everything the sun
     * caught. It is higher than the other two demos' because this scene is bright throughout.
     */
    const TRAVERSAL_BLOOM = Object.freeze({ threshold: 1.6, radius: 5, strength: 0.85 });

    /**
     * The clear colour expressed in linear light.
     *
     * The authored value is a display colour: it used to be written straight to the screen. Now it
     * enters an RGBA16F target and leaves through exposure, ACES and the sRGB encode, so it has to
     * be the linear value that comes back out as the authored one. Solved numerically against that
     * chain, which is why it is not simply the decode.
     *
     * `drawTo` clears to transparent black by default, and in a demo whose frame is mostly sky that
     * would replace the sky with a black rectangle.
     */
    const LINEAR_CLEAR = Object.freeze([0.096296, 0.190755, 0.284863, 1] as const);

    // One RGBA16F target and one pass that turns it into an image. Copied by hand from
    // `point-light-expo`, the reference implementation goal 07 names.
    //
    // `samples: 4` because the canvas is 4x multisampled and a render target is not by default.
    let sceneTarget: RenderTarget | undefined;
    const ensureSceneTarget = (): RenderTarget => {
      const width = Math.max(1, renderer.canvas.width);
      const height = Math.max(1, renderer.canvas.height);
      if (!sceneTarget || sceneTarget.width !== width || sceneTarget.height !== height) {
        sceneTarget?.dispose();
        sceneTarget = createRenderTarget(renderer, {
        width,
        height,
        depth: true,
        samples: 4,
        // `filter: 'linear'` because the bloom extract downsamples this 4x — on a point sampler it
        // read 1 of every 16 pixels and small bright sources boxed. Goal 02's filtering patch.
        filter: 'linear',
      });
      }
      return sceneTarget;
    };
    // `blend: 'alpha'` is how BroMetal is asked not to write depth: the pipeline sets
    // `depthWriteEnabled: blend === 'none'`. The post quad covers the canvas at clip z = 0, so with
    // depth writing on it stamps 0 everywhere and anything drawn after fails `0 < 0`. The blend is a
    // no-op — the fragment writes alpha 1.
    /**
     * The sun's shadow map, aimed at the visible slice.
     *
     * Rebuilt every frame rather than bound once, which is where this demo departs from the
     * reference: a 190-unit course under one fixed map gives nine centimetres per texel, so the map
     * follows the camera and covers about 28 units instead. See `src/sun.ts`.
     *
     * `samples: 1` deliberately, unlike the scene target. Averaging distance across a silhouette
     * produces a value belonging to neither the caster nor what is behind it, and that in-between
     * distance reads as a bright halo tracing every shadow edge. Softness comes from the nine-tap
     * lookup.
     */
    const shadowTarget = owned.adopt(createRenderTarget(renderer, {
      width: SHADOW_MAP_SIZE,
      height: SHADOW_MAP_SIZE,
      // The map records the *nearest* caster to the light; without a depth test that is whichever
      // triangle was submitted last.
      depth: true,
      // Goal 02's render-target-filtering patch. On a point sampler the nine taps land on the same
      // texel and the softness parameter does nothing.
      filter: 'linear',
      samples: 1,
    }));

    // Bound after `shadowTarget` exists, not beside the draw functions: `const` is in its temporal
    // dead zone until its declaration runs, and binding earlier threw during construction — which
    // surfaces as a capture timeout rather than as an error anyone would recognise.
    for (const entry of catalogEntries) {
      for (const program of entry.programs) {
        const uniforms = program.uniforms as unknown as Record<string, { set(v: unknown): void }>;
        uniforms.uSunDirection?.set(SUN_DIRECTION);
        uniforms.uShadowMap?.set(shadowTarget.texture);
      }
    }

    // Two quarter-resolution targets, ping-ponged by the blur. `filter: 'linear'` is goal 02's
    // render-target-filtering patch and is hard-blocking: on a point sampler the taps snap back onto
    // texel centres and the chain produces blocky glow that crawls with the camera.
    let bloomTargets: readonly [RenderTarget, RenderTarget] | undefined;
    const ensureBloomTargets = (): readonly [RenderTarget, RenderTarget] => {
      const width = Math.max(1, Math.floor(renderer.canvas.width / 4));
      const height = Math.max(1, Math.floor(renderer.canvas.height / 4));
      if (!bloomTargets || bloomTargets[0].width !== width || bloomTargets[0].height !== height) {
        bloomTargets?.[0].dispose();
        bloomTargets?.[1].dispose();
        bloomTargets = [
          createRenderTarget(renderer, { width, height, filter: 'linear' }),
          createRenderTarget(renderer, { width, height, filter: 'linear' }),
        ];
      }
      return bloomTargets;
    };
    owned.adopt({ dispose: () => { bloomTargets?.[0].dispose(); bloomTargets?.[1].dispose(); } });
    const bloomExtract = owned.adopt(createProgram(renderer, bloomExtractShader));
    const bloomBlur = owned.adopt(createProgram(renderer, bloomBlurShader));

    const postProgram = owned.adopt(createProgram(renderer, postShader, { blend: 'alpha' }));
    const fullscreenQuad = createPlane({ width: 2, height: 2 });
    postProgram.attributes.aPosition!.set(fullscreenQuad.positions);
    postProgram.setIndices(fullscreenQuad.indices);
    bloomExtract.attributes.aPosition!.set(fullscreenQuad.positions);
    bloomExtract.setIndices(fullscreenQuad.indices);
    bloomBlur.attributes.aPosition!.set(fullscreenQuad.positions);
    bloomBlur.setIndices(fullscreenQuad.indices);
    owned.adopt({ dispose: () => sceneTarget?.dispose() });

    const drawFrame = (): void => {
      // The shadow pass first, because the scene reads what it writes. `drawTo` finishes and submits
      // its own encoder, so the two are ordered by the queue rather than by hope.
      //
      // `NOTHING_OCCLUDING` is 1, the far end of the normalised range: a caster nearer than that
      // then reads as nearer and shadows what is behind it. `drawTo`'s default of transparent black
      // would say every texel holds something at the light's own eye and drop the course into
      // shadow entirely.
      renderer.drawTo(shadowTarget, drawCasters, { clear: [1, 1, 1, 1] });
      const scene = ensureSceneTarget();
      renderer.drawTo(scene, drawScene, { clear: LINEAR_CLEAR });
      // Extract, blur across, blur down — three quarter-resolution passes over a drawn scene.
      const [bloomA, bloomB] = ensureBloomTargets();
      bloomExtract.uniforms.uScene!.set(scene.texture);
      bloomExtract.uniforms.uThreshold!.set(TRAVERSAL_BLOOM.threshold);
      bloomExtract.uniforms.uTexel!.set([1 / bloomA.width, 1 / bloomA.height]);
      renderer.drawTo(bloomA, () => bloomExtract.draw());
      bloomBlur.uniforms.uSource!.set(bloomA.texture);
      // radius / 3: the outermost tap sits at three steps; a whole-radius step printed bright
      // singles as a lattice of boxes.
      bloomBlur.uniforms.uDirection!.set([TRAVERSAL_BLOOM.radius / 3 / bloomA.width, 0]);
      renderer.drawTo(bloomB, () => bloomBlur.draw());
      bloomBlur.uniforms.uSource!.set(bloomB.texture);
      bloomBlur.uniforms.uDirection!.set([0, TRAVERSAL_BLOOM.radius / 3 / bloomA.height]);
      renderer.drawTo(bloomA, () => bloomBlur.draw());

      postProgram.uniforms.uScene!.set(scene.texture);
      postProgram.uniforms.uBloom!.set(bloomA.texture);
      postProgram.uniforms.uBloomStrength!.set(TRAVERSAL_BLOOM.strength);
      postProgram.uniforms.uExposure!.set(TRAVERSAL_EXPOSURE);
      postProgram.draw();
    };

    const render = (state: TraversalSnapshot, pointer: PointerState, deltaSeconds: number): void => {
      const composition = backgroundCompositionAt(state.player.x);
      grass.clear(); overhang.clear(); moving.clear(); trees.clear();
      cloudSmall.clear(); cloudLarge.clear(); coastalCliffs.clear(); coastalTrees.clear(); relayTowers.clear();
      let grassIndex = 0;
      let overhangIndex = 0;
      let movingIndex = 0;
      let treeIndex = 0;
      let cloudSmallIndex = 0;
      let cloudLargeIndex = 0;
      let coastalCliffIndex = 0;
      let coastalTreeIndex = 0;
      let relayTowerIndex = 0;
      for (let index = 0; index < COURSE_PLATFORMS.length; index += 1) {
        const platform = COURSE_PLATFORMS[index]!;
        const top = platformTop(platform, state.time);
        if (platform.asset === 'moving') {
          moving.set(movingIndex, platform.x, top - 0.54, 0, platform.width, 1.8, 2.7, 0, 0, index);
          movingIndex += 1;
        } else if (platform.asset === 'overhang') {
          overhang.set(overhangIndex, platform.x, top - 0.7, 0, platform.width / 2.08, 0.72, 2.55, 0, 0, index);
          overhangIndex += 1;
        } else {
          grass.set(grassIndex, platform.x, top - 0.7, 0, platform.width / 2.08, 0.72, 1.42, 0, 0, index);
          grassIndex += 1;
        }
      }
      for (let index = 0; index < composition.catalog.length; index += 1) {
        const landmark = composition.catalog[index]!;
        const sway = landmark.asset === 'tree' || landmark.asset === 'coastal-tree' ? 0.012 : 0;
        if (landmark.asset === 'tree') trees.set(treeIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, sway, landmark.phase);
        if (landmark.asset === 'cloud-small') cloudSmall.set(cloudSmallIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0.004, landmark.phase);
        if (landmark.asset === 'cloud-large') cloudLarge.set(cloudLargeIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0.003, landmark.phase);
        if (landmark.asset === 'coastal-cliff') coastalCliffs.set(coastalCliffIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0, landmark.phase);
        if (landmark.asset === 'coastal-tree') coastalTrees.set(coastalTreeIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, sway, landmark.phase);
        if (landmark.asset === 'relay-tower') relayTowers.set(relayTowerIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0, landmark.phase);
      }
      grass.upload(); overhang.upload(); moving.upload(); trees.upload();
      cloudSmall.upload(); cloudLarge.upload(); coastalCliffs.upload(); coastalTrees.upload(); relayTowers.upload();

      flags.clear();
      for (let index = 0; index < COURSE_CHECKPOINTS.length; index += 1) {
        const checkpoint = COURSE_CHECKPOINTS[index]!;
        flags.set(index, checkpoint.x, groundTopAt(checkpoint.x, state.time) + 0.03, -1.32, 1.5, 1.85, 1.5, 0, 0.08 + state.effects.checkpoint * 0.04, index * 1.7);
      }
      flags.set(3, DELIVERY_X - 1.5, groundTopAt(DELIVERY_X, state.time) + 0.03, -1.5, 2.2, 3.2, 2.2, 0, 0.11, 4.2);
      flags.upload();

      coins.clear();
      if (!state.collectedSeal) {
        const collectible = COURSE_COLLECTIBLES[0]!;
        coins.set(0, collectible.x, collectible.y + Math.sin(state.time * 3) * 0.12, 0.05, 1.65, 1.65, 1.65, state.time * 2.6, 0, 0);
      }
      if (state.outcome === 'delivered') {
        coins.set(1, DELIVERY_X, groundTopAt(DELIVERY_X, state.time) + 1.7, 0, 2.6, 2.6, 2.6, state.time * 1.8, 0, 1);
      }
      coins.upload();

      spikes.clear();
      for (let index = 0; index < COURSE_HAZARDS.length; index += 1) {
        const hazard = COURSE_HAZARDS[index]!;
        spikes.set(index, hazard.x, hazardTop(hazard, state.time) + 0.02, 0, HAZARD_SPIKE_SCALE[0], HAZARD_SPIKE_SCALE[1], HAZARD_SPIKE_SCALE[2], 0, 0, index);
      }
      spikes.upload();

      const gait = Math.sin(state.time * (7 + Math.abs(state.player.vx)));
      const courierScaleX = (0.305 + state.player.squash * 0.018) * state.player.facing;
      const courierScaleY = 0.305 - state.player.squash * 0.022;
      courier.clear();
      courier.set(0, state.player.x, state.player.y - RUNNER_RADIUS + 0.002, 0.02, courierScaleX, courierScaleY, 0.305, gait * 0.018, 0.012, state.time * 1.7);
      courier.upload();

      const supportTop = groundTopAt(state.player.x, state.time);
      const shadowDistance = Math.max(0, state.player.y - RUNNER_RADIUS - supportTop);
      contactShadow.clear();
      // Footprint widened from the squashed-sphere numbers. The dome was opaque and replaced the
      // platform pixels outright; this is a soft alpha wash, so the same extents read far lighter —
      // measured against a control capture, the old blob darkened its deepest pixel by ~50% and this
      // one by 19%. A platformer's contact shadow is gameplay feedback about where you will land, so
      // it has to stay legible.
      //
      // `iScale.y` is a rotation in this shader, not a height: the quad is flat, so the vertical
      // scale the sphere needed is free.
      contactShadow.set(0, state.player.x, supportTop + 0.025, -0.02, 1.15 - Math.min(0.6, shadowDistance * 0.26), 0, 0.66, INK, 0, 0, 0);
      contactShadow.upload();

      trail.clear();
      for (let index = 0; index < state.trail.length; index += 1) {
        const particle = state.trail[index]!;
        const life = Math.max(0, particle.life);
        const color = particle.color === 0 ? SEA_GREY : particle.color === 1 ? OCHRE : VERMILION;
        const scale = (0.025 + life * 0.11) * Math.min(1, life * 4);
        trail.set(index, particle.x, particle.y, 0.1, scale, scale, scale, color, Math.min(0.7, life * 2.4), 0, index * 0.31);
      }
      const windAnchor = Math.floor(state.player.x / 20) * 20;
      for (let index = 0; index < 30; index += 1) {
        const depth = index % 3;
        const wrap = ((state.time * (1.7 + depth * 0.4) + stableNoise(index, 5) * 24) % 24) - 12;
        const speck = 0.025 + depth * 0.012;
        trail.set(state.trail.length + index, windAnchor + wrap, -0.4 + stableNoise(index, 9) * 7, -2 - depth * 2.6, speck * 2.4, speck, speck, depth === 0 ? CREAM : SEA_GREY, 0.1, -0.05, index);
      }
      trail.upload();

      effects.clear();
      emissives.clear();
      for (let index = 0; index < COURSE_CHECKPOINTS.length; index += 1) {
        const checkpoint = COURSE_CHECKPOINTS[index]!;
        const checkpointScale = 0.82 + state.effects.checkpoint * 0.3;
        // Colour gain 2.6: additive into HDR, so an active checkpoint's ring runs over 1.0 in
        // linear light and the bloom pass picks it up — the whole reason this batch exists.
        const glyphColor = index <= state.checkpointIndex ? OCHRE : SEA_GREY;
        emissives.set(index, checkpoint.x, groundTopAt(checkpoint.x, state.time) + 1.05, 0.1, checkpointScale, checkpointScale, 1, [glyphColor[0] * 2.6, glyphColor[1] * 2.6, glyphColor[2] * 2.6], 0.18 + state.effects.checkpoint * 0.22, state.time * 0.16, index);
      }
      const deliveryScale = 1.45 + state.effects.delivery * 0.45;
      const deliveryColor = state.outcome === 'failed' ? VERMILION : OCHRE;
      emissives.set(3, DELIVERY_X, groundTopAt(DELIVERY_X, state.time) + 1.35, 0.1, deliveryScale, deliveryScale, 1, [deliveryColor[0] * 2.6, deliveryColor[1] * 2.6, deliveryColor[2] * 2.6], state.outcome === 'delivered' ? 0.68 : 0.2, state.time * 0.12, 4);
      const landScale = 0.55 + state.effects.land * 0.9;
      effects.set(4, state.player.x, supportTop + 0.08, 0.12, landScale, landScale, 1, CREAM, state.effects.land * 0.52, 0, 5);
      const jumpScale = 0.5 + state.effects.jump * 0.55;
      effects.set(5, state.player.x, state.player.y, 0.14, jumpScale, jumpScale, 1, ULTRAMARINE, state.effects.jump * 0.34, 0, 6);
      const collectible = COURSE_COLLECTIBLES[0]!;
      const collectibleScale = 0.72 + state.effects.collectible * 1.2;
      effects.set(6, collectible.x, collectible.y, 0.12, collectibleScale, collectibleScale, 1, OCHRE, state.effects.collectible * 0.72, state.time * 0.3, 7);
      const resetPulse = Math.max(state.effects.damage, state.effects.retry);
      const resetScale = 0.75 + resetPulse * 1.4;
      effects.set(7, state.player.x, state.player.y, 0.14, resetScale, resetScale, 1, state.effects.damage > state.effects.retry ? VERMILION : CREAM, resetPulse * 0.66, -state.time * 0.24, 8);
      effects.upload();
      emissives.upload();

      const cameraFrame = cameraRig.update(renderer.aspect, state, pointer, deltaSeconds);
      cameraPosition.set(cameraFrame.position);
      camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
      camera.lookAt(cameraFrame.target[0], cameraFrame.target[1], cameraFrame.target[2]);
      // Re-aim the shadow map at the slice the camera is showing. This is the per-frame half of the
      // camera-following design in `src/sun.ts`; everything else about the pass is fixed.
      const sun = createCourseSunShadow(cameraFrame.target[0]);
      for (const entry of catalogEntries) {
        for (const program of entry.depthPrograms) {
          program.uniforms.uLightViewProj!.set(sun.viewProjection);
          program.uniforms.uLightPosition!.set(sun.position);
          program.uniforms.uShadowRange!.set(sun.range);
        }
        for (const program of entry.programs) {
          const uniforms = program.uniforms as unknown as Record<string, { set(v: unknown): void }>;
          uniforms.uLightViewProj?.set(sun.viewProjection);
          uniforms.uLightPosition?.set(sun.position);
          uniforms.uShadowRange?.set(sun.range);
        }
      }
      const viewProjection = camera.viewProjection(renderer.aspect);

      // The HUD, in screen space.
      //
      // It used to be world-space cubes positioned against the camera target, so the whole readout
      // chased the camera through the level — the project's audit called it "a cluster of coloured
      // 3D boxes floating in the sky" that "reads as broken geometry". The layout below is the same
      // layout; only the space changed.
      //
      // World offsets map to normalised device coordinates through one scale, so every relative
      // position the design already had is preserved. Y is scaled harder than X because NDC is
      // square while the frame is 16:9, and a bar that looks right wide looks squat tall.
      hud.clear();
      const HUD_SCALE_X = 0.155;
      const HUD_SCALE_Y = 0.275;
      const HUD_ORIGIN_X = -0.6;
      const HUD_ORIGIN_Y = 0.83;
      let hudIndex = 0;
      const place = (
        offsetX: number, offsetY: number,
        halfWidth: number, halfHeight: number,
        color: readonly [number, number, number],
        opacity: number, rotation = 0,
      ): void => {
        hud.set(
          hudIndex++,
          HUD_ORIGIN_X + offsetX * HUD_SCALE_X,
          HUD_ORIGIN_Y + offsetY * HUD_SCALE_Y,
          halfWidth * HUD_SCALE_X,
          halfHeight * HUD_SCALE_Y,
          color, 1, opacity, rotation,
        );
      };

      // Goal 08: one plate behind the whole cluster, so the readouts sit on UI instead of
      // floating in the sky as coloured geometry — which is exactly how the capture read them.
      place(-0.05, -HUD_BAR_GAP * 1.1, HUD_BAR_HALF_WIDTH * 1.5, HUD_BAR_GAP * 2.4, INK, 0.38);
      place(0, 0, HUD_BAR_HALF_WIDTH, HUD_BAR_HALF_HEIGHT, INK, 0.72);
      const progressWidth = HUD_METER_HALF_WIDTH * state.progress;
      place(
        HUD_METER_CENTER_X_OFFSET - HUD_METER_HALF_WIDTH + progressWidth, 0,
        progressWidth, HUD_BAR_HALF_HEIGHT * 0.52, ULTRAMARINE, 0.95,
      );
      place(0, -HUD_BAR_GAP, HUD_BAR_HALF_WIDTH, HUD_BAR_HALF_HEIGHT, INK, 0.72);
      const stormWidth = HUD_METER_HALF_WIDTH * (1 - state.storm);
      place(
        HUD_METER_CENTER_X_OFFSET - HUD_METER_HALF_WIDTH + stormWidth, -HUD_BAR_GAP,
        stormWidth, HUD_BAR_HALF_HEIGHT * 0.52,
        state.remainingTime < 15 ? VERMILION : OCHRE, 0.95,
      );
      for (const cell of HUD_LABEL_CELLS.progress) {
        place(
          HUD_LABEL_CENTER_X_OFFSET + cell[0], cell[1],
          HUD_LABEL_CELL_HALF_WIDTH, HUD_LABEL_CELL_HALF_HEIGHT, CREAM, 0.9,
        );
      }
      for (const cell of HUD_LABEL_CELLS.storm) {
        place(
          HUD_LABEL_CENTER_X_OFFSET + cell[0], -HUD_BAR_GAP + cell[1],
          HUD_LABEL_CELL_HALF_WIDTH, HUD_LABEL_CELL_HALF_HEIGHT, CREAM, 0.9,
        );
      }
      const parcelY = -HUD_BAR_GAP * 2.05;
      // The parcel icon: a clay box with a vermilion cross taped over it.
      place(-0.88, parcelY, 0.31, 0.19, CLAY, 0.85);
      hud.set(hudIndex++, HUD_ORIGIN_X + -0.88 * HUD_SCALE_X, HUD_ORIGIN_Y + parcelY * HUD_SCALE_Y, 0.007, 0.05, VERMILION, 1, 0.9);
      hud.set(hudIndex++, HUD_ORIGIN_X + -0.88 * HUD_SCALE_X, HUD_ORIGIN_Y + parcelY * HUD_SCALE_Y, 0.05, 0.007, VERMILION, 1, 0.9);
      // Diamonds, so they need equal extents *in NDC* — not equal in the layout's own units, which
      // X and Y scale differently. Rotating an unequal rectangle by 45 degrees shears it into a
      // zigzag, which is what the first pass drew.
      for (let index = 0; index < 3; index += 1) {
        hud.set(
          hudIndex++,
          HUD_ORIGIN_X + (-0.31 + index * 0.36) * HUD_SCALE_X,
          HUD_ORIGIN_Y + parcelY * HUD_SCALE_Y,
          0.019, 0.019,
          index < state.parcelSeals ? VERMILION : SEA_GREY, 1, 0.9, Math.PI * 0.25,
        );
      }
      place(
        0.87, parcelY, 0.15, 0.27,
        state.controlMode === 'attract' ? OCHRE : state.controlMode === 'manual' ? ULTRAMARINE : SEA_GREY,
        0.9,
      );
      if (state.outcome !== 'running') {
        // Centred, not anchored to the HUD corner: an outcome is the frame's subject for the moment
        // it is up.
        const outcomeColor = state.outcome === 'delivered' ? OCHRE : VERMILION;
        hud.set(hudIndex++, 0, 0.12, 0.36, 0.028, outcomeColor, 1, 0.95);
        hud.set(
          hudIndex++, 0, 0.12, 0.028, 0.2, outcomeColor, 1, 0.95,
          state.outcome === 'delivered' ? 0 : Math.PI * 0.25,
        );
      }
      hud.upload();

      for (let index = 0; index < procedural.length; index += 1) procedural[index]!.setFrame(viewProjection, cameraPosition, state.time);
      skyProgram.uniforms.uViewProj.set(viewProjection);
      skyProgram.uniforms.uCameraPosition.set(cameraPosition);
      skyProgram.uniforms.uTime.set(state.time);
      for (let index = 0; index < catalogEntries.length; index += 1) catalogEntries[index]!.setFrame(viewProjection, cameraPosition, state.time);
      renderer.present(drawFrame);
    };

    return Object.freeze({
      measurements,
      render,
      dispose(): void {
        lifetime.dispose();
      },
    });
  } catch (cause: unknown) {
    return lifetime.rollback(cause);
  }
}
