import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  access,
  chmod,
  constants,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import sharp from 'sharp';

import {
  artifactFor,
  sealReceipt,
  validateArtifactDigests,
  validateReceipt,
  writeJsonAtomic,
  writeReceiptAtomic,
  writeTextAtomic,
} from './slice-00-evidence.mjs';
import {
  createAcceptance,
  createConfirmation,
  createFacts,
  createMeasurements,
  createReceipt,
} from './slice-00-report.mjs';
import {
  assertPortsAvailable,
  CdpClient,
  createChromeProfile,
  removeChromeProfile,
  runLoggedCommand,
  startLoggedProcess,
  stopOwnedProcess,
  waitFor,
  waitForChromeTarget,
} from './slice-00-runtime.mjs';
import {
  assertCaptureHasContent,
  assertChromeNetworkIsolation,
  assertReadySnapshot,
  assertSnapshotParity,
  capturePageAtViewport,
  comparePageCaptures,
  copyBaselineArtifacts,
  copyTreeExclusive,
  createChromeArguments,
  parseWorkingTreePaths,
  selectRunId,
} from './slice-00-verifier-core.mjs';

export {
  assertCaptureHasContent,
  assertChromeNetworkIsolation,
  assertReadySnapshot,
  assertSnapshotParity,
  capturePageAtViewport,
  comparePageCaptures,
  createChromeArguments,
  parseWorkingTreePaths,
  selectRunId,
};

const executeFile = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(root, 'docs/objectives/antiky-town/slice-00/outputs');
const canonicalBaselineRunId = 's00-20260804T205140Z';
const canonicalBaselineDirectory = path.join(outputRoot, canonicalBaselineRunId);
const gameUrl = 'http://127.0.0.1:3010/';
const mcpUrl = 'http://127.0.0.1:3011/mcp';
const chromePath = process.env.ANTIKY_CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const requiredTools = [
  'get_dev_status',
  'get_latest_build',
  'get_runtime_status',
  'get_render_stats',
  'get_diagnostics',
  'dev_reload',
  'capture_frame',
];
const allowedUnrelatedChanges = new Set([
  'docs/adr/UNDER_REVIEW_A.md',
  'docs/user-facing-docs/studio/.gitkeep',
]);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function exists(file) {
  return access(file).then(() => true, () => false);
}

async function commandText(command, args, trim = true) {
  const result = await executeFile(command, args, { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  return trim ? result.stdout.trim() : result.stdout;
}

async function assertImplementationTreeClean() {
  const status = await commandText('git', ['status', '--porcelain', '--untracked-files=all'], false);
  const paths = parseWorkingTreePaths(status);
  const unexpected = paths.filter((file) => !allowedUnrelatedChanges.has(file));
  assert.deepEqual(unexpected, [], `Slice implementation tree is not clean:\n${unexpected.join('\n')}`);
  return paths;
}

async function checkpointCommits() {
  const messages = [
    ['CP-00', 'Record Slice 00 baseline'],
    ['CP-01', 'Add framework inspection'],
    ['CP-02', 'Start games with Antiky CLI'],
    ['CP-03', 'Connect runtime inspection'],
    ['CP-04', 'Expose Antiky development tools'],
    ['CP-05', 'Verify Slice 00'],
  ];
  const log = await commandText('git', ['log', '--format=%H%x09%s', '-80']);
  const rows = log.split('\n').map((line) => line.split('\t'));
  return messages.map(([id, message]) => {
    const match = rows.find(([, subject]) => subject === message);
    assert.ok(match, `${id} checkpoint commit is missing: ${message}`);
    return { id, commit: match[0], status: 'PASS' };
  });
}

async function evaluateValue(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? 'Browser evaluation failed.');
  return response.result.value;
}

async function enterRunningTown(cdp) {
  await waitFor(async () => evaluateValue(cdp, `(() => {
    if (document.querySelector('.stage')?.getAttribute('data-phase') === 'running') return true;
    const button = document.querySelector('.stage-activate');
    if (!button) return false;
    button.click();
    return false;
  })()`), { timeoutMilliseconds: 30_000, intervalMilliseconds: 100, label: 'the Enter the town control' });
}

async function browserFacts(cdp) {
  const value = await evaluateValue(cdp, `JSON.stringify({
    title: document.title,
    phase: document.querySelector('.stage')?.getAttribute('data-phase'),
    text: document.body.innerText,
    mainLabel: document.querySelector('main')?.getAttribute('aria-label'),
    hasWebsiteChrome: Boolean(document.querySelector('header, footer, nav')),
    canvasWidth: document.querySelector('canvas')?.width,
    canvasHeight: document.querySelector('canvas')?.height
  })`);
  const facts = JSON.parse(value);
  assert.equal(facts.title, 'Antiky game development');
  assert.equal(facts.phase, 'running');
  assert.equal(facts.mainLabel, 'Town Study development host');
  assert.equal(facts.hasWebsiteChrome, false);
  assert.ok(facts.text.includes('Pause'), 'The focused host pause control is missing.');
  assert.ok(facts.canvasWidth > 0 && facts.canvasHeight > 0, 'The focused host canvas is empty.');
  return facts;
}

let nextMcpRequestId = 1;

async function requestMcp(method, params = {}) {
  const id = nextMcpRequestId;
  nextMcpRequestId += 1;
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-11-25',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, `MCP ${method} returned ${response.status}`);
  const message = await response.json();
  assert.equal(message.id, id, `MCP ${method} returned the wrong response ID`);
  assert.equal(message.error, undefined, `MCP ${method} returned ${JSON.stringify(message.error)}`);
  return message.result;
}

async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'receipt.json' || entry.name.startsWith('.')) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function collectEnvironment() {
  const packageVersion = async (file) => JSON.parse(await readFile(file, 'utf8')).version;
  return {
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    osVersion: os.version(),
    node: process.version.slice(1),
    npm: await commandText('npm', ['--version']),
    typescript: await packageVersion(path.join(root, 'node_modules/typescript/package.json')),
    brometal: await packageVersion(path.join(root, 'packages/demos/node_modules/brometal/package.json')),
    vitest: await packageVersion(path.join(root, 'node_modules/vitest/package.json')),
    chrome: await commandText(chromePath, ['--version']),
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: { width: 756, height: 469 },
  };
}

