import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  demosRoot,
  discoverAssetScripts,
  discoverDemoSources,
  discoverDemos,
  discoverShaders,
} from './shader/graph.mjs';
// One definition, imported rather than restated. It existed as three unrelated literals — here, in
// the policy, and in traversal-study's renderer — with nothing keeping them equal.
import { PALETTE_MAX_WIDTH } from '../scripts/asset-fidelity-policy.mjs';

/**
 * Source-level invariants that encode the defects the demo audit found, so they cannot return
 * quietly once they are fixed.
 *
 * These are deliberately excluded from `npm test`, which stays green as a regression gate. Run them
 * with `npm run demos:verify`. Some are expected to be red: they are targets a later goal turns
 * green, and a budget that passes the day it is written measures nothing.
 *
 * **Two rules, both learned by watching earlier versions of this file fail an audit.**
 *
 * Nothing here enumerates. Demos come from their `*.antiky` manifests and shaders from walking the
 * tree, because a hand-written list of slugs documents the day it was written and constrains nothing
 * after: a demo added later, carrying every defect these tests exist to prevent, passed all of them.
 *
 * Anything about shader behaviour reads the compiled `.gen.ts`, not the `.shader.ts`. Generated WGSL
 * has no comments and is what actually runs, and `shader-output-parity.test.mjs` proves it matches
 * the compiler. Grepping the authored source proved worthless — the sRGB decode was deleted for real
 * while the words were left in a comment, and every decode invariant stayed green.
 */

const demos = await discoverDemos();
assert.ok(demos.length >= 4, `expected to discover the demos, found ${demos.map((d) => d.slug).join(', ')}`);

/**
 * What each sampled texture holds, and therefore whether it must be decoded from sRGB.
 *
 * `colour` must be decoded; everything else must not. BroMetal exposes no sRGB texture format, so a
 * colour texel arrives display-encoded and lighting maths on it happens in the wrong space; a data
 * texel is already linear and decoding it corrupts it.
 *
 * The map is checked for **exhaustiveness** against what the shaders actually sample. A new texture
 * fails the test by name until someone says what it holds — which is the point, because the cost of
 * getting this wrong is invisible in a screenshot.
 */
const SAMPLER_ROLES = Object.freeze({
  uTex: 'colour',
  uDiffuse: 'colour',
  uMaterialAtlas: 'colour',
  uAtlas: 'colour',
  // The bloom chain, which carries linear HDR light rather than an authored picture. It is extracted
  // from a scene target that is already linear, so decoding it would apply the transfer function a
  // second time to values that never went through it once.
  uBloom: 'data',
  uSource: 'data',
  // Goal 08's planar reflection: the mirrored scene pass, already linear HDR like the target it
  // was drawn into. Decoding it would double-apply the transfer function.
  uReflection: 'data',
  // Goal 08's distortion field: a screen-space offset vector per texel, not a picture at all.
  uDistortion: 'data',
  // Distance from the light, not a picture. Decoding it as sRGB would corrupt every comparison.
  // Keyed `shadowMap` because the sample happens inside BroMetal's `shadowFactor`, so the name
  // that reaches the compiled WGSL is the helper's parameter rather than the demo's uniform.
  shadowMap: 'data',
  uArm: 'data',
  uNormalMap: 'data',
  // Surface direction, not colour. Decoding it would bend every perturbed normal toward the shallow
  // end of the curve and tilt the whole surface — the same corruption as decoding a roughness map,
  // and just as invisible until something looks subtly wrong everywhere.
  uDetailNormal: 'data',
  // The lighting ramp is authored in linear RGB by its generator, not sampled from an image, so it
  // is already in the space the shader works in. Decoding it would darken every shadow twice.
  uRamp: 'data',
  // A white sprite whose information is all in the alpha. There is no colour in it to decode, and
  // the shader tints it with whatever the effect already carries.
  uBillboard: 'data',
  // A table of roughness values addressed by the palette swatch a face lands on. Numbers, not
  // colour — decoding it would bend every roughness toward the shallow end of the sRGB curve.
  uKitMaterials: 'data',
  // A Poly Haven albedo, so display-encoded like every other colour texture and decoded on sample.
  uMaterialDiffuse: 'colour',
  // A second ground albedo blended over the first. Display-encoded like any other albedo.
  uSecondGround: 'colour',
  // NASA Blue Marble, a display-encoded photograph of the Earth's surface, lit like any albedo.
  uAlbedo: 'colour',
  // Cloud opacity, read from the red channel of a greyscale composite. A coverage fraction, not a
  // colour — decoding it would thin every cloud deck toward the shallow end of the curve.
  uClouds: 'data',
  // The star map is emissive sky, looked at rather than lit. Decoding it would crush the faint
  // stars that carry the Milky Way, which are most of what makes it read as a real sky.
  uStarMap: 'data',
  // Roughness. Numbers, not colour — decoding would bend every value toward the shallow end.
  uMaterialRoughness: 'data',
  // A stone roughness scan. Numbers, not colour.
  uStoneRough: 'data',
  uRoughness: 'data',
  uAo: 'data',
  uShadowMap: 'data',
  uScene: 'data',
});

