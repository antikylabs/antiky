import {
  createCamera,
  createPlane,
  createProgram,
  createRenderTarget,
  loadTexture,
  mat4,
  type RenderTarget,
} from 'brometal';
import {
  FAR_DEPTH,
  WATER_LEVEL,
  buildTownWorld,
  samplePath,
  type TownWalker,
} from '../art/town';
import {
  SpriteBatch,
  billboardBasis,
  buildStandeeSideMesh,
  createStandeeFaceGeometry,
  loadSpriteSilhouetteAtlas,
  spriteAtlas,
  uploadSpriteBatch,
} from '../art/sprite-batch';
import {
  CharacterQueryWorld,
  KinematicCharacterMotor,
  StaticCharacterWorldAdapter,
  createHeightFieldGroundSampler,
} from '../physics';
import type { DemoFactory, DemoMode } from '../runtime';
import postShader from '../shaders/town-post.shader.gen';
import shadowShader from '../shaders/town-shadow.shader.gen';
import spriteShadowShader from '../shaders/town-sprite-shadow.shader.gen';
import spriteShader from '../shaders/town-sprite.shader.gen';
import voxelShader from '../shaders/town-voxel.shader.gen';
import waterShader from '../shaders/town-water.shader.gen';

const LIGHT_DIR = normalize3([0.75, 0.2, -0.64]);
const SUN_COLOR = [1, 0.55, 0.28] as const;
const SKY_COLOR = [0.24, 0.38, 0.68] as const;
const GROUND_COLOR = [0.56, 0.27, 0.15] as const;
const FOG_COLOR = [0.46, 0.36, 0.36] as const;
const SHADOW_CLEAR = [1, 1, 1, 1] as const;
const SCENE_CLEAR = [0.04, 0.05, 0.08, FAR_DEPTH] as const;
const HERO_SPEED = 3.8;
const STANDEE_THICKNESS = 0.1;
const NPC_COUNT = 4;
const NPC_WALKER_INDICES = [0, 2, 3, 4] as const;
const NPC_START_PROGRESS = [0.08, 0.38, 0.64, 0.82] as const;

type ActorState = {
  motor: KinematicCharacterMotor;
  walker?: TownWalker;
  progress: number;
  stride: number;
  tint: readonly [number, number, number];
  scale: number;
};

type ActorAtlasMetadata = {
  image: string;
  cell: { width: number; height: number };
  grid: { columns: number; rows: number };
  pivot: { x: number; y: number };
};

function normalize3(value: readonly [number, number, number]): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function cardinalTile(
  dx: number,
  dz: number,
  stride: number,
  moving: boolean,
  columns = 8,
): number {
  let row: number;
  if (Math.abs(dx) > Math.abs(dz)) row = dx < 0 ? 1 : 3;
  else row = dz < 0 ? 2 : 0;
  // Run frames advance at the authored cadence; idle frames breathe often
  // enough to remain visibly alive during the initial no-input presentation.
  const column = moving ? 2 + Math.floor(stride) % 6 : Math.floor(stride) % 2;
  return row * columns + column;
}

function cameraPose(mode: DemoMode, aspect: number) {
  const mobile = aspect < 1.05;
  if (mode === 'interactive') {
    return {
      mobile,
      fovY: mobile ? 0.9 : 0.62,
      offset: mobile ? [12, 9.5, 13] as const : [15, 10.5, 14] as const,
    };
  }
  return {
    mobile,
    fovY: mobile ? 0.82 : 0.59,
    position: mobile ? [30, 20, 36] as const : [22.5, 16.4, 28.5] as const,
    target: mobile ? [-2.5, 3, -1] as const : [-2.8, 3, -2] as const,
  };
}

