import {
  IdValidationError,
  parseEntityId,
  parseWorldId,
  type EntityId,
  type WorldId,
} from '../identity/ids.ts';
import {
  MAX_POINT_LIGHT_POWER_FACTS,
  PointLightCommandValidationError,
  parsePointLightPowerSetFact,
  type PointLightPowerSetFact,
} from './commands.ts';
import type {
  PointLightStateSnapshot,
  RenderPointLight,
  RuntimePointLight,
} from './projections.ts';
import {
  MAX_POINT_LIGHT_POWER,
  MIN_POINT_LIGHT_POWER,
  PointLightValidationError,
  createPointLight,
  createTransform,
} from './records.ts';
import {
  MAX_POINT_LIGHT_LABEL_LENGTH,
  MAX_POINT_LIGHTS,
  type PointLightAuthoringRecord,
  type PointLightAuthoringService,
} from './service.ts';

export const POINT_LIGHT_INSPECTION_SCHEMA_VERSION = 1 as const;

export type PointLightInspectionInput = Readonly<{
  schemaVersion: typeof POINT_LIGHT_INSPECTION_SCHEMA_VERSION;
  owner: 'framework';
  worldId: WorldId;
  eventSequence: number;
  authoring: readonly PointLightAuthoringRecord[];
  runtime: PointLightStateSnapshot['runtime'];
  render: PointLightStateSnapshot['render'];
  facts: readonly PointLightPowerSetFact[];
}>;

export type PointLightInspection = Readonly<{
  schemaVersion: typeof POINT_LIGHT_INSPECTION_SCHEMA_VERSION;
  owner: 'framework';
  worldId: WorldId;
  eventSequence: number;
  authoring: readonly PointLightAuthoringRecord[];
  runtime: Readonly<{
    instanceId: string;
    eventSequence: number;
    pointLights: readonly RuntimePointLight[];
  }>;
  render: Readonly<{
    eventSequence: number;
    pointLights: readonly RenderPointLight[];
    dirtySlots: readonly number[];
  }>;
  facts: readonly PointLightPowerSetFact[];
}>;

export class PointLightInspectionValidationError extends Error {
  readonly code = 'ANTIKY_POINT_LIGHT_INSPECTION_INVALID';

  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = 'PointLightInspectionValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string, path: string): never {
  throw new PointLightInspectionValidationError(message, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(value: UnknownRecord, required: readonly string[], path: string): void {
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('Unknown field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('Missing field', `${path}.${key}`);
  }
}

function readCount(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe integer', path);
  }
  return value as number;
}

function readPower(value: unknown, path: string): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < MIN_POINT_LIGHT_POWER
    || value > MAX_POINT_LIGHT_POWER
  ) {
    fail(
      `Expected a finite power from ${MIN_POINT_LIGHT_POWER} through ${MAX_POINT_LIGHT_POWER}`,
      path,
    );
  }
  return value;
}

function readId<T>(operation: () => T, path: string): T {
  try {
    return operation();
  } catch (cause: unknown) {
    if (cause instanceof IdValidationError) fail('Expected a canonical UUIDv7', path);
    throw cause;
  }
}

function readRuntimeId(value: unknown, path: string): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 128
    || !/^[A-Za-z0-9._:@+-]+$/.test(value)
  ) fail('Expected a bounded runtime instance ID', path);
  return value;
}

function readAuthoringRecord(
  value: unknown,
  expectedWorldId: WorldId,
  path: string,
): PointLightAuthoringRecord {
  const record = readObject(value, path);
  checkKeys(
    record,
    ['worldId', 'entityId', 'label', 'revision', 'transform', 'pointLight'],
    path,
  );
  const worldId = readId(() => parseWorldId(record.worldId), `${path}.worldId`);
  if (worldId !== expectedWorldId) fail('Point light belongs to another world', `${path}.worldId`);
  if (typeof record.label !== 'string') fail('Expected a label string', `${path}.label`);
  const label = record.label.trim();
  if (label.length === 0 || label.length > MAX_POINT_LIGHT_LABEL_LENGTH) {
    fail(
      `Expected 1 through ${MAX_POINT_LIGHT_LABEL_LENGTH} label characters`,
      `${path}.label`,
    );
  }
  let transform;
  let pointLight;
  try {
    transform = createTransform(record.transform);
  } catch (cause: unknown) {
    if (cause instanceof PointLightValidationError) {
      const suffix = cause.path === '$' ? '' : cause.path.slice(1);
      fail('Invalid transform', `${path}.transform${suffix}`);
    }
    throw cause;
  }
  try {
    pointLight = createPointLight(record.pointLight);
  } catch (cause: unknown) {
    if (cause instanceof PointLightValidationError) {
      const suffix = cause.path === '$' ? '' : cause.path.slice(1);
      fail('Invalid point light', `${path}.pointLight${suffix}`);
    }
    throw cause;
  }
  return Object.freeze({
    worldId,
    entityId: readId(() => parseEntityId(record.entityId), `${path}.entityId`),
    label,
    revision: readCount(record.revision, `${path}.revision`),
    transform,
    pointLight,
  });
}

