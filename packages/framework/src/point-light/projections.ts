import {
  IdValidationError,
  parseEntityId,
  type EntityId,
} from '../identity/ids.ts';
import type { PointLightAuthoringRecord } from './service.ts';

export const MAX_POINT_LIGHT_RENDER_SLOT = 1_000_000;

export type PointLightRenderBinding = Readonly<{
  entityId: EntityId;
  renderSlot: number;
}>;

export type RuntimePointLight = Readonly<{
  entityId: EntityId;
  revision: number;
  power: number;
}>;

export type RenderPointLight = Readonly<{
  entityId: EntityId;
  renderSlot: number;
  revision: number;
  power: number;
}>;

export type PointLightStateSnapshot = Readonly<{
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
}>;

export type PointLightRenderChanges = Readonly<{
  eventSequence: number;
  pointLights: readonly RenderPointLight[];
}>;

export class PointLightProjectionValidationError extends Error {
  readonly code = 'ANTIKY_POINT_LIGHT_PROJECTION_INVALID';

  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = 'PointLightProjectionValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string, path: string): never {
  throw new PointLightProjectionValidationError(message, path);
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

export function parsePointLightRuntimeInstanceId(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 128
    || !/^[A-Za-z0-9._:@+-]+$/.test(value)
  ) {
    fail('Expected a bounded runtime instance ID', '$.runtimeInstanceId');
  }
  return value;
}

export function parsePointLightRenderBindings(
  value: unknown,
  pointLights: readonly PointLightAuthoringRecord[],
): readonly PointLightRenderBinding[] {
  if (!Array.isArray(value)) fail('Expected a render-binding array', '$.renderBindings');
  if (value.length > pointLights.length) {
    fail('A point light can have at most one render binding', '$.renderBindings');
  }
  const knownIds = new Set(pointLights.map((pointLight) => pointLight.entityId));
  const entityIds = new Set<EntityId>();
  const slots = new Set<number>();
  const bindings = value.map((entry, index) => {
    const path = `$.renderBindings[${index}]`;
    const record = readObject(entry, path);
    checkKeys(record, ['entityId', 'renderSlot'], path);
    let entityId: EntityId;
    try {
      entityId = parseEntityId(record.entityId);
    } catch (error) {
      if (error instanceof IdValidationError) fail(error.message, `${path}.entityId`);
      throw error;
    }
    if (!knownIds.has(entityId)) fail('Render binding references an unknown point light', `${path}.entityId`);
    if (entityIds.has(entityId)) fail('Point-light render binding is duplicated', `${path}.entityId`);
    if (
      !Number.isSafeInteger(record.renderSlot)
      || (record.renderSlot as number) < 0
      || (record.renderSlot as number) > MAX_POINT_LIGHT_RENDER_SLOT
    ) {
      fail(
        `Expected a render slot from 0 through ${MAX_POINT_LIGHT_RENDER_SLOT}`,
        `${path}.renderSlot`,
      );
    }
    const renderSlot = record.renderSlot as number;
    if (slots.has(renderSlot)) fail('Render slot is already bound', `${path}.renderSlot`);
    entityIds.add(entityId);
    slots.add(renderSlot);
    return Object.freeze({ entityId, renderSlot });
  });
  return Object.freeze(bindings.sort((left, right) => left.renderSlot - right.renderSlot));
}

export function createPointLightStateSnapshot(
  authoringInput: readonly PointLightAuthoringRecord[],
  runtimeInstanceId: string,
  bindings: readonly PointLightRenderBinding[],
  eventSequence: number,
  dirtySlotsInput: ReadonlySet<number> | readonly number[],
): PointLightStateSnapshot {
  if (!Number.isSafeInteger(eventSequence) || eventSequence < 0) {
    fail('Expected a non-negative event sequence', '$.eventSequence');
  }
  const authoring = Object.freeze([...authoringInput].sort((left, right) => (
    left.entityId.localeCompare(right.entityId)
  )));
  const authoringById = new Map(authoring.map((pointLight) => [pointLight.entityId, pointLight]));
  const runtime = Object.freeze(authoring.map((pointLight) => Object.freeze({
    entityId: pointLight.entityId,
    revision: pointLight.revision,
    power: pointLight.pointLight.power,
  })));
  const render = Object.freeze(bindings.map((binding) => {
    const pointLight = authoringById.get(binding.entityId);
    if (!pointLight) fail('Render binding lost its point light', '$.renderBindings');
    return Object.freeze({
      entityId: pointLight.entityId,
      renderSlot: binding.renderSlot,
      revision: pointLight.revision,
      power: pointLight.pointLight.power,
    });
  }));
  const boundSlots = new Set(bindings.map((binding) => binding.renderSlot));
  const dirtySlots = Object.freeze([...dirtySlotsInput]
    .filter((slot) => boundSlots.has(slot))
    .sort((left, right) => left - right));
  return Object.freeze({
    eventSequence,
    authoring,
    runtime: Object.freeze({
      instanceId: runtimeInstanceId,
      eventSequence,
      pointLights: runtime,
    }),
    render: Object.freeze({
      eventSequence,
      pointLights: render,
      dirtySlots,
    }),
  });
}

export function readRenderChanges(snapshot: PointLightStateSnapshot): PointLightRenderChanges {
  const dirty = new Set(snapshot.render.dirtySlots);
  return Object.freeze({
    eventSequence: snapshot.eventSequence,
    pointLights: Object.freeze(snapshot.render.pointLights.filter((pointLight) => (
      dirty.has(pointLight.renderSlot)
    ))),
  });
}
