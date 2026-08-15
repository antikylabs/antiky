import { createCamera, createCone, createPlane, createSphere, type Renderer } from 'brometal';
import type { GamePointerInput } from '@antiky/framework/game';
import type { RenderFrame, TargetRequest, UniformValue } from '@antiky/framework';
import {
  createBroMetalRenderDriver,
  type PipelineDefinition,
  type TextureSource,
} from '@antiky/framework/render-driver';

import { FLOOR_SKY, SURFACE_SKY } from './ambient.ts';
import { DETAIL_NORMAL_TEXTURE } from './detail-normal.ts';
import { createRelayFrameScratch, setCameraPosition } from './frame-scratch.ts';
import { relayOnboardingOpacity } from './onboarding-cues.ts';
import { createRelayOnboardingOverlay } from './onboarding.ts';
import { RELAY_PRESENTATION } from './presentation.ts';
import { populateRelayVisuals } from './relay-visuals.ts';
import {
  createContactShadowBatch,
  createGlowBatch,
  createRingBatch,
  createSurfaceBatch,
} from './render-batches.ts';
import { RELAY_RENDER_PROFILE } from './render-profile.ts';
import { setupReliquaryModels } from './reliquary-model-layout.ts';
import {
  createReliquaryModelBatch,
  createRockModelBatch,
  createStumpModelBatch,
} from './reliquary-models.ts';
import { createShadeGeometry } from './shade-geometry.ts';
import {
  NOTHING_OCCLUDING,
  SHADOW_CASTER_UNIFORMS,
  SHADOW_RECEIVER_UNIFORMS,
  SHADOW_TARGET,
} from './shadow-pass.ts';
import type { RelaySnapshot } from './simulation.ts';
import { VFX_BILLBOARD_TEXTURE } from './vfx-billboard.ts';
import bloomBlurShader from './shaders/bloom-blur.shader.gen.ts';
import bloomExtractShader from './shaders/bloom-extract.shader.gen.ts';
import nightBackdropShader from './shaders/night-backdrop.shader.gen.ts';
import postShader from './shaders/post.shader.gen.ts';
import floorShader from './shaders/reliquary-floor.shader.gen.ts';
import FLOOR_AO_URL from 'virtual:blackout-relay/forest-floor-ao';
import FLOOR_DIFFUSE_URL from 'virtual:blackout-relay/forest-floor-diffuse';
import FLOOR_ROUGHNESS_URL from 'virtual:blackout-relay/forest-floor-roughness';
import SECOND_GROUND_URL from 'virtual:blackout-relay/second-ground';

/**
 * `RELAY_PRESENTATION.clearColor` expressed in linear light.
 *
 * The authored value is a display colour. It enters an RGBA16F target and leaves through exposure,
 * ACES and the sRGB encode, so it has to be the linear value that comes back out as the authored
 * one. Solved numerically against that exact chain, which is why these are not simply
 * `decodeSrgb(clearColor)`.
 */
const LINEAR_CLEAR = Object.freeze([0.006355, 0.009128, 0.008313, 1] as const);

/**
 * `RELAY_PRESENTATION.fog.color` expressed in pre-exposure scene light.
 *
 * Materials write linear light into the target and the post pass exposes all of it at once, so
 * mixing the authored value unchanged would expose the fog too. Fog dominates the darks and the
 * sRGB encode has an enormous slope there: left unconverted it moved dark pixels from 25 to 89.
 */
const LINEAR_FOG_COLOR: readonly [number, number, number] = Object.freeze([
  RELAY_PRESENTATION.fog.color[0] / RELAY_PRESENTATION.exposure,
  RELAY_PRESENTATION.fog.color[1] / RELAY_PRESENTATION.exposure,
  RELAY_PRESENTATION.fog.color[2] / RELAY_PRESENTATION.exposure,
]);

type PresentationLight = Readonly<{
  transform: Readonly<{ position: readonly [number, number, number] }>;
  pointLight: Readonly<{ color: readonly [number, number, number]; radius: number }>;
}>;

export type RelayRenderer = Readonly<{
  measurements: Readonly<{
    instances: number;
    drawCalls: number;
    uploadBytesPerFrame: number;
    note: string;
  }>;
  render(
    state: RelaySnapshot,
    powers: readonly [number, number, number],
    pointer: GamePointerInput,
  ): void;
  dispose(): void;
}>;

