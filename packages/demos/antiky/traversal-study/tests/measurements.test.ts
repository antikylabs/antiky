import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeTraversalMeasurements } from '../src/measurements.ts';
import { TRAVERSAL_PLANNED_MEASUREMENTS, TRAVERSAL_PRESENTATION_BUDGET } from '../src/render-plan.ts';

test('renderer measurements count GPU instances per mesh draw and uploaded bytes per batch', () => {
  const measurements = summarizeTraversalMeasurements([
    { capacity: 4, drawCalls: 2, uploadBytes: 144 },
    { capacity: 3, drawCalls: 1, uploadBytes: 96 },
  ]);

  assert.deepEqual(measurements, {
    instances: 11,
    drawCalls: 3,
    uploadBytesPerFrame: 240,
    note: 'Finite Antiky courier course; embedded-image Kenney and Quaternius GLBs rendered by BroMetal',
  });
  assert.notEqual(measurements.instances, 7, 'multi-mesh assets must not be counted once per logical batch');
});

test('the authored renderer plan remains inside the presentation guardrails', () => {
  assert.ok(TRAVERSAL_PLANNED_MEASUREMENTS.drawCalls <= TRAVERSAL_PRESENTATION_BUDGET.drawCalls);
  assert.ok(TRAVERSAL_PLANNED_MEASUREMENTS.instances <= TRAVERSAL_PRESENTATION_BUDGET.instances);
  assert.ok(
    TRAVERSAL_PLANNED_MEASUREMENTS.uploadBytesPerFrame
      <= TRAVERSAL_PRESENTATION_BUDGET.uploadBytesPerFrame,
  );
  assert.equal(TRAVERSAL_PLANNED_MEASUREMENTS.drawCalls, 18);
  assert.ok(TRAVERSAL_PLANNED_MEASUREMENTS.instances >= 200);
  assert.ok(TRAVERSAL_PLANNED_MEASUREMENTS.uploadBytesPerFrame >= 8 * 1024);
});
