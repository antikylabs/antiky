import {
  IdValidationError,
  parseCommandId,
  parseEntityId,
  parseWorldId,
  type CommandId,
  type EntityId,
  type WorldId,
} from '../identity/ids.ts';

export const POINT_LIGHT_COMMAND_PROTOCOL_VERSION = 1 as const;
export const POINT_LIGHT_COMMAND_VERSION = 1 as const;
export const POINT_LIGHT_FACT_SCHEMA_VERSION = 1 as const;
export const POINT_LIGHT_RESULT_SCHEMA_VERSION = 1 as const;
export const MAX_POINT_LIGHT_COMMAND_BYTES = 4 * 1024;
export const MAX_POINT_LIGHT_COMMAND_RESULTS = 256;
export const MAX_POINT_LIGHT_POWER_FACTS = 256;
export const POINT_LIGHT_EDIT_PERMISSION = 'world.light.edit' as const;
export const SET_POINT_LIGHT_POWER_COMMAND_TYPE = 'antiky.authoring.set-point-light-power' as const;
export const POINT_LIGHT_POWER_SET_FACT_TYPE = 'antiky.authoring.point-light-power-set' as const;

export type SetPointLightPowerCommand = Readonly<{
  protocolVersion: typeof POINT_LIGHT_COMMAND_PROTOCOL_VERSION;
  commandVersion: typeof POINT_LIGHT_COMMAND_VERSION;
  type: typeof SET_POINT_LIGHT_POWER_COMMAND_TYPE;
  commandId: CommandId;
  worldId: WorldId;
  entityId: EntityId;
  expectedRevision: number;
  data: Readonly<{
    power: number;
    correctionOf?: CommandId;
  }>;
}>;

export type CorrectPointLightPowerRequest = Readonly<{
  protocolVersion: typeof POINT_LIGHT_COMMAND_PROTOCOL_VERSION;
  commandVersion: typeof POINT_LIGHT_COMMAND_VERSION;
  commandId: CommandId;
  correctedCommandId: CommandId;
  expectedRevision: number;
}>;

export type PointLightCommandContextInput = Readonly<{
  principalId: string;
  permissions: readonly string[];
  receivedAt: string;
  runtimeInstanceId: string;
}>;

export type PointLightCommandContext = Readonly<{
  principalId: string;
  permissions: readonly string[];
  receivedAt: string;
  runtimeInstanceId: string;
}>;

export type PointLightCommandResultCode =
  | 'ACCEPTED'
  | 'NO_OP'
  | 'INVALID_COMMAND'
  | 'WORLD_NOT_FOUND'
  | 'ENTITY_NOT_FOUND'
  | 'MISSING_PERMISSION'
  | 'DUPLICATE_COMMAND'
  | 'STALE_REVISION'
  | 'VALUE_OUT_OF_RANGE'
  | 'HISTORY_CAPACITY_REACHED'
  | 'EVENT_SEQUENCE_ERROR';

export type PointLightPowerSetFact = Readonly<{
  schemaVersion: typeof POINT_LIGHT_FACT_SCHEMA_VERSION;
  type: typeof POINT_LIGHT_POWER_SET_FACT_TYPE;
  eventSequence: number;
  sourceCommandId: CommandId;
  worldId: WorldId;
  entityId: EntityId;
  oldPower: number;
  newPower: number;
  resultingRevision: number;
  receivedAt: string;
  correctionOf?: CommandId;
}>;

export type PointLightCommandResult = Readonly<{
  schemaVersion: typeof POINT_LIGHT_RESULT_SCHEMA_VERSION;
  code: PointLightCommandResultCode;
  accepted: boolean;
  commandId: CommandId | null;
  worldId: WorldId | null;
  entityId: EntityId | null;
  currentRevision: number | null;
  resultingRevision: number | null;
  eventSequence: number | null;
  runtimeInstanceId: string | null;
  duplicateOfCode?: PointLightCommandResultCode;
  fact?: PointLightPowerSetFact;
}>;

export class PointLightCommandValidationError extends Error {
  readonly code = 'INVALID_COMMAND';

  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = 'PointLightCommandValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string, path: string): never {
  throw new PointLightCommandValidationError(message, path);
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

function readLiteral<T extends string | number>(value: unknown, expected: T, path: string): T {
  if (value !== expected) fail(`Expected ${String(expected)}`, path);
  return expected;
}

function readId<T>(operation: () => T, path: string): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof IdValidationError) fail(error.message, path);
    throw error;
  }
}

function readRevision(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe-integer revision', path);
  }
  return value as number;
}

function readPower(value: unknown, path: string): number {
  if (typeof value !== 'number') fail('Expected a numeric power', path);
  return value;
}

function readBoundedString(value: unknown, path: string, maximumLength = 128): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximumLength
    || !/^[A-Za-z0-9._:@+-]+$/.test(value)
  ) {
    fail(`Expected a bounded identifier with at most ${maximumLength} characters`, path);
  }
  return value;
}

