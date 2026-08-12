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
export async function discoverDemos(category = 'antiky') {
  const root = path.join(demosRoot, category);
  const demos = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return demos;
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
  const statements = [...wgsl.matchAll(/\blet\s+(\w+)\s*=\s*([^;]*);/g)]
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
  for (const statement of statements) {
    const from = sources(statement.expression);
    if (from.size > 0) tainted.set(statement.name, from);
  }

  /** Every texture whose sampled value reaches the given function, however many hops away. */
  const reaches = (fn) => {
    const result = new Set();
    const pattern = new RegExp(`\\b${fn}\\s*\\(`);
    for (const statement of statements) {
      if (!pattern.test(statement.expression)) continue;
      // Only the arguments of that call matter, not the rest of the statement.
      const at = statement.expression.search(pattern);
      const tail = statement.expression.slice(at);
      for (const texture of sources(tail)) result.add(texture);
    }
    // Also catch a direct `return f(textureSample(...))` with no binding at all.
    for (const match of wgsl.matchAll(new RegExp(`\\b${fn}\\s*\\(([^;]*)`, 'g'))) {
      for (const texture of sources(match[1])) result.add(texture);
    }
    return result;
  };

  const samples = [...wgsl.matchAll(/textureSample(?:Level)?\(\s*(\w+)\s*,/g)].map((match) => ({
    texture: match[1],
    // `textureSampleLevel(..., 0.0)` is the mip footgun: a texture() inside a DSL helper compiles to
    // it and silently loses the mip chain.
    level: match[0].includes('Level') ? 'explicit' : 'auto',
  }));

  return {
    relative,
    wgsl,
    samplers,
    samples,
    sampledTextures: [...new Set(samples.map((sample) => sample.texture))],
    reaches,
    functions: [...wgsl.matchAll(/fn (\w+)\s*\(/g)].map(([, name]) => name),
    calls: (name) => new RegExp(`\\b${name}\\s*\\(`).test(wgsl),
  };
}

/** Every compiled shader a demo ships, keyed by demo. */
export async function discoverShaders(demo) {
  const files = await walk(path.join(demo.directory, 'src'), (name) => name.endsWith('.shader.gen.ts'));
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
    path.join(demo.directory, 'src'),
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