function readRuntimePointLight(value: unknown, path: string): RuntimePointLight {
  const record = readObject(value, path);
  checkKeys(record, ['entityId', 'revision', 'power'], path);
  return Object.freeze({
    entityId: readId(() => parseEntityId(record.entityId), `${path}.entityId`),
    revision: readCount(record.revision, `${path}.revision`),
    power: readPower(record.power, `${path}.power`),
  });
}

function readRenderPointLight(value: unknown, path: string): RenderPointLight {
  const record = readObject(value, path);
  checkKeys(record, ['entityId', 'renderSlot', 'revision', 'power'], path);
  return Object.freeze({
    entityId: readId(() => parseEntityId(record.entityId), `${path}.entityId`),
    renderSlot: readCount(record.renderSlot, `${path}.renderSlot`),
    revision: readCount(record.revision, `${path}.revision`),
    power: readPower(record.power, `${path}.power`),
  });
}

function requireArray(value: unknown, maximum: number, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail('Expected an array', path);
  if (value.length > maximum) fail(`Expected at most ${maximum} entries`, path);
  return value;
}

function requireProjectionMatch(
  value: RuntimePointLight | RenderPointLight,
  authoring: ReadonlyMap<EntityId, PointLightAuthoringRecord>,
  path: string,
): void {
  const record = authoring.get(value.entityId);
  if (!record) fail('Projection references an unknown point light', `${path}.entityId`);
  if (value.revision !== record.revision) {
    fail('Projection revision does not match authoring', `${path}.revision`);
  }
  if (!Object.is(value.power, record.pointLight.power)) {
    fail('Projection power does not match authoring', `${path}.power`);
  }
}

