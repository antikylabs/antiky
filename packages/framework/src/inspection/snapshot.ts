import {
  PointLightInspectionValidationError,
  createPointLightInspection,
  type PointLightInspection,
  type PointLightInspectionInput,
} from '../point-light/inspection.ts';
import {
  parseEngineSessionStatus,
  type EngineSessionStatus,
} from '../sessions/engine-session/index.ts';

export const INSPECTION_SCHEMA_VERSION = 1 as const;
export const MAX_INSPECTION_DIAGNOSTICS = 64;
export const MAX_DIAGNOSTIC_RELATED_IDS = 16;

export type RuntimeLifecycle =
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'error'
  | 'stopped';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';
export type DiagnosticSource = 'runtime' | 'render';

export type InspectionDiagnosticInput = {
  id: string;
  owner: 'framework';
  source: DiagnosticSource;
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  relatedIds: string[];
};

export type InspectionRuntimeMeasurementsInput = {
  owner: 'framework';
  frameCount: number;
  framesPerSecond?: number;
};

export type InspectionRenderMeasurementsInput = {
  owner: 'framework';
  canvasWidth?: number;
  canvasHeight?: number;
  drawCalls?: number;
  instances?: number;
  uploadBytesPerFrame?: number;
};

export type InspectionSnapshotInput = {
  schemaVersion: typeof INSPECTION_SCHEMA_VERSION;
  runtime: {
    instanceId: string;
    lifecycle: RuntimeLifecycle;
  };
  diagnostics: InspectionDiagnosticInput[];
  measurements: {
    runtime: InspectionRuntimeMeasurementsInput;
    render: InspectionRenderMeasurementsInput;
  };
  session?: EngineSessionStatus;
  pointLights?: PointLightInspectionInput;
};

export type InspectionDiagnostic = Readonly<{
  id: string;
  owner: 'framework';
  source: DiagnosticSource;
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  relatedIds: readonly string[];
}>;

export type InspectionRuntimeMeasurements = Readonly<{
  owner: 'framework';
  frameCount: number;
  framesPerSecond?: number;
}>;

export type InspectionRenderMeasurements = Readonly<{
  owner: 'framework';
  canvasWidth?: number;
  canvasHeight?: number;
  drawCalls?: number;
  instances?: number;
  uploadBytesPerFrame?: number;
}>;

export type InspectionSnapshot = Readonly<{
  schemaVersion: typeof INSPECTION_SCHEMA_VERSION;
  runtime: Readonly<{
    instanceId: string;
    lifecycle: RuntimeLifecycle;
  }>;
  diagnostics: readonly InspectionDiagnostic[];
  measurements: Readonly<{
    runtime: InspectionRuntimeMeasurements;
    render: InspectionRenderMeasurements;
  }>;
  session?: EngineSessionStatus;
  pointLights?: PointLightInspection;
}>;

export type InspectionUpdate = Readonly<{
  sequence: number;
  snapshot: InspectionSnapshot;
}>;

export type InspectionSubscriber = (update: InspectionUpdate) => void;

export interface InspectionSource {
  read(): InspectionSnapshot;
  subscribe(subscriber: InspectionSubscriber): () => void;
}

export interface InspectionStore extends InspectionSource {
  publish(input: unknown): InspectionUpdate;
}

export class InspectionValidationError extends Error {
  readonly code = 'ANTIKY_INSPECTION_INVALID';

  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = 'InspectionValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string, path: string): never {
  throw new InspectionValidationError(message, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('Unknown field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('Missing field', `${path}.${key}`);
  }
}

function readString(
  value: unknown,
  path: string,
  maximumLength: number,
  pattern?: RegExp,
): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    fail(`Expected a non-empty string no longer than ${maximumLength} characters`, path);
  }
  if (pattern && !pattern.test(value)) fail('String has an invalid format', path);
  return value;
}

function readLiteral<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`Expected one of: ${allowed.join(', ')}`, path);
  }
  return value as T;
}

function readCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail('Expected a non-negative safe integer', path);
  }
  return value;
}

function readRate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail('Expected a non-negative finite number', path);
  }
  return value;
}

function readDiagnostic(value: unknown, path: string): InspectionDiagnostic {
  const record = readObject(value, path);
  checkKeys(
    record,
    ['id', 'owner', 'source', 'code', 'severity', 'message', 'relatedIds'],
    [],
    path,
  );
  if (!Array.isArray(record.relatedIds)) fail('Expected an array', `${path}.relatedIds`);
  if (record.relatedIds.length > MAX_DIAGNOSTIC_RELATED_IDS) {
    fail(`Expected at most ${MAX_DIAGNOSTIC_RELATED_IDS} related IDs`, `${path}.relatedIds`);
  }

  const relatedIds = Object.freeze(record.relatedIds.map((relatedId, index) => (
    readString(relatedId, `${path}.relatedIds[${index}]`, 128, /^[A-Za-z0-9._:-]+$/)
  )));
  const owner = readLiteral(record.owner, ['framework'] as const, `${path}.owner`);
  const source = readLiteral(record.source, ['runtime', 'render'] as const, `${path}.source`);
  const severity = readLiteral(
    record.severity,
    ['info', 'warning', 'error'] as const,
    `${path}.severity`,
  );

  return Object.freeze({
    id: readString(record.id, `${path}.id`, 128, /^[A-Za-z0-9._:-]+$/),
    owner,
    source,
    code: readString(record.code, `${path}.code`, 64, /^[A-Z][A-Z0-9_]*$/),
    severity,
    message: readString(record.message, `${path}.message`, 1024),
    relatedIds,
  });
}

