import assert from 'node:assert/strict';
import test from 'node:test';

import { createInspectionSnapshot } from '@antiky/framework';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  BrowserEnvelopeError,
  readBrowserActionResultEnvelope,
  readBrowserDisconnectEnvelope,
  readBrowserSnapshotEnvelope,
} from '../../../src/host/inspection/browser-envelope.ts';

const DEVELOPMENT_SESSION_ID = 'development-browser-envelope-001';

const inspection = createInspectionSnapshot({
  schemaVersion: 1,
  runtime: { instanceId: 'runtime-browser-envelope-001', lifecycle: 'ready' },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 1 },
    render: { owner: 'framework' },
  },
});

test('browser envelopes return typed snapshots, disconnects, and action results', () => {
  assert.deepEqual(readBrowserSnapshotEnvelope({
    schemaVersion: 1,
    developmentSessionId: DEVELOPMENT_SESSION_ID,
    publicationSequence: 1,
    snapshot: inspection,
  }, DEVELOPMENT_SESSION_ID), {
    snapshot: inspection,
    publicationSequence: 1,
  });
  assert.deepEqual(readBrowserDisconnectEnvelope({
    schemaVersion: 1,
    developmentSessionId: DEVELOPMENT_SESSION_ID,
    runtimeInstanceId: 'runtime-browser-envelope-001',
    publicationSequence: 2,
  }, DEVELOPMENT_SESSION_ID), {
    runtimeInstanceId: 'runtime-browser-envelope-001',
    publicationSequence: 2,
  });
  assert.deepEqual(readBrowserActionResultEnvelope({
    schemaVersion: 1,
    developmentSessionId: DEVELOPMENT_SESSION_ID,
    runtimeInstanceId: 'runtime-browser-envelope-001',
    actionId: 'action-browser-envelope-001',
    result: {
      kind: 'capture',
      mimeType: 'image/png',
      canvasWidth: 1,
      canvasHeight: 1,
      dataBase64: 'capture-bytes-stay-in-the-envelope',
    },
  }, DEVELOPMENT_SESSION_ID), {
    kind: 'capture',
    input: {
      actionId: 'action-browser-envelope-001',
      runtimeInstanceId: 'runtime-browser-envelope-001',
      mimeType: 'image/png',
      canvasWidth: 1,
      canvasHeight: 1,
      dataBase64: 'capture-bytes-stay-in-the-envelope',
    },
    snapshot: null,
    publicationSequence: null,
  });
  assert.deepEqual(readBrowserActionResultEnvelope({
    schemaVersion: 1,
    developmentSessionId: DEVELOPMENT_SESSION_ID,
    runtimeInstanceId: 'runtime-browser-envelope-001',
    actionId: 'action-browser-envelope-002',
    result: {
      kind: 'capture',
      mimeType: 'image/png',
      canvasWidth: 1,
      canvasHeight: 1,
      dataBase64: 'capture-bytes-stay-in-the-envelope',
      publicationSequence: 2,
      snapshot: inspection,
    },
  }, DEVELOPMENT_SESSION_ID), {
    kind: 'capture',
    input: {
      actionId: 'action-browser-envelope-002',
      runtimeInstanceId: 'runtime-browser-envelope-001',
      publicationSequence: 2,
      mimeType: 'image/png',
      canvasWidth: 1,
      canvasHeight: 1,
      dataBase64: 'capture-bytes-stay-in-the-envelope',
    },
    snapshot: inspection,
    publicationSequence: 2,
  });
});

test('browser envelope failures are bounded and do not repeat supplied fields', () => {
  const secret = 'credential=must-not-cross-the-boundary';
  for (const value of [
    {
      schemaVersion: 1,
      developmentSessionId: DEVELOPMENT_SESSION_ID,
      publicationSequence: 1,
      snapshot: inspection,
      [secret]: true,
    },
    {
      schemaVersion: 1,
      developmentSessionId: 'another-development-session',
      publicationSequence: 1,
      snapshot: inspection,
    },
    {
      schemaVersion: 1,
      developmentSessionId: DEVELOPMENT_SESSION_ID,
      runtimeInstanceId: 'runtime-browser-envelope-001',
      actionId: 'action-browser-envelope-001',
      result: { kind: secret },
    },
  ]) {
    const operation = 'snapshot' in value
      ? () => readBrowserSnapshotEnvelope(value, DEVELOPMENT_SESSION_ID)
      : () => readBrowserActionResultEnvelope(value, DEVELOPMENT_SESSION_ID);
    assert.throws(
      operation,
      (cause: unknown) => (
        cause instanceof BrowserEnvelopeError
        && (cause.status === 400 || cause.status === 409)
        && !cause.message.includes(secret)
      ),
    );
  }
});
