import {
  IdValidationError,
  parseSessionId,
  parseWorldId,
} from '../../identity/ids.ts';
import {
  ENGINE_SESSION_SCHEMA_VERSION,
  FIXED_STEP_SECONDS,
  MAX_ENGINE_SYSTEMS,
  MAX_FRAME_ELAPSED_SECONDS,
  MAX_STEPS_PER_FRAME,
  type EngineControlResult,
  type EngineControlResultCode,
  type EngineSessionFault,
  type EngineSessionStatus,
} from './contract.ts';
import {
  FAULT_SOURCES,
  MAX_DIGEST_LENGTH,
  SESSION_MODES,
  SYSTEM_ID_PATTERN,
  fail,
  readPauseReasons,
  readRuntimeInstanceId,
  readSafeCount,
} from './validation.ts';

const CONTROL_RESULT_CODES = [
  'PAUSED',
  'RESUMED',
  'STEPPED',
  'NO_OP',
  'INVALID_PAUSE_REASON',
  'INVALID_EXPECTED_STEP',
  'INVALID_INPUT',
  'STALE_COMPLETED_STEP',
  'SESSION_RUNNING',
  'SESSION_FAULTED',
  'SESSION_DISPOSED',
  'SESSION_BUSY',
  'COUNTER_LIMIT',
] as const satisfies readonly EngineControlResultCode[];

type UnknownRecord = Record<string, unknown>;

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(value: UnknownRecord, expected: readonly string[], path: string): void {
  const allowed = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('Unknown field', `${path}.${key}`);
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) fail('Missing field', `${path}.${key}`);
  }
}

function readLiteral<Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  path: string,
): Value {
  if (typeof value !== 'string' || !allowed.includes(value as Value)) {
    fail(`Expected one of: ${allowed.join(', ')}`, path);
  }
  return value as Value;
}

function readNonNegativeFinite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail('Expected a non-negative finite number', path);
  }
  return value;
}

function readId<Id>(operation: () => Id, path: string): Id {
  try {
    return operation();
  } catch (error) {
    if (error instanceof IdValidationError) fail(error.message, path);
    throw error;
  }
}

/** Validate and freeze a control result received through a development boundary. */
export function parseEngineControlResult(value: unknown, path = '$'): EngineControlResult {
  const record = readObject(value, path);
  checkKeys(record, [
    'code',
    'mode',
    'completedStepCount',
    'controlRevision',
    'pauseReasons',
    'renderRequested',
  ], path);
  const code = readLiteral(record.code, CONTROL_RESULT_CODES, `${path}.code`);
  const mode = readLiteral(record.mode, SESSION_MODES, `${path}.mode`);
  const pauseReasons = readPauseReasons(record.pauseReasons, mode, `${path}.pauseReasons`);
  if (typeof record.renderRequested !== 'boolean') {
    fail('Expected a boolean', `${path}.renderRequested`);
  }
  if (record.renderRequested !== (code === 'STEPPED')) {
    fail('Only a completed single-step requests a render', `${path}.renderRequested`);
  }
  if ((code === 'PAUSED' || code === 'STEPPED') && mode !== 'paused') {
    fail(`${code} requires paused mode`, `${path}.mode`);
  }
  if (code === 'SESSION_RUNNING' && mode !== 'running') {
    fail('SESSION_RUNNING requires running mode', `${path}.mode`);
  }
  if ((code === 'SESSION_FAULTED') !== (mode === 'faulted')) {
    fail('Faulted mode requires SESSION_FAULTED', `${path}.mode`);
  }
  if (code === 'SESSION_DISPOSED' && mode !== 'disposed') {
    fail('SESSION_DISPOSED requires disposed mode', `${path}.mode`);
  }
  return Object.freeze({
    code,
    mode,
    completedStepCount: readSafeCount(record.completedStepCount, `${path}.completedStepCount`),
    controlRevision: readSafeCount(record.controlRevision, `${path}.controlRevision`),
    pauseReasons,
    renderRequested: record.renderRequested,
  });
}

