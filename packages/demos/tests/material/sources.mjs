import { readFile } from 'node:fs/promises';
import path from 'node:path';

const shaderImportPattern = /import\s+(\w+)\s+from\s+'([^']*\.shader\.gen(?:\.ts)?)'/g;
const excludedPassPattern = /(?:depth|shadow|glow|surface|hud|post)/i;

function normalizedShader(module, imported, binding) {
  const specifier = imported.get(binding);
  if (specifier === undefined || excludedPassPattern.test(binding)) return undefined;
  return path.normalize(path.join(
    path.dirname(module.relative),
    specifier.endsWith('.ts') ? specifier : `${specifier}.ts`,
  ));
}

/**
 * Derive the generated shaders used by visible GLB passes from game-owned source modules.
 *
 * The demos use three testable shapes: an injected program factory, a direct local program, and a
 * declarative `pipeline` descriptor. All three still bind positions from a loaded mesh. Depth,
 * shadow, and effects passes are deliberately excluded because AC-M3 concerns the material visible
 * in the colour output.
 */
export function glbDrawingShadersFromModules(modules) {
  const drawn = new Set();

  for (const module of modules) {
    if (!/\bloadGlb\b/.test(module.text)) continue;

    const imported = new Map();
    for (const [, binding, specifier] of module.text.matchAll(shaderImportPattern)) {
      imported.set(binding, specifier);
    }
    if (imported.size === 0) continue;

    const factoryShaders = new Map();
    for (const [, factory, shader] of module.text.matchAll(
      /(\w+)\s*:\s*\([^)]*\)\s*=>\s*createProgram\(\s*[^,]+,\s*(\w+)/g,
    )) {
      factoryShaders.set(factory, shader);
    }

    const programShaders = new Map();
    for (const [, program, shader] of module.text.matchAll(
      /(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*createProgram\(\s*[^,]+,\s*(\w+)/g,
    )) {
      programShaders.set(program, shader);
    }
    for (const [, program, factory] of module.text.matchAll(
      /(?:const|let|var\s+)?(\w+)\s*=\s*[^;\n]*dependencies\.(\w+)\(/g,
    )) {
      const shader = factoryShaders.get(factory);
      if (shader !== undefined) programShaders.set(program, shader);
    }

    for (const [, program] of module.text.matchAll(
      /(\w+)\.attributes\.\w+!?\.set\(\s*\w+\.positions/g,
    )) {
      const shader = programShaders.get(program);
      if (shader === undefined) continue;
      const relative = normalizedShader(module, imported, shader);
      if (relative !== undefined) drawn.add(relative);
    }

    for (const [, shader] of module.text.matchAll(/\bpipeline\s*:\s*\{\s*shader\s*:\s*(\w+)/g)) {
      const relative = normalizedShader(module, imported, shader);
      if (relative !== undefined && /\.positions\b/.test(module.text)) drawn.add(relative);
    }
  }

  return drawn;
}

export function readFrozenNumberArray(source, exportName) {
  const escaped = exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(
    `export\\s+const\\s+${escaped}\\s*=\\s*Object\\.freeze\\((\\[[\\s\\S]*?\\])\\s+as\\s+const\\s*\\);`,
  ));
  if (match === null) throw new Error(`Could not read generated array ${exportName}.`);
  const value = JSON.parse(match[1].replace(/,\s*([\]}])/g, '$1'));
  if (!Array.isArray(value)) throw new Error(`Generated value ${exportName} is not an array.`);
  return value;
}

export function readKitMaterialData(source, prefix) {
  const records = [];
  for (const [, row, column, roughness] of source.matchAll(
    /\{\s*row:\s*(\d+),\s*column:\s*(\d+),\s*colour:\s*\[[^\]]+\],\s*roughness:\s*(null|-?\d+(?:\.\d+)?)\s*\}/g,
  )) {
    records.push({
      row: Number(row),
      column: Number(column),
      roughness: roughness === 'null' ? null : Number(roughness),
    });
  }
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const grid = source.match(new RegExp(
    `export\\s+const\\s+${escaped}_KIT_GRID\\s*=\\s*Object\\.freeze\\(\\{\\s*rows:\\s*(\\d+),\\s*columns:\\s*(\\d+)\\s*\\}\\);`,
  ));
  if (records.length === 0 || grid === null) {
    throw new Error(`Could not read generated kit material data for ${prefix}.`);
  }
  return {
    materials: records,
    grid: { rows: Number(grid[1]), columns: Number(grid[2]) },
  };
}

export async function readGeneratedFile(url) {
  return readFile(url, 'utf8');
}
