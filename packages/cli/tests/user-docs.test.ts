import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const userDocsRoot = new URL('../../../docs/user-facing-docs/', import.meta.url);
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runFile = promisify(execFile);

async function markdownFiles(directory: URL): Promise<URL[]> {
  const files: URL[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await markdownFiles(url));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(url);
  }
  return files;
}

async function verifyLocalLinks(path: URL, source: string): Promise<void> {
  const links = Array.from(source.matchAll(/\[[^\]]+]\(([^)]+)\)/g), (match) => match[1]!);
  for (const link of links) {
    if (/^(?:https?:|mailto:|#)/.test(link)) continue;
    const target = link.split('#', 1)[0]!;
    await access(resolve(dirname(fileURLToPath(path)), target));
  }
}

test('user-facing documentation has valid local links', async () => {
  await Promise.all((await markdownFiles(userDocsRoot)).map(async (path) => {
    await verifyLocalLinks(path, await readFile(path, 'utf8'));
  }));
});

test('the generated framework API reference covers every public area and is current', async () => {
  await runFile(process.execPath, [
    resolve(repositoryRoot, 'packages/framework/scripts/generate-api-reference.mjs'),
    '--check',
  ], { cwd: repositoryRoot });

  const pages = await Promise.all([
    'reference.md',
    'identity.md',
    'engine-session.md',
    'inspection.md',
    'point-light-core.md',
    'point-light-commands.md',
    'point-light-integration.md',
    'game-host.md',
  ].map((name) => readFile(new URL(`api/${name}`, userDocsRoot), 'utf8')));

  assert.match(pages[0]!, /import \{ createEngineSession \} from '@antiky\/framework'/);
  assert.match(pages[0]!, /Choose an API area/);
  assert.match(pages[1]!, /### `createWorldId`/);
  assert.match(pages[2]!, /### `EngineSession`/);
  assert.match(pages[3]!, /### `createInspectionSnapshot`/);
  assert.match(pages[4]!, /### `createPointLightAuthoringService`/);
  assert.match(pages[5]!, /### `parseSetPointLightPowerCommand`/);
  assert.match(pages[6]!, /### `inspectPointLightWorld`/);
  assert.match(pages[7]!, /Import every API on this page from `@antiky\/framework\/game`/);
  assert.match(pages[7]!, /### `GameHostContext`/);
  assert.match(pages[7]!, /### `GameModuleEntry`/);
  assert.match(pages[7]!, /### `createGameInspectionSnapshot`/);
  assert.match(pages[1]!, /`savedWorldId` is an unknown value read from persisted game data/);
  assert.match(pages[5]!, /`untrustedCommand` comes from a file, tool, or request boundary/);
  assert.match(pages[6]!, /`rendererLights` is your renderer adapter/);
});

test('the Studio guide describes the game-first responsive workspace', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/studio/getting-started.md', import.meta.url), 'utf8');

  assert.match(source, /live game in the larger upper-left area/i);
  assert.match(source, /terminal is below the game/i);
  assert.match(source, /stack in this order:\s*Live game,\s*Terminal,\s*Inspection,\s*Activity/i);
  assert.match(source, /Studio starts the project service automatically/i);
  assert.match(source, /Settings.*over.*workspace.*does not (?:reload|restart)/is);
  assert.doesNotMatch(source, /Run `antiky dev` in the embedded terminal/i);
});

test('the Studio guide explains the optional online presence signal', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/studio/getting-started.md', import.meta.url), 'utf8');

  assert.match(source, /Settings.*Online presence signal/is);
  assert.match(source, /does not send\s+project names, commands, activity, or usage information/i);
  assert.match(source, /active-user count on the Antiky website/i);
});

test('the Studio guide explains game lifecycle and single-step controls', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/studio/getting-started.md', import.meta.url), 'utf8');

  assert.match(source, /\*\*Restart game\*\*.*reloads.*current game runtime/is);
  assert.match(source, /after.*\*\*Stop game\*\*.*fresh managed project service/is);
  assert.match(source, /\*\*Stop game\*\*.*terminal.*available/is);
  assert.match(source, /\*\*Step\*\*.*exactly one.*presented frame/is);
});

test('the Studio guide explains opening and switching one validated Antiky project', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/studio/getting-started.md', import.meta.url), 'utf8');

  assert.match(source, /<name>\.antiky/);
  assert.match(source, /antiky init/);
  assert.match(source, /Open project/i);
  assert.match(source, /Create project/i);
  assert.match(source, /Recent projects/i);
  assert.doesNotMatch(source, /project name, manifest path,\s*schema version, and project root/i);
  assert.match(source, /invalid.*current workspace.*unchanged/is);
  assert.match(source, /antiky migrate --name "Harbor Lights" --output harbor-lights\.antiky/);
});

test('the Studio connection guide explains the isolated loopback game host', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/studio/development-connection.md', import.meta.url), 'utf8');

  assert.match(source, /loopback game host/i);
  assert.match(source, /isolated iframe/i);
  assert.match(source, /127\.0\.0\.1.*not.*public/is);
  assert.match(source, /same.*game host.*`antiky dev`/is);
});

test('the dedicated Projects guide documents the public project workflow', async () => {
  const [source, index] = await Promise.all([
    readFile(new URL('../../../docs/user-facing-docs/studio/projects.md', import.meta.url), 'utf8'),
    readFile(new URL('../../../docs/user-facing-docs/README.md', import.meta.url), 'utf8'),
  ]);

  assert.match(index, /\[Create and open an Antiky project\]\(studio\/projects\.md\)/);
  assert.match(source, /^# Antiky projects$/m);
  assert.match(source, /<name>\.antiky/);
  assert.match(source, /antiky init "Harbor Lights" --directory path\/to\/harbor-lights/);
  assert.match(source, /does not install dependencies, run scripts, or\s+create source files/i);
  assert.match(source, /does not overwrite/i);
  assert.match(source, /"schemaVersion": 1/);
  assert.match(source, /"development": \{/);
  assert.match(source, /"network": \{/);
  assert.match(source, /"build": \{/);
  assert.match(source, /antiky dev --project path\/to\/harbor-lights\.antiky/);
  assert.match(source, /antiky studio path\/to\/harbor-lights/);
  assert.match(source, /antiky asset install poly-haven:forest-floor --project path\/to\/harbor-lights\.antiky/);
  assert.match(source, /assets\/antiky-assets\.json/);
  assert.match(source, /ANTIKY_ASSET_NOT_FOUND/);
  assert.match(source, /ANTIKY_ASSET_INSTALL_FAILED/);
  assert.match(source, /validates.*before.*open.*Antiky Studio/is);
  assert.match(source, /antiky migrate --name "Harbor Lights" --output harbor-lights\.antiky/);
  assert.match(source, /Finder/i);
  assert.match(source, /Open project/i);
  assert.match(source, /Create project/i);
  assert.match(source, /recent projects.*this device/is);
  assert.match(source, /invalid.*current project.*unchanged/is);
  assert.match(source, /\.antiky\/.*local runtime state/is);
});

test('the CLI guide defines the one project manifest and its migration path', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/cli/development.md', import.meta.url), 'utf8');

  assert.match(source, /<name>\.antiky/);
  assert.match(source, /antiky init \[name\] \[--directory path\]/);
  assert.match(source, /antiky init "Harbor Lights" --directory path\/to\/harbor-lights/);
  assert.match(source, /creates only the manifest/i);
  assert.match(source, /"schemaVersion": 1/);
  assert.match(source, /"name": "Harbor Lights"/);
  assert.match(source, /"development": \{/);
  assert.match(source, /"build": \{/);
  assert.match(source, /antiky dev --project path\/to\/harbor-lights\.antiky/);
  assert.match(source, /antiky studio path\/to\/harbor-lights/);
  assert.match(source, /antiky migrate --name "Harbor Lights" --output harbor-lights\.antiky/);
  assert.doesNotMatch(source, /ANTIKY_CONFIG_(?:NOT_FOUND|INVALID)/);
  assert.match(source, /ANTIKY_PROJECT_NAME_INVALID/);
  assert.match(source, /ANTIKY_PROJECT_DIRECTORY_INVALID/);
  assert.match(source, /ANTIKY_PROJECT_CREATE_FAILED/);
  assert.match(source, /ANTIKY_PROJECT_INIT_INTERRUPTED/);
});

test('the game-module guide keeps game code separate from the development host', async () => {
  const [source, index] = await Promise.all([
    readFile(new URL('../../../docs/user-facing-docs/framework/game-modules.md', import.meta.url), 'utf8'),
    readFile(new URL('../../../docs/user-facing-docs/README.md', import.meta.url), 'utf8'),
  ]);

  assert.match(index, /\[Build a game module\]\(framework\/game-modules\.md\)/);
  assert.match(source, /dist\/antiky\.game\.js/);
  assert.match(source, /must not bind the configured game port/i);
  assert.match(source, /Do not import CLI, Studio, website, Node\.js, or\s+server modules/i);
  assert.match(source, /optional semantic inspection port/i);
  assert.match(source, /host owns.*credential.*snapshot publication.*action polling/is);
  assert.match(source, /does not contain.*inspection transport/i);
});

test('the Studio renderer guide covers Framework, BroMetal, Three.js, and agent inspection', async () => {
  const [source, index] = await Promise.all([
    readFile(new URL('../../../docs/user-facing-docs/studio/renderers.md', import.meta.url), 'utf8'),
    readFile(new URL('../../../docs/user-facing-docs/README.md', import.meta.url), 'utf8'),
  ]);

  assert.match(index, /\[Use BroMetal or Three\.js in Studio\]\(studio\/renderers\.md\)/);
  assert.match(source, /built for BroMetal, and works with Three\.js and other rendering libraries/i);
  assert.match(source, /Antiky Framework \+ BroMetal/);
  assert.match(source, /Pure BroMetal/);
  assert.match(source, /Three\.js/);
  assert.match(source, /dist\/antiky\.game\.js/);
  assert.match(source, /get_runtime_status/);
  assert.match(source, /get_render_stats/);
  assert.match(source, /capture_frame/);
  assert.match(source, /get_world_inspection/);
  assert.match(source, /without.*Antiky Framework.*host.*fallback snapshot/is);
  assert.match(source, /does not expose.*renderer.*GPU objects/is);
});
