import assert from 'node:assert/strict';
import test from 'node:test';

import { createCamera } from 'brometal';
import { EXPO_LIGHT_DEFINITIONS } from '../src/lights.ts';
import { RELAY_PRESENTATION } from '../src/presentation.ts';
import { RELAY_SHRINE_PROFILES } from '../src/reliquary-model-layout.ts';
import * as renderProfile from '../src/render-profile.ts';
import { createShadeGeometry } from '../src/shade-geometry.ts';
import {
  ARENA_HALF_EXTENTS,
  RELAY_PARTICLE_CAPACITY,
  SHADE_COUNT,
} from '../src/simulation.ts';

const { RELAY_RENDER_PROFILE, renderSlot } = renderProfile;

function luminance(color: readonly [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function contrast(
  brighter: readonly [number, number, number],
  darker: readonly [number, number, number],
): number {
  return (luminance(brighter) + 0.05) / (luminance(darker) + 0.05);
}

type SlotRange = Readonly<{ start: number; count: number; endExclusive: number }>;

function ndcPoint(
  matrix: Float32Array,
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] {
  const clipX = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
  const clipY = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
  const clipZ = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!;
  const clipW = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;
  return [clipX / clipW, clipY / clipW, clipZ / clipW];
}

test('default presentation retains readable value hierarchy without relay light', () => {
  const clearLuminance = luminance(RELAY_PRESENTATION.clearColor.slice(0, 3) as [
    number,
    number,
    number,
  ]);
  const surfaceFill = luminance(RELAY_PRESENTATION.surfaceAmbient.color)
    * RELAY_PRESENTATION.surfaceAmbient.strength
    * RELAY_PRESENTATION.exposure;
  const floorFill = luminance(RELAY_PRESENTATION.floorAmbient.color)
    * RELAY_PRESENTATION.floorAmbient.strength
    * RELAY_PRESENTATION.exposure;

  assert.ok(clearLuminance >= 0.045);
  assert.ok(surfaceFill >= 0.38);
  assert.ok(floorFill >= 0.36);
  assert.ok(luminance(RELAY_PRESENTATION.palette.stone) >= 0.3);
  assert.ok(luminance(RELAY_PRESENTATION.palette.shade) >= 0.12);
  assert.ok(
    luminance(RELAY_PRESENTATION.palette.player)
      - luminance(RELAY_PRESENTATION.palette.shade)
      >= 0.5,
  );
  assert.ok(RELAY_PRESENTATION.fog.maximumMix <= 0.38);
  assert.ok(contrast(
    RELAY_PRESENTATION.palette.player,
    RELAY_PRESENTATION.palette.shade,
  ) >= 3);
  assert.ok(contrast(
    RELAY_PRESENTATION.palette.forge,
    RELAY_PRESENTATION.palette.darkStone,
  ) >= 2);
});

test('relay illumination is strong but bounded above the ambient presentation', () => {
  assert.ok(RELAY_PRESENTATION.relayLightStrength >= 0.58);
  assert.ok(RELAY_PRESENTATION.relayLightStrength <= 0.78);
  assert.ok(RELAY_PRESENTATION.exposure >= 1.15);
  assert.ok(RELAY_PRESENTATION.exposure <= 1.4);
});

test('camera and relay silhouettes remain stable and non-color-dependent', () => {
  assert.equal(RELAY_PRESENTATION.camera.idleDrift, 0);
  assert.ok(RELAY_PRESENTATION.camera.dangerShakeThreshold > 0.35);
  const camera = RELAY_PRESENTATION.camera as typeof RELAY_PRESENTATION.camera & {
    target?: readonly [number, number, number];
  };
  assert.ok(camera.target);
  const downwardAngle = Math.atan2(
    camera.position[1] - camera.target[1],
    camera.position[2] - camera.target[2],
  );
  const backEdge = camera.position[2]
    - camera.position[1] / Math.tan(downwardAngle - camera.fovY / 2);
  const frontEdge = camera.position[2]
    - camera.position[1] / Math.tan(downwardAngle + camera.fovY / 2);
  assert.ok(backEdge <= -ARENA_HALF_EXTENTS[1]);
  assert.ok(frontEdge >= ARENA_HALF_EXTENTS[1]);
  assert.ok(frontEdge - backEdge <= 16);
  const targetDistance = Math.hypot(
    camera.position[1] - camera.target[1],
    camera.position[2] - camera.target[2],
  );
  const forwardY = (camera.target[1] - camera.position[1]) / targetDistance;
  const forwardZ = (camera.target[2] - camera.position[2]) / targetDistance;
  const frontDepth = -camera.position[1] * forwardY
    + (ARENA_HALF_EXTENTS[1] - camera.position[2]) * forwardZ;
  const horizontalFov = 2 * Math.atan(Math.tan(camera.fovY / 2) * 16 / 9);
  assert.ok(frontDepth * Math.tan(horizontalFov / 2) >= ARENA_HALF_EXTENTS[0]);
  const silhouettes = new Set(RELAY_SHRINE_PROFILES.map((profile) => (
    `${Math.max(...profile.rockHeights).toFixed(2)}:${profile.stumpScale.toFixed(2)}`
  )));
  assert.equal(silhouettes.size, 3);
});

test('the fixed camera contains the full elevated reliquary bounds at 1280 by 720', () => {
  const presentation = RELAY_PRESENTATION as typeof RELAY_PRESENTATION & {
    reliquaryBounds?: Readonly<{
      minimum: readonly [number, number, number];
      maximum: readonly [number, number, number];
    }>;
  };
  assert.ok(presentation.reliquaryBounds);
  const camera = createCamera({
    position: presentation.camera.position,
    fovY: presentation.camera.fovY,
    near: 0.1,
    far: 45,
  });
  camera.lookAt(...presentation.camera.target);
  const matrix = camera.viewProjection(1280 / 720);
  const { minimum, maximum } = presentation.reliquaryBounds;
  for (const x of [minimum[0], maximum[0]]) {
    for (const y of [minimum[1], maximum[1]]) {
      for (const z of [minimum[2], maximum[2]]) {
        const [ndcX, ndcY, ndcZ] = ndcPoint(matrix, x, y, z);
        assert.ok(Math.abs(ndcX) <= 0.98, `x=${x}, y=${y}, z=${z} clipped horizontally`);
        assert.ok(Math.abs(ndcY) <= 0.98, `x=${x}, y=${y}, z=${z} clipped vertically`);
        assert.ok(ndcZ >= 0 && ndcZ <= 1, `x=${x}, y=${y}, z=${z} outside depth`);
      }
    }
  }
});

test('the readability rebuild stays inside the declared render guardrails', () => {
  assert.ok(RELAY_RENDER_PROFILE.measurements.drawCalls <= 12);
  assert.ok(RELAY_RENDER_PROFILE.measurements.instances <= 320);
  assert.ok(RELAY_RENDER_PROFILE.measurements.uploadBytesPerFrame <= 16 * 1_024);
});

test('catalog-derived primary massing replaces primitive ruin passes', () => {
  const capacities = RELAY_RENDER_PROFILE.capacities as Readonly<Record<string, number>>;
  const rockCapacity = capacities.rocks ?? 0;
  const stumpCapacity = capacities.stumps ?? 0;
  const organicCapacity = capacities.organic ?? 0;
  assert.ok(rockCapacity >= 18);
  assert.ok(stumpCapacity >= 7);
  assert.ok(organicCapacity < rockCapacity + stumpCapacity);
  assert.equal(capacities.architecture, undefined);
  assert.equal(capacities.columns, undefined);
});

test('shade geometry is a substantial three-dimensional predator silhouette', () => {
  const geometry = createShadeGeometry();
  const positions = geometry.positions;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;
  let highExtremes = 0;
  let lowExtremes = 0;
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index]!;
    const y = positions[index + 1]!;
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
    minimumZ = Math.min(minimumZ, positions[index + 2]!);
    maximumZ = Math.max(maximumZ, positions[index + 2]!);
    if (y > 1.1 && Math.abs(x) > 0.2) highExtremes += 1;
    if (y < -0.4 && Math.abs(x) > 0.7) lowExtremes += 1;
  }
  assert.ok(maximumX - minimumX >= 1.2);
  assert.ok(maximumY - minimumY >= 1.1);
  assert.ok(maximumZ - minimumZ >= 1.4);
  assert.ok(highExtremes >= 2, 'paired horns must break the crown silhouette');
  assert.ok(lowExtremes >= 2, 'paired claws must break the tail silhouette');
  assert.ok(geometry.indices.length >= 180, 'the shade must have volumetric body and limb planes');
});

