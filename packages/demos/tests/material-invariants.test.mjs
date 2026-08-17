import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  discoverDemos,
  discoverDemoSources,
  discoverShaders,
} from './shader/graph.mjs';

/**
 * Material invariants for goal 05.
 *
 * `pipeline-invariants.test.mjs` next door asserts the *pipeline* is coherent — colour decoded once,
 * one key light, one fog range. This file asserts the surfaces have material to show: a normal map
 * that reaches the output, and the acceptance criteria from `03-ART-DIRECTION-AND-VFX.md` that can
 * be decided from source alone.
 *
 * Everything here reads compiled WGSL rather than shader source, for the reason the sibling file
 * records: the `.gen.ts` is what runs on the GPU, it has no comments to hide an assertion in, and
 * `shader-output-parity.test.mjs` proves it is what the compiler actually produced.
 */

/**
 * Which shaders draw geometry loaded from a GLB, derived rather than listed.
 *
 * The thing that makes a program a model program is that its vertex attributes are fed from a
 * loaded mesh — `program.attributes.aPosition.set(mesh.positions)`. So this walks back from each
 * such binding to the `createProgram` that produced the program, and records the shader it named.
 *
 * "Any shader in a module that mentions `loadGlb`" is the obvious rule and it is wrong:
 * `traversal-study` builds its glow and terrain programs in the same file as its model programs, and
 * that rule called all three model shaders. Deriving from the mesh binding names only the two that
 * actually draw a mesh.
 *
 * Where the call is indirected through an injected factory — `dependencies.createProgram(renderer)`,
 * the shape `combat-arena` and `point-light-expo` use for testability — the call site names no
 * shader, so the module's single imported shader is the answer. That fallback is only safe because
 * it applies when there is exactly one candidate, and the test asserts it never fires ambiguously.
 */
async function glbDrawingShaders(demo) {
  const drawn = new Set();
  for (const module of await discoverDemoSources(demo)) {
    if (!/\bloadGlb\b/.test(module.text)) continue;

    const imported = new Map();
    // Both spellings ship here: `'./x.shader.gen.ts'` and `'./x.shader.gen'`. Requiring the
    // extension silently dropped `traversal-study`'s model shader out of this check.
    for (const [, binding, specifier] of module.text.matchAll(
      /import\s+(\w+)\s+from\s+'([^']*\.shader\.gen(?:\.ts)?)'/g,
    )) {
      imported.set(binding, specifier.endsWith('.ts') ? specifier : `${specifier}.ts`);
    }
    if (imported.size === 0) continue;

    // The variables holding GLB mesh data, taken from where they are bound. Every demo reaches a
    // mesh through `model.meshes`, and procedural geometry never does — which is the difference
    // between `traversal-study`'s model program and the terrain and glow programs beside it.
    const meshVariables = new Set([
      ...[...module.text.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*[\w.]*\.meshes\b/g)]
        .map(([, name]) => name),
      ...[...module.text.matchAll(/for\s*\(\s*(?:const|let)\s+(\w+)\s+of\s+[\w.]*\.meshes\b/g)]
        .map(([, name]) => name),
    ]);
    if (meshVariables.size === 0) continue;

    const creations = [...module.text.matchAll(/createProgram\(\s*([\w.]+)\s*(?:,\s*(\w+))?/g)]
      .map((match) => ({ at: match.index, shader: match[2] }));

    for (const binding of module.text.matchAll(/attributes\.\w+!?\.set\(\s*(\w+)\.positions/g)) {
      if (!meshVariables.has(binding[1])) continue;
      const preceding = creations.filter((creation) => creation.at < binding.index).pop();
      if (preceding === undefined) continue;
      const named = preceding.shader !== undefined && imported.has(preceding.shader)
        ? imported.get(preceding.shader)
        : imported.size === 1 ? [...imported.values()][0] : undefined;
      if (named === undefined) continue;
      drawn.add(path.normalize(path.join(path.dirname(module.relative), named)));
    }
  }
  return drawn;
}

