import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { connectDevelopmentInspectionPublisher } from './development-inspection.ts';

const inspectionOrigin = 'http://127.0.0.1:3011';
const gameOrigin = 'http://127.0.0.1:3010';

test('browser publications cannot overtake an earlier snapshot', async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originalWindow = globals.window;
  const originalFetch = globalThis.fetch;
  const originalInspectionOrigin = process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN;
  globals.window = { location: { origin: gameOrigin } };
  process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN = inspectionOrigin;

  let releaseFirst!: () => void;
  const firstRelease = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let postCount = 0;
  const publicationSequences: unknown[] = [];
  globalThis.fetch = (async (input, init) => {
    if (String(input).endsWith('/v1/browser/bootstrap')) {
      return new Response(JSON.stringify({
        schemaVersion: 1,
        developmentSessionId: 'development-ordering-001',
        gameUrl: `${gameOrigin}/demos/town-study`,
        credential: 'a'.repeat(43),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    postCount += 1;
    publicationSequences.push(JSON.parse(String(init?.body)).publicationSequence);
    if (postCount === 1) await firstRelease;
    return new Response('{}', { status: 202 });
  }) as typeof fetch;

  const publisher = await connectDevelopmentInspectionPublisher();
  assert.ok(publisher);
  const common = {
    runtimeInstanceId: 'runtime-ordering-001',
    frameCount: 0,
    framesPerSecond: 0,
    canvasWidth: 300,
    canvasHeight: 150,
    stats: {},
    error: null,
  } as const;
  const first = publisher.publish({ ...common, phase: 'loading' });
  const second = publisher.publish({ ...common, phase: 'ready' });
  await Promise.resolve();

  try {
    assert.equal(postCount, 1, 'the ready snapshot started before loading was accepted');
  } finally {
    releaseFirst();
    await Promise.allSettled([first, second]);
    await publisher.publish({
      ...common,
      runtimeInstanceId: 'runtime-ordering-002',
      phase: 'loading',
    });
    assert.deepEqual(publicationSequences, [1, 2, 1]);
    publisher.close();
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globals.window;
    else globals.window = originalWindow;
    if (originalInspectionOrigin === undefined) {
      delete process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN = originalInspectionOrigin;
    }
  }
});

test('browser action polling captures a frame and disconnects with the next sequence', async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originalWindow = globals.window;
  const originalFetch = globalThis.fetch;
  const originalInspectionOrigin = process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN;
  globals.window = { location: { origin: gameOrigin } };
  process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN = inspectionOrigin;
  const captureId = 'capture-browser-001';
  let servedAction = false;
  let captureEnvelope: Record<string, unknown> | null = null;
  let disconnectEnvelope: Record<string, unknown> | null = null;
  let resolveCapture!: () => void;
  const captured = new Promise<void>((resolve) => { resolveCapture = resolve; });

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.endsWith('/v1/browser/bootstrap')) {
      return new Response(JSON.stringify({
        schemaVersion: 1,
        developmentSessionId: 'development-actions-001',
        gameUrl: `${gameOrigin}/demos/town-study`,
        credential: 'b'.repeat(43),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith('/v1/runtime/snapshot')) return new Response('{}', { status: 202 });
    if (url.includes('/v1/runtime/action?')) {
      if (servedAction) return new Response(null, { status: 204 });
      servedAction = true;
      return new Response(JSON.stringify({
        schemaVersion: 1,
        actionId: 'action-capture-browser-001',
        kind: 'capture',
        developmentSessionId: 'development-actions-001',
        runtimeInstanceId: 'runtime-browser-actions-001',
        buildRevision: 4,
        captureId,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith('/v1/runtime/action-result')) {
      captureEnvelope = JSON.parse(String(init?.body));
      resolveCapture();
      return new Response('{}', { status: 202 });
    }
    if (url.endsWith('/v1/runtime/disconnect')) {
      disconnectEnvelope = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const publisher = await connectDevelopmentInspectionPublisher({
    async captureFrame() {
      return {
        mimeType: 'image/png' as const,
        canvasWidth: 1,
        canvasHeight: 1,
        dataBase64: 'iVBORw0KGgo=',
      };
    },
    reload() {
      assert.fail('capture action requested a reload');
    },
  });
  assert.ok(publisher);
  const input = {
    runtimeInstanceId: 'runtime-browser-actions-001',
    phase: 'ready' as const,
    frameCount: 2,
    framesPerSecond: 0,
    canvasWidth: 1,
    canvasHeight: 1,
    stats: {},
    error: null,
  };

  try {
    await publisher.publish(input);
    await Promise.race([
      captured,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Action poll timed out.')), 300)),
    ]);
    const sentCapture = captureEnvelope as unknown as Record<string, unknown>;
    assert.equal(sentCapture.developmentSessionId, 'development-actions-001');
    assert.equal(sentCapture.runtimeInstanceId, 'runtime-browser-actions-001');
    assert.equal((sentCapture.result as { dataBase64?: string }).dataBase64, 'iVBORw0KGgo=');
    await publisher.disconnect(input);
    const sentDisconnect = disconnectEnvelope as unknown as Record<string, unknown>;
    assert.equal(sentDisconnect.publicationSequence, 2);
  } finally {
    publisher.close();
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globals.window;
    else globals.window = originalWindow;
    if (originalInspectionOrigin === undefined) {
      delete process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN = originalInspectionOrigin;
    }
  }
});
