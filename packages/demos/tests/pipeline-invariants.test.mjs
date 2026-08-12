import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * Source-level invariants that encode the defects the demo audit found, so they cannot return
 * quietly once they are fixed.
 *
 * These fail today. That is the point: each one is a defect that a later goal removes, and the
 * test is what proves the removal actually happened. They are deliberately excluded from
 * `npm test`, which stays green as a regression gate. Run them with `npm run demos:verify`.
 */

const demosRoot = path.resolve(import.meta.dirname, '..');
const ANTIKY_DEMOS = ['antiky-town', 'combat-arena', 'point-light-expo', 'traversal-study'];

async function shaderSources(slug) {
  const results = [];
  const roots = [
    path.join(demosRoot, 'antiky', slug, 'src', 'shaders'),
    path.join(demosRoot, 'antiky', slug, 'src', 'town', 'shaders'),
  ];
  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.shader.ts')) continue;
      if (entry.name.endsWith('.shader.gen.ts')) continue;
      const file = path.join(root, entry.name);
      results.push({ file, relative: path.relative(demosRoot, file), text: await readFile(file, 'utf8') });
    }
  }
  return results;
}

/** Far-plane constants declared outside the file that uses them. */
const FAR_CONSTANTS = Object.freeze({ FAR_DEPTH: 180 });

/** Every TypeScript source file in a demo, so nested cameras are not missed by a renderer glob. */
async function demoSources(slug) {
  const results = [];
  const root = path.join(demosRoot, 'antiky', slug, 'src');
  const walk = async (directory) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.gen.ts')) {
        results.push({ relative: path.relative(demosRoot, full), text: await readFile(full, 'utf8') });
      }
    }
  };
  await walk(root);
  return results;
}

/** Wider than any colour palette these kits produce; the widest today is relay-tower at 7. */
const PALETTE_MAX_WIDTH = 16;

/**
 * Every GLB a demo ships, read as data rather than inferred from the script that made it.
 *
 * Reading the artifact is the point: an asset script can be rewritten, replaced or bypassed, and
 * what matters is what actually reaches the game.
 */
async function shippedModels() {
  const results = [];
  const walk = async (directory) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.glb')) results.push(full);
    }
  };
  for (const slug of ANTIKY_DEMOS) await walk(path.join(demosRoot, 'antiky', slug, 'assets'));

  const models = [];
  for (const file of results) {
    const buffer = await readFile(file);
    if (buffer.length < 20 || buffer.toString('utf8', 0, 4) !== 'glTF') continue;
    const jsonLength = buffer.readUInt32LE(12);
    const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
    const binaryOffset = 20 + jsonLength + 8;

    const image = json.images?.[0];
    let textureWidth;
    let textureHeight;
    if (image?.bufferView !== undefined) {
      const view = json.bufferViews[image.bufferView];
      const start = binaryOffset + (view.byteOffset ?? 0);
      // PNG signature, then IHDR width and height as big-endian uint32s.
      if (buffer.toString('hex', start, start + 4) === '89504e47') {
        textureWidth = buffer.readUInt32BE(start + 16);
        textureHeight = buffer.readUInt32BE(start + 20);
      }
    }

    const uvs = new Set();
    for (const mesh of json.meshes ?? []) {
      for (const primitive of mesh.primitives ?? []) {
        const accessorIndex = primitive.attributes?.TEXCOORD_0;
        if (accessorIndex === undefined) continue;
        const accessor = json.accessors[accessorIndex];
        // Only float2 UVs appear in these kits; anything else is not something to guess at.
        if (accessor.componentType !== 5126 || accessor.type !== 'VEC2') continue;
        const view = json.bufferViews[accessor.bufferView];
        const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        for (let index = 0; index < accessor.count; index += 1) {
          const at = start + index * 8;
          uvs.add(`${buffer.readFloatLE(at).toFixed(5)},${buffer.readFloatLE(at + 4).toFixed(5)}`);
        }
      }
    }

    models.push({
      relative: path.relative(demosRoot, file),
      textureWidth,
      textureHeight,
      uniqueUvs: uvs.size,
      hasNormalTexture: (json.materials ?? []).some((material) => material.normalTexture !== undefined),
      materialCount: Math.max(1, (json.materials ?? []).length),
    });
  }
  return models;
}

async function assetScripts() {
  const results = [];
  for (const slug of ANTIKY_DEMOS) {
    const root = path.join(demosRoot, 'antiky', slug, 'scripts');
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
      const file = path.join(root, entry.name);
      results.push({ relative: path.relative(demosRoot, file), text: await readFile(file, 'utf8') });
    }
  }
  return results;
}

