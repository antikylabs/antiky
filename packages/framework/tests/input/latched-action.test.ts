import assert from 'node:assert/strict';
import test from 'node:test';

import { createLatchedAction } from '../../src/input/latched-action.ts';

test('a held press is one action, not one per frame', () => {
  // The regression. Two of the three demo copies used `pending ||= pressed`, so holding the button
  // re-armed the action every frame and the relay fired continuously while the pointer was down.
  const action = createLatchedAction();
  let triggers = 0;
  for (let frame = 0; frame < 10; frame += 1) {
    action.capture(true);
    if (action.read()) triggers += 1;
    action.consume(1);
  }
  assert.equal(triggers, 1);
});

test('releasing and pressing again is a second action', () => {
  const action = createLatchedAction();
  action.capture(true);
  assert.equal(action.read(), true);
  action.consume(1);

  action.capture(true);
  assert.equal(action.read(), false, 'still held, so still the same press');
  action.capture(false);
  action.capture(true);
  assert.equal(action.read(), true, 'released and pressed again is a new action');
});

test('a frame that completes no step keeps the pending action', () => {
  const action = createLatchedAction();
  action.capture(true);
  action.consume(0);
  assert.equal(action.read(), true, 'a render-only frame must not swallow the press');
  action.consume(1);
  assert.equal(action.read(), false);
});

test('a press between steps survives until a step consumes it', () => {
  const action = createLatchedAction();
  action.capture(true);
  action.capture(false);
  // Released again before the simulation ever ran. The action still has to land.
  assert.equal(action.read(), true);
  action.consume(1);
  assert.equal(action.read(), false);
});

test('several completed steps consume one action, not several', () => {
  const action = createLatchedAction();
  action.capture(true);
  action.consume(3);
  assert.equal(action.read(), false);
});

test('an untouched buffer reports nothing pending', () => {
  const action = createLatchedAction();
  assert.equal(action.read(), false);
  action.capture(false);
  action.consume(1);
  assert.equal(action.read(), false);
});
