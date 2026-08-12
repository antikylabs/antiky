import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  discoverDemos,
  discoverDemoSources,
  discoverShaders,
} from './shader-graph.mjs';

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
  const demos = await discoverDemos(['antiky']);
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
