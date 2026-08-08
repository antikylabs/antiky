import {
  createCamera,
  createCube,
  createCylinder,
  createProgram,
  createRenderer,
  createSphere,
  createTorusKnot,
  mat4,
  type Geometry,
  type Renderer,
} from 'brometal';
import {
  createGameInspectionSnapshot,
  type GameInspectionPort,
  type GameModuleEntry,
} from '@antiky/framework/game';
import { inspectPointLightService } from '@antiky/framework';
import foundryGlowShader from './shaders/foundry-glow.shader.gen';
import foundryShader from './shaders/foundry.shader.gen';
import { EXPO_LIGHT_IDS, createExpoLightService } from './lights.ts';

type Vec3 = readonly [number, number, number];

type SurfaceInstance = Readonly<{
  offset: Vec3;
  scale: Vec3;
  color: Vec3;
  material: Vec3;
}>;

function surfaceBuffers(instances: readonly SurfaceInstance[]) {
  const offsets = new Float32Array(instances.length * 3);
  const scales = new Float32Array(instances.length * 3);
  const colors = new Float32Array(instances.length * 3);
  const materials = new Float32Array(instances.length * 3);
  instances.forEach((instance, index) => {
    offsets.set(instance.offset, index * 3);
    scales.set(instance.scale, index * 3);
    colors.set(instance.color, index * 3);
    materials.set(instance.material, index * 3);
  });
  return { offsets, scales, colors, materials };
}

function createSurfaceProgram(
  renderer: Renderer,
  geometry: Geometry,
  instances: readonly SurfaceInstance[],
) {
  const program = createProgram(renderer, foundryShader);
  const buffers = surfaceBuffers(instances);
  program.attributes.aPosition.set(geometry.positions);
  program.attributes.aNormal.set(geometry.normals);
  program.setIndices(geometry.indices);
  program.instanceAttributes.iOffset.set(buffers.offsets);
  program.instanceAttributes.iScale.set(buffers.scales);
  program.instanceAttributes.iBaseColor.set(buffers.colors);
  program.instanceAttributes.iMaterial.set(buffers.materials);
  return program;
}