function readRuntimeMeasurements(
  value: unknown,
  path: string,
): InspectionRuntimeMeasurements {
  const record = readObject(value, path);
  checkKeys(record, ['owner', 'frameCount'], ['framesPerSecond'], path);
  const framesPerSecond = Object.hasOwn(record, 'framesPerSecond')
    ? readRate(record.framesPerSecond, `${path}.framesPerSecond`)
    : undefined;

  return Object.freeze({
    owner: readLiteral(record.owner, ['framework'] as const, `${path}.owner`),
    frameCount: readCount(record.frameCount, `${path}.frameCount`),
    ...(framesPerSecond === undefined ? {} : { framesPerSecond }),
  });
}

function readRenderMeasurements(
  value: unknown,
  path: string,
): InspectionRenderMeasurements {
  const record = readObject(value, path);
  const optional = [
    'canvasWidth',
    'canvasHeight',
    'drawCalls',
    'instances',
    'uploadBytesPerFrame',
  ] as const;
  checkKeys(record, ['owner'], optional, path);

  const measurements: {
    owner: 'framework';
    canvasWidth?: number;
    canvasHeight?: number;
    drawCalls?: number;
    instances?: number;
    uploadBytesPerFrame?: number;
  } = {
    owner: readLiteral(record.owner, ['framework'] as const, `${path}.owner`),
  };
  for (const name of optional) {
    if (Object.hasOwn(record, name)) measurements[name] = readCount(record[name], `${path}.${name}`);
  }
  return Object.freeze(measurements);
}

export function createInspectionSnapshot(input: unknown): InspectionSnapshot {
  const record = readObject(input, '$');
  checkKeys(
    record,
    ['schemaVersion', 'runtime', 'diagnostics', 'measurements'],
    ['session', 'pointLights'],
    '$',
  );
  if (record.schemaVersion !== INSPECTION_SCHEMA_VERSION) {
    fail(`Expected schema version ${INSPECTION_SCHEMA_VERSION}`, '$.schemaVersion');
  }

  const runtime = readObject(record.runtime, '$.runtime');
  checkKeys(runtime, ['instanceId', 'lifecycle'], [], '$.runtime');
  const immutableRuntime = Object.freeze({
    instanceId: readString(
      runtime.instanceId,
      '$.runtime.instanceId',
      128,
      /^[A-Za-z0-9._:-]+$/,
    ),
    lifecycle: readLiteral(
      runtime.lifecycle,
      ['initializing', 'ready', 'running', 'paused', 'error', 'stopped'] as const,
      '$.runtime.lifecycle',
    ),
  });

  if (!Array.isArray(record.diagnostics)) fail('Expected an array', '$.diagnostics');
  if (record.diagnostics.length > MAX_INSPECTION_DIAGNOSTICS) {
    fail(`Expected at most ${MAX_INSPECTION_DIAGNOSTICS} diagnostics`, '$.diagnostics');
  }
  const diagnostics = Object.freeze(record.diagnostics.map((diagnostic, index) => (
    readDiagnostic(diagnostic, `$.diagnostics[${index}]`)
  )));

  const measurements = readObject(record.measurements, '$.measurements');
  checkKeys(measurements, ['runtime', 'render'], [], '$.measurements');
  const immutableMeasurements = Object.freeze({
    runtime: readRuntimeMeasurements(measurements.runtime, '$.measurements.runtime'),
    render: readRenderMeasurements(measurements.render, '$.measurements.render'),
  });

  const pointLights = Object.hasOwn(record, 'pointLights')
    ? createPointLightInspection(record.pointLights, '$.pointLights')
    : undefined;
  const session = Object.hasOwn(record, 'session')
    ? parseEngineSessionStatus(record.session, '$.session')
    : undefined;
  if (session && session.runtimeInstanceId !== immutableRuntime.instanceId) {
    fail('Session runtime identity does not match inspection', '$.session.runtimeInstanceId');
  }
  if (pointLights && pointLights.runtime.instanceId !== immutableRuntime.instanceId) {
    throw new PointLightInspectionValidationError(
      'Point-light runtime identity does not match inspection',
      '$.pointLights.runtime.instanceId',
    );
  }
  if (session && pointLights && pointLights.worldId !== session.worldId) {
    fail('Point-light world identity does not match session', '$.pointLights.worldId');
  }

  return Object.freeze({
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    runtime: immutableRuntime,
    diagnostics,
    measurements: immutableMeasurements,
    ...(session === undefined ? {} : { session }),
    ...(pointLights === undefined ? {} : { pointLights }),
  });
}

export function createInspectionStore(initialSnapshot: unknown): InspectionStore {
  let current = createInspectionSnapshot(initialSnapshot);
  let sequence = 0;
  const subscribers = new Set<InspectionSubscriber>();

  return Object.freeze({
    read(): InspectionSnapshot {
      return current;
    },
    subscribe(subscriber: InspectionSubscriber): () => void {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    publish(input: unknown): InspectionUpdate {
      current = createInspectionSnapshot(input);
      sequence += 1;
      const update = Object.freeze({ sequence, snapshot: current });
      for (const subscriber of subscribers) subscriber(update);
      return update;
    },
  });
}