export async function runSlice00Verification() {
  const runId = await selectRunId(outputRoot);
  const outputDirectory = path.join(outputRoot, runId);
  await mkdir(outputDirectory, { recursive: true });
  const unrelatedChanges = await assertImplementationTreeClean();
  const correlationId = `verify-${randomUUID()}`;
  const staging = await mkdtemp(path.join(os.tmpdir(), 'antiky-s00-verify-'));
  const logDirectory = path.join(staging, 'logs');
  const captureDirectory = path.join(staging, 'captures');
  await mkdir(captureDirectory, { recursive: true, mode: 0o700 });
  if (runId !== canonicalBaselineRunId) {
    await copyBaselineArtifacts(canonicalBaselineDirectory, staging);
  }

  let dev;
  let chrome;
  let cdp;
  let chromeProfile;
  let verificationError;
  const timing = {};
  const context = { runId, correlationId, timing };
  try {
    const checkStarted = performance.now();
    const check = await runLoggedCommand({
      command: 'npm', args: ['run', 'check'], cwd: root,
      logFile: path.join(logDirectory, 'check.log'), echo: true,
    });
    timing.checkMilliseconds = Math.round(performance.now() - checkStarted);
    assert.equal(check.code, 0, 'npm run check failed');
    const updateTiming = check.stdout.match(/median=(\d+)ms slowest=(\d+)ms/);
    assert.ok(updateTiming, 'update timing measurement was not reported');
    timing.updateMedianMilliseconds = Number(updateTiming[1]);
    timing.updateSlowestMilliseconds = Number(updateTiming[2]);
    await assertImplementationTreeClean();

    await assertPortsAvailable('127.0.0.1', [3010, 3011, 9322]);
    assert.equal(await exists(path.join(root, '.antiky/dev-session.json')), false, 'stale session descriptor exists');
    const devStarted = performance.now();
    dev = await startLoggedProcess({
      command: process.execPath,
      args: ['--experimental-strip-types', '--experimental-transform-types', 'packages/cli/src/bin.ts', 'dev'],
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0' },
      logFile: path.join(logDirectory, 'development.log'),
    });
    await waitFor(async () => {
      const response = await fetch(gameUrl, { signal: AbortSignal.timeout(1000) });
      return response.ok;
    }, { timeoutMilliseconds: 30_000, intervalMilliseconds: 200, label: 'the town route' });
    timing.gameReachableMilliseconds = Math.round(performance.now() - devStarted);
    const { connectDevelopmentClient } = await import('../packages/cli/src/development/client.ts');
    const client = await waitFor(() => connectDevelopmentClient(), {
      timeoutMilliseconds: 10_000, intervalMilliseconds: 100, label: 'the typed development client',
    });

    chromeProfile = await createChromeProfile();
    chrome = await startLoggedProcess({
      command: chromePath,
      args: createChromeArguments({ profile: chromeProfile, gameUrl }),
      cwd: root,
      logFile: path.join(logDirectory, 'chrome.log'),
    });
    let target = await waitForChromeTarget(9322, gameUrl);
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await enterRunningTown(cdp);
    const first = await waitFor(async () => {
      const snapshot = await client.readDevelopmentSnapshot();
      try { assertReadySnapshot(snapshot); return snapshot; } catch { return null; }
    }, { timeoutMilliseconds: 30_000, intervalMilliseconds: 100, label: 'the running WebGPU town' });
    timing.runningTownMilliseconds = Math.round(performance.now() - devStarted);
    const surface = await browserFacts(cdp);
    assert.equal(surface.canvasWidth, first.inspection.measurements.render.canvasWidth);
    assert.equal(surface.canvasHeight, first.inspection.measurements.render.canvasHeight);

    const cli = await runLoggedCommand({
      command: process.execPath,
      args: ['--experimental-strip-types', '--experimental-transform-types', 'packages/cli/src/bin.ts', 'inspect'],
      cwd: root, logFile: path.join(logDirectory, 'cli-inspect.log'), echo: false,
    });
    assert.equal(cli.code, 0, 'antiky inspect failed');
    const cliSnapshot = JSON.parse(cli.stdout);
    assertSnapshotParity(first, cliSnapshot, 'CLI');

    const initialized = await requestMcp('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'slice-00-verifier', version: '1' },
    });
    assert.deepEqual(initialized.capabilities, { tools: {} });
    const toolList = await requestMcp('tools/list');
    assert.deepEqual(toolList.tools.map((tool) => tool.name), requiredTools);
    const mcpRuntimeResult = await requestMcp('tools/call', {
      name: 'get_runtime_status', arguments: {},
    });
    assert.notEqual(mcpRuntimeResult.isError, true, 'MCP runtime inspection failed');
    const mcpRuntime = mcpRuntimeResult.structuredContent;
    assertSnapshotParity(first, {
      developmentSessionId: mcpRuntime.developmentSessionId,
      acceptedBuildRevision: mcpRuntime.acceptedBuildRevision,
      inspection: mcpRuntime.inspection,
    }, 'MCP');

    const reloadStarted = performance.now();
    const reloadTool = await requestMcp('tools/call', { name: 'dev_reload', arguments: {} });
    assert.notEqual(reloadTool.isError, true, 'MCP reload failed');
    const reload = reloadTool.structuredContent;
    timing.reloadMilliseconds = Math.round(performance.now() - reloadStarted);
    cdp.close();
    target = await waitForChromeTarget(9322, gameUrl);
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await enterRunningTown(cdp);
    const reloaded = await waitFor(async () => {
      const snapshot = await client.readDevelopmentSnapshot();
      try {
        assertReadySnapshot(snapshot);
        return snapshot.inspection.runtime.instanceId !== first.inspection.runtime.instanceId ? snapshot : null;
      } catch { return null; }
    }, { timeoutMilliseconds: 30_000, intervalMilliseconds: 100, label: 'the reloaded running town' });
    assert.equal(reload.developmentSessionId, first.developmentSessionId);
    assert.equal(reload.buildRevision, first.acceptedBuildRevision);
    assert.equal(reload.oldRuntimeInstanceId, first.inspection.runtime.instanceId);
    assert.equal(reload.newRuntimeInstanceId, reloaded.inspection.runtime.instanceId);

    const captureStarted = performance.now();
    const captureTool = await requestMcp('tools/call', { name: 'capture_frame', arguments: {} });
    assert.notEqual(captureTool.isError, true, 'MCP capture failed');
    const capture = captureTool.structuredContent;
    timing.captureMilliseconds = Math.round(performance.now() - captureStarted);
    assert.equal(capture.developmentSessionId, first.developmentSessionId);
    assert.equal(capture.runtimeInstanceId, reloaded.inspection.runtime.instanceId);
    assert.equal(capture.buildRevision, first.acceptedBuildRevision);
    const canvasCapture = path.join(captureDirectory, 'town-ready-canvas.png');
    await copyFile(capture.path, canvasCapture, constants.COPYFILE_EXCL);
    await chmod(canvasCapture, 0o600);
    const captureContent = await assertCaptureHasContent(canvasCapture);
    assert.deepEqual(
      { width: captureContent.width, height: captureContent.height },
      {
        width: reloaded.inspection.measurements.render.canvasWidth,
        height: reloaded.inspection.measurements.render.canvasHeight,
      },
    );
    const captureBytes = await readFile(canvasCapture);
    assert.equal(hash(captureBytes), capture.sha256);

    const pageCapture = path.join(captureDirectory, 'town-ready.png');
    const screenshot = await capturePageAtViewport(cdp, 756, 469);
    await writeFile(pageCapture, Buffer.from(screenshot, 'base64'), { flag: 'wx', mode: 0o600 });
    const pageMetadata = await sharp(pageCapture).metadata();
    assert.deepEqual({ width: pageMetadata.width, height: pageMetadata.height }, { width: 756, height: 469 });
    const visual = await comparePageCaptures(
      path.join(canonicalBaselineDirectory, 'captures/town-ready-canvas.png'),
      canvasCapture,
    );
    const minimumSimilarity = 0.72;
    assert.ok(visual.similarity >= minimumSimilarity, `town capture similarity ${visual.similarity} is below ${minimumSimilarity}`);
    await browserFacts(cdp);

    context.session = {
      developmentSessionId: first.developmentSessionId,
      acceptedBuildRevision: first.acceptedBuildRevision,
    };
    context.runtime = {
      beforeReload: first.inspection.runtime.instanceId,
      afterReload: reloaded.inspection.runtime.instanceId,
    };
    context.runtimeMeasurements = reloaded.inspection.measurements.runtime;
    context.render = reloaded.inspection.measurements.render;
    context.actions = {
      reloadActionId: reload.actionId,
      captureActionId: capture.actionId,
      captureId: capture.captureId,
      captureBytes: capture.byteLength,
      captureSha256: capture.sha256,
    };
    context.visual = {
      ...visual,
      minimumSimilarity,
      channelStandardDeviation: Number(captureContent.channelStandardDeviation.toFixed(3)),
      controls: ['Town Study development host', 'Pause', 'Movement controls'],
      surface,
    };
    context.mcp = { transport: 'streamable-http', tools: requiredTools };
  } catch (error) {
    verificationError = error;
  } finally {
    const cleanupStarted = performance.now();
    const cleanupErrors = [];
    if (cdp) cdp.close();
    await stopOwnedProcess(chrome).catch((error) => cleanupErrors.push(error));
    await stopOwnedProcess(dev).catch((error) => cleanupErrors.push(error));
    if (chromeProfile) await removeChromeProfile(chromeProfile).catch((error) => cleanupErrors.push(error));
    await assertPortsAvailable('127.0.0.1', [3010, 3011, 9322]).catch((error) => cleanupErrors.push(error));
    if (await exists(path.join(root, '.antiky/dev-session.json'))) {
      cleanupErrors.push(new Error('Session descriptor remained after cleanup.'));
    }
    timing.cleanupMilliseconds = Math.round(performance.now() - cleanupStarted);
    if (cleanupErrors.length > 0 && !verificationError) verificationError = new AggregateError(cleanupErrors, 'Cleanup failed.');
  }

  if (!verificationError) {
    try {
      assertChromeNetworkIsolation(await readFile(path.join(logDirectory, 'chrome.log'), 'utf8'));
    } catch (error) {
      verificationError = error;
    }
  }

  if (verificationError) {
    await rm(staging, { recursive: true, force: true });
    throw verificationError;
  }

  const finalRevision = await commandText('git', ['rev-parse', 'HEAD']);
  const sourceRevision = 'b05a078394bf455beb7ababf30aa187e22c74f68';
  const environment = await collectEnvironment();
  const configBytes = await readFile(path.join(root, 'antiky.config.json'));
  const lockBytes = await readFile(path.join(root, 'package-lock.json'));
  context.sourceRevision = sourceRevision;
  context.finalRevision = finalRevision;
  context.alignmentRevision = '441563bcce94abd76fb6813869e603e13f116b5a';
  context.checkpoints = await checkpointCommits();
  context.environment = environment;
  context.runSetup = {
    revision: finalRevision,
    branch: await commandText('git', ['branch', '--show-current']),
    worktree: root,
    implementationPathsClean: true,
    unrelatedPreservedChanges: unrelatedChanges,
    dependencyLockSha256: hash(lockBytes),
    configSha256: hash(configBytes),
    gameUrl,
    ports: { game: 3010, inspection: 3011, browserControl: 9322, tests: [43100, 43101] },
    browserProfile: 'dedicated temporary profile removed during cleanup',
    artifactDirectory: path.relative(root, outputDirectory),
    locale: environment.locale,
    timeZone: environment.timeZone,
    seed: 'N/A; Slice 00 adds no random game state.',
    network: 'Loopback only; Chrome maps non-loopback names to 0.0.0.0 and routes its proxy to closed 127.0.0.1:9. No deployment or external messages.',
    isolation: 'One open run, fixed free ports, one dedicated browser profile, and one unique staging directory.',
    retryRule: 'One retry only for a classified transient failure after unchanged health.',
    rollbackRevision: '2259d7b8c81aeb42d9513a95538e5109a886882e',
  };
  context.permissions = [
    { operation: 'repository writes', requiredCapability: 'workspace write', scope: 'approved Slice 00 code, tests, docs, and outputs', grantAndExpiry: 'owner goal; expires at closeout', revocation: 'corrective or revert commit', auditEvidence: 'checkpoint commits' },
    { operation: 'local services', requiredCapability: 'loopback bind', scope: '127.0.0.1 ports 3010, 3011, 43100, and 43101', grantAndExpiry: 'sandbox approval; expires at cleanup', revocation: 'owned process signals', auditEvidence: 'development and check logs' },
    { operation: 'local browser', requiredCapability: 'installed Chrome and loopback CDP', scope: 'temporary profile and port 9322', grantAndExpiry: 'sandbox approval; expires at cleanup', revocation: 'browser stop and profile removal', auditEvidence: 'capture and cleanup facts' },
    { operation: 'delivery', requiredCapability: 'Git checkpoint commit', scope: 'current branch only; no push or deployment', grantAndExpiry: 'repository instructions; expires at closeout', revocation: 'corrective or revert commit', auditEvidence: 'Git history' },
  ];
  context.tests = [
    { command: 'npm run check', status: 'PASS', evidence: 'logs/check.log' },
    { command: 'node --test scripts/slice-00-evidence.test.mjs scripts/verify-slice-00.test.mjs', status: 'PASS', evidence: 'included by npm run check' },
    { command: 'npm run verify:slice-00', status: 'PASS', evidence: correlationId },
  ];
  context.documentation = [
    'docs/user-facing-docs/framework/inspection.md',
    'docs/user-facing-docs/cli/development.md',
    'docs/user-facing-docs/studio/development-connection.md',
  ];
  context.cleanup = {
    descriptorRemoved: true,
    releasedPorts: [3010, 3011, 9322],
    browserProfileRemoved: true,
    ownedProcessesStopped: true,
  };

  await assertImplementationTreeClean();
  await copyTreeExclusive(staging, outputDirectory);
  const acceptance = createAcceptance(context);
  await writeJsonAtomic(path.join(outputDirectory, 'facts.json'), createFacts(context));
  await writeJsonAtomic(path.join(outputDirectory, 'measurements.json'), createMeasurements(context));
  await writeTextAtomic(path.join(outputDirectory, 'confirmation-checks.md'), createConfirmation(context, acceptance));
  const artifactPaths = (await filesUnder(outputDirectory)).sort();
  const artifacts = [
    { path: 'receipt.json', sha256: null, digestScope: 'canonical-json-with-null-self-digest' },
    ...await Promise.all(artifactPaths.map((file) => artifactFor(outputDirectory, file))),
  ];
  const receipt = sealReceipt(createReceipt(context, artifacts, acceptance));
  const receiptErrors = validateReceipt(receipt);
  assert.deepEqual(receiptErrors, [], receiptErrors.join('\n'));
  await writeReceiptAtomic(path.join(outputDirectory, 'receipt.json'), receipt);
  const artifactErrors = await validateArtifactDigests(receipt, outputDirectory);
  assert.deepEqual(artifactErrors, [], artifactErrors.join('\n'));
  await rm(staging, { recursive: true, force: true });
  process.stdout.write(`Slice 00 PASS: ${path.relative(root, path.join(outputDirectory, 'receipt.json'))}\n`);
  return { receipt, outputDirectory };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    await runSlice00Verification();
  } catch (error) {
    process.stderr.write(`Slice 00 FAIL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
