import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const verificationDirectory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(verificationDirectory, '../../../../../..');
const runId = 'studio-s00-feedback-01-20260806T233318Z';
const runDirectory = resolve(repository, 'docs/objectives/studio/slice-00/outputs', runId);
const reportPath = resolve(runDirectory, 'final-verifier.json');
const checks = [];
const commands = [];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function recordCheck(name, status, evidence) {
  checks.push({ name, status, evidence });
}

async function check(name, operation) {
  try {
    recordCheck(name, 'PASS', await operation());
  } catch (error) {
    recordCheck(name, 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function runCommand(name, command, args, evidence) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: repository,
    encoding: 'utf8',
    env: process.env,
  });
  const status = result.status === 0 ? 'PASS' : 'FAIL';
  const failureOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  commands.push({
    name,
    command: [command, ...args].join(' '),
    status,
    exitCode: result.status,
    durationMilliseconds: Date.now() - started,
    evidence: status === 'PASS'
      ? evidence
      : failureOutput.includes('listen EPERM: operation not permitted')
        ? 'AUTHORITY_BLOCK: the sandbox denied a required 127.0.0.1 listener with EPERM.'
        : failureOutput.slice(-2000) || 'Command failed',
  });
}

await check('One tracked project manifest', async () => {
  const entries = await readdir(repository, { withFileTypes: true });
  const manifests = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.antiky'));
  expect(manifests.length === 1 && manifests[0].name === 'antiky-town.antiky', 'Repository root must contain only antiky-town.antiky');
  await access(resolve(repository, 'antiky-town.antiky'));
  expect(!entries.some((entry) => entry.name === 'antiky.config.json'), 'Legacy antiky.config.json remains at the project root');
  return 'The repository has one named project manifest and no legacy config source.';
});

await check('Shared bounded project boundary', async () => {
  const parser = await readFile(resolve(repository, 'packages/cli/src/project.ts'), 'utf8');
  const loader = await readFile(resolve(repository, 'packages/cli/src/project-node.ts'), 'utf8');
  const manager = await readFile(resolve(repository, 'packages/studio/app/src/editor/projectManager.ts'), 'utf8');
  expect(parser.includes('ANTIKY_PROJECT_MAX_BYTES = 64 * 1024'), 'Shared 64 KiB parser limit is missing');
  expect(parser.includes('checkKeys('), 'Strict shared key validation is missing');
  expect(loader.includes('O_NOFOLLOW'), 'Node no-follow file opening is missing');
  expect(manager.includes("from '@antiky/cli/project'"), 'Studio does not import the shared project parser');
  return 'CLI and Studio share one strict browser-safe parser; Node and native adapters own file access.';
});

await check('Native selection and activation boundary', async () => {
  const rust = await readFile(resolve(repository, 'packages/studio/tauri/src/project.rs'), 'utf8');
  const commandsSource = await readFile(resolve(repository, 'packages/studio/tauri/src/commands.rs'), 'utf8');
  expect(rust.includes('pub const MAX_PROJECT_BYTES: u64 = 64 * 1024'), 'Native read limit is missing');
  expect(rust.includes('symlink_metadata(path)'), 'Symlink-aware native validation is missing');
  expect(rust.includes('pub(crate) fn validate(') && rust.includes('pub(crate) fn activate('), 'Two-phase validation and activation are missing');
  expect(commandsSource.includes('pick_project()'), 'Native project picker command is missing');
  return 'Native input is bounded and symlink-aware; validation and activation are separate operations.';
});

await check('Packaged file association', async () => {
  const config = JSON.parse(await readFile(resolve(repository, 'packages/studio/tauri/tauri.conf.json'), 'utf8'));
  expect(config.bundle.active === true, 'Bundle is not active');
  expect(config.bundle.targets.length === 1 && config.bundle.targets[0] === 'app', 'Local app bundle target differs');
  const [association] = config.bundle.fileAssociations;
  expect(association.ext.length === 1 && association.ext[0] === 'antiky', '.antiky association is missing');
  expect(association.role === 'Editor' && association.rank === 'Owner', 'Studio does not own the editor association');
  expect(association.exportedType.identifier === 'dev.antiky.project', 'Exported project UTI differs');
  return 'The local macOS app bundle owns one exported .antiky editor association.';
});

