import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acquireTransactional,
  createDisposalScope,
  createRendererResourceLifetime,
} from '../../src/resources/disposal-scope.ts';

function recorder() {
  const released: string[] = [];
  const resource = (label: string, fail = false) => ({
    dispose(): void {
      released.push(label);
      if (fail) throw new Error(`injected ${label} failure`);
    },
  });
  return { released, resource };
}

test('resources are released newest first', () => {
  const { released, resource } = recorder();
  const scope = createDisposalScope();
  scope.adopt(resource('texture'));
  scope.adopt(resource('program'));
  scope.adopt(resource('batch'));

  scope.dispose();

  assert.deepEqual(released, ['batch', 'program', 'texture']);
});

test('every resource is released even when most of them throw', () => {
  const { released, resource } = recorder();
  const scope = createDisposalScope();
  scope.adopt(resource('first'));
  scope.adopt(resource('second', true));
  scope.adopt(resource('third'));
  scope.adopt(resource('fourth', true));
  scope.adopt(resource('fifth', true));

  let thrown: unknown;
  try {
    scope.dispose();
  } catch (cause: unknown) {
    thrown = cause;
  }

  // All five, not just the ones before the first failure. Stopping early is the leak this exists
  // to prevent, and two of the seven implementations this replaced did exactly that.
  assert.deepEqual(released, ['fifth', 'fourth', 'third', 'second', 'first']);
  assert.ok(thrown instanceof AggregateError);
  assert.equal(thrown.errors.length, 3);
  assert.deepEqual(
    thrown.errors.map((error: Error) => error.message).sort(),
    ['injected fifth failure', 'injected fourth failure', 'injected second failure'],
  );
});

test('a single disposal failure is thrown as itself, not wrapped', () => {
  const { resource } = recorder();
  const scope = createDisposalScope();
  scope.adopt(resource('only', true));

  assert.throws(() => { scope.dispose(); }, /injected only failure/);
});

test('disposing twice releases once', () => {
  const { released, resource } = recorder();
  const scope = createDisposalScope();
  scope.adopt(resource('texture'));

  scope.dispose();
  scope.dispose();

  assert.deepEqual(released, ['texture']);
});

test('a resource adopted after closing is released immediately rather than leaked', () => {
  const { released, resource } = recorder();
  const scope = createDisposalScope();
  scope.dispose();

  scope.adopt(resource('late'));

  assert.deepEqual(released, ['late']);
});

test('rollback rethrows the construction cause itself', () => {
  const { released, resource } = recorder();
  const scope = createDisposalScope();
  scope.adopt(resource('texture'));
  scope.adopt(resource('program'));
  const cause = new Error('injected construction fault');

  // The identity matters, not just the message: the caller is diagnosing the construction fault,
  // and a wrapper would bury it.
  assert.throws(() => { scope.rollback(cause); }, (thrown: unknown) => thrown === cause);
  assert.deepEqual(released, ['program', 'texture']);
});

test('rollback preserves both causes when the rollback also fails', () => {
  const { resource } = recorder();
  const scope = createDisposalScope();
  scope.adopt(resource('doomed', true));
  const cause = new Error('injected construction fault');

  let thrown: unknown;
  try {
    scope.rollback(cause);
  } catch (caught: unknown) {
    thrown = caught;
  }

  assert.ok(thrown instanceof AggregateError);
  assert.equal(thrown.errors.length, 2);
  assert.ok(thrown.errors.includes(cause));
  assert.equal(thrown.cause, cause, 'the construction fault stays reachable as .cause');
});

test('rollback with no cause discards the disposal failure', () => {
  const { released, resource } = recorder();
  const scope = createDisposalScope();
  scope.adopt(resource('doomed', true));

  // Unwinding a construction that is already failing: the disposal error must not replace the
  // fault the caller is about to report.
  assert.doesNotThrow(() => { scope.rollback(); });
  assert.deepEqual(released, ['doomed']);
});

test('transactional acquisition releases what it built and stops calling factories', async () => {
  const { released, resource } = recorder();
  let fourthFactoryCalls = 0;

  await assert.rejects(
    acquireTransactional([
      async () => resource('first'),
      async () => resource('second'),
      async () => { throw new Error('injected texture fault'); },
      async () => { fourthFactoryCalls += 1; return resource('fourth'); },
    ]),
    /injected texture fault/,
  );

  assert.deepEqual(released, ['second', 'first']);
  assert.equal(fourthFactoryCalls, 0, 'sequential acquisition must not start work after a fault');
});

test('a completed transaction disposes in reverse and ignores repeats', async () => {
  const { released, resource } = recorder();
  const transaction = await acquireTransactional([
    async () => resource('texture'),
    async () => resource('program'),
  ]);

  transaction.dispose();
  transaction.dispose();

  assert.deepEqual(released, ['program', 'texture']);
});

test('renderer teardown releases resources first and destroys the renderer once', () => {
  const { released, resource } = recorder();
  let destroyCount = 0;
  const lifetime = createRendererResourceLifetime(() => { destroyCount += 1; });
  lifetime.resources.adopt(resource('texture'));
  lifetime.resources.adopt(resource('program'));

  lifetime.dispose();
  lifetime.dispose();

  assert.deepEqual(released, ['program', 'texture']);
  assert.equal(destroyCount, 1);
});

test('renderer rollback preserves the construction fault and still destroys the renderer', () => {
  const { released, resource } = recorder();
  let destroyCount = 0;
  const lifetime = createRendererResourceLifetime(() => { destroyCount += 1; });
  lifetime.resources.adopt(resource('decoded-texture'));
  lifetime.resources.adopt(resource('linked-program'));
  const cause = new Error('injected program upload fault');

  assert.throws(() => lifetime.rollback(cause), (thrown: unknown) => thrown === cause);
  lifetime.dispose();

  assert.deepEqual(released, ['linked-program', 'decoded-texture']);
  assert.equal(destroyCount, 1);
});
