import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  ANTIKY_PROJECT_SCHEMA_VERSION,
  AntikyCliError,
  describeAntikyProject,
  discoverAntikyProjectManifest,
  loadAntikyProject,
  migrateAntikyConfig,
  parseAntikyProjectManifest,
} from '../src/index.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  removeSessionDescriptor,
  writeSessionDescriptor,
} from '../src/host/session-descriptor.ts';

const validManifest = {
  schemaVersion: 1,
  name: 'Emberwyrd λ',
  development: {
    command: ['node', 'game.mjs', '{host}', '{gamePort}', '{gameWidth}', '{gameHeight}'],
    shaderCommand: ['node', 'shaders.mjs'],
    workingDirectory: '.',
    url: 'http://127.0.0.1:43100/game',
    viewport: { width: 960, height: 540 },
  },
  network: {
    host: '127.0.0.1',
    gamePort: 43100,
    inspectionPort: 43101,
  },
  build: {
    command: ['npm', 'run', 'build'],
    workingDirectory: '.',
  },
} as const;

const repositoryManifest = fileURLToPath(
  new URL('../../../antiky-town.antiky', import.meta.url),
);

async function projectDirectory(prefix = 'antiky-project-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writeManifest(
  directory: string,
  value: unknown = validManifest,
  name = 'emberwyrd.antiky',
): Promise<string> {
  const path = join(directory, name);
  const source = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, source);
  return path;
}

function expectProjectError(code: string, path?: string) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof AntikyCliError);
    assert.equal(error.code, code);
    if (path !== undefined) assert.equal(error.path, path);
    return true;
  };
}

test('the pure parser creates one immutable Unicode project description', () => {
  const source = `${JSON.stringify(validManifest, null, 2)}\n`;
  const manifest = parseAntikyProjectManifest(source);
  const project = describeAntikyProject(manifest, {
    manifestPath: '/projects/emberwyrd/emberwyrd.antiky',
    projectRoot: '/projects/emberwyrd',
    revision: 'a'.repeat(64),
    developmentWorkingDirectory: '/projects/emberwyrd',
    buildWorkingDirectory: '/projects/emberwyrd',
  });

  assert.equal(ANTIKY_PROJECT_SCHEMA_VERSION, 1);
  assert.equal(project.name, 'Emberwyrd λ');
  assert.equal(project.manifestPath, '/projects/emberwyrd/emberwyrd.antiky');
  assert.equal(project.projectRoot, '/projects/emberwyrd');
  assert.equal(project.revision, 'a'.repeat(64));
  assert.deepEqual(project.development.command, [
    'node', 'game.mjs', '127.0.0.1', '43100', '960', '540',
  ]);
  assert.deepEqual(project.development.shaderCommand, ['node', 'shaders.mjs']);
  assert.deepEqual(project.build.command, ['npm', 'run', 'build']);
  assert.ok(Object.isFrozen(project));
  assert.ok(Object.isFrozen(project.development));
  assert.ok(Object.isFrozen(project.development.command));
  assert.ok(Object.isFrozen(project.build));
});

test('the parser rejects unknown fields, malformed JSON, incompatible versions, and controls', () => {
  assert.throws(
    () => parseAntikyProjectManifest(JSON.stringify({ ...validManifest, authoring: {} })),
    expectProjectError('ANTIKY_PROJECT_INVALID', '$.authoring'),
  );
  assert.throws(
    () => parseAntikyProjectManifest('{ not json }'),
    expectProjectError('ANTIKY_PROJECT_INVALID', '$'),
  );
  assert.throws(
    () => parseAntikyProjectManifest(JSON.stringify({ ...validManifest, schemaVersion: 2 })),
    expectProjectError('ANTIKY_PROJECT_INCOMPATIBLE', '$.schemaVersion'),
  );
  assert.throws(
    () => parseAntikyProjectManifest(JSON.stringify({ ...validManifest, name: 'Bad\u0000Name' })),
    expectProjectError('ANTIKY_PROJECT_INVALID', '$.name'),
  );
  assert.throws(
    () => parseAntikyProjectManifest(`${' '.repeat(65_536)}\n`),
    expectProjectError('ANTIKY_PROJECT_TOO_LARGE', '$'),
  );
});

test('the parser rejects unsafe portable paths and unknown command placeholders', () => {
  for (const workingDirectory of ['..', '../outside', '/tmp/game', 'C:/game', 'linked\\outside']) {
    assert.throws(
      () => parseAntikyProjectManifest(JSON.stringify({
        ...validManifest,
        development: { ...validManifest.development, workingDirectory },
      })),
      expectProjectError('ANTIKY_PROJECT_INVALID', '$.development.workingDirectory'),
    );
  }
  assert.throws(
    () => parseAntikyProjectManifest(JSON.stringify({
      ...validManifest,
      development: {
        ...validManifest.development,
        command: ['node', '{unknownValue}'],
      },
    })),
    expectProjectError('ANTIKY_PROJECT_INVALID', '$.development.command[1]'),
  );
});

test('Node discovery accepts exactly one current-directory manifest and explicit paths win', async () => {
  const directory = await projectDirectory();
  const manifestPath = await writeManifest(directory);

  assert.equal(await discoverAntikyProjectManifest(directory), await realpath(manifestPath));
  assert.equal((await loadAntikyProject(manifestPath)).manifestPath, await realpath(manifestPath));

  const second = await writeManifest(directory, { ...validManifest, name: 'Second' }, 'second.antiky');
  await assert.rejects(
    () => discoverAntikyProjectManifest(directory),
    expectProjectError('ANTIKY_PROJECT_AMBIGUOUS'),
  );
  assert.equal((await loadAntikyProject(second)).name, 'Second');
});

