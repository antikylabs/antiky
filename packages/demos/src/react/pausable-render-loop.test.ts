import assert from 'node:assert/strict';
import test from 'node:test';

import { createPausableRenderLoop } from './pausable-render-loop.ts';

test('pausing stops the renderer loop and resuming creates only one replacement', () => {
  let starts = 0;
  let stops = 0;
  const loop = createPausableRenderLoop(() => {
    starts += 1;
    let stopped = false;
    return () => {
      assert.equal(stopped, false, 'one renderer loop was stopped more than once');
      stopped = true;
      stops += 1;
    };
  }, () => undefined);

  loop.start();
  loop.start();
  assert.deepEqual({ starts, stops, running: loop.running }, {
    starts: 1,
    stops: 0,
    running: true,
  });

  loop.pause();
  loop.pause();
  assert.deepEqual({ starts, stops, running: loop.running }, {
    starts: 1,
    stops: 1,
    running: false,
  });

  loop.start();
  assert.deepEqual({ starts, stops, running: loop.running }, {
    starts: 2,
    stops: 1,
    running: true,
  });

  loop.dispose();
  loop.start();
  assert.deepEqual({ starts, stops, running: loop.running }, {
    starts: 2,
    stops: 2,
    running: false,
  });
});

test('a paused one-shot render runs inside a temporary renderer loop and then stops', async () => {
  let scheduledFrame: ((elapsedSeconds: number) => void) | null = null;
  let rendererFrameOpen = false;
  let starts = 0;
  let stops = 0;
  let draws = 0;
  const loop = createPausableRenderLoop((frame) => {
    starts += 1;
    scheduledFrame = frame;
    let stopped = false;
    return () => {
      assert.equal(stopped, false, 'the one-shot renderer loop stopped more than once');
      stopped = true;
      stops += 1;
    };
  }, () => undefined);

  const rendered = loop.renderOnce(() => {
    assert.equal(rendererFrameOpen, true, 'draw ran outside the renderer loop');
    draws += 1;
  });
  const oneShotFrame = scheduledFrame as ((elapsedSeconds: number) => void) | null;
  assert.ok(oneShotFrame);
  rendererFrameOpen = true;
  oneShotFrame(1);
  rendererFrameOpen = false;
  await rendered;

  assert.deepEqual({ starts, stops, draws, running: loop.running }, {
    starts: 1,
    stops: 1,
    draws: 1,
    running: false,
  });
});
