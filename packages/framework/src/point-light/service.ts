import {
  IdValidationError,
  parseEntityId,
  parseWorldId,
  type EntityId,
  type WorldId,
} from '../identity/ids.ts';
import {
  PointLightValidationError,
  createPointLight,
  createTransform,
  type PointLight,
  type Transform,
} from './records.ts';

export const MAX_POINT_LIGHTS = 256;
export const MAX_POINT_LIGHT_LABEL_LENGTH = 128;

export type PointLightAuthoringRecordInput = Readonly<{
  entityId: unknown;
  label: unknown;
  revision: unknown;
  transform: unknown;
  pointLight: unknown;
}>;

export type PointLightAuthoringRecord = Readonly<{
  worldId: WorldId;
  entityId: EntityId;
  label: string;
  revision: number;
  transform: Transform;
  pointLight: PointLight;
}>;

export interface PointLightAuthoringService {
  readonly worldId: WorldId;
  listPointLights(): readonly PointLightAuthoringRecord[];
  getPointLight(entityId: unknown): PointLightAuthoringRecord | undefined;
}

export type PointLightServiceErrorCode =
  | 'INVALID_POINT_LIGHT_SERVICE'
  | 'DUPLICATE_ENTITY_ID';

export class PointLightServiceValidationError extends Error {
  constructor(
    readonly code: PointLightServiceErrorCode,
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = 'PointLightServiceValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(
  message: string,
  path: string,
  code: PointLightServiceErrorCode = 'INVALID_POINT_LIGHT_SERVICE',
): never {
  throw new PointLightServiceValidationError(code, message, path);
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
  path: string,
): void {
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('Unknown field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('Missing field', `${path}.${key}`);
  }
}

function readId<T>(operation: () => T, path: string): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof IdValidationError) fail(error.message, path);
    throw error;
  }
}

function readLabel(value: unknown, path: string): string {
  if (typeof value !== 'string') fail('Expected a label string', path);
  const label = value.trim();
  if (label.length === 0 || label.length > MAX_POINT_LIGHT_LABEL_LENGTH) {
    fail(`Expected 1 through ${MAX_POINT_LIGHT_LABEL_LENGTH} label characters`, path);
  }
  return label;
}

function readRevision(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe-integer revision', path);
  }
  return value as number;
}

function readComponent<T>(operation: () => T, path: string): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PointLightValidationError) {
      const suffix = error.path === '$' ? '' : error.path.slice(1);
      fail(error.message.replace(` at ${error.path}`, ''), `${path}${suffix}`);
    }
    throw error;
  }
}

function readPointLightRecord(
  worldId: WorldId,
  value: unknown,
  path: string,
): PointLightAuthoringRecord {
  const record = readObject(value, path);
  checkKeys(record, ['entityId', 'label', 'revision', 'transform', 'pointLight'], path);
  return Object.freeze({
    worldId,
    entityId: readId(() => parseEntityId(record.entityId), `${path}.entityId`),
    label: readLabel(record.label, `${path}.label`),
    revision: readRevision(record.revision, `${path}.revision`),
    transform: readComponent(() => createTransform(record.transform), `${path}.transform`),
    pointLight: readComponent(() => createPointLight(record.pointLight), `${path}.pointLight`),
  });
}

export function createPointLightAuthoringService(input: unknown): PointLightAuthoringService {
  const record = readObject(input, '$');
  checkKeys(record, ['worldId', 'pointLights'], '$');
  const worldId = readId(() => parseWorldId(record.worldId), '$.worldId');
  if (!Array.isArray(record.pointLights)) fail('Expected a point-light array', '$.pointLights');
  if (record.pointLights.length > MAX_POINT_LIGHTS) {
    fail(`Expected at most ${MAX_POINT_LIGHTS} point lights`, '$.pointLights');
  }

  const records = new Map<EntityId, PointLightAuthoringRecord>();
  record.pointLights.forEach((value, index) => {
    const pointLight = readPointLightRecord(worldId, value, `$.pointLights[${index}]`);
    if (records.has(pointLight.entityId)) {
      fail(
        'Point-light entity IDs must be unique',
        `$.pointLights[${index}].entityId`,
        'DUPLICATE_ENTITY_ID',
      );
    }
    records.set(pointLight.entityId, pointLight);
  });

  const list = Object.freeze([...records.values()].sort((left, right) => (
    left.entityId.localeCompare(right.entityId)
  )));
  return Object.freeze({
    worldId,
    listPointLights: () => list,
    getPointLight: (entityId: unknown) => records.get(parseEntityId(entityId)),
  });
}
