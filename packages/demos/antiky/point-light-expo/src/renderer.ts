import {
  createCamera,
  createCone,
  createPlane,
  createProgram,
  createRenderTarget,
  createSphere,
  loadTexture,
  mat4,
  type RenderTarget,
  type Renderer,
} from 'brometal';
import type { GamePointerInput } from '@antiky/framework/game';

import { createRelayFrameScratch, setCameraPosition } from './frame-scratch.ts';
import { relayOnboardingOpacity } from './onboarding-cues.ts';
import { FLOOR_SKY, SURFACE_SKY } from './ambient.ts';
import { loadDetailNormal } from './detail-normal.ts';
import { loadVfxBillboard } from './vfx-billboard.ts';
import { createRelayOnboardingOverlay } from './onboarding.ts';
import { RELAY_PRESENTATION } from './presentation.ts';
import bloomBlurShader from './shaders/bloom-blur.shader.gen.ts';
import bloomExtractShader from './shaders/bloom-extract.shader.gen.ts';
import postShader from './shaders/post.shader.gen.ts';
import nightBackdropShader from './shaders/night-backdrop.shader.gen.ts';

/**
 * `RELAY_PRESENTATION.clearColor` expressed in linear light.
 *
 * The authored value is a display colour: before 06-02 it was written straight to the screen and
 * never passed through a shader. Now it enters an RGBA16F target and leaves through exposure, ACES
 * and the sRGB encode, so it has to be the linear value that comes back out as the authored one.
 * Solved numerically against that exact chain at the demo's exposure, which is why these are not
 * simply `decodeSrgb(clearColor)`.
 */
const LINEAR_CLEAR = Object.freeze([0.006355, 0.009128, 0.008313, 1] as const);

/**
 * `RELAY_PRESENTATION.fog.color` expressed in pre-exposure scene light.
 *
 * The same boundary problem as the clear colour. Before 06-02 each material mixed fog in *after*
 * applying exposure, so the authored value was a post-exposure quantity. Now materials write linear
 * light into the target and the post pass exposes all of it at once, so mixing the authored value
 * unchanged would expose the fog too — brightening it by the exposure factor.
 *
 * That matters far more than it sounds. Fog dominates the darks, and the sRGB encode has an enormous
 * slope there: a 0.005 linear shift near black is about 20/255 on screen. Left unconverted it moved
 * dark pixels from 25 to 89.
 */
