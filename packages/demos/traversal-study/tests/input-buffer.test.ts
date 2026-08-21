import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngineSession, createSessionId } from '@antiky/framework';

import {
  createTraversalInputBuffer,
  createTraversalSessionInputCapture,
} from '../src/input-buffer.ts';
import { TRAVERSAL_WORLD_ID } from '../src/inspection.ts';
import type { TraversalInput } from '../src/simulation.ts';

const idle = Object.freeze({ horizontal: 0, active: false, jump: false, retry: false });

test('the traversal session capture returns a Framework-safe immutable input snapshot', () => {
  const applied: TraversalInput[] = [];
  const session = createEngineSession<TraversalInput>({
    sessionId: createSessionId(),
    worldId: TRAVERSAL_WORLD_ID,
    runtimeInstanceId: 'traversal-session-capture-test',
    systems: [{
      id: 'record-traversal-session-input',
      run(step) { applied.push(step.input); },
    }],
    captureInput: createTraversalSessionInputCapture(),
  });

  const first = session.advance(0, {
    horizontal: 1,
    active: true,
    jump: false,
    retry: true,
  });

  assert.equal(first.code, 'ADVANCED');
  assert.equal(first.completedSteps, 0);
  assert.equal(session.readStatus().mode, 'running');
  assert.equal(session.readStatus().fault, null);
  assert.equal(applied.length, 0);

  const stepped = session.advance(1 / 60, {
    horizontal: 1,
    active: true,
    jump: false,
    retry: true,
  });
  assert.equal(stepped.code, 'ADVANCED');
  assert.equal(stepped.completedSteps, 1);
  assert.equal(applied.length, 1);
  assert.equal(Object.isFrozen(applied[0]), true);

  const second = session.advance(1 / 60, {
    horizontal: -0.5,
    active: true,
    jump: true,
    retry: false,
  });
  assert.equal(second.code, 'ADVANCED');
  assert.equal(applied.length, 2);
  assert.notStrictEqual(applied[1], applied[0]);
  assert.equal(applied[0]!.horizontal, 1, 'a completed step must retain its captured value');
  assert.equal(applied[1]!.horizontal, -0.5);
  session.dispose();
});

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

test('input capture and read reuse one semantic input object across presentation frames', () => {
  const buffer = createTraversalInputBuffer();
  buffer.capture({ horizontal: 1, active: true, jump: true, retry: true });
  const first = buffer.read();
  buffer.consume(0);
  buffer.capture({ horizontal: -0.5, active: true, jump: false, brake: true, retry: false });
  const second = buffer.read();

  assert.strictEqual(second, first);
  assert.equal(second.horizontal, -0.5);
  assert.equal(second.jump, true);
  assert.equal(second.brake, true);
});