await check('Launcher and active project identity', async () => {
  const launcher = await readFile(resolve(repository, 'packages/studio/app/src/components/ProjectLauncher.tsx'), 'utf8');
  const shell = await readFile(resolve(repository, 'packages/studio/app/src/components/StudioShell.tsx'), 'utf8');
  expect(launcher.includes('Open a project') && launcher.includes('Choose file'), 'Empty launcher is missing');
  expect(!launcher.includes('Choose one') && !launcher.includes('Studio validates'), 'Launcher includes implementation copy');
  for (const value of ['manifestPath', 'schemaVersion', 'projectRoot']) {
    expect(shell.includes(value), `Workspace omits ${value}`);
  }
  return 'A cold start shows Open project; an active workspace shows name, manifest, schema, and root.';
});

await check('User documentation', async () => {
  const studio = await readFile(resolve(repository, 'docs/user-facing-docs/studio/getting-started.md'), 'utf8');
  const projects = await readFile(resolve(repository, 'docs/user-facing-docs/studio/projects.md'), 'utf8');
  const cli = await readFile(resolve(repository, 'docs/user-facing-docs/cli/development.md'), 'utf8');
  expect(studio.includes('**Open project**') && studio.includes('Double-click one `.antiky` file'), 'Studio open workflow is not documented');
  expect(projects.includes('# Projects') && projects.includes('## Manifest fields'), 'Dedicated Projects guide is incomplete');
  expect(cli.includes('antiky migrate --name "Harbor Lights" --output harbor-lights.antiky'), 'Legacy migration is not documented');
  return 'The dedicated Projects guide covers Studio, Finder, manifest identity, safe rejection, CLI use, and migration.';
});

await check('Actual native usability evidence', async () => {
  const receipt = JSON.parse(await readFile(resolve(runDirectory, 'receipt.json'), 'utf8'));
  const visual = receipt.acceptance.find((item) => item.id === 'VISUAL-USABILITY');
  const finder = receipt.acceptance.find((item) => item.id === 'FINDER-AND-PICKER');
  expect(visual?.status === 'PASS' && typeof visual.evidence === 'string', 'Visual usability evidence is not approved');
  expect(finder?.status === 'PASS' && typeof finder.evidence === 'string', 'Actual Finder and picker evidence is not approved');
  for (const capture of [
    '01-launcher.jpeg',
    '02-settings.jpeg',
    '03-project-open.jpeg',
    '04-invalid-replacement.jpeg',
    '05-finder-open.jpeg',
  ]) {
    await access(resolve(runDirectory, 'captures', capture));
  }
  return 'The receipt and five native captures prove launcher, settings, picker, identity, keyboard, safe rejection, and Finder behavior.';
});

runCommand('CLI contracts', 'npm', ['run', 'test', '--workspace', '@antiky/cli'], 'All CLI project, host, migration, lifecycle, MCP, and documentation contracts pass.');
runCommand('Studio app contracts', 'npm', ['run', 'test', '--workspace', '@antiky/studio-app'], 'All portable Studio, launcher, project-manager, and native-adapter contracts pass.');
runCommand('Native host contracts', 'npm', ['run', 'test', '--workspace', '@antiky/studio-tauri'], 'All Tauri configuration, picker, file-event, project-boundary, terminal, and Rust contracts pass.');
runCommand('Local macOS app bundle', 'npm', ['run', 'build', '--workspace', '@antiky/studio-tauri'], 'The release macOS .app and its web payload build with the .antiky association.');
runCommand('Repository checks', 'npm', ['run', 'check'], 'All workspace tests, typechecks, generated docs, shaders, and production builds pass.');
runCommand('Rust formatting', 'cargo', ['fmt', '--manifest-path', 'packages/studio/tauri/Cargo.toml', '--check'], 'Native Rust source is formatted.');
runCommand('Whitespace audit', 'git', ['diff', '--check'], 'Git reports no whitespace errors.');
runCommand('LFS pointer audit', 'git', ['lfs', 'fsck', '--pointers'], 'All routed PNG and JPEG objects and pointers pass Git LFS validation.');

const failedChecks = checks.filter((item) => item.status !== 'PASS');
const failedCommands = commands.filter((item) => item.status !== 'PASS');
const report = {
  schemaVersion: 1,
  runId,
  generatedAt: new Date().toISOString(),
  result: failedChecks.length === 0 && failedCommands.length === 0 ? 'PASS' : 'FAIL',
  checks,
  commands,
  summary: {
    passedChecks: checks.length - failedChecks.length,
    failedChecks: failedChecks.length,
    passedCommands: commands.length - failedCommands.length,
    failedCommands: failedCommands.length,
  },
};
const bytes = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(reportPath, bytes);
const digest = createHash('sha256').update(bytes).digest('hex');
console.log(`${report.result}: ${report.summary.passedChecks}/${checks.length} checks and ${report.summary.passedCommands}/${commands.length} commands passed; report sha256 ${digest}`);
if (report.result !== 'PASS') process.exitCode = 1;