/** Validate and freeze session status received through an inspection boundary. */
export function parseEngineSessionStatus(value: unknown, path = '$'): EngineSessionStatus {
  const record = readObject(value, path);
  checkKeys(record, [
    'schemaVersion',
    'sessionId',
    'worldId',
    'runtimeInstanceId',
    'mode',
    'fault',
    'pauseReasons',
    'systemOrder',
    'clock',
    'revisions',
    'lastCompletedStep',
  ], path);
  if (record.schemaVersion !== ENGINE_SESSION_SCHEMA_VERSION) {
    fail(`Expected schema version ${ENGINE_SESSION_SCHEMA_VERSION}`, `${path}.schemaVersion`);
  }

  const mode = readLiteral(record.mode, SESSION_MODES, `${path}.mode`);
  const pauseReasons = readPauseReasons(record.pauseReasons, mode, `${path}.pauseReasons`);
  if (!Array.isArray(record.systemOrder) || record.systemOrder.length === 0) {
    fail('Expected at least one system ID', `${path}.systemOrder`);
  }
  if (record.systemOrder.length > MAX_ENGINE_SYSTEMS) {
    fail(`Expected at most ${MAX_ENGINE_SYSTEMS} system IDs`, `${path}.systemOrder`);
  }
  const systemIds = new Set<string>();
  const systemOrder = Object.freeze(record.systemOrder.map((systemId, index) => {
    if (typeof systemId !== 'string' || !SYSTEM_ID_PATTERN.test(systemId)) {
      fail('Expected a stable system ID', `${path}.systemOrder[${index}]`);
    }
    if (systemIds.has(systemId)) fail('System IDs must be unique', `${path}.systemOrder[${index}]`);
    systemIds.add(systemId);
    return systemId;
  }));

  let fault: EngineSessionFault | null = null;
  if (record.fault !== null) {
    const faultRecord = readObject(record.fault, `${path}.fault`);
    checkKeys(faultRecord, ['code', 'source', 'systemId'], `${path}.fault`);
    if (faultRecord.code !== 'ENGINE_CALLBACK_FAILED') {
      fail('Expected ENGINE_CALLBACK_FAILED', `${path}.fault.code`);
    }
    const source = readLiteral(faultRecord.source, FAULT_SOURCES, `${path}.fault.source`);
    let systemId: string | null = null;
    if (faultRecord.systemId !== null) {
      if (
        typeof faultRecord.systemId !== 'string'
        || !SYSTEM_ID_PATTERN.test(faultRecord.systemId)
        || !systemIds.has(faultRecord.systemId)
      ) {
        fail('Expected a session system ID', `${path}.fault.systemId`);
      }
      systemId = faultRecord.systemId;
    }
    if ((source === 'system') !== (systemId !== null)) {
      fail('Only system failures identify a system', `${path}.fault.systemId`);
    }
    fault = Object.freeze({ code: 'ENGINE_CALLBACK_FAILED', source, systemId });
  }
  if (mode === 'faulted' && fault === null) {
    fail('A faulted session needs fault information', `${path}.fault`);
  }
  if ((mode === 'running' || mode === 'paused') && fault !== null) {
    fail('An active session cannot contain a terminal fault', `${path}.fault`);
  }

  const clockRecord = readObject(record.clock, `${path}.clock`);
  checkKeys(clockRecord, [
    'fixedStepSeconds',
    'maximumFrameElapsedSeconds',
    'maximumStepsPerFrame',
    'accumulatorSeconds',
    'completedStepCount',
    'inputSequence',
    'totalAcceptedElapsedSeconds',
    'totalDiscardedSeconds',
  ], `${path}.clock`);
  if (clockRecord.fixedStepSeconds !== FIXED_STEP_SECONDS) {
    fail(`Expected ${FIXED_STEP_SECONDS}`, `${path}.clock.fixedStepSeconds`);
  }
  if (clockRecord.maximumFrameElapsedSeconds !== MAX_FRAME_ELAPSED_SECONDS) {
    fail(`Expected ${MAX_FRAME_ELAPSED_SECONDS}`, `${path}.clock.maximumFrameElapsedSeconds`);
  }
  if (clockRecord.maximumStepsPerFrame !== MAX_STEPS_PER_FRAME) {
    fail(`Expected ${MAX_STEPS_PER_FRAME}`, `${path}.clock.maximumStepsPerFrame`);
  }
  const accumulatorSeconds = readNonNegativeFinite(
    clockRecord.accumulatorSeconds,
    `${path}.clock.accumulatorSeconds`,
  );
  if (accumulatorSeconds >= FIXED_STEP_SECONDS) {
    fail('Expected less than one fixed step', `${path}.clock.accumulatorSeconds`);
  }
  const completedStepCount = readSafeCount(
    clockRecord.completedStepCount,
    `${path}.clock.completedStepCount`,
  );
  const inputSequence = readSafeCount(clockRecord.inputSequence, `${path}.clock.inputSequence`);
  const clock = Object.freeze({
    fixedStepSeconds: FIXED_STEP_SECONDS,
    maximumFrameElapsedSeconds: MAX_FRAME_ELAPSED_SECONDS,
    maximumStepsPerFrame: MAX_STEPS_PER_FRAME,
    accumulatorSeconds,
    completedStepCount,
    inputSequence,
    totalAcceptedElapsedSeconds: readNonNegativeFinite(
      clockRecord.totalAcceptedElapsedSeconds,
      `${path}.clock.totalAcceptedElapsedSeconds`,
    ),
    totalDiscardedSeconds: readNonNegativeFinite(
      clockRecord.totalDiscardedSeconds,
      `${path}.clock.totalDiscardedSeconds`,
    ),
  });

  const revisionRecord = readObject(record.revisions, `${path}.revisions`);
  checkKeys(
    revisionRecord,
    ['commandSequence', 'controlRevision', 'worldRevision'],
    `${path}.revisions`,
  );
  const revisions = Object.freeze({
    commandSequence: readSafeCount(
      revisionRecord.commandSequence,
      `${path}.revisions.commandSequence`,
    ),
    controlRevision: readSafeCount(
      revisionRecord.controlRevision,
      `${path}.revisions.controlRevision`,
    ),
    worldRevision: readSafeCount(revisionRecord.worldRevision, `${path}.revisions.worldRevision`),
  });

  let lastCompletedStep: EngineSessionStatus['lastCompletedStep'] = null;
  if (record.lastCompletedStep !== null) {
    const stepRecord = readObject(record.lastCompletedStep, `${path}.lastCompletedStep`);
    checkKeys(
      stepRecord,
      ['completedStepId', 'inputSequence', 'stateDigest'],
      `${path}.lastCompletedStep`,
    );
    const completedStepId = readSafeCount(
      stepRecord.completedStepId,
      `${path}.lastCompletedStep.completedStepId`,
    );
    const stepInputSequence = readSafeCount(
      stepRecord.inputSequence,
      `${path}.lastCompletedStep.inputSequence`,
    );
    if (completedStepId === 0 || completedStepId !== completedStepCount) {
      fail('Expected the latest completed-step ID', `${path}.lastCompletedStep.completedStepId`);
    }
    if (stepInputSequence > inputSequence) {
      fail('Step input sequence exceeds the clock', `${path}.lastCompletedStep.inputSequence`);
    }
    const stateDigest = stepRecord.stateDigest;
    if (
      stateDigest !== null
      && (
        typeof stateDigest !== 'string'
        || stateDigest.length === 0
        || stateDigest.length > MAX_DIGEST_LENGTH
      )
    ) {
      fail(
        `Expected null or 1 through ${MAX_DIGEST_LENGTH} digest characters`,
        `${path}.lastCompletedStep.stateDigest`,
      );
    }
    lastCompletedStep = Object.freeze({
      completedStepId,
      inputSequence: stepInputSequence,
      stateDigest: stateDigest as string | null,
    });
  }

  return Object.freeze({
    schemaVersion: ENGINE_SESSION_SCHEMA_VERSION,
    sessionId: readId(() => parseSessionId(record.sessionId), `${path}.sessionId`),
    worldId: readId(() => parseWorldId(record.worldId), `${path}.worldId`),
    runtimeInstanceId: readRuntimeInstanceId(record.runtimeInstanceId, `${path}.runtimeInstanceId`),
    mode,
    fault,
    pauseReasons,
    systemOrder,
    clock,
    revisions,
    lastCompletedStep,
  });
}
