import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const runId = 'studio-s00-feedback-02-20260807T035239Z';
const repositoryRoot = process.cwd();
const defaultReportPath = resolve(
  repositoryRoot,
  'docs/objectives/studio/slice-00/outputs',
  runId,
  'final-verifier.json',
);
const reportPath = process.env.ANTIKY_FEEDBACK02_REPORT || defaultReportPath;
const generatedFixtureDigest = '8cf37dd375750d31d54a7af6e8080354d372633482c4db1b5359354b92decf7f';
const commandTimeoutMilliseconds = 180_000;

const checks = [];
const commands = [];

function recordCheck(name, status, evidence) {
  checks.push({ name, status, evidence });
}

async function sourceIncludes(path, values) {
  const source = await readFile(resolve(repositoryRoot, path), 'utf8');
  return values.every((value) => source.includes(value));
}

function runProcess(command, args, options = {}) {
  const startedAt = Date.now();
  return new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repositoryRoot,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.timeoutMilliseconds || commandTimeoutMilliseconds);
    child.once('error', (error) => {
      clearTimeout(timeout);
      resolveResult({
        exitCode: null,
        signal: null,
        stdout,
        stderr: `${stderr}\n${error.message}`,
        timedOut,
        durationMilliseconds: Date.now() - startedAt,
      });
    });
    child.once('exit', (exitCode, signal) => {
      clearTimeout(timeout);
      resolveResult({
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        durationMilliseconds: Date.now() - startedAt,
      });
    });
  });
}

async function runCommand(name, command, args, evidence) {
  const result = await runProcess(command, args);
  const passed = result.exitCode === 0 && result.signal === null && !result.timedOut;
  commands.push({
    name,
    command: [command, ...args].join(' '),
    status: passed ? 'PASS' : 'FAIL',
    exitCode: result.exitCode,
    durationMilliseconds: result.durationMilliseconds,
    evidence,
  });
  if (!passed) {
    const detail = `${result.stdout}\n${result.stderr}`.slice(-4_000);
    throw new Error(`${name} failed.\n${detail}`);
  }
}

