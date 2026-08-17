import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { parseSessionId, parseWorldId } from '../../../src/identity/ids.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  FIXED_STEP_SECONDS,
  MAX_FRAME_ELAPSED_SECONDS,
  MAX_STEPS_PER_FRAME,
  EngineSessionValidationError,
  createEngineSession,
  parseEngineSessionStatus,
  type CompletedEngineStep,
  type EngineSession,
  type EngineSessionOptions,
  type EngineSystem,
} from '../../../src/sessions/engine-session/index.ts';

const SESSION_ID = parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0');
const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');

type TestInput = Readonly<{
  amount: number;
  nested: Readonly<{ enabled: boolean }>;
}>;

function immutableInput(amount: number): TestInput {
  return Object.freeze({ amount, nested: Object.freeze({ enabled: true }) });
}

function createObserverHarness(
  overrides: Partial<EngineSessionOptions<TestInput>> = {},
): {
  session: EngineSession<TestInput>;
  state: { total: number; systemRuns: number };
  observed: CompletedEngineStep<TestInput>[];
} {
  const state = { total: 0, systemRuns: 0 };
  const observed: CompletedEngineStep<TestInput>[] = [];
  const systems: readonly EngineSystem<TestInput>[] = [{
    id: 'apply-input',
    run(step) {
      state.systemRuns += 1;
      state.total += step.input.amount;
    },
  }];
  const session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-completed-step-observer',
    systems,
    captureInput(input) {
      if (!Number.isFinite(input.amount)) return null;
      return immutableInput(input.amount);
    },
    getStateDigest: () => `total:${state.total}`,
    onCompletedStep: (step) => observed.push(step),
    ...overrides,
  });
  return { session, state, observed };
}

test('zero-step frames do not notify the completed-step observer', () => {
  const { session, observed } = createObserverHarness();

  assert.equal(session.advance(0, immutableInput(1)).completedSteps, 0);
  assert.equal(session.advance(FIXED_STEP_SECONDS / 2, immutableInput(1)).completedSteps, 0);

  assert.deepEqual(observed, []);
});

test('one fixed step is observed after its systems and digest with immutable exact state', () => {
  const events: string[] = [];
  let total = 0;
  const input = immutableInput(4);
  const observed: CompletedEngineStep<TestInput>[] = [];
  const statusesDuringObservation: ReturnType<EngineSession<TestInput>['readStatus']>[] = [];
  let session!: EngineSession<TestInput>;
  session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-one-observed-step',
    systems: [{
      id: 'apply-input',
      run(step) {
        events.push(`system:${step.completedStepId}`);
        total += step.input.amount;
      },
    }],
    captureInput: () => input,
    getStateDigest() {
      events.push('digest');
      return `total:${total}`;
    },
    onCompletedStep(step) {
      events.push(`observer:${step.completedStepId}`);
      observed.push(step);
      statusesDuringObservation.push(session.readStatus());
    },
  });

  const result = session.advance(FIXED_STEP_SECONDS, immutableInput(99));

  assert.equal(result.code, 'ADVANCED');
  assert.equal(result.completedSteps, 1);
  assert.deepEqual(events, ['system:1', 'digest', 'observer:1']);
  assert.deepEqual(observed, [{
    completedStepId: 1,
    inputSequence: 1,
    fixedDeltaSeconds: FIXED_STEP_SECONDS,
    source: 'frame',
    input,
    stateDigest: 'total:4',
  }]);
  assert.equal(observed[0], session.readLastCompletedStep());
  assert.equal(statusesDuringObservation[0]?.clock.completedStepCount, 1);
  assert.equal(statusesDuringObservation[0]?.clock.inputSequence, 1);
  assert.deepEqual(statusesDuringObservation[0]?.lastCompletedStep, {
    completedStepId: 1,
    inputSequence: 1,
    stateDigest: 'total:4',
  });
  assert.ok(Object.isFrozen(observed[0]));
  assert.ok(Object.isFrozen(observed[0]!.input));
  assert.ok(Object.isFrozen(observed[0]!.input.nested));
  assert.throws(() => {
    (observed[0] as { completedStepId: number }).completedStepId = 99;
  }, TypeError);
  assert.throws(() => {
    (observed[0]!.input as { amount: number }).amount = 99;
  }, TypeError);
  assert.throws(() => {
    (observed[0]!.input.nested as { enabled: boolean }).enabled = false;
  }, TypeError);
});

