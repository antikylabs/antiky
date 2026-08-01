import { createCamera, createCube, createPlane, createProgram, createTexture, mat4 } from 'brometal';
import { buildSpriteAtlas, SPRITE_CELLS } from '../art/sprites';
import type { DemoFactory } from '../runtime';
import groundShader from '../shaders/ground.shader.gen';
import spriteShader from '../shaders/sprite.shader.gen';
import voxelShader from '../shaders/voxel.shader.gen';

/* Sprites in a depth buffer — the 2.3D premise, drawn with the real pieces.
 *
 * Three programs share one frame: a ground grid, a field of instanced blocks,
 * and 96 instanced sprite billboards. The sprites are alpha-blended, and a
 * blended program depth-tests but cannot depth-write, so their order among
 * themselves has to come from a CPU sort every frame. That per-frame sort and
 * re-upload is precisely what `discard()` removes, and it is why cut-out sprite
 * support is the second patch we opened upstream. */

const SPRITE_COUNT = 96;
const BLOCK_COUNT = 90;
const FOG: [number, number, number] = [0.035, 0.038, 0.055];
const FOG_DIST = 70;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const factory: DemoFactory = ({ renderer, pointer, report }) => {
  const ground = createProgram(renderer, groundShader);
  const blocks = createProgram(renderer, voxelShader);
  const sprites = createProgram(renderer, spriteShader, { blend: 'alpha' });

  const plane = createPlane({ width: 90, height: 90 });
  ground.attributes.aPosition.set(plane.positions);
  ground.setIndices(plane.indices);
  const groundModel = mat4.multiply(mat4.translation(0, 0, 0), mat4.rotationX(-Math.PI / 2));

  const cube = createCube();
  blocks.attributes.aPosition.set(cube.positions);
  blocks.attributes.aNormal.set(cube.normals);
  blocks.setIndices(cube.indices);

  const quad = createPlane({ width: 1, height: 1 });
  sprites.attributes.aPosition.set(quad.positions);
  sprites.attributes.aUv.set(quad.uvs);
  sprites.setIndices(quad.indices);

  const atlas = createTexture(renderer, buildSpriteAtlas(), { filter: 'nearest', flipY: true });
  sprites.uniforms.uAtlas.set(atlas);
  sprites.uniforms.uCells.set(SPRITE_CELLS);

  // ── The world: a scatter of blocks the characters have to be occluded by ──
  const random = mulberry32(0x2b3d);
  const blockOffset = new Float32Array(BLOCK_COUNT * 3);
  const blockScale = new Float32Array(BLOCK_COUNT * 3);
  const blockColor = new Float32Array(BLOCK_COUNT * 3);
  for (let i = 0; i < BLOCK_COUNT; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 4 + random() * 22;
    const height = 0.5 + random() * 2.6;
    const width = 0.7 + random() * 1.3;
    blockOffset.set([Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius], i * 3);
    blockScale.set([width, height, width], i * 3);
    // Cool stone, with the occasional lamp-lit face so the frame is not one hue.
    const shade = 0.22 + random() * 0.16;
    const lit = random() < 0.12;
    blockColor.set(
      lit ? [0.82, 0.34, 0.13] : [shade * 0.9, shade * 0.94, shade * 1.16],
      i * 3,
    );
  }
  blocks.instanceAttributes.iOffset.set(blockOffset);
  blocks.instanceAttributes.iScale.set(blockScale);
  blocks.instanceAttributes.iColor.set(blockColor);

  // ── The cast: each character walks its own slow circle ────────────────────
  type Walker = { radius: number; phase: number; speed: number; cell: number; height: number; tint: [number, number, number] };
  const walkers: Walker[] = [];
  for (let i = 0; i < SPRITE_COUNT; i++) {
    const warm = 0.82 + random() * 0.32;
    walkers.push({
      radius: 2.5 + random() * 21,
      phase: random() * Math.PI * 2,
      speed: (0.06 + random() * 0.16) * (random() < 0.5 ? -1 : 1),
      cell: Math.floor(random() * SPRITE_CELLS),
      height: 1.9 + random() * 0.6,
      tint: [warm, warm * (0.94 + random() * 0.1), warm * (0.9 + random() * 0.14)],
    });
  }

  const spritePos = new Float32Array(SPRITE_COUNT * 3);
  const spriteSize = new Float32Array(SPRITE_COUNT * 2);
  const spriteCell = new Float32Array(SPRITE_COUNT);
  const spriteTint = new Float32Array(SPRITE_COUNT * 3);
  // Allocated once and sorted in place. A per-frame array here would be the
  // exact mistake the engine's memory rule exists to prevent.
  const order = Array.from({ length: SPRITE_COUNT }, (_, i) => i);
  const depth = new Float32Array(SPRITE_COUNT);
  const world = new Float32Array(SPRITE_COUNT * 3);

  const camera = createCamera({ position: [0, 6, 16] });
  const lightDir: [number, number, number] = [0.42, 0.78, 0.46];

  for (const program of [blocks]) {
    program.uniforms.uLightDir.set(lightDir);
    program.uniforms.uFog.set(FOG);
    program.uniforms.uFogDist.set(FOG_DIST);
  }
  ground.uniforms.uFog.set(FOG);
  ground.uniforms.uFogDist.set(FOG_DIST);
  ground.uniforms.uBase.set([0.12, 0.12, 0.14]);
  ground.uniforms.uLine.set([0.25, 0.23, 0.3]);
  ground.uniforms.uModel.set(groundModel);
  sprites.uniforms.uFog.set(FOG);
  sprites.uniforms.uFogDist.set(FOG_DIST);

  // 3 + 2 + 1 + 3 floats per sprite, re-sent every frame because the sort
  // permutes all four arrays together.
  report({
    instances: SPRITE_COUNT + BLOCK_COUNT,
    drawCalls: 3,
    bytesPerFrame: SPRITE_COUNT * 9 * 4,
    note: 'sprites sorted back-to-front on the CPU each frame',
  });

  return {
    frame(t) {
      // A high, deliberate angle lets the spatial scene own the frame and makes
      // sprite/geometry occlusion legible before the visitor starts orbiting.
      const spin = t * 0.09 + pointer.dragX * 4;
      const lift = 13 + Math.sin(t * 0.15) * 1.1 + pointer.dragY * 10;
      const camX = Math.sin(spin) * 27;
      const camZ = Math.cos(spin) * 27;
      camera.setPosition(camX, Math.max(4.5, lift), camZ);
      camera.lookAt(0, 1.4, 0);
      const viewProj = camera.viewProjection(renderer.aspect);
      const camPos: [number, number, number] = [camX, Math.max(4.5, lift), camZ];

      ground.uniforms.uViewProj.set(viewProj);
      ground.uniforms.uCamPos.set(camPos);
      ground.draw();

      blocks.uniforms.uViewProj.set(viewProj);
      blocks.uniforms.uCamPos.set(camPos);
      blocks.draw();

      for (let i = 0; i < SPRITE_COUNT; i++) {
        const walker = walkers[i]!;
        const angle = walker.phase + t * walker.speed;
        const x = Math.cos(angle) * walker.radius;
        const z = Math.sin(angle) * walker.radius;
        world[i * 3] = x;
        world[i * 3 + 1] = 0;
        world[i * 3 + 2] = z;
        const dx = x - camPos[0];
        const dz = z - camPos[2];
        depth[i] = dx * dx + dz * dz;
      }

      // Farthest first. Without this the blend order is buffer order, and the
      // scene reads as characters punching holes in each other.
      order.sort((a, b) => depth[b]! - depth[a]!);
      for (let slot = 0; slot < SPRITE_COUNT; slot++) {
        const i = order[slot]!;
        const walker = walkers[i]!;
        spritePos[slot * 3] = world[i * 3]!;
        spritePos[slot * 3 + 1] = 0;
        spritePos[slot * 3 + 2] = world[i * 3 + 2]!;
        spriteSize[slot * 2] = walker.height * 0.7;
        spriteSize[slot * 2 + 1] = walker.height;
        spriteCell[slot] = walker.cell;
        spriteTint[slot * 3] = walker.tint[0];
        spriteTint[slot * 3 + 1] = walker.tint[1];
        spriteTint[slot * 3 + 2] = walker.tint[2];
      }

      sprites.instanceAttributes.iPos.set(spritePos);
      sprites.instanceAttributes.iSize.set(spriteSize);
      sprites.instanceAttributes.iCell.set(spriteCell);
      sprites.instanceAttributes.iTint.set(spriteTint);
      sprites.uniforms.uViewProj.set(viewProj);
      sprites.uniforms.uCamPos.set(camPos);
      // Camera right, flattened: the billboard yaws and never pitches.
      sprites.uniforms.uRight.set([Math.cos(spin), 0, -Math.sin(spin)]);
      sprites.draw();
    },
    dispose() {
      sprites.dispose();
      blocks.dispose();
      ground.dispose();
      atlas.dispose();
    },
  };
};

export default factory;