const LINEAR_FOG_COLOR: readonly [number, number, number] = Object.freeze([
  RELAY_PRESENTATION.fog.color[0] / RELAY_PRESENTATION.exposure,
  RELAY_PRESENTATION.fog.color[1] / RELAY_PRESENTATION.exposure,
  RELAY_PRESENTATION.fog.color[2] / RELAY_PRESENTATION.exposure,
]);
import {
  createContactShadowBatch,
  createGlowBatch,
  createRingBatch,
  createSurfaceBatch,
} from './render-batches.ts';
import { RELAY_RENDER_PROFILE } from './render-profile.ts';
import { createResourceScope } from './resource-lifetime.ts';
import { bindDepthProgram, createShadowPass } from './shadow-pass.ts';
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
import SECOND_GROUND_URL from 'virtual:blackout-relay/second-ground';

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
    // The second ground layer, blended over the first by a world-space mask.
    const secondGroundTexture = resources.register(await loadTexture(renderer, SECOND_GROUND_URL, {
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
  // One sprite for every glow: it is the demo's effect texture, not a per-effect material.
  const vfxBillboard = resources.register(await loadVfxBillboard(renderer));
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
    vfxBillboard,
  ));
  const orbs = resources.register(createSurfaceBatch(
    renderer,
    createSphere({ radius: 1, widthSegments: 24, heightSegments: 16 }),
    RELAY_RENDER_PROFILE.capacities.orbs,
    detailNormal,
  ));
  // Goal 08: the rings left the lit path. They were `tube: 0.035` tori with eight radial
  // segments — countable polygons in the capture — drawn through the surface shader, so the key
  // light and fog acted on what is really a gameplay glyph. Each is now a soft additive band.
  const rings = resources.register(createRingBatch(
    renderer,
    RELAY_RENDER_PROFILE.capacities.rings,
    vfxBillboard,
  ));
  const glows = resources.register(createGlowBatch(
    renderer,
    createSphere({ radius: 1, widthSegments: 12, heightSegments: 8 }),
    RELAY_RENDER_PROFILE.capacities.glows,
    vfxBillboard,
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

  // The night horizon: a dome at infinity behind everything, so the ground plane's edge fades
  // into haze instead of cutting against void. Same at-infinity construction as the arena's sky.
  const backdropProgram = resources.register(createProgram(renderer, nightBackdropShader));
  {
    const dome = createSphere({ radius: 60, widthSegments: 24, heightSegments: 16 });
    backdropProgram.attributes.aPosition.set(dome.positions);
    backdropProgram.setIndices(dome.indices);
  }

  // Created before the uniform binding below, because every material program is pointed at its map
  // once at setup rather than rebound each frame.
  const shadows = resources.register(createShadowPass(renderer));
  const surfaceBatches = [forms, creatures, orbs] as const;
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
    batch.program.uniforms.uRelayLightStrength.set(RELAY_PRESENTATION.relayLightStrength);
    batch.program.uniforms.uFogColor.set(LINEAR_FOG_COLOR);
    batch.program.uniforms.uFogStart.set(RELAY_PRESENTATION.fog.start);
    batch.program.uniforms.uFogEnd.set(RELAY_PRESENTATION.fog.end);
    batch.program.uniforms.uFogMaximumMix.set(RELAY_PRESENTATION.fog.maximumMix);
    shadows.bind(batch.program as never);
    bindDepthProgram(batch.depthProgram as never);
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
    batch.program.uniforms.uRelayLightStrength!.set(RELAY_PRESENTATION.relayLightStrength);
    batch.program.uniforms.uFogColor!.set(LINEAR_FOG_COLOR);
    batch.program.uniforms.uFogStart!.set(RELAY_PRESENTATION.fog.start);
    batch.program.uniforms.uFogEnd!.set(RELAY_PRESENTATION.fog.end);
    batch.program.uniforms.uFogMaximumMix!.set(RELAY_PRESENTATION.fog.maximumMix);
    shadows.bind(batch.program as never);
    bindDepthProgram(batch.depthProgram as never);
  }
  floorProgram.uniforms.uDiffuseTint.set(RELAY_PRESENTATION.floorDiffuseTint);
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
  floorProgram.uniforms.uRelayLightStrength.set(RELAY_PRESENTATION.relayLightStrength);
  floorProgram.uniforms.uFogColor.set(LINEAR_FOG_COLOR);
  floorProgram.uniforms.uFogStart.set(RELAY_PRESENTATION.fog.start);
  floorProgram.uniforms.uFogEnd.set(RELAY_PRESENTATION.fog.end);
  floorProgram.uniforms.uFogMaximumMix.set(RELAY_PRESENTATION.fog.maximumMix);
  // The floor is the demo's largest shadow receiver and casts nothing itself.
  shadows.bind(floorProgram as never);
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
  // One RGBA16F target for the whole scene, and one pass that turns it into an image.
  //
  // BroMetal fixes every offscreen target to `rgba16float`, so there is no format to choose — a
  // `drawTo` target is already 16-bit float. `depth: true` because the scene is depth-sorted
  // geometry, not a single quad.
  //
  // The target is rebuilt only when the canvas size changes; reallocating every frame would throw
  // away the drawing buffer sixty times a second for nothing.
  let sceneTarget: RenderTarget | undefined;
  const ensureSceneTarget = (): RenderTarget => {
    const width = Math.max(1, renderer.canvas.width);
    const height = Math.max(1, renderer.canvas.height);
    if (!sceneTarget || sceneTarget.width !== width || sceneTarget.height !== height) {
      sceneTarget?.dispose();
      // `samples: 4` because the canvas is 4x multisampled and the target is not by default.
      // Moving the scene off the screen and into a target silently took its anti-aliasing away:
      // hard luminance steps went from 6,356 to 9,449 before this was set. The target texture
      // stays single-sampled and receives the resolve, so the post pass samples it unchanged.
      //
      // The resolve now happens in linear light, before the tone-map, rather than in display space
      // after it. That is the order an HDR target exists to provide, and it is why a few thousand
      // pixels on the highest-contrast edges still differ from the pre-06-02 frame.
      sceneTarget = createRenderTarget(renderer, { width, height, depth: true, samples: 4 });
    }
    return sceneTarget;
  };
  // `blend: 'alpha'` on a pass that is not blending anything, because in BroMetal that is the only
  // way to ask for "do not write depth": the pipeline sets `depthWriteEnabled: blend === 'none'`
  // and `depthCompare: 'less'` with no separate knob. The post quad sits at clip z = 0 and covers
  // the canvas, so with depth writing on it stamps 0 into every depth texel — and the onboarding
  // overlay, also at z = 0, then fails `0 < 0` and vanishes. That is what happened: the panel was
  // missing from the first 06-02 capture and accounted for 2.74 of the 3.26/255 drift.
  //
  // The blend is a true no-op here: the fragment writes alpha 1, so `src * srcAlpha + dst * (1 -
  // srcAlpha)` is exactly `src`. Nothing has drawn to the canvas before it, and the canvas depth
  // clears to 1 each frame, so both this quad and the overlay pass the test.
  /**
   * Two quarter-resolution targets, ping-ponged by the blur.
   *
   * Quarter resolution because a blur is the one pass where resolution buys nothing: the output is
   * low-frequency by definition, and a quarter-size chain costs a sixteenth of the samples. Two of
   * them because a separable blur cannot read and write the same texture — across into one, down
   * into the other.
   *
   * `filter: 'linear'` is goal 02's `render-target-filtering` patch and is hard-blocking here. On a
   * point sampler the taps between texels snap back onto texel centres, and the chain produces
   * blocky glow that crawls whenever the camera moves.
   */
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
  const fullscreenQuad = createPlane({ width: 2, height: 2 });
  const bloomExtract = resources.register(createProgram(renderer, bloomExtractShader));
  bloomExtract.attributes.aPosition.set(fullscreenQuad.positions);
  bloomExtract.setIndices(fullscreenQuad.indices);
  const bloomBlur = resources.register(createProgram(renderer, bloomBlurShader));
  bloomBlur.attributes.aPosition.set(fullscreenQuad.positions);
  bloomBlur.setIndices(fullscreenQuad.indices);

  const postProgram = resources.register(createProgram(renderer, postShader, { blend: 'alpha' }));
  postProgram.attributes.aPosition.set(createPlane({ width: 2, height: 2 }).positions);
  postProgram.setIndices(createPlane({ width: 2, height: 2 }).indices);

  // Everything that blocks the sun. The floor is absent on purpose — it is the receiver, and a flat
  // plane facing the light writes a depth its own lookup then has to bias its way back out of.
  //
  // The blended passes are absent too. `contacts` and `glows` are billboards standing in for light,
  // not solid geometry, and a sprite of a glow casting a hard shadow is exactly wrong.
  const drawCasters = (): void => {
    organic.drawDepth();
    rocks.drawDepth();
    stumps.drawDepth();
    forms.drawDepth();
    creatures.drawDepth();
    orbs.drawDepth();
  };

  const drawScene = (): void => {
    backdropProgram.draw();
    floorProgram.draw();
    organic.draw();
    rocks.draw();
    stumps.draw();
    forms.draw();
    creatures.draw();
    orbs.draw();
    // Blended, so it runs once every opaque surface has written depth. Before glows, so a light
    // reads as sitting on top of the shadow rather than under it. The rings are additive glyphs
    // and sit between: under the contact shadows would dim them, over the glows would double them.
    contacts.draw();
    rings.draw();
    glows.draw();
  };

  const drawFrame = (): void => {
    // Before the scene, because the scene reads what this writes. `drawTo` finishes and submits its
    // own encoder, so the two passes are ordered by the queue rather than by hope.
    shadows.render(drawCasters);
    const scene = ensureSceneTarget();
    // The target must be cleared to the scene's background, not to `drawTo`'s default of
    // transparent black. Missing this turned 34% of the frame — everything outside the floor — from
    // the authored void colour to pure black, which was most of this step's measured drift.
    //
    // The value is linear because the target is: the post pass exposes, tone-maps and encodes it
    // along with everything else, so it has to enter the pipeline in the same space as the geometry.
    renderer.drawTo(scene, drawScene, { clear: LINEAR_CLEAR });

    // Extract, blur across, blur down. Three quarter-resolution passes over a scene that is already
    // drawn, so nothing here touches the geometry again.
    const [bloomA, bloomB] = ensureBloomTargets();
    bloomExtract.uniforms.uScene.set(scene.texture);
    bloomExtract.uniforms.uThreshold.set(RELAY_PRESENTATION.bloom.threshold);
    renderer.drawTo(bloomA, () => bloomExtract.draw());
    // The step is in uv, so it has to come from the bloom target's size and not the canvas's.
    const acrossStep = RELAY_PRESENTATION.bloom.radius / bloomA.width;
    const downStep = RELAY_PRESENTATION.bloom.radius / bloomA.height;
    bloomBlur.uniforms.uSource.set(bloomA.texture);
    bloomBlur.uniforms.uDirection.set([acrossStep, 0]);
    renderer.drawTo(bloomB, () => bloomBlur.draw());
    bloomBlur.uniforms.uSource.set(bloomB.texture);
    bloomBlur.uniforms.uDirection.set([0, downStep]);
    renderer.drawTo(bloomA, () => bloomBlur.draw());

    postProgram.uniforms.uScene.set(scene.texture);
    postProgram.uniforms.uBloom.set(bloomA.texture);
    postProgram.uniforms.uBloomStrength.set(RELAY_PRESENTATION.bloom.strength);
    postProgram.uniforms.uExposure.set(RELAY_PRESENTATION.exposure);
    postProgram.draw();

    // Drawn after the post pass, on purpose, and this is the ambiguity goal 06-02 asks to settle.
    //
    // The overlay is authored display-space UI. Inside the target it would be exposed and
    // tone-mapped along with the scene, which would change text that was picked to be legible
    // exactly as authored. Outside it, the identity holds — which is what UI wants and what it
    // already did before this step.
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
    rings.frame(viewProjection, state.time);
    backdropProgram.uniforms.uViewProj.set(viewProjection);
    backdropProgram.uniforms.uCameraPosition.set(cameraPosition);
    backdropProgram.uniforms.uTime.set(state.time);
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