/** The nine spherical-harmonic bands, as uniform names the shaders declare one at a time. */
function skyUniforms(sky: readonly (readonly number[])[]): Record<string, UniformValue> {
  const uniforms: Record<string, UniformValue> = {};
  for (let band = 0; band < 9; band += 1) uniforms[`uSh${band}`] = sky[band]!;
  return uniforms;
}

/** Fog and relay strength, identical on every lit material. */
const ATMOSPHERE: Readonly<Record<string, UniformValue>> = Object.freeze({
  uRelayLightStrength: RELAY_PRESENTATION.relayLightStrength,
  uFogColor: LINEAR_FOG_COLOR,
  uFogStart: RELAY_PRESENTATION.fog.start,
  uFogEnd: RELAY_PRESENTATION.fog.end,
  uFogMaximumMix: RELAY_PRESENTATION.fog.maximumMix,
});

export async function createRelayRenderer(
  renderer: Renderer,
  lights: readonly PresentationLight[],
): Promise<RelayRenderer> {
  /**
   * Where each relay stands, what colour it burns and how far it reaches.
   *
   * None of it varies: the light service's only mutators are `submitPointLightPower` and
   * `correctPointLightPower`, and `lights` is the record set captured once here. Only the three
   * powers are written per frame.
   */
  const relayUniforms: Record<string, UniformValue> = {};
  for (const [index, name] of ['uEmber', 'uIon', 'uViolet'].entries()) {
    const light = lights[index]!;
    relayUniforms[`${name}Position`] = light.transform.position;
    relayUniforms[`${name}Color`] = light.pointLight.color;
    relayUniforms[`${name}Radius`] = light.pointLight.radius;
  }

  const floorGeometry = createPlane({ width: 18, height: 12.8, widthSegments: 24, heightSegments: 18 });
  // Inside the camera's 45-unit far plane — at 60 the whole dome clipped and the void stayed black.
  const dome = createSphere({ radius: 40, widthSegments: 24, heightSegments: 16 });
  // Seen from inside, and this renderer culls back faces: reversing the index order flips every
  // triangle's winding so the sphere's inside is its front.
  dome.indices.reverse();

  const capacities = RELAY_RENDER_PROFILE.capacities;
  const forms = createSurfaceBatch(createCone({ radius: 1, height: 2, radialSegments: 5 }), capacities.forms);
  const creatures = createSurfaceBatch(createShadeGeometry(), capacities.creatures);
  const orbs = createSurfaceBatch(createSphere({ radius: 1, widthSegments: 24, heightSegments: 16 }), capacities.orbs);
  const contacts = createContactShadowBatch(capacities.contacts, 'vfx-billboard');
  // Goal 08: the rings left the lit path. They are gameplay glyphs, not geometry, so each is a soft
  // additive band rather than a torus the key light and fog act on.
  const rings = createRingBatch(capacities.rings);
  const glows = createGlowBatch(createSphere({ radius: 1, widthSegments: 12, heightSegments: 8 }), capacities.glows);
  const organic = await createReliquaryModelBatch(capacities.organic);
  const rocks = await createRockModelBatch(capacities.rocks);
  const stumps = await createStumpModelBatch(capacities.stumps);
  setupReliquaryModels(organic, rocks, stumps);
  const onboarding = createRelayOnboardingOverlay();

  const surfaceStatic = { ...skyUniforms(SURFACE_SKY), uAmbientStrength: RELAY_PRESENTATION.surfaceAmbient.strength, ...ATMOSPHERE, ...relayUniforms };
  const catalogStatic = { ...skyUniforms(SURFACE_SKY), uAmbientStrength: RELAY_PRESENTATION.catalogMaterial.ambientStrength, ...ATMOSPHERE, ...relayUniforms };
  const floorStatic = {
    ...skyUniforms(FLOOR_SKY),
    uAmbientStrength: RELAY_PRESENTATION.floorAmbient.strength,
    uDiffuseTint: RELAY_PRESENTATION.floorDiffuseTint,
    ...ATMOSPHERE,
    ...relayUniforms,
  };

  /** Applies the values that never change once, when the driver builds the program. */
  const staticSetup = (values: Readonly<Record<string, UniformValue>>) => (
    (program: { uniforms: Record<string, { set(value: unknown): void } | undefined> }): void => {
      for (const [name, value] of Object.entries(values)) program.uniforms[name]?.set(value);
    }
  );

  const fullscreen = createPlane({ width: 2, height: 2 });
  const quad = (program: {
    attributes: Record<string, { set(value: unknown): void } | undefined>;
    setIndices(indices: unknown): void;
  }): void => {
    program.attributes.aPosition?.set(fullscreen.positions);
    program.setIndices(fullscreen.indices);
  };

  const driver = createBroMetalRenderDriver({
    renderer,
    textures: {
      'detail-normal': DETAIL_NORMAL_TEXTURE,
      'vfx-billboard': VFX_BILLBOARD_TEXTURE,
      'floor-diffuse': { url: FLOOR_DIFFUSE_URL, options: { filter: 'smooth', wrap: 'repeat', anisotropy: 8 } },
      'floor-ao': { url: FLOOR_AO_URL, options: { filter: 'smooth', wrap: 'repeat', anisotropy: 8 } },
      'floor-roughness': { url: FLOOR_ROUGHNESS_URL, options: { filter: 'smooth', wrap: 'repeat', anisotropy: 8 } },
      // The second ground layer, blended over the first by a world-space mask.
      'second-ground': { url: SECOND_GROUND_URL, options: { filter: 'smooth', wrap: 'repeat', anisotropy: 8 } },
      ...organic.textures,
      ...rocks.textures,
      ...stumps.textures,
      ...onboarding.textures,
    } as Record<string, TextureSource>,
    pipelines: {
      floor: {
        shader: floorShader,
        setup(program) {
          program.attributes.aPosition?.set(floorGeometry.positions);
          program.attributes.aUv?.set(floorGeometry.uvs);
          program.setIndices(floorGeometry.indices);
          staticSetup(floorStatic)(program);
        },
      },
      backdrop: {
        shader: nightBackdropShader,
        setup(program) {
          program.attributes.aPosition?.set(dome.positions);
          program.setIndices(dome.indices);
        },
      },
      'bloom-extract': { shader: bloomExtractShader, setup: quad },
      'bloom-blur': { shader: bloomBlurShader, setup: quad },
      // `blend: 'alpha'` on a pass that blends nothing, because in BroMetal that is the only way to
      // ask for "do not write depth". The post quad sits at clip z = 0 and covers the canvas, so
      // with depth writing on it stamps 0 into every depth texel and the overlay then vanishes.
      post: { shader: postShader, options: { blend: 'alpha' }, setup: quad },
      onboarding: onboarding.pipeline,
      'onboarding-status': onboarding.statusPipeline,
      ...surfacePipelines('forms', forms, surfaceStatic),
      ...surfacePipelines('creatures', creatures, surfaceStatic),
      ...surfacePipelines('orbs', orbs, surfaceStatic),
      ...catalogPipelines('organic', organic, catalogStatic),
      ...catalogPipelines('rocks', rocks, catalogStatic),
      ...catalogPipelines('stumps', stumps, catalogStatic),
      contacts: contacts.pipeline,
      rings: rings.pipeline,
      glows: glows.pipeline,
    } as Record<string, PipelineDefinition>,
  });
  await driver.loadTextures();

  const TARGETS: readonly TargetRequest[] = Object.freeze([
    SHADOW_TARGET,
    // `samples: 4` because the canvas is, and an off-screen target is not by default — moving the
    // scene into one silently took its anti-aliasing away. `filter: 'linear'` because the bloom
    // extract downsamples it 4x.
    { key: 'scene', scale: 1, depth: true, samples: 4 },
    { key: 'bloom-a', scale: 0.25 },
    { key: 'bloom-b', scale: 0.25 },
  ]);

  const frameScratch = createRelayFrameScratch();
  const cameraPosition = frameScratch.cameraPosition;
  const camera = createCamera({
    position: RELAY_PRESENTATION.camera.position,
    fovY: RELAY_PRESENTATION.camera.fovY,
    // near 0.1 against far 45 was 450:1, already inside the 500:1 budget but wasteful for a fixed
    // overhead camera nothing reaches within a metre of. 0.15 gives 300:1.
    near: 0.15,
    far: 45,
  });

  const visualBatches = Object.freeze({ forms, creatures, contacts, orbs, rings, glows });
  const hasDeposit = (state: RelaySnapshot): boolean => {
    for (let index = 0; index < state.deposits.length; index += 1) {
      if (state.deposits[index]) return true;
    }
    return false;
  };

  const render = (
    state: RelaySnapshot,
    powers: readonly [number, number, number],
    pointer: GamePointerInput,
  ): void => {
    populateRelayVisuals(visualBatches, state, powers);
    void pointer;
    const dangerTrauma = Math.max(0, state.dangerPulse - RELAY_PRESENTATION.camera.dangerShakeThreshold);
    const shake = Math.min(RELAY_PRESENTATION.camera.maximumShake, dangerTrauma * 0.08);
    const cameraX = RELAY_PRESENTATION.camera.position[0] + Math.sin(state.time * 24) * shake;
    const cameraY = RELAY_PRESENTATION.camera.position[1];
    const cameraZ = RELAY_PRESENTATION.camera.position[2] + Math.cos(state.time * 21) * shake;
    setCameraPosition(frameScratch, cameraX, cameraY, cameraZ);
    camera.setPosition(cameraX, cameraY, cameraZ);
    camera.lookAt(
      RELAY_PRESENTATION.camera.target[0],
      RELAY_PRESENTATION.camera.target[1],
      RELAY_PRESENTATION.camera.target[2],
    );
    const viewProjection = Array.from(camera.viewProjection(renderer.aspect));
    const eye = Array.from(cameraPosition);

    /** What every lit material needs each frame, on top of what it was built with. */
    const perFrame: Record<string, UniformValue> = {
      uViewProj: viewProjection,
      uCameraPosition: eye,
      uTime: state.time,
      uEmberPower: powers[0],
      uIonPower: powers[1],
      uVioletPower: powers[2],
      ...SHADOW_RECEIVER_UNIFORMS,
    };

    const litDraw = (pipeline: string, batch: { instanceData: Record<string, Float32Array> }, extra?: Record<string, UniformValue>) => ({
      pipeline,
      uniforms: extra === undefined ? perFrame : { ...perFrame, ...extra },
      instanceData: batch.instanceData,
    });
    const casterDraw = (pipeline: string, batch: { depthInstanceData: Record<string, Float32Array> }) => ({
      pipeline,
      uniforms: SHADOW_CASTER_UNIFORMS,
      instanceData: batch.depthInstanceData,
    });

    const frame: RenderFrame = {
      passes: [
        // Before the scene, because the scene reads what this writes. The blended passes are absent:
        // a sprite of a glow casting a hard shadow is exactly wrong.
        {
          target: 'shadow',
          clear: NOTHING_OCCLUDING,
          draws: [
            casterDraw('organic-depth', organic),
            casterDraw('rocks-depth', rocks),
            casterDraw('stumps-depth', stumps),
            casterDraw('forms-depth', forms),
            casterDraw('creatures-depth', creatures),
            casterDraw('orbs-depth', orbs),
          ],
        },
        {
          target: 'scene',
          // Cleared to the scene's background, not to transparent black. Missing this turned 34% of
          // the frame — everything outside the floor — from the authored void colour to pure black.
          clear: LINEAR_CLEAR,
          draws: [
            { pipeline: 'backdrop', uniforms: { uViewProj: viewProjection, uCameraPosition: eye, uTime: state.time } },
            {
              pipeline: 'floor',
              // The floor's five maps are set here rather than in `setup`, because a pipeline is
              // built before `loadTextures` has run and there is nothing to point at yet.
              uniforms: {
                ...perFrame,
                uDiffuse: { texture: 'floor-diffuse' },
                uSecondGround: { texture: 'second-ground' },
                uAo: { texture: 'floor-ao' },
                uRoughness: { texture: 'floor-roughness' },
                uDetailNormal: { texture: 'detail-normal' },
              },
            },
            litDraw('organic', organic, organic.uniforms as Record<string, UniformValue>),
            litDraw('rocks', rocks, rocks.uniforms as Record<string, UniformValue>),
            litDraw('stumps', stumps, stumps.uniforms as Record<string, UniformValue>),
            litDraw('forms', forms, { uDetailNormal: { texture: 'detail-normal' } }),
            litDraw('creatures', creatures, { uDetailNormal: { texture: 'detail-normal' } }),
            litDraw('orbs', orbs, { uDetailNormal: { texture: 'detail-normal' } }),
            // Blended, so they run once every opaque surface has written depth. The rings sit
            // between the contact shadows and the glows: under the shadows would dim them, over the
            // glows would double them.
            { pipeline: 'contacts', uniforms: { uViewProj: viewProjection, uBillboard: { texture: 'vfx-billboard' } }, instanceData: contacts.instanceData },
            { pipeline: 'rings', uniforms: { uViewProj: viewProjection, uTime: state.time, uBillboard: { texture: 'vfx-billboard' } }, instanceData: rings.instanceData },
            { pipeline: 'glows', uniforms: { uViewProj: viewProjection, uCameraPosition: eye, uTime: state.time, uBillboard: { texture: 'vfx-billboard' } }, instanceData: glows.instanceData },
          ],
        },
        // Extract, blur across, blur down. Three quarter-resolution passes over a scene already
        // drawn, so nothing here touches the geometry again. The step is in uv and comes from the
        // bloom target's size, not the canvas's — radius/3 because the blur's outermost tap sits at
        // three steps, and a whole-radius step printed bright singles as a lattice of boxes.
        {
          target: 'bloom-a',
          draws: [{
            pipeline: 'bloom-extract',
            uniforms: {
              uScene: { target: 'scene' },
              uThreshold: RELAY_PRESENTATION.bloom.threshold,
              uTexel: [4 / Math.max(1, renderer.canvas.width), 4 / Math.max(1, renderer.canvas.height)],
            },
          }],
        },
        {
          target: 'bloom-b',
          draws: [{
            pipeline: 'bloom-blur',
            uniforms: {
              uSource: { target: 'bloom-a' },
              uDirection: [RELAY_PRESENTATION.bloom.radius / 3 / Math.max(1, renderer.canvas.width / 4), 0],
            },
          }],
        },
        {
          target: 'bloom-a',
          draws: [{
            pipeline: 'bloom-blur',
            uniforms: {
              uSource: { target: 'bloom-b' },
              uDirection: [0, RELAY_PRESENTATION.bloom.radius / 3 / Math.max(1, renderer.canvas.height / 4)],
            },
          }],
        },
        {
          draws: [
            {
              pipeline: 'post',
              uniforms: {
                uScene: { target: 'scene' },
                uBloom: { target: 'bloom-a' },
                uBloomStrength: RELAY_PRESENTATION.bloom.strength,
                uExposure: RELAY_PRESENTATION.exposure,
              },
            },
            // After the post pass, on purpose. The overlay is authored display-space UI; inside the
            // target it would be exposed and tone-mapped along with the scene.
            {
              pipeline: 'onboarding',
              uniforms: {
                uAtlas: { texture: 'onboarding-legend' },
                ...onboarding.uniforms(relayOnboardingOpacity(state.time, hasDeposit(state), state.status)),
              },
            },
            {
              pipeline: 'onboarding-status',
              uniforms: (onboarding.statusUniforms(state.status, state.time) ?? {}) as Record<string, UniformValue>,
            },
          ],
        },
      ],
    };

    renderer.present(() => {
      // Inside the present callback, matching where the original created its targets. Note this
      // was *not* the cause of the runtime fault — moving it changed nothing — so do not spend a
      // second session on it.
      driver.configureTargets(TARGETS);
      driver.submit(frame);
    });
  };

  return Object.freeze({
    measurements: Object.freeze({
      ...RELAY_RENDER_PROFILE.measurements,
      note: 'rock-and-stump shrine massing with authoritative ring fields and presentation-only material lighting',
    }),
    render,
    dispose(): void {
      driver.dispose();
    },
  });
}

/** A lit batch and its shadow caster, as two keyed pipelines. */
function surfacePipelines(
  key: string,
  batch: { pipeline: PipelineDefinition; depthPipeline: PipelineDefinition },
  statics: Readonly<Record<string, UniformValue>>,
): Record<string, PipelineDefinition> {
  return {
    [key]: {
      ...batch.pipeline,
      setup(program) {
        batch.pipeline.setup?.(program);
        for (const [name, value] of Object.entries(statics)) program.uniforms[name]?.set(value);
      },
    },
    [`${key}-depth`]: batch.depthPipeline,
  };
}

function catalogPipelines(
  key: string,
  batch: { pipeline: PipelineDefinition; depthPipeline: PipelineDefinition },
  statics: Readonly<Record<string, UniformValue>>,
): Record<string, PipelineDefinition> {
  return surfacePipelines(key, batch, statics);
}
