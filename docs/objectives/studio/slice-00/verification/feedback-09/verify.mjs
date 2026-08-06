import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const verificationDirectory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(verificationDirectory, '../../../../../..');
const runId = 'studio-s00-feedback-09-20260806T222222Z';
const runDirectory = resolve(
  repository,
  'docs/objectives/studio/slice-00/outputs',
  runId,
);
const reportPath = resolve(runDirectory, 'final-verifier.json');
const startedAt = new Date().toISOString();
const checks = [];
const commands = [];

function pass(name, evidence) {
  checks.push({ name, status: 'PASS', evidence });
}

function fail(name, error) {
  checks.push({
    name,
    status: 'FAIL',
    evidence: error instanceof Error ? error.message : String(error),
  });
}

async function check(name, operation) {
  try {
    pass(name, await operation());
  } catch (error) {
    fail(name, error);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function parseProfile(source) {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      expect(separator > 0, `Invalid profile line: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    });
}

function runCommand(name, command, args, summary) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: repository,
    encoding: 'utf8',
    env: process.env,
  });
  const record = {
    name,
    command: [command, ...args].join(' '),
    exitCode: result.status,
    durationMilliseconds: Date.now() - started,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    summary,
  };
  if (result.status !== 0) {
    record.failure = (result.stderr || result.stdout || 'Command failed').trim().slice(-2000);
  }
  commands.push(record);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const profilePath = resolve(
  repository,
  'packages/studio/tauri/resources/terminal/antiky-studio.ghostty',
);
const profile = await readFile(profilePath, 'utf8');
const profileEntries = parseProfile(profile);
const expectedColors = new Map([
  ['background', '#08090b'],
  ['foreground', '#f4f4f1'],
  ['cursor-color', '#8b7cff'],
  ['cursor-text', '#08090b'],
  ['selection-background', '#8b7cff'],
  ['selection-foreground', '#08090b'],
]);
const expectedPalette = [
  '#08090b', '#ff6b6b', '#48c78e', '#e9b64f', '#8b7cff', '#d48cff', '#5cc8d7', '#a6a6ae',
  '#787982', '#ff9a9a', '#7eddae', '#f3d37c', '#a69bff', '#e8b3ff', '#8ce8f0', '#f4f4f1',
];

await check('Audited visual profile', async () => {
  expect(Buffer.byteLength(profile) > 0 && Buffer.byteLength(profile) <= 4096, 'Profile size is not bounded');
  const allowed = new Set([...expectedColors.keys(), 'palette']);
  expect(profileEntries.every(([key]) => allowed.has(key)), 'Profile includes a nonvisual key');
  for (const [key, value] of expectedColors) {
    const matches = profileEntries.filter(([candidate]) => candidate === key);
    expect(matches.length === 1 && matches[0][1] === value, `${key} differs from the audited value`);
  }
  const palette = profileEntries
    .filter(([key]) => key === 'palette')
    .map(([, value]) => value.split('='));
  expect(palette.length === 16, 'Profile does not define 16 ANSI colors');
  for (let index = 0; index < expectedPalette.length; index += 1) {
    expect(palette[index][0] === String(index), `Palette index ${index} is missing or reordered`);
    expect(palette[index][1] === expectedPalette[index], `Palette index ${index} differs`);
  }
  return `The ${Buffer.byteLength(profile)}-byte profile has only six color keys and a complete ANSI palette.`;
});

await check('Trusted resource declaration', async () => {
  const config = JSON.parse(await readFile(
    resolve(repository, 'packages/studio/tauri/tauri.conf.json'),
    'utf8',
  ));
  expect(config.bundle.resources['resources/terminal/antiky-studio.ghostty'] === 'terminal/antiky-studio.ghostty', 'Tauri resource mapping differs');
  expect(config.app.windows[0].backgroundColor === '#08090b', 'Native first-frame background differs');
  return 'Tauri maps the one source profile to the exact runtime resource path and paints the native window #08090b.';
});

await check('Path and diagnostic boundary', async () => {
  const rust = await readFile(resolve(repository, 'packages/studio/tauri/src/terminal_theme.rs'), 'utf8');
  const bridge = await readFile(resolve(repository, 'packages/studio/tauri/src/native/terminal_bridge.m'), 'utf8');
  expect(rust.includes('const MAX_PROFILE_BYTES: usize = 4096'), 'Rust size boundary is missing');
  expect(rust.includes('candidate != resource_root.join(TERMINAL_THEME_RESOURCE_PATH)'), 'Exact resource path boundary is missing');
  expect(rust.includes('symlink_metadata(candidate)'), 'Symlink-aware path validation is missing');
  expect(bridge.includes('ghostty_config_diagnostics_count(profile_config)'), 'Isolated profile diagnostics are missing');
  const defaults = bridge.indexOf('ghostty_config_load_default_files(antiky_config)');
  const recursive = bridge.indexOf('ghostty_config_load_recursive_files(antiky_config)');
  const studio = bridge.indexOf('ghostty_config_load_file(antiky_config, terminal_profile)');
  const finalize = bridge.indexOf('ghostty_config_finalize(antiky_config)');
  expect(defaults > 0 && recursive > defaults && studio > recursive && finalize > studio, 'Ghostty configuration load order differs');
  return 'Rust accepts one canonical packaged path; Ghostty validates the profile alone, then loads it after user configuration.';
});

await check('Shell and terminal ownership', async () => {
  const bridge = await readFile(resolve(repository, 'packages/studio/tauri/src/native/terminal_bridge.m'), 'utf8');
  expect(bridge.includes('surface_config.working_directory = working_directory'), 'Project working directory is missing');
  for (const forbidden of ['surface_config.command', 'initial-command', 'shell-integration =', 'input =']) {
    expect(!bridge.includes(forbidden), `Bridge contains forbidden startup behavior: ${forbidden}`);
  }
  return 'The native surface sets only its existing working directory and font size; it supplies no command, input, prompt, or shell integration override.';
});

await check('First-frame and in-panel presentation', async () => {
  const index = await readFile(resolve(repository, 'packages/studio/app/index.html'), 'utf8');
  const component = await readFile(resolve(repository, 'packages/studio/app/src/NativeTerminal.tsx'), 'utf8');
  const styles = await readFile(resolve(repository, 'packages/studio/app/src/terminal.css'), 'utf8');
  expect(index.includes('html, body, #root { background: #08090b; }'), 'Bootstrap background is missing');
  expect(component.includes('Opening terminal…') && component.includes('role="alert"'), 'Loading or error surface is missing');
  expect(styles.includes('background: #08090b'), 'React terminal state background differs');
  return 'The native window, bootstrap document, React mount, loading state, and error state share #08090b.';
});

await check('General Studio documentation', async () => {
  const guide = await readFile(resolve(repository, 'docs/user-facing-docs/studio/getting-started.md'), 'utf8');
  expect(guide.includes('### Terminal appearance and shell ownership'), 'Terminal theme documentation is missing');
  expect(guide.includes('does not replace your prompt'), 'Shell-ownership documentation is incomplete');
  return 'The Studio guide separates Antiky color ownership from the user-owned shell and Ghostty settings.';
});

await check('Baseline and contrast evidence', async () => {
  const baseline = JSON.parse(await readFile(resolve(runDirectory, 'baseline.json'), 'utf8'));
  const contrast = JSON.parse(await readFile(resolve(runDirectory, 'contrast.json'), 'utf8'));
  expect(baseline.referenceColors.terminalDominantBackground === '#282c34', 'Baseline terminal color differs');
  expect(baseline.referenceColors.studioMediaBackground === '#08090b', 'Baseline Studio color differs');
  expect(contrast.surfacePairs.every(({ ratio }) => ratio >= 4.5), 'A primary surface pair misses 4.5:1');
  expect(contrast.ansiPalette.slice(1).every(({ ratio }) => ratio >= 4.5), 'A foreground ANSI color misses 4.5:1');
  return 'The baseline mismatch is recorded and every foreground color meets at least 4.5:1 against the Studio terminal background.';
});

const expectedCaptures = [
  ['captures/before-terminal.png', 1228, 768],
  ['captures/themed-reopened.png', 1228, 768],
  ['captures/themed-ansi-unicode.png', 1228, 768],
  ['captures/themed-clipboard-focus.png', 1228, 768],
  ['captures/themed-control-c.png', 1228, 768],
  ['captures/themed-resized.png', 1016, 768],
];

await check('Native capture inventory', async () => {
  for (const [relativePath, width, height] of expectedCaptures) {
    const path = resolve(runDirectory, relativePath);
    const metadata = await sharp(path).metadata();
    expect(metadata.width === width && metadata.height === height, `${relativePath} dimensions differ`);
  }
  return `${expectedCaptures.length} native before, prompt, ANSI/Unicode, clipboard/focus, interrupt, and resize/reopen captures have the expected dimensions.`;
});

let receipt;
await check('Final evidence receipt', async () => {
  receipt = JSON.parse(await readFile(resolve(runDirectory, 'receipt.json'), 'utf8'));
  expect(receipt.runId === runId, 'Receipt run ID differs');
  expect(receipt.state === 'COMPLETE' && receipt.result === 'PASS', 'Receipt is not complete');
  expect(receipt.runSetup?.profileSha256 === sha256(Buffer.from(profile)), 'Receipt profile digest differs');
  const implementationIsAncestor = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', receipt.implementationRevision, 'HEAD'],
    { cwd: repository },
  );
  expect(implementationIsAncestor.status === 0, 'Receipt implementation revision is not in the checked history');
  expect(receipt.ownerReview?.status === 'PASS', 'Owner review is not approved');
  expect(receipt.shellFixture?.status === 'PASS', 'Isolated zsh fixture is not approved');
  expect(receipt.nativeErrorState?.status === 'PASS', 'Native error-state capture is not approved');
  expect(receipt.remainingNativeInteraction?.status === 'PASS', 'Long-output, selection/copy, and zoom checks are not approved');
  const shellFixture = JSON.parse(await readFile(resolve(runDirectory, 'shell-fixture.json'), 'utf8'));
  expect(shellFixture.runId === runId && shellFixture.status === 'PASS', 'Shell fixture result is not complete');
  expect(shellFixture.shell === '/bin/zsh', 'Shell fixture did not run zsh');
  expect(shellFixture.projectDirectoryMatches === true, 'Shell fixture did not start in the project');
  expect(shellFixture.profileMarkerCount === 1, 'Shell profile marker did not run exactly once');
  expect(shellFixture.historyEntryCount === 0, 'Antiky added an entry to fixture history');
  expect(shellFixture.antikyStartupContentCount === 0, 'Antiky added startup terminal content');
  const nativeAcceptance = JSON.parse(await readFile(resolve(runDirectory, 'native-acceptance.json'), 'utf8'));
  expect(nativeAcceptance.runId === runId && nativeAcceptance.status === 'PASS', 'Native acceptance result is not complete');
  const requiredNativeChecks = new Set([
    'first-frame',
    'real-prompt',
    'ansi',
    'unicode',
    'long-output',
    'selection-copy',
    'clipboard-paste',
    'control-c',
    'command-shortcut',
    'focus',
    'resize',
    'zoom',
    'close-reopen',
    'single-window',
    'single-terminal',
    'missing-profile-error',
    'usable-studio-on-error',
  ]);
  for (const result of nativeAcceptance.checks ?? []) {
    if (result.status === 'PASS') requiredNativeChecks.delete(result.id);
  }
  expect(requiredNativeChecks.size === 0, `Native checks remain: ${[...requiredNativeChecks].join(', ')}`);
  expect(
    nativeAcceptance.errorMessage === 'The Antiky Studio terminal theme is missing or invalid.',
    'Native error message differs',
  );
  for (const artifact of receipt.artifacts ?? []) {
    const bytes = await readFile(resolve(runDirectory, artifact.path));
    expect(bytes.byteLength === artifact.byteLength, `${artifact.path} byte length differs`);
    expect(sha256(bytes) === artifact.sha256, `${artifact.path} digest differs`);
  }
  return 'Receipt records complete owner, shell-fixture, native error-state, interaction, command, and artifact evidence.';
});

if (checks.every(({ status }) => status === 'PASS')) {
  runCommand('Studio app tests', 'npm', ['test', '--workspace', '@antiky/studio-app'], 'All Studio application tests passed.');
  runCommand('Studio native tests', 'npm', ['test', '--workspace', '@antiky/studio-tauri'], 'All Tauri JavaScript and Rust tests passed.');
  runCommand('Studio web build', 'npm', ['run', 'build', '--workspace', '@antiky/studio-app'], 'The portable Studio build passed.');
  runCommand('Studio native build', 'npm', ['run', 'build', '--workspace', '@antiky/studio-tauri'], 'The native Studio build passed.');
  runCommand('Studio debug bundle', 'npm', ['exec', '--workspace', '@antiky/studio-tauri', 'tauri', '--', 'build', '--debug', '--bundles', 'app', '--no-sign'], 'The unsigned debug macOS app bundle passed.');
  runCommand('Studio release bundle', 'npm', ['exec', '--workspace', '@antiky/studio-tauri', 'tauri', '--', 'build', '--bundles', 'app', '--no-sign'], 'The unsigned release macOS app bundle passed.');
  runCommand('Repository checks', 'npm', ['run', 'check'], 'All workspace typechecks, tests, and production builds passed.');
  runCommand('Rust format audit', 'cargo', ['fmt', '--manifest-path', 'packages/studio/tauri/Cargo.toml', '--', '--check'], 'The native Rust source is formatted.');
  runCommand('Git LFS pointer audit', 'git', ['lfs', 'fsck', '--pointers'], 'All image pointers and local LFS objects passed.');
  runCommand('Whitespace audit', 'git', ['diff', '--check'], 'The current patch has no whitespace errors.');

  await check('Built resource packaging', async () => {
    const debugDevelopmentProfile = await readFile(resolve(
      repository,
      'packages/studio/tauri/target/debug/terminal/antiky-studio.ghostty',
    ));
    const releaseDevelopmentProfile = await readFile(resolve(
      repository,
      'packages/studio/tauri/target/release/terminal/antiky-studio.ghostty',
    ));
    const debugProfile = await readFile(resolve(
      repository,
      'packages/studio/tauri/target/debug/bundle/macos/Antiky Studio.app/Contents/Resources/terminal/antiky-studio.ghostty',
    ));
    const releaseProfile = await readFile(resolve(
      repository,
      'packages/studio/tauri/target/release/bundle/macos/Antiky Studio.app/Contents/Resources/terminal/antiky-studio.ghostty',
    ));
    const sourceDigest = sha256(Buffer.from(profile));
    expect(sha256(debugDevelopmentProfile) === sourceDigest, 'Debug development and source profiles differ');
    expect(sha256(releaseDevelopmentProfile) === sourceDigest, 'Release development and source profiles differ');
    expect(sha256(debugProfile) === sourceDigest, 'Debug-bundle and source profiles differ');
    expect(sha256(releaseProfile) === sourceDigest, 'Release-bundle and source profiles differ');
    return `Source, development, debug-bundle, and release-bundle profile SHA-256: ${sourceDigest}.`;
  });
}

const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repository,
  encoding: 'utf8',
}).stdout.trim();
const status = checks.every(({ status: value }) => value === 'PASS')
  && commands.every(({ status: value }) => value === 'PASS')
  ? 'PASS'
  : 'FAIL';
const report = {
  schemaVersion: 1,
  runId,
  status,
  startedAt,
  completedAt: new Date().toISOString(),
  implementationRevision: revision,
  checks,
  commands,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = status === 'PASS' ? 0 : 1;