test('Node discovery returns stable zero-file, non-file, and symlink-escape errors', async () => {
  const directory = await projectDirectory();
  await assert.rejects(
    () => discoverAntikyProjectManifest(directory),
    expectProjectError('ANTIKY_PROJECT_NOT_FOUND'),
  );

  const notFile = join(directory, 'folder.antiky');
  await mkdir(notFile);
  await assert.rejects(
    () => loadAntikyProject(notFile),
    expectProjectError('ANTIKY_PROJECT_NOT_FILE'),
  );

  const outside = await projectDirectory('antiky-project-outside-');
  await writeFile(join(outside, 'marker.txt'), 'outside');
  const root = await projectDirectory('antiky-project-symlink-');
  await symlink(outside, join(root, 'linked'));
  const unsafe = await writeManifest(root, {
    ...validManifest,
    development: { ...validManifest.development, workingDirectory: 'linked' },
  });
  await assert.rejects(
    () => loadAntikyProject(unsafe),
    expectProjectError('ANTIKY_PROJECT_PATH_ESCAPE', '$.development.workingDirectory'),
  );
});

test('Node loading rejects a symlink manifest, invalid UTF-8, and oversized bytes', async () => {
  const directory = await projectDirectory();
  const target = await writeManifest(directory, validManifest, 'target.antiky');
  const linked = join(directory, 'linked.antiky');
  await symlink(target, linked);
  await assert.rejects(
    () => loadAntikyProject(linked),
    expectProjectError('ANTIKY_PROJECT_PATH_ESCAPE'),
  );

  const invalidUtf8 = join(directory, 'invalid.antiky');
  await writeFile(invalidUtf8, Buffer.from([0xff, 0xfe, 0xfd]));
  await assert.rejects(
    () => loadAntikyProject(invalidUtf8),
    expectProjectError('ANTIKY_PROJECT_INVALID', '$'),
  );

  const oversized = join(directory, 'oversized.antiky');
  await writeFile(oversized, Buffer.alloc(65_537, 0x20));
  await assert.rejects(
    () => loadAntikyProject(oversized),
    expectProjectError('ANTIKY_PROJECT_TOO_LARGE', '$'),
  );
});

test('migration writes one exclusive manifest with development parity', async () => {
  const directory = await projectDirectory('antiky-migration-');
  const legacyPath = join(directory, 'antiky.config.json');
  const outputPath = join(directory, 'emberwyrd.antiky');
  await writeFile(legacyPath, `${JSON.stringify({
    schemaVersion: 1,
    game: validManifest.development,
    network: validManifest.network,
  }, null, 2)}\n`);

  const migrated = await migrateAntikyConfig({
    configPath: legacyPath,
    outputPath,
    projectName: 'Emberwyrd λ',
  });
  const loaded = await loadAntikyProject(outputPath);
  assert.equal(migrated.manifestPath, loaded.manifestPath);
  assert.equal(loaded.name, 'Emberwyrd λ');
  assert.deepEqual(loaded.development.command, migrated.development.command);
  assert.deepEqual(loaded.development.shaderCommand, migrated.development.shaderCommand);
  assert.equal(loaded.development.url, migrated.development.url);
  assert.deepEqual(loaded.network, migrated.network);
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')).build, {
    command: ['npm', 'run', 'build'],
    workingDirectory: '.',
  });
  await assert.rejects(
    () => migrateAntikyConfig({ configPath: legacyPath, outputPath, projectName: 'Again' }),
    expectProjectError('ANTIKY_PROJECT_EXISTS'),
  );
});

test('the repository manifest is the only project source and preserves the focused town host', async () => {
  const project = await loadAntikyProject(repositoryManifest);
  const root = dirname(repositoryManifest);

  assert.equal(project.name, 'Antiky Town');
  assert.equal(project.projectRoot, await realpath(root));
  assert.equal(project.development.url, 'http://127.0.0.1:3010/');
  assert.deepEqual(project.development.viewport, { width: 1280, height: 720 });
  assert.equal(project.network.inspectionPort, 3011);
  await assert.rejects(
    () => readFile(join(root, 'antiky.config.json'), 'utf8'),
    (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT',
  );
});

test('the runtime ignore marker exists before a session credential and survives cleanup', async () => {
  const directory = await projectDirectory('antiky-session-marker-');
  const descriptorPath = join(directory, '.antiky', 'dev-session.json');
  const circular = {
    schemaVersion: 1,
    developmentSessionId: 'development-marker-001',
    projectRevision: 'a'.repeat(64),
    inspectionUrl: 'http://127.0.0.1:43101',
    credential: 'secret'.repeat(8),
    ownerPid: process.pid,
  } as Record<string, unknown>;
  circular.circular = circular;

  await assert.rejects(
    () => writeSessionDescriptor(descriptorPath, circular as never),
    TypeError,
  );
  const ignorePath = join(directory, '.antiky', '.gitignore');
  assert.equal(await readFile(ignorePath, 'utf8'), '*\n!.gitignore\n');
  await assert.rejects(
    () => stat(descriptorPath),
    (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT',
  );

  await writeSessionDescriptor(descriptorPath, {
    schemaVersion: 1,
    developmentSessionId: 'development-marker-002',
    projectRevision: 'b'.repeat(64),
    inspectionUrl: 'http://127.0.0.1:43101',
    credential: 'secret'.repeat(8),
    ownerPid: process.pid,
  });
  assert.equal((await stat(descriptorPath)).mode & 0o777, 0o600);
  await removeSessionDescriptor(descriptorPath);
  assert.equal(await readFile(ignorePath, 'utf8'), '*\n!.gitignore\n');
});
