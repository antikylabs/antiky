import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  DEFAULT_WORKSPACE_SPLITS,
  resizeWorkspaceSplit,
  stepWorkspaceSplit,
} from '../../src/components/workspaceLayout.ts';

test('pointer resizing maps each separator to its workspace axis', () => {
  const bounds = { height: 500, left: 100, top: 50, width: 1000 };

  assert.equal(resizeWorkspaceSplit('column', 600, bounds), 50);
  assert.equal(resizeWorkspaceSplit('row', 300, bounds), 50);
});

test('pointer resizing keeps every panel within usable split limits', () => {
  const bounds = { height: 500, left: 100, top: 50, width: 1000 };

  assert.equal(resizeWorkspaceSplit('column', -100, bounds), 25);
  assert.equal(resizeWorkspaceSplit('column', 1200, bounds), 80);
  assert.equal(resizeWorkspaceSplit('row', -100, bounds), 25);
  assert.equal(resizeWorkspaceSplit('row', 700, bounds), 75);
});

test('keyboard resizing follows separator orientation and can reset the layout', () => {
  assert.equal(stepWorkspaceSplit('column', 60, 'ArrowLeft'), 58);
  assert.equal(stepWorkspaceSplit('column', 60, 'ArrowRight'), 62);
  assert.equal(stepWorkspaceSplit('column', 60, 'ArrowUp'), 60);
  assert.equal(stepWorkspaceSplit('row', 60, 'ArrowUp'), 58);
  assert.equal(stepWorkspaceSplit('row', 60, 'ArrowDown'), 62);
  assert.equal(stepWorkspaceSplit('row', 60, 'Home'), DEFAULT_WORKSPACE_SPLITS.row);
});