function readReceivedAt(value: unknown, path: string): string {
  if (
    typeof value !== 'string'
    || value.length > 64
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    fail('Expected an ISO 8601 UTC receipt time', path);
  }
  return value;
}

export function encodedJsonByteLength(value: unknown): number | null {
  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return null;
  }
  if (encoded === undefined) return null;
  let bytes = 0;
  for (const character of encoded) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function parseSetPointLightPowerCommand(value: unknown): SetPointLightPowerCommand {
  const record = readObject(value, '$');
  checkKeys(record, [
    'protocolVersion',
    'commandVersion',
    'type',
    'commandId',
    'worldId',
    'entityId',
    'expectedRevision',
    'data',
  ], [], '$');
  const data = readObject(record.data, '$.data');
  checkKeys(data, ['power'], ['correctionOf'], '$.data');
  const correctionOf = Object.hasOwn(data, 'correctionOf')
    ? readId(() => parseCommandId(data.correctionOf), '$.data.correctionOf')
    : undefined;
  return Object.freeze({
    protocolVersion: readLiteral(
      record.protocolVersion,
      POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
      '$.protocolVersion',
    ),
    commandVersion: readLiteral(
      record.commandVersion,
      POINT_LIGHT_COMMAND_VERSION,
      '$.commandVersion',
    ),
    type: readLiteral(record.type, SET_POINT_LIGHT_POWER_COMMAND_TYPE, '$.type'),
    commandId: readId(() => parseCommandId(record.commandId), '$.commandId'),
    worldId: readId(() => parseWorldId(record.worldId), '$.worldId'),
    entityId: readId(() => parseEntityId(record.entityId), '$.entityId'),
    expectedRevision: readRevision(record.expectedRevision, '$.expectedRevision'),
    data: Object.freeze({
      power: readPower(data.power, '$.data.power'),
      ...(correctionOf === undefined ? {} : { correctionOf }),
    }),
  });
}

export function parseCorrectPointLightPowerRequest(value: unknown): CorrectPointLightPowerRequest {
  const record = readObject(value, '$');
  checkKeys(record, [
    'protocolVersion',
    'commandVersion',
    'commandId',
    'correctedCommandId',
    'expectedRevision',
  ], [], '$');
  return Object.freeze({
    protocolVersion: readLiteral(
      record.protocolVersion,
      POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
      '$.protocolVersion',
    ),
    commandVersion: readLiteral(
      record.commandVersion,
      POINT_LIGHT_COMMAND_VERSION,
      '$.commandVersion',
    ),
    commandId: readId(() => parseCommandId(record.commandId), '$.commandId'),
    correctedCommandId: readId(
      () => parseCommandId(record.correctedCommandId),
      '$.correctedCommandId',
    ),
    expectedRevision: readRevision(record.expectedRevision, '$.expectedRevision'),
  });
}

export function parsePointLightCommandContext(value: unknown): PointLightCommandContext {
  const record = readObject(value, '$context');
  checkKeys(
    record,
    ['principalId', 'permissions', 'receivedAt', 'runtimeInstanceId'],
    [],
    '$context',
  );
  if (!Array.isArray(record.permissions) || record.permissions.length > 32) {
    fail('Expected at most 32 permissions', '$context.permissions');
  }
  const permissions = Object.freeze(record.permissions.map((permission, index) => (
    readBoundedString(permission, `$context.permissions[${index}]`)
  )));
  return Object.freeze({
    principalId: readBoundedString(record.principalId, '$context.principalId'),
    permissions,
    receivedAt: readReceivedAt(record.receivedAt, '$context.receivedAt'),
    runtimeInstanceId: readBoundedString(
      record.runtimeInstanceId,
      '$context.runtimeInstanceId',
    ),
  });
}

const POINT_LIGHT_COMMAND_RESULT_CODES = Object.freeze([
  'ACCEPTED',
  'NO_OP',
  'INVALID_COMMAND',
  'WORLD_NOT_FOUND',
  'ENTITY_NOT_FOUND',
  'MISSING_PERMISSION',
  'DUPLICATE_COMMAND',
  'STALE_REVISION',
  'VALUE_OUT_OF_RANGE',
  'HISTORY_CAPACITY_REACHED',
  'EVENT_SEQUENCE_ERROR',
] as const satisfies readonly PointLightCommandResultCode[]);

function readResultCode(value: unknown, path: string): PointLightCommandResultCode {
  if (
    typeof value !== 'string'
    || !(POINT_LIGHT_COMMAND_RESULT_CODES as readonly string[]).includes(value)
  ) fail('Expected a stable point-light result code', path);
  return value as PointLightCommandResultCode;
}

function readNullableId<T>(value: unknown, operation: () => T, path: string): T | null {
  return value === null ? null : readId(operation, path);
}

function readNullableRevision(value: unknown, path: string): number | null {
  return value === null ? null : readRevision(value, path);
}

