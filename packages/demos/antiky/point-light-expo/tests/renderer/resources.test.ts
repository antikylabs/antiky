import assert from 'node:assert/strict';
import test from 'node:test';

import * as lifetime from '@antiky/framework';

test('renderer construction faults roll back every earlier resource once in reverse order', () => {
  const stages = ['floor-diffuse', 'floor-program', 'surface-batch', 'catalog-model', 'uniform-setup'];
  for (let failureIndex = 0; failureIndex < stages.length; failureIndex += 1) {
    const disposed: string[] = [];
    const scope = lifetime.createDisposalScope();
    assert.throws(() => {
      for (let index = 0; index < stages.length; index += 1) {
        if (index === failureIndex) throw new Error(`injected ${stages[index]} failure`);
        const label = stages[index]!;
        scope.adopt({ dispose() { disposed.push(label); } });
      }
    }, /injected/);
    scope.rollback();
    scope.dispose();
    assert.deepEqual(disposed, stages.slice(0, failureIndex).reverse());
  }
});

test('successful renderer ownership also ignores repeated disposal', () => {
  const disposed: string[] = [];
  const scope = lifetime.createDisposalScope();
  scope.adopt({ dispose() { disposed.push('texture'); } });
  scope.adopt({ dispose() { disposed.push('program'); } });
  scope.dispose();
  scope.dispose();
  scope.rollback();
  assert.deepEqual(disposed, ['program', 'texture']);
});