test('no material shader tone-maps, because tone-mapping belongs in one post pass', async () => {
  const offenders = [];
  for (const slug of ANTIKY_DEMOS) {
    for (const shader of await shaderSources(slug)) {
      // A demo's single post pass is allowed to tone-map. Every material shader is not.
      if (/post\.shader\.ts$/.test(shader.relative)) continue;
      if (/tonemapACES/.test(shader.text)) offenders.push(shader.relative);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'Tone mapping is the last step of a frame. A material that tone-maps itself crushes the '
    + 'value range before anything can composite onto it, which is why the demo VFX read as flat '
    + 'stickers. Move it into the demo\'s post pass.',
  );
});

test('no asset script discards the normal map it downloaded', async () => {
  const offenders = [];
  for (const script of await assetScripts()) {
    if (/delete\s+\w+\.normalTexture/.test(script.text)) offenders.push(script.relative);
  }
  assert.deepEqual(
    offenders,
    [],
    'Normal maps are downloaded, hash-verified and committed, and then deleted at build time. '
    + 'Apply them through triplanar projection, which needs no tangent basis.',
  );
});

test('every model packed from a source with a normal map still declares one', async () => {
  // The script-level check above can be satisfied by deleting the line and still never packing the
  // map. This reads the shipped artifact instead: point-light-expo's three Poly Haven scans each
  // ship a `*_nor_gl_1k.jpg` in the repository, so each derived GLB must declare a normalTexture.
  const offenders = [];
  for (const model of await shippedModels()) {
    if (!model.relative.includes('point-light-expo')) continue;
    if (!model.relative.endsWith('-runtime.glb')) continue;
    if (!model.hasNormalTexture) offenders.push(`${model.relative}: no normalTexture`);
  }
  assert.equal(offenders.length, 0, offenders.join('\n'));
  // Guards the other direction: a filter that matched nothing would pass this test silently.
  const packed = (await shippedModels()).filter((model) => model.relative.endsWith('-runtime.glb'));
  assert.equal(packed.length, 3, `expected three packed catalog models, saw ${packed.length}`);
});

test('no shipped model has its texture coordinates collapsed onto a real texture', async () => {
  // The original form of this test asserted that an asset script must read `attributes.TEXCOORD_0`
  // before writing UVs. That rule is wrong, and it accused a script that was doing its job.
  //
  // Quaternius' Ultimate Platformer pack is flat-shaded low-poly: colour lives in each material's
  // `baseColorFactor` and there is no source texture at all — the asset receipt records
  // `embeddedTexture` for Kenney's kit and nothing for this one. `normalize-quaternius.mjs`
  // therefore bakes the material colours into a palette strip and points every vertex of a given
  // material at its column. `cloud-large` ships a 1x1 texture because the model is exactly one
  // colour (#909781). That is a faithful encoding, not data loss.
  //
  // The real failure this guards is a script that merges a *textured* model and stamps one UV on
  // every vertex, which would throw away a genuine unwrap. So the rule is about the data, not the
  // source: a model carrying a real texture must have real texture coordinates.
  const offenders = [];
  for (const model of await shippedModels()) {
    if (model.textureWidth === undefined) continue;
    const palette = model.textureHeight === 1 && model.textureWidth <= PALETTE_MAX_WIDTH;
    if (palette) continue;
    if (model.uniqueUvs <= model.materialCount) {
      offenders.push(
        `${model.relative}: ${model.textureWidth}x${model.textureHeight} texture but only `
        + `${model.uniqueUvs} unique UV pair(s) across ${model.materialCount} material(s)`,
      );
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A model with a real texture must carry the unwrap that addresses it. One UV per material means '
    + 'the unwrap was replaced by a palette lookup, which is only correct when the source has no '
    + 'texture to begin with.',
  );
});

test('a palette-baked model ships a palette, not a stretched texture', async () => {
  // The other half: a script that bakes flat colours must emit a strip no wider than the colours it
  // actually found. A palette that has grown past that is a sign the baking went wrong.
  const offenders = [];
  for (const model of await shippedModels()) {
    if (model.textureWidth === undefined || model.textureHeight !== 1) continue;
    if (model.textureWidth > PALETTE_MAX_WIDTH) {
      offenders.push(`${model.relative}: ${model.textureWidth}x1 is too wide to be a colour palette`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('no camera wastes depth precision on an extreme far/near ratio', async () => {
  // A large far/near ratio spends most of the depth buffer on the first fraction of a metre, which
  // nothing in these scenes occupies. Budget is 500:1.
  //
  // The scan walks the whole `src` tree rather than `*/src/renderer.ts`: antiky-town's two cameras
  // are nested at `src/town/index.ts`, and a renderer.ts glob silently misses them.
  const offenders = [];
  for (const slug of ANTIKY_DEMOS) {
    for (const source of await demoSources(slug)) {
      const constants = new Map();
      for (const match of source.text.matchAll(/^\s*(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=\s*([\d.]+)\s*;/gm)) {
        constants.set(match[1], Number(match[2]));
      }
      const pattern = /near:\s*([\d.]+)\s*,\s*far:\s*([\d.]+|[A-Z_][A-Z0-9_]*)/g;
      for (const match of source.text.matchAll(pattern)) {
        const near = Number(match[1]);
        const far = Number.isNaN(Number(match[2])) ? constants.get(match[2]) ?? FAR_CONSTANTS[match[2]] : Number(match[2]);
        if (far === undefined || near === 0) continue;
        const ratio = far / near;
        if (ratio > 500.5) {
          offenders.push(`${source.relative}: far/near = ${ratio.toFixed(0)}:1 (near ${near}, far ${far})`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], 'Raise `near` until the ratio is at most 500:1.');
});

test('every shader in a demo agrees on the direction of the key light', async () => {
  const disagreements = [];
  for (const slug of ANTIKY_DEMOS) {
    const directions = new Map();
    for (const shader of await shaderSources(slug)) {
      const pattern = /const\s+(?:key|sun|light|keyLight|sunDirection)\s*=\s*normalize\(vec3\(([^)]*)\)\)/gi;
      for (const match of shader.text.matchAll(pattern)) {
        const vector = match[1].split(',').map((part) => part.trim()).join(', ');
        if (!directions.has(vector)) directions.set(vector, []);
        directions.get(vector).push(shader.relative);
      }
    }
    if (directions.size > 1) {
      disagreements.push({ demo: slug, directions: Object.fromEntries(directions) });
    }
  }
  assert.deepEqual(
    disagreements,
    [],
    'Objects lit by different suns cannot read as one space. Derive every shader\'s key light '
    + 'from a single shared constant per demo.',
  );
});

test('every shader in a demo agrees on its fog range', async () => {
  const disagreements = [];
  for (const slug of ANTIKY_DEMOS) {
    const ranges = new Map();
    for (const shader of await shaderSources(slug)) {
      const pattern = /smoothstep\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*length\(uCameraPosition/g;
      for (const match of shader.text.matchAll(pattern)) {
        const range = `${match[1]}..${match[2]}`;
        if (!ranges.has(range)) ranges.set(range, []);
        ranges.get(range).push(shader.relative);
      }
    }
    if (ranges.size > 1) disagreements.push({ demo: slug, ranges: Object.fromEntries(ranges) });
  }
  assert.deepEqual(
    disagreements,
    [],
    'Fog is a property of the scene, not of a material. Different ranges in one demo make near '
    + 'and far objects disagree about how far away they are.',
  );
});

/**
 * Names the complexity audit proved dead and this objective deleted.
 *
 * A deletion without a guard comes back: the next agent to touch the file sees a uniform its
 * neighbours have and adds it "for consistency". Each entry below records what it was and why it
 * went, so a future reader can tell a real need from an accident.
 */
const DELETED_NAMES = Object.freeze([
  { name: 'ARENA_ENERGY_INSTANCES', why: 'declared in combat-arena and never read anywhere' },
  { name: 'DEFAULT_OFFSETS', why: 'a default nobody used, and wrong: the real gauge offset is 60, not 28' },
  { name: 'catalogParts', why: 'described the ship models; nothing rendered from it' },
  { name: 'uTint', why: 'all thirteen traversal-study batches passed [1, 1, 1], so it multiplied by one' },
  { name: 'uModel', why: 'point-light-expo only ever set the identity matrix, so both muls were no-ops' },
]);

test('the dead code this objective deleted has not come back', async () => {
  const offenders = [];
  for (const slug of ANTIKY_DEMOS) {
    for (const source of await demoSources(slug)) {
      for (const { name, why } of DELETED_NAMES) {
        if (new RegExp(`\\b${name}\\b`).test(source.text)) {
          offenders.push(`${source.relative}: ${name} — removed because ${why}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('the batch factories expose one instance writer, not two', async () => {
  // Every caller used `setValues`; the tuple-taking `set` twin was dead weight on both demos and
  // on every reader deciding which one to reach for.
  const offenders = [];
  for (const slug of ['combat-arena', 'point-light-expo']) {
    for (const source of await demoSources(slug)) {
      if (!source.relative.endsWith('render-batches.ts')) continue;
      const twins = source.text.match(/^\s{4}set\(/gm) ?? [];
      if (twins.length > 0) offenders.push(`${source.relative}: ${twins.length} tuple writer(s)`);
    }
  }
  assert.deepEqual(offenders, []);
});
