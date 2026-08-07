import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { App, resolveInitialStudioPage, studioPageHref } from './App.tsx';
import { ProjectLauncher } from './components/ProjectLauncher.tsx';
import { createStudioInitialState } from './development/coordinator.ts';
import { developmentStateForProject } from './development/useStudioDevelopment.ts';

const launcherStyles = readFileSync(new URL('./launcher.css', import.meta.url), 'utf8');

test('browser Studio shell exposes the complete read-only workspace with an honest terminal state', () => {
  const html = renderToStaticMarkup(<App platform="browser" />);

  for (const label of [
    'Live game',
    'Terminal',
    'Hierarchy',
    'Stores',
    'Snapshot',
    'Events',
    'MCP calls',
    'Diagnostics',
  ]) assert.match(html, new RegExp(label));
  assert.match(html, /Native terminal unavailable/);
  assert.match(html, /Start .*antiky dev.* to connect/);
  assert.doesNotMatch(html, /contenteditable|Edit component|Save changes/i);
});

test('native Studio starts at the project launcher without opening a terminal', () => {
  const html = renderToStaticMarkup(<App platform="native" />);

  assert.match(html, /<h1[^>]*>Create a project<\/h1>/);
  assert.match(html, /<label[^>]*for="project-name"[^>]*>Project name<\/label>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Create project<\/button>/);
  assert.match(html, /<h2[^>]*>Recent projects<\/h2>/);
  assert.match(html, /No recent projects yet/);
  assert.match(html, /<button[^>]*>Open project<\/button>/);
  assert.doesNotMatch(html, /Project boundary steps|validates the manifest|project root/i);
  assert.doesNotMatch(html, /Embedded native terminal/);
  assert.match(
    launcherStyles,
    /\.project-launcher \.titlebar\s*\{[^}]*padding-left:\s*78px/s,
  );
  assert.match(
    launcherStyles,
    /\.launcher-card h1\s*\{[^}]*font-size:\s*clamp\(30px, 4vw, 42px\)[^}]*white-space:\s*nowrap/s,
  );
});

test('project launcher shows past projects with missing entries kept visible', () => {
  const html = renderToStaticMarkup(
    <ProjectLauncher
      creating={false}
      issue={null}
      loadingRecentProjects={false}
      onCreateProject={() => undefined}
      onOpenProject={() => undefined}
      onOpenRecentProject={() => undefined}
      onOpenSettings={() => undefined}
      opening={false}
      recentProjects={[
        {
          available: true,
          lastOpenedAt: 1_786_089_600_000,
          manifestPath: '/projects/harbor/harbor.antiky',
          projectRoot: '/projects/harbor',
        },
        {
          available: false,
          lastOpenedAt: 1_786_003_200_000,
          manifestPath: '/projects/moved/forest-study.antiky',
          projectRoot: '/projects/moved',
        },
      ]}
    />,
  );

  assert.match(html, />Harbor<\/span>/);
  assert.match(html, /\/projects\/harbor/);
  assert.match(html, />Forest Study<\/span>/);
  assert.match(html, /Project file is missing/);
  assert.match(html, /aria-disabled="true"/);
});

test('native Studio has a Settings page that explains and controls the online presence signal', () => {
  const html = renderToStaticMarkup(
    <App initialPage="settings" platform="native" sspsPresenceEnabled />,
  );

  assert.match(html, /<h1[^>]*>Settings<\/h1>/);
  assert.match(html, /Online presence signal/);
  assert.match(html, /only the signal needed to count this Studio instance as online/i);
  assert.match(html, /does not send project names, commands, activity, or usage information/i);
  assert.match(html, /active-user count on the Antiky website/i);
  assert.match(html, /role="switch"/);
  assert.match(html, /aria-checked="true"/);
  assert.match(html, />On<\/span>/);
  assert.match(html, /<h1[^>]*>Create a project<\/h1>/);
  assert.match(html, /<button[^>]*>Workspace<\/button>/);
  assert.doesNotMatch(html, /aria-label="Live game"/);
});

test('Studio page routing keeps Settings reload-safe without pinning later workspace launches', () => {
  assert.equal(resolveInitialStudioPage('native', '#settings'), 'settings');
  assert.equal(resolveInitialStudioPage('native', ''), 'workspace');
  assert.equal(resolveInitialStudioPage('browser', '#settings'), 'workspace');

  const location = { pathname: '/studio', search: '?project=demo' };
  assert.equal(studioPageHref(location, 'settings'), '/studio?project=demo#settings');
  assert.equal(studioPageHref(location, 'workspace'), '/studio?project=demo');
});

test('a newly selected project starts visibly connecting instead of flashing disconnected', () => {
  const state = developmentStateForProject(
    null,
    '/project/harbor.antiky:revision-1',
    createStudioInitialState(),
  );

  assert.equal(state.status, 'connecting');
  assert.equal(state.snapshot, null);
});
