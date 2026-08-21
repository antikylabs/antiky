import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acquireTransactional,
  createDisposalScope,
  createRendererResourceLifetime,
} from '@antiky/framework';

test('transactional acquisition rolls completed resources back in reverse order after a fault', async () => {
  const disposed: string[] = [];
  let fourthFactoryCalls = 0;
  const resource = (label: string) => ({ dispose: () => { disposed.push(label); } });

  await assert.rejects(
    acquireTransactional([
      async () => resource('first'),
      async () => resource('second'),
      async () => { throw new Error('injected texture fault'); },
      async () => { fourthFactoryCalls += 1; return resource('fourth'); },
    ]),
    /injected texture fault/,
  );

  assert.deepEqual(disposed, ['second', 'first']);
  assert.equal(fourthFactoryCalls, 0, 'sequential acquisition must not leave rejected concurrent work');
});

test('successful resource disposal is reverse-order and idempotent', async () => {
  const disposed: string[] = [];
  const transaction = await acquireTransactional([
    async () => ({ dispose: () => { disposed.push('texture'); } }),
    async () => ({ dispose: () => { disposed.push('program'); } }),
  ]);

  transaction.dispose();
  transaction.dispose();
  assert.deepEqual(disposed, ['program', 'texture']);
});

test('a disposal stack immediately owns adopted resources and never double-disposes', () => {
  let count = 0;
  const stack = createDisposalScope();
  stack.adopt({ dispose: () => { count += 1; } });
  stack.dispose();
  stack.dispose();
  assert.equal(count, 1);
});

test('renderer teardown disposes GPU resources in reverse and destroys the renderer only once', () => {
  const disposed: string[] = [];
  let rendererDestroyCount = 0;
  const lifetime = createRendererResourceLifetime(() => { rendererDestroyCount += 1; });
  lifetime.resources.adopt({ dispose: () => { disposed.push('texture'); } });
  lifetime.resources.adopt({ dispose: () => { disposed.push('program'); } });

  lifetime.dispose();
  lifetime.dispose();

  assert.deepEqual(disposed, ['program', 'texture']);
  assert.equal(rendererDestroyCount, 1);
});

test('renderer rollback preserves the construction fault after releasing partial resources', () => {
  const disposed: string[] = [];
  let rendererDestroyCount = 0;
  const lifetime = createRendererResourceLifetime(() => { rendererDestroyCount += 1; });
  lifetime.resources.adopt({ dispose: () => { disposed.push('decoded-texture'); } });
  lifetime.resources.adopt({ dispose: () => { disposed.push('linked-program'); } });

  assert.throws(() => lifetime.rollback(new Error('injected program upload fault')), /injected program upload fault/);
  lifetime.dispose();

  assert.deepEqual(disposed, ['linked-program', 'decoded-texture']);
  assert.equal(rendererDestroyCount, 1);
});
