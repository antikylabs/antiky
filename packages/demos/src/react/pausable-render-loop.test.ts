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
