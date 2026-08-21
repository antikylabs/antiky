import assert from 'node:assert/strict';
import test from 'node:test';

import { createTownCaptureFixture } from '../src/capture-fixture.ts';

test('town capture controls expose only declared presentation variants', () => {
  const fixture = createTownCaptureFixture();
  fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [
      { kind: 'variant', name: 'tree-translucency', enabled: false },
      { kind: 'variant', name: 'shadows', enabled: false },
    ],
  });
  assert.equal(fixture.read().variants['tree-translucency'], false);
  assert.equal(fixture.read().variants.shadows, false);
  assert.throws(() => fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [{ kind: 'camera-translation', delta: { x: 0.01, y: 0, z: 0 } }],
  }));
});
