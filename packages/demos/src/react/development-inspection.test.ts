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