/**
 * Where one shader treats a texture differently from its name's default, with the reason.
 *
 * These are decisions, not oversights, so they are written down rather than left to a naming
 * coincidence.
 */
const SAMPLER_EXCEPTIONS = Object.freeze({
  // Hand-painted pixel art with its shading already in the paint: median luminance 45 against
  // 80/69/83 for the demo's three material atlases. Decoding treats appearance as reflectance and
  // crushes every townsperson to orange-brown.
  'antiky/antiky-town/src/town/shaders/town-sprite.shader.gen.ts': { uAtlas: 'authored' },
  // Shadow passes read alpha for the cut-out test. town-sprite-shadow also compares .xyz against a
  // colour key, which must stay in the space the key was authored in.
  'antiky/antiky-town/src/town/shaders/town-sprite-shadow.shader.gen.ts': { uAtlas: 'mask' },
  'antiky/antiky-town/src/town/shaders/town-prop-shadow.shader.gen.ts': { uAtlas: 'mask' },
  'antiky/antiky-town/src/town/shaders/town-foliage-shadow.shader.gen.ts': { uAtlas: 'mask' },
  // UI drawn over the scene and shown as authored, not lit.
  'antiky/point-light-expo/src/shaders/onboarding.shader.gen.ts': { uAtlas: 'authored' },
});

function roleOf(shader, texture) {
  return SAMPLER_EXCEPTIONS[shader.relative]?.[texture] ?? SAMPLER_ROLES[texture];
}

/** Every compiled shader across every demo, with its demo attached. */
async function allShaders() {
  const shaders = [];
  for (const demo of demos) {
    for (const shader of await discoverShaders(demo)) shaders.push({ ...shader, demo: demo.slug });
  }
  assert.ok(shaders.length >= 25, `expected to find the demos' shaders, found ${shaders.length}`);
  return shaders;
}

/**
 * Every GLB a demo ships, read as data rather than inferred from the script that made it.
 *
 * Reading the artifact is the point: a script can be rewritten, replaced or bypassed, and what
 * matters is what reaches the game. These model tests are the strongest in this file for exactly
 * that reason — they caught a real dropped normal map during an audit that defeated most of the
 * source-level checks around them.
 */
async function shippedModels() {
  const models = [];
  for (const demo of demos) {
    const files = [];
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
        else if (entry.isFile() && entry.name.endsWith('.glb')) files.push(full);
      }
    };
    await walk(path.join(demo.directory, 'assets'));

    for (const file of files) {
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
        demo: demo.slug,
        textureWidth,
        textureHeight,
        uniqueUvs: uvs.size,
        materialCount: Math.max(1, (json.materials ?? []).length),
        hasNormalTexture: (json.materials ?? []).some((material) => material.normalTexture !== undefined),
      });
    }
  }
  assert.ok(models.length >= 15, `expected to find the shipped models, found ${models.length}`);
  return models;
}

/** Every asset script across every demo, discovered rather than listed. */
async function assetScripts() {
  const scripts = await discoverAssetScripts(demos);
  assert.ok(scripts.length >= 5, `expected to find the asset scripts, found ${scripts.length}`);
  return scripts;
}

/** Every TypeScript module across every demo. */
async function demoSources() {
  const sources = [];
  for (const demo of demos) {
    for (const source of await discoverDemoSources(demo)) sources.push({ ...source, demo: demo.slug });
  }
  assert.ok(sources.length >= 80, `expected to find the demo sources, found ${sources.length}`);
  return sources;
}

/**
 * Far-plane constants declared in a different file from the camera that uses them, read from source.
 *
 * A hand-copied literal goes stale the moment the real constant moves: with `FAR_DEPTH` frozen at
 * 180 here, setting the real one to 3000 — an 8333:1 ratio against a 500:1 budget — passed.
 */
async function farConstants() {
  const constants = {};
  for (const source of await demoSources()) {
    for (const [, name, value] of source.text.matchAll(/^export const ([A-Z_][A-Z0-9_]*) = ([\d.]+)\s*;/gm)) {
      constants[name] = Number(value);
    }
  }
  assert.ok(constants.FAR_DEPTH !== undefined, 'FAR_DEPTH is no longer exported from any demo source');
  return constants;
}