test('catalog materials lift dark source albedo while the floor yields hierarchy', () => {
  const material = (RELAY_PRESENTATION as typeof RELAY_PRESENTATION & {
    catalogMaterial?: Readonly<{ diffuseLift: number; textureContrast: number; ambientStrength: number }>;
    floorTextureContrast?: number;
  }).catalogMaterial;
  assert.ok(material);
  assert.ok(material.diffuseLift >= 0.12);
  assert.ok(material.textureContrast <= 0.82);
  assert.ok(material.ambientStrength >= RELAY_PRESENTATION.surfaceAmbient.strength);
  assert.ok((RELAY_PRESENTATION as { floorTextureContrast?: number }).floorTextureContrast! <= 0.68);
});

test('render slots are contiguous, bounded, and derived from simulation counts', () => {
  const slots = (
    renderProfile as typeof renderProfile & {
      RELAY_RENDER_SLOTS?: Readonly<Record<string, Readonly<Record<string, SlotRange>>>>;
    }
  ).RELAY_RENDER_SLOTS;
  assert.ok(slots);

  for (const [batchName, ranges] of Object.entries(slots)) {
    let cursor = 0;
    for (const range of Object.values(ranges)) {
      assert.equal(range.start, cursor, `${batchName} slots must be contiguous`);
      assert.equal(range.endExclusive, range.start + range.count);
      cursor = range.endExclusive;
    }
    const capacity = RELAY_RENDER_PROFILE.capacities[
      batchName as keyof typeof RELAY_RENDER_PROFILE.capacities
    ];
    assert.equal(cursor, capacity, `${batchName} slots must fill their batch capacity`);
  }
  assert.equal(slots.glows.particles.count, RELAY_PARTICLE_CAPACITY);
  assert.equal(slots.creatures.shades.count, SHADE_COUNT);
  assert.equal(slots.contacts.shades.count, SHADE_COUNT);
  assert.equal(slots.rings.shades.count, SHADE_COUNT);
  assert.equal(slots.rocks.relayMassing.count, EXPO_LIGHT_DEFINITIONS.length * 3);
  assert.equal(slots.stumps.relayShrines.count, EXPO_LIGHT_DEFINITIONS.length);
  assert.equal(slots.orbs.relayCores.count, EXPO_LIGHT_DEFINITIONS.length);
  assert.equal(
    renderSlot(slots.glows.particles, RELAY_PARTICLE_CAPACITY - 1),
    slots.glows.particles.endExclusive - 1,
  );
  assert.throws(
    () => renderSlot(slots.glows.particles, RELAY_PARTICLE_CAPACITY),
    RangeError,
  );
});

