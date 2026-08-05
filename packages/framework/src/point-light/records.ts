export const TRANSFORM_SCHEMA_VERSION = 1 as const;
export const POINT_LIGHT_SCHEMA_VERSION = 1 as const;
export const MIN_POINT_LIGHT_POWER = 0;
export const MAX_POINT_LIGHT_POWER = 4;
export const MAX_WORLD_COORDINATE = 1_000_000;
export const MAX_POINT_LIGHT_RADIUS = 1_000_000;
export const MAX_LINEAR_LIGHT_VALUE = 65_504;

export type Vector3 = readonly [number, number, number];
export type LinearRgb = readonly [number, number, number];

export type TransformInput = Readonly<{
  schemaVersion: typeof TRANSFORM_SCHEMA_VERSION;
  position?: readonly number[];
}>;

export type PointLightInput = Readonly<{
  schemaVersion: typeof POINT_LIGHT_SCHEMA_VERSION;
  color?: readonly number[];
  radius?: number;
  power?: number;
}>;

export type Transform = Readonly<{
  schemaVersion: typeof TRANSFORM_SCHEMA_VERSION;
  position: Vector3;
}>;

export type PointLight = Readonly<{
  schemaVersion: typeof POINT_LIGHT_SCHEMA_VERSION;
  color: LinearRgb;
  radius: number;
  power: number;
}>;

export class PointLightValidationError extends Error {
  readonly code = 'ANTIKY_POINT_LIGHT_INVALID';

  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = 'PointLightValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string, path: string): never {
  throw new PointLightValidationError(message, path);
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

function readSchemaVersion(value: unknown, expected: number, path: string): void {
  if (value !== expected) fail(`Expected schema version ${expected}`, path);
}

function readFiniteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    fail(`Expected a finite number from ${minimum} through ${maximum}`, path);
  }
  return value;
}

function readVector(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): Vector3 {
  if (!Array.isArray(value) || value.length !== 3) {
    fail('Expected exactly three numeric values', path);
  }
  return Object.freeze([
    readFiniteNumber(value[0], minimum, maximum, `${path}[0]`),
    readFiniteNumber(value[1], minimum, maximum, `${path}[1]`),
    readFiniteNumber(value[2], minimum, maximum, `${path}[2]`),
  ]);
}

export function createTransform(input: unknown): Transform {
  const record = readObject(input, '$');
  checkKeys(record, ['schemaVersion'], ['position'], '$');
  readSchemaVersion(record.schemaVersion, TRANSFORM_SCHEMA_VERSION, '$.schemaVersion');
  const position = Object.hasOwn(record, 'position')
    ? readVector(
      record.position,
      -MAX_WORLD_COORDINATE,
      MAX_WORLD_COORDINATE,
      '$.position',
    )
    : Object.freeze([0, 0, 0] as const);
  return Object.freeze({ schemaVersion: TRANSFORM_SCHEMA_VERSION, position });
}

export function createPointLight(input: unknown): PointLight {
  const record = readObject(input, '$');
  checkKeys(record, ['schemaVersion'], ['color', 'radius', 'power'], '$');
  readSchemaVersion(record.schemaVersion, POINT_LIGHT_SCHEMA_VERSION, '$.schemaVersion');
  const color = Object.hasOwn(record, 'color')
    ? readVector(record.color, 0, MAX_LINEAR_LIGHT_VALUE, '$.color')
    : Object.freeze([1, 1, 1] as const);
  const radius = Object.hasOwn(record, 'radius')
    ? readFiniteNumber(record.radius, Number.MIN_VALUE, MAX_POINT_LIGHT_RADIUS, '$.radius')
    : 1;
  const power = Object.hasOwn(record, 'power')
    ? readFiniteNumber(record.power, MIN_POINT_LIGHT_POWER, MAX_POINT_LIGHT_POWER, '$.power')
    : 1;
  return Object.freeze({
    schemaVersion: POINT_LIGHT_SCHEMA_VERSION,
    color,
    radius,
    power,
  });
}
