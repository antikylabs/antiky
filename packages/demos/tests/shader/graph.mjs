import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * What the demos actually ship, read from disk.
 *
 * Two rules hold this together, and both were learned by watching the previous version fail.
 *
 * **Discover, never enumerate.** Every list here comes from the filesystem. A hand-maintained array
 * of demo slugs documents the day it was written and constrains nothing afterwards: a new demo
 * carrying a tone-mapping material shader, an undecoded albedo, a 600,000:1 camera and a resurrected
 * dead constant passed every invariant in this directory, because none of them knew it existed.
 *
 * **Read the compiled shader, not the source.** `.shader.gen.ts` is what runs on the GPU. The
 * `.shader.ts` beside it is a description of intent that a comment can forge — the sRGB decode was
 * removed for real while leaving the words `decodeSrgb(texture(` in a comment, and all three decode
 * invariants stayed green. Generated WGSL carries no comments at all, and
 * `shader-output-parity.test.mjs` proves the committed generated file is what the compiler emits, so
 * asserting on it is asserting on the shipped program.
 */

const demosRoot = path.resolve(import.meta.dirname, '..');

async function walk(directory, accept) {
  const results = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.antiky') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await walk(full, accept));
    else if (entry.isFile() && accept(entry.name)) results.push(full);
  }
  return results;
}

/**
 * Every demo, found by its manifest.
 *
 * A demo is a directory holding a `*.antiky` file — the same thing the CLI and the website use to
 * identify one, so a demo cannot exist for the runtime and not for these tests.
 */
export async function discoverDemos(categories = ['antiky', 'brometal', 'threejs']) {
  const demos = [];
  for (const category of categories) {
    const root = path.join(demosRoot, category);
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(root, entry.name);
      const manifests = (await readdir(directory)).filter((name) => name.endsWith('.antiky'));
      if (manifests.length === 0) continue;
      demos.push({
        slug: entry.name,
        category,
        directory,
        manifest: path.join(directory, manifests[0]),
      });
    }
  }
  return demos;
}

/** Strips WGSL string literals so a texture name inside one cannot be mistaken for a call. */
function code(wgsl) {
  return wgsl.replace(/"[^"]*"/g, '""');
}

/**
 * One compiled shader, parsed into the facts the invariants ask about.
 *
 * `samples` is the useful one: for every `textureSample` in the program it records which texture was
 * read and the expression that immediately encloses it. That is how a decode is detected — by what
 * the shipped program does with the sampled value, not by what a comment claims.
 */
