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
    // Comments are stripped first: the fix for this defect is documented in the very scripts being
    // scanned, and a comment describing the mistake is not the mistake.
    const code = script.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/delete\s+\w+\.normalTexture/.test(code)) offenders.push(script.relative);
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

/**
 * Shaders that sample an albedo texture and therefore must decode sRGB, against those that sample
 * data — normal, ARM, roughness, shadow and scene-target reads are already linear and decoding them
 * would corrupt them.
 */
const ALBEDO_SHADERS = Object.freeze([
  'antiky/combat-arena/src/shaders/arena-model.shader.ts',
  'antiky/combat-arena/src/shaders/ship-model.shader.ts',
  'antiky/traversal-study/src/shaders/traversal-model.shader.ts',
  'antiky/point-light-expo/src/shaders/reliquary-model.shader.ts',
  'antiky/point-light-expo/src/shaders/reliquary-floor.shader.ts',
  'antiky/antiky-town/src/town/shaders/town-voxel.shader.ts',
  'antiky/antiky-town/src/town/shaders/town-awning.shader.ts',
  'antiky/antiky-town/src/town/shaders/town-prop.shader.ts',
  'antiky/antiky-town/src/town/shaders/town-foliage.shader.ts',
  'antiky/antiky-town/src/town/shaders/town-sprite.shader.ts',
]);

/** Samplers that carry data rather than colour. Decoding any of these is a defect. */
const LINEAR_SAMPLERS = Object.freeze(['uShadowMap', 'uNormalMap', 'uArm', 'uRoughness', 'uAo', 'uScene']);