test('a maximum catch-up frame observes every completed step once and in order', () => {
  const { session, observed, state } = createObserverHarness();

  const result = session.advance(MAX_FRAME_ELAPSED_SECONDS, immutableInput(2));

  assert.equal(result.completedSteps, MAX_STEPS_PER_FRAME);
  assert.equal(state.systemRuns, MAX_STEPS_PER_FRAME);
  assert.deepEqual(
    observed.map(({ completedStepId, inputSequence, source, stateDigest }) => ({
      completedStepId,
      inputSequence,
      source,
      stateDigest,
    })),
    [
      { completedStepId: 1, inputSequence: 1, source: 'frame', stateDigest: 'total:2' },
      { completedStepId: 2, inputSequence: 1, source: 'frame', stateDigest: 'total:4' },
      { completedStepId: 3, inputSequence: 1, source: 'frame', stateDigest: 'total:6' },
    ],
  );
  assert.equal(new Set(observed).size, MAX_STEPS_PER_FRAME);
  assert.ok(observed.every((step) => step.input === observed[0]!.input));
});

test('a completed tool step is observed once while a stale request is not observed', () => {
  const { session, observed } = createObserverHarness();
  session.pause('tool');

  assert.equal(session.step(0, immutableInput(3)).code, 'STEPPED');
  assert.equal(session.step(0, immutableInput(7)).code, 'STALE_COMPLETED_STEP');

  assert.deepEqual(observed.map((step) => ({
    completedStepId: step.completedStepId,
    inputSequence: step.inputSequence,
    source: step.source,
    stateDigest: step.stateDigest,
  })), [{
    completedStepId: 1,
    inputSequence: 1,
    source: 'single-step',
    stateDigest: 'total:3',
  }]);
});

test('only completed steps before a later system failure are observed and retained', () => {
  const observed: CompletedEngineStep<TestInput>[] = [];
  let systemRuns = 0;
  const { session } = createObserverHarness({
    systems: [{
      id: 'fails-on-second-step',
      run() {
        systemRuns += 1;
        if (systemRuns === 2) throw new Error('private failure');
      },
    }],
    getStateDigest: () => `runs:${systemRuns}`,
    onCompletedStep: (step) => observed.push(step),
  });

  const result = session.advance(MAX_FRAME_ELAPSED_SECONDS, immutableInput(1));

  assert.equal(result.code, 'SESSION_FAULTED');
  assert.equal(result.completedSteps, 1);
  assert.equal(systemRuns, 2);
  assert.deepEqual(observed.map((step) => step.completedStepId), [1]);
  assert.deepEqual(session.readStatus().lastCompletedStep, {
    completedStepId: 1,
    inputSequence: 1,
    stateDigest: 'runs:1',
  });
  assert.equal(session.readStatus().clock.completedStepCount, 1);
});

test('a throwing observer faults after preserving that completed step and stops the batch', () => {
  const observerCalls: number[] = [];
  const { session, state } = createObserverHarness({
    onCompletedStep(step) {
      observerCalls.push(step.completedStepId);
      if (step.completedStepId === 2) throw new Error('observer credential=do-not-expose');
    },
  });

  const result = session.advance(MAX_FRAME_ELAPSED_SECONDS, immutableInput(5));
  const status = session.readStatus();

  assert.equal(result.code, 'SESSION_FAULTED');
  assert.equal(result.completedSteps, 2);
  assert.equal(state.systemRuns, 2);
  assert.equal(state.total, 10);
  assert.deepEqual(observerCalls, [1, 2]);
  assert.equal(status.mode, 'faulted');
  assert.deepEqual(status.fault, {
    code: 'ENGINE_CALLBACK_FAILED',
    source: 'completed-step-observer',
    systemId: null,
  });
  assert.equal(status.clock.completedStepCount, 2);
  assert.equal(status.clock.inputSequence, 1);
  assert.deepEqual(status.lastCompletedStep, {
    completedStepId: 2,
    inputSequence: 1,
    stateDigest: 'total:10',
  });
  assert.equal(session.advance(FIXED_STEP_SECONDS, immutableInput(5)).code, 'SESSION_FAULTED');
  assert.deepEqual(observerCalls, [1, 2]);
  assert.doesNotMatch(JSON.stringify(status), /credential|do-not-expose/);
  assert.deepEqual(parseEngineSessionStatus(JSON.parse(JSON.stringify(status))), status);
});