const game: GameModuleEntry = async (context) => {
  const renderer = await createRenderer(context.canvas, {
    clearColor: [0.004, 0.006, 0.015, 1],
    cull: 'back',
  });
  const service = createExpoLightService(context.runtimeInstanceId);
  const lightRecords = EXPO_LIGHT_IDS.map((entityId) => {
    const record = service.getPointLight(entityId);
    if (record === undefined) throw new Error(`Point Light Expo is missing ${entityId}.`);
    return record;
  });
  const powers = new Float32Array(lightRecords.map((record) => record.pointLight.power));

  const cubeProgram = createSurfaceProgram(renderer, createCube(), [
    {
      offset: [0, -1.35, 0],
      scale: [8, 0.2, 5],
      color: [0.055, 0.07, 0.11],
      material: [0.22, 0.86, 0],
    },
    {
      offset: [0, 2.4, -4.3],
      scale: [8, 3.8, 0.16],
      color: [0.035, 0.048, 0.085],
      material: [0.34, 0.72, 0],
    },
    {
      offset: [0, 4.55, -1.2],
      scale: [6.8, 0.12, 0.22],
      color: [0.11, 0.14, 0.19],
      material: [0.18, 0.9, 0],
    },
    {
      offset: [0, -0.62, -2.9],
      scale: [7.1, 0.08, 0.12],
      color: [0.18, 0.22, 0.3],
      material: [0.16, 0.94, 0.02],
    },
  ]);
  const pedestalProgram = createSurfaceProgram(
    renderer,
    createCylinder({ radiusTop: 1, radiusBottom: 1.16, height: 1, radialSegments: 48 }),
    [-3.4, 0, 3.4].map((x) => ({
      offset: [x, -0.82, 0] as Vec3,
      scale: [1.2, 0.7, 1.2] as Vec3,
      color: [0.08, 0.095, 0.13] as Vec3,
      material: [0.24, 0.88, 0] as Vec3,
    })),
  );
  const sphereProgram = createSurfaceProgram(
    renderer,
    createSphere({ radius: 1, widthSegments: 48, heightSegments: 32 }),
    [
      {
        offset: [-3.4, 0.46, 0],
        scale: [0.86, 1.08, 0.86],
        color: [0.42, 0.5, 0.62],
        material: [0.11, 0.96, 0],
      },
      {
        offset: [3.4, 0.46, 0],
        scale: [0.86, 1.08, 0.86],
        color: [0.46, 0.42, 0.6],
        material: [0.13, 0.94, 0],
      },
      ...lightRecords.map((record) => ({
        offset: record.transform.position as Vec3,
        scale: [0.16, 0.16, 0.16] as Vec3,
        color: record.pointLight.color as Vec3,
        material: [0.16, 0.24, 2.4] as Vec3,
      })),
    ],
  );
  const knotProgram = createSurfaceProgram(
    renderer,
    createTorusKnot({
      radius: 1.05,
      tube: 0.25,
      tubularSegments: 180,
      radialSegments: 24,
      p: 2,
      q: 5,
    }),
    [{
      offset: [0, 0.72, -0.15],
      scale: [1, 1, 1],
      color: [0.5, 0.58, 0.7],
      material: [0.09, 0.98, 0.02],
    }],
  );
  const surfacePrograms = [cubeProgram, pedestalProgram, sphereProgram, knotProgram];

  const glowGeometry = createSphere({ radius: 1, widthSegments: 36, heightSegments: 24 });
  const glowProgram = createProgram(renderer, foundryGlowShader, { blend: 'additive' });
  glowProgram.attributes.aPosition.set(glowGeometry.positions);
  glowProgram.attributes.aNormal.set(glowGeometry.normals);
  glowProgram.setIndices(glowGeometry.indices);
  const glowOffsets = new Float32Array(lightRecords.length * 3);
  const glowScales = new Float32Array(lightRecords.length);
  const glowColors = new Float32Array(lightRecords.length * 3);
  lightRecords.forEach((record, index) => {
    glowOffsets.set(record.transform.position, index * 3);
    glowScales[index] = 0.52;
    glowColors.set(record.pointLight.color, index * 3);
  });
  glowProgram.instanceAttributes.iOffset.set(glowOffsets);
  glowProgram.instanceAttributes.iScale.set(glowScales);
  glowProgram.instanceAttributes.iColor.set(glowColors);

  const cameraPosition = new Float32Array([0, 3.1, 11.2]);
  const camera = createCamera({ position: [0, 3.1, 11.2], fovY: Math.PI / 3.8, near: 0.1, far: 40 });
  camera.lookAt(0, 0.55, -0.45);
  const identity = mat4.identity();
  const knotModel = mat4.scratch();
  const knotTilt = mat4.scratch();

  const refreshPowers = (): void => {
    EXPO_LIGHT_IDS.forEach((entityId, index) => {
      powers[index] = service.getPointLight(entityId)?.pointLight.power ?? 0;
    });
    const changes = service.readPointLightRenderChanges();
    if (changes.pointLights.length > 0) {
      service.acknowledgePointLightRenderChanges(changes.eventSequence);
    }
    glowProgram.instanceAttributes.iPower.set(powers);
  };
  refreshPowers();

  const inspection: GameInspectionPort = Object.freeze({
    snapshot: (state) => createGameInspectionSnapshot(state, {
      pointLights: inspectPointLightService(service),
    }),
    setPointLightPower: (command, commandContext) => (
      service.submitPointLightPower(command, commandContext)
    ),
    correctPointLightPower: (request, commandContext) => (
      service.correctPointLightPower(request, commandContext)
    ),
  });

  context.report({
    instances: 16,
    drawCalls: 5,
    uploadBytesPerFrame: 412,
    note: 'three Framework-authored point lights driving a custom BroMetal surface shader',
  });

  let disposed = false;
  return Object.freeze({
    inspection,
    frame(time: number): void {
      if (disposed) return;
      refreshPowers();
      const cameraX = (context.pointer.x - 0.5) * 2.2;
      const cameraY = 3.1 + (context.pointer.y - 0.5) * 0.8;
      cameraPosition[0] = cameraX;
      cameraPosition[1] = cameraY;
      camera.setPosition(cameraX, cameraY, 11.2);
      camera.lookAt(0, 0.55, -0.45);
      const viewProjection = camera.viewProjection(renderer.aspect);
      mat4.multiply(
        mat4.rotationY(time * 0.32, knotModel),
        mat4.rotationX(0.32 + Math.sin(time * 0.2) * 0.08, knotTilt),
        knotModel,
      );

      renderer.present(() => {
        surfacePrograms.forEach((program, index) => {
          program.uniforms.uViewProj.set(viewProjection);
          program.uniforms.uModel.set(index === 3 ? knotModel : identity);
          program.uniforms.uCameraPosition.set(cameraPosition);
          program.uniforms.uTime.set(time);
          program.uniforms.uEmberPosition.set(lightRecords[0]!.transform.position);
          program.uniforms.uEmberColor.set(lightRecords[0]!.pointLight.color);
          program.uniforms.uEmberPower.set(powers[0]!);
          program.uniforms.uEmberRadius.set(lightRecords[0]!.pointLight.radius);
          program.uniforms.uIonPosition.set(lightRecords[1]!.transform.position);
          program.uniforms.uIonColor.set(lightRecords[1]!.pointLight.color);
          program.uniforms.uIonPower.set(powers[1]!);
          program.uniforms.uIonRadius.set(lightRecords[1]!.pointLight.radius);
          program.uniforms.uVioletPosition.set(lightRecords[2]!.transform.position);
          program.uniforms.uVioletColor.set(lightRecords[2]!.pointLight.color);
          program.uniforms.uVioletPower.set(powers[2]!);
          program.uniforms.uVioletRadius.set(lightRecords[2]!.pointLight.radius);
          program.draw();
        });
        glowProgram.uniforms.uViewProj.set(viewProjection);
        glowProgram.uniforms.uCameraPosition.set(cameraPosition);
        glowProgram.draw();
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        service.dispose();
        surfacePrograms.forEach((program) => program.dispose());
        glowProgram.dispose();
      } finally {
        renderer.destroy();
      }
    },
  });
};

export default game;