test('AC-M3: every shader that draws GLB geometry samples a normal map that survives to the output', async () => {
  const demos = await discoverDemos();
  assert.ok(demos.length >= 4, `expected the four Antiky demos, found ${demos.length}`);

  const missing = [];
  let checked = 0;
  for (const demo of demos) {
    const drawsModels = await glbDrawingShaders(demo);
    const shaders = await discoverShaders(demo);
    for (const shader of shaders) {
      if (!drawsModels.has(path.normalize(shader.relative))) continue;
      checked += 1;
      // Declared is not enough: a sampler can be bound and never read. Reaching the output is the
      // stronger claim, and it is the strongest one available here.
      //
      // What this deliberately does not claim: that the normal map changes the picture. Reaching the
      // output is a statement about names, and a perturbation scaled to zero carries its name to the
      // return exactly like a live one. Asking the arithmetic question instead does not work — once
      // the perturbed normal feeds the lighting, every downstream term is "derived from" the texture,
      // so an honest scan cannot tell `* 0.0` from the `* 0.12` beside it.
      //
      // AC-M1 is what closes that gap, and it closes it properly: luminance standard deviation of at
      // least 0.020 across a flat surface in a captured frame. A dead normal map cannot pass it,
      // because a flat surface with no working perturbation is constant. Source analysis proves the
      // wiring; only a picture proves the effect.
      const live = shader.liveTextures();
      const normalMaps = [...live].filter((texture) => /normal/i.test(texture));
      if (normalMaps.length === 0) {
        const declared = shader.samplers.filter((texture) => /normal/i.test(texture));
        missing.push(
          `${shader.relative}: ${declared.length === 0
            ? 'declares no normal-map sampler'
            : `declares ${declared.join(', ')} but the sampled value never reaches the output`}`,
        );
      }
    }
  }

  // Without this the whole loop can pass by discovering nothing at all.
  assert.ok(
    checked >= 4,
    `expected to find at least four GLB-drawing shaders across the demos, found ${checked}. `
    + 'The discovery rule is wrong, and an empty sweep would otherwise pass this test.',
  );
  assert.deepEqual(missing, [], `shaders drawing GLB geometry with no live normal map:\n  ${missing.join('\n  ')}`);
});

test('AC-V3: a time-driven pulse varies its rate per instance, not just its phase', async () => {
  /**
   * The metronome problem.
   *
   * `sin(uTime * K + iPhase)` with one shared `K` looks varied for a second and then is not: the
   * instances are offset but they run at the same rate, so they drift into alignment and pulse
   * together for the rest of the session. A crowd of effects breathing in unison reads as one
   * mechanism, which is the opposite of what a crowd of effects is for.
   *
   * The fix is to vary the rate as well, so they never re-synchronise. This asserts the shape: any
   * `sin`/`cos` whose argument multiplies `uTime` must multiply it by something carrying a
   * per-instance attribute, not by a bare constant.
   *
   * Scoped to values that reach an **alpha**, which is what the criterion says and what matters. A
   * global rate is correct for a field: wind blows across the whole town at one speed and water
   * waves travel at one speed, and making those per-instance would be wrong, not varied. It is
   * per-object opacity that must not march in step. An earlier version of this test flagged the
   * foliage wind and the fountain waves and would have pushed someone into breaking both.
   *
   * Read from compiled WGSL, where per-instance attributes are unambiguously `bm_in.i*` — the source
   * spelling varies by demo and a comment could claim anything.
   */
  const offenders = [];
  let checked = 0;
  for (const demo of await discoverDemos()) {
    for (const shader of await discoverShaders(demo)) {
      // `(uTime * <rate>` inside a trig call, with the rate captured.
      // Assignments into anything alpha-shaped, whether a varying or the fragment's output.
      for (const [, target, value] of shader.wgsl.matchAll(
        /(?:let|var)?\s*\b(\w*[Aa]lpha\w*)\s*=\s*([^;]*);/g,
      )) {
        if (!/\b(?:sin|cos)\s*\(/.test(value) || !/\bbm_u\.uTime\b/.test(value)) continue;
        checked += 1;
        // Either a parenthesised factor or a bare one. Stopping at the first `)` or `+` cut
        // `(4.1 + bm_in.iPhase * 1.9)` down to `(4.1` and reported a correct shader as broken.
        const rate = value.match(/\bbm_u\.uTime\s*\*\s*(\([^)]*\)|[\w.]+)/);
        if (rate === null || !/\bbm_in\.i\w+/.test(rate[1])) {
          offenders.push(
            `${shader.relative}: ${target} pulses on uTime * ${(rate?.[1] ?? '?').trim().slice(0, 32)}`
            + ' — one rate for every instance, so they drift into unison',
          );
        }
      }
    }
  }
  assert.ok(checked >= 2, `expected to find time-driven pulses to check, found ${checked}`);
  assert.deepEqual(offenders, [], `pulses that will drift into unison:\n  ${offenders.join('\n  ')}`);
});

