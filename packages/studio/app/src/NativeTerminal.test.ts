import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { NativeTerminal, terminalBoundsForRect } from './NativeTerminal.tsx';

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
