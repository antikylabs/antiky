import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import type { DevelopmentSnapshot } from '@antiky/cli/development';

import type { StudioDevelopmentState } from '../development/coordinator.ts';
import { StudioShell } from './StudioShell.tsx';

const shellStyles = [
  readFileSync(new URL('../styles.css', import.meta.url), 'utf8'),
  readFileSync(new URL('../responsive.css', import.meta.url), 'utf8'),
].join('\n');

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
    project: {
      name: 'Test project',
      manifestPath: '/project/test.antiky',
      projectRoot: '/project',
      revision: 'a'.repeat(64),
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

test('workspace follows the website game-first layout contract', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
    />,
  );

  const surfaceOrder = [...html.matchAll(/data-workspace-area="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(surfaceOrder, ['game', 'terminal', 'inspection', 'activity']);
  assert.match(
    shellStyles,
    /grid-template-areas:\s*"game inspection"\s*"terminal activity"/,
  );
  assert.match(
    shellStyles,
    /@media \(max-width: 760px\)[\s\S]*grid-template-areas:\s*"game"\s*"terminal"\s*"inspection"\s*"activity"/,
  );
  for (const area of surfaceOrder) {
    assert.match(shellStyles, new RegExp(`\\.${area}-panel\\s*\\{[^}]*grid-area:\\s*${area}`, 's'));
  }
});

test('native workspace shows the active project boundary and can open a replacement', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
      context={{ projectDirectory: '/projects/harbor', projectName: 'Harbor Lights' }}
      development={development}
      onOpenProject={() => undefined}
      platform="native"
      project={{
        manifestPath: '/projects/harbor/harbor-lights.antiky',
        projectRoot: '/projects/harbor',
        schemaVersion: 1,
      }}
      projectIssue={{
        code: 'ANTIKY_PROJECT_INVALID',
        message: 'The replacement manifest is not valid JSON. Harbor Lights remains active.',
      }}
    />,
  );

  assert.match(html, /<button[^>]*>Open project<\/button>/);
  assert.match(html, /Harbor Lights/);
  assert.match(html, /harbor-lights\.antiky/);
  assert.match(html, /Schema 1/);
  assert.match(html, /\/projects\/harbor/);
  assert.match(html, /role="alert"/);
  assert.match(html, /replacement manifest is not valid JSON/);
  assert.match(html, /Harbor Lights remains active/);
});

test('workspace chrome uses the compact website dimensions', () => {
  assert.match(
    shellStyles,
    /\.studio-shell\s*\{[^}]*grid-template-rows:\s*50px 44px minmax\(0, 1fr\) 30px/s,
  );
  assert.match(shellStyles, /\.panel-heading\s*\{[^}]*height:\s*36px/s);
  assert.match(shellStyles, /\.tabs\s*\{[^}]*min-height:\s*34px/s);
  assert.match(shellStyles, /\.control-actions button\s*\{[^}]*min-height:\s*28px/s);
  assert.doesNotMatch(shellStyles, /\.activity-panel \.panel-heading\s*\{[^}]*display:\s*none/s);
});

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
  assert.match(html, /allow="autoplay; fullscreen; gamepad; webgpu"/);
  assert.doesNotMatch(html, /contenteditable|Save changes|Edit component/i);
});

test('every connection shell keeps one complete and honestly labeled workspace', () => {
  const states: readonly StudioDevelopmentState[] = [
    {
      ...development,
      status: 'connecting',
      developmentSessionId: null,
      snapshot: null,
      mcpCallLog: null,
    },
    {
      ...development,
      status: 'connected',
      snapshot: {
        ...development.snapshot!,
        connection: { state: 'waiting' },
      },
    },
    {
      ...development,
      status: 'connected',
      snapshot: {
        ...development.snapshot!,
        connection: { state: 'unavailable' },
      },
      issue: { code: 'ANTIKY_RUNTIME_UNAVAILABLE', message: 'The runtime is unavailable.' },
    },
    {
      ...development,
      status: 'stale',
      issue: { code: 'ANTIKY_SESSION_UNAVAILABLE', message: 'The retained view is stale.' },
    },
    {
      ...development,
      status: 'disconnected',
      developmentSessionId: null,
      snapshot: null,
      mcpCallLog: null,
      issue: { code: 'ANTIKY_SESSION_UNAVAILABLE', message: 'No session is available.' },
    },
  ];

  for (const state of states) {
    const html = renderToStaticMarkup(
      <StudioShell
        actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
        context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
        development={state}
        platform="native"
      />,
    );
    const surfaceOrder = [...html.matchAll(/data-workspace-area="([^"]+)"/g)]
      .map((match) => match[1]);
    assert.deepEqual(surfaceOrder, ['game', 'terminal', 'inspection', 'activity']);
    for (const label of ['Live game', 'Terminal', 'Inspection', 'Activity']) {
      assert.equal((html.match(new RegExp(`aria-label="${label}"`, 'g')) ?? []).length, 1);
    }
    assert.equal((html.match(/<iframe/g) ?? []).length, state.status === 'connected' ? 1 : 0);
  }
});

test('keyboard order reaches controls, game, terminal, inspection, and activity', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
    />,
  );
  const orderedMarkers = [
    '>Resume</button>',
    '>Step</button>',
    'title="Live Antiky game"',
    'aria-label="Embedded native terminal"',
    'aria-label="Inspection views"',
    'aria-label="Activity views"',
  ];
  let previousIndex = -1;
  for (const marker of orderedMarkers) {
    const index = html.indexOf(marker);
    assert.ok(index > previousIndex, `${marker} must follow the prior keyboard surface`);
    previousIndex = index;
  }
});

test('the custom title bar remains a usable native window drag region', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={{ pause: async () => undefined, refresh: async () => undefined, resume: async () => undefined, step: async () => undefined }}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
    />,
  );

  assert.match(html, /<header class="titlebar" data-tauri-drag-region="true">/);
  assert.match(html, /class="studio-shell [^"]*platform-native/);
  assert.match(shellStyles, /\.titlebar\s*>\s*\*\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(shellStyles, /\.titlebar\s*\{[^}]*user-select:\s*none;/s);
  assert.match(
    shellStyles,
    /\.studio-shell\.platform-native \.titlebar\s*\{[^}]*padding-left:\s*78px/s,
  );
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
