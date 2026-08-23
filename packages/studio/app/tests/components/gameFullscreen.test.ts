import assert from 'node:assert/strict';

import { test } from 'vitest';

import { changeGameFullscreen } from '../../src/components/gameFullscreen.ts';

test('native fullscreen uses the Tauri window when the webview has no fullscreen API', async () => {
  const windowChanges: boolean[] = [];
  const webviewTarget = {
    requestFullscreen: async () => {
      throw new TypeError('requestFullscreen is not available in the native webview');
    },
  };

  await changeGameFullscreen({
    browserDocument: {},
    browserTarget: webviewTarget,
    enabled: true,
    nativeWindow: {
      setFullscreen: async (enabled) => { windowChanges.push(enabled); },
    },
    platform: 'native',
  });

  assert.deepEqual(windowChanges, [true]);
});

test('browser fullscreen still uses the element and document APIs', async () => {
  const changes: string[] = [];
  const common = {
    browserDocument: {
      exitFullscreen: async () => { changes.push('exit'); },
    },
    browserTarget: {
      requestFullscreen: async () => { changes.push('enter'); },
    },
    platform: 'browser' as const,
  };

  await changeGameFullscreen({ ...common, enabled: true });
  await changeGameFullscreen({ ...common, enabled: false });

  assert.deepEqual(changes, ['enter', 'exit']);
});
