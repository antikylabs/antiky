import {
  IdValidationError,
  parseEntityId,
  parseWorldId,
  type EntityId,
  type WorldId,
} from '../identity/ids.ts';
import {
  InspectionJsonValueError,
  cloneInspectionJson,
  type InspectionJsonValue,
} from './json-value.ts';

export const WORLD_INSPECTION_SCHEMA_VERSION = 1 as const;
export const MAX_WORLD_INSPECTION_ENTITIES = 512;
export const MAX_WORLD_INSPECTION_COMPONENTS = 2_048;
export const MAX_WORLD_INSPECTION_RELATIONSHIPS = 1_024;
export const MAX_WORLD_INSPECTION_STORES = 64;
export const MAX_WORLD_INSPECTION_STORE_ENTRIES = 2_048;

export type InspectionCountInput = { available: number; retained: number };
export type WorldInspectionComponentInput = {
  typeId: string;
  schemaVersion: number;
  summary: string;
  data: unknown;
};
export type WorldInspectionEntityInput = {
  entityId: unknown;
  label: string;
  revision: number;
  components: WorldInspectionComponentInput[];
};
export type ChildOfInspectionInput = {
  type: 'ChildOf';
  childEntityId: unknown;
  parentEntityId: unknown;
};
export type WorldInspectionStoreEntryInput = {
  key: string;
  entityId?: unknown;
  data: unknown;
};
export type WorldInspectionStoreInput = {
  storeId: string;
  label: string;
  kind: 'authoring' | 'runtime' | 'render';
  incomplete: boolean;
  counts: InspectionCountInput;
  entries: WorldInspectionStoreEntryInput[];
};
export type WorldInspectionInput = {
  schemaVersion: typeof WORLD_INSPECTION_SCHEMA_VERSION;
  owner: 'framework';
  worldId: unknown;
  runtimeInstanceId: string;
  revision: number;
  incomplete: boolean;
  counts: {
    entities: InspectionCountInput;
    components: InspectionCountInput;
    relationships: InspectionCountInput;
    stores: InspectionCountInput;
  };
  entities: WorldInspectionEntityInput[];
  relationships: ChildOfInspectionInput[];
  stores: WorldInspectionStoreInput[];
};

export type InspectionCount = Readonly<{ available: number; retained: number }>;
export type WorldInspectionComponent = Readonly<{
  typeId: string;
  schemaVersion: number;
  summary: string;
  data: InspectionJsonValue;
}>;
export type WorldInspectionEntity = Readonly<{
  entityId: EntityId;
  label: string;
  revision: number;
  components: readonly WorldInspectionComponent[];
}>;
export type ChildOfInspection = Readonly<{
  type: 'ChildOf';
  childEntityId: EntityId;
  parentEntityId: EntityId;
}>;
export type WorldInspectionStoreEntry = Readonly<{
  key: string;
  entityId?: EntityId;
  data: InspectionJsonValue;
}>;
export type WorldInspectionStore = Readonly<{
  storeId: string;
  label: string;
  kind: 'authoring' | 'runtime' | 'render';
  incomplete: boolean;
  counts: InspectionCount;
  entries: readonly WorldInspectionStoreEntry[];
}>;
export type WorldInspection = Readonly<{
  schemaVersion: typeof WORLD_INSPECTION_SCHEMA_VERSION;
  owner: 'framework';
  worldId: WorldId;
  runtimeInstanceId: string;
  revision: number;
  incomplete: boolean;
  counts: Readonly<{
    entities: InspectionCount;
    components: InspectionCount;
    relationships: InspectionCount;
    stores: InspectionCount;
  }>;
  entities: readonly WorldInspectionEntity[];
  relationships: readonly ChildOfInspection[];
  stores: readonly WorldInspectionStore[];
}>;

export class WorldInspectionValidationError extends Error {
  readonly code = 'ANTIKY_WORLD_INSPECTION_INVALID';

