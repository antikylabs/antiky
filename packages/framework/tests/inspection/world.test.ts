import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  MAX_WORLD_INSPECTION_ENTITIES,
  WORLD_INSPECTION_SCHEMA_VERSION,
  WorldInspectionValidationError,
  createWorldInspection,
  type WorldInspectionInput,
} from '../../src/inspection/world.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const ROOT_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';
const CHILD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abe';
const ORPHAN_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abf';

function count(available: number, retained = available) {
  return { available, retained };
}

function worldInput(): WorldInspectionInput {
  return {
    schemaVersion: WORLD_INSPECTION_SCHEMA_VERSION,
    owner: 'framework',
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-world-001',
    revision: 7,
    incomplete: false,
    counts: {
      entities: count(3),
      components: count(3),
      relationships: count(1),
      stores: count(1),
    },
    entities: [
      {
        entityId: ORPHAN_ID,
        label: 'Unparented Lamp',
        revision: 1,
        components: [{
          typeId: 'antiky.point-light',
          schemaVersion: 1,
          summary: 'Point light',
          data: { power: 1.5, color: [1, 0.5, 0.25] },
        }],
      },
      {
        entityId: CHILD_ID,
        label: 'Market Lamp',
        revision: 2,
        components: [
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'Transform',
            data: { position: [2, 3, 4] },
          },
          {
            typeId: 'antiky.point-light',
            schemaVersion: 1,
            summary: 'Point light',
            data: { power: 2 },
          },
        ],
      },
      {
        entityId: ROOT_ID,
        label: 'Town',
        revision: 1,
        components: [],
      },
    ],
    relationships: [{
      type: 'ChildOf',
      childEntityId: CHILD_ID,
      parentEntityId: ROOT_ID,
    }],
    stores: [{
      storeId: 'antiky.point-lights.runtime',
      label: 'Point-light runtime',
      kind: 'runtime',
      incomplete: false,
      counts: count(2),
      entries: [
        { key: ORPHAN_ID, entityId: ORPHAN_ID, data: { revision: 1, power: 1.5 } },
        { key: CHILD_ID, entityId: CHILD_ID, data: { revision: 2, power: 2 } },
      ],
    }],
  };
}

test('world inspection clones, freezes, and stably orders semantic world data', () => {
  const input = worldInput();
  const world = createWorldInspection(input);

  input.entities[1]!.label = 'Caller mutation';
  (input.entities[1]!.components[0]!.data as { position: number[] }).position[0] = 99;
  (input.stores[0]!.entries[0]!.data as { power: number }).power = 4;

  assert.deepEqual(world.entities.map((entity) => entity.entityId), [
    ROOT_ID,
    CHILD_ID,
    ORPHAN_ID,
  ]);
  assert.deepEqual(world.entities[1]?.components.map((component) => component.typeId), [
    'antiky.point-light',
    'antiky.transform',
  ]);
  assert.equal(world.entities[1]?.label, 'Market Lamp');
  assert.deepEqual(world.entities[1]?.components[1]?.data, { position: [2, 3, 4] });
  assert.equal((world.stores[0]?.entries[1]?.data as { power: number }).power, 1.5);
  assert.deepEqual(world.relationships, [{
    type: 'ChildOf',
    childEntityId: CHILD_ID,
    parentEntityId: ROOT_ID,
  }]);
  assert.equal(world.incomplete, false);
  assert.ok(Object.isFrozen(world));
  assert.ok(Object.isFrozen(world.entities));
  assert.ok(Object.isFrozen(world.entities[1]?.components));
  assert.ok(Object.isFrozen(world.entities[1]?.components[1]?.data));
  assert.ok(Object.isFrozen(world.stores[0]?.entries));
});