test('AC-L1: the lighting ramp separates shadow from light by more than brightness', async () => {
  /**
   * What this replaced: three `smoothstep` bands spanning 0.54 to 0.98. A 1.81:1 range with no hue
   * movement, which means shadow and light differed only in how much grey they had — and that is a
   * complete explanation on its own for why the platformer read as flat.
   *
   * Measured as data rather than from a capture, because the ramp *is* data. A frame could pass this
   * by accident through fog or exposure; the ramp either carries the separation or it does not.
   */
  const { TRAVERSAL_LIGHTING_RAMP: ramp } = await import(
    '../antiky/traversal-study/src/lighting-ramp.gen.ts'
  );
  assert.ok(ramp.length >= 32, `expected a ramp with real resolution, got ${ramp.length} steps`);

  const luminance = ([red, green, blue]) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const hue = ([red, green, blue]) => {
    const high = Math.max(red, green, blue);
    const low = Math.min(red, green, blue);
    if (high === low) return 0;
    const span = high - low;
    const raw = high === red
      ? ((green - blue) / span + 6) % 6
      : high === green ? (blue - red) / span + 2 : (red - green) / span + 4;
    return raw * 60;
  };

  const darkest = ramp[0];
  const brightest = ramp[ramp.length - 1];
  const ratio = luminance(brightest) / luminance(darkest);
  assert.ok(ratio >= 6, `brightest-to-darkest luminance ratio is ${ratio.toFixed(2)}:1, floor is 6:1`);

  // Shortest way round the colour wheel, so a shift through 350 to 10 counts as 20 rather than 340.
  const separation = Math.abs(hue(brightest) - hue(darkest));
  const shift = Math.min(separation, 360 - separation);
  assert.ok(shift >= 20, `hue shifts ${shift.toFixed(1)} degrees from shadow to light, floor is 20`);

  // Monotonic brightness. A ramp that dips in the middle reads as a band rather than as a gradient,
  // and neither of the two checks above would notice.
  for (let step = 1; step < ramp.length; step += 1) {
    assert.ok(
      luminance(ramp[step]) >= luminance(ramp[step - 1]) - 1e-6,
      `the ramp dims at step ${step}, so light does not rise monotonically along it`,
    );
  }
});