export function parseGeneratedShader(relative, source) {
  const wgsl = code(source);
  const samplers = [...wgsl.matchAll(/var (\w+)\s*:\s*(texture_\w+|sampler)\b/g)]
    .filter(([, , kind]) => kind !== 'sampler')
    .map(([, name]) => name);

  // Statements, in order. This compiler emits straight-line `let name = expr;`, so following a
  // value is a forward pass rather than a real dataflow problem.
  // Both binding forms. A TypeScript `let` compiles to a WGSL `var`, and the shipped shaders already
  // contain dozens of them — reading only `let` silently dropped those values out of the analysis,
  // so an sRGB decode applied to a normal map went unnoticed.
  const statements = [...wgsl.matchAll(/\b(?:let|var)\s+(\w+)\s*(?::\s*[\w<>]+\s*)?=\s*([^;]*);/g)]
    .map(([, name, expression]) => ({ name, expression }));

  // Assignments after the fact, so a value routed through a mutable accumulator is still followed.
  const reassignments = [...wgsl.matchAll(/^\s*(\w+)\s*=\s*([^;]*);/gm)]
    .map(([, name, expression]) => ({ name, expression }));

  /**
   * Which sampled textures a value is derived from.
   *
   * Checking only the expression that immediately wraps a `textureSample` is not enough: the
   * two-step form binds the sample to a name first, and an audit defeated a wrapper-only check by
   * adding a single extra hop (`let packed = stored.xyz;`). Propagating through the bindings costs a
   * few lines and removes the whole class.
   */
  const tainted = new Map();
  const sources = (expression) => {
    const found = new Set();
    for (const [, texture] of expression.matchAll(/textureSample(?:Level)?\(\s*(\w+)\s*,/g)) {
      found.add(texture);
    }
    for (const [name, textures] of tainted) {
      if (new RegExp(`\\b${name}\\b`).test(expression)) for (const texture of textures) found.add(texture);
    }
    return found;
  };
  // Two passes, because a later statement can taint a name an earlier one already used.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const statement of [...statements, ...reassignments]) {
      const from = sources(statement.expression);
      if (from.size === 0) continue;
      const existing = tainted.get(statement.name) ?? new Set();
      for (const texture of from) existing.add(texture);
      tainted.set(statement.name, existing);
    }
  }

  /**
   * Whether a value survives to the fragment's return, rather than merely existing.
   *
   * Presence is not use. `raw * tint + decodeSrgb(raw) * 0.0` contains a correct decode that the GPU
   * discards, and a check that only looked for the call reported success while the albedo shipped
   * undecoded.
   */
  const survives = (name) => {
    const live = new Set([name]);
    for (let pass = 0; pass < 4; pass += 1) {
      for (const statement of [...statements, ...reassignments]) {
        if ([...live].some((held) => new RegExp(`\\b${held}\\b`).test(statement.expression))) {
          live.add(statement.name);
        }
      }
    }
    // Anything the fragment returns, or writes into its output struct.
    const returns = [...wgsl.matchAll(/return\s+([^;]*);/g)].map(([, value]) => value).join(' ');
    const outputs = [...wgsl.matchAll(/bm_out\.\w+\s*=\s*([^;]*);/g)].map(([, value]) => value).join(' ');
    const tail = `${returns} ${outputs}`;
    return [...live].some((held) => new RegExp(`\\b${held}\\b`).test(tail));
  };

  /** Every texture whose sampled value reaches the given function, however many hops away. */
  const reaches = (fn) => {
    const result = new Set();
    const pattern = new RegExp(`\\b${fn}\\s*\\(`);
    for (const statement of [...statements, ...reassignments]) {
      if (!pattern.test(statement.expression)) continue;
      // The call's arguments, and only if what it produces is still alive at the return.
      const at = statement.expression.search(pattern);
      const tail = statement.expression.slice(at);
      if (!survives(statement.name)) continue;
      for (const texture of sources(tail)) result.add(texture);
    }
    // A direct `return f(textureSample(...))` with no binding at all.
    for (const match of wgsl.matchAll(new RegExp(`return[^;]*\\b${fn}\\s*\\(([^;]*)`, 'g'))) {
      for (const texture of sources(match[1])) result.add(texture);
    }
    return result;
  };

  /**
   * Every texture whose sampled value is still alive at the fragment's output.
   *
   * `sampledTextures` answers "was it read", which is not the question a material invariant asks. A
   * normal map bound, sampled and then multiplied by zero is read and does nothing. This is the same
   * distinction `survives` draws for a single value, applied to the texture behind it.
   */
  const liveTextures = () => {
    const live = new Set();
    for (const [name, textures] of tainted) {
      if (!survives(name)) continue;
      for (const texture of textures) live.add(texture);
    }
    // A sample written straight into the return or the output struct, never bound to a name.
    const returns = [...wgsl.matchAll(/return\s+([^;]*);/g)].map(([, value]) => value);
    const outputs = [...wgsl.matchAll(/bm_out\.\w+\s*=\s*([^;]*);/g)].map(([, value]) => value);
    for (const tail of [...returns, ...outputs]) {
      for (const texture of sources(tail)) live.add(texture);
    }
    return live;
  };

  const samples = [...wgsl.matchAll(/textureSample(?:Level)?\(\s*(\w+)\s*,/g)].map((match) => ({
    texture: match[1],
    // `textureSampleLevel(..., 0.0)` is the mip footgun: a texture() inside a DSL helper compiles to
    // it and silently loses the mip chain.
    level: match[0].includes('Level') ? 'explicit' : 'auto',
  }));

  /** Resolve an identifier to a number, following simple constant bindings. */
  const numeric = (token) => {
    const direct = Number(token);
    if (Number.isFinite(direct)) return direct;
    const binding = statements.find((statement) => statement.name === token.trim());
    if (binding === undefined) return undefined;
    const value = Number(binding.expression.trim());
    return Number.isFinite(value) ? value : undefined;
  };

  /**
   * Every direction the shader lights a surface with.
   *
   * A light is defined by what it *does* — it is the vector dotted with the surface normal — rather
   * than by what it is called or which way it points. Three separate evasions defeated the previous
   * version, which matched five identifier names and required the vector to point upward: renaming
   * `light` to `sunDir`, flipping a sun to point downward, and building it from three component
   * constants instead of a literal. None of those change the fact that it is dotted with the normal.
   *
   * The view vector is dotted with the normal too, for rim and specular terms, so anything derived
   * from the camera position is excluded — that is a property of the value, not of its name.
   *
   * Returned in source order. A shader may legitimately have a key and a fill; what must agree
   * across a demo is the **first** — the key — which is the one these shaders compute first and the
   * one the original defect got wrong, lighting the arena floor from the opposite side to the ships.
   */
  const lightDirections = () => {
    const found = new Map();  // insertion-ordered: the key light is first
    // Which locals derive from the interpolated surface normal, and which from the camera.
    const derivesFrom = (needle) => {
      const live = new Set([needle]);
      for (let pass = 0; pass < 3; pass += 1) {
        for (const statement of statements) {
          if ([...live].some((held) => new RegExp(`\\b${held}\\b`).test(statement.expression))) {
            live.add(statement.name);
          }
        }
      }
      return live;
    };
    const normalish = derivesFrom('vNormal');
    // Every spelling of the camera. `antiky-town` calls it `uCamPos`, and a view vector dotted with
    // the normal is a rim or specular term, not a light.
    const viewish = new Set([...derivesFrom('uCameraPosition'), ...derivesFrom('uCamPos')]);
    const viewUniform = /cam|view|eye/i;

    for (const [, a, b] of wgsl.matchAll(/dot\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g)) {
      const base = (token) => token.split('.')[0];
      const pair = [[a, b], [b, a]];
      for (const [left, right] of pair) {
        if (!normalish.has(base(left))) continue;
        if (viewish.has(base(right))) continue;
        // Follow aliases to the definition. `let light = sunDir;` is one hop; a chain of renames is
        // several, and stopping at the first binding let a renamed-and-flipped sun pass.
        let binding = statements.find((statement) => statement.name === base(right));
        for (let hop = 0; hop < 8 && binding !== undefined; hop += 1) {
          const alias = binding.expression.trim().match(/^(\w+)$/);
          if (!alias) break;
          binding = statements.find((statement) => statement.name === alias[1]);
        }
        if (binding === undefined) continue;
        const literal = binding.expression.match(/normalize\(vec3f\(([^)]*)\)\)/);
        if (literal) {
          const parts = literal[1].split(',').map((part) => numeric(part));
          if (parts.every((value) => value !== undefined)) {
            // Normalised, so two spellings of the same direction compare equal.
            const length = Math.hypot(...parts) || 1;
            found.set(parts.map((value) => (value / length).toFixed(3)).join(', '), 'literal');
          }
          continue;
        }
        const uniform = binding.expression.match(/\bbm_u\.(\w+)/);
        if (uniform && !viewUniform.test(uniform[1])) found.set(`uniform:${uniform[1]}`, 'uniform');
      }
    }
    return found;
  };

  /**
   * Every fog range, keyed by the distance it measures rather than by how that distance is spelled.
   *
   * The distance expression is resolved through its bindings, so binding it to a name first does not
   * hide the range — which is exactly how the previous version was defeated.
   */
  const fogRanges = () => {
    const found = new Map();
    const cameraDerived = new Set();
    for (let pass = 0; pass < 3; pass += 1) {
      for (const statement of statements) {
        const mentionsCamera = /uCameraPosition|uCamPos|\bvDepth\b/.test(statement.expression)
          || [...cameraDerived].some((held) => new RegExp(`\\b${held}\\b`).test(statement.expression));
        // A camera *position* is not a distance; a length or a depth is.
        if (mentionsCamera && /length\(|distance\(|\bvDepth\b/.test(statement.expression)) {
          cameraDerived.add(statement.name);
        }
      }
    }
    for (const [, low, high, argument] of wgsl.matchAll(/smoothstep\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([^;)]*(?:\([^)]*\))?[^;)]*)\)/g)) {
      const measuresDistance = /uCameraPosition|uCamPos|\bvDepth\b/.test(argument)
        || [...cameraDerived].some((held) => new RegExp(`\\b${held}\\b`).test(argument));
      if (!measuresDistance) continue;
      found.set(`${Number(low)}..${Number(high)}`, 'literal');
    }
    // A uniform-driven range is one value by construction.
    if (/smoothstep\(\s*bm_u\.uFog\w*\s*,\s*bm_u\.uFog\w*\s*,/.test(wgsl)) {
      found.set('uniform:uFogStart..uFogEnd', 'uniform');
    }
    return found;
  };

  return {
    relative,
    wgsl,
    lightDirections,
    fogRanges,
    samplers,
    samples,
    sampledTextures: [...new Set(samples.map((sample) => sample.texture))],
    liveTextures,
    reaches,
    survives,
    functions: [...wgsl.matchAll(/fn (\w+)\s*\(/g)].map(([, name]) => name),
    calls: (name) => new RegExp(`\\b${name}\\s*\\(`).test(wgsl),
  };
}

