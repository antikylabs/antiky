import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  INSPECTION_SCHEMA_VERSION,
  InspectionValidationError,
  createInspectionSnapshot,
  createInspectionStore,
  type InspectionSnapshotInput,
} from '../../src/inspection/snapshot.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';

function semanticWorld(runtimeInstanceId = 'runtime-001', worldId = WORLD_ID) {
  return {
    schemaVersion: 1,
    owner: 'framework' as const,
    worldId,
    runtimeInstanceId,
    revision: 0,
    incomplete: false,
    counts: {
      entities: { available: 0, retained: 0 },
      components: { available: 0, retained: 0 },
      relationships: { available: 0, retained: 0 },
      stores: { available: 0, retained: 0 },
    },
    entities: [],
    relationships: [],
    stores: [],
  };
}

function eventHistory(runtimeInstanceId = 'runtime-001', worldId = WORLD_ID) {
  return {
    schemaVersion: 1,
    owner: 'framework' as const,
    sourceId: 'antiky.point-light-authoring',
    worldId,
    runtimeInstanceId,
    incomplete: false,
    counts: { available: 0, retained: 0 },
    retention: {
      lifetime: 'runtime-instance' as const,
      storage: 'memory' as const,
      overflow: 'reject-new' as const,
      capacity: 256,
      droppedCount: 0,
    },
    events: [],
  };
}

function sessionStatus(runtimeInstanceId = 'runtime-001') {
  return {
    schemaVersion: 2,
    sessionId: '018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
    worldId: '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
    runtimeInstanceId,
    mode: 'paused',
    fault: null,
    pauseReasons: ['tool'],
    systemOrder: ['town-update'],
    clock: {
      fixedStepSeconds: 1 / 60,
      maximumFrameElapsedSeconds: 0.05,
      maximumStepsPerFrame: 3,
      accumulatorSeconds: 1 / 120,
      completedStepCount: 12,
      inputSequence: 10,
      totalAcceptedElapsedSeconds: 0.2,
      totalDiscardedSeconds: 0.1,
    },
    revisions: {
      commandSequence: 2,
      controlRevision: 3,
      worldRevision: 1,
    },
    lastCompletedStep: {
      completedStepId: 12,
      inputSequence: 10,
      stateDigest: 'town-v1:0123456789abcdef',
    },
  };
}

function snapshotInput(instanceId = 'runtime-001'): InspectionSnapshotInput {
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    runtime: {
      instanceId,
      lifecycle: 'running',
    },
    diagnostics: [
      {
        id: 'diagnostic-001',
        owner: 'framework',
        source: 'runtime',
        code: 'ANTIKY_RUNTIME_READY',
        severity: 'info',
        message: 'The runtime is ready.',
        relatedIds: [instanceId],
      },
    ],
    measurements: {
      runtime: {
        owner: 'framework',
        frameCount: 42,
        framesPerSecond: 60,
      },
      render: {
        owner: 'framework',
        canvasWidth: 1280,
        canvasHeight: 720,
        drawCalls: 16,
        instances: 1247,
        uploadBytesPerFrame: 320,
      },
    },
  };
}

test('inspection snapshots clone and freeze every caller-owned value', () => {
  const input = snapshotInput();
  const snapshot = createInspectionSnapshot(input);

  input.runtime.lifecycle = 'error';
  input.diagnostics[0]!.relatedIds.push('changed-after-publish');
  input.measurements.render.drawCalls = 999;

  assert.equal(snapshot.runtime.lifecycle, 'running');
  assert.deepEqual(snapshot.diagnostics[0]!.relatedIds, ['runtime-001']);
  assert.equal(snapshot.measurements.render.drawCalls, 16);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.runtime));
  assert.ok(Object.isFrozen(snapshot.diagnostics));
  assert.ok(Object.isFrozen(snapshot.diagnostics[0]));
  assert.ok(Object.isFrozen(snapshot.diagnostics[0]!.relatedIds));
  assert.ok(Object.isFrozen(snapshot.measurements));
  assert.ok(Object.isFrozen(snapshot.measurements.runtime));
  assert.ok(Object.isFrozen(snapshot.measurements.render));
});

test('inspection subscriptions report newer snapshots in publish order', () => {
  const store = createInspectionStore(snapshotInput('runtime-001'));
  const updates: Array<{ sequence: number; runtimeId: string }> = [];
  const unsubscribe = store.subscribe((update) => {
    updates.push({
      sequence: update.sequence,
      runtimeId: update.snapshot.runtime.instanceId,
    });
  });

  const second = store.publish(snapshotInput('runtime-002'));
  const third = store.publish(snapshotInput('runtime-003'));
  unsubscribe();
  store.publish(snapshotInput('runtime-004'));

  assert.equal(store.read().runtime.instanceId, 'runtime-004');
  assert.equal(second.sequence, 1);
  assert.equal(third.sequence, 2);
  assert.deepEqual(updates, [
    { sequence: 1, runtimeId: 'runtime-002' },
    { sequence: 2, runtimeId: 'runtime-003' },
  ]);
});

