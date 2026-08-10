import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngineSession, createSessionId } from '@antiky/framework';

import { createTraversalInputBuffer } from '../src/input-buffer.ts';
import { TRAVERSAL_WORLD_ID } from '../src/inspection.ts';
import type { TraversalInput } from '../src/simulation.ts';

const idle = Object.freeze({ horizontal: 0, active: false, jump: false, retry: false });

test('a click on a zero-step presentation frame remains latched until a fixed step consumes it', () => {
  const applied: TraversalInput[] = [];
  const buffer = createTraversalInputBuffer();
  const session = createEngineSession<TraversalInput>({
    sessionId: createSessionId(),
    worldId: TRAVERSAL_WORLD_ID,
    runtimeInstanceId: 'traversal-substep-input-test',
    systems: [{
      id: 'record-traversal-input',
      run(step) { applied.push(step.input); },
    }],
    captureInput(input) { return Object.freeze({ ...input }); },
  });
  const halfFrame = (input: TraversalInput) => {
    buffer.capture(input);
    const result = session.advance(1 / 120, buffer.read());
    buffer.consume(result.completedSteps);
    return result;
  };

  const clickFrame = halfFrame({ horizontal: 0, active: true, jump: true, retry: true });
  assert.equal(clickFrame.completedSteps, 0);
  assert.equal(buffer.read().jump, true);

  const followingFrame = halfFrame(idle);
  assert.equal(followingFrame.completedSteps, 1);
  assert.equal(applied.length, 1);
  assert.equal(applied[0]!.jump, true);
  assert.equal(applied[0]!.retry, true);
  assert.equal(buffer.read().jump, false);
  assert.equal(buffer.read().retry, false);
  session.dispose();
});