test('AC-M2: every kit UV selects a swatch the material table declares', async () => {
  /**
   * The criterion as written asks for two distinct V values per Kenney GLB and for every V to map to
   * a declared material ID. The first half already passed before any work here — Kenney's atlas
   * addresses swatches by row, so the models carry 3 to 30 distinct V values each, and the goal's
   * claim that "every Kenney GLB would fail (single V)" was measured wrong.
   *
   * The second half is what this asserts, and in the shape the art actually has: **identity is two
   * dimensional.** V picks a row of the atlas and U picks the swatch within it, so a table keyed on
   * V alone would name a row of a dozen unrelated colours. Every UV a mesh emits must land on a
   * swatch the table declares, and that swatch must be one the atlas actually uses.
   */
  const { parseGlb } = await import('brometal');
  const { readdir, readFile } = await import('node:fs/promises');
  // Both kits. A test scoped to one is exactly what stops noticing when a second arrives — which is
  // the failure this directory has already been bitten by twice.
  const kits = [
    {
      table: (await import('../antiky/traversal-study/src/kit-materials.gen.ts')),
      prefix: 'TRAVERSAL',
      url: new URL('../antiky/traversal-study/assets/kenney/platformer-kit/', import.meta.url),
    },
    {
      table: (await import('../antiky/combat-arena/src/kit-materials.gen.ts')),
      prefix: 'ARENA',
      url: new URL('../antiky/combat-arena/assets/kenney/modular-space-kit/', import.meta.url),
    },
  ];

  const unmapped = new Set();
  let meshes = 0;
  for (const kitEntry of kits) {
  const TRAVERSAL_KIT_MATERIALS = kitEntry.table[`${kitEntry.prefix}_KIT_MATERIALS`];
  const TRAVERSAL_KIT_GRID = kitEntry.table[`${kitEntry.prefix}_KIT_GRID`];
  const declared = new Map(
    TRAVERSAL_KIT_MATERIALS.map((swatch) => [`${swatch.row}:${swatch.column}`, swatch]),
  );
  const kit = kitEntry.url;
  const files = (await readdir(kit)).filter((entry) => entry.endsWith('.glb'));
  assert.ok(files.length >= 3, `${kitEntry.prefix}: expected a kit, found ${files.length} models`);
  for (const file of files) {
    const bytes = await readFile(new URL(file, kit));
    const model = parseGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    for (const mesh of model.meshes) {
      if (mesh.uvs === null) continue;
      meshes += 1;
      const values = new Set();
      for (let at = 0; at < mesh.uvs.length; at += 2) {
        const column = Math.min(TRAVERSAL_KIT_GRID.columns - 1, Math.floor(mesh.uvs[at] * TRAVERSAL_KIT_GRID.columns));
        const row = Math.min(TRAVERSAL_KIT_GRID.rows - 1, Math.floor(mesh.uvs[at + 1] * TRAVERSAL_KIT_GRID.rows));
        const key = `${row}:${column}`;
        values.add(mesh.uvs[at + 1]);
        const swatch = declared.get(key);
        if (swatch === undefined || swatch.roughness === null) unmapped.add(`${file} → ${key}`);
      }
      assert.ok(values.size >= 2, `${file}: only ${values.size} distinct V, so it carries no swatch variation`);
    }
  }
  }
  assert.ok(meshes >= 10, `expected to read real meshes across both kits, read ${meshes}`);
  assert.deepEqual([...unmapped], [], `UVs landing on swatches the table does not declare:\n  ${[...unmapped].join('\n  ')}`);
});

test('AC-M4: an installed material set carries all four maps, hash-verified', async () => {
  /**
   * The criterion asks each demo's `antiky-assets.json` to list a Poly Haven texture receipt with
   * all four maps present and hash-verified.
   *
   * Goal 05 pointed at `installCatalogAsset` for this, which reads a `downloads` array off the
   * catalog entry. **No entry has one** — all 995 carry the key as an empty array — so that path
   * could never have satisfied this. `install-poly-haven-material.mjs` fetches the same descriptors
   * from the API the catalog generator should be reading and applies the same two checks the
   * installer would have: declared size and declared md5.
   *
   * This asserts the receipt, not the download. A receipt claiming four maps while three files sit
   * on disk is exactly the shape of rot a receipt is supposed to prevent.
   */
  const { readFile, stat } = await import('node:fs/promises');
  const demoRoot = new URL('../antiky/traversal-study/', import.meta.url);
  const receipts = JSON.parse(await readFile(new URL('assets/antiky-assets.json', demoRoot), 'utf8'));
  const textures = receipts.assets.filter((asset) => asset.kind === 'texture');
  assert.ok(textures.length >= 1, 'expected at least one Poly Haven texture receipt');

  for (const texture of textures) {
    const maps = texture.files.map((file) => file.map).sort();
    assert.deepEqual(maps, ['ao', 'diff', 'nor', 'rough'], `${texture.catalogId} is missing a map`);
    for (const file of texture.files) {
      assert.match(file.md5, /^[0-9a-f]{32}$/, `${file.map} has no md5`);
      assert.match(file.sha256, /^[0-9a-f]{64}$/, `${file.map} has no sha256`);
      // The file the receipt names must exist and be the size it claims.
      const info = await stat(new URL(file.file, demoRoot));
      assert.equal(info.size, file.bytes, `${file.map}: on disk it is ${info.size} bytes, the receipt says ${file.bytes}`);
    }
  }
});

