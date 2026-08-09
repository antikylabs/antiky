import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildDemoArtifact } from '../scripts/build-demo-artifact.mjs';
import { stageDemoArtifacts } from '../scripts/stage-demo-artifacts.mjs';

const sourceRoot = new URL('../src/', import.meta.url);
const publicRoot = new URL('../public/', import.meta.url);

function pngDimensions(source) {
  assert.deepEqual(source.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return {
    width: source.readUInt32BE(16),
    height: source.readUInt32BE(20),
  };
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(url));
    else if (entry.isFile() && /\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(url);
  }
  return files;
}

test('website production source owns its catalog and imports no demo source package', async () => {
  const source = (await Promise.all((await sourceFiles(sourceRoot)).map(
    (file) => readFile(file, 'utf8'),
  ))).join('\n');
  assert.doesNotMatch(source, /@antiky\/demos/);
  assert.doesNotMatch(source, /(?:^|\/)packages\/demos\//);
  assert.doesNotMatch(source, /\.\.\/demos\/src/);
});

test('website game host owns activation, input, presentation, visibility, and cleanup', async () => {
  const host = await readFile(new URL('../src/components/DemoStage.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  for (const contract of [
    '<canvas',
    "listen(window, 'keydown'",
    "listen(window, 'keyup'",
    "listen(canvas, 'pointerdown'",
    'requestAnimationFrame',
    'IntersectionObserver',
    'document.hidden',
    'instance.dispose()',
    'cancelAnimationFrame',
    '>Retry</button>',
    "'paused' ? 'Resume' : 'Pause'",
  ]) assert.match(host, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(styles, /grid-template: repeat\(3, 44px\) \/ repeat\(3, 44px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the website catalog exposes all renderer families and gates only WebGPU demos', async () => {
  const catalog = await readFile(new URL('../src/lib/demos.ts', import.meta.url), 'utf8');
  const host = await readFile(new URL('../src/components/DemoStage.tsx', import.meta.url), 'utf8');
  for (const slug of [
    'antiky-town',
    'point-light-expo',
    'town-study',
    'shader-study',
    'solar-forge',
    'luminous-reef',
    'orbital-atlas',
    'glass-garden',
  ]) assert.match(catalog, new RegExp(`slug: '${slug}'`));
  assert.match(catalog, /pillar: 'Framework'/);
  assert.match(catalog, /pillar: 'BroMetal'/);
  assert.match(catalog, /pillar: 'Three\.js'/);
  assert.match(host, /requiresWebGpu && !\('gpu' in navigator\)/);
});

test('every published demo has a distinct real poster and the catalog groups all renderer families', async () => {
  const publication = JSON.parse(await readFile(new URL('../demo-publication.json', import.meta.url), 'utf8'));
  const catalogPage = await readFile(new URL('../.next/server/app/demos.html', import.meta.url), 'utf8');
  const digests = new Set();

  for (const demo of publication.demos) {
    const image = await readFile(new URL(`media/demos/${demo.slug}.png`, publicRoot));
    const { width, height } = pngDimensions(image);
    assert.ok(width >= 512, `${demo.slug} poster is too narrow`);
    assert.ok(height >= 288, `${demo.slug} poster is too short`);
    const deliveryPoster = demo.slug === 'antiky-town'
      ? 'worlds/antiky-town-hero-wide-v1.webp'
      : `demos/${demo.slug}.png`;
    assert.ok(catalogPage.includes(deliveryPoster), `${demo.slug} delivery poster is missing`);
    digests.add(createHash('sha256').update(image).digest('hex'));
  }

  assert.equal(digests.size, publication.demos.length, 'Demo posters must not reuse the same image');
  const groups = [
    ['framework-demos', 'Antiky Framework', ['antiky-town', 'point-light-expo']],
    ['brometal-demos', 'BroMetal', ['town-study', 'shader-study', 'solar-forge', 'luminous-reef']],
    ['threejs-demos', 'Three.js', ['orbital-atlas', 'glass-garden']],
  ];
  const groupStarts = groups.map(([id, heading]) => {
    const marker = `<h2 id="${id}">${heading}</h2>`;
    const index = catalogPage.indexOf(marker);
    assert.ok(index >= 0, `Demo catalog is missing ${heading}`);
    return index;
  });
  assert.deepEqual([...groupStarts].sort((left, right) => left - right), groupStarts);

  for (let index = 0; index < groups.length; index += 1) {
    const section = catalogPage.slice(groupStarts[index], groupStarts[index + 1] ?? catalogPage.length);
    for (const slug of groups[index][2]) assert.match(section, new RegExp(`href="/demos/${slug}"`));
  }

  const architecture = await readFile(new URL('media/antiky-architecture.png', publicRoot));
  const architectureSize = pngDimensions(architecture);
  assert.ok(architectureSize.width >= 1600);
  assert.ok(architectureSize.height >= 900);
});

test('website publication contains only the approved verified artifact files', async () => {
  const publication = JSON.parse(await readFile(new URL('../demo-publication.json', import.meta.url), 'utf8'));
  const stagedRoot = new URL('../public/demo-builds/', import.meta.url);
  assert.deepEqual(
    (await readdir(stagedRoot)).sort(),
    publication.demos.map((demo) => demo.slug).sort(),
  );
  for (const demo of publication.demos) {
    const staged = new URL(`${demo.slug}/`, stagedRoot);
    const manifest = JSON.parse(await readFile(new URL('antiky-artifact.json', staged), 'utf8'));
    assert.equal(manifest.slug, demo.slug);
    assert.deepEqual(
      (await readdir(staged)).sort(),
      [...manifest.files.map((file) => file.path), 'antiky-artifact.json'].sort(),
    );
  }
});

test('staging rejects changed source, changed bytes, and extra output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'antiky-stage-test-'));
  const project = path.join(root, 'project');
  const dist = path.join(project, 'dist');
  const publicationPath = path.join(root, 'publication.json');
  const destination = path.join(root, 'public/demo-builds');
  const gamePath = path.join(dist, 'antiky.game.js');
  const sourcePath = path.join(project, 'src/game.ts');
  try {
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await mkdir(dist, { recursive: true });
    await writeFile(sourcePath, 'export default function game() {}\n');
    await writeFile(gamePath, 'export default function game() { return { frame() {}, dispose() {} }; }\n');
    await buildDemoArtifact([
      '--slug', 'fixture',
      '--name', 'Fixture',
      '--dist', dist,
      '--source', `project=${project}`,
    ]);
    await writeFile(publicationPath, `${JSON.stringify({
      schemaVersion: 1,
      demos: [{
        slug: 'fixture',
        projectName: 'Fixture',
        renderer: 'brometal',
        workspace: '@antiky/demo-fixture',
        projectDirectory: 'project',
        sources: [{ label: 'project', path: 'project' }],
      }],
    }, null, 2)}\n`);
    const options = { repositoryRoot: root, publicationPath, destination };
    await stageDemoArtifacts(options);

    await writeFile(sourcePath, 'export default function changedGame() {}\n');
    await assert.rejects(stageDemoArtifacts(options), /ANTIKY_ARTIFACT_STALE/);
    await writeFile(sourcePath, 'export default function game() {}\n');

    await writeFile(gamePath, 'changed bytes\n');
    await assert.rejects(stageDemoArtifacts(options), /ANTIKY_ARTIFACT_DIGEST_MISMATCH/);
    await writeFile(gamePath, 'export default function game() { return { frame() {}, dispose() {} }; }\n');

    await symlink(gamePath, path.join(dist, 'linked.js'));
    await assert.rejects(stageDemoArtifacts(options), /ANTIKY_ARTIFACT_SYMLINK \(fixture\)/);
    await rm(path.join(dist, 'linked.js'));

    await writeFile(path.join(dist, 'extra.js'), 'export {};\n');
    await assert.rejects(stageDemoArtifacts(options), /ANTIKY_ARTIFACT_FILE_SET_INVALID/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('staging reports a missing manifest with a stable code and demo slug', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'antiky-stage-missing-'));
  const publicationPath = path.join(root, 'publication.json');
  try {
    await mkdir(path.join(root, 'project', 'dist'), { recursive: true });
    await writeFile(publicationPath, `${JSON.stringify({
      schemaVersion: 1,
      demos: [{
        slug: 'fixture',
        projectName: 'Fixture',
        renderer: 'brometal',
        workspace: '@antiky/demo-fixture',
        projectDirectory: 'project',
        sources: [{ label: 'project', path: 'project' }],
      }],
    })}\n`);
    await assert.rejects(
      stageDemoArtifacts({ repositoryRoot: root, publicationPath, destination: path.join(root, 'public/demo-builds') }),
      /ANTIKY_ARTIFACT_MANIFEST_MISSING \(fixture\)/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('staging rejects an unapproved renderer label at the publication boundary', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'antiky-stage-renderer-'));
  const publicationPath = path.join(root, 'publication.json');
  try {
    await writeFile(publicationPath, `${JSON.stringify({
      schemaVersion: 1,
      demos: [{
        slug: 'fixture',
        projectName: 'Fixture',
        renderer: 'canvas2d',
        workspace: '@antiky/demo-fixture',
        projectDirectory: 'project',
        sources: [{ label: 'project', path: 'project' }],
      }],
    })}\n`);
    await assert.rejects(
      stageDemoArtifacts({
        repositoryRoot: root,
        publicationPath,
        destination: path.join(root, 'public/demo-builds'),
      }),
      /ANTIKY_PUBLICATION_INVALID \(fixture\).*Renderer is invalid/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