/** Every compiled shader a demo ships, keyed by demo. */
export async function discoverShaders(demo) {
  // The whole demo, not just `src`. A shader moved one directory sideways was invisible to every
  // invariant here while still being imported and shipped.
  const files = await walk(demo.directory, (name) => name.endsWith('.shader.gen.ts'));
  const shaders = [];
  for (const file of files) {
    const relative = path.relative(demosRoot, file);
    shaders.push(parseGeneratedShader(relative, await readFile(file, 'utf8')));
  }
  return shaders;
}

/** Every hand-written shader source, for the few checks that genuinely concern authoring. */
export async function discoverShaderSources(demo) {
  const files = await walk(
    demo.directory,
    (name) => name.endsWith('.shader.ts') && !name.endsWith('.shader.gen.ts'),
  );
  const sources = [];
  for (const file of files) {
    sources.push({
      relative: path.relative(demosRoot, file),
      text: await readFile(file, 'utf8'),
    });
  }
  return sources;
}

/** Every TypeScript module in a demo, for source-level scans that are not about shaders. */
export async function discoverDemoSources(demo) {
  const files = await walk(
    path.join(demo.directory, 'src'),
    (name) => name.endsWith('.ts') && !name.endsWith('.gen.ts'),
  );
  const sources = [];
  for (const file of files) {
    sources.push({
      relative: path.relative(demosRoot, file),
      text: await readFile(file, 'utf8'),
    });
  }
  return sources;
}

/** Every script that can write an asset, across every demo. */
export async function discoverAssetScripts(demos) {
  const scripts = [];
  for (const demo of demos) {
    for (const file of await walk(path.join(demo.directory, 'scripts'), (name) => name.endsWith('.mjs'))) {
      const text = await readFile(file, 'utf8');
      scripts.push({
        relative: path.relative(demosRoot, file),
        demo: demo.slug,
        text,
        // Comments stripped: a script that only mentions a rule in prose does not follow it, and a
        // script that documents a mistake has not made it.
        code: text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
      });
    }
  }
  return scripts;
}

export { demosRoot };