test('every instanced batch that is written is also uploaded and drawn', async () => {
  /**
   * Written is not drawn.
   *
   * A batch whose instance data never reaches the GPU renders nothing, and the demo looks exactly as
   * it did before — so the mistake survives a capture, a metrics comparison and a code review. It
   * has now shipped twice in this repository: contact shadows in an earlier goal, and the arena wall
   * panels in this one, which went through *three* captures looking unchanged.
   *
   * Two separate omissions cause it, and this checks both: a batch written but never `upload()`ed,
   * and a batch uploaded but never `draw()`n.
   */
  const { readdir, readFile } = await import('node:fs/promises');
  const demos = await discoverDemos();
  const problems = [];
  let checked = 0;

  for (const demo of demos) {
    const sources = await discoverDemoSources(demo);
    const text = sources.map((module) => module.text).join('\n');
    // Anchored on *any* access through the catalog, not on the write.
    //
    // Keying off `catalog.<name>.setValues(` was the obvious rule and it missed the very batch that
    // prompted this test: the wall layout writes through a local alias
    // (`const batch = detailed ? catalog.wallDetails : catalog.walls`), so no write site mentions
    // the batch by name. Every batch is still *reached* through the catalog somewhere — `clear()`
    // at minimum — and that is the anchor a textual scan can rely on.
    const accessors = new Set(['frame', 'dispose', 'draw', 'upload']);
    const written = new Set(
      [...text.matchAll(/\bcatalog\.(\w+)\./g)]
        .map(([, name]) => name)
        .filter((name) => !accessors.has(name)),
    );
    for (const name of written) {
      checked += 1;
      if (!new RegExp(`\\bcatalog\\.${name}\\.upload\\(`).test(text)) {
        problems.push(`${demo.slug}: catalog.${name} is written but never uploaded`);
      }
      if (!new RegExp(`\\bcatalog\\.${name}\\.(?:program\\.)?draw\\(`).test(text)) {
        problems.push(`${demo.slug}: catalog.${name} is uploaded but never drawn`);
      }
    }
  }

  assert.ok(checked >= 5, `expected to find instanced batches to check, found ${checked}`);
  assert.deepEqual(problems, [], `batches that will silently render nothing:\n  ${problems.join('\n  ')}`);
});

test('combat-arena has no vignette and no depth-of-field blur', async () => {
  /**
   * An owner decision, asserted so it stays true rather than being rediscovered.
   *
   * A vignette darkens the frame's corners and a depth-of-field pass blurs by distance. Both are
   * standard cinematic post and both are wrong here: this is a top-down arena where the corners hold
   * play and every ship must stay crisp at every depth. Goal 05's item 5 adds a vignette to other
   * demos, so the risk is that it arrives by pattern-matching rather than by decision.
   *
   * Reads compiled WGSL: the shipped program, with no comments to hide an assertion in.
   */
  const [demo] = (await discoverDemos()).filter((entry) => entry.slug === 'combat-arena');
  assert.ok(demo, 'combat-arena is missing');

  const found = [];
  for (const shader of await discoverShaders(demo)) {
    // A vignette is a radial darkening keyed on distance from screen centre, which in practice means
    // a `length` of a centred screen coordinate multiplying the output.
    if (/vignette/i.test(shader.wgsl)) found.push(`${shader.relative}: names a vignette`);
    if (/depthOfField|circleOfConfusion|bokeh/i.test(shader.wgsl)) {
      found.push(`${shader.relative}: names a depth-of-field term`);
    }
    // A blur reads its own input at neighbouring offsets. Any shader sampling one texture five or
    // more times is either a blur kernel or a mistake, and both are worth stopping here.
    for (const texture of shader.sampledTextures) {
      const samples = shader.samples.filter((sample) => sample.texture === texture).length;
      // The globe samples albedo and clouds a few times each for its stylised bands, and triplanar
      // costs three per map — five is comfortably above both and well below a kernel.
      if (samples >= 5) found.push(`${shader.relative}: samples ${texture} ${samples} times, which is a blur kernel`);
    }
  }
  assert.deepEqual(found, [], `combat-arena must stay free of vignette and depth-of-field:\n  ${found.join('\n  ')}`);
});
