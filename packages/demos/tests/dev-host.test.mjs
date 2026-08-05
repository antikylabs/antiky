import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import {
  createDemoHostEnvironment,
  parseDemoHostOptions,
} from '../scripts/dev-options.mjs';

test('focused demo host options preserve the configured game viewport', () => {
  const options = parseDemoHostOptions([
    'town-study',
    '--host',
    '127.0.0.1',
    '--port',
    '43100',
    '--width',
    '960',
    '--height',
    '540',
  ]);

  assert.deepEqual(options, {
    slug: 'town-study',
    host: '127.0.0.1',
    port: 43100,
    width: 960,
    height: 540,
  });
  assert.throws(
    () => parseDemoHostOptions(['town-study', '--width', '0']),
    /width/i,
  );
  assert.throws(
    () => parseDemoHostOptions(['town-study', '--host', '0.0.0.0']),
    /127\.0\.0\.1/,
  );
});

test('focused demo host passes only explicit browser configuration to Vite', () => {
  const environment = createDemoHostEnvironment({
    slug: 'town-study',
    host: '127.0.0.1',
    port: 3010,
    width: 1280,
    height: 720,
  }, {
    PATH: '/bin',
    ANTIKY_INSPECTION_URL: 'http://127.0.0.1:3011',
  });

  assert.equal(environment.PATH, '/bin');
  assert.equal(environment.VITE_ANTIKY_DEMO_SLUG, 'town-study');
  assert.equal(environment.VITE_ANTIKY_GAME_WIDTH, '1280');
  assert.equal(environment.VITE_ANTIKY_GAME_HEIGHT, '720');
  assert.equal(environment.VITE_ANTIKY_INSPECTION_ORIGIN, 'http://127.0.0.1:3011');
});

test('focused demo host is a full-canvas game surface without website chrome', async () => {
  const [html, entry, styles, dispatcher, stage] = await Promise.all([
    readFile(new URL('../dev-host/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../dev-host/main.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../dev-host/style.css', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/dev.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/react/LiveDemoStage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(entry, /<DemoStage/);
  assert.match(entry, /autoStart/);
  assert.match(entry, /inspectionOrigin/);
  assert.doesNotMatch(entry, /SiteHeader|SiteFooter|DemoDeck/);
  assert.match(styles, /--antiky-game-width/);
  assert.match(styles, /--antiky-game-height/);
  assert.match(styles, /100dvh/);
  assert.match(styles, /safe-area-inset/);
  assert.doesNotMatch(dispatcher, /@antiky\/website|next dev/);
  assert.match(stage, /runtimeInstanceId: runtimeInstanceIdRef\.current/);
  assert.match(stage, /inspectPointLightService/);
  assert.match(stage, /submitPointLightPower/);
  assert.match(stage, /correctPointLightPower/);
});

test('focused demo host compiles its TSX entry with the package TypeScript config', async () => {
  const output = await mkdtemp(join(tmpdir(), 'antiky-demo-host-build-'));
  try {
    await build({
      root: fileURLToPath(new URL('../dev-host', import.meta.url)),
      logLevel: 'silent',
      build: { outDir: output, emptyOutDir: true },
    });
    await readFile(join(output, 'index.html'), 'utf8');
    for (const asset of [
      'town-material-atlas-v1.png',
      'town-prop-atlas-v2.png',
      'town-vegetation-atlas-v2.png',
    ]) {
      await readFile(join(output, 'textures', asset));
    }
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