  constructor(message: string, readonly path: string) {
    super(`${message} at ${path}`);
    this.name = 'WorldInspectionValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string, path: string): never {
  throw new WorldInspectionValidationError(message, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(
  record: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail('Unknown field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) fail('Missing field', `${path}.${key}`);
  }
}

function readCountValue(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe integer', path);
  }
  return value as number;
}

function readCount(value: unknown, retained: number, path: string): InspectionCount {
  const record = readObject(value, path);
  checkKeys(record, ['available', 'retained'], [], path);
  const available = readCountValue(record.available, `${path}.available`);
  const claimedRetained = readCountValue(record.retained, `${path}.retained`);
  if (claimedRetained !== retained) fail('Retained count does not match the view', `${path}.retained`);
  if (available < claimedRetained) fail('Available count cannot be smaller than retained', `${path}.available`);
  return Object.freeze({ available, retained: claimedRetained });
}

function readString(
  value: unknown,
  path: string,
  maximum: number,
  pattern?: RegExp,
): string {
  if (typeof value !== 'string') fail('Expected a string', path);
  const result = value.trim();
  if (result.length === 0 || result.length > maximum) {
    fail(`Expected 1 through ${maximum} characters`, path);
  }
  if (pattern && !pattern.test(result)) fail('String has an invalid format', path);
  return result;
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
  return readString(value, path, 128, /^[A-Za-z0-9._:@+-]+$/);
}

function readJson(value: unknown, path: string): InspectionJsonValue {
  try {
    return cloneInspectionJson(value, path);
  } catch (cause: unknown) {
    if (cause instanceof InspectionJsonValueError) fail(cause.reason, cause.path);
    throw cause;
  }
}

function readComponent(value: unknown, path: string): WorldInspectionComponent {
  const record = readObject(value, path);
  checkKeys(record, ['typeId', 'schemaVersion', 'summary', 'data'], [], path);
  return Object.freeze({
    typeId: readString(record.typeId, `${path}.typeId`, 128, /^[A-Za-z][A-Za-z0-9._:-]*$/),
    schemaVersion: (() => {
      const version = readCountValue(record.schemaVersion, `${path}.schemaVersion`);
      if (version === 0) fail('Expected a positive schema version', `${path}.schemaVersion`);
      return version;
    })(),
    summary: readString(record.summary, `${path}.summary`, 256),
    data: readJson(record.data, `${path}.data`),
  });
}

function readEntity(value: unknown, path: string): WorldInspectionEntity {
  const record = readObject(value, path);
  checkKeys(record, ['entityId', 'label', 'revision', 'components'], [], path);
  if (!Array.isArray(record.components)) fail('Expected an array', `${path}.components`);
  const typeIds = new Set<string>();
  const components = record.components.map((component, index) => {
    const componentPath = `${path}.components[${index}]`;
    const result = readComponent(component, componentPath);
    if (typeIds.has(result.typeId)) fail('Component type is duplicated', `${componentPath}.typeId`);
    typeIds.add(result.typeId);
    return result;
  });
  return Object.freeze({
    entityId: readId(() => parseEntityId(record.entityId), `${path}.entityId`),
    label: readString(record.label, `${path}.label`, 128),
    revision: readCountValue(record.revision, `${path}.revision`),
    components: Object.freeze(components.sort((left, right) => left.typeId.localeCompare(right.typeId))),
  });
}

function validateHierarchy(
  relationships: readonly ChildOfInspection[],
  path: string,
): void {
  const parentByChild = new Map<EntityId, EntityId>();
  for (const relationship of relationships) {
    if (parentByChild.has(relationship.childEntityId)) {
      fail('An entity can have only one ChildOf parent', path);
    }
    parentByChild.set(relationship.childEntityId, relationship.parentEntityId);
  }
  for (const entityId of parentByChild.keys()) {
    const seen = new Set<EntityId>();
    let current: EntityId | undefined = entityId;
    while (current !== undefined) {
      if (seen.has(current)) fail('ChildOf hierarchy contains a cycle', path);
      seen.add(current);
      current = parentByChild.get(current);
    }
  }
}

export function createWorldInspection(input: unknown, path = '$'): WorldInspection {
  const record = readObject(input, path);
  checkKeys(record, [
    'schemaVersion',
    'owner',
    'worldId',
    'runtimeInstanceId',
    'revision',
    'incomplete',
    'counts',
    'entities',
    'relationships',
    'stores',
  ], [], path);
  if (record.schemaVersion !== WORLD_INSPECTION_SCHEMA_VERSION) {
    fail(`Expected schema version ${WORLD_INSPECTION_SCHEMA_VERSION}`, `${path}.schemaVersion`);
  }
  if (record.owner !== 'framework') fail('Expected framework ownership', `${path}.owner`);
  if (typeof record.incomplete !== 'boolean') fail('Expected a boolean', `${path}.incomplete`);
  if (!Array.isArray(record.entities)) fail('Expected an array', `${path}.entities`);
  if (record.entities.length > MAX_WORLD_INSPECTION_ENTITIES) {
    fail(`Expected at most ${MAX_WORLD_INSPECTION_ENTITIES} entities`, `${path}.entities`);
  }

  const entityIds = new Set<EntityId>();
  let componentCount = 0;
  const entities = record.entities.map((value, index) => {
    const entityPath = `${path}.entities[${index}]`;
    const entity = readEntity(value, entityPath);
    if (entityIds.has(entity.entityId)) fail('Entity identity is duplicated', `${entityPath}.entityId`);
    entityIds.add(entity.entityId);
    componentCount += entity.components.length;
    if (componentCount > MAX_WORLD_INSPECTION_COMPONENTS) {
      fail(`Expected at most ${MAX_WORLD_INSPECTION_COMPONENTS} components`, `${path}.entities`);
    }
    return entity;
  });

  if (!Array.isArray(record.relationships)) fail('Expected an array', `${path}.relationships`);
  if (record.relationships.length > MAX_WORLD_INSPECTION_RELATIONSHIPS) {
    fail(`Expected at most ${MAX_WORLD_INSPECTION_RELATIONSHIPS} relationships`, `${path}.relationships`);
  }
  const relationships = record.relationships.map((value, index) => {
    const relationshipPath = `${path}.relationships[${index}]`;
    const relationship = readObject(value, relationshipPath);
    checkKeys(relationship, ['type', 'childEntityId', 'parentEntityId'], [], relationshipPath);
    if (relationship.type !== 'ChildOf') fail('Expected ChildOf', `${relationshipPath}.type`);
    const childEntityId = readId(
      () => parseEntityId(relationship.childEntityId),
      `${relationshipPath}.childEntityId`,
    );
    const parentEntityId = readId(
      () => parseEntityId(relationship.parentEntityId),
      `${relationshipPath}.parentEntityId`,
    );
    if (!entityIds.has(childEntityId)) fail('Child entity is not retained', `${relationshipPath}.childEntityId`);
    if (!entityIds.has(parentEntityId)) fail('Parent entity is not retained', `${relationshipPath}.parentEntityId`);
    if (childEntityId === parentEntityId) fail('An entity cannot parent itself', relationshipPath);
    return Object.freeze({ type: 'ChildOf' as const, childEntityId, parentEntityId });
  });
  validateHierarchy(relationships, `${path}.relationships`);

  if (!Array.isArray(record.stores)) fail('Expected an array', `${path}.stores`);
  if (record.stores.length > MAX_WORLD_INSPECTION_STORES) {
    fail(`Expected at most ${MAX_WORLD_INSPECTION_STORES} stores`, `${path}.stores`);
  }
  const storeIds = new Set<string>();
  let storeEntryCount = 0;
  const stores = record.stores.map((value, index) => {
    const storePath = `${path}.stores[${index}]`;
    const store = readObject(value, storePath);
    checkKeys(store, ['storeId', 'label', 'kind', 'incomplete', 'counts', 'entries'], [], storePath);
    const storeId = readString(store.storeId, `${storePath}.storeId`, 128, /^[A-Za-z][A-Za-z0-9._:-]*$/);
    if (storeIds.has(storeId)) fail('Store identity is duplicated', `${storePath}.storeId`);
    storeIds.add(storeId);
    if (!['authoring', 'runtime', 'render'].includes(store.kind as string)) {
      fail('Expected authoring, runtime, or render', `${storePath}.kind`);
    }
    if (typeof store.incomplete !== 'boolean') fail('Expected a boolean', `${storePath}.incomplete`);
    if (!Array.isArray(store.entries)) fail('Expected an array', `${storePath}.entries`);
    storeEntryCount += store.entries.length;
    if (storeEntryCount > MAX_WORLD_INSPECTION_STORE_ENTRIES) {
      fail(`Expected at most ${MAX_WORLD_INSPECTION_STORE_ENTRIES} store entries`, `${path}.stores`);
    }
    const entryKeys = new Set<string>();
    const entries = store.entries.map((entryValue, entryIndex) => {
      const entryPath = `${storePath}.entries[${entryIndex}]`;
      const entry = readObject(entryValue, entryPath);
      checkKeys(entry, ['key', 'data'], ['entityId'], entryPath);
      const key = readString(entry.key, `${entryPath}.key`, 256, /^[^\u0000-\u001f\u007f]+$/u);
      if (entryKeys.has(key)) fail('Store entry key is duplicated', `${entryPath}.key`);
      entryKeys.add(key);
      const entityId = Object.hasOwn(entry, 'entityId')
        ? readId(() => parseEntityId(entry.entityId), `${entryPath}.entityId`)
        : undefined;
      if (entityId !== undefined && !entityIds.has(entityId)) {
        fail('Store entry references an entity that is not retained', `${entryPath}.entityId`);
      }
      return Object.freeze({
        key,
        ...(entityId === undefined ? {} : { entityId }),
        data: readJson(entry.data, `${entryPath}.data`),
      });
    });
    const counts = readCount(store.counts, entries.length, `${storePath}.counts`);
    const expectedIncomplete = counts.available > counts.retained;
    if (store.incomplete !== expectedIncomplete) {
      fail('Store incomplete status does not match its counts', `${storePath}.incomplete`);
    }
    return Object.freeze({
      storeId,
      label: readString(store.label, `${storePath}.label`, 128),
      kind: store.kind as 'authoring' | 'runtime' | 'render',
      incomplete: store.incomplete,
      counts,
      entries: Object.freeze(entries.sort((left, right) => left.key.localeCompare(right.key))),
    });
  });

  const countRecord = readObject(record.counts, `${path}.counts`);
  checkKeys(countRecord, ['entities', 'components', 'relationships', 'stores'], [], `${path}.counts`);
  const counts = Object.freeze({
    entities: readCount(countRecord.entities, entities.length, `${path}.counts.entities`),
    components: readCount(countRecord.components, componentCount, `${path}.counts.components`),
    relationships: readCount(countRecord.relationships, relationships.length, `${path}.counts.relationships`),
    stores: readCount(countRecord.stores, stores.length, `${path}.counts.stores`),
  });
  const expectedIncomplete = Object.values(counts).some((count) => (
    count.available > count.retained
  )) || stores.some((store) => store.incomplete);
  if (record.incomplete !== expectedIncomplete) {
    fail('World incomplete status does not match retained data', `${path}.incomplete`);
  }

  return Object.freeze({
    schemaVersion: WORLD_INSPECTION_SCHEMA_VERSION,
    owner: 'framework',
    worldId: readId(() => parseWorldId(record.worldId), `${path}.worldId`),
    runtimeInstanceId: readRuntimeId(record.runtimeInstanceId, `${path}.runtimeInstanceId`),
    revision: readCountValue(record.revision, `${path}.revision`),
    incomplete: record.incomplete,
    counts,
    entities: Object.freeze(entities.sort((left, right) => left.entityId.localeCompare(right.entityId))),
    relationships: Object.freeze(relationships.sort((left, right) => (
      left.childEntityId.localeCompare(right.childEntityId)
      || left.parentEntityId.localeCompare(right.parentEntityId)
    ))),
    stores: Object.freeze(stores.sort((left, right) => left.storeId.localeCompare(right.storeId))),
  });
}