export function parsePointLightCommandResult(value: unknown): PointLightCommandResult {
  const record = readObject(value, '$result');
  checkKeys(record, [
    'schemaVersion',
    'code',
    'accepted',
    'commandId',
    'worldId',
    'entityId',
    'currentRevision',
    'resultingRevision',
    'eventSequence',
    'runtimeInstanceId',
  ], ['duplicateOfCode', 'fact'], '$result');
  const code = readResultCode(record.code, '$result.code');
  if (typeof record.accepted !== 'boolean' || record.accepted !== (code === 'ACCEPTED')) {
    fail('Accepted must match the result code', '$result.accepted');
  }
  const commandId = readNullableId(
    record.commandId,
    () => parseCommandId(record.commandId),
    '$result.commandId',
  );
  const worldId = readNullableId(
    record.worldId,
    () => parseWorldId(record.worldId),
    '$result.worldId',
  );
  const entityId = readNullableId(
    record.entityId,
    () => parseEntityId(record.entityId),
    '$result.entityId',
  );
  const currentRevision = readNullableRevision(
    record.currentRevision,
    '$result.currentRevision',
  );
  const resultingRevision = readNullableRevision(
    record.resultingRevision,
    '$result.resultingRevision',
  );
  const eventSequence = readNullableRevision(record.eventSequence, '$result.eventSequence');
  const runtimeInstanceId = record.runtimeInstanceId === null
    ? null
    : readBoundedString(record.runtimeInstanceId, '$result.runtimeInstanceId');
  const duplicateOfCode = Object.hasOwn(record, 'duplicateOfCode')
    ? readResultCode(record.duplicateOfCode, '$result.duplicateOfCode')
    : undefined;
  const fact = Object.hasOwn(record, 'fact')
    ? parsePointLightPowerSetFact(record.fact)
    : undefined;
  if (
    code === 'ACCEPTED'
    && (
      commandId === null
      || worldId === null
      || entityId === null
      || currentRevision === null
      || resultingRevision === null
      || eventSequence === null
      || runtimeInstanceId === null
      || fact === undefined
      || fact.sourceCommandId !== commandId
      || fact.worldId !== worldId
      || fact.entityId !== entityId
      || fact.resultingRevision !== resultingRevision
      || fact.eventSequence !== eventSequence
    )
  ) fail('Accepted result does not match its fact', '$result');
  if (code !== 'ACCEPTED' && fact !== undefined) {
    fail('Only an accepted result can include a fact', '$result.fact');
  }
  if (code !== 'DUPLICATE_COMMAND' && duplicateOfCode !== undefined) {
    fail('Only a duplicate result can include duplicateOfCode', '$result.duplicateOfCode');
  }
  return Object.freeze({
    schemaVersion: readLiteral(
      record.schemaVersion,
      POINT_LIGHT_RESULT_SCHEMA_VERSION,
      '$result.schemaVersion',
    ),
    code,
    accepted: record.accepted,
    commandId,
    worldId,
    entityId,
    currentRevision,
    resultingRevision,
    eventSequence,
    runtimeInstanceId,
    ...(duplicateOfCode === undefined ? {} : { duplicateOfCode }),
    ...(fact === undefined ? {} : { fact }),
  });
}

export function parsePointLightPowerSetFact(value: unknown): PointLightPowerSetFact {
  const record = readObject(value, '$fact');
  checkKeys(record, [
    'schemaVersion',
    'type',
    'eventSequence',
    'sourceCommandId',
    'worldId',
    'entityId',
    'oldPower',
    'newPower',
    'resultingRevision',
    'receivedAt',
  ], ['correctionOf'], '$fact');
  const correctionOf = Object.hasOwn(record, 'correctionOf')
    ? readId(() => parseCommandId(record.correctionOf), '$fact.correctionOf')
    : undefined;
  const eventSequence = readRevision(record.eventSequence, '$fact.eventSequence');
  if (eventSequence === 0) fail('Expected a positive event sequence', '$fact.eventSequence');
  const resultingRevision = readRevision(record.resultingRevision, '$fact.resultingRevision');
  if (resultingRevision === 0) fail('Expected a positive resulting revision', '$fact.resultingRevision');
  return Object.freeze({
    schemaVersion: readLiteral(
      record.schemaVersion,
      POINT_LIGHT_FACT_SCHEMA_VERSION,
      '$fact.schemaVersion',
    ),
    type: readLiteral(record.type, POINT_LIGHT_POWER_SET_FACT_TYPE, '$fact.type'),
    eventSequence,
    sourceCommandId: readId(
      () => parseCommandId(record.sourceCommandId),
      '$fact.sourceCommandId',
    ),
    worldId: readId(() => parseWorldId(record.worldId), '$fact.worldId'),
    entityId: readId(() => parseEntityId(record.entityId), '$fact.entityId'),
    oldPower: readPower(record.oldPower, '$fact.oldPower'),
    newPower: readPower(record.newPower, '$fact.newPower'),
    resultingRevision,
    receivedAt: readReceivedAt(record.receivedAt, '$fact.receivedAt'),
    ...(correctionOf === undefined ? {} : { correctionOf }),
  });
}
