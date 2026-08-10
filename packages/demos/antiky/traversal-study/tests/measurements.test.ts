import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeTraversalMeasurements } from '../src/measurements.ts';

test('renderer measurements count GPU instances per mesh draw and uploaded bytes per batch', () => {
  const measurements = summarizeTraversalMeasurements([
    { capacity: 4, drawCalls: 2, uploadBytes: 144 },
    { capacity: 3, drawCalls: 1, uploadBytes: 96 },
  ]);

  assert.deepEqual(measurements, {
    instances: 11,
    drawCalls: 3,
    uploadBytesPerFrame: 240,
    note: 'Finite Antiky courier course; embedded-image Kenney GLBs rendered by BroMetal',
  });
  assert.notEqual(measurements.instances, 7, 'multi-mesh assets must not be counted once per logical batch');
});
