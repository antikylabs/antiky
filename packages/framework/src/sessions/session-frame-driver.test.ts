import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionFrameDriver, type SessionFrameFault } from './session-frame-driver.ts';
import type { EngineFrameResult, EngineFrameResultCode } from './engine-session/contract.ts';

function frameResult(
  code: EngineFrameResultCode = 'ADVANCED',
  completedSteps = 1,
): EngineFrameResult {
  return Object.freeze({
    code,
    completedSteps,
    inputSequence: 1,
    acceptedElapsedSeconds: 0,
    discardedElapsedSeconds: 0,
    accumulatorSeconds: 0,
  });
}

function harness(code: EngineFrameResultCode = 'ADVANCED') {
  const elapsed: number[] = [];
  const presented: number[] = [];
  const faults: SessionFrameFault[] = [];
  const driver = createSessionFrameDriver<string>({
    advance(elapsedSeconds) {
      elapsed.push(elapsedSeconds);
      return frameResult(code);
    },
    input: () => 'input',
    present: (alpha) => { presented.push(alpha); },
    presentationAlpha: () => 0.5,
    onFault: (fault) => { faults.push(fault); },
  });
  return { driver, elapsed, presented, faults };
}

test('the first frame bills no elapsed time', () => {
  const { driver, elapsed } = harness();
  driver.frame(10);
  assert.deepEqual(elapsed, [0], 'there is no previous timestamp to measure against');
});

test('elapsed time is the gap between consecutive platform times', () => {
  const { driver, elapsed } = harness();
  driver.frame(10);
  driver.frame(10.016);
  driver.frame(10.032);
  assert.equal(elapsed.length, 3);
  assert.ok(Math.abs(elapsed[1]! - 0.016) < 1e-9);
  assert.ok(Math.abs(elapsed[2]! - 0.016) < 1e-9);
});

test('a rewound or repeated clock bills nothing rather than a negative', () => {
  const { driver, elapsed } = harness();
  driver.frame(10);
  driver.frame(9);
  driver.frame(9);
  assert.deepEqual(elapsed.slice(1), [0, 0]);
});

test('the driver does not clamp, because the session already does', () => {
  // The divergence this replaces: one demo clamped at 0.1, which is looser than the session's
  // own 0.05 ceiling, so it never applied to anything and read as live code.
  const { driver, elapsed } = harness();
  driver.frame(0);
  driver.frame(5);
  assert.equal(elapsed[1], 5, 'the whole gap reaches the session, which owns the ceiling');
});

test('a non-advanced frame reports the fault exactly once and still presents', () => {
  const { driver, presented, faults } = harness('SESSION_FAULTED');
  driver.frame(10);

  assert.equal(faults.length, 1, 'once, not once per listener or once per step');
  assert.equal(faults[0]!.code, 'SESSION_FAULTED');
  assert.equal(presented.length, 1, 'a stalled simulation should look stalled, not absent');
});

test('every non-advanced code reaches the fault channel', () => {
  // All eight were dropped in every demo before this existed, `SESSION_FAULTED` included.
  const codes: EngineFrameResultCode[] = [
    'INVALID_ELAPSED_TIME', 'INVALID_INPUT', 'SESSION_PAUSED', 'SESSION_FAULTED',
    'SESSION_DISPOSED', 'SESSION_BUSY', 'COUNTER_LIMIT',
  ];
  for (const code of codes) {
    const { driver, faults } = harness(code);
    driver.frame(1);
    assert.equal(faults[0]?.code, code, `${code} must reach the fault channel`);
  }
});

test('an advanced frame reports no fault', () => {
  const { driver, faults } = harness();
  driver.frame(10);
  driver.frame(10.016);
  assert.deepEqual(faults, []);
});

test('resetting the clock makes the next frame bill nothing', () => {
  const { driver, elapsed } = harness();
  driver.frame(10);
  driver.frame(10.016);
  driver.resetClock();
  driver.frame(30);
  assert.equal(elapsed[2], 0, 'the pause gap is not simulated time');
});

test('a tool step presents the newest state exactly and resets the clock', () => {
  const { driver, elapsed, presented } = harness();
  driver.frame(10);
  const control = Object.freeze({ code: 'STEPPED' as const, session: undefined as never });

  assert.equal(driver.presentStep(control as never), control, 'the control result passes through');
  assert.equal(presented.at(-1), 0, 'alpha 0 is the state the step produced');

  driver.frame(30);
  assert.equal(elapsed.at(-1), 0, 'and the clock gap after a step is not billed');
});

test('presentation alpha defaults to showing the newest state', () => {
  const presented: number[] = [];
  const driver = createSessionFrameDriver<string>({
    advance: () => frameResult(),
    input: () => 'input',
    present: (alpha) => { presented.push(alpha); },
  });
  driver.frame(1);
  assert.deepEqual(presented, [1]);
});

test('a driver with no fault channel still presents', () => {
  const presented: number[] = [];
  const driver = createSessionFrameDriver<string>({
    advance: () => frameResult('SESSION_PAUSED'),
    input: () => 'input',
    present: (alpha) => { presented.push(alpha); },
  });
  assert.doesNotThrow(() => driver.frame(1));
  assert.deepEqual(presented, [1]);
});
