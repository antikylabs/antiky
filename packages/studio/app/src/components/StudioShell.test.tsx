import assert from 'node:assert/strict';

import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import type { DevelopmentSnapshot } from '@antiky/cli/development';

import type { StudioDevelopmentState } from '../development/coordinator.ts';
import { StudioShell } from './StudioShell.tsx';

const ROOT_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const LIGHT_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';

const development: StudioDevelopmentState = {
  status: 'connected',
  developmentSessionId: 'development-studio-001',
  pendingControl: null,
  lastControlResult: null,
  issue: null,
  updateSequence: 1,
  snapshot: {
    schemaVersion: 1,
    developmentSessionId: 'development-studio-001',
    acceptedBuildRevision: 4,
    startedAt: '2026-08-05T12:00:00.000Z',
    config: {
      path: '/project/antiky.config.json',
      gameUrl: 'http://127.0.0.1:3010/demos/town-study',
      host: '127.0.0.1',
      gamePort: 3010,
      inspectionPort: 3011,
      viewport: { width: 1280, height: 720 },
    },
    processes: { game: { state: 'running' }, shaders: { state: 'running' } },
    connection: { state: 'connected' },
    cleanup: { state: 'active' },
    build: { owner: 'cli', revision: 4, changeKind: 'source', result: 'ready' },
    diagnostics: [],
    measurements: { owner: 'cli', launchMilliseconds: 10 },
    inspection: {
      schemaVersion: 1,
      runtime: { instanceId: 'runtime-studio-001', lifecycle: 'paused' },
      diagnostics: [],
      measurements: {
        runtime: { owner: 'framework', frameCount: 42, framesPerSecond: 60 },
        render: { owner: 'framework', drawCalls: 16, instances: 1247 },
      },
      session: {
        mode: 'paused',
        pauseReasons: ['tool'],
        clock: { completedStepCount: 42 },
      },
      world: {
        schemaVersion: 1,
        owner: 'framework',
        worldId: ROOT_ID,
        runtimeInstanceId: 'runtime-studio-001',
        revision: 2,
        incomplete: false,
        counts: {
          entities: { available: 2, retained: 2 },
          components: { available: 2, retained: 2 },
          relationships: { available: 1, retained: 1 },
          stores: { available: 1, retained: 1 },
        },
        entities: [
          { entityId: ROOT_ID, label: 'Town Root', revision: 1, components: [] },
          {
            entityId: LIGHT_ID,
            label: 'Harbor Lamp',
            revision: 2,
            components: [{
              typeId: 'PointLight',
              schemaVersion: 1,
              summary: 'Warm light · power 1.05',
              data: { power: 1.05 },
            }],
          },
        ],
        relationships: [{ type: 'ChildOf', childEntityId: LIGHT_ID, parentEntityId: ROOT_ID }],
        stores: [{
          storeId: 'point-light-authoring',
          label: 'Point-light authoring',
          kind: 'authoring',
          incomplete: false,
          counts: { available: 1, retained: 1 },
          entries: [{ key: LIGHT_ID, entityId: LIGHT_ID, data: { power: 1.05 } }],
        }],
      },
      events: {
        schemaVersion: 1,
        owner: 'framework',
        sourceId: 'point-lights',
        worldId: ROOT_ID,
        runtimeInstanceId: 'runtime-studio-001',
        incomplete: false,
        counts: { available: 1, retained: 1 },
        retention: {
          lifetime: 'runtime-instance',
          storage: 'memory',
          overflow: 'drop-oldest',
          capacity: 512,
          droppedCount: 0,
        },
        events: [{
          eventSchemaVersion: 1,
          type: 'PointLightPowerSet',
          sequence: 1,
          commandId: ROOT_ID,
          worldId: ROOT_ID,
          entityIds: [LIGHT_ID],
          revision: 2,
          occurredAt: '2026-08-05T12:00:01.000Z',
          data: { power: 1.05 },
        }],
      },
    },
  } as unknown as DevelopmentSnapshot,
  mcpCallLog: {
    schemaVersion: 1,
    developmentSessionId: 'development-studio-001',
    owner: 'cli',
    retention: {
      scope: 'development-session',
      capacity: 100,
      retainedCount: 1,
      droppedCount: 1,
      firstSequence: 2,
      lastSequence: 2,
    },
    calls: [{
      sequence: 2,
      callId: 'mcp-call-002',
      jsonRpcId: 7,
      receivedAt: '2026-08-05T12:00:02.000Z',
      durationMilliseconds: 4,
      toolName: 'set_point_light_power',
      arguments: { power: 1.05 },
      outcome: 'success',
      result: { accepted: true },
      correlationIds: { entityId: LIGHT_ID },
      redaction: { applied: true, paths: ['$.arguments.credential'] },
      truncation: { applied: false, paths: [] },
    }],
  },
};

test('connected Studio renders the live game and every semantic inspection surface', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
    />,
  );

  for (const value of [
    'antiky-town',
    'Town Root',
    'Harbor Lamp',
    'PointLight',
    'Point-light authoring',
    'PointLightPowerSet',
    'set_point_light_power',
    'runtime-instance',
    'Overflow drop-oldest',
    'development-session',
    'Range 2–2',
    'Dropped 1',
    'Received 2026-08-05T12:00:02.000Z',
    'Redacted',
  ]) assert.match(html, new RegExp(value));
  assert.match(html, /src="http:\/\/127\.0\.0\.1:3010\/demos\/town-study"/);
  assert.doesNotMatch(html, /contenteditable|Save changes|Edit component/i);
});

test('a lost session keeps retained inspection visibly stale and removes the live game', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={{
        ...development,
        status: 'stale',
        issue: { code: 'ANTIKY_SESSION_UNAVAILABLE', message: 'The host stopped.' },
      }}
      platform="native"
    />,
  );

  assert.match(html, /Connection lost · stale view/);
  assert.match(html, /Retained snapshot — not current/);
  assert.match(html, /Retained activity — not current/);
  assert.match(html, /Embedded native terminal/);
  assert.doesNotMatch(html, /<iframe/);
});

test('an unavailable runtime keeps its recovery frame but disables simulation controls', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={{
        ...development,
        snapshot: {
          ...development.snapshot!,
          connection: { state: 'unavailable' },
        },
      }}
      platform="native"
    />,
  );

  assert.match(html, /<iframe/);
  assert.equal((html.match(/<button disabled="" type="button">/g) ?? []).length, 3);
  assert.doesNotMatch(html, /<button type="button"><span class="control-icon"/);
});
