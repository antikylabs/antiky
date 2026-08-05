import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommandId, parseEntityId, parseWorldId } from '@antiky/framework';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { connectDevelopmentInspectionPublisher } from './development-inspection.ts';

const inspectionOrigin = 'http://127.0.0.1:3011';
const gameOrigin = 'http://127.0.0.1:3010';

test('browser publications cannot overtake an earlier snapshot', async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originalWindow = globals.window;
  const originalFetch = globalThis.fetch;
  globals.window = { location: { origin: gameOrigin } };

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

  const publisher = await connectDevelopmentInspectionPublisher(inspectionOrigin);
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
  }
});

test('browser action polling captures a frame and disconnects with the next sequence', async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originalWindow = globals.window;
  const originalFetch = globalThis.fetch;
  globals.window = { location: { origin: gameOrigin } };
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

  const publisher = await connectDevelopmentInspectionPublisher(inspectionOrigin, {
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
  }
});

test('browser action polling relays point-light commands and their exact framework results', async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originalWindow = globals.window;
  const originalFetch = globalThis.fetch;
  globals.window = { location: { origin: gameOrigin } };
  const worldId = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');
  const entityId = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abd');
  const commandId = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac0');
  const correctionId = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac1');
  const context = {
    principalId: 'antiky-local-development',
    permissions: ['world.light.edit'],
    receivedAt: '2026-08-05T03:00:00.000Z',
    runtimeInstanceId: 'runtime-browser-lights-001',
  } as const;
  const actions = [
    {
      schemaVersion: 1,
      actionId: 'action-set-light-001',
      kind: 'set-point-light-power',
      developmentSessionId: 'development-light-actions-001',
      runtimeInstanceId: 'runtime-browser-lights-001',
      buildRevision: 4,
      command: {
        protocolVersion: 1,
        commandVersion: 1,
        type: 'antiky.authoring.set-point-light-power',
        commandId,
        worldId,
        entityId,
        expectedRevision: 1,
        data: { power: 2 },
      },
      context,
    },
    {
      schemaVersion: 1,
      actionId: 'action-correct-light-001',
      kind: 'correct-point-light-power',
      developmentSessionId: 'development-light-actions-001',
      runtimeInstanceId: 'runtime-browser-lights-001',
      buildRevision: 4,
      request: {
        protocolVersion: 1,
        commandVersion: 1,
        commandId: correctionId,
        correctedCommandId: commandId,
        expectedRevision: 2,
      },
      context,
    },
  ] as const;
  const resultEnvelopes: Array<Record<string, unknown>> = [];
  let resolveResults!: () => void;
  const resultsPublished = new Promise<void>((resolve) => { resolveResults = resolve; });

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.endsWith('/v1/browser/bootstrap')) {
      return new Response(JSON.stringify({
        schemaVersion: 1,
        developmentSessionId: 'development-light-actions-001',
        gameUrl: `${gameOrigin}/game`,
        credential: 'c'.repeat(43),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith('/v1/runtime/snapshot')) return new Response('{}', { status: 202 });
    if (url.includes('/v1/runtime/action?')) {
      const action = actions[resultEnvelopes.length];
      return action
        ? new Response(JSON.stringify(action), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
        : new Response(null, { status: 204 });
    }
    if (url.endsWith('/v1/runtime/action-result')) {
      resultEnvelopes.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (resultEnvelopes.length === 2) resolveResults();
      return new Response('{}', { status: 202 });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const publisher = await connectDevelopmentInspectionPublisher(inspectionOrigin, {
    reload() {
      assert.fail('point-light action requested a reload');
    },
    async captureFrame() {
      throw new Error('point-light action requested a frame capture');
    },
    setPointLightPower(command, trustedContext) {
      assert.deepEqual(command, actions[0].command);
      assert.deepEqual(trustedContext, context);
      return {
        schemaVersion: 1,
        code: 'ACCEPTED',
        accepted: true,
        commandId,
        worldId,
        entityId,
        currentRevision: 1,
        resultingRevision: 2,
        eventSequence: 1,
        runtimeInstanceId: context.runtimeInstanceId,
        fact: {
          schemaVersion: 1,
          type: 'antiky.authoring.point-light-power-set',
          eventSequence: 1,
          sourceCommandId: commandId,
          worldId,
          entityId,
          oldPower: 1.05,
          newPower: 2,
          resultingRevision: 2,
          receivedAt: context.receivedAt,
        },
      };
    },
    correctPointLightPower(request, trustedContext) {
      assert.deepEqual(request, actions[1].request);
      assert.deepEqual(trustedContext, context);
      return {
        schemaVersion: 1,
        code: 'ACCEPTED',
        accepted: true,
        commandId: correctionId,
        worldId,
        entityId,
        currentRevision: 2,
        resultingRevision: 3,
        eventSequence: 2,
        runtimeInstanceId: context.runtimeInstanceId,
        fact: {
          schemaVersion: 1,
          type: 'antiky.authoring.point-light-power-set',
          eventSequence: 2,
          sourceCommandId: correctionId,
          worldId,
          entityId,
          oldPower: 2,
          newPower: 1.05,
          resultingRevision: 3,
          receivedAt: context.receivedAt,
          correctionOf: commandId,
        },
      };
    },
  });
  assert.ok(publisher);

  try {
    await publisher.publish({
      runtimeInstanceId: context.runtimeInstanceId,
      phase: 'ready',
      frameCount: 2,
      framesPerSecond: 0,
      canvasWidth: 1,
      canvasHeight: 1,
      stats: {},
      error: null,
    });
    await Promise.race([
      resultsPublished,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Action poll timed out.')), 500)),
    ]);
    assert.deepEqual(resultEnvelopes.map((envelope) => (
      (envelope.result as { commandResult: { commandId: string } }).commandResult.commandId
    )), [commandId, correctionId]);
    for (const envelope of resultEnvelopes) {
      assert.equal((envelope.result as { kind?: string }).kind, 'point-light-command');
      assert.doesNotMatch(JSON.stringify(envelope.result), /permission|principal/);
    }
  } finally {
    publisher.close();
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globals.window;
    else globals.window = originalWindow;
  }
});

test('ordinary game hosts do not connect without an explicit inspection origin', async () => {
  assert.equal(await connectDevelopmentInspectionPublisher(), null);
});
