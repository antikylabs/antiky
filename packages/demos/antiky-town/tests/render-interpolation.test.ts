import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const townSource = await readFile(new URL('../src/town/index.ts', import.meta.url), 'utf8');

/**
 * The motor already interpolates between its last two fixed steps. The defect this guards is not a
 * missing implementation — it is a render path that computed the interpolation and then drew
 * `state.position` anyway, so the town stair-stepped on any display faster than 60 Hz.
 */

test('the camera follows the interpolated hero position, not the simulation one', () => {
  const cameraBlock = townSource.slice(
    townSource.indexOf("if (mode === 'interactive') {"),
    townSource.indexOf('const actorBatch ='),
  );
  assert.ok(cameraBlock.length > 0, 'failed to locate the camera block');

  // A camera stepping at 60 Hz behind a sprite drawn at display rate makes the hero jitter against
  // the frame, which is worse than both being stepped together.
  assert.ok(
    !/desired[XYZ] = hero\.motor\.state\.position/.test(cameraBlock),
    'the camera must follow heroRenderPosition',
  );
});

test('every actor is drawn at its interpolated position', () => {
  const drawBlock = townSource.slice(townSource.indexOf('for (const npc of npcs) {\n        const root'));
  assert.match(drawBlock.slice(0, 200), /const root = npc\.renderPosition;/);
  // The result of `advance` carries the interpolation. Discarding it is the defect.
  assert.match(townSource, /npc\.renderPosition = npcResult\.renderPosition;/);
});