export function createPointLightInspection(
  input: unknown,
  path = '$',
): PointLightInspection {
  const record = readObject(input, path);
  checkKeys(record, [
    'schemaVersion',
    'owner',
    'worldId',
    'eventSequence',
    'authoring',
    'runtime',
    'render',
    'facts',
  ], path);
  if (record.schemaVersion !== POINT_LIGHT_INSPECTION_SCHEMA_VERSION) {
    fail(
      `Expected schema version ${POINT_LIGHT_INSPECTION_SCHEMA_VERSION}`,
      `${path}.schemaVersion`,
    );
  }
  if (record.owner !== 'framework') fail('Expected framework ownership', `${path}.owner`);
  const worldId = readId(() => parseWorldId(record.worldId), `${path}.worldId`);
  const eventSequence = readCount(record.eventSequence, `${path}.eventSequence`);

  const authoringValues = requireArray(record.authoring, MAX_POINT_LIGHTS, `${path}.authoring`);
  const authoring = Object.freeze(authoringValues.map((value, index) => (
    readAuthoringRecord(value, worldId, `${path}.authoring[${index}]`)
  )));
  const authoringById = new Map<EntityId, PointLightAuthoringRecord>();
  authoring.forEach((pointLight, index) => {
    if (authoringById.has(pointLight.entityId)) {
      fail('Point-light identity is duplicated', `${path}.authoring[${index}].entityId`);
    }
    authoringById.set(pointLight.entityId, pointLight);
  });

  const runtimeRecord = readObject(record.runtime, `${path}.runtime`);
  checkKeys(runtimeRecord, ['instanceId', 'eventSequence', 'pointLights'], `${path}.runtime`);
  const runtimeEventSequence = readCount(
    runtimeRecord.eventSequence,
    `${path}.runtime.eventSequence`,
  );
  if (runtimeEventSequence !== eventSequence) {
    fail('Runtime event sequence does not match inspection', `${path}.runtime.eventSequence`);
  }
  const runtimeValues = requireArray(
    runtimeRecord.pointLights,
    MAX_POINT_LIGHTS,
    `${path}.runtime.pointLights`,
  );
  if (runtimeValues.length !== authoring.length) {
    fail('Runtime projection must include every point light', `${path}.runtime.pointLights`);
  }
  const runtimeIds = new Set<EntityId>();
  const runtimePointLights = Object.freeze(runtimeValues.map((value, index) => {
    const itemPath = `${path}.runtime.pointLights[${index}]`;
    const pointLight = readRuntimePointLight(value, itemPath);
    if (runtimeIds.has(pointLight.entityId)) {
      fail('Runtime point-light identity is duplicated', `${itemPath}.entityId`);
    }
    runtimeIds.add(pointLight.entityId);
    requireProjectionMatch(pointLight, authoringById, itemPath);
    return pointLight;
  }));
  const runtime = Object.freeze({
    instanceId: readRuntimeId(runtimeRecord.instanceId, `${path}.runtime.instanceId`),
    eventSequence: runtimeEventSequence,
    pointLights: runtimePointLights,
  });

  const renderRecord = readObject(record.render, `${path}.render`);
  checkKeys(renderRecord, ['eventSequence', 'pointLights', 'dirtySlots'], `${path}.render`);
  const renderEventSequence = readCount(
    renderRecord.eventSequence,
    `${path}.render.eventSequence`,
  );
  if (renderEventSequence !== eventSequence) {
    fail('Render event sequence does not match inspection', `${path}.render.eventSequence`);
  }
  const renderValues = requireArray(
    renderRecord.pointLights,
    MAX_POINT_LIGHTS,
    `${path}.render.pointLights`,
  );
  const renderIds = new Set<EntityId>();
  const renderSlots = new Set<number>();
  const renderPointLights = Object.freeze(renderValues.map((value, index) => {
    const itemPath = `${path}.render.pointLights[${index}]`;
    const pointLight = readRenderPointLight(value, itemPath);
    if (renderIds.has(pointLight.entityId)) {
      fail('Render point-light identity is duplicated', `${itemPath}.entityId`);
    }
    if (renderSlots.has(pointLight.renderSlot)) {
      fail('Render slot is duplicated', `${itemPath}.renderSlot`);
    }
    renderIds.add(pointLight.entityId);
    renderSlots.add(pointLight.renderSlot);
    requireProjectionMatch(pointLight, authoringById, itemPath);
    return pointLight;
  }));
  const dirtyValues = requireArray(
    renderRecord.dirtySlots,
    renderPointLights.length,
    `${path}.render.dirtySlots`,
  );
  const dirtySet = new Set<number>();
  const dirtySlots = Object.freeze(dirtyValues.map((value, index) => {
    const slotPath = `${path}.render.dirtySlots[${index}]`;
    const slot = readCount(value, slotPath);
    if (!renderSlots.has(slot)) fail('Dirty slot is not bound', slotPath);
    if (dirtySet.has(slot)) fail('Dirty slot is duplicated', slotPath);
    dirtySet.add(slot);
    return slot;
  }));
  const render = Object.freeze({
    eventSequence: renderEventSequence,
    pointLights: renderPointLights,
    dirtySlots,
  });

  const factValues = requireArray(
    record.facts,
    MAX_POINT_LIGHT_POWER_FACTS,
    `${path}.facts`,
  );
  const knownCommands = new Set<string>();
  const lastFactByEntity = new Map<EntityId, PointLightPowerSetFact>();
  const facts = Object.freeze(factValues.map((value, index) => {
    const factPath = `${path}.facts[${index}]`;
    let fact: PointLightPowerSetFact;
    try {
      fact = parsePointLightPowerSetFact(value);
    } catch (cause: unknown) {
      if (cause instanceof PointLightCommandValidationError) {
        const suffix = cause.path === '$fact' ? '' : cause.path.slice('$fact'.length);
        fail('Invalid accepted point-light fact', `${factPath}${suffix}`);
      }
      throw cause;
    }
    if (fact.eventSequence !== index + 1) {
      fail('Accepted facts must be contiguous', `${factPath}.eventSequence`);
    }
    if (fact.worldId !== worldId) fail('Fact belongs to another world', `${factPath}.worldId`);
    if (!authoringById.has(fact.entityId)) {
      fail('Fact references an unknown point light', `${factPath}.entityId`);
    }
    if (knownCommands.has(fact.sourceCommandId)) {
      fail('Fact source command is duplicated', `${factPath}.sourceCommandId`);
    }
    if (fact.correctionOf !== undefined && !knownCommands.has(fact.correctionOf)) {
      fail('Correction references an unknown earlier command', `${factPath}.correctionOf`);
    }
    knownCommands.add(fact.sourceCommandId);
    lastFactByEntity.set(fact.entityId, fact);
    return fact;
  }));
  if (facts.length !== eventSequence) {
    fail('Fact history does not match the event sequence', `${path}.facts`);
  }
  for (const [entityId, fact] of lastFactByEntity) {
    const current = authoringById.get(entityId)!;
    if (fact.resultingRevision !== current.revision) {
      fail('Latest fact revision does not match authoring', `${path}.facts`);
    }
    if (!Object.is(fact.newPower, current.pointLight.power)) {
      fail('Latest fact power does not match authoring', `${path}.facts`);
    }
  }

  return Object.freeze({
    schemaVersion: POINT_LIGHT_INSPECTION_SCHEMA_VERSION,
    owner: 'framework',
    worldId,
    eventSequence,
    authoring,
    runtime,
    render,
    facts,
  });
}

export function inspectPointLightService(
  service: PointLightAuthoringService,
): PointLightInspection {
  const state = service.readPointLightState();
  return createPointLightInspection({
    schemaVersion: POINT_LIGHT_INSPECTION_SCHEMA_VERSION,
    owner: 'framework',
    worldId: service.worldId,
    eventSequence: state.eventSequence,
    authoring: state.authoring,
    runtime: state.runtime,
    render: state.render,
    facts: service.listPointLightPowerFacts(),
  });
}

