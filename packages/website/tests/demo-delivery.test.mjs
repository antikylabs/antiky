import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { buildDemoArtifact } from '../scripts/build-demo-artifact.mjs';
import { stageDemoArtifacts } from '../scripts/stage-demo-artifacts.mjs';

const sourceRoot = new URL('../src/', import.meta.url);
const publicRoot = new URL('../public/', import.meta.url);
const masterRoot = new URL('../media-masters/demos/', import.meta.url);

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

async function relativeFiles(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await relativeFiles(url, root));
    else if (entry.isFile()) files.push(decodeURIComponent(url.pathname.slice(root.pathname.length)));
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
    'combat-arena',
    'traversal-study',
    'antiky-town',
    'point-light-expo',
    'shader-study',
    'solar-forge',
    'luminous-reef',
    'orbital-atlas',
    'glass-garden',
  ]) assert.match(catalog, new RegExp(`slug: '${slug}'`));
  assert.match(catalog, /pillar: 'Framework'/);
  assert.match(catalog, /pillar: 'BroMetal'/);
  assert.match(catalog, /pillar: 'Three\.js'/);
  // The support check lives in one helper so the render path and the activation path cannot drift.
  assert.match(host, /function webGpuAvailable\(\)/);
  assert.match(host, /'gpu' in navigator/);
  assert.match(host, /requiresWebGpu && !webGpuAvailable\(\)/);
  assert.match(host, /onPointerEnter/);
  assert.match(host, /onFocusCapture/);
  assert.match(host, /prefers-reduced-motion/);
});

