import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The scene target's alpha channel carries **linear camera distance**, not opacity.
 *
 * Goal 07 calls this the single highest-risk edit in the goal, and requires this test to exist
 * *before* W B.2 moves the scene target to RGBA16F. It is written first for that reason.
 *
 * The convention, and why it exists: BroMetal depth attachments are never sampleable, so nothing
 * downstream can read the depth buffer. `antiky-town` works around that by having every opaque
 * shader write `length(world - camera)` into alpha, which the post pass then reads for its sky mask,
 * its depth of field and its fog. The water features participate by **deliberately not alpha
 * blending** — a blended fragment would overwrite that payload with an opacity.
 *
 * What breaks silently if the convention is lost: the sky mask keys off alpha near `FAR_DEPTH`, so a
 * water surface writing 1.0 instead of its distance is classified as sky and vanishes into the
 * horizon; and depth of field reads the same channel, so it would focus on nothing.
 *
 * These assertions are deliberately about the *contract* rather than about pixels, because the
 * failure is a convention breaking rather than a value drifting.
 */

const TOWN = new URL('../src/town/', import.meta.url);

const stripComments = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

test('the water shader writes camera distance into alpha, not opacity', async () => {
  const source = await readFile(new URL('shaders/town-water-features.shader.ts', TOWN), 'utf8');
  const code = stripComments(source);

  // The varying is the distance from the camera, computed in the vertex stage.
  assert.match(
    code,
    /v\.vDepth\s*=\s*length\(world\.sub\(uCamPos\)\)/,
    'the depth payload is no longer camera distance',
  );
  // And it reaches alpha unmodified. Anything else in that slot is an opacity.
  const returned = code.slice(code.lastIndexOf('return vec4('));
  assert.match(returned, /,\s*vDepth\s*\)/, 'the water shader stopped writing vDepth into alpha');
});

test('every opaque town shader agrees about the payload', async () => {
  // The convention only works if it is unanimous: one shader writing an opacity punches a hole in
  // the sky mask and the depth of field wherever it draws.
  const { readdir } = await import('node:fs/promises');
  const directory = new URL('shaders/', TOWN);
  // `town-post` resolves the target rather than drawing into it, and every `-shadow` variant draws
  // into the shadow map — a different target with no depth payload, where alpha is free. Excluded by
  // pattern rather than by name so a new caster's shadow variant does not fail this by existing.
  const exempt = (name: string) => name === 'town-post.shader.ts' || name.includes('-shadow.');
  const offenders: string[] = [];
  let checked = 0;
  for (const entry of await readdir(directory)) {
    if (!entry.endsWith('.shader.ts') || entry.endsWith('.gen.ts')) continue;
    if (exempt(entry)) continue;
    const code = stripComments(await readFile(new URL(entry, directory), 'utf8'));
    if (!code.includes('return vec4(')) continue;
    const returned = code.slice(code.lastIndexOf('return vec4('));
    // A literal 1 in the alpha slot is the signature of a shader that thinks it is writing opacity.
    if (/,\s*1(\.0)?\s*\)\s*;/.test(returned)) offenders.push(entry);
    checked += 1;
  }
  assert.ok(checked >= 6, `expected the town's opaque shaders, checked ${checked}`);
  assert.deepEqual(
    offenders,
    [],
    'these write a constant into the alpha channel that carries camera distance',
  );
});

test('the post pass reads alpha as a distance measured against the far plane', async () => {
  const code = stripComments(await readFile(new URL('shaders/town-post.shader.ts', TOWN), 'utf8'));
  // The sky mask keys off alpha approaching the far plane. If this comparison disappears, the sky
  // stops being separable from geometry and the horizon fills with fogged terrain.
  assert.match(code, /smoothstep\(uFarDepth \* [0-9.]+, uFarDepth \* [0-9.]+, \w+\.w\)/);
  // Depth of field reads the same channel, so the two cannot disagree about what it holds.
  assert.ok(code.includes('nearCoc') && code.includes('farCoc'), 'the depth of field stopped reading alpha');
});

test('the far plane the payload is measured against is the one the camera uses', async () => {
  // Read from source rather than imported: `town.ts` pulls in the voxel mesher, and this test is
  // about a convention between three files, not about anything that needs the town to load.
  const town = await readFile(new URL('art/town.ts', TOWN), 'utf8');
  const declared = /export const FAR_DEPTH = ([0-9.]+);/.exec(town);
  assert.ok(declared, 'FAR_DEPTH is no longer declared where the contract expects it');
  const farDepth = Number(declared[1]);
  // `FAR_DEPTH` is both the camera's far plane and the value the scene target clears alpha to, so a
  // fragment that draws nothing reads as maximally distant. If the two ever diverge, the sky mask
  // keys off a distance no geometry can reach.
  const index = stripComments(await readFile(new URL('index.ts', TOWN), 'utf8'));
  assert.match(index, /SCENE_CLEAR = \[[^\]]*FAR_DEPTH\]/, 'the scene no longer clears alpha to the far plane');
  assert.match(index, /createCamera\(\{[^}]*far: FAR_DEPTH/, 'the camera no longer uses FAR_DEPTH');
  assert.match(index, /uFarDepth\.set\(FAR_DEPTH\)/, 'the post pass is told a different far plane');
  assert.equal(Number.isFinite(farDepth), true);
  // RGBA16F holds 180 exactly; fp16 is exact on integers to 2048. Worth stating, because W B.2's
  // whole risk is that this channel changes format underneath the convention.
  assert.ok(farDepth < 2048, `${farDepth} is beyond fp16's exactly-representable integer range`);
});
