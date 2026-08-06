import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  advanceGameFrameAttempt,
  gameFrameRetryDelay,
} from './LiveGameFrame.tsx';

test('a failed first game navigation receives a new iframe attempt', () => {
  const initial = { identity: 'development-001:http://127.0.0.1:3010', attempt: 0 };
  const retry = advanceGameFrameAttempt(initial, initial.identity);

  assert.deepEqual(retry, { ...initial, attempt: 1 });
  assert.notEqual(`${initial.identity}:${initial.attempt}`, `${retry.identity}:${retry.attempt}`);
});

test('game frame retries back off and a new development session starts fresh', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 20].map(gameFrameRetryDelay),
    [1_000, 2_000, 4_000, 4_000, 4_000],
  );
  assert.deepEqual(
    advanceGameFrameAttempt(
      { identity: 'development-old:http://127.0.0.1:3010', attempt: 3 },
      'development-new:http://127.0.0.1:3010',
    ),
    { identity: 'development-new:http://127.0.0.1:3010', attempt: 0 },
  );
});
