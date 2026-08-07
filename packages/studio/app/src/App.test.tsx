import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { App, resolveInitialStudioPage, studioPageHref } from './App.tsx';

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

  assert.match(html, /<h1[^>]*>Open a project<\/h1>/);
  assert.match(html, /Choose an? <code>\.antiky<\/code> file\./);
  assert.match(html, /<button[^>]*>Choose file<\/button>/);
  assert.doesNotMatch(html, /Project boundary steps|validates the manifest|project root/i);
  assert.doesNotMatch(html, /Embedded native terminal/);
  assert.match(
    launcherStyles,
    /\.project-launcher \.titlebar\s*\{[^}]*padding-left:\s*78px/s,
  );
  assert.match(
    launcherStyles,
    /\.launcher-copy h1\s*\{[^}]*font-size:\s*clamp\(30px, 4vw, 42px\)[^}]*white-space:\s*nowrap/s,
  );
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
