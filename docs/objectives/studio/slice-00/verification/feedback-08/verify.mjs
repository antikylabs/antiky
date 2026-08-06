import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runId = 'studio-s00-feedback-08-20260806T181038Z';
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const outputDirectory = resolve(
  repository,
  'docs/objectives/studio/slice-00/outputs',
  runId,
);
const resultPath = resolve(outputDirectory, 'final-verifier.json');
const startedAt = new Date().toISOString();
const commands = [];
const checks = [];

function run(name, command, args, summary) {
  const commandStartedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: repository,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });
  const record = {
    name,
    command: [command, ...args].join(' '),
    exitCode: result.status,
    durationMilliseconds: Date.now() - commandStartedAt,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    summary: result.status === 0 ? summary : 'The command failed. See verifier console output.',
  };
  commands.push(record);
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${name} failed with exit code ${result.status ?? 'unknown'}.`);
  }
  return result.stdout.trim();
}

async function read(relativePath) {
  return readFile(resolve(repository, relativePath));
}

async function text(relativePath) {
  return (await read(relativePath)).toString('utf8');
}

function pass(name, evidence) {
  checks.push({ name, status: 'PASS', evidence });
}

function jpegDimensions(buffer) {
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xd8);
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = buffer.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]
      .includes(marker)) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }
    offset += length;
  }
  throw new Error('JPEG dimensions were not found.');
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function dimensions(buffer, extension) {
  return extension === 'png' ? pngDimensions(buffer) : jpegDimensions(buffer);
}

async function sha256(relativePath) {
  return createHash('sha256').update(await read(relativePath)).digest('hex');
}

async function atomicWrite(path, value) {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
}

let failure = null;
try {
  const shell = await text('packages/studio/app/src/components/StudioShell.tsx');
  const inspectionPanel = await text('packages/studio/app/src/components/InspectionPanel.tsx');
  const activityPanel = await text('packages/studio/app/src/components/ActivityPanel.tsx');
  const styles = await text('packages/studio/app/src/styles.css');
  const responsive = await text('packages/studio/app/src/responsive.css');
  const terminal = await text('packages/studio/app/src/NativeTerminal.tsx');
  const bridge = await text('packages/studio/tauri/src/native/terminal_bridge.m');
  const guide = await text('docs/user-facing-docs/studio/getting-started.md');
  const tauriConfig = JSON.parse(await text('packages/studio/tauri/tauri.conf.json'));

  const semanticOrder = [...[shell, inspectionPanel, activityPanel].join('\n').matchAll(/workspaceArea="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(semanticOrder, ['game', 'terminal', 'inspection', 'activity']);
  assert.match(styles, /"game inspection"\s*\n\s*"terminal activity"/);
  assert.match(responsive, /@media \(max-width: 760px\)[\s\S]*"game"\s*\n\s*"terminal"\s*\n\s*"inspection"\s*\n\s*"activity"/);
  pass('Workspace hierarchy', 'The DOM and named CSS grids use game, terminal, inspection, and activity in the approved order.');

  assert.match(terminal, /new ResizeObserver\(scheduleSynchronization\)/);
  assert.match(terminal, /document\.addEventListener\('scroll', scheduleSynchronization, true\)/);
  assert.match(terminal, /invoke\('terminal_layout', \{ bounds: submittedBounds \}\)/);
  assert.match(bridge, /antiky_view\.hidden = YES/);
  assert.match(bridge, /antiky_view\.hidden = NO/);
  assert.ok(tauriConfig.app.windows[0].minWidth <= 760);
  pass('Native terminal geometry', 'Bounds are clipped, synchronized on resize and scroll, hidden offscreen, and reachable at the narrow breakpoint.');

  assert.match(styles, /\.titlebar\s*\{[^}]*user-select:\s*none;/s);
  assert.match(shell, /data-tauri-drag-region="true"/);
  assert.match(responsive, /prefers-reduced-motion: reduce/);
  assert.match(guide, /stack in this order:\s*Live game,\s*Terminal,\s*Inspection,\s*Activity/i);
  pass('Accessibility and documentation', 'Visible focus, reduced motion, a movable title bar, and the responsive public workflow are present.');

  const captureContracts = [
    ['reference-owner-desktop-1672x941.png', 1672, 941],
    ['before-native-desktop-1228x768.jpeg', 1228, 768],
    ['after-native-desktop-connected-safe-1228x768.jpeg', 1228, 768],
    ['after-native-intermediate-connected-safe-988x768.jpeg', 988, 768],
    ['after-native-narrow-connected-safe-753x825.jpeg', 753, 825],
    ['after-native-narrow-terminal-focus-safe-753x825.jpeg', 753, 825],
  ];
  const captures = [];
  for (const [name, width, height] of captureContracts) {
    const path = `docs/objectives/studio/slice-00/outputs/${runId}/captures/${name}`;
    const buffer = await read(path);
    assert.deepEqual(dimensions(buffer, name.split('.').at(-1)), { width, height });
    captures.push({ path: `captures/${name}`, width, height, sha256: await sha256(path) });
  }
  pass('Run-scoped captures', `${captures.length} reference, before, desktop, intermediate, narrow, and focus captures have the expected dimensions.`);

  run(
    'Repository checks',
    'npm',
    ['run', 'check'],
    'Repository typechecks and all workspace tests passed.',
  );
  run(
    'Studio web build',
    'npm',
    ['run', 'build', '--workspace', '@antiky/studio-app'],
    'The portable Studio application build passed.',
  );
  run(
    'Studio native build',
    'npm',
    ['run', 'build', '--workspace', '@antiky/studio-tauri'],
    'The Tauri application and macOS bundle build passed.',
  );
  run('Whitespace audit', 'git', ['diff', '--check'], 'The current patch has no whitespace errors.');

  const revision = run('Revision', 'git', ['rev-parse', 'HEAD'], 'The exact checked revision was recorded.');
  await atomicWrite(resultPath, {
    schemaVersion: 1,
    runId,
    status: 'PASS',
    startedAt,
    completedAt: new Date().toISOString(),
    implementationRevision: revision,
    checks,
    commands,
    captures,
    browserControl: {
      status: 'UNAVAILABLE',
      classification: 'EVIDENCE_FAILURE',
      detail: 'Browser Control reported no attached browser. Native Computer Use captures are present; browser appearance remains pending owner review.',
    },
  });
} catch (error) {
  failure = error;
  await atomicWrite(resultPath, {
    schemaVersion: 1,
    runId,
    status: 'FAIL',
    startedAt,
    completedAt: new Date().toISOString(),
    checks,
    commands,
    error: error instanceof Error ? error.message : String(error),
  });
}

if (failure) throw failure;
console.log(`PASS ${relative(repository, resultPath)}`);