const factory: DemoFactory = async ({ renderer, movement, mode, report }) => {
  const world = buildTownWorld();
  const shadowResolution = renderer.canvas.width < 700 ? 1024 : 2048;
  const shadowTarget = createRenderTarget(renderer, {
    width: shadowResolution,
    height: shadowResolution,
    depth: true,
  });
  const shadowTexel = [1 / shadowResolution, 1 / shadowResolution] as const;

  const lightTarget = [0, 4, -4] as const;
  const lightEye: [number, number, number] = [
    lightTarget[0] + LIGHT_DIR[0] * 102,
    lightTarget[1] + LIGHT_DIR[1] * 102,
    lightTarget[2] + LIGHT_DIR[2] * 102,
  ];
  const lightView = mat4.lookAt(lightEye, lightTarget);
  const lightProjection = mat4.orthographic(-54, 54, -50, 50, 0.5, 170);
  const lightViewProjection = mat4.multiply(lightProjection, lightView);

  const worldShadowProgram = createProgram(renderer, shadowShader);
  worldShadowProgram.attributes.aPosition.set(world.mesh.positions);
  worldShadowProgram.setIndices(world.mesh.indices);
  worldShadowProgram.uniforms.uLightViewProj.set(lightViewProjection);

  const worldProgram = createProgram(renderer, voxelShader);
  worldProgram.attributes.aPosition.set(world.mesh.positions);
  worldProgram.attributes.aNormal.set(world.mesh.normals);
  worldProgram.attributes.aBaseColor.set(world.mesh.baseColors);
  worldProgram.attributes.aMaterial.set(world.mesh.materials);
  worldProgram.attributes.aLocalAo.set(world.mesh.localAo);
  worldProgram.attributes.aEmissive.set(world.mesh.emissive);
  worldProgram.setIndices(world.mesh.indices);
  worldProgram.uniforms.uLightViewProj.set(lightViewProjection);
  worldProgram.uniforms.uLightDir.set(LIGHT_DIR);
  worldProgram.uniforms.uSunColor.set(SUN_COLOR);
  worldProgram.uniforms.uSunIntensity.set(2.65);
  worldProgram.uniforms.uSkyColor.set(SKY_COLOR);
  worldProgram.uniforms.uSkyIntensity.set(0.46);
  worldProgram.uniforms.uGroundColor.set(GROUND_COLOR);
  worldProgram.uniforms.uGroundIntensity.set(0.12);
  worldProgram.uniforms.uEmissiveIntensity.set(1.32);
  worldProgram.uniforms.uFogColor.set(FOG_COLOR);
  worldProgram.uniforms.uFogStart.set(45);
  worldProgram.uniforms.uFogEnd.set(110);
  worldProgram.uniforms.uFogStrength.set(0.22);
  worldProgram.uniforms.uShadowTexel.set(shadowTexel);
  worldProgram.uniforms.uShadowBias.set(0.00042);
  worldProgram.uniforms.uShadowSlopeBias.set(0.00125);
  worldProgram.uniforms.uShadowStrength.set(0.7);

  const waterProgram = createProgram(renderer, waterShader);
  const water = buildWaterGrid(world.waterBounds, 112, 16);
  waterProgram.attributes.aPosition.set(water.positions);
  waterProgram.setIndices(water.indices);
  waterProgram.uniforms.uLightViewProj.set(lightViewProjection);
  waterProgram.uniforms.uLightDir.set(LIGHT_DIR);
  waterProgram.uniforms.uSunColor.set(SUN_COLOR);
  waterProgram.uniforms.uSunIntensity.set(2.25);
  waterProgram.uniforms.uSkyColor.set([0.2, 0.34, 0.58]);
  waterProgram.uniforms.uDeepColor.set([0.018, 0.07, 0.09]);
  waterProgram.uniforms.uShallowColor.set([0.055, 0.22, 0.22]);
  waterProgram.uniforms.uRoughness.set(0.24);
  waterProgram.uniforms.uCrestStrength.set(0.3);
  waterProgram.uniforms.uFogColor.set(FOG_COLOR);
  waterProgram.uniforms.uFogStart.set(45);
  waterProgram.uniforms.uFogEnd.set(110);
  waterProgram.uniforms.uFogStrength.set(0.2);
  waterProgram.uniforms.uWaterLevel.set(WATER_LEVEL);
  waterProgram.uniforms.uShadowTexel.set(shadowTexel);
  waterProgram.uniforms.uShadowBias.set(0.00085);
  waterProgram.uniforms.uShadowStrength.set(0.64);

  const actorMetadataResponse = await fetch('/sprites/antiky-wayfarer-cardinal-atlas.json');
  if (!actorMetadataResponse.ok) {
    throw new Error(`Unable to load character atlas metadata (${actorMetadataResponse.status})`);
  }
  const actorMetadata = await actorMetadataResponse.json() as ActorAtlasMetadata;
  const actorImageUrl = `/sprites/${actorMetadata.image}`;
  const actorTexture = await loadTexture(renderer, actorImageUrl, {
    filter: 'nearest',
    wrap: 'clamp',
  });
  const actorSilhouettes = await loadSpriteSilhouetteAtlas(
    actorImageUrl,
    {
      cols: actorMetadata.grid.columns,
      rows: actorMetadata.grid.rows,
      tileWidth: actorMetadata.cell.width,
      tileHeight: actorMetadata.cell.height,
      pivotY: actorMetadata.pivot.y,
      cutoff: 0.48,
    },
  );
  const actorAtlas = spriteAtlas(actorTexture, {
    cols: actorMetadata.grid.columns,
    rows: actorMetadata.grid.rows,
    tileWidth: actorMetadata.cell.width,
    tileHeight: actorMetadata.cell.height,
  });
  const standee = createStandeeFaceGeometry({
    tileHeight: actorMetadata.cell.height,
    pivotY: actorMetadata.pivot.y,
  });

  const actorShadowProgram = createProgram(renderer, spriteShadowShader);
  actorShadowProgram.attributes.aPosition.set(standee.positions);
  actorShadowProgram.attributes.aUv.set(standee.uvs);
  actorShadowProgram.attributes.aShell.set(standee.shells);
  actorShadowProgram.setIndices(standee.doubleSidedIndices);
  actorShadowProgram.uniforms.uLightViewProj.set(lightViewProjection);
  actorShadowProgram.uniforms.uCutoff.set(0.48);
  actorShadowProgram.uniforms.uColorKey.set([1, 0, 1]);
  actorShadowProgram.uniforms.uUseColorKey.set(0);
  actorShadowProgram.uniforms.uStandeeThickness.set(STANDEE_THICKNESS);

  const actorProgram = createProgram(renderer, spriteShader);
  actorProgram.attributes.aPosition.set(standee.positions);
  actorProgram.attributes.aUv.set(standee.uvs);
  actorProgram.attributes.aShell.set(standee.shells);
  actorProgram.setIndices(standee.indices);
  actorProgram.uniforms.uLightViewProj.set(lightViewProjection);
  actorProgram.uniforms.uLightDir.set(LIGHT_DIR);
  actorProgram.uniforms.uCutoff.set(0.48);
  actorProgram.uniforms.uColorKey.set([1, 0, 1]);
  actorProgram.uniforms.uUseColorKey.set(0);
  actorProgram.uniforms.uStandeeThickness.set(STANDEE_THICKNESS);
  actorProgram.uniforms.uAmbientLight.set([0.38, 0.44, 0.6]);
  actorProgram.uniforms.uFrontLight.set([1.28, 0.72, 0.38]);
  actorProgram.uniforms.uBackLight.set([0.12, 0.15, 0.23]);
  actorProgram.uniforms.uSideLight.set([0.34, 0.36, 0.43]);
  actorProgram.uniforms.uFogColor.set(FOG_COLOR);
  actorProgram.uniforms.uFogStart.set(45);
  actorProgram.uniforms.uFogEnd.set(110);
  actorProgram.uniforms.uFogStrength.set(0.22);
  actorProgram.uniforms.uShadowTexel.set(shadowTexel);
  actorProgram.uniforms.uShadowBias.set(0.00055);
  actorProgram.uniforms.uShadowSlopeBias.set(0.0013);
  actorProgram.uniforms.uShadowStrength.set(0.72);

  // A second instance of the town surface shader draws only the extruded
  // alpha-contour walls. Its warm paper stock is real scene geometry: it has
  // material response, depth, shadow reception, and no front-facing halo.
  const actorEdgeProgram = createProgram(renderer, voxelShader);
  actorEdgeProgram.uniforms.uLightViewProj.set(lightViewProjection);
  actorEdgeProgram.uniforms.uLightDir.set(LIGHT_DIR);
  actorEdgeProgram.uniforms.uSunColor.set(SUN_COLOR);
  actorEdgeProgram.uniforms.uSunIntensity.set(2.65);
  actorEdgeProgram.uniforms.uSkyColor.set(SKY_COLOR);
  actorEdgeProgram.uniforms.uSkyIntensity.set(0.46);
  actorEdgeProgram.uniforms.uGroundColor.set(GROUND_COLOR);
  actorEdgeProgram.uniforms.uGroundIntensity.set(0.12);
  actorEdgeProgram.uniforms.uEmissiveIntensity.set(0);
  actorEdgeProgram.uniforms.uFogColor.set(FOG_COLOR);
  actorEdgeProgram.uniforms.uFogStart.set(45);
  actorEdgeProgram.uniforms.uFogEnd.set(110);
  actorEdgeProgram.uniforms.uFogStrength.set(0.22);
  actorEdgeProgram.uniforms.uShadowTexel.set(shadowTexel);
  actorEdgeProgram.uniforms.uShadowBias.set(0.00055);
  actorEdgeProgram.uniforms.uShadowSlopeBias.set(0.0013);
  actorEdgeProgram.uniforms.uShadowStrength.set(0.72);

  const fullscreen = createPlane({ width: 2, height: 2 });
  const postProgram = createProgram(renderer, postShader);
  postProgram.attributes.aPosition.set(fullscreen.positions);
  postProgram.setIndices(fullscreen.indices);
  postProgram.uniforms.uBloomRadius.set(1.35);
  postProgram.uniforms.uBloomThreshold.set(1.02);
  postProgram.uniforms.uBloomKnee.set(0.2);
  postProgram.uniforms.uBloomStrength.set(0.045);
  postProgram.uniforms.uBloomTint.set([1, 0.63, 0.34]);
  postProgram.uniforms.uExposure.set(1.02);
  postProgram.uniforms.uSaturation.set(1.07);
  postProgram.uniforms.uContrast.set(1.02);
  postProgram.uniforms.uGradeStrength.set(0.16);
  postProgram.uniforms.uShadowTint.set([0.88, 0.95, 1.08]);
  postProgram.uniforms.uHighlightTint.set([1.06, 0.96, 0.86]);
  postProgram.uniforms.uVignette.set(mode === 'ambient' ? 0.09 : 0.06);
  postProgram.uniforms.uAtmosphereColor.set([0.6, 0.32, 0.2]);
  postProgram.uniforms.uAtmosphereStart.set(46);
  postProgram.uniforms.uAtmosphereEnd.set(112);
  postProgram.uniforms.uAtmosphereStrength.set(0.16);
  postProgram.uniforms.uSkyZenith.set([0.045, 0.09, 0.21]);
  postProgram.uniforms.uSkyHorizon.set([0.9, 0.4, 0.2]);
  postProgram.uniforms.uSunColor.set([1.75, 0.83, 0.32]);
  postProgram.uniforms.uSunScreenPosition.set([0.82, 0.82]);
  postProgram.uniforms.uSunRadius.set(0.052);
  postProgram.uniforms.uFarDepth.set(FAR_DEPTH);

  const physicsWorld = new CharacterQueryWorld(
    new StaticCharacterWorldAdapter({
      colliders: world.physicsColliders,
      sampleGround: createHeightFieldGroundSampler({
        heightAt: (x, z) => world.canWalk(x, z) ? world.walkSurfaceHeight(x, z) : null,
        normalAt: (x, z) => {
          const normal = world.walkSurfaceNormal(x, z);
          return { x: normal[0], y: normal[1], z: normal[2] };
        },
      }),
    }),
  );
  const heroStart = world.spawn;
  const heroMotor = new KinematicCharacterMotor(
    physicsWorld,
    { x: heroStart[0], y: world.walkSurfaceHeight(heroStart[0], heroStart[1]), z: heroStart[1] },
    { maxSpeed: mode === 'interactive' ? HERO_SPEED : 2.05 },
  );
  const hero: ActorState = {
    motor: heroMotor,
    progress: 1 / world.heroPath.length,
    stride: 0,
    tint: [1.06, 1, 0.96],
    scale: mode === 'ambient' ? 2.96 : 3.1,
  };

  const npcTints = [
    [0.92, 0.98, 1.08],
    [1.07, 0.91, 0.83],
    [0.88, 1.02, 0.91],
    [1.03, 0.98, 0.84],
  ] as const;
  const npcs: ActorState[] = NPC_WALKER_INDICES.slice(0, NPC_COUNT).map((walkerIndex, index) => {
    const walker = world.walkers[walkerIndex]!;
    const progress = NPC_START_PROGRESS[index]!;
    const start = samplePath(walker.path, progress);
    const motor = new KinematicCharacterMotor(
      physicsWorld,
      { x: start.x, y: world.walkSurfaceHeight(start.x, start.z), z: start.z },
      { maxSpeed: 1.55 + index * 0.08 },
    );
    return {
      motor,
      walker,
      progress,
      stride: index * 1.7,
      tint: npcTints[index]!,
      scale: 2.68 + (index % 2) * 0.1,
    };
  });
  const actorBatch = new SpriteBatch(actorAtlas, 1 + npcs.length);

  const camera = createCamera({ fovY: 0.56, near: 0.32, far: FAR_DEPTH });
  const cameraPosition = new Float32Array(3);
  const billboardRight = new Float32Array(3);
  const billboardUp = new Float32Array(3);
  const texel = new Float32Array(2);
  let sceneTarget: RenderTarget | null = null;
  let previousTime: number | null = null;
  let simulationTime = 0;

  const ensureSceneTarget = (): RenderTarget => {
    const width = Math.max(1, renderer.canvas.width);
    const height = Math.max(1, renderer.canvas.height);
    if (!sceneTarget || sceneTarget.width !== width || sceneTarget.height !== height) {
      sceneTarget?.dispose();
      sceneTarget = createRenderTarget(renderer, { width, height, depth: true });
    }
    return sceneTarget;
  };

  /**
   * WebGL texture units are context-global rather than program-local. BroMetal's
   * sampler handles bind immediately, so a render target sampled by the prior
   * pass can otherwise still be bound when that same target becomes the next
   * framebuffer attachment. WebGPU bind groups do not need this guard.
   */
  const unbindWebglTextures = (): void => {
    const gl = renderer.gl;
    if (!gl) return;
    for (let unit = 0; unit < 4; unit += 1) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    gl.activeTexture(gl.TEXTURE0);
  };

  report({
    instances: 1 + npcs.length,
    drawCalls: 7,
    bytesPerFrame: (1 + npcs.length) * 16 * 4 * 2,
    note: `${world.mesh.stats.triangleCount.toLocaleString()} artifact-free town triangles; animated die-cut characters with contour depth`,
  });

  return {
    frame(time) {
      const lastTime = previousTime;
      const resetOrFirst = lastTime === null || time <= lastTime;
      const dt = resetOrFirst ? 1 / 60 : Math.min(time - lastTime, 0.05);
      previousTime = time;
      simulationTime += dt;

      let heroInputX = movement.x;
      let heroInputZ = movement.z;
      if (mode !== 'interactive') {
        hero.progress = (hero.progress + dt * 0.012) % 1;
        const target = samplePath(world.heroPath, hero.progress + 0.018);
        const dx = target.x - hero.motor.state.position.x;
        const dz = target.z - hero.motor.state.position.z;
        const length = Math.hypot(dx, dz);
        heroInputX = length > 0.05 ? dx / length : 0;
        heroInputZ = length > 0.05 ? dz / length : 0;
      }
      const heroResult = hero.motor.advance(dt, { x: heroInputX, z: heroInputZ });
      const heroSpeed = Math.hypot(hero.motor.state.velocity.x, hero.motor.state.velocity.z);
      hero.stride += dt * (heroSpeed > 0.08 ? 7.5 : 1.4);

      for (const npc of npcs) {
        const walker = npc.walker!;
        npc.progress = (npc.progress + dt * walker.speed) % 1;
        const target = samplePath(walker.path, npc.progress + 0.012);
        const dx = target.x - npc.motor.state.position.x;
        const dz = target.z - npc.motor.state.position.z;
        const length = Math.hypot(dx, dz);
        npc.motor.advance(dt, {
          x: length > 0.05 ? dx / length : 0,
          z: length > 0.05 ? dz / length : 0,
        });
        const speed = Math.hypot(npc.motor.state.velocity.x, npc.motor.state.velocity.z);
        npc.stride += dt * (speed > 0.08 ? 6.8 : 1.2);
      }

      const pose = cameraPose(mode, renderer.aspect);
      if (mode === 'interactive') {
        const offset = pose.offset!;
        const desiredX = hero.motor.state.position.x + offset[0];
        const desiredY = hero.motor.state.position.y + offset[1];
        const desiredZ = hero.motor.state.position.z + offset[2];
        if (cameraPosition[0] === 0 && cameraPosition[1] === 0 && cameraPosition[2] === 0) {
          cameraPosition.set([desiredX, desiredY, desiredZ]);
        } else {
          const easing = 1 - Math.exp(-4.5 * dt);
          cameraPosition[0] = cameraPosition[0]! + (desiredX - cameraPosition[0]!) * easing;
          cameraPosition[1] = cameraPosition[1]! + (desiredY - cameraPosition[1]!) * easing;
          cameraPosition[2] = cameraPosition[2]! + (desiredZ - cameraPosition[2]!) * easing;
        }
        camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
        camera.lookAt(
          hero.motor.state.position.x - (pose.mobile ? 4.5 : 3.4),
          hero.motor.state.position.y + (pose.mobile ? 2.5 : 2.15),
          hero.motor.state.position.z - (pose.mobile ? 6.5 : 5.5),
        );
      } else {
        cameraPosition.set(pose.position!);
        camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
        camera.lookAt(pose.target![0], pose.target![1], pose.target![2]);
      }
      camera.setLens({ fovY: pose.fovY, near: 0.32, far: FAR_DEPTH });
      const viewProjection = camera.viewProjection(renderer.aspect);
      billboardBasis(camera.view(), billboardRight, billboardUp, 0.32);

      actorBatch.clear();
      const heroFacing = hero.motor.state.facing;
      actorBatch.push({
        x: heroResult.renderPosition.x,
        y: heroResult.renderPosition.y,
        z: heroResult.renderPosition.z,
        width: pose.mobile ? 4.1 : hero.scale,
        height: pose.mobile ? 4.1 : hero.scale,
        tile: cardinalTile(
          heroFacing.x,
          heroFacing.z,
          hero.stride,
          heroSpeed > 0.08,
          actorMetadata.grid.columns,
        ),
        tint: hero.tint,
        facingX: heroFacing.x,
        facingZ: heroFacing.z,
      });
      for (const npc of npcs) {
        const root = npc.motor.state.position;
        const facing = npc.motor.state.facing;
        const speed = Math.hypot(npc.motor.state.velocity.x, npc.motor.state.velocity.z);
        actorBatch.push({
          x: root.x,
          y: root.y,
          z: root.z,
          width: npc.scale,
          height: npc.scale,
          tile: cardinalTile(
            facing.x,
            facing.z,
            npc.stride,
            speed > 0.08,
            actorMetadata.grid.columns,
          ),
          tint: npc.tint,
          facingX: facing.x,
          facingZ: facing.z,
        });
      }
      const actorSides = buildStandeeSideMesh(
        actorBatch,
        actorSilhouettes,
        billboardRight,
        billboardUp,
        STANDEE_THICKNESS,
      );
      if (actorSides.indices.length > 0) {
        actorEdgeProgram.attributes.aPosition.set(actorSides.positions);
        actorEdgeProgram.attributes.aNormal.set(actorSides.normals);
        actorEdgeProgram.attributes.aBaseColor.set(actorSides.baseColors);
        actorEdgeProgram.attributes.aMaterial.set(actorSides.materials);
        actorEdgeProgram.attributes.aLocalAo.set(actorSides.localAo);
        actorEdgeProgram.attributes.aEmissive.set(actorSides.emissive);
        actorEdgeProgram.setIndices(actorSides.indices);
      }
      const shadowActorCount = uploadSpriteBatch(actorShadowProgram, actorBatch);
      const visibleActorCount = uploadSpriteBatch(actorProgram, actorBatch);

      actorShadowProgram.uniforms.uRight.set(billboardRight);
      actorShadowProgram.uniforms.uUp.set(billboardUp);
      unbindWebglTextures();
      renderer.drawTo(
        shadowTarget,
        () => {
          worldShadowProgram.draw();
          if (shadowActorCount > 0) {
            actorShadowProgram.uniforms.uAtlas.set(actorTexture);
            actorShadowProgram.draw({ instanceCount: shadowActorCount });
          }
        },
        { clear: SHADOW_CLEAR },
      );

      const scene = ensureSceneTarget();
      unbindWebglTextures();
      renderer.drawTo(
        scene,
        () => {
          worldProgram.uniforms.uViewProj.set(viewProjection);
          worldProgram.uniforms.uCamPos.set(cameraPosition);
          worldProgram.uniforms.uShadowMap.set(shadowTarget.texture);
          worldProgram.draw();

          waterProgram.uniforms.uViewProj.set(viewProjection);
          waterProgram.uniforms.uCamPos.set(cameraPosition);
          waterProgram.uniforms.uTime.set(simulationTime);
          waterProgram.uniforms.uShadowMap.set(shadowTarget.texture);
          waterProgram.draw();

          if (actorSides.indices.length > 0) {
            actorEdgeProgram.uniforms.uViewProj.set(viewProjection);
            actorEdgeProgram.uniforms.uCamPos.set(cameraPosition);
            actorEdgeProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            actorEdgeProgram.draw();
          }

          if (visibleActorCount > 0) {
            actorProgram.uniforms.uViewProj.set(viewProjection);
            actorProgram.uniforms.uRight.set(billboardRight);
            actorProgram.uniforms.uUp.set(billboardUp);
            actorProgram.uniforms.uCamPos.set(cameraPosition);
            actorProgram.uniforms.uAtlas.set(actorTexture);
            actorProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            actorProgram.draw({ instanceCount: visibleActorCount });
          }
        },
        { clear: SCENE_CLEAR },
      );

      texel[0] = 1 / scene.width;
      texel[1] = 1 / scene.height;
      const focusDistance = Math.hypot(
        cameraPosition[0]! - hero.motor.state.position.x,
        cameraPosition[1]! - (hero.motor.state.position.y + 1.05),
        cameraPosition[2]! - hero.motor.state.position.z,
      );
      const mobile = pose.mobile;
      postProgram.uniforms.uScene.set(scene.texture);
      postProgram.uniforms.uTexel.set(texel);
      postProgram.uniforms.uFocus.set(focusDistance);
      postProgram.uniforms.uNearFocusRange.set(mode === 'ambient' ? 20 : 12);
      postProgram.uniforms.uFarFocusRange.set(mode === 'ambient' ? 26 : 18);
      postProgram.uniforms.uDofTransition.set(7);
      postProgram.uniforms.uDofMaxRadius.set(mobile ? 0 : mode === 'ambient' ? 0.8 : 0);
      postProgram.uniforms.uDofStrength.set(mobile ? 0 : mode === 'ambient' ? 0.18 : 0);
      postProgram.uniforms.uDepthReject.set(3);
      postProgram.draw();
    },

    dispose() {
      sceneTarget?.dispose();
      shadowTarget.dispose();
      postProgram.dispose();
      actorEdgeProgram.dispose();
      actorProgram.dispose();
      actorShadowProgram.dispose();
      waterProgram.dispose();
      worldProgram.dispose();
      worldShadowProgram.dispose();
      actorTexture.dispose();
    },
  };
};

function buildWaterGrid(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  segmentsX: number,
  segmentsZ: number,
): { positions: Float32Array; indices: Uint16Array } {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let z = 0; z <= segmentsZ; z += 1) {
    const pz = bounds.minZ + (bounds.maxZ - bounds.minZ) * (z / segmentsZ);
    for (let x = 0; x <= segmentsX; x += 1) {
      const px = bounds.minX + (bounds.maxX - bounds.minX) * (x / segmentsX);
      positions.push(px, 0, pz);
    }
  }
  const stride = segmentsX + 1;
  for (let z = 0; z < segmentsZ; z += 1) {
    for (let x = 0; x < segmentsX; x += 1) {
      const a = z * stride + x;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

export default factory;