test('every shader that samples albedo decodes it from sRGB', async () => {
  // The check that catches the one shader somebody forgets. BroMetal has no sRGB texture format, so
  // the decode cannot be delegated to the sampler.
  const missing = [];
  for (const relative of ALBEDO_SHADERS) {
    const text = await readFile(path.join(demosRoot, relative), 'utf8');
    if (!/function decodeSrgb/.test(text)) {
      missing.push(`${relative}: no decodeSrgb helper`);
      continue;
    }
    // Two shapes are legitimate. Where only colour is needed the decode wraps the sample directly.
    // Where the alpha is needed too, the sample is bound first and only its .xyz is decoded, because
    // sampling twice to avoid the extra name would cost a second texture fetch per fragment.
    const direct = /decodeSrgb\(texture\(/.test(text);
    const viaBinding = [...text.matchAll(/const (\w+) = texture\(/g)]
      .some(([, name]) => new RegExp(`decodeSrgb\\(${name}\\.xyz\\)`).test(text));
    if (!direct && !viaBinding) missing.push(`${relative}: helper present but never applied to a sample`);
  }
  assert.deepEqual(missing, []);
});

test('no data texture is put through the colour decode', async () => {
  const offenders = [];
  for (const slug of ANTIKY_DEMOS) {
    for (const shader of await shaderSources(slug)) {
      for (const sampler of LINEAR_SAMPLERS) {
        if (new RegExp(`decodeSrgb\\(texture\\(${sampler}\\b`).test(shader.text)) {
          offenders.push(`${shader.relative}: ${sampler} holds data, not colour`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('every copy of the decode helper is identical', async () => {
  // It is duplicated because the BroMetal MVP resolves only helpers declared in the same module —
  // an imported one fails to compile. Duplication is therefore forced, but drift is not.
  const bodies = new Map();
  for (const relative of ALBEDO_SHADERS) {
    const text = await readFile(path.join(demosRoot, relative), 'utf8');
    const start = text.indexOf('function channelToLinear');
    const end = text.indexOf('\n}\n', text.indexOf('function decodeSrgb'));
    const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (!bodies.has(body)) bodies.set(body, []);
    bodies.get(body).push(relative);
  }
  assert.equal(bodies.size, 1, `the decode has diverged into ${bodies.size} versions:\n${
    [...bodies.values()].map((files) => `  - ${files.join(', ')}`).join('\n')}`);
});

test('the decode matches the sRGB standard at its defining points', () => {
  // The maths the shaders run, checked against the analytic curve. If this is wrong, every demo is
  // wrong in the same direction and nothing else would reveal it.
  const decode = (channel) => (channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);

  const within = 1 / 255;
  assert.ok(Math.abs(decode(0) - 0) < 1e-12);
  assert.ok(Math.abs(decode(1) - 1) < 1e-12);
  // Mid grey: the whole point. 0.5 encoded is 0.2140 linear, not 0.5 — a 57% error if skipped.
  assert.ok(Math.abs(decode(0.5) - 0.21404114) < within, `mid grey decoded to ${decode(0.5)}`);
  // The knee, where the piecewise curve joins and the 2.2 approximation is worst.
  assert.ok(Math.abs(decode(0.04045) - 0.0031308) < within);
  // Round trip through the encode the post pass applies.
  const encode = (linear) => (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055);
  for (const value of [0, 0.02, 0.18, 0.5, 0.75, 1]) {
    assert.ok(Math.abs(encode(decode(value)) - value) < within, `round trip failed at ${value}`);
  }
});

test('every GLB packing script enforces the shared fidelity policy', async () => {
  const { SCRIPTED_DEMOS } = await import('../scripts/asset-fidelity-policy.mjs');

  // Three scripts, three kits, one policy. They stay separate because they process genuinely
  // different sources; what they must agree on is which attributes and material maps survive.
  const enforcing = [];
  for (const script of await assetScripts()) {
    if (/checkFidelity\(/.test(script.text)) enforcing.push(script.relative);
  }
  assert.ok(
    enforcing.length >= 2,
    `expected the packing scripts to import the shared policy, found: ${enforcing.join(', ') || 'none'}`,
  );

  // antiky-town is excluded on purpose, and this asserts the exclusion is a decision rather than an
  // oversight: it has no asset script at all, so there is nothing to hold to the policy.
  assert.ok(!SCRIPTED_DEMOS.includes('antiky-town'));
  const townScripts = (await assetScripts()).filter((script) => script.relative.includes('antiky-town'));
  assert.deepEqual(townScripts, [], 'antiky-town grew an asset script; revisit its policy exclusion');
});

test('the fidelity policy rejects the two defects that motivated it', async () => {
  const { checkFidelity } = await import('../scripts/asset-fidelity-policy.mjs');

  // A dropped normal map, which shipped for real.
  const dropped = checkFidelity({
    name: 'scan',
    attributes: ['POSITION', 'NORMAL', 'TEXCOORD_0'],
    sourceMaterialMaps: ['normalTexture'],
    packedMaterialMaps: [],
    materialCount: 1,
    uniqueUvCount: 5000,
  });
  assert.match(dropped.join('\n'), /does not carry it/);

  // A real texture whose unwrap was replaced by a per-material lookup.
  const collapsed = checkFidelity({
    name: 'merged',
    attributes: ['POSITION', 'NORMAL', 'TEXCOORD_0'],
    textureWidth: 2048,
    textureHeight: 2048,
    uniqueUvCount: 1,
    materialCount: 1,
  });
  assert.match(collapsed.join('\n'), /unwrap was replaced/);

  // A missing attribute.
  assert.match(
    checkFidelity({ name: 'bare', attributes: ['POSITION'], materialCount: 1, uniqueUvCount: 1 }).join('\n'),
    /missing TEXCOORD_0/,
  );

  // And it must NOT reject a legitimate flat-colour palette, which is what the platformer kit is.
  assert.deepEqual(
    checkFidelity({
      name: 'cloud-large',
      attributes: ['POSITION', 'NORMAL', 'TEXCOORD_0'],
      textureWidth: 1,
      textureHeight: 1,
      uniqueUvCount: 1,
      materialCount: 1,
    }),
    [],
  );
});

test('the antiky-town material atlas does not bleed between tiles under mipping', async () => {
  // The hazard: the three world atlases load with `filter: 'smooth'` and `anisotropy: 8`, and the
  // shader addresses tiles as `(column + uv) / 4` with no inset. Mipped, anisotropic sampling of an
  // atlas averages across tile boundaries at exactly the seams tiles meet.
  //
  // Measured rather than assumed. The atlas carries NO padding, and 1254/4 = 313.5 means the grid
  // does not even land on texel boundaries. It passes anyway, because the twelve tiles are natural
  // materials whose colour gamuts overlap — an average of two adjacent tiles lands inside one of
  // them. That is a weaker guarantee than padding would give, so this test exists to notice if a
  // future tile breaks the pattern.
  const sharp = (await import('sharp')).default;
  const file = path.join(demosRoot, 'antiky/antiky-town/assets/textures/town-material-atlas-v1.png');
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const columns = 4;
  const rows = 3;
  const tileWidth = info.width / columns;
  const tileHeight = info.height / rows;
  const at = (x, y) => {
    const index = (Math.min(info.height - 1, y) * info.width + Math.min(info.width - 1, x)) * info.channels;
    return [data[index], data[index + 1], data[index + 2]];
  };
  const quantise = ([r, g, b]) => `${r >> 2},${g >> 2},${b >> 2}`;

  const gamut = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const colours = new Set();
      for (let y = Math.ceil(row * tileHeight) + 6; y < Math.floor((row + 1) * tileHeight) - 6; y += 2) {
        for (let x = Math.ceil(column * tileWidth) + 6; x < Math.floor((column + 1) * tileWidth) - 6; x += 2) {
          colours.add(quantise(at(x, y)));
        }
      }
      gamut.push(colours);
    }
  }

  // Mip 2 is the shallowest level where a texel spans a tile boundary, and the level the goal names.
  const box = 4;
  let foreign = 0;
  let total = 0;
  for (let y = 30; y < tileHeight - 30; y += box) {
    for (let offset = -2; offset < 2; offset += 1) {
      const x0 = Math.round(tileWidth) + offset * box;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < box; dy += 1) {
        for (let dx = 0; dx < box; dx += 1) {
          const [pr, pg, pb] = at(x0 + dx, y + dy);
          r += pr; g += pg; b += pb;
        }
      }
      const samples = box * box;
      const key = quantise([Math.round(r / samples), Math.round(g / samples), Math.round(b / samples)]);
      total += 1;
      if (!gamut[0].has(key) && !gamut[1].has(key)) foreign += 1;
    }
  }
  assert.ok(total > 100, `expected a meaningful number of boundary texels, got ${total}`);
  const rate = foreign / total;
  assert.ok(rate < 0.02, `${(rate * 100).toFixed(1)}% of mip-2 boundary texels take a colour absent from both adjacent tiles`);
});
