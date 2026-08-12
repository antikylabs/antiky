import {
  createCamera,
  createCone,
  createPlane,
  createProgram,
  createSphere,
  createTorus,
  loadTexture,
  mat4,
  type Renderer,
} from 'brometal';
import type { GamePointerInput } from '@antiky/framework/game';

import { createRelayFrameScratch, setCameraPosition } from './frame-scratch.ts';
import { relayOnboardingOpacity } from './onboarding-cues.ts';
import { FLOOR_SKY, SURFACE_SKY } from './ambient.ts';
import { loadDetailNormal } from './detail-normal.ts';
import { createRelayOnboardingOverlay } from './onboarding.ts';
import { RELAY_PRESENTATION } from './presentation.ts';
import {
  createContactShadowBatch,
  createGlowBatch,
  createSurfaceBatch,
  horizontalGeometry,
} from './render-batches.ts';
import { RELAY_RENDER_PROFILE } from './render-profile.ts';
import { createResourceScope } from './resource-lifetime.ts';
import { populateRelayVisuals } from './relay-visuals.ts';
import { setupReliquaryModels } from './reliquary-model-layout.ts';
import {
  createReliquaryModelBatch,
  createRockModelBatch,
  createStumpModelBatch,
} from './reliquary-models.ts';
import { createShadeGeometry } from './shade-geometry.ts';
import type { RelaySnapshot } from './simulation.ts';
import floorShader from './shaders/reliquary-floor.shader.gen';
import FLOOR_AO_URL from 'virtual:blackout-relay/forest-floor-ao';
import FLOOR_DIFFUSE_URL from 'virtual:blackout-relay/forest-floor-diffuse';
import FLOOR_ROUGHNESS_URL from 'virtual:blackout-relay/forest-floor-roughness';

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

