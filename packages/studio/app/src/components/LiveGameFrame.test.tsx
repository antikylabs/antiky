import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { LiveGameFrame } from './LiveGameFrame.tsx';

const source = readFileSync(new URL('./LiveGameFrame.tsx', import.meta.url), 'utf8');

test('the live game frame has one stable mount for a development session', () => {
  const html = renderToStaticMarkup(
    <LiveGameFrame
      developmentSessionId="development-001"
      gameUrl="http://127.0.0.1:3010"
    />,
  );

  assert.equal((html.match(/<iframe/g) ?? []).length, 1);
  assert.match(html, /src="http:\/\/127\.0\.0\.1:3010"/);
  assert.doesNotMatch(source, /setTimeout|useEffect|useState|attempt/);
});