test('every published demo has a distinct real poster and the catalog groups all renderer families', async () => {
  const publication = JSON.parse(await readFile(new URL('../demo-publication.json', import.meta.url), 'utf8'));
  const catalogPage = await readFile(new URL('../.next/server/app/demos.html', import.meta.url), 'utf8');
  const digests = new Set();

  for (const demo of publication.demos) {
    const master = await readFile(new URL(`${demo.slug}.png`, masterRoot));
    const masterSize = pngDimensions(master);
    assert.ok(masterSize.width >= 2560, `${demo.slug} master is too narrow`);
    assert.ok(masterSize.height >= 1440, `${demo.slug} master is too short`);
    const deliveryPoster = `demos/${demo.slug}.webp`;
    const image = await readFile(new URL(`media/${deliveryPoster}`, publicRoot));
    const { width, height, format } = await sharp(image).metadata();
    assert.equal(format, 'webp');
    assert.ok((width ?? 0) >= 2560, `${demo.slug} delivery poster is too narrow`);
    assert.ok((height ?? 0) >= 1440, `${demo.slug} delivery poster is too short`);
    assert.ok(image.length <= 1_200_000, `${demo.slug} delivery poster exceeds its budget`);
    assert.ok(catalogPage.includes(deliveryPoster), `${demo.slug} delivery poster is missing`);
    digests.add(createHash('sha256').update(image).digest('hex'));
  }

  assert.equal(digests.size, publication.demos.length, 'Demo posters must not reuse the same image');
  const groups = [
    ['framework-demos', 'Antiky Framework', ['combat-arena', 'traversal-study', 'antiky-town', 'point-light-expo']],
    ['brometal-demos', 'BroMetal', ['shader-study', 'solar-forge', 'luminous-reef']],
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
      (await relativeFiles(staged)).sort(),
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

test('a browser without WebGPU is shown posters, not error cards', async () => {
  const host = await readFile(new URL('../src/components/DemoStage.tsx', import.meta.url), 'utf8');

  // The defect: `setPhase('error')` on a browser that simply lacks WebGPU turned eight of ten
  // cards into red alerts blaming the visitor for their browser. A still frame captured from the
  // running study is evidence; an error card is a bug report sent to the wrong person.
  // Every place the WebGPU gate is evaluated must resolve to the gated phase.
  //
  // This used to slice a fixed 160 characters after the gate expression, so a comment or a log line
  // inside the branch pushed `setPhase('error')` past the window and the red card shipped green.
  // The gate appears twice and in two shapes — a braced `if` in `activate()` and a single-statement
  // `if` in the effect — so instead of matching a block, take the text from each occurrence up to
  // whichever `setPhase(` call comes next, and require it to be the gated one.
  const occurrences = [...host.matchAll(/requiresWebGpu && !webGpuAvailable\(\)/g)];
  assert.ok(occurrences.length >= 1, 'the WebGPU gate is gone');
  for (const occurrence of occurrences) {
    const after = host.slice(occurrence.index);
    const next = after.match(/setPhase\('(\w+)'\)/);
    assert.ok(next, 'the WebGPU gate does not set a phase at all');
    assert.equal(
      next[1],
      'gated',
      'a browser that simply lacks WebGPU must be shown its poster, not an error card',
    );
  }

  // The gated stage keeps the poster visible and captions it.
  assert.match(host, /className="stage-badge"/);
  assert.match(host, /Static capture/);

  const styles = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  assert.match(styles, /\[data-phase='gated'\] \.stage-canvas \{ opacity: 0/);
  assert.match(styles, /\.stage-badge \{/);
});

test('the WebGPU requirement is not announced to visitors who never hit it', async () => {
  const page = await readFile(new URL('../src/app/demos/page.tsx', import.meta.url), 'utf8');

  // Most visitors are on a browser that runs everything, so a page-level paragraph about WebGPU is
  // a limitation notice aimed at the wrong audience. The gated card carries its own caption, which
  // is the only place the requirement is worth mentioning — and only to the people it affects.
  assert.equal((page.match(/WebGPU/g) ?? []).length, 0);
});

test('a thumb renders an activation control that does not depend on hovering', async () => {
  const host = await readFile(new URL('../src/components/DemoStage.tsx', import.meta.url), 'utf8');
  const thumbStart = host.indexOf("variant === 'thumb' ? (");
  assert.ok(thumbStart > 0, 'failed to locate the thumb branch');
  // Slice forward from the branch, not to the first "Open study" in the file — the gated branch
  // above the thumb branch has one too.
  const thumbBranch = host.slice(thumbStart, host.indexOf('Open study', thumbStart));

  // Touch devices never fire pointerenter, so hover-only activation left the mobile page as ten
  // static posters with no way to start anything.
  assert.match(thumbBranch, /className="stage-activate"/);
  assert.match(thumbBranch, /onClick=\{\(\) => void activate\(\)\}/);

  const styles = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  // ...and a running thumb must accept input rather than swallowing it.
  assert.match(styles, /\.stage-thumb\[data-phase='running'\] \.stage-canvas.*pointer-events: auto/);
});

test('mobile posters are fitted rather than cropped past their subject', async () => {
  const styles = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');

  // `.deck-stage` is `height: 68svh`, which at a 390px viewport is a portrait box. `cover` against
  // a 2560x1440 master then shows only its middle ~35%, cutting Orbital Atlas's ringed planet and
  // Shader Study's moon out of frame. `contain` shows 100% of the master's width.
  const mobileRule = styles.slice(styles.indexOf('.stage-has-poster { background-image: var(--stage-poster-mobile)'));
  assert.match(mobileRule.slice(0, 120), /background-size: contain/);

  const posterAspect = 2560 / 1440;
  const stageAspect = 390 / (844 * 0.68);
  const visibleWidthWithCover = stageAspect / posterAspect;
  assert.ok(visibleWidthWithCover < 0.7, 'this test is meaningless if cover would already fit');
});

test('the town is not billed as a shader study', async () => {
  const { DEMOS, DEMO_GROUPS } = await import('../src/lib/demos.ts');

  // Antiky Town is ~11,700 lines: a voxel surface mesher, a sprite batcher, a tested character
  // motor, and a real post pass. The three BroMetal studies are fullscreen quads. One group for
  // both would read as a claim that a quad is this engine's ceiling.
  const antikyTown = DEMOS.find((demo) => demo.slug === 'antiky-town');
  assert.equal(antikyTown?.pillar, 'Framework', 'the town belongs with the Framework demos');
  for (const slug of ['shader-study', 'solar-forge', 'luminous-reef']) {
    assert.equal(DEMOS.find((demo) => demo.slug === slug)?.tier, 'shader-study');
  }

  const groups = DEMO_GROUPS.filter((group) => group.pillar === 'BroMetal');
  assert.equal(groups.length, 2, 'the BroMetal pillar must present two clearly separated groups');
  assert.deepEqual(groups.map((group) => group.id).sort(), ['brometal-demos', 'brometal-shader-demos']);
  assert.equal(new Set(DEMO_GROUPS.map((group) => group.id)).size, DEMO_GROUPS.length);
});

test('Solar Forge copy describes what its shader implements', async () => {
  const { DEMOS } = await import('../src/lib/demos.ts');
  const solarForge = DEMOS.find((demo) => demo.slug === 'solar-forge');

  // The shader implements a photon ring, an accretion disk and relativistic Doppler beaming. Calling
  // that "a turbulent procedural eclipse" with "a black-hot core" undersold its own content.
  const copy = `${solarForge?.tagline} ${solarForge?.notes}`;
  assert.ok(!/eclipse/i.test(copy), 'the shader does not implement an eclipse');
  assert.match(copy, /photon ring/i);
  assert.match(copy, /accretion disk/i);
  assert.match(copy, /doppler/i);
});