export async function createRelayRenderer(
  renderer: Renderer,
  lights: readonly PresentationLight[],
): Promise<RelayRenderer> {
  const resources = createResourceScope();
  try {
    const diffuseTexture = resources.register(await loadTexture(renderer, FLOOR_DIFFUSE_URL, {
      filter: 'smooth', wrap: 'repeat', anisotropy: 8,
    }));
    const aoTexture = resources.register(await loadTexture(renderer, FLOOR_AO_URL, {
      filter: 'smooth', wrap: 'repeat', anisotropy: 8,
    }));
    const roughnessTexture = resources.register(await loadTexture(renderer, FLOOR_ROUGHNESS_URL, {
      filter: 'smooth', wrap: 'repeat', anisotropy: 8,
    }));

  const floorGeometry = createPlane({
    width: 18,
    height: 12.8,
    widthSegments: 24,
    heightSegments: 18,
  });
  // Loaded once and shared by the floor and every prop batch. The reliquary has five programs that
  // want it, and five uploads of the same 512x512 image is four wasted.
  const detailNormal = resources.register(await loadDetailNormal(renderer));
  const floorProgram = resources.register(createProgram(renderer, floorShader));
  floorProgram.attributes.aPosition.set(floorGeometry.positions);
  floorProgram.attributes.aUv.set(floorGeometry.uvs);
  floorProgram.setIndices(floorGeometry.indices);
  floorProgram.uniforms.uDiffuse.set(diffuseTexture);
  floorProgram.uniforms.uAo.set(aoTexture);
  floorProgram.uniforms.uRoughness.set(roughnessTexture);
  floorProgram.uniforms.uDetailNormal.set(detailNormal);
  const onboarding = resources.register(createRelayOnboardingOverlay(renderer));

  const forms = resources.register(createSurfaceBatch(
    renderer,
    createCone({ radius: 1, height: 2, radialSegments: 5 }),
    RELAY_RENDER_PROFILE.capacities.forms,
    detailNormal,
  ));
  const creatures = resources.register(createSurfaceBatch(
    renderer,
    createShadeGeometry(),
    RELAY_RENDER_PROFILE.capacities.creatures,
    detailNormal,
  ));
  const contacts = resources.register(createContactShadowBatch(
    renderer,
    RELAY_RENDER_PROFILE.capacities.contacts,
  ));
  const orbs = resources.register(createSurfaceBatch(
    renderer,
    createSphere({ radius: 1, widthSegments: 24, heightSegments: 16 }),
    RELAY_RENDER_PROFILE.capacities.orbs,
    detailNormal,
  ));
  const rings = resources.register(createSurfaceBatch(
    renderer,
    horizontalGeometry(createTorus({
      radius: 1,
      tube: 0.035,
      radialSegments: 8,
      tubularSegments: 72,
    })),
    RELAY_RENDER_PROFILE.capacities.rings,
    detailNormal,
  ));
  const glows = resources.register(createGlowBatch(
    renderer,
    createSphere({ radius: 1, widthSegments: 12, heightSegments: 8 }),
    RELAY_RENDER_PROFILE.capacities.glows,
  ));
  const organic = resources.register(await createReliquaryModelBatch(
    renderer,
    RELAY_RENDER_PROFILE.capacities.organic,
  ));
  const rocks = resources.register(await createRockModelBatch(
    renderer,
    RELAY_RENDER_PROFILE.capacities.rocks,
  ));
  const stumps = resources.register(await createStumpModelBatch(
    renderer,
    RELAY_RENDER_PROFILE.capacities.stumps,
  ));
  setupReliquaryModels(organic, rocks, stumps);

  const surfaceBatches = [forms, creatures, orbs, rings] as const;
  for (let index = 0; index < surfaceBatches.length; index += 1) {
    const batch = surfaceBatches[index]!;
    batch.program.uniforms.uSh0.set(SURFACE_SKY[0]!);
    batch.program.uniforms.uSh1.set(SURFACE_SKY[1]!);
    batch.program.uniforms.uSh2.set(SURFACE_SKY[2]!);
    batch.program.uniforms.uSh3.set(SURFACE_SKY[3]!);
    batch.program.uniforms.uSh4.set(SURFACE_SKY[4]!);
    batch.program.uniforms.uSh5.set(SURFACE_SKY[5]!);
    batch.program.uniforms.uSh6.set(SURFACE_SKY[6]!);
    batch.program.uniforms.uSh7.set(SURFACE_SKY[7]!);
    batch.program.uniforms.uSh8.set(SURFACE_SKY[8]!);
    batch.program.uniforms.uAmbientStrength.set(RELAY_PRESENTATION.surfaceAmbient.strength);
    batch.program.uniforms.uExposure.set(RELAY_PRESENTATION.exposure);
    batch.program.uniforms.uRelayLightStrength.set(RELAY_PRESENTATION.relayLightStrength);
    batch.program.uniforms.uFogColor.set(RELAY_PRESENTATION.fog.color);
    batch.program.uniforms.uFogStart.set(RELAY_PRESENTATION.fog.start);
    batch.program.uniforms.uFogEnd.set(RELAY_PRESENTATION.fog.end);
    batch.program.uniforms.uFogMaximumMix.set(RELAY_PRESENTATION.fog.maximumMix);
  }
  const modelBatches = [organic, rocks, stumps] as const;
  for (let index = 0; index < modelBatches.length; index += 1) {
    const batch = modelBatches[index]!;
    batch.program.uniforms.uSh0!.set(SURFACE_SKY[0]!);
    batch.program.uniforms.uSh1!.set(SURFACE_SKY[1]!);
    batch.program.uniforms.uSh2!.set(SURFACE_SKY[2]!);
    batch.program.uniforms.uSh3!.set(SURFACE_SKY[3]!);
    batch.program.uniforms.uSh4!.set(SURFACE_SKY[4]!);
    batch.program.uniforms.uSh5!.set(SURFACE_SKY[5]!);
    batch.program.uniforms.uSh6!.set(SURFACE_SKY[6]!);
    batch.program.uniforms.uSh7!.set(SURFACE_SKY[7]!);
    batch.program.uniforms.uSh8!.set(SURFACE_SKY[8]!);
    batch.program.uniforms.uAmbientStrength!.set(RELAY_PRESENTATION.catalogMaterial.ambientStrength);
    batch.program.uniforms.uExposure!.set(RELAY_PRESENTATION.exposure);
    batch.program.uniforms.uRelayLightStrength!.set(RELAY_PRESENTATION.relayLightStrength);
    batch.program.uniforms.uFogColor!.set(RELAY_PRESENTATION.fog.color);
    batch.program.uniforms.uFogStart!.set(RELAY_PRESENTATION.fog.start);
    batch.program.uniforms.uFogEnd!.set(RELAY_PRESENTATION.fog.end);
    batch.program.uniforms.uFogMaximumMix!.set(RELAY_PRESENTATION.fog.maximumMix);
    batch.program.uniforms.uDiffuseLift!.set(RELAY_PRESENTATION.catalogMaterial.diffuseLift);
    batch.program.uniforms.uTextureContrast!.set(RELAY_PRESENTATION.catalogMaterial.textureContrast);
    batch.program.uniforms.uSaturation!.set(RELAY_PRESENTATION.catalogMaterial.saturation);
  }
  floorProgram.uniforms.uDiffuseTint.set(RELAY_PRESENTATION.floorDiffuseTint);
  floorProgram.uniforms.uTextureContrast.set(RELAY_PRESENTATION.floorTextureContrast);
  // Nine coefficients instead of one colour. BroMetal's DSL has no array uniform type, so they are
  // nine separate bindings rather than one — verbose at the call site, but the shader side is a
  // straight nine multiply-adds with no indexing.
  // Written out rather than looped: the uniform record is a typed literal, so an index built from a
  // template string is not a key TypeScript can check. Nine lines that the compiler verifies beat a
  // loop that needs a cast to compile.

  floorProgram.uniforms.uSh0.set(FLOOR_SKY[0]!);
  floorProgram.uniforms.uSh1.set(FLOOR_SKY[1]!);
  floorProgram.uniforms.uSh2.set(FLOOR_SKY[2]!);
  floorProgram.uniforms.uSh3.set(FLOOR_SKY[3]!);
  floorProgram.uniforms.uSh4.set(FLOOR_SKY[4]!);
  floorProgram.uniforms.uSh5.set(FLOOR_SKY[5]!);
  floorProgram.uniforms.uSh6.set(FLOOR_SKY[6]!);
  floorProgram.uniforms.uSh7.set(FLOOR_SKY[7]!);
  floorProgram.uniforms.uSh8.set(FLOOR_SKY[8]!);
  floorProgram.uniforms.uAmbientStrength.set(RELAY_PRESENTATION.floorAmbient.strength);
  floorProgram.uniforms.uExposure.set(RELAY_PRESENTATION.exposure);
  floorProgram.uniforms.uRelayLightStrength.set(RELAY_PRESENTATION.relayLightStrength);
  floorProgram.uniforms.uFogColor.set(RELAY_PRESENTATION.fog.color);
  floorProgram.uniforms.uFogStart.set(RELAY_PRESENTATION.fog.start);
  floorProgram.uniforms.uFogEnd.set(RELAY_PRESENTATION.fog.end);
  floorProgram.uniforms.uFogMaximumMix.set(RELAY_PRESENTATION.fog.maximumMix);
  const frameScratch = createRelayFrameScratch();
  const cameraPosition = frameScratch.cameraPosition;
  const camera = createCamera({
    position: RELAY_PRESENTATION.camera.position,
    fovY: RELAY_PRESENTATION.camera.fovY,
    // near 0.1 against far 45 was 450:1, already inside the 500:1 budget but wasteful: this is a
    // fixed overhead camera and nothing reaches within a metre of it. 0.15 gives 300:1.
    near: 0.15,
    far: 45,
  });
  const setLights = (
    powers: readonly [number, number, number],
    program: (typeof surfaceBatches)[number]['program'] | typeof organic.program,
  ): void => {
    program.uniforms.uEmberPosition!.set(lights[0]!.transform.position);
    program.uniforms.uEmberColor!.set(lights[0]!.pointLight.color);
    program.uniforms.uEmberPower!.set(powers[0]);
    program.uniforms.uEmberRadius!.set(lights[0]!.pointLight.radius);
    program.uniforms.uIonPosition!.set(lights[1]!.transform.position);
    program.uniforms.uIonColor!.set(lights[1]!.pointLight.color);
    program.uniforms.uIonPower!.set(powers[1]);
    program.uniforms.uIonRadius!.set(lights[1]!.pointLight.radius);
    program.uniforms.uVioletPosition!.set(lights[2]!.transform.position);
    program.uniforms.uVioletColor!.set(lights[2]!.pointLight.color);
    program.uniforms.uVioletPower!.set(powers[2]);
    program.uniforms.uVioletRadius!.set(lights[2]!.pointLight.radius);
  };

  const visualBatches = Object.freeze({ forms, creatures, contacts, orbs, rings, glows });
  const hasDeposit = (state: RelaySnapshot): boolean => {
    for (let index = 0; index < state.deposits.length; index += 1) {
      if (state.deposits[index]) return true;
    }
    return false;
  };
  const drawFrame = (): void => {
    floorProgram.draw();
    organic.draw();
    rocks.draw();
    stumps.draw();
    rings.draw();
    forms.draw();
    creatures.draw();
    orbs.draw();
    // Blended, so it runs once every opaque surface has written depth. Before glows, so a light
    // reads as sitting on top of the shadow rather than under it.
    contacts.draw();
    glows.draw();
    onboarding.draw();
    onboarding.drawStatus();
  };

  const render = (
    state: RelaySnapshot,
    powers: readonly [number, number, number],
    pointer: GamePointerInput,
  ): void => {
    populateRelayVisuals(visualBatches, state, powers);
    void pointer;
    const dangerTrauma = Math.max(
      0,
      state.dangerPulse - RELAY_PRESENTATION.camera.dangerShakeThreshold,
    );
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
    const viewProjection = camera.viewProjection(renderer.aspect);

    for (let index = 0; index < surfaceBatches.length; index += 1) {
      const batch = surfaceBatches[index]!;
      batch.program.uniforms.uViewProj.set(viewProjection);
      batch.program.uniforms.uCameraPosition.set(cameraPosition);
      batch.program.uniforms.uTime.set(state.time);
      setLights(powers, batch.program);
    }
    for (let index = 0; index < modelBatches.length; index += 1) {
      const batch = modelBatches[index]!;
      batch.program.uniforms.uViewProj!.set(viewProjection);
      batch.program.uniforms.uCameraPosition!.set(cameraPosition);
      batch.program.uniforms.uTime!.set(state.time);
      setLights(powers, batch.program);
    }
    floorProgram.uniforms.uViewProj.set(viewProjection);
    floorProgram.uniforms.uCameraPosition.set(cameraPosition);
    floorProgram.uniforms.uEmberPosition.set(lights[0]!.transform.position);
    floorProgram.uniforms.uEmberColor.set(lights[0]!.pointLight.color);
    floorProgram.uniforms.uEmberPower.set(powers[0]);
    floorProgram.uniforms.uEmberRadius.set(lights[0]!.pointLight.radius);
    floorProgram.uniforms.uIonPosition.set(lights[1]!.transform.position);
    floorProgram.uniforms.uIonColor.set(lights[1]!.pointLight.color);
    floorProgram.uniforms.uIonPower.set(powers[1]);
    floorProgram.uniforms.uIonRadius.set(lights[1]!.pointLight.radius);
    floorProgram.uniforms.uVioletPosition.set(lights[2]!.transform.position);
    floorProgram.uniforms.uVioletColor.set(lights[2]!.pointLight.color);
    floorProgram.uniforms.uVioletPower.set(powers[2]);
    floorProgram.uniforms.uVioletRadius.set(lights[2]!.pointLight.radius);
    contacts.program.uniforms.uViewProj.set(viewProjection);
    glows.program.uniforms.uViewProj.set(viewProjection);
    glows.program.uniforms.uCameraPosition.set(cameraPosition);
    glows.program.uniforms.uTime.set(state.time);
    onboarding.setOpacity(relayOnboardingOpacity(
      state.time,
      hasDeposit(state),
      state.status,
    ));
    onboarding.setStatus(state.status, state.time);

    renderer.present(drawFrame);
  };

  return Object.freeze({
    measurements: Object.freeze({
      ...RELAY_RENDER_PROFILE.measurements,
      note: 'rock-and-stump shrine massing with authoritative ring fields and presentation-only material lighting',
    }),
    render,
    dispose(): void {
      resources.dispose();
    },
  });
  } catch (cause: unknown) {
    resources.rollback();
    throw cause;
  }
}
