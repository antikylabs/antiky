import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import {
  createProjectManager,
  type EditorProjectState,
} from './projectManager.ts';
import type {
  EditorHost,
  NativeProjectEvent,
  NativeProjectSource,
  ProjectActivationRequest,
  ProjectValidationRequest,
} from './types.ts';

const manifest = (name: string) => `${JSON.stringify({
  schemaVersion: 1,
  name,
  development: {
    command: ['node', 'game.mjs'],
    shaderCommand: ['node', 'shaders.mjs'],
    workingDirectory: '.',
    url: 'http://127.0.0.1:43100/',
    viewport: { width: 960, height: 540 },
  },
  network: { host: '127.0.0.1', gamePort: 43100, inspectionPort: 43101 },
  build: { command: ['npm', 'run', 'build'], workingDirectory: '.' },
}, null, 2)}\n`;

function source(selectionId: number, name: string, root: string): NativeProjectSource {
  return Object.freeze({
    schemaVersion: 1,
    selectionId,
    manifestPath: `${root}/${name.toLowerCase().replaceAll(' ', '-')}.antiky`,
    projectRoot: root,
    revision: String(selectionId).repeat(64).slice(0, 64),
    source: manifest(name),
  });
}

function fakeHost(initial: NativeProjectEvent | null = null, duplicateInitial = false) {
  let nextSelection: NativeProjectSource | null = null;
  let listener: ((event: NativeProjectEvent) => void) | null = null;
  const activations: ProjectActivationRequest[] = [];
  const host: EditorHost = {
    readInitialProjectEvent: async () => {
      if (duplicateInitial && initial) listener?.(initial);
      return initial;
    },
    selectProject: async () => nextSelection,
    listenProjectEvents: async (nextListener) => {
      listener = nextListener;
      return () => { listener = null; };
    },
    validateProject: async (request: ProjectValidationRequest) => Object.freeze({
      selectionId: request.selectionId,
      manifestPath: request.manifestPath,
      projectRoot: request.projectRoot,
      revision: request.revision,
      developmentWorkingDirectory: request.projectRoot,
      buildWorkingDirectory: request.projectRoot,
    }),
    activateProject: async (request) => { activations.push(request); },
  };
  return {
    activations,
    emit: (event: NativeProjectEvent) => listener?.(event),
    host,
    select: (next: NativeProjectSource | null) => { nextSelection = next; },
  };
}

test('project manager handles cold open, cancel, same-project reopen, invalid input, switch, and warm open', async () => {
  const harbor = source(1, 'Harbor Lights', '/projects/harbor');
  const forest = source(2, 'Forest Study', '/projects/forest');
  const native = fakeHost({ kind: 'opened', project: harbor });
  const states: EditorProjectState[] = [];
  let switchCount = 0;
  const manager = createProjectManager({
    host: native.host,
    beforeProjectSwitch: async () => { switchCount += 1; },
    onState: (state) => states.push(state),
  });

  await manager.start();
  assert.equal(manager.read().project?.name, 'Harbor Lights');
  assert.equal(native.activations.length, 1);
  assert.equal(switchCount, 0);

  native.select(null);
  await manager.openProject();
  assert.equal(manager.read().project?.name, 'Harbor Lights');
  assert.equal(native.activations.length, 1);

  native.select(source(3, 'Harbor Lights', '/projects/harbor'));
  await manager.openProject();
  assert.equal(manager.read().project?.manifestPath, harbor.manifestPath);
  assert.equal(switchCount, 1, 'a changed project revision clears stale development state');

  native.select(Object.freeze({ ...forest, selectionId: 4, source: '{ invalid json' }));
  await manager.openProject();
  assert.equal(manager.read().project?.name, 'Harbor Lights');
  assert.equal(manager.read().issue?.code, 'ANTIKY_PROJECT_INVALID');
  assert.equal(native.activations.length, 2);
  assert.equal(switchCount, 1);

  native.select(Object.freeze({ ...forest, selectionId: 5, revision: '5'.repeat(64) }));
  await manager.openProject();
  assert.equal(manager.read().project?.name, 'Forest Study');
  assert.equal(manager.read().issue, null);
  assert.equal(switchCount, 2);

  native.emit({
    kind: 'error',
    error: { code: 'ANTIKY_PROJECT_TOO_LARGE', message: 'Project manifest exceeds 65536 bytes.' },
  });
  await manager.settled();
  assert.equal(manager.read().project?.name, 'Forest Study');
  assert.equal(manager.read().issue?.code, 'ANTIKY_PROJECT_TOO_LARGE');

  native.emit({ kind: 'opened', project: source(6, 'Warm Project', '/projects/warm') });
  await manager.settled();
  assert.equal(manager.read().project?.name, 'Warm Project');
  assert.equal(switchCount, 3);
  assert.ok(states.length > 0);
  manager.stop();
});

test('Studio accepts the repository project manifest through the shared CLI parser', async () => {
  const sourceText = await readFile(
    new URL('../../../../../antiky-town.antiky', import.meta.url),
    'utf8',
  );
  const projectSource: NativeProjectSource = Object.freeze({
    schemaVersion: 1,
    selectionId: 21,
    manifestPath: '/projects/antiky/antiky-town.antiky',
    projectRoot: '/projects/antiky',
    revision: 'a'.repeat(64),
    source: sourceText,
  });
  const native = fakeHost({ kind: 'opened', project: projectSource });
  const manager = createProjectManager({ host: native.host });

  await manager.start();

  assert.equal(manager.read().project?.name, 'Antiky Town');
  assert.equal(manager.read().project?.manifestPath, projectSource.manifestPath);
  assert.equal(manager.read().project?.projectRoot, projectSource.projectRoot);
  assert.equal(Object.isFrozen(manager.read().project), true);
  manager.stop();
});

test('a cold-open event delivered through both native paths activates once', async () => {
  const harbor = source(31, 'Harbor Lights', '/projects/harbor');
  const native = fakeHost({ kind: 'opened', project: harbor }, true);
  const manager = createProjectManager({ host: native.host });

  await manager.start();
  await manager.settled();

  assert.equal(manager.read().project?.name, 'Harbor Lights');
  assert.equal(manager.read().issue, null);
  assert.equal(native.activations.length, 1);
  manager.stop();
});