test('diagnostics and semantic measurements retain their framework owner', () => {
  const snapshot = createInspectionSnapshot(snapshotInput());

  assert.equal(snapshot.diagnostics[0]!.owner, 'framework');
  assert.equal(snapshot.diagnostics[0]!.code, 'ANTIKY_RUNTIME_READY');
  assert.equal(snapshot.measurements.runtime.owner, 'framework');
  assert.equal(snapshot.measurements.runtime.frameCount, 42);
  assert.equal(snapshot.measurements.render.owner, 'framework');
  assert.equal(snapshot.measurements.render.uploadBytesPerFrame, 320);
});

test('inspection carries one validated immutable session status', () => {
  const input = { ...snapshotInput(), session: sessionStatus() };
  const snapshot = createInspectionSnapshot(input);

  input.session.pauseReasons.push('visibility');
  input.session.clock.completedStepCount = 99;

  assert.equal(snapshot.session?.sessionId, '018f0f3a-7b2c-7a1d-8e2f-123456789ab0');
  assert.deepEqual(snapshot.session?.pauseReasons, ['tool']);
  assert.equal(snapshot.session?.clock.completedStepCount, 12);
  assert.ok(Object.isFrozen(snapshot.session));
  assert.ok(Object.isFrozen(snapshot.session?.clock));
  assert.ok(Object.isFrozen(snapshot.session?.systemOrder));
});

test('inspection carries one immutable semantic world and accepted-event history', () => {
  const world = semanticWorld();
  const events = eventHistory();
  const snapshot = createInspectionSnapshot({
    ...snapshotInput(),
    session: sessionStatus(),
    world,
    events,
  });

  world.revision = 99;
  events.retention.capacity = 1;
  assert.equal(snapshot.world?.revision, 0);
  assert.equal(snapshot.events?.retention.capacity, 256);
  assert.equal(snapshot.world?.worldId, snapshot.session?.worldId);
  assert.equal(snapshot.events?.worldId, snapshot.world?.worldId);
  assert.ok(Object.isFrozen(snapshot.world));
  assert.ok(Object.isFrozen(snapshot.events));
});

test('inspection rejects semantic views from another runtime or world', () => {
  assert.throws(
    () => createInspectionSnapshot({
      ...snapshotInput(),
      world: semanticWorld('runtime-other'),
    }),
    (error: unknown) => (
      error instanceof InspectionValidationError
      && error.path === '$.world.runtimeInstanceId'
    ),
  );

  assert.throws(
    () => createInspectionSnapshot({
      ...snapshotInput(),
      session: sessionStatus(),
      world: semanticWorld(),
      events: eventHistory('runtime-001', '018f0f3a-7b2c-7a1d-8e2f-123456789bbb'),
    }),
    (error: unknown) => (
      error instanceof InspectionValidationError
      && error.path === '$.events.worldId'
    ),
  );
});

test('inspection rejects session status from another runtime', () => {
  assert.throws(
    () => createInspectionSnapshot({
      ...snapshotInput(),
      session: sessionStatus('runtime-other'),
    }),
    /runtime identity/i,
  );
});

test('snapshot validation rejects unknown fields and invalid measurements', () => {
  const unknown = {
    ...snapshotInput(),
    browserDocument: {},
  };
  assert.throws(
    () => createInspectionSnapshot(unknown),
    (error: unknown) => (
      error instanceof InspectionValidationError
      && error.code === 'ANTIKY_INSPECTION_INVALID'
      && error.path === '$.browserDocument'
    ),
  );

  const invalid = snapshotInput();
  invalid.measurements.runtime.frameCount = -1;
  assert.throws(
    () => createInspectionSnapshot(invalid),
    (error: unknown) => (
      error instanceof InspectionValidationError
      && error.code === 'ANTIKY_INSPECTION_INVALID'
      && error.path === '$.measurements.runtime.frameCount'
    ),
  );
});

test('snapshot validation keeps diagnostics and related IDs bounded', () => {
  const tooMany = snapshotInput();
  tooMany.diagnostics = Array.from({ length: 65 }, (_, index) => ({
    id: `diagnostic-${index}`,
    owner: 'framework' as const,
    source: 'runtime' as const,
    code: 'ANTIKY_RUNTIME_TEST',
    severity: 'info' as const,
    message: 'Bounded diagnostic.',
    relatedIds: [],
  }));

  assert.throws(
    () => createInspectionSnapshot(tooMany),
    (error: unknown) => (
      error instanceof InspectionValidationError
      && error.path === '$.diagnostics'
    ),
  );
});