test('a throwing observer preserves a tool step before faulting the paused session', () => {
  const { session, state } = createObserverHarness({
    onCompletedStep: () => { throw new Error('observer failed'); },
  });
  session.pause('tool');

  const result = session.step(0, immutableInput(6));

  assert.equal(result.code, 'SESSION_FAULTED');
  assert.equal(result.completedStepCount, 1);
  assert.equal(result.renderRequested, false);
  assert.equal(state.total, 6);
  assert.equal(session.readLastCompletedStep()?.completedStepId, 1);
  assert.deepEqual(session.readStatus().fault, {
    code: 'ENGINE_CALLBACK_FAILED',
    source: 'completed-step-observer',
    systemId: null,
  });
});

test('non-step, rejected, failed, paused, faulted, and disposed work never notifies observers', () => {
  const calls: CompletedEngineStep<TestInput>[] = [];
  const active = createObserverHarness({ onCompletedStep: (step) => calls.push(step) }).session;

  assert.equal(active.advance(FIXED_STEP_SECONDS, immutableInput(Number.NaN)).code, 'INVALID_INPUT');
  assert.equal(active.executeCommand(() => ({ result: null, authoringChanged: true })).code, 'EXECUTED');
  active.pause('tool');
  assert.equal(active.advance(FIXED_STEP_SECONDS, immutableInput(1)).code, 'SESSION_PAUSED');
  assert.equal(active.step(1, immutableInput(1)).code, 'STALE_COMPLETED_STEP');
  active.dispose();
  assert.equal(active.advance(FIXED_STEP_SECONDS, immutableInput(1)).code, 'SESSION_DISPOSED');

  const failedSystem = createObserverHarness({
    systems: [{ id: 'broken-system', run: () => { throw new Error('broken'); } }],
    onCompletedStep: (step) => calls.push(step),
  }).session;
  assert.equal(
    failedSystem.advance(FIXED_STEP_SECONDS, immutableInput(1)).code,
    'SESSION_FAULTED',
  );
  assert.equal(
    failedSystem.advance(FIXED_STEP_SECONDS, immutableInput(1)).code,
    'SESSION_FAULTED',
  );

  const failedDigest = createObserverHarness({
    getStateDigest: () => { throw new Error('broken'); },
    onCompletedStep: (step) => calls.push(step),
  }).session;
  assert.equal(
    failedDigest.advance(FIXED_STEP_SECONDS, immutableInput(1)).code,
    'SESSION_FAULTED',
  );

  assert.deepEqual(calls, []);
});

test('construction rejects a non-function completed-step observer', () => {
  assert.throws(
    () => createObserverHarness({ onCompletedStep: 'not-a-function' as never }),
    (error: unknown) => (
      error instanceof EngineSessionValidationError
      && error.path === '$.onCompletedStep'
    ),
  );
});

test('the observer can inspect its committed identity but cannot reenter session authority', () => {
  const reentrantCodes: string[] = [];
  let observedStepCount = 0;
  let session!: EngineSession<TestInput>;
  session = createEngineSession<TestInput>({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-observer-read-only',
    systems: [{ id: 'only-system', run: () => undefined }],
    captureInput: (input) => immutableInput(input.amount),
    onCompletedStep() {
      observedStepCount = session.readStatus().clock.completedStepCount;
      reentrantCodes.push(
        session.advance(FIXED_STEP_SECONDS, immutableInput(2)).code,
        session.pause('tool').code,
        session.step(observedStepCount, immutableInput(2)).code,
        session.executeCommand(() => ({ result: null, authoringChanged: true })).code,
      );
    },
  });

  assert.equal(session.advance(FIXED_STEP_SECONDS, immutableInput(1)).code, 'ADVANCED');
  assert.equal(observedStepCount, 1);
  assert.deepEqual(reentrantCodes, [
    'SESSION_BUSY',
    'SESSION_BUSY',
    'SESSION_BUSY',
    'SESSION_BUSY',
  ]);
  assert.equal(session.readStatus().mode, 'running');
  assert.equal(session.readStatus().clock.completedStepCount, 1);
  assert.deepEqual(session.readStatus().revisions, {
    commandSequence: 0,
    controlRevision: 0,
    worldRevision: 0,
  });
});
