import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { parseObservationRefV1 } from '../src/development/observation.ts';

const OBSERVATION = Object.freeze({
  schemaVersion: 1 as const,
  developmentSessionId: 'development-observation-001',
  acceptedBuildRevision: 7,
  runtimeInstanceId: 'runtime-observation-001',
  publicationSequence: 12,
  publishedAt: '2026-08-10T16:45:01.123Z',
  connectionState: 'connected' as const,
  freshness: 'current' as const,
  session: Object.freeze({
    sessionId: '018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
    worldId: '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
    mode: 'paused' as const,
    completedStepCount: 42,
    controlRevision: 3,
    worldRevision: 5,
    stateDigest: 'fixture:42',
  }),
  world: Object.freeze({
    worldId: '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
    revision: 5,
    eventSequence: 8,
  }),
});

test('observation references parse strictly into immutable bounded values', () => {
  const parsed = parseObservationRefV1(structuredClone(OBSERVATION));

  assert.deepEqual(parsed, OBSERVATION);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.session));
  assert.ok(Object.isFrozen(parsed.world));
  assert.throws(() => parseObservationRefV1({ ...OBSERVATION, localPath: '/Users/person/game' }));
  assert.throws(() => parseObservationRefV1({ ...OBSERVATION, publicationSequence: 0 }));
  assert.throws(() => parseObservationRefV1({ ...OBSERVATION, publishedAt: 'yesterday' }));
  assert.throws(() => parseObservationRefV1({
    ...OBSERVATION,
    session: { ...OBSERVATION.session, surprise: true },
  }));
});

test('observation references distinguish retained disconnected data from current data', () => {
  const retained = parseObservationRefV1({
    ...OBSERVATION,
    connectionState: 'unavailable',
    freshness: 'retained-unavailable',
  });
  assert.equal(retained.freshness, 'retained-unavailable');
  assert.throws(
    () => parseObservationRefV1({
      ...OBSERVATION,
      connectionState: 'unavailable',
      freshness: 'current',
    }),
    (cause: unknown) => (
      cause instanceof AntikyCliError && cause.code === 'ANTIKY_OBSERVATION_INVALID'
    ),
  );
});

test('observation references allow unavailable session and world counters explicitly', () => {
  const parsed = parseObservationRefV1({ ...OBSERVATION, session: null, world: null });
  assert.equal(parsed.session, null);
  assert.equal(parsed.world, null);
});