test('contact shadows are unlit, soft, and blended without writing depth', async () => {
  const shader = (await import('../src/shaders/contact-shadow.shader.gen.ts')).default;

  // The defect this replaces: contact blobs drawn through `foundry`, the demo's full PBR material.
  // Three point lights, an ambient term, fog and the tone-mapper all acted on them, so walking a
  // light towards a creature made its own shadow glow.
  for (const banned of ['uEmberPosition', 'uAmbientColor', 'tonemap', 'uExposure', 'uFogColor']) {
    assert.ok(!shader.wgslSrc.includes(banned), `contact shadow shader must not reference ${banned}`);
  }
  assert.equal(Object.keys(shader.uniforms).length, 1);
  assert.equal(shader.uniforms.uViewProj, 'mat4');
  assert.match(shader.wgslSrc, /smoothstep/);
});

test('the contact shadow quad is flat, so alpha is not applied twice', async () => {
  const { groundQuad } = await import('../src/render-batches.ts');
  const geometry = groundQuad();
  for (let index = 1; index < geometry.positions.length; index += 3) {
    assert.equal(geometry.positions[index], 0, 'every shadow vertex must sit on the ground plane');
  }
  // Two triangles. A sphere or box here would blend front and back faces over the same pixels and
  // darken every blob twice with geometry nobody can see.
  assert.equal(geometry.indices.length, 6);
});

test('contact shadows have their own batch rather than sharing the lit orb slots', () => {
  const slots = RELAY_RENDER_PROFILE.capacities;
  assert.equal(slots.contacts, SHADE_COUNT + 1);
  assert.ok(!('playerContact' in renderProfile.RELAY_RENDER_SLOTS.orbs));
});

test('every visual batch that gets drawn also gets its instance data uploaded', async () => {
  const { readFile } = await import('node:fs/promises');
  const visuals = await readFile(new URL('../src/relay-visuals.ts', import.meta.url), 'utf8');
  const renderer = await readFile(new URL('../src/renderer.ts', import.meta.url), 'utf8');

  // This guards a real regression that shipped: the contact-shadow batch was added, written to and
  // drawn, but never uploaded. BroMetal refuses a draw with empty instance buffers — "no instance
  // data — call set(...) before draw()" — and the whole demo failed to start. Nothing caught it,
  // because every test here runs without a GPU and the capture path still produced a frame.
  //
  // Scoped to `visualBatches`, which is exactly the set with a write-then-upload-then-draw contract
  // each frame. The floor and onboarding programs are not instanced, and the three model batches
  // upload once at construction in `reliquary-models.ts`.
  const declaration = visuals.match(/export type RelayVisualBatches = Readonly<\{([\s\S]*?)\}>;/);
  assert.ok(declaration, 'failed to locate the RelayVisualBatches declaration');
  const names = [...declaration[1].matchAll(/^\s*(\w+):/gm)].map((match) => match[1]);
  assert.ok(names.length >= 5, `expected the full batch set, found ${names.join(', ')}`);

  // `.draw(` with any arguments, not `.draw()` exactly. Requiring empty parentheses meant
  // `glows.draw({ instanceCount: liveGlows })` — a shape this demo already advertises through
  // `particlePacking: 'active-prefix'` — skipped the batch entirely, so deleting its upload passed.
  const drawn = names.filter((name) => new RegExp(`\\b${name}\\.draw\\(`).test(renderer));
  assert.ok(
    drawn.length >= 5,
    `expected most of the batch set to be drawn, matched ${drawn.length}: ${drawn.join(', ')}`,
  );
  const missing = drawn.filter((name) => !new RegExp(`\\b${name}\\.upload\\(`).test(visuals));
  assert.deepEqual(missing, [], 'these batches are drawn every frame but never have their instance data uploaded');
});
