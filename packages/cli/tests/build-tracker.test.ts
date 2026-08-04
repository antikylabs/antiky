import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createInspectionSnapshot } from '@antiky/framework';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { createBuildTracker } from '../src/host/build-tracker.ts';

function readyRuntime(instanceId: string) {
  return createInspectionSnapshot({
    schemaVersion: 1,
    runtime: { instanceId, lifecycle: 'ready' },
    diagnostics: [],
    measurements: {
      runtime: { owner: 'framework', frameCount: 2 },
      render: { owner: 'framework', canvasWidth: 640, canvasHeight: 480 },
    },
  });
}

async function waitFor(predicate: () => boolean, timeoutMilliseconds = 1000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMilliseconds) throw new Error('Timed out waiting for build state.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('build revisions advance only when a changed build reaches a newer ready runtime', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-build-'));
  const tracker = createBuildTracker({
    developmentSessionId: 'development-build-001',
    rootDirectory,
    failureTimeoutMilliseconds: 30,
  });
  try {
    assert.equal(tracker.acceptRuntime(readyRuntime('runtime-build-001')), 1);
    assert.deepEqual(tracker.snapshot(), {
      owner: 'cli',
      revision: 1,
      changeKind: 'initial',
      result: 'ready',
    });

    tracker.noteFileChange(join(rootDirectory, 'src', 'game.ts'));
    assert.equal(tracker.snapshot().result, 'pending');
    assert.equal(tracker.acceptRuntime(readyRuntime('runtime-build-001')), 1);
    assert.equal(tracker.snapshot().result, 'pending');
    assert.equal(tracker.acceptRuntime(readyRuntime('runtime-build-002')), 2);
    assert.deepEqual(tracker.snapshot(), {
      owner: 'cli',
      revision: 2,
      changeKind: 'source',
      result: 'ready',
      changedPath: 'src/game.ts',
      durationMilliseconds: tracker.snapshot().durationMilliseconds,
    });
    assert.ok((tracker.snapshot().durationMilliseconds ?? -1) >= 0);

    tracker.noteFileChange(join(rootDirectory, 'src', 'town.shader.ts'));
    await waitFor(() => tracker.snapshot().result === 'failed');
    assert.equal(tracker.snapshot().revision, 2);
    assert.equal(tracker.diagnostics()[0]?.code, 'ANTIKY_SHADER_BUILD_FAILED');

    tracker.noteFileChange(join(rootDirectory, 'src', 'town.shader.ts'));
    tracker.noteFileChange(join(rootDirectory, 'src', 'town.shader.gen.ts'));
    assert.equal(tracker.acceptRuntime(readyRuntime('runtime-build-003')), 3);
    assert.equal(tracker.snapshot().result, 'ready');
    assert.equal(tracker.snapshot().changeKind, 'shader');
    assert.deepEqual(tracker.diagnostics(), []);
  } finally {
    await tracker.stop();
  }
});

test('the build tracker observes source paths without watching dependency or output trees', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-build-watch-'));
  const sourceDirectory = join(rootDirectory, 'src');
  const sourcePath = join(sourceDirectory, 'feature.ts');
  await mkdir(sourceDirectory);
  await writeFile(sourcePath, 'export const version = 1;\n');
  const tracker = createBuildTracker({
    developmentSessionId: 'development-build-watch',
    rootDirectory,
    failureTimeoutMilliseconds: 100,
  });
  try {
    tracker.acceptRuntime(readyRuntime('runtime-watch-001'));
    await tracker.watch([sourceDirectory]);
    await writeFile(sourcePath, 'export const version = 2;\n');
    await waitFor(() => tracker.snapshot().result === 'pending');
    assert.equal(tracker.snapshot().changedPath, 'src/feature.ts');
    assert.equal(tracker.acceptRuntime(readyRuntime('runtime-watch-002')), 2);
  } finally {
    await tracker.stop();
  }
});

test('ten source and ten shader fixture updates each reach a newer ready revision within ten seconds', async (context) => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-build-timing-'));
  const sourceDirectory = join(rootDirectory, 'src');
  const sourcePath = join(sourceDirectory, 'feature.ts');
  const shaderPath = join(sourceDirectory, 'town.shader.ts');
  const generatedShaderPath = join(sourceDirectory, 'town.shader.gen.ts');
  await mkdir(sourceDirectory);
  await writeFile(sourcePath, 'export const version = 0;\n');
  await writeFile(shaderPath, 'export const shaderVersion = 0;\n');
  await writeFile(generatedShaderPath, 'export const generatedVersion = 0;\n');
  const tracker = createBuildTracker({
    developmentSessionId: 'development-build-timing',
    rootDirectory,
    failureTimeoutMilliseconds: 2000,
  });
  const durations: number[] = [];
  try {
    tracker.acceptRuntime(readyRuntime('runtime-timing-initial'));
    await tracker.watch([sourceDirectory]);
    for (let index = 1; index <= 10; index += 1) {
      const startedAt = Date.now();
      await writeFile(sourcePath, `export const version = ${index};\n`);
      await waitFor(() => (
        tracker.snapshot().result === 'pending'
        && tracker.snapshot().changedPath === 'src/feature.ts'
      ));
      assert.equal(tracker.acceptRuntime(readyRuntime(`runtime-source-${index}`)), index + 1);
      durations.push(Date.now() - startedAt);
    }
    for (let index = 1; index <= 10; index += 1) {
      const startedAt = Date.now();
      await writeFile(shaderPath, `export const shaderVersion = ${index};\n`);
      await waitFor(() => (
        tracker.snapshot().result === 'pending'
        && tracker.snapshot().changedPath === 'src/town.shader.ts'
      ));
      await writeFile(generatedShaderPath, `export const generatedVersion = ${index};\n`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(tracker.acceptRuntime(readyRuntime(`runtime-shader-${index}`)), index + 11);
      durations.push(Date.now() - startedAt);
    }
    assert.ok(durations.every((duration) => duration <= 10_000));
    const ordered = [...durations].sort((left, right) => left - right);
    const median = ordered[Math.floor(ordered.length / 2)]!;
    const slowest = ordered.at(-1)!;
    context.diagnostic(`20-update fixture timing: median=${median}ms slowest=${slowest}ms`);
  } finally {
    await tracker.stop();
  }
});
