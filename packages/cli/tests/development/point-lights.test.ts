import assert from 'node:assert/strict';
import test from 'node:test';

import { createInspectionSnapshot } from '@antiky/framework';

import { AntikyCliError } from '../../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  projectDevelopmentPointLight,
  projectDevelopmentPointLightListV2,
  projectDevelopmentPointLightV2,
  projectDevelopmentPointLightList,
} from '../../src/development/point-lights.ts';
import type { DevelopmentSnapshot, DevelopmentSnapshotV2 } from '../../src/development/types.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const VISIBLE_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';
const HEADLESS_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abe';
const COMMAND_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789ac0';

function developmentSnapshot(withPointLights = true): DevelopmentSnapshot {
  const inspection = createInspectionSnapshot({
    schemaVersion: 1,
    runtime: { instanceId: 'runtime-projection-001', lifecycle: 'running' },
    diagnostics: [],
    measurements: {
      runtime: { owner: 'framework', frameCount: 5 },
      render: { owner: 'framework', drawCalls: 16 },
    },
    ...(withPointLights ? {
      pointLights: {
        schemaVersion: 1,
        owner: 'framework',
        worldId: WORLD_ID,
        eventSequence: 1,
        authoring: [
          {
            worldId: WORLD_ID,
            entityId: VISIBLE_ID,
            label: 'Harbor Lamp',
            revision: 2,
            transform: { schemaVersion: 1, position: [-3.5, 4.25, 6.75] },
            pointLight: {
              schemaVersion: 1,
              color: [1, 0.52, 0.22],
              radius: 4,
              power: 2,
            },
          },
          {
            worldId: WORLD_ID,
            entityId: HEADLESS_ID,
            label: 'Gate Lamp',
            revision: 1,
            transform: { schemaVersion: 1, position: [0, 0, 0] },
            pointLight: {
              schemaVersion: 1,
              color: [1, 1, 1],
              radius: 1,
              power: 0.5,
            },
          },
        ],
        runtime: {
          instanceId: 'runtime-projection-001',
          eventSequence: 1,
          pointLights: [
            { entityId: VISIBLE_ID, revision: 2, power: 2 },
            { entityId: HEADLESS_ID, revision: 1, power: 0.5 },
          ],
        },
        render: {
          eventSequence: 1,
          pointLights: [
            { entityId: VISIBLE_ID, renderSlot: 0, revision: 2, power: 2 },
          ],
          dirtySlots: [0],
        },
        facts: [{
          schemaVersion: 1,
          type: 'antiky.authoring.point-light-power-set',
          eventSequence: 1,
          sourceCommandId: COMMAND_ID,
          worldId: WORLD_ID,
          entityId: VISIBLE_ID,
          oldPower: 1.05,
          newPower: 2,
          resultingRevision: 2,
          receivedAt: '2026-08-05T03:00:00.000Z',
        }],
      },
    } : {}),
  });
  return {
    schemaVersion: 1,
    developmentSessionId: 'development-projection-001',
    acceptedBuildRevision: 2,
    startedAt: '2026-08-05T03:00:00.000Z',
    project: {
      name: 'Test game',
      manifestPath: '/game/test.antiky',
      projectRoot: '/game',
      revision: 'a'.repeat(64),
      gameUrl: 'http://127.0.0.1:3010/game',
      host: '127.0.0.1',
      gamePort: 3010,
      inspectionPort: 3011,
      viewport: { width: 1280, height: 720 },
    },
    processes: { game: { state: 'running' }, shaders: { state: 'running' } },
    connection: { state: 'connected' },
    cleanup: { state: 'active' },
    build: { owner: 'cli', revision: 2, changeKind: 'source', result: 'ready' },
    diagnostics: [],
    measurements: { owner: 'cli', launchMilliseconds: 10 },
    inspection,
  };
}

function developmentSnapshotV2(): DevelopmentSnapshotV2 {
  const source = developmentSnapshot();
  return {
    ...source,
    schemaVersion: 2,
    observation: {
      schemaVersion: 1,
      developmentSessionId: source.developmentSessionId,
      acceptedBuildRevision: 2,
      runtimeInstanceId: 'runtime-projection-001',
      publicationSequence: 4,
      publishedAt: '2026-08-10T17:15:00.000Z',
      connectionState: 'connected',
      freshness: 'current',
      session: null,
      world: { worldId: WORLD_ID, revision: null, eventSequence: 1 },
    },
  };
}

test('development point-light reads project the shared inspection without copying authority', () => {
  const snapshot = developmentSnapshot();
  const list = projectDevelopmentPointLightList(snapshot);
  const visible = projectDevelopmentPointLight(snapshot, VISIBLE_ID);
  const headless = projectDevelopmentPointLight(snapshot, HEADLESS_ID);

  assert.equal(list.developmentSessionId, snapshot.developmentSessionId);
  assert.equal(list.runtimeInstanceId, 'runtime-projection-001');
  assert.equal(list.worldId, WORLD_ID);
  assert.equal(list.eventSequence, 1);
  assert.deepEqual(list.pointLights, snapshot.inspection?.pointLights?.authoring);
  assert.equal(visible.pointLight?.authoring.label, 'Harbor Lamp');
  assert.equal(visible.pointLight?.runtime.power, 2);
  assert.equal(visible.pointLight?.render?.renderSlot, 0);
  assert.deepEqual(visible.pointLight?.facts.map((fact) => fact.sourceCommandId), [COMMAND_ID]);
  assert.equal(headless.pointLight?.render, null);
  assert.deepEqual(headless.pointLight?.facts, []);
  assert.ok(Object.isFrozen(list));
  assert.ok(Object.isFrozen(visible));
  assert.equal(projectDevelopmentPointLight(snapshot, COMMAND_ID).pointLight, null);
});

test('development point-light reads reject an unavailable runtime-owned inspection source', () => {
  assert.throws(
    () => projectDevelopmentPointLightList(developmentSnapshot(false)),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_RUNTIME_UNAVAILABLE'
    ),
  );
});

test('version-two point-light reads carry the exact accepted observation', () => {
  const source = developmentSnapshotV2();
  const list = projectDevelopmentPointLightListV2(source);
  const detail = projectDevelopmentPointLightV2(source, VISIBLE_ID);

  assert.equal(list.schemaVersion, 2);
  assert.equal(detail.schemaVersion, 2);
  assert.equal(list.observation, source.observation);
  assert.equal(detail.observation, source.observation);
  assert.equal(detail.pointLight?.authoring.entityId, VISIBLE_ID);
});
