import assert from 'node:assert/strict';

import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { App } from './App.tsx';

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

test('native Studio shell mounts the embedded terminal surface', () => {
  const html = renderToStaticMarkup(<App platform="native" />);

  assert.match(html, /Embedded native terminal/);
  assert.doesNotMatch(html, /Terminal is ready to open/);
});
