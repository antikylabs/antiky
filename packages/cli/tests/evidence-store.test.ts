import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  createEvidenceStore,
  parseEvidenceArtifactRefV1,
} from '../src/host/evidence-store.ts';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const OBSERVATION = Object.freeze({
  schemaVersion: 1 as const,
  developmentSessionId: 'development-evidence-001',
  acceptedBuildRevision: 2,
  runtimeInstanceId: 'runtime-evidence-001',
  publicationSequence: 3,
  publishedAt: '2026-08-10T18:00:00.000Z',
  connectionState: 'connected' as const,
  freshness: 'current' as const,
  session: null,
  world: null,
});

test('the evidence store returns a strict path-safe content-addressed private artifact', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-evidence-store-'));
  const store = createEvidenceStore({
    rootDirectory,
    developmentSessionId: OBSERVATION.developmentSessionId,
    now: () => '2026-08-10T18:00:01.000Z',
  });
  try {
    const artifact = await store.put({
      evidenceId: 'evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
      kind: 'still',
      role: 'canvas-master',
      mimeType: 'image/png',
      bytes: PNG,
      width: 1,
      height: 1,
      observation: OBSERVATION,
    });
    const text = JSON.stringify(artifact);
    assert.equal(artifact.schemaVersion, 1);
    assert.match(artifact.artifactId, /^artifact-[0-9a-f]{64}$/u);
    assert.equal(artifact.sha256, artifact.artifactId.slice('artifact-'.length));
    assert.equal(artifact.reviewState, 'private-unreviewed');
    assert.deepEqual(artifact.privacy, {
      gameCanvasOnly: true,
      desktopPixelsPossible: false,
      audio: 'none',
      contentScan: 'not-performed',
    });
    assert.deepEqual(artifact.observation, OBSERVATION);
    assert.doesNotMatch(text, /\/Users\/|antiky-evidence-store-|\.antiky|credential|pid/i);
    assert.deepEqual(await store.read({
      evidenceId: artifact.evidenceId,
      artifactId: artifact.artifactId,
    }), { artifact, bytes: PNG });
    assert.deepEqual(parseEvidenceArtifactRefV1(structuredClone(artifact)), artifact);
    assert.ok(Object.isFrozen(artifact));
    assert.ok(Object.isFrozen(artifact.privacy));
    assert.ok(Object.isFrozen(artifact.observation));
  } finally {
    await store.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('artifact lookup cannot forge identities, escape the store, or cross sessions', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-evidence-access-'));
  const store = createEvidenceStore({
    rootDirectory,
    developmentSessionId: OBSERVATION.developmentSessionId,
  });
  const other = createEvidenceStore({
    rootDirectory,
    developmentSessionId: 'development-evidence-002',
  });
  try {
    const artifact = await store.put({
      evidenceId: 'evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
      kind: 'still',
      role: 'canvas-master',
      mimeType: 'image/png',
      bytes: PNG,
      width: 1,
      height: 1,
      observation: OBSERVATION,
    });
    for (const lookup of [
      { evidenceId: '../../outside', artifactId: artifact.artifactId },
      { evidenceId: artifact.evidenceId, artifactId: '../secret' },
      { evidenceId: artifact.evidenceId, artifactId: `artifact-${'0'.repeat(64)}` },
    ]) {
      await assert.rejects(
        () => store.read(lookup),
        (cause: unknown) => cause instanceof AntikyCliError
          && (cause.code === 'ANTIKY_ARGUMENT_INVALID' || cause.code === 'ANTIKY_EVIDENCE_NOT_FOUND'),
      );
    }
    await assert.rejects(
      () => other.read({ evidenceId: artifact.evidenceId, artifactId: artifact.artifactId }),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'ANTIKY_EVIDENCE_NOT_FOUND',
    );
    assert.throws(() => parseEvidenceArtifactRefV1({ ...artifact, path: '/tmp/private' }));
    assert.throws(() => parseEvidenceArtifactRefV1({
      ...artifact,
      byteLength: 256 * 1024 * 1024 + 1,
    }));
  } finally {
    await Promise.all([store.stop(), other.stop()]);
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('evidence metadata listing is bounded and a failed sequence can discard its whole group', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-evidence-list-'));
  const store = createEvidenceStore({
    rootDirectory,
    developmentSessionId: OBSERVATION.developmentSessionId,
  });
  const evidenceId = 'evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0';
  try {
    const frame = await store.put({
      evidenceId,
      kind: 'sequence-frame',
      role: 'sequence-frame-0001',
      mimeType: 'image/png',
      bytes: PNG,
      width: 1,
      height: 1,
      observation: OBSERVATION,
    });
    const manifest = await store.put({
      evidenceId,
      kind: 'manifest',
      role: 'sequence-manifest',
      mimeType: 'application/json',
      bytes: Buffer.from('{"schemaVersion":1}'),
      width: null,
      height: null,
      observation: OBSERVATION,
    });
    const listed = store.list({ evidenceId, limit: 256 });
    assert.equal(listed.availableCount, 2);
    assert.equal(listed.complete, true);
    assert.deepEqual(listed.artifacts.map((entry) => entry.creationSequence), [1, 2]);
    assert.deepEqual(listed.artifacts.map((entry) => entry.artifact.kind), [
      'sequence-frame', 'manifest',
    ]);
    assert.doesNotMatch(JSON.stringify(listed), /path|\.antiky|pid|credential/i);
    await store.discard(evidenceId);
    assert.equal(store.list({ evidenceId, limit: 256 }).availableCount, 0);
    await assert.rejects(
      () => store.read({ evidenceId, artifactId: frame.artifactId }),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'ANTIKY_EVIDENCE_NOT_FOUND',
    );
    await assert.rejects(
      () => store.read({ evidenceId, artifactId: manifest.artifactId }),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'ANTIKY_EVIDENCE_NOT_FOUND',
    );
  } finally {
    await store.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('the evidence store enforces its retained evidence-group ceiling', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-evidence-capacity-'));
  const store = createEvidenceStore({
    rootDirectory,
    developmentSessionId: OBSERVATION.developmentSessionId,
    maximumRetainedEvidence: 1,
  });
  try {
    const put = (evidenceId: string) => store.put({
      evidenceId,
      kind: 'still' as const,
      role: 'canvas-master',
      mimeType: 'image/png' as const,
      bytes: PNG,
      width: 1,
      height: 1,
      observation: OBSERVATION,
    });
    await put('evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0');
    await assert.rejects(
      () => put('evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab1'),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'CAPTURE_LIMIT_EXCEEDED',
    );
  } finally {
    await store.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
