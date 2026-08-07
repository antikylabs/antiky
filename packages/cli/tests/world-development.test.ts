import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInspectionSnapshot,
  createPointLightWorldViews,
} from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  projectDevelopmentEventHistory,
  projectDevelopmentWorldInspection,
} from '../src/development/inspection.ts';
import type { DevelopmentSnapshot } from '../src/development/types.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const LIGHT_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';

function snapshot(publishViews = true): DevelopmentSnapshot {
  const views = createPointLightWorldViews({
    schemaVersion: 1,
    owner: 'framework',
    worldId: WORLD_ID,
    eventSequence: 0,
    authoring: [{
      worldId: WORLD_ID,
      entityId: LIGHT_ID,
      label: 'Harbor Lamp',
      revision: 1,
      transform: { schemaVersion: 1, position: [1, 2, 3] },
      pointLight: { schemaVersion: 1, color: [1, 0.5, 0.2], radius: 4, power: 1 },
    }],
    runtime: {
      instanceId: 'runtime-world-projection-001',
      eventSequence: 0,
      pointLights: [{ entityId: LIGHT_ID, revision: 1, power: 1 }],
    },
    render: {
      eventSequence: 0,
      pointLights: [{ entityId: LIGHT_ID, renderSlot: 0, revision: 1, power: 1 }],
      dirtySlots: [],
    },
    facts: [],
  });
  const inspection = createInspectionSnapshot({
    schemaVersion: 1,
    runtime: { instanceId: 'runtime-world-projection-001', lifecycle: 'running' },
    diagnostics: [],
    measurements: {
      runtime: { owner: 'framework', frameCount: 1 },
      render: { owner: 'framework', drawCalls: 1 },
    },
    ...(publishViews ? views : {}),
  });
  return {
    schemaVersion: 1,
    developmentSessionId: 'development-world-projection-001',
    acceptedBuildRevision: 1,
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
    build: { owner: 'cli', revision: 1, changeKind: 'initial', result: 'ready' },
    diagnostics: [],
    measurements: { owner: 'cli', launchMilliseconds: 10 },
    inspection,
  };
}

test('world and event reads project the shared Framework inspection source', () => {
  const source = snapshot();
  const world = projectDevelopmentWorldInspection(source);
  const events = projectDevelopmentEventHistory(source);

  assert.deepEqual(world, {
    schemaVersion: 1,
    developmentSessionId: source.developmentSessionId,
    world: source.inspection?.world,
  });
  assert.deepEqual(events, {
    schemaVersion: 1,
    developmentSessionId: source.developmentSessionId,
    events: source.inspection?.events,
  });
  assert.ok(Object.isFrozen(world));
  assert.ok(Object.isFrozen(world.world));
  assert.ok(Object.isFrozen(events));
  assert.ok(Object.isFrozen(events.events));
});

test('world and event reads report an unavailable runtime when views are absent', () => {
  const source = snapshot(false);
  for (const project of [projectDevelopmentWorldInspection, projectDevelopmentEventHistory]) {
    assert.throws(
      () => project(source),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_RUNTIME_UNAVAILABLE'
      ),
    );
  }
});