async function waitForOutput(readOutput, expected, timeoutMilliseconds = 15_000) {
  const startedAt = Date.now();
  while (!readOutput().includes(expected)) {
    if (Date.now() - startedAt > timeoutMilliseconds) {
      throw new Error(`Timed out while waiting for ${expected}.`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
}

async function waitForCondition(predicate, description, timeoutMilliseconds = 15_000) {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMilliseconds) {
      throw new Error(`Timed out while waiting for ${description}.`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
}

async function runFixtureAcceptance() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'antiky-feedback-02-'));
  const projectDirectory = join(temporaryRoot, 'harbor-lights');
  const manifestPath = join(projectDirectory, 'harbor-lights.antiky');
  const cliPath = resolve(repositoryRoot, 'packages/cli/src/bin.ts');
  const childFixture = resolve(repositoryRoot, 'packages/cli/tests/fixtures/managed-child.mjs');
  const nodeArguments = [
    '--experimental-strip-types',
    '--experimental-transform-types',
    cliPath,
  ];

  try {
    await mkdir(projectDirectory);
    const initialized = await runProcess(process.execPath, [
      ...nodeArguments,
      'init',
      '--directory',
      projectDirectory,
    ]);
    if (initialized.exitCode !== 0 || initialized.signal !== null) {
      throw new Error(`antiky init failed.\n${initialized.stdout}\n${initialized.stderr}`);
    }

    const initialEntries = await readdir(projectDirectory);
    if (initialEntries.length !== 1 || initialEntries[0] !== 'harbor-lights.antiky') {
      throw new Error('antiky init created an unexpected file or directory.');
    }
    const manifestBytes = await readFile(manifestPath);
    const manifestDigest = createHash('sha256').update(manifestBytes).digest('hex');
    if (manifestDigest !== generatedFixtureDigest) {
      throw new Error('The generated manifest does not match the frozen fixture digest.');
    }
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (manifest.name !== 'Harbor Lights') {
      throw new Error('The generated display name is incorrect.');
    }
    if (!initialized.stdout.includes('antiky dev') || !initialized.stdout.includes('Antiky Studio')) {
      throw new Error('Initialization output does not contain both next actions.');
    }

    await copyFile(childFixture, join(projectDirectory, 'managed-child.mjs'));
    await writeFile(join(projectDirectory, 'package.json'), `${JSON.stringify({
      private: true,
      scripts: {
        dev: 'node managed-child.mjs game children.log run',
        'shaders:watch': 'node managed-child.mjs shaders children.log run',
        build: 'node --version',
      },
    }, null, 2)}\n`);

    const child = spawn(process.execPath, [
      ...nodeArguments,
      'dev',
      '--project',
      manifestPath,
    ], {
      cwd: projectDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    let exitResult;
    try {
      await waitForOutput(() => stdout, '[game] fixture game ready');
      await waitForCondition(async () => {
        try {
          const childLog = await readFile(join(projectDirectory, 'children.log'), 'utf8');
          return childLog.includes('game:') && childLog.includes('shaders:');
        } catch (error) {
          if (error.code === 'ENOENT') return false;
          throw error;
        }
      }, 'both generated npm scripts');
      child.kill('SIGINT');
      exitResult = await new Promise((resolveExit) => {
        child.once('exit', (exitCode, signal) => resolveExit({ exitCode, signal }));
      });
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    }
    if (exitResult.exitCode !== 130 || exitResult.signal !== null) {
      throw new Error(`antiky dev did not stop cleanly.\n${stdout}\n${stderr}`);
    }
    const childLog = await readFile(join(projectDirectory, 'children.log'), 'utf8');
    if (!childLog.includes('game:') || !childLog.includes('shaders:')) {
      throw new Error('The generated development and shader commands did not both start.');
    }
    try {
      await access(join(projectDirectory, '.antiky', 'dev-session.json'));
      throw new Error('antiky dev left its session descriptor after SIGINT.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    recordCheck(
      'Real init and dev fixture',
      'PASS',
      `One root manifest matched ${manifestDigest}; both generated npm scripts started and SIGINT returned 130.`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main() {
  recordCheck(
    'CLI command and output contract',
    await sourceIncludes('packages/cli/src/cli.ts', [
      'antiky init [name] [--directory path]',
      'Created ${project.manifestPath}',
      'Run antiky dev',
      'Antiky Studio',
    ]) ? 'PASS' : 'FAIL',
    'The CLI has concise help, created-path output, and both next actions.',
  );
  recordCheck(
    'Shared pure manifest builder',
    await sourceIncludes('packages/cli/src/project.ts', [
      'buildAntikyProjectManifest',
      "shaderCommand: ['npm', 'run', 'shaders:watch']",
      'parseAntikyProjectManifest(source)',
    ]) ? 'PASS' : 'FAIL',
    'The browser-safe project module owns defaults, formatting, and parser validation.',
  );
  recordCheck(
    'Create-only atomic writer',
    await sourceIncludes('packages/cli/src/project-initializer.ts', [
      'constants.O_EXCL',
      'constants.O_NOFOLLOW',
      'await link(temporaryPath, finalPath)',
      'parseAntikyProjectManifest(savedSource)',
      'removeOwnedFile',
    ]) ? 'PASS' : 'FAIL',
    'A validated sibling file becomes the final file through an exclusive hard link and owned cleanup.',
  );
  recordCheck(
    'Safety and failure contracts',
    await sourceIncludes('packages/cli/tests/cli.test.ts', [
      'never replaces the same or a differently named project',
      'unsafe names and invalid targets',
      'unwritable target unchanged',
    ]) && await sourceIncludes('packages/cli/tests/project.test.ts', [
      'malformed and interrupted temporary files',
      'ANTIKY_PROJECT_INIT_INTERRUPTED',
    ]) ? 'PASS' : 'FAIL',
    'Tests cover overwrite, second manifests, invalid names and targets, permissions, malformed bytes, interruption, and cleanup.',
  );
  recordCheck(
    'CLI-to-Studio parity',
    await sourceIncludes('packages/studio/app/src/editor/projectManager.test.ts', [
      'project created by antiky init',
      'initialized.manifestPath',
      'initialized.projectRoot',
      'initialized.revision',
    ]) ? 'PASS' : 'FAIL',
    'Studio opens real initializer output and reports the CLI name, canonical path, root, and revision.',
  );
  recordCheck(
    'User-facing project guidance',
    await sourceIncludes('docs/user-facing-docs/cli/development.md', [
      'antiky init [name] [--directory path]',
      'creates only the manifest',
      'ANTIKY_PROJECT_INIT_INTERRUPTED',
    ]) && await sourceIncludes('docs/user-facing-docs/studio/projects.md', [
      'antiky init "Harbor Lights" --directory path/to/harbor-lights',
      'does not overwrite a project',
    ]) ? 'PASS' : 'FAIL',
    'CLI and Studio guides cover creation, defaults, non-goals, safe failure, opening, and next actions.',
  );

  await runFixtureAcceptance();

  await runCommand(
    'CLI contracts',
    'npm',
    ['run', 'test', '--workspace', '@antiky/cli'],
    'All initializer, loader, development-host, lifecycle, MCP, and documentation contracts pass.',
  );
  await runCommand(
    'Studio app contracts',
    'npm',
    ['run', 'test', '--workspace', '@antiky/studio-app'],
    'All portable Studio contracts pass, including real initializer-output opening.',
  );
  await runCommand(
    'Studio app build',
    'npm',
    ['run', 'build', '--workspace', '@antiky/studio-app'],
    'Studio type checking and the production web build accept the shared parser contract.',
  );
  await runCommand(
    'Repository checks',
    'npm',
    ['run', 'check'],
    'All workspace typechecks, tests, generated documents, shaders, and production builds pass.',
  );
  await runCommand(
    'Whitespace audit',
    'git',
    ['diff', '--check'],
    'Git reports no whitespace errors.',
  );
  await runCommand(
    'LFS pointer audit',
    'git',
    ['lfs', 'fsck', '--pointers'],
    'All routed PNG and JPEG pointers pass the Git LFS audit.',
  );

  const failedChecks = checks.filter((check) => check.status !== 'PASS').length;
  const failedCommands = commands.filter((command) => command.status !== 'PASS').length;
  const report = {
    schemaVersion: 1,
    runId,
    generatedAt: new Date().toISOString(),
    result: failedChecks === 0 && failedCommands === 0 ? 'PASS' : 'FAIL',
    generatedManifestSha256: generatedFixtureDigest,
    checks,
    commands,
    summary: {
      passedChecks: checks.length - failedChecks,
      failedChecks,
      passedCommands: commands.length - failedCommands,
      failedCommands,
    },
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== 'PASS') process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  await writeFile(reportPath, `${JSON.stringify({
    schemaVersion: 1,
    runId,
    generatedAt: new Date().toISOString(),
    result: 'FAIL',
    generatedManifestSha256: generatedFixtureDigest,
    checks,
    commands,
    failure: error instanceof Error ? error.message : 'Unknown verifier failure.',
  }, null, 2)}\n`);
  throw error;
}
