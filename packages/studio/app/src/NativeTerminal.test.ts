import assert from 'node:assert/strict';
import { test } from 'vitest';

import { terminalBoundsForRect } from './NativeTerminal.tsx';

test('native terminal bounds preserve viewport CSS-pixel geometry', () => {
  assert.deepEqual(terminalBoundsForRect({
    left: 12.5,
    top: 81,
    width: 420,
    height: 640,
  }), {
    x: 12.5,
    y: 81,
    width: 420,
    height: 640,
  });
});

test('native terminal bounds reject unusable geometry before IPC', () => {
  assert.equal(terminalBoundsForRect({ left: 0, top: 0, width: 40, height: 640 }), null);
  assert.equal(terminalBoundsForRect({ left: Number.NaN, top: 0, width: 420, height: 640 }), null);
});

