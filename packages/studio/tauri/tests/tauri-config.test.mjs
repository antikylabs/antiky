import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const appDirectory = resolve(packageDirectory, '../app');

test('Tauri uses the existing Antiky brand mark as its native icon', async () => {
  const config = JSON.parse(await readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8'));
  assert.deepEqual(config.bundle.icon, [
    '../../website/public/brand/antiky-labs-wordmark-white.png',
  ]);
  await access(resolve(packageDirectory, config.bundle.icon[0]));
});

test('the main window can invoke only the bounded Studio command surface', async () => {
  const capability = JSON.parse(await readFile(
    resolve(packageDirectory, 'capabilities/main.json'),
    'utf8',
  ));
  assert.deepEqual(capability.permissions, [
    'allow-studio-context',
    'allow-discover-development-connection',
    'allow-terminal-open',
    'allow-terminal-layout',
    'allow-terminal-focus',
    'allow-terminal-close',
    'allow-terminal-status',
  ]);
});

test('the main window can reach the website narrow-layout breakpoint', async () => {
  const config = JSON.parse(await readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8'));
  const [mainWindow] = config.app.windows;

  assert.ok(mainWindow.minWidth <= 760);
  assert.ok(mainWindow.width > mainWindow.minWidth);
});

test('the launched desktop app can opt out of the bounded SSPS integration before it loads', async () => {
  const index = await readFile(resolve(appDirectory, 'index.html'), 'utf8');
  const config = JSON.parse(await readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8'));

  assert.doesNotMatch(
    index,
    /<script async src="https:\/\/usessps\.com\/ssps\.js" data-site-id="268"><\/script>/,
    'the desktop HTML must not load SSPS before the saved preference is read',
  );
  assert.match(
    config.app.security.csp,
    /(?:^|; )script-src 'self' https:\/\/usessps\.com(?:;|$)/,
    'the CSP must allow only the SSPS script origin in addition to local scripts',
  );
  assert.match(
    config.app.security.csp,
    /(?:^|; )connect-src [^;]*\bwss:\/\/usessps\.com\b[^;]*(?:;|$)/,
    'the CSP must allow the SSPS presence WebSocket',
  );
});
