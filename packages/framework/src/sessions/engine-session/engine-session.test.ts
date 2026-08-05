import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { parseSessionId, parseWorldId } from '../../identity/ids.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  FIXED_STEP_SECONDS,
  MAX_FRAME_ELAPSED_SECONDS,
  MAX_STEPS_PER_FRAME,
  EngineSessionDisposalError,
  EngineSessionValidationError,
  createEngineSession,
  parseEngineControlResult,
  parseEngineSessionStatus,
  type EngineSession,
  type EngineSessionOptions,
  type EngineSystem,
} from './index.ts';

const SESSION_ID = parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0');
const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');

type TestInput = Readonly<{ amount: number }>;

function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} did not equal ${expected}`);
}

function createHarness(
  overrides: Partial<EngineSessionOptions<TestInput>> = {},
): {
  session: EngineSession<TestInput>;
  state: { total: number; order: string[] };
} {
  const state = { total: 0, order: [] as string[] };
  const systems: readonly EngineSystem<TestInput>[] = [
    {
      id: 'apply-input',
      run(step) {
        assert.ok(Object.isFrozen(step));
        assert.ok(Object.isFrozen(step.input));
        state.order.push(`apply:${step.completedStepId}:${step.inputSequence}`);
        state.total += step.input.amount;
      },
    },
    {
      id: 'after-input',
      run(step) {
        state.order.push(`after:${step.completedStepId}:${step.inputSequence}`);
      },
    },
  ];
  const session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-session-001',
    systems,
    captureInput(input) {
      if (typeof input?.amount !== 'number' || !Number.isFinite(input.amount)) {
        return null;
      }
      return Object.freeze({ amount: input.amount });
    },
    getStateDigest: () => `total:${state.total}`,
    ...overrides,
  });
  return { session, state };
}

test('the fixed clock handles zero, fractional, exact, and multiple steps', () => {
  const { session, state } = createHarness();

  const zero = session.advance(0, { amount: 100 });
  assert.equal(zero.code, 'ADVANCED');
  assert.equal(zero.completedSteps, 0);
  assert.equal(session.readStatus().clock.completedStepCount, 0);

  const half = session.advance(FIXED_STEP_SECONDS / 2, { amount: 10 });
  assert.equal(half.completedSteps, 0);
  near(session.readStatus().clock.accumulatorSeconds, FIXED_STEP_SECONDS / 2);

  const exact = session.advance(FIXED_STEP_SECONDS / 2, { amount: 2 });
  assert.equal(exact.completedSteps, 1);
  assert.equal(state.total, 2);
  near(session.readStatus().clock.accumulatorSeconds, 0);

  const multiple = session.advance(FIXED_STEP_SECONDS * 2, { amount: 3 });
  assert.equal(multiple.completedSteps, 2);
  assert.equal(state.total, 8);
  assert.deepEqual(state.order, [
    'apply:1:3', 'after:1:3',
    'apply:2:4', 'after:2:4',
    'apply:3:4', 'after:3:4',
  ]);
  assert.deepEqual(session.readStatus().systemOrder, ['apply-input', 'after-input']);
});

test('a long frame stays bounded and reports all discarded time', () => {
  const { session, state } = createHarness();
  const result = session.advance(1, { amount: 1 });

  assert.equal(result.code, 'ADVANCED');
  assert.equal(result.completedSteps, MAX_STEPS_PER_FRAME);
  near(result.acceptedElapsedSeconds, MAX_FRAME_ELAPSED_SECONDS);
  near(result.discardedElapsedSeconds, 1 - MAX_FRAME_ELAPSED_SECONDS);
  near(session.readStatus().clock.totalDiscardedSeconds, 1 - MAX_FRAME_ELAPSED_SECONDS);
  assert.equal(state.total, MAX_STEPS_PER_FRAME);
  assert.ok(session.readStatus().clock.accumulatorSeconds < FIXED_STEP_SECONDS);
});

test('the clock keeps a fractional remainder after the frame step limit', () => {
  const { session } = createHarness();
  session.advance(FIXED_STEP_SECONDS * 0.75, { amount: 1 });

  const result = session.advance(MAX_FRAME_ELAPSED_SECONDS, { amount: 1 });

  assert.equal(result.completedSteps, MAX_STEPS_PER_FRAME);
  near(result.discardedElapsedSeconds, 0);
  near(result.accumulatorSeconds, FIXED_STEP_SECONDS * 0.75);
});

test('invalid elapsed time and invalid input preserve all session state', () => {
  const { session, state } = createHarness();
  const before = session.readStatus();

  for (const elapsed of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(session.advance(elapsed, { amount: 1 }).code, 'INVALID_ELAPSED_TIME');
    assert.deepEqual(session.readStatus(), before);
  }
  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: Number.NaN }).code, 'INVALID_INPUT');
  assert.deepEqual(session.readStatus(), before);
  assert.equal(state.total, 0);
});

test('pause reasons are independent and resume does not add catch-up time', () => {
  const { session } = createHarness();

  assert.equal(session.pause('user').code, 'PAUSED');
  assert.equal(session.pause('user').code, 'NO_OP');
  assert.equal(session.pause('visibility').code, 'PAUSED');
  assert.deepEqual(session.readStatus().pauseReasons, ['user', 'visibility']);
  assert.equal(session.resume('visibility').code, 'RESUMED');
  assert.equal(session.readStatus().mode, 'paused');
  assert.deepEqual(session.readStatus().pauseReasons, ['user']);
  assert.equal(session.advance(60, { amount: 1 }).code, 'SESSION_PAUSED');
  near(session.readStatus().clock.accumulatorSeconds, 0);
  assert.equal(session.resume('user').code, 'RESUMED');
  assert.equal(session.readStatus().mode, 'running');
  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: 1 }).completedSteps, 1);
});

test('single-step is paused, retry-safe, and leaves pause reasons in place', () => {
  const { session, state } = createHarness();
  session.pause('tool');

  const stepped = session.step(0, { amount: 4 });
  assert.equal(stepped.code, 'STEPPED');
  assert.equal(stepped.renderRequested, true);
  assert.equal(session.readStatus().clock.completedStepCount, 1);
  assert.equal(session.readStatus().mode, 'paused');
  assert.deepEqual(session.readStatus().pauseReasons, ['tool']);
  assert.equal(state.total, 4);

  const retry = session.step(0, { amount: 9 });
  assert.equal(retry.code, 'STALE_COMPLETED_STEP');
  assert.equal(state.total, 4);

  session.resume('tool');
  assert.equal(session.step(1, { amount: 9 }).code, 'SESSION_RUNNING');
  assert.equal(state.total, 4);
});

test('control results are strictly validated and frozen at transport boundaries', () => {
  const { session } = createHarness();
  const result = session.pause('tool');

  const parsed = parseEngineControlResult(JSON.parse(JSON.stringify(result)));
  assert.deepEqual(parsed, result);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.pauseReasons));

  assert.throws(
    () => parseEngineControlResult({ ...result, credential: 'must-not-cross' }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
  assert.throws(
    () => parseEngineControlResult({ ...result, mode: 'running' }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
  assert.throws(
    () => parseEngineControlResult({ ...result, completedStepCount: -1 }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
});

test('faulted status is strictly validated and frozen at transport boundaries', () => {
  const { session } = createHarness({
    systems: [{ id: 'broken-system', run: () => { throw new Error('private'); } }],
  });
  session.advance(FIXED_STEP_SECONDS, { amount: 1 });
  const status = session.readStatus();

  const parsed = parseEngineSessionStatus(JSON.parse(JSON.stringify(status)));
  assert.deepEqual(parsed, status);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.fault));

  assert.throws(
    () => parseEngineSessionStatus({ ...status, fault: { ...status.fault, secret: 'no' } }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
  assert.throws(
    () => parseEngineSessionStatus({ ...status, fault: null }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
});

test('equal systems, inputs, and steps produce equal step records and digests', () => {
  const left = createHarness();
  const right = createHarness();
  const frames = [0, 1 / 120, 1 / 120, 1 / 30, 0.05];

  for (const [index, elapsed] of frames.entries()) {
    left.session.advance(elapsed, { amount: index + 1 });
    right.session.advance(elapsed, { amount: index + 1 });
  }

  assert.equal(left.state.total, right.state.total);
  assert.deepEqual(left.state.order, right.state.order);
  assert.deepEqual(left.session.readLastCompletedStep(), right.session.readLastCompletedStep());
  assert.equal(
    left.session.readStatus().lastCompletedStep?.stateDigest,
    right.session.readStatus().lastCompletedStep?.stateDigest,
  );
});

test('system order and captured step input cannot change after session creation', () => {
  const state = { seen: [] as number[] };
  const callerSystems: EngineSystem<TestInput>[] = [{
    id: 'only-system',
    run(step) {
      state.seen.push(step.input.amount);
    },
  }];
  const session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-session-immutable',
    systems: callerSystems,
    captureInput: (input) => Object.freeze({ amount: input.amount }),
  });
  callerSystems.push({ id: 'late-system', run: () => state.seen.push(999) });
  const input = { amount: 5 };

  session.advance(FIXED_STEP_SECONDS, input);
  input.amount = 99;

  assert.deepEqual(state.seen, [5]);
  assert.deepEqual(session.readStatus().systemOrder, ['only-system']);
  assert.deepEqual(session.readLastCompletedStep()?.input, { amount: 5 });
  assert.ok(Object.isFrozen(session.readLastCompletedStep()));
  assert.ok(Object.isFrozen(session.readLastCompletedStep()?.input));
});

test('the command boundary orders work and increments world revision only for changes', () => {
  const { session } = createHarness();
  const accepted = session.executeCommand(({ commandSequence }) => ({
    result: `accepted-${commandSequence}`,
    authoringChanged: true,
  }));
  const noOp = session.executeCommand(({ commandSequence }) => ({
    result: `no-op-${commandSequence}`,
    authoringChanged: false,
  }));
  const rejected = session.executeCommand(({ commandSequence }) => ({
    result: `rejected-${commandSequence}`,
    authoringChanged: false,
  }));

  assert.deepEqual(accepted, {
    code: 'EXECUTED',
    commandSequence: 1,
    worldRevision: 1,
    result: 'accepted-1',
  });
  assert.equal(noOp.commandSequence, 2);
  assert.equal(noOp.worldRevision, 1);
  assert.equal(rejected.commandSequence, 3);
  assert.equal(rejected.worldRevision, 1);
  assert.deepEqual(session.readStatus().revisions, {
    commandSequence: 3,
    controlRevision: 0,
    worldRevision: 1,
  });
});

test('the session rejects reentrant command work at its single-writer boundary', () => {
  const { session } = createHarness();
  const outer = session.executeCommand(() => {
    const inner = session.executeCommand(() => ({ result: 'inner', authoringChanged: true }));
    return { result: inner.code, authoringChanged: false };
  });

  assert.equal(outer.code, 'EXECUTED');
  assert.equal(outer.result, 'SESSION_BUSY');
  assert.deepEqual(session.readStatus().revisions, {
    commandSequence: 1,
    controlRevision: 0,
    worldRevision: 0,
  });
});

test('input capture cannot reenter the session writer', () => {
  let reentrantCode: string | null = null;
  let session!: EngineSession<TestInput>;
  session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-session-input-writer',
    systems: [{ id: 'only-system', run: () => undefined }],
    captureInput(input) {
      reentrantCode = session.pause('tool').code;
      return Object.freeze({ amount: input.amount });
    },
  });

  assert.equal(session.advance(0, { amount: 1 }).code, 'ADVANCED');
  assert.equal(reentrantCode, 'SESSION_BUSY');
  assert.equal(session.readStatus().mode, 'running');
});

test('owned services dispose once in reverse order and later work is rejected', () => {
  const calls: string[] = [];
  const { session, state } = createHarness({
    services: [
      { dispose: () => calls.push('first') },
      { dispose: () => calls.push('second') },
    ],
  });

  session.dispose();
  session.dispose();
  assert.deepEqual(calls, ['second', 'first']);
  assert.equal(session.readStatus().mode, 'disposed');
  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: 1 }).code, 'SESSION_DISPOSED');
  assert.equal(session.pause('tool').code, 'SESSION_DISPOSED');
  assert.equal(session.step(0, { amount: 1 }).code, 'SESSION_DISPOSED');
  assert.equal(session.executeCommand(() => ({ result: null, authoringChanged: true })).code, 'SESSION_DISPOSED');
  assert.equal(state.total, 0);
});

test('disposal continues after a service error and reports one bounded failure', () => {
  const calls: string[] = [];
  const { session } = createHarness({
    services: [
      { dispose: () => calls.push('first') },
      { dispose: () => { calls.push('broken'); throw new Error('failed'); } },
      { dispose: () => calls.push('last') },
    ],
  });

  assert.throws(
    () => session.dispose(),
    (error: unknown) => error instanceof EngineSessionDisposalError && error.failureCount === 1,
  );
  assert.deepEqual(calls, ['last', 'broken', 'first']);
  assert.doesNotThrow(() => session.dispose());
});

test('construction rejects duplicate systems and unsafe initial counters', () => {
  const duplicate: EngineSystem<TestInput>[] = [
    { id: 'same', run: () => undefined },
    { id: 'same', run: () => undefined },
  ];
  assert.throws(
    () => createHarness({ systems: duplicate }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
  assert.throws(
    () => createHarness({ initialCompletedStepCount: Number.MAX_SAFE_INTEGER + 1 }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
  assert.throws(
    () => createHarness({
      systems: Array.from({ length: 257 }, (_, index) => ({
        id: `system-${index}`,
        run: () => undefined,
      })),
    }),
    (error: unknown) => error instanceof EngineSessionValidationError,
  );
});

test('the completed-step counter never exceeds the safe integer limit', () => {
  const { session, state } = createHarness({
    initialCompletedStepCount: Number.MAX_SAFE_INTEGER,
  });
  session.pause('tool');
  const before = session.readStatus();
  assert.equal(session.step(Number.MAX_SAFE_INTEGER, { amount: 1 }).code, 'COUNTER_LIMIT');
  assert.equal(state.total, 0);
  assert.deepEqual(session.readStatus(), before);
});

test('expected input rejection stays recoverable while capture failures fault the session', () => {
  let captureMode: 'reject' | 'throw' = 'reject';
  const session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-session-capture-fault',
    systems: [{ id: 'only-system', run: () => undefined }],
    captureInput(input) {
      if (captureMode === 'reject') return null;
      throw new Error(`unsafe input: ${input.amount}`);
    },
  });

  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: 1 }).code, 'INVALID_INPUT');
  assert.equal(session.readStatus().mode, 'running');
  assert.equal(session.readStatus().fault, null);

  captureMode = 'throw';
  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: 2 }).code, 'SESSION_FAULTED');
  assert.equal(session.readStatus().mode, 'faulted');
  assert.deepEqual(session.readStatus().fault, {
    code: 'ENGINE_CALLBACK_FAILED',
    source: 'input-capture',
    systemId: null,
  });
  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: 3 }).code, 'SESSION_FAULTED');
});

test('a system failure is terminal, inspectable, and never retried', () => {
  let mutations = 0;
  const session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-session-system-fault',
    systems: [{
      id: 'unsafe-system',
      run() {
        mutations += 1;
        throw new Error('secret system failure');
      },
    }],
    captureInput: (input) => Object.freeze({ amount: input.amount }),
  });

  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: 1 }).code, 'SESSION_FAULTED');
  assert.equal(mutations, 1);
  assert.deepEqual(session.readStatus().fault, {
    code: 'ENGINE_CALLBACK_FAILED',
    source: 'system',
    systemId: 'unsafe-system',
  });
  assert.equal(session.pause('tool').code, 'SESSION_FAULTED');
  assert.equal(
    session.executeCommand(() => ({ result: 'should-not-run', authoringChanged: true })).code,
    'SESSION_FAULTED',
  );
  assert.equal(session.advance(FIXED_STEP_SECONDS, { amount: 1 }).code, 'SESSION_FAULTED');
  assert.equal(mutations, 1);

  session.dispose();
  assert.equal(session.readStatus().mode, 'disposed');
  assert.equal(session.readStatus().fault?.source, 'system');
});

test('state-digest and command failures fault without exposing thrown messages', () => {
  const digestSession = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-session-digest-fault',
    systems: [{ id: 'only-system', run: () => undefined }],
    captureInput: (input) => Object.freeze({ amount: input.amount }),
    getStateDigest() {
      throw new Error('digest credential=do-not-expose');
    },
  });

  assert.equal(
    digestSession.advance(FIXED_STEP_SECONDS, { amount: 1 }).code,
    'SESSION_FAULTED',
  );
  assert.deepEqual(digestSession.readStatus().fault, {
    code: 'ENGINE_CALLBACK_FAILED',
    source: 'state-digest',
    systemId: null,
  });
  assert.doesNotMatch(JSON.stringify(digestSession.readStatus()), /credential|do-not-expose/);

  let commandMutations = 0;
  const commandSession = createHarness().session;
  const command = commandSession.executeCommand(() => {
    commandMutations += 1;
    throw new Error('command credential=do-not-expose');
  });
  assert.equal(command.code, 'SESSION_FAULTED');
  assert.equal(commandMutations, 1);
  assert.deepEqual(commandSession.readStatus().fault, {
    code: 'ENGINE_CALLBACK_FAILED',
    source: 'command',
    systemId: null,
  });
  assert.equal(
    commandSession.executeCommand(() => {
      commandMutations += 1;
      return { result: null, authoringChanged: true };
    }).code,
    'SESSION_FAULTED',
  );
  assert.equal(commandMutations, 1);
  assert.doesNotMatch(JSON.stringify(commandSession.readStatus()), /credential|do-not-expose/);
});