test('world inspection accepts real ChildOf roots and unparented entities', () => {
  const world = createWorldInspection(worldInput());

  const parentByChild = new Map<string, string>(world.relationships.map((relationship) => [
    relationship.childEntityId,
    relationship.parentEntityId,
  ]));
  assert.equal(parentByChild.get(CHILD_ID), ROOT_ID);
  assert.equal(parentByChild.has(ROOT_ID), false);
  assert.equal(parentByChild.has(ORPHAN_ID), false);
  assert.deepEqual(world.counts.entities, { available: 3, retained: 3 });
  assert.deepEqual(world.counts.components, { available: 3, retained: 3 });
});

test('world inspection rejects duplicate entities, missing parents, and hierarchy cycles', () => {
  const duplicate = worldInput();
  duplicate.entities[2] = structuredClone(duplicate.entities[1]!);
  assert.throws(
    () => createWorldInspection(duplicate),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.entities[2].entityId'
    ),
  );

  const missingParent = worldInput();
  missingParent.relationships[0]!.parentEntityId =
    '018f0f3a-7b2c-7a1d-8e2f-123456789ac0';
  assert.throws(
    () => createWorldInspection(missingParent),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.relationships[0].parentEntityId'
    ),
  );

  const cycle = worldInput();
  cycle.relationships.push({
    type: 'ChildOf',
    childEntityId: ROOT_ID,
    parentEntityId: CHILD_ID,
  });
  cycle.counts.relationships = count(2);
  assert.throws(
    () => createWorldInspection(cycle),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.code === 'ANTIKY_WORLD_INSPECTION_INVALID'
      && error.path === '$.relationships'
    ),
  );
});

test('world inspection rejects duplicate components, multiple parents, and invalid store kinds', () => {
  const duplicateComponent = worldInput();
  duplicateComponent.entities[1]!.components.push(structuredClone(
    duplicateComponent.entities[1]!.components[0]!,
  ));
  duplicateComponent.counts.components = count(4);
  assert.throws(
    () => createWorldInspection(duplicateComponent),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.entities[1].components[2].typeId'
    ),
  );

  const multipleParents = worldInput();
  multipleParents.relationships.push({
    type: 'ChildOf',
    childEntityId: CHILD_ID,
    parentEntityId: ORPHAN_ID,
  });
  multipleParents.counts.relationships = count(2);
  assert.throws(
    () => createWorldInspection(multipleParents),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.relationships'
    ),
  );

  const invalidStore = worldInput();
  invalidStore.stores[0]!.kind = 'private-runtime' as 'runtime';
  assert.throws(
    () => createWorldInspection(invalidStore),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.stores[0].kind'
    ),
  );
});

test('world inspection reports bounded incomplete stores without pretending they are complete', () => {
  const input = worldInput();
  input.incomplete = true;
  input.stores[0]!.incomplete = true;
  input.stores[0]!.counts = count(4, 2);
  const world = createWorldInspection(input);

  assert.equal(world.incomplete, true);
  assert.equal(world.stores[0]?.incomplete, true);
  assert.deepEqual(world.stores[0]?.counts, { available: 4, retained: 2 });

  input.incomplete = false;
  assert.throws(
    () => createWorldInspection(input),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.incomplete'
    ),
  );
});

test('world inspection rejects unknown fields, excessive values, and excessive entities', () => {
  assert.throws(
    () => createWorldInspection({ ...worldInput(), engineObjects: [] }),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.engineObjects'
    ),
  );

  const largeValue = worldInput();
  largeValue.entities[0]!.components[0]!.data = { text: 'x'.repeat(9_000) };
  assert.throws(
    () => createWorldInspection(largeValue),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path.startsWith('$.entities[0].components[0].data')
    ),
  );

  const excessive = worldInput();
  excessive.entities = Array.from(
    { length: MAX_WORLD_INSPECTION_ENTITIES + 1 },
    (_, index) => ({
      entityId: `018f0f3a-7b2c-7a1d-8e2f-${index.toString(16).padStart(12, '0')}`,
      label: `Entity ${index}`,
      revision: 0,
      components: [],
    }),
  );
  assert.throws(
    () => createWorldInspection(excessive),
    (error: unknown) => (
      error instanceof WorldInspectionValidationError
      && error.path === '$.entities'
    ),
  );
});
