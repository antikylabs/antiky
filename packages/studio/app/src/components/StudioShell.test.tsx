import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import type { DevelopmentSnapshotV2 } from '@antiky/cli/development';

import type { StudioDevelopmentState } from '../development/coordinator.ts';
import { StudioShell } from './StudioShell.tsx';

const shellStyles = [
  readFileSync(new URL('../styles.css', import.meta.url), 'utf8'),
  readFileSync(new URL('../responsive.css', import.meta.url), 'utf8'),
].join('\n');
const studioShellSource = readFileSync(new URL('./StudioShell.tsx', import.meta.url), 'utf8');
const gameFullscreenSource = readFileSync(new URL('./gameFullscreen.ts', import.meta.url), 'utf8');

const ROOT_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const LIGHT_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';

const development: StudioDevelopmentState = {
  status: 'connected',
  developmentSessionId: 'development-studio-001',
  pendingControl: null,
  lastControlResult: null,
  issue: null,
  updateSequence: 1,
  pendingLifecycle: null,
  snapshot: {
    schemaVersion: 2,
    developmentSessionId: 'development-studio-001',
    acceptedBuildRevision: 4,
    startedAt: '2026-08-05T12:00:00.000Z',
    project: {
      name: 'Test project',
      manifestPath: '/project/test.antiky',
      projectRoot: '/project',
      revision: 'a'.repeat(64),
      gameUrl: 'http://127.0.0.1:3010/demos/antiky-town',
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
    observation: {
      schemaVersion: 1,
      developmentSessionId: 'development-studio-001',
      acceptedBuildRevision: 4,
      runtimeInstanceId: 'runtime-studio-001',
      publicationSequence: 4,
      publishedAt: '2026-08-05T12:00:02.000Z',
      connectionState: 'connected',
      freshness: 'current',
      session: null,
      world: { worldId: ROOT_ID, revision: 2, eventSequence: 1 },
    },
  } as unknown as DevelopmentSnapshotV2,
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

const studioActions = {
  pause: async () => undefined,
  refresh: async () => undefined,
  restartGame: async () => undefined,
  resume: async () => undefined,
  step: async () => undefined,
  stopGame: async () => undefined,
};

test('workspace follows the website game-first layout contract', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
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

test('workspace panels expose bounded pointer and keyboard resize controls', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
    />,
  );

  assert.match(html, /role="separator"[^>]*aria-orientation="vertical"/);
  assert.match(html, /role="separator"[^>]*aria-orientation="horizontal"/);
  assert.equal((html.match(/aria-valuemin="25"/g) ?? []).length, 2);
  assert.match(html, /aria-label="Resize game and inspection panels"/);
  assert.match(html, /aria-label="Resize upper and lower panels"/);
  assert.match(shellStyles, /grid-template-columns:[^;]*--workspace-column-split/);
  assert.match(shellStyles, /grid-template-rows:[^;]*--workspace-row-split/);
  assert.match(shellStyles, /@media \(max-width: 760px\)[\s\S]*\.workspace-resizer\s*\{[^}]*display:\s*none/s);
});

test('native workspace names the active project without spending a row on manifest metadata', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
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
  assert.doesNotMatch(html, /harbor-lights\.antiky/);
  assert.doesNotMatch(html, /Schema 1/);
  assert.doesNotMatch(html, /Project root/);
  assert.doesNotMatch(html, /class="project-boundary"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /replacement manifest is not valid JSON/);
  assert.match(html, /Harbor Lights remains active/);
});

test('Settings overlays one still-mounted workspace instead of replacing its surfaces', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      page="settings"
      platform="native"
      project={{
        manifestPath: '/project/antiky-town.antiky',
        projectRoot: '/project',
        schemaVersion: 1,
      }}
    />,
  );

  for (const label of ['Live game', 'Terminal', 'Inspection', 'Activity']) {
    assert.equal((html.match(new RegExp(`aria-label="${label}"`, 'g')) ?? []).length, 1);
  }
  assert.match(html, /<iframe/);
  assert.match(html, /aria-label="Embedded native terminal"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /<h1[^>]*>Settings<\/h1>/);
  assert.ok(html.indexOf('data-workspace-area="game"') < html.indexOf('role="dialog"'));
});

test('workspace chrome uses the compact website dimensions', () => {
  assert.match(
    shellStyles,
    /\.studio-shell\s*\{[^}]*grid-template-rows:\s*50px minmax\(0, 1fr\) 30px/s,
  );
  assert.match(shellStyles, /\.panel-heading\s*\{[^}]*height:\s*36px/s);
  assert.match(shellStyles, /\.tabs\s*\{[^}]*min-height:\s*34px/s);
  assert.match(shellStyles, /\.control-actions button\s*\{[^}]*min-height:\s*28px/s);
  assert.doesNotMatch(shellStyles, /\.activity-panel \.panel-heading\s*\{[^}]*display:\s*none/s);
});

