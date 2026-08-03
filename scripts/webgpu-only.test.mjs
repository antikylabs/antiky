import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const roots = ['README.md', 'CONTRIBUTING.md', 'docs', 'packages', 'vendor'];
const ignoredDirectories = new Set(['.impeccable', '.next', '_internal', 'coverage', 'dist', 'node_modules']);
const textExtensions = new Set(['.css', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.txt']);
const forbidden = [
  { label: 'WebGL reference', pattern: /\bwebgl(?:2)?\b/i },
  { label: 'GLSL reference', pattern: /\bglsl\b/i },
  { label: 'backend toggle', pattern: /BackendToggle/ },
  { label: 'backend preference state', pattern: /(?:get|set|subscribe)(?:Live)?Backend/ },
  { label: 'renderer backend type', pattern: /RendererBackend/ },
  { label: 'legacy shader output', pattern: /(?:vertexSrc|fragmentSrc)/ },
];

async function filesUnder(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
  if (!entries) return [absolutePath];

  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const child = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path.relative(root, child)));
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name))) files.push(child);
  }
  return files;
}

test('public product surfaces stay WebGPU-only', async () => {
  const violations = [];
  for (const scanRoot of roots) {
    for (const file of await filesUnder(scanRoot)) {
      const source = await readFile(file, 'utf8').catch(() => null);
      if (source === null) continue;
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) {
          violations.push(`${path.relative(root, file)}: ${rule.label}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('the demo runner creates the renderer directly without selection state', async () => {
  const runner = await readFile(path.join(root, 'packages/demos/src/react/LiveDemoStage.tsx'), 'utf8');
  const runtime = await readFile(path.join(root, 'packages/demos/src/runtime.ts'), 'utf8');

  assert.equal([...runner.matchAll(/createRenderer\(/g)].length, 1);
  assert.match(runner, /createRenderer\(canvas,\s*\{/);
  assert.doesNotMatch(runner, /\bbackend\b/i);
  assert.doesNotMatch(runtime, /\bbackend\b/i);
  await assert.rejects(access(path.join(root, 'packages/demos/src/react/BackendToggle.tsx')));
});

test('dependencies and generated shaders use the WebGPU-only contract', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, 'packages/demos/package.json'), 'utf8'),
  );
  assert.equal(manifest.dependencies.brometal, '0.14.0');

  const generated = (await filesUnder('packages/demos/src/shaders'))
    .filter((file) => file.endsWith('.shader.gen.ts'));
  assert.ok(generated.length > 0);
  for (const file of generated) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /\bwgslSrc\s*:/, path.relative(root, file));
  }

  const installedRuntime = await readFile(
    path.join(root, 'packages/demos/node_modules/brometal/dist/runtime/context.js'),
    'utf8',
  );
  assert.doesNotMatch(installedRuntime, /\bwebgl(?:2)?\b/i);

  const vendorFiles = await readdir(path.join(root, 'vendor')).catch(() => []);
  assert.deepEqual(vendorFiles, []);
});