test('no asset script discards the normal map it downloaded', async () => {
  const offenders = [];
  for (const script of await assetScripts()) {
    // Comments are stripped first: the fix for this defect is documented in the very scripts being
    // scanned, and a comment describing the mistake is not the mistake.
    const code = script.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/delete\s+[\w.]*\bnormalTexture\b/.test(code)) offenders.push(script.relative);
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
  let scanned = 0;
  for (const model of await shippedModels()) {
    scanned += 1;
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
  assert.ok(scanned >= 15, `expected to inspect every shipped model, inspected ${scanned}`);
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
  let scanned = 0;
  for (const model of await shippedModels()) {
    scanned += 1;
    if (model.textureWidth === undefined || model.textureHeight !== 1) continue;
    if (model.textureWidth > PALETTE_MAX_WIDTH) {
      offenders.push(`${model.relative}: ${model.textureWidth}x1 is too wide to be a colour palette`);
    }
  }
  assert.ok(scanned >= 15, `expected to inspect every shipped model, inspected ${scanned}`);
  assert.deepEqual(offenders, []);
});

test('no camera wastes depth precision on an extreme far/near ratio', async () => {
  // A large far/near ratio spends most of the depth buffer on the first fraction of a metre, which
  // nothing in these scenes occupies. Budget is 500:1.
  //
  // Both sides accept a named constant. Requiring `near` to be a numeric literal let
  // `near: NEAR_PLANE` with `NEAR_PLANE = 0.001` — a 60000:1 ratio — match nothing and pass.
  const shared = await farConstants();
  const offenders = [];
  let camerasSeen = 0;
  {
    for (const source of await demoSources()) {
      const constants = new Map(Object.entries(shared));
      for (const match of source.text.matchAll(/^\s*(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=\s*([\d.]+)\s*;/gm)) {
        constants.set(match[1], Number(match[2]));
      }
      // A type annotation (`near: number, far: number`) is a declaration, not a camera.
      const TYPE_NAMES = new Set(['number', 'string', 'boolean', 'undefined', 'null', 'any', 'unknown']);
      const value = (token) => (Number.isNaN(Number(token)) ? constants.get(token) : Number(token));
      const pattern = /near:\s*([\d.]+|[A-Za-z_][A-Za-z0-9_]*)\s*,\s*far:\s*([\d.]+|[A-Za-z_][A-Za-z0-9_]*)/g;
      for (const match of source.text.matchAll(pattern)) {
        if (TYPE_NAMES.has(match[1]) || TYPE_NAMES.has(match[2])) continue;
        const near = value(match[1]);
        const far = value(match[2]);
        if (near === undefined || far === undefined) {
          offenders.push(`${source.relative}: near/far uses a name this test cannot resolve (${match[1]}, ${match[2]})`);
          continue;
        }
        camerasSeen += 1;
        if (near === 0) {
          offenders.push(`${source.relative}: near is zero`);
          continue;
        }
        const ratio = far / near;
        if (ratio > 500.5) {
          offenders.push(`${source.relative}: far/near = ${ratio.toFixed(0)}:1 (near ${near}, far ${far})`);
        }
      }
    }
  }
  // Without this the whole scan can quietly match nothing — a renamed option, a different call
  // shape — and report success.
  assert.ok(camerasSeen >= 5, `expected to find at least five cameras to check, found ${camerasSeen}`);
  assert.deepEqual(offenders, [], 'Raise `near` until the ratio is at most 500:1.');
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
  { name: 'cables', why: 'a third saturated hue looping the arena rim, competing with both team colours' },
]);

test('the dead code this objective deleted has not come back', async () => {
  const offenders = [];
  let scanned = 0;
  {
    for (const source of await demoSources()) {
      scanned += 1;
      for (const { name, why } of DELETED_NAMES) {
        if (new RegExp(`\\b${name}\\b`).test(source.text)) {
          offenders.push(`${source.relative}: ${name} — removed because ${why}`);
        }
      }
    }
  }
  assert.ok(scanned >= 20, `expected to scan every demo source, scanned ${scanned}`);
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
 * The antiky-town actor atlas is deliberately absent from the list above. It is hand-painted pixel
 * art whose shading is already in the paint — median luminance 45 against 80/69/83 for the demo's
 * three material atlases — so decoding it treats appearance as reflectance and crushes every
 * townsperson to orange-brown. The reasoning is written out at the sample site in
 * town-sprite.shader.ts.
 */

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

test('every script that writes a model enforces the shared fidelity policy', async () => {
  const { SCRIPTED_DEMOS } = await import('../scripts/asset-fidelity-policy.mjs');

  // Which scripts are covered is derived from what they do, not from a list. Naming three paths was
  // stronger than counting them and still constrained nothing else: a new script that wrote GLBs
  // without the policy passed, because it was not one of the three named.
  const writesModels = (script) => /\.glb\b/.test(script.code)
    && /writeFile|createWriteStream|copyFile/.test(script.code);

  const scripts = await assetScripts();
  const writers = scripts.filter(writesModels);
  assert.ok(writers.length >= 2, `expected to find the model-writing scripts, found ${writers.length}`);

  // A script satisfies the rule by checking, or by handing the writing to something that checks.
  // `pack-catalog-models.mjs` builds the configuration and delegates every byte to
  // `packExternalGltfToGlb`, which asserts against the material it is about to write.
  const delegates = /packExternalGltfToGlb\(/;
  const missing = writers
    .filter((script) => !/checkFidelity\(/.test(script.code) && !delegates.test(script.code))
    .map((script) => script.relative);
  assert.deepEqual(
    missing,
    [],
    'These scripts write models without checking the shared fidelity policy. Import checkFidelity '
    + 'and assert before writing.',
  );

  // antiky-town is excluded on purpose, and this asserts the exclusion is a decision rather than an
  // oversight: it has no asset script at all, so there is nothing to hold to the policy.
  assert.ok(!SCRIPTED_DEMOS.includes('antiky-town'));
  assert.deepEqual(
    scripts.filter((script) => script.demo === 'antiky-town').map((script) => script.relative),
    [],
    'antiky-town grew an asset script; revisit its policy exclusion',
  );
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

test('every mipped atlas declares a gutter and is sampled inside it', async () => {
  // What bleeding actually is: an atlas packs many textures into one image, the GPU averages
  // neighbouring pixels to build mip levels, and near a tile's edge that average reaches into the
  // tile next door. Stone picks up the grass beside it in the file.
  //
  // This is a structural check, and that is a deliberate change from what was here before. The
  // previous version compared the average of two neighbouring tiles against the colours it had
  // already seen in them, which measures *palette overlap*, not bleeding: extruding each tile's edge
  // — the actual fix — made the number WORSE, 25.3% to 31.8%, and the only thing that reached zero
  // was flattening every tile to a single colour. A metric whose best score is achieved by
  // destroying the art is measuring the wrong thing.
  //
  // Two properties prevent bleeding, and both are checkable without guessing at a filter kernel:
  // the atlas carries a gutter wide enough for the mip levels it reaches, and the shader samples
  // inside it. Goal 14 delivers both; goal 15 removes the need for either by giving each tile its
  // own array layer.
  //
  // Both halves are checked here. `checkAtlasLayout` holds the descriptor to the shared policy — a
  // gutter at least as wide as a mip-6 texel, per-tile rectangles, and rectangles that land on whole
  // texels — and then the image itself is opened and every inner-rectangle edge is compared against
  // the gutter pixel beside it.
  const { checkAtlasLayout } = await import('../scripts/asset-fidelity-policy.mjs');
  const failures = [];
  let atlases = 0;
  let extrusionsProbed = 0;
  for (const demo of demos) {
    let entries;
    try {
      entries = await readdir(path.join(demo.directory, 'assets', 'textures'), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const descriptorPath = path.join(demo.directory, 'assets', 'textures', entry.name);
      const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
      if (descriptor.grid === undefined) continue;
      atlases += 1;

      const relative = path.relative(demosRoot, descriptorPath);
      // What the atlas *claims*, held to the shared policy so one rule covers the packer, this test,
      // and any atlas that arrives later from somewhere else.
      failures.push(...checkAtlasLayout(descriptor, relative));
      if (checkAtlasLayout(descriptor, relative).length > 0) continue;

      // And what the atlas *is*. A declared gutter is checked against the image, never taken on
      // trust: `"gutter": 8` typed into the JSON with the pixels untouched turned an earlier version
      // of this test green while every tile still sat edge-to-edge.
      //
      // The probe is at the inner rectangle's edge, not at the cell boundary. Two neighbouring cells
      // meet gutter-to-gutter and are *supposed* to change abruptly there — they hold different
      // materials. What must be continuous is the step from the last pixel a shader samples to the
      // first pixel of the gutter beside it, because the gutter is that pixel extruded. Probing the
      // cell boundary instead measured the one place the layout does not promise anything, and
      // reported 82% abrupt on a correctly packed atlas.
      const image = path.join(path.dirname(descriptorPath), descriptor.image);
      const sharp = (await import('sharp')).default;
      const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
      const at = (x, y) => {
        const index = (y * info.width + x) * info.channels;
        return [data[index], data[index + 1], data[index + 2], info.channels === 4 ? data[index + 3] : 255];
      };
      let abrupt = 0;
      let sampled = 0;
      for (const rect of descriptor.tileRects) {
        const left = Math.round(rect.x * info.width);
        const width = Math.round(rect.width * info.width);
        const top = Math.round((1 - rect.y - rect.height) * info.height);
        const height = Math.round(rect.height * info.height);
        for (let y = top; y < top + height; y += 8) {
          for (const [inside, outside] of [[left, left - 1], [left + width - 1, left + width]]) {
            const change = Math.max(...[0, 1, 2, 3].map((c) => Math.abs(at(inside, y)[c] - at(outside, y)[c])));
            sampled += 1;
            if (change > 0) abrupt += 1;
          }
        }
        for (let x = left; x < left + width; x += 8) {
          for (const [inside, outside] of [[top, top - 1], [top + height - 1, top + height]]) {
            const change = Math.max(...[0, 1, 2, 3].map((c) => Math.abs(at(x, inside)[c] - at(x, outside)[c])));
            sampled += 1;
            if (change > 0) abrupt += 1;
          }
        }
      }
      extrusionsProbed += sampled;
      if (abrupt > 0) {
        failures.push(
          `${relative}: declares a gutter of ${descriptor.gutter} but ${abrupt} of ${sampled} `
          + 'inner-rectangle edges differ from the pixel outside them — the edge was never extruded.',
        );
      }
    }
  }
  assert.ok(extrusionsProbed > 1000, `expected to walk every tile edge, walked ${extrusionsProbed}`);
  assert.ok(atlases >= 3, `expected to find the demo atlases, found ${atlases}`);
  assert.deepEqual(
    failures,
    [],
    'Build these with `build-texture-atlas.mjs` so each tile carries an extruded gutter and the '
    + 'layout publishes the inner rectangle a shader should sample.',
  );
});

test('every sampled texture is classified as colour or data', async () => {
  // Exhaustiveness, so the two tests below cannot pass by not knowing about a texture. A shader that
  // starts sampling something new fails here by name until someone says what it holds.
  const unclassified = [];
  let pairs = 0;
  for (const shader of await allShaders()) {
    for (const texture of shader.sampledTextures) {
      pairs += 1;
      if (roleOf(shader, texture) === undefined) unclassified.push(`${shader.relative}: ${texture}`);
    }
  }
  assert.ok(pairs >= 20, `expected many sampled textures, found ${pairs}`);
  assert.deepEqual(
    unclassified,
    [],
    'Add these to SAMPLER_ROLES, or to SAMPLER_EXCEPTIONS with the reason if one shader treats it '
    + 'differently. Guessing is worse than failing: decoding a normal map corrupts it silently.',
  );
});

test('every colour texture is decoded from sRGB, and no data texture is', async () => {
  // Read from the compiled WGSL and traced through its bindings, so neither a comment, a rename, nor
  // an extra hop between the sample and the decode can fake it.
  const wrong = [];
  let colourSamples = 0;
  for (const shader of await allShaders()) {
    const decoded = shader.reaches('decodeSrgb');
    for (const texture of shader.sampledTextures) {
      const role = roleOf(shader, texture);
      if (role === 'colour') {
        colourSamples += 1;
        if (!decoded.has(texture)) {
          wrong.push(`${shader.relative}: ${texture} is colour but never reaches decodeSrgb`);
        }
      } else if (decoded.has(texture)) {
        wrong.push(`${shader.relative}: ${texture} is ${role} and must not be decoded`);
      }
    }
  }
  assert.ok(colourSamples >= 8, `expected several colour textures, found ${colourSamples}`);
  assert.deepEqual(wrong, []);
});

test('the sRGB decode in every shipped shader is the real curve', async () => {
  // The helper is duplicated because the BroMetal MVP resolves only helpers declared in the same
  // module. Duplication is forced; drift is not. Comparing the compiled body means a renamed
  // function or a rewritten approximation cannot hide behind identical formatting.
  const bodies = new Map();
  for (const shader of await allShaders()) {
    if (!shader.calls('decodeSrgb')) continue;
    const match = shader.wgsl.match(/fn channelToLinear\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
    assert.ok(match, `${shader.relative}: declares decodeSrgb with no channelToLinear body`);
    const body = match[1].replace(/\s+/g, ' ').trim();
    for (const constant of ['0.04045', '12.92', '2.4']) {
      assert.ok(body.includes(constant), `${shader.relative}: the decode is missing ${constant}`);
    }
    if (!bodies.has(body)) bodies.set(body, []);
    bodies.get(body).push(shader.relative);
  }
  assert.ok(bodies.size > 0, 'no shader ships the decode at all');
  assert.equal(bodies.size, 1, `the decode has diverged into ${bodies.size} versions:\n${
    [...bodies.values()].map((files) => `  - ${files.join(', ')}`).join('\n')}`);
});

test('the sRGB encode in every shipped shader is the decode run backwards', async () => {
  // The other half of colour management, and the same duplication constraint: the BroMetal MVP
  // resolves only helpers declared in the same module, so `encodeSrgb` is copied per shader.
  //
  // Goal 04 shipped the decode without this. Lighting then ran on correct numbers and wrote them out
  // as though they were already display-encoded, and point-light-expo's luminance p95 fell from
  // 0.090 to 0.050. That is what a missing encode costs.
  const bodies = new Map();
  for (const shader of await allShaders()) {
    if (!shader.calls('encodeSrgb')) continue;
    const match = shader.wgsl.match(/fn channelToDisplay\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
    assert.ok(match, `${shader.relative}: declares encodeSrgb with no channelToDisplay body`);
    const body = match[1].replace(/\s+/g, ' ').trim();
    // The inverse curve's own constants. 2.2 anywhere here means the approximation crept back in,
    // and it is wrong by about 7/255 in the darks this scene lives in.
    for (const constant of ['0.0031308', '12.92', '1.055', '0.055']) {
      assert.ok(body.includes(constant), `${shader.relative}: the encode is missing ${constant}`);
    }
    assert.ok(
      !/\b2\.2\b/.test(body),
      `${shader.relative}: the encode uses a 2.2 gamma rather than the piecewise sRGB curve`,
    );
    if (!bodies.has(body)) bodies.set(body, []);
    bodies.get(body).push(shader.relative);
  }
  assert.ok(bodies.size > 0, 'no shader ships the encode at all');
  assert.equal(bodies.size, 1, `the encode has diverged into ${bodies.size} versions:\n${
    [...bodies.values()].map((files) => `  - ${files.join(', ')}`).join('\n')}`);
});

test('a shader that encodes does it once, at the end', async () => {
  // Encoding twice darkens the frame as badly as not encoding brightens it, and neither looks like
  // an obvious mistake on screen — both just look like a grading choice somebody made.
  const offenders = [];
  let encoders = 0;
  for (const shader of await allShaders()) {
    if (!shader.calls('encodeSrgb')) continue;
    encoders += 1;
    const calls = [...shader.wgsl.matchAll(/encodeSrgb\(/g)].length;
    // One definition site plus one call. More than that is a second application.
    if (calls > 2) offenders.push(`${shader.relative}: encodeSrgb appears ${calls} times`);
  }
  // **Once a demo has a post pass, the post pass is the only thing allowed to encode.** Before it
  // has one, every shader writing a final pixel needs its own copy.
  //
  // That is not a loophole, it is the migration. Goal 06 walked point-light-expo through exactly
  // these two states — 06-01 put a copy in every final-pixel shader, 06-02 gave the demo one RGBA16F
  // target and one pass reading it, and the copies collapsed. Goal 07 walks the other three demos
  // through the same two states, so the rule has to be asked per demo rather than globally, or the
  // first half of every demo's migration is a failure by definition.
  //
  // What it still catches is the thing that matters: a material shader encoding *alongside* a post
  // pass, which writes display data into a linear buffer for the post pass to encode a second time.
  assert.ok(encoders >= 1, 'no shader encodes at all');
  const byDemo = new Map();
  for (const shader of await allShaders()) {
    if (!shader.calls('encodeSrgb')) continue;
    const demo = shader.relative.split('/src/')[0];
    if (!byDemo.has(demo)) byDemo.set(demo, []);
    byDemo.get(demo).push(shader.relative);
  }
  let collapsed = 0;
  for (const [demo, relatives] of byDemo) {
    const hasPostPass = relatives.some((relative) => /post\.shader\.gen\.ts$/.test(relative));
    if (!hasPostPass) continue;
    collapsed += 1;
    assert.deepEqual(
      relatives.filter((relative) => !/post\.shader\.gen\.ts$/.test(relative)),
      [],
      `${demo} has a post pass, so nothing else in it may encode`,
    );
  }
  // At least one demo must have finished the collapse, or this is asserting nothing.
  assert.ok(collapsed >= 1, 'no demo has collapsed its encode into a post pass');
  assert.deepEqual(offenders, []);
});

test('no material shader tone-maps, because tone-mapping belongs in one post pass', async () => {
  // A material that tone-maps itself crushes the value range before anything can composite onto it,
  // which is why the demo VFX read as flat stickers. One post pass per demo is allowed to.
  const offenders = [];
  let scanned = 0;
  for (const shader of await allShaders()) {
    scanned += 1;
    if (/(^|\/)[\w-]*post\.shader\.gen\.ts$/.test(shader.relative)) continue;
    if (shader.calls('tonemapACES')) offenders.push(shader.relative);
  }
  assert.ok(scanned >= 25, `expected to scan every shipped shader, scanned ${scanned}`);
  assert.deepEqual(offenders, []);
});

test('no material sample silently loses its mip chain', async () => {
  // A `texture()` call inside a DSL helper compiles to `textureSampleLevel(..., 0.0)` and drops the
  // mip chain without warning, which is why every material sample is inlined in `fragment()`.
  //
  // The shadow map is the one sample that *should* be pinned to level 0, and it is exempt by name
  // rather than by widening the rule. It carries no mip chain — `shadow-pass.ts` creates it with no
  // mips at all — and averaging two distances across a silhouette produces a number belonging to
  // neither surface. It is also read through BroMetal's own `shadowFactor`, so inlining it in
  // `fragment()` is not available even if it were wanted.
  const PINNED_ON_PURPOSE = new Set(['shadowMap']);
  const offenders = [];
  let exempted = 0;
  for (const shader of await allShaders()) {
    for (const sample of shader.samples) {
      if (sample.level !== 'explicit') continue;
      if (PINNED_ON_PURPOSE.has(sample.texture)) { exempted += 1; continue; }
      offenders.push(`${shader.relative}: ${sample.texture}`);
    }
  }
  assert.deepEqual(offenders, [], 'Inline the texture() call in fragment() rather than wrapping it.');
  // The exemption is only safe while something uses it; if the shadow map stops being sampled this
  // says so rather than sitting here forever protecting nothing.
  assert.ok(exempted >= 3, `expected the three material shaders to sample the shadow map, saw ${exempted}`);
});

test('every demo agrees with itself about where its light comes from', async () => {
  // A light is identified by what it does — it is the vector dotted with the surface normal — not by
  // what it is called or which way it points.
  //
  // Three separate evasions defeated the previous version, which matched five identifier names and
  // required the vector to point upward: renaming `light` to `sunDir`, flipping the sun to point
  // downward, and assembling it from three component constants instead of one literal. All three
  // are still dotted with the normal, because that is what lighting a surface means.
  //
  // The first such direction in a shader is its key. A key and a fill are not a disagreement; two
  // different keys are, and that was the original defect — the arena floor lit from the opposite
  // side to the ships standing on it.
  const disagreements = [];
  let demosWithLight = 0;
  for (const demo of demos) {
    const keys = new Map();
    for (const shader of await discoverShaders(demo)) {
      const directions = [...shader.lightDirections().keys()];
      if (directions.length === 0) continue;
      const key = directions[0];
      if (!keys.has(key)) keys.set(key, []);
      keys.get(key).push(shader.relative);
    }
    if (keys.size === 0) continue;
    demosWithLight += 1;
    if (keys.size > 1) disagreements.push({ demo: demo.slug, keys: Object.fromEntries(keys) });
  }
  assert.ok(demosWithLight >= 3, `expected several demos to light something, found ${demosWithLight}`);
  assert.deepEqual(
    disagreements,
    [],
    'Objects lit by different suns cannot read as one space. One key direction per demo — a shared '
    + 'uniform is fine and is what antiky-town does.',
  );
});

test('every demo agrees with itself about its fog range', async () => {
  // Fog is identified by what it measures: a smoothstep over the distance from the camera to this
  // fragment. The distance is traced through its bindings, so writing
  // `const d = length(uCameraPosition.sub(vWorld)); smoothstep(2, 9, d)` no longer hides the range —
  // that evasion worked against the previous version, which required the argument to contain the
  // uniform's name literally.
  //
  // A previous comment in this file claimed the argument was traced when it was not. That is the
  // same failure the WGSL rewrite exists to prevent, written into a test rather than a shader.
  const disagreements = [];
  let ranges = 0;
  for (const demo of demos) {
    const found = new Map();
    for (const shader of await discoverShaders(demo)) {
      for (const [range, files] of shader.fogRanges()) {
        if (!found.has(range)) found.set(range, []);
        found.get(range).push(`${shader.relative}${files === 'uniform' ? ' (uniform)' : ''}`);
      }
    }
    ranges += found.size;
    if (found.size > 1) disagreements.push({ demo: demo.slug, ranges: Object.fromEntries(found) });
  }
  assert.ok(ranges > 0, 'found no fog at all — the analysis no longer recognises it');
  assert.deepEqual(
    disagreements,
    [],
    'Fog is a property of the scene, not of a material. Different ranges in one demo make near and '
    + 'far objects disagree about how far away they are.',
  );
});

test('the specular model in every shader that ships one is the same model', async () => {
  // Same forced duplication as the sRGB decode: the BroMetal MVP resolves only helpers declared in
  // the module that uses them, so `specularGGX` is copied into all three point-light-expo material
  // shaders. Comparing the compiled body means a rewritten approximation cannot hide behind
  // identical formatting, and a call site that quietly tunes its own copy shows up here.
  //
  // The constants asserted are the three terms that make the model energy-conserving, which is what
  // let goal 06-03 delete the `min(specGGX(…), 1.5)` ceilings and the `* 0.12` scale factors. A copy
  // missing any of them is the old distribution-only term wearing the new name.
  const bodies = new Map();
  for (const shader of await allShaders()) {
    if (!shader.calls('specularGGX')) continue;
    const match = shader.wgsl.match(/fn specularGGX\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
    assert.ok(match, `${shader.relative}: calls specularGGX with no body`);
    const body = match[1].replace(/\s+/g, ' ').trim();
    // The Smith visibility term, which carries the 1 / (4 · N·L · N·V) the old constant 0.25
    // stood in for.
    assert.ok(body.includes('sqrt('), `${shader.relative}: no visibility term`);
    assert.ok(body.includes('0.5'), `${shader.relative}: no visibility numerator`);
    // The GGX distribution.
    assert.ok(body.includes('3.14159265'), `${shader.relative}: no distribution denominator`);
    if (!bodies.has(body)) bodies.set(body, []);
    bodies.get(body).push(shader.relative);
  }
  assert.ok(bodies.size > 0, 'no shader ships the specular model at all');
  assert.equal(bodies.size, 1, `the specular model has diverged into ${bodies.size} versions:\n${
    [...bodies.values()].map((files) => `  - ${files.join(', ')}`).join('\n')}`);
});

test('no point-light-expo shader still uses the distribution-only specular term', async () => {
  // `specGGX` is BroMetal's own helper and other demos still call it — that is goal 07's problem,
  // not this one. Inside this demo it is gone, and this stops it coming back through a copied block.
  const offenders = (await allShaders())
    .filter((shader) => shader.relative.startsWith('antiky/point-light-expo/'))
    .filter((shader) => shader.calls('specGGX'))
    .map((shader) => shader.relative);
  assert.deepEqual(offenders, []);
});

test('every shader that reads the shadow map agrees about how to read it', async () => {
  // Softness, bias and texel size are literals in each material shader rather than uniforms,
  // because nothing varies them at run time. Duplication is the price of that, and this is what
  // stops the copies drifting: a floor whose penumbra is wider than the rock standing on it reads
  // as two different lights, and the cause is invisible in a capture.
  //
  // The texel is the one most worth guarding. It has to equal 1 / SHADOW_MAP_SIZE from `sun.ts`,
  // and nothing in the shader can check that — a wrong value silently resizes the penumbra rather
  // than failing.
  const constants = new Map();
  for (const shader of await allShaders()) {
    if (!shader.calls('shadowFactor')) continue;
    // `[^;{]*` so this cannot run from the `fn shadowFactor(` declaration down to the first
    // call site and swallow the whole body, which is what the first version of this did.
    const call = shader.wgsl.match(/shadowFactor\s*\(([^;{]*)\)\s*;/);
    assert.ok(call, `${shader.relative}: calls shadowFactor but the call could not be read`);
    const numbers = call[1].split(',').map((argument) => argument.trim()).filter(
      (argument) => /^[0-9.]+$/.test(argument),
    );
    const key = numbers.join('|');
    if (!constants.has(key)) constants.set(key, []);
    constants.get(key).push(shader.relative);
  }
  assert.ok(constants.size > 0, 'no shader reads a shadow map at all');
  assert.equal(constants.size, 1, `shadow lookups disagree:\n${
    [...constants.entries()].map(([key, files]) => `  ${key} — ${files.join(', ')}`).join('\n')}`);
  // 1 / 2048, the shadow map's own size. Stated here so a change to `SHADOW_MAP_SIZE` that misses
  // the shaders fails rather than quietly rescaling every penumbra.
  const [only] = [...constants.keys()];
  assert.ok(
    only.split('|').includes('0.00048828125'),
    `the shadow texel is not 1 / 2048: ${only}`,
  );
});