test('simulation controls share the title bar and status facts have one owner', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
      project={{
        manifestPath: '/project/antiky-town.antiky',
        projectRoot: '/project',
        schemaVersion: 1,
      }}
    />,
  );
  const titlebar = html.match(/<header class="titlebar"[\s\S]*?<\/header>/)?.[0] ?? '';
  const statusbar = html.match(/<footer class="statusbar">[\s\S]*?<\/footer>/)?.[0] ?? '';

  assert.match(titlebar, /aria-label="Simulation controls"/);
  assert.ok(
    titlebar.indexOf('aria-label="Simulation controls"') < titlebar.indexOf('class="project-context"'),
    'simulation controls must sit directly to the right of the logo',
  );
  assert.doesNotMatch(html, /class="controlbar"|class="session-summary"|class="state-chip"/);
  assert.doesNotMatch(html, /class="panel-state">connected</);
  assert.equal(
    (html.match(/>Connected</g) ?? []).length,
    1,
    'the footer must be the only owner of the connected label',
  );
  assert.doesNotMatch(
    titlebar,
    /class="connection-state"|Development host connected|Step 42|runtime-studio-001|>paused|>Connected</i,
  );
  assert.match(statusbar, />Connected</);
  assert.match(statusbar, />Step 42</);
  assert.match(statusbar, />Runtime runtime-studio-001</);
});

test('the footer status dot stays bounded inside its status item', () => {
  assert.match(shellStyles, /\.statusbar\s*>\s*span\s*\{[^}]*height:\s*100%/s);
  assert.match(
    shellStyles,
    /\.statusbar \.status-dot\s*\{[^}]*width:\s*6px[^}]*height:\s*6px[^}]*padding:\s*0[^}]*border:\s*0/s,
  );
  assert.doesNotMatch(shellStyles, /\.statusbar span\s*\{/);
});

test('connected Studio renders the live game and every semantic inspection surface', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
      project={{
        manifestPath: '/project/antiky-town.antiky',
        projectRoot: '/project',
        schemaVersion: 1,
      }}
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
  assert.match(html, /src="http:\/\/127\.0\.0\.1:3010\/demos\/antiky-town"/);
  assert.match(html, /allow="autoplay; fullscreen; gamepad; webgpu"/);
  assert.match(html, /<button[^>]*>Restart game<\/button>/);
  assert.match(html, /<button[^>]*>Stop game<\/button>/);
  assert.doesNotMatch(html, /contenteditable|Save changes|Edit component/i);
});

test('the live game can enter and leave fullscreen without unmounting its frame', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={development}
      platform="native"
    />,
  );

  assert.match(html, /<button[^>]*aria-label="Enter game fullscreen"/);
  assert.equal((html.match(/<iframe/g) ?? []).length, 1);
  assert.match(studioShellSource, /getCurrentWindow\(\)/);
  assert.match(studioShellSource, /changeGameFullscreen/);
  assert.match(gameFullscreenSource, /browserTarget\.requestFullscreen\(\)/);
  assert.match(gameFullscreenSource, /browserDocument\.exitFullscreen\(\)/);
  assert.match(gameFullscreenSource, /nativeWindow\.setFullscreen\(enabled\)/);
  assert.match(studioShellSource, /fullscreenchange/);
  assert.match(shellStyles, /\.game-stage:fullscreen\s*\{/);
  assert.match(shellStyles, /\.studio-shell\.game-fullscreen \.workspace\s*\{/);
});

test('a deliberately stopped game has one clear recovery action and no retained frame', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={{
        ...development,
        status: 'stopped',
        developmentSessionId: null,
        snapshot: null,
        mcpCallLog: null,
      }}
      platform="native"
      project={{
        manifestPath: '/project/antiky-town.antiky',
        projectRoot: '/project',
        schemaVersion: 1,
      }}
    />,
  );

  assert.match(html, /<footer class="statusbar">[\s\S]*>Stopped</);
  assert.match(html, /Game stopped\. Restart when you are ready\./);
  assert.match(html, /<button[^>]*>Restart game<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Stop game<\/button>/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, />Retry<\/button>/);
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
        actions={studioActions}
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
    assert.equal((html.match(/<iframe/g) ?? []).length, state.snapshot ? 1 : 0);
  }
});

test('native Studio reports its managed startup without asking for antiky dev', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
      context={{ projectDirectory: '/project', projectName: 'antiky-town' }}
      development={{
        ...development,
        status: 'disconnected',
        developmentSessionId: null,
        snapshot: null,
        mcpCallLog: null,
        issue: { code: 'ANTIKY_SESSION_UNAVAILABLE', message: 'The managed host could not start.' },
      }}
      platform="native"
    />,
  );

  assert.match(html, /Studio starts this project host automatically/i);
  assert.doesNotMatch(html, /antiky dev/i);
});

test('keyboard order reaches controls, game, terminal, inspection, and activity', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
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
      actions={studioActions}
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

test('a lost session keeps the live game mounted with the retained stale inspection', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
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
  assert.match(html, /<iframe/);
  assert.match(html, /Reconnecting/);
});

test('an unavailable runtime keeps its recovery frame but disables simulation controls', () => {
  const html = renderToStaticMarkup(
    <StudioShell
      actions={studioActions}
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
