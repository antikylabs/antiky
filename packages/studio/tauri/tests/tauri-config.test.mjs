import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const appDirectory = resolve(packageDirectory, '../app');
const terminalThemePath = resolve(
  packageDirectory,
  'resources/terminal/antiky-studio.ghostty',
);

const TERMINAL_THEME_KEYS = new Set([
  'background',
  'foreground',
  'cursor-color',
  'cursor-text',
  'selection-background',
  'selection-foreground',
  'palette',
]);

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
    'core:event:allow-listen',
    'core:event:allow-unlisten',
    'allow-project-initial-event',
    'allow-project-select',
    'allow-project-create',
    'allow-project-recents',
    'allow-project-open-recent',
    'allow-project-validate',
    'allow-project-activate',
    'allow-development-start',
    'allow-development-stop',
    'allow-discover-development-connection',
    'allow-terminal-open',
    'allow-terminal-layout',
    'allow-terminal-focus',
    'allow-terminal-close',
    'allow-terminal-status',
  ]);
});

test('the local macOS app bundle owns the named Antiky project association', async () => {
  const config = JSON.parse(await readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8'));

  assert.equal(config.bundle.active, true);
  assert.deepEqual(config.bundle.targets, ['app']);
  assert.deepEqual(config.bundle.fileAssociations, [{
    ext: ['antiky'],
    name: 'Antiky Project',
    description: 'Antiky project manifest',
    mimeType: 'application/x-antiky-project',
    role: 'Editor',
    rank: 'Owner',
    exportedType: {
      identifier: 'dev.antiky.project',
      conformsTo: ['public.json', 'public.data'],
    },
  }]);
});

test('project state exists before macOS can deliver a cold Finder open event', async () => {
  const source = await readFile(resolve(packageDirectory, 'src/lib.rs'), 'utf8');
  const stateRegistration = source.indexOf('.manage(StudioState');
  const setup = source.indexOf('.setup(|app|');

  assert.notEqual(stateRegistration, -1, 'Studio state must be registered on the builder');
  assert.ok(
    stateRegistration < setup,
    'Finder can deliver RunEvent::Opened before the setup callback initializes resources',
  );
});

test('the native project picker accepts one file and restricts selection to .antiky', async () => {
  const picker = await readFile(resolve(packageDirectory, 'src/native/project_picker.m'), 'utf8');

  assert.match(picker, /setCanChooseFiles:YES/);
  assert.match(picker, /setCanChooseDirectories:NO/);
  assert.match(picker, /setAllowsMultipleSelection:NO/);
  assert.match(picker, /setAllowedFileTypes:@\[@"antiky"\]/);
  assert.match(picker, /NSModalResponseOK/);
  assert.match(picker, /antiky_project_picker_directory/);
  assert.match(picker, /setCanChooseDirectories:YES/);
  assert.match(picker, /setCanCreateDirectories:YES/);
  assert.match(picker, /setPrompt:@"Create project"/);
});

test('the Tauri File menu owns project-open and recent-project entries', async () => {
  const [build, app, menu] = await Promise.all([
    readFile(resolve(packageDirectory, 'build.rs'), 'utf8'),
    readFile(resolve(packageDirectory, 'src/lib.rs'), 'utf8'),
    readFile(resolve(packageDirectory, 'src/studio_menu.rs'), 'utf8'),
  ]);

  assert.doesNotMatch(build, /studio_menu\.m/);
  assert.match(app, /\.menu\(studio_menu::build\)/);
  assert.match(app, /\.on_menu_event\(studio_menu::handle_event\)/);
  assert.match(menu, /Menu::default/);
  assert.match(menu, /OPEN_PROJECT_MENU_ID/);
  assert.match(menu, /RECENT_PROJECTS_MENU_ID/);
  assert.match(menu, /MenuItem::with_id/);
  assert.match(menu, /Submenu::with_id_and_items/);
  assert.match(menu, /PredefinedMenuItem::separator/);
  assert.match(menu, /refresh_recent_projects/);
  assert.doesNotMatch(menu, /extern "C"/);
});

test('the main window can reach the website narrow-layout breakpoint', async () => {
  const config = JSON.parse(await readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8'));
  const [mainWindow] = config.app.windows;

  assert.ok(mainWindow.minWidth <= 760);
  assert.ok(mainWindow.width > mainWindow.minWidth);
});

test('the native window and bootstrap document avoid an unthemed startup frame', async () => {
  const config = JSON.parse(await readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8'));
  const index = await readFile(resolve(appDirectory, 'index.html'), 'utf8');
  const [mainWindow] = config.app.windows;

  assert.equal(mainWindow.backgroundColor, '#08090b');
  assert.match(
    index,
    /<style>html, body, #root \{ background: #08090b; \}<\/style>/,
  );
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

test('the Studio terminal theme is a complete visual-only Ghostty profile', async () => {
  const profile = await readFile(terminalThemePath, 'utf8');
  const config = JSON.parse(await readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8'));
  const entries = profile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      assert.notEqual(separator, -1, `theme line must contain =: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    });

  assert.ok(Buffer.byteLength(profile) <= 4096, 'the profile must stay bounded');
  assert.deepEqual(
    new Set(entries.map(([key]) => key)),
    TERMINAL_THEME_KEYS,
    'the profile must contain only the approved visual key families',
  );

  const paletteIndexes = entries
    .filter(([key]) => key === 'palette')
    .map(([, value]) => Number.parseInt(value.slice(0, value.indexOf('=')), 10));
  assert.deepEqual(paletteIndexes, Array.from({ length: 16 }, (_, index) => index));
  assert.doesNotMatch(profile, /(?:command|input|keybind|font-family|working-directory|config-file)\s*=/);
  assert.deepEqual(config.bundle.resources, {
    'resources/node': 'project-service/node',
    'resources/node_modules/playwright': 'project-service/node_modules/playwright',
    'resources/node_modules/playwright-core': 'project-service/node_modules/playwright-core',
    'resources/project-service.mjs': 'project-service/project-service.mjs',
    'resources/terminal/antiky-studio.ghostty': 'terminal/antiky-studio.ghostty',
    'resources/terminal/antiky-studio.zshrc': 'terminal/.zshrc',
  });
});

test('Studio packages a project-service worker instead of an antiky dev command adapter', async () => {
  const [config, source, worker] = await Promise.all([
    readFile(resolve(packageDirectory, 'tauri.conf.json'), 'utf8').then(JSON.parse),
    readFile(resolve(packageDirectory, 'src/development.rs'), 'utf8'),
    readFile(resolve(packageDirectory, 'resources/project-service.mjs'), 'utf8'),
  ]);

  assert.equal(
    config.bundle.resources['resources/project-service.mjs'],
    'project-service/project-service.mjs',
  );
  assert.equal(config.bundle.resources['resources/node'], 'project-service/node');
  await access(resolve(packageDirectory, 'resources/node'));
  await access(resolve(packageDirectory, 'resources/node_modules/playwright/package.json'));
  await access(resolve(packageDirectory, 'resources/node_modules/playwright-core/package.json'));
  await access(resolve(packageDirectory, 'resources/project-service.mjs'));
  assert.doesNotMatch(source, /antiky\s+dev|Command::new\([^)]*antiky/);
  assert.doesNotMatch(source, /Command::new\("node"\)/);
  assert.match(source, /project-service\.mjs/);
  assert.match(worker, /STUDIO_PORT_RANGE_START = 7e3/);
  assert.match(worker, /STUDIO_PORT_RANGE_END = 7999/);
  assert.match(worker, /portAllocation: "studio-dynamic"/);
});

test('the packaged runtime can execute the bundled project-service worker', async () => {
  const runtime = resolve(packageDirectory, 'resources/node');
  const worker = resolve(packageDirectory, 'resources/project-service.mjs');
  const child = spawn(runtime, [worker], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = await new Promise((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });

  assert.deepEqual(exit, { code: 1, signal: null }, stderr);
  assert.deepEqual(JSON.parse(stdout), {
    type: 'error',
    error: {
      code: 'ANTIKY_ARGUMENT_INVALID',
      message: 'The Studio project service needs one project manifest path.',
    },
  });
});

test('the bundled project service can initialize a Studio project', async () => {
  const runtime = resolve(packageDirectory, 'resources/node');
  const worker = resolve(packageDirectory, 'resources/project-service.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'antiky-studio-create-'));
  try {
    const child = spawn(
      runtime,
      [worker, '--initialize', directory, 'Harbor Lights'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const exit = await new Promise((resolveExit) => {
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    });

    assert.deepEqual(exit, { code: 0, signal: null }, stderr);
    const message = JSON.parse(stdout);
    assert.deepEqual(message, {
      type: 'initialized',
      manifestPath: join(await realpath(directory), 'harbor-lights.antiky'),
    });
    const manifest = JSON.parse(await readFile(message.manifestPath, 'utf8'));
    assert.equal(manifest.name, 'Harbor Lights');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
