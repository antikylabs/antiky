import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  createCommandId,
  createEntityId,
  createSessionId,
  createWorldId,
  generateId,
  isUuidV7,
  parseCommandId,
  parseEntityId,
  parseSessionId,
  parseWorldId,
} from './ids.ts';

const deterministicSource = {
  timestampMilliseconds: 1_710_000_000_000,
  randomBytes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
} as const;

test('branded IDs create canonical UUIDv7 text from an injected source', () => {
  assert.equal(createWorldId(deterministicSource), '018e23f1-4c00-7001-8203-040506070809');
  assert.equal(createEntityId(deterministicSource), '018e23f1-4c00-7001-8203-040506070809');
  assert.equal(createCommandId(deterministicSource), '018e23f1-4c00-7001-8203-040506070809');
  assert.equal(createSessionId(deterministicSource), '018e23f1-4c00-7001-8203-040506070809');
  assert.equal(generateId('session', deterministicSource), '018e23f1-4c00-7001-8203-040506070809');
});

test('ID parsing accepts canonical UUIDv7 fixtures and rejects other UUID forms', () => {
  const world = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
  const entity = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';
  const command = '018f0f3a-7b2c-7a1d-8e2f-123456789abe';
  const session = '018f0f3a-7b2c-7a1d-8e2f-123456789abf';

  assert.equal(parseWorldId(world), world);
  assert.equal(parseEntityId(entity), entity);
  assert.equal(parseCommandId(command), command);
  assert.equal(parseSessionId(session), session);
  assert.equal(isUuidV7(world), true);

  for (const invalid of [
    '550e8400-e29b-41d4-a716-446655440000',
    '018f0f3a-7b2c-7a1d-7e2f-123456789abc',
    '018F0F3A-7B2C-7A1D-8E2F-123456789ABC',
    'not-an-id',
    '',
    null,
  ]) {
    assert.equal(isUuidV7(invalid), false);
    assert.throws(() => parseWorldId(invalid), /UUIDv7/);
  }
});

test('the supported Framework generator covers each stable ID kind', () => {
  for (const kind of ['world', 'entity', 'command', 'session'] as const) {
    assert.equal(generateId(kind, deterministicSource), '018e23f1-4c00-7001-8203-040506070809');
  }
  assert.throws(
    () => generateId('asset' as 'world', deterministicSource),
    /ID kind/i,
  );
});

test('ID creation validates timestamp and random-byte inputs', () => {
  assert.throws(
    () => createWorldId({ ...deterministicSource, timestampMilliseconds: -1 }),
    /timestamp/i,
  );
  assert.throws(
    () => createEntityId({ ...deterministicSource, randomBytes: [1, 2, 3] }),
    /10 random bytes/i,
  );
  assert.throws(
    () => createCommandId({ ...deterministicSource, randomBytes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 256] }),
    /random byte/i,
  );
});
