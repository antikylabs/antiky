import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { displayError, NativeTerminal, terminalBoundsForRect } from './NativeTerminal.tsx';

const terminalStyles = readFileSync(new URL('./terminal.css', import.meta.url), 'utf8');
const terminalSource = readFileSync(new URL('./NativeTerminal.tsx', import.meta.url), 'utf8');

test('native terminal bounds preserve viewport CSS-pixel geometry', () => {
  assert.deepEqual(terminalBoundsForRect({
    left: 12.5,
    top: 81,
    width: 420,
    height: 640,
  }), {
    x: 12.5,
    y: 81,
    width: 420,
    height: 640,
  });
});

test('native terminal bounds reject unusable geometry before IPC', () => {
  assert.equal(terminalBoundsForRect({ left: 0, top: 0, width: 40, height: 640 }), null);
  assert.equal(terminalBoundsForRect({ left: Number.NaN, top: 0, width: 420, height: 640 }), null);
  assert.equal(terminalBoundsForRect({ left: 0, top: 0, width: 20_000, height: 640 }), null);
});

test('native terminal bounds stay clipped to the visible panel intersection', () => {
  assert.deepEqual(terminalBoundsForRect({
    left: -20,
    top: 10,
    width: 120,
    height: 80,
  }, { width: 300, height: 70 }), {
    x: 0,
    y: 10,
    width: 100,
    height: 60,
  });
  assert.equal(terminalBoundsForRect({
    left: 250,
    top: 10,
    width: 100,
    height: 80,
  }, { width: 300, height: 200 }), null);
  assert.equal(terminalBoundsForRect({
    left: 0,
    top: 220,
    width: 300,
    height: 80,
  }, { width: 300, height: 200 }), null);
});

test('native terminal is keyboard reachable with a visible focus boundary', () => {
  const html = renderToStaticMarkup(createElement(NativeTerminal));

  assert.match(html, /role="application"/);
  assert.match(html, /tabindex="0"/);
  assert.match(terminalStyles, /\.native-terminal-mount:focus-visible\s*\{[^}]*outline:/s);
});

test('native terminal resynchronizes after element, viewport, and scroll geometry changes', () => {
  assert.match(terminalSource, /new ResizeObserver\(scheduleSynchronization\)/);
  assert.match(terminalSource, /window\.addEventListener\('resize', scheduleSynchronization\)/);
  assert.match(terminalSource, /document\.addEventListener\('scroll', scheduleSynchronization, true\)/);
  assert.match(terminalSource, /visualViewport\?\.addEventListener\('resize', scheduleSynchronization\)/);
  assert.match(terminalSource, /visualViewport\?\.addEventListener\('scroll', scheduleSynchronization\)/);
});

test('native terminal uses one themed loading and error surface from the first frame', () => {
  const html = renderToStaticMarkup(createElement(NativeTerminal));

  assert.match(html, /role="status"/);
  assert.match(html, /Opening terminal/);
  assert.match(terminalSource, /role="alert"/);
  assert.match(terminalSource, /typeof reason === 'string'/);
  assert.match(
    terminalStyles,
    /\.native-terminal-state\s*\{[^}]*background:\s*#08090b/s,
  );
  assert.match(
    terminalStyles,
    /\.native-terminal-error\s*\{[^}]*color:\s*var\(--error\)/s,
  );
});

test('native terminal displays the stable serialized theme error without exposing diagnostics', () => {
  const message = 'The Antiky Studio terminal theme is missing or invalid.';

  assert.equal(displayError(message), message);
  assert.equal(displayError({ code: 'ANTIKY_TERMINAL_THEME_INVALID', message }), message);
  assert.equal(displayError({ code: 'ANTIKY_TERMINAL_THEME_INVALID' }), 'The native terminal could not be opened.');
  assert.equal(displayError(null), 'The native terminal could not be opened.');
});

test('native terminal teardown is reusable by preference reloads', () => {
  assert.match(terminalSource, /export function closeNativeTerminal\(\)/);
  assert.match(
    terminalSource,
    /return enqueueNativeCommand\(\(\) => invoke\('terminal_close'\)\)/,
  );
  assert.match(terminalSource, /if \(opened\) \{[\s\S]*void closeNativeTerminal\(\)/);
});
