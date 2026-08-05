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

import {
  artifactFor,
  sealReceipt,
  validateArtifactDigests,
  validateReceipt,
  writeJsonAtomic,
  writeReceiptAtomic,
  writeTextAtomic,
} from './slice-01-evidence.mjs';
import { gpuProbeSource, summarizeGpuProbe } from './slice-01-gpu-probe.mjs';
import {
  createAcceptance,
  createConfirmation,
  createFacts,
  createMeasurements,
  createReceipt,
} from './slice-01-report.mjs';
import {
  assertIdleGpuDelta,
  assertRejectedPointLightState,
  assertSteadyGpuMatchesBaseline,
  gpuCounterDelta,
  pointLightStateVector,
  selectOpenSlice01Run,
} from './slice-01-verifier-core.mjs';
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
} from '../../../scripts/slice-00-runtime.mjs';
import {
  assertCaptureHasContent,
  assertChromeNetworkIsolation,
  assertReadySnapshot,
  capturePageAtViewport,
  comparePageCaptures,
  copyTreeExclusive,
  createChromeArguments,
  parseWorkingTreePaths,
} from '../../../scripts/slice-00-verifier-core.mjs';

const executeFile = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../../..');
const outputRoot = path.join(root, 'docs/objectives/antiky-town/slice-01/outputs');
const gameUrl = 'http://127.0.0.1:3010/';
const mcpUrl = 'http://127.0.0.1:3011/mcp';
const chromePath = process.env.ANTIKY_CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ports = [3010, 3011, 9322];
const ids = Object.freeze({
  world: '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
  marketLamp: '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
  proofLight: '018f0f3a-7b2c-7a1d-8e2f-123456789abe',
  unknownWorld: '018f0f3a-7b2c-7a1d-8e2f-123456789aee',
  unknownEntity: '018f0f3a-7b2c-7a1d-8e2f-123456789aef',
});
const commandIds = Object.freeze({
  change: '018f0f3a-7b2c-7a1d-8e2f-123456789ad0',
  correction: '018f0f3a-7b2c-7a1d-8e2f-123456789ad1',
  noOp: '018f0f3a-7b2c-7a1d-8e2f-123456789ad2',
  stale: '018f0f3a-7b2c-7a1d-8e2f-123456789ad3',
  outOfRange: '018f0f3a-7b2c-7a1d-8e2f-123456789ad4',
  missingEntity: '018f0f3a-7b2c-7a1d-8e2f-123456789ad5',
  missingWorld: '018f0f3a-7b2c-7a1d-8e2f-123456789ad6',
});
const requiredTools = Object.freeze([
  'get_dev_status',
  'get_latest_build',
  'get_runtime_status',
  'get_render_stats',
  'get_diagnostics',
  'list_point_lights',
  'get_point_light',
  'dev_reload',
  'capture_frame',
  'set_point_light_power',
  'correct_point_light_power',
]);
const allowedHumanOwnedChanges = new Set([
  'docs/objectives/antiky-town/SLICE_FEEDBACK_H.txt',
  'docs/objectives/antiky-town/slice-list.md',
]);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  const unexpected = paths.filter((file) => !allowedHumanOwnedChanges.has(file));
  assert.deepEqual(
    unexpected,
    [],
    `Slice 01 implementation paths are not clean:\n${unexpected.join('\n')}`,
  );
  return paths.filter((file) => allowedHumanOwnedChanges.has(file));
}

async function checkpointCommits() {
  const messages = [
    ['CP-00', 'Record Slice 01 baseline'],
    ['CP-01', 'Add lamp identity and data'],
    ['CP-02', 'Add market lamp command flow'],
    ['CP-03', 'Expose market lamp inspection'],
    ['CP-04', 'Connect market lamp rendering'],
    ['CP-05', 'Verify Antiky Town slice one'],
  ];
  const log = await commandText('git', ['log', '--format=%H%x09%s', '-100']);
  const rows = log.split('\n').map((line) => line.split('\t'));
  return messages.map(([id, message]) => {
    const match = rows.find(([, subject]) => subject === message);
    assert.ok(match, `${id} checkpoint commit is missing: ${message}`);
    return { id, commit: match[0], status: 'PASS' };
  });
}

async function evaluateValue(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

async function readGpuProbe(cdp) {
  const encoded = await evaluateValue(cdp, 'JSON.stringify(globalThis.__antikyGpuProbe)');
  assert.equal(typeof encoded, 'string', 'The GPU probe is unavailable.');
  const probe = JSON.parse(encoded);
  assert.equal(probe.installError, null, `The GPU probe failed: ${probe.installError}`);
  return probe;
}

async function clickControl(cdp, selector, expectedText) {
  const clicked = await evaluateValue(cdp, `(() => {
    const control = document.querySelector(${JSON.stringify(selector)});
    if (!control || !control.textContent?.includes(${JSON.stringify(expectedText)})) return false;
    control.click();
    return true;
  })()`);
  assert.equal(clicked, true, `The ${expectedText} control is unavailable.`);
}

async function pauseTown(cdp) {
  const phase = await evaluateValue(cdp, "document.querySelector('.stage')?.getAttribute('data-phase')");
  if (phase === 'running') await clickControl(cdp, '.stage-pause', 'Pause');
  await waitFor(async () => (
    await evaluateValue(cdp, "document.querySelector('.stage')?.getAttribute('data-phase')") === 'paused'
  ), { timeoutMilliseconds: 5_000, intervalMilliseconds: 50, label: 'the paused town' });
  let prior = await readGpuProbe(cdp);
  await waitFor(async () => {
    await delay(100);
    const current = await readGpuProbe(cdp);
    if (current.queueSubmissions !== prior.queueSubmissions) {
      prior = current;
      return null;
    }
    return current;
  }, { timeoutMilliseconds: 5_000, intervalMilliseconds: 25, label: 'a stable paused GPU boundary' });
}

async function resumeAndMeasure(cdp) {
  const start = (await readGpuProbe(cdp)).queueSubmissions;
  await clickControl(cdp, '.stage-activate', 'Resume study');
  await waitFor(async () => {
    const probe = await readGpuProbe(cdp);
    return probe.queueSubmissions >= start + 75 ? probe : null;
  }, { timeoutMilliseconds: 15_000, intervalMilliseconds: 50, label: '25 completed town frames' });
  await pauseTown(cdp);
  const raw = await readGpuProbe(cdp);
  return { raw, steady: summarizeGpuProbe(raw, 20) };
}

async function browserFacts(cdp) {
  const value = await evaluateValue(cdp, `JSON.stringify({
    title: document.title,
    phase: document.querySelector('.stage')?.getAttribute('data-phase'),
    mainLabel: document.querySelector('main')?.getAttribute('aria-label'),
    websiteChrome: Boolean(document.querySelector('header, footer, nav')),
    canvas: {
      width: document.querySelector('canvas')?.width,
      height: document.querySelector('canvas')?.height,
    },
  })`);
  const facts = JSON.parse(value);
  assert.equal(facts.title, 'Antiky game development');
  assert.equal(facts.mainLabel, 'Antiky Town development host');
  assert.equal(facts.websiteChrome, false);
  assert.ok(['running', 'paused'].includes(facts.phase));
  assert.ok(facts.canvas.width > 0 && facts.canvas.height > 0);
  return facts;
}

let nextMcpRequestId = 1;

async function requestMcp(transcript, method, params = {}) {
  const id = nextMcpRequestId;
  nextMcpRequestId += 1;
  const request = { jsonrpc: '2.0', id, method, params };
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-11-25',
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, `MCP ${method} returned ${response.status}.`);
  const message = await response.json();
  transcript.push({ request, response: message });
  assert.equal(message.id, id, `MCP ${method} returned the wrong response ID.`);
  assert.equal(message.error, undefined, `MCP ${method} returned ${JSON.stringify(message.error)}.`);
  return message.result;
}

async function waitForSnapshot(client, predicate, label) {
  return waitFor(async () => {
    const snapshot = await client.readDevelopmentSnapshot();
    return predicate(snapshot) ? snapshot : null;
  }, { timeoutMilliseconds: 15_000, intervalMilliseconds: 50, label });
}

function setCommand(commandId, expectedRevision, power, overrides = {}) {
  return {
    protocolVersion: 1,
    commandVersion: 1,
    type: 'antiky.authoring.set-point-light-power',
    commandId,
    worldId: ids.world,
    entityId: ids.marketLamp,
    expectedRevision,
    data: { power },
    ...overrides,
  };
}

function assertInitialPointLights(snapshot) {
  const inspection = snapshot.inspection?.pointLights;
  assert.ok(inspection, 'The Antiky Town point-light inspection is missing.');
  assert.equal(inspection.owner, 'framework');
  assert.equal(inspection.worldId, ids.world);
  assert.equal(inspection.eventSequence, 0);
  assert.equal(inspection.authoring.length, 2);
  const market = inspection.authoring.find((entry) => entry.entityId === ids.marketLamp);
  const proof = inspection.authoring.find((entry) => entry.entityId === ids.proofLight);
  assert.deepEqual(market, {
    worldId: ids.world,
    entityId: ids.marketLamp,
    label: 'Market Lamp West 01',
    revision: 1,
    transform: { schemaVersion: 1, position: [-3.565, 4.237, 6.82] },
    pointLight: { schemaVersion: 1, color: [1, 0.52, 0.22], radius: 4, power: 1.05 },
  });
  assert.deepEqual(proof, {
    worldId: ids.world,
    entityId: ids.proofLight,
    label: 'Headless Point Light Proof',
    revision: 1,
    transform: { schemaVersion: 1, position: [0, 0, 0] },
    pointLight: { schemaVersion: 1, color: [0.5, 0.75, 1], radius: 2, power: 0.5 },
  });
  assert.deepEqual(inspection.render.pointLights.map((entry) => entry.entityId), [ids.marketLamp]);
  assert.deepEqual(inspection.render.dirtySlots, []);
  assert.deepEqual(inspection.facts, []);
  return { market, proof };
}

function assertPointLightParity(expected, actual, label) {
  assert.equal(actual.developmentSessionId, expected.developmentSessionId, `${label} session differs.`);
  assert.equal(actual.inspection?.runtime.instanceId, expected.inspection?.runtime.instanceId, `${label} runtime differs.`);
  assert.deepEqual(actual.inspection?.pointLights, expected.inspection?.pointLights, `${label} point-light snapshot differs.`);
}

async function captureCanvas(transcript, destination) {
  const result = await requestMcp(transcript, 'tools/call', {
    name: 'capture_frame',
    arguments: {},
  });
  assert.notEqual(result.isError, true, 'The MCP canvas capture failed.');
  const capture = result.structuredContent;
  await copyFile(capture.path, destination, constants.COPYFILE_EXCL);
  await chmod(destination, 0o600);
  const content = await assertCaptureHasContent(destination);
  const bytes = await readFile(destination);
  assert.equal(hash(bytes), capture.sha256);
  return { capture, content };
}

async function captureHost(cdp, destination) {
  const screenshot = await capturePageAtViewport(cdp, 756, 469);
  await writeFile(destination, Buffer.from(screenshot, 'base64'), { flag: 'wx', mode: 0o600 });
  return assertCaptureHasContent(destination);
}

async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
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

export async function runSlice01Verification() {
  const runId = await selectOpenSlice01Run(outputRoot);
  const outputDirectory = path.join(outputRoot, runId);
  const baseline = JSON.parse(await readFile(path.join(outputDirectory, 'baseline.json'), 'utf8'));
  assert.equal(baseline.runState, 'OPEN');
  assert.equal(baseline.referencePointLight.power, 1.05);
  const preservedHumanOwnedChanges = await assertImplementationTreeClean();
  const correlationId = `verify-${randomUUID()}`;
  const staging = await mkdtemp(path.join(os.tmpdir(), 'antiky-s01-verify-'));
  const logDirectory = path.join(staging, 'logs');
  const captureDirectory = path.join(staging, 'captures');
  await mkdir(captureDirectory, { recursive: true, mode: 0o700 });

  let dev;
  let chrome;
  let cdp;
  let chromeProfile;
  let verificationError;
  let context;
  const timing = {};
  const transcript = [];
  try {
    const checkStarted = performance.now();
    const check = await runLoggedCommand({
      command: 'npm',
      args: ['run', 'check'],
      cwd: root,
      logFile: path.join(logDirectory, 'verification-check.log'),
      echo: true,
    });
    timing.repositoryCheck = Math.round(performance.now() - checkStarted);
    assert.equal(check.code, 0, 'npm run check failed.');
    await assertImplementationTreeClean();

    await assertPortsAvailable('127.0.0.1', ports);
    assert.equal(await exists(path.join(root, '.antiky/dev-session.json')), false, 'A stale development descriptor exists.');
    const devStarted = performance.now();
    dev = await startLoggedProcess({
      command: 'npm',
      args: ['run', 'antiky', 'dev'],
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0' },
      logFile: path.join(logDirectory, 'verification-development.log'),
    });
    await waitFor(async () => {
      const response = await fetch(gameUrl, { signal: AbortSignal.timeout(1_000) });
      return response.ok;
    }, { timeoutMilliseconds: 30_000, intervalMilliseconds: 200, label: 'the focused Antiky Town host' });
    timing.gameReachable = Math.round(performance.now() - devStarted);

    const { connectDevelopmentClient } = await import('../../cli/src/development/client.ts');
    const client = await waitFor(() => connectDevelopmentClient(), {
      timeoutMilliseconds: 10_000,
      intervalMilliseconds: 100,
      label: 'the typed development client',
    });

    chromeProfile = await createChromeProfile();
    chrome = await startLoggedProcess({
      command: chromePath,
      args: createChromeArguments({ profile: chromeProfile, gameUrl: 'about:blank' }),
      cwd: root,
      logFile: path.join(logDirectory, 'verification-chrome.log'),
    });
    let target = await waitForChromeTarget(9322, 'about:blank');
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: gpuProbeSource });
    await cdp.send('Page.navigate', { url: gameUrl });
    await waitFor(async () => {
      const probe = await readGpuProbe(cdp).catch(() => null);
      const phase = await evaluateValue(cdp, "document.querySelector('.stage')?.getAttribute('data-phase')").catch(() => null);
      return phase === 'running' && probe?.queueSubmissions >= 90;
    }, { timeoutMilliseconds: 45_000, intervalMilliseconds: 100, label: 'the instrumented running Antiky Town' });

    const initial = await waitForSnapshot(client, (snapshot) => {
      try {
        assertReadySnapshot(snapshot);
        return pointLightStateVector(snapshot, ids.marketLamp).revision === 1;
      } catch {
        return false;
      }
    }, 'the initial point-light snapshot');
    timing.runningTown = Math.round(performance.now() - devStarted);
    const initialRecords = assertInitialPointLights(initial);
    const surface = await browserFacts(cdp);
    assert.equal(surface.canvas.width, initial.inspection.measurements.render.canvasWidth);
    assert.equal(surface.canvas.height, initial.inspection.measurements.render.canvasHeight);

    const initialized = await requestMcp(transcript, 'initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'antiky-slice-01-verifier', version: '1' },
    });
    assert.deepEqual(initialized.capabilities, { tools: {} });
    const toolList = await requestMcp(transcript, 'tools/list');
    assert.deepEqual(toolList.tools.map((tool) => tool.name), requiredTools);
    const initialList = await requestMcp(transcript, 'tools/call', {
      name: 'list_point_lights', arguments: {},
    });
    assert.notEqual(initialList.isError, true);
    assert.deepEqual(initialList.structuredContent, await client.listPointLights());
    const initialDetails = await requestMcp(transcript, 'tools/call', {
      name: 'get_point_light', arguments: { entityId: ids.marketLamp },
    });
    assert.notEqual(initialDetails.isError, true);
    assert.deepEqual(initialDetails.structuredContent, await client.getPointLight(ids.marketLamp));

    await pauseTown(cdp);
    const pausedInitial = await waitForSnapshot(
      client,
      (snapshot) => snapshot.inspection?.runtime.lifecycle === 'paused',
      'the published paused runtime',
    );
    const initialState = pointLightStateVector(pausedInitial, ids.marketLamp);
    assert.deepEqual(initialState, {
      authoringPower: 1.05,
      revision: 1,
      factCount: 0,
      runtimePower: 1.05,
      renderPower: 1.05,
      dirtyCount: 0,
    });

    const changeGpuBefore = await readGpuProbe(cdp);
    const changeStarted = performance.now();
    const changeTool = await requestMcp(transcript, 'tools/call', {
      name: 'set_point_light_power',
      arguments: {
        commandId: commandIds.change,
        worldId: ids.world,
        entityId: ids.marketLamp,
        expectedRevision: 1,
        power: 2,
      },
    });
    timing.changeCommand = Math.round(performance.now() - changeStarted);
    assert.notEqual(changeTool.isError, true, 'The accepted MCP change failed.');
    const changeResult = changeTool.structuredContent;
    assert.deepEqual({
      code: changeResult.code,
      accepted: changeResult.accepted,
      currentRevision: changeResult.currentRevision,
      resultingRevision: changeResult.resultingRevision,
      eventSequence: changeResult.eventSequence,
    }, {
      code: 'ACCEPTED',
      accepted: true,
      currentRevision: 1,
      resultingRevision: 2,
      eventSequence: 1,
    });
    assert.deepEqual({
      oldPower: changeResult.fact.oldPower,
      newPower: changeResult.fact.newPower,
      sourceCommandId: changeResult.fact.sourceCommandId,
    }, { oldPower: 1.05, newPower: 2, sourceCommandId: commandIds.change });
    const changedBeforeFrame = await waitForSnapshot(client, (snapshot) => {
      const vector = pointLightStateVector(snapshot, ids.marketLamp);
      return vector.revision === 2 && vector.dirtyCount === 1;
    }, 'the accepted dirty point-light projection');
    assert.deepEqual(changedBeforeFrame.inspection.pointLights.render.dirtySlots, [0]);
    const changeDelta = gpuCounterDelta(changeGpuBefore, await readGpuProbe(cdp));
    assertIdleGpuDelta(changeDelta);

    const rejectionRecords = [];
    const rejectionGpuBefore = await readGpuProbe(cdp);
    const runRejection = async (fixture, expectedCode, operation) => {
      const beforeSnapshot = await client.readDevelopmentSnapshot();
      const before = pointLightStateVector(beforeSnapshot, ids.marketLamp);
      const result = await operation();
      const afterSnapshot = await client.readDevelopmentSnapshot();
      const after = pointLightStateVector(afterSnapshot, ids.marketLamp);
      assertRejectedPointLightState({ before, after, result, expectedCode });
      rejectionRecords.push({ fixture, code: result.code, before, after, result });
    };
    await runRejection('same value', 'NO_OP', () => client.setPointLightPower(
      setCommand(commandIds.noOp, 2, 2),
    ));
    await runRejection('duplicate command', 'DUPLICATE_COMMAND', () => client.setPointLightPower(
      setCommand(commandIds.change, 2, 3),
    ));
    await runRejection('stale revision', 'STALE_REVISION', () => client.setPointLightPower(
      setCommand(commandIds.stale, 1, 3),
    ));
    await runRejection('out-of-range value', 'VALUE_OUT_OF_RANGE', () => client.setPointLightPower(
      setCommand(commandIds.outOfRange, 2, 4.01),
    ));
    await runRejection('unknown entity', 'ENTITY_NOT_FOUND', () => client.setPointLightPower(
      setCommand(commandIds.missingEntity, 2, 3, { entityId: ids.unknownEntity }),
    ));
    await runRejection('unknown world', 'WORLD_NOT_FOUND', () => client.setPointLightPower(
      setCommand(commandIds.missingWorld, 2, 3, { worldId: ids.unknownWorld }),
    ));
    await runRejection('malformed command', 'INVALID_COMMAND', () => client.setPointLightPower({}));
    const rejectionDelta = gpuCounterDelta(rejectionGpuBefore, await readGpuProbe(cdp));
    assertIdleGpuDelta(rejectionDelta);
    rejectionRecords.push({
      fixture: 'missing permission',
      code: 'MISSING_PERMISSION',
      stateInvariant: 'PASS',
      proof: 'Framework six-value regression in logs/verification-check.log; the local host intentionally owns trusted capability context.',
    });

    const changedMeasurement = await resumeAndMeasure(cdp);
    assertSteadyGpuMatchesBaseline(changedMeasurement.steady, baseline.gpu.steady);
    const changedAfterFrame = await waitForSnapshot(client, (snapshot) => {
      const vector = pointLightStateVector(snapshot, ids.marketLamp);
      return vector.revision === 2 && vector.dirtyCount === 0
        && snapshot.inspection?.runtime.lifecycle === 'paused';
    }, 'the acknowledged changed frame');
    const changedCanvas = path.join(captureDirectory, 'changed.png');
    const changedCapture = await captureCanvas(transcript, changedCanvas);
    const changedHost = path.join(captureDirectory, 'changed-host.png');
    await captureHost(cdp, changedHost);

    const correctionGpuBefore = await readGpuProbe(cdp);
    const correctionStarted = performance.now();
    const correctionTool = await requestMcp(transcript, 'tools/call', {
      name: 'correct_point_light_power',
      arguments: {
        commandId: commandIds.correction,
        correctedCommandId: commandIds.change,
        expectedRevision: 2,
      },
    });
    timing.correctionCommand = Math.round(performance.now() - correctionStarted);
    assert.notEqual(correctionTool.isError, true, 'The MCP correction failed.');
    const correctionResult = correctionTool.structuredContent;
    assert.deepEqual({
      code: correctionResult.code,
      accepted: correctionResult.accepted,
      currentRevision: correctionResult.currentRevision,
      resultingRevision: correctionResult.resultingRevision,
      eventSequence: correctionResult.eventSequence,
      oldPower: correctionResult.fact.oldPower,
      newPower: correctionResult.fact.newPower,
      correctionOf: correctionResult.fact.correctionOf,
    }, {
      code: 'ACCEPTED',
      accepted: true,
      currentRevision: 2,
      resultingRevision: 3,
      eventSequence: 2,
      oldPower: 2,
      newPower: 1.05,
      correctionOf: commandIds.change,
    });
    const correctedBeforeFrame = await waitForSnapshot(client, (snapshot) => {
      const vector = pointLightStateVector(snapshot, ids.marketLamp);
      return vector.revision === 3 && vector.dirtyCount === 1;
    }, 'the correction dirty projection');
    assert.deepEqual(correctedBeforeFrame.inspection.pointLights.render.dirtySlots, [0]);
    const correctionDelta = gpuCounterDelta(correctionGpuBefore, await readGpuProbe(cdp));
    assertIdleGpuDelta(correctionDelta);

    const correctedMeasurement = await resumeAndMeasure(cdp);
    assertSteadyGpuMatchesBaseline(correctedMeasurement.steady, baseline.gpu.steady);
    const correctedAfterFrame = await waitForSnapshot(client, (snapshot) => {
      const vector = pointLightStateVector(snapshot, ids.marketLamp);
      return vector.revision === 3 && vector.dirtyCount === 0
        && snapshot.inspection?.runtime.lifecycle === 'paused';
    }, 'the acknowledged corrected frame');
    const correctedCanvas = path.join(captureDirectory, 'corrected.png');
    const correctedCapture = await captureCanvas(transcript, correctedCanvas);
    const correctedHost = path.join(captureDirectory, 'corrected-host.png');
    await captureHost(cdp, correctedHost);

    const baselineCanvas = path.join(outputDirectory, 'captures/before.png');
    const correctedToBaseline = await comparePageCaptures(baselineCanvas, correctedCanvas);
    const changedToCorrected = await comparePageCaptures(changedCanvas, correctedCanvas);
    const minimumCorrectedToBaselineSimilarity = 0.98;
    assert.ok(
      correctedToBaseline.similarity >= minimumCorrectedToBaselineSimilarity,
      `Corrected town similarity ${correctedToBaseline.similarity} is below ${minimumCorrectedToBaselineSimilarity}.`,
    );
    const baselineSha256 = hash(await readFile(baselineCanvas));
    const changedSha256 = hash(await readFile(changedCanvas));
    const correctedSha256 = hash(await readFile(correctedCanvas));
    assert.notEqual(changedSha256, correctedSha256, 'Changed and corrected captures are identical.');

    const studioClient = await connectDevelopmentClient();
    const directSnapshot = await client.readDevelopmentSnapshot();
    const studioSnapshot = await studioClient.readDevelopmentSnapshot();
    assertPointLightParity(directSnapshot, studioSnapshot, 'Studio-compatible client');
    const cli = await runLoggedCommand({
      command: process.execPath,
      args: [
        '--experimental-strip-types',
        '--experimental-transform-types',
        'packages/cli/src/bin.ts',
        'inspect',
      ],
      cwd: root,
      logFile: path.join(logDirectory, 'cli-inspect.json'),
      echo: false,
    });
    assert.equal(cli.code, 0, 'antiky inspect failed.');
    const cliSnapshot = JSON.parse(cli.stdout);
    assertPointLightParity(directSnapshot, cliSnapshot, 'CLI');
    const mcpRuntime = await requestMcp(transcript, 'tools/call', {
      name: 'get_runtime_status', arguments: {},
    });
    assert.notEqual(mcpRuntime.isError, true);
    assertPointLightParity(directSnapshot, {
      developmentSessionId: mcpRuntime.structuredContent.developmentSessionId,
      inspection: mcpRuntime.structuredContent.inspection,
    }, 'MCP');
    const directDetails = await client.getPointLight(ids.marketLamp);
    const studioDetails = await studioClient.getPointLight(ids.marketLamp);
    const mcpDetails = await requestMcp(transcript, 'tools/call', {
      name: 'get_point_light', arguments: { entityId: ids.marketLamp },
    });
    assert.deepEqual(studioDetails, directDetails);
    assert.deepEqual(mcpDetails.structuredContent, directDetails);

    await writeFile(
      path.join(logDirectory, 'gpu-command-and-frame-probe.json'),
      `${JSON.stringify(correctedMeasurement.raw, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    const reloadStarted = performance.now();
    const reloadTool = await requestMcp(transcript, 'tools/call', { name: 'dev_reload', arguments: {} });
    assert.notEqual(reloadTool.isError, true, 'MCP reload failed.');
    const reload = reloadTool.structuredContent;
    timing.reload = Math.round(performance.now() - reloadStarted);
    cdp.close();
    target = await waitForChromeTarget(9322, gameUrl);
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    const reloaded = await waitForSnapshot(client, (snapshot) => {
      try {
        assertReadySnapshot(snapshot);
        const vector = pointLightStateVector(snapshot, ids.marketLamp);
        return snapshot.inspection.runtime.instanceId !== initial.inspection.runtime.instanceId
          && vector.revision === 1
          && vector.authoringPower === 1.05
          && vector.factCount === 0;
      } catch {
        return false;
      }
    }, 'the rebuilt point-light runtime');
    assertInitialPointLights(reloaded);
    assert.equal(reload.developmentSessionId, initial.developmentSessionId);
    assert.equal(reload.oldRuntimeInstanceId, initial.inspection.runtime.instanceId);
    assert.equal(reload.newRuntimeInstanceId, reloaded.inspection.runtime.instanceId);
    const reconnectedClient = await connectDevelopmentClient();
    assert.deepEqual(
      await reconnectedClient.getPointLight(ids.marketLamp),
      await client.getPointLight(ids.marketLamp),
    );
    await writeFile(
      path.join(logDirectory, 'mcp-transcript.json'),
      `${JSON.stringify(transcript, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );

    const { findDemo } = await import('../src/catalog.ts');
    assert.equal(findDemo('antiky-town')?.title, 'Antiky Town');
    assert.equal(findDemo('town-study')?.title, 'Town Study');

    context = {
      runId,
      correlationId,
      timing,
      ids,
      session: {
        developmentSessionId: initial.developmentSessionId,
        acceptedBuildRevision: initial.acceptedBuildRevision,
      },
      runtimes: {
        initial: initial.inspection.runtime.instanceId,
        reloaded: reloaded.inspection.runtime.instanceId,
      },
      pointLights: {
        marketLamp: initialRecords.market,
        proofLight: initialRecords.proof,
      },
      states: {
        initial: initialState,
        changedBeforeFrame: pointLightStateVector(changedBeforeFrame, ids.marketLamp),
        changedAfterFrame: pointLightStateVector(changedAfterFrame, ids.marketLamp),
        correctedBeforeFrame: pointLightStateVector(correctedBeforeFrame, ids.marketLamp),
        correctedAfterFrame: pointLightStateVector(correctedAfterFrame, ids.marketLamp),
        afterReload: pointLightStateVector(reloaded, ids.marketLamp),
      },
      commands: {
        change: {
          commandId: commandIds.change,
          transport: 'MCP Tool over the antiky dev HTTP endpoint',
          result: changeResult,
        },
        correction: {
          commandId: commandIds.correction,
          transport: 'MCP Tool over the antiky dev HTTP endpoint',
          result: correctionResult,
        },
      },
      rejections: rejectionRecords,
      gpu: {
        baseline: baseline.gpu.steady,
        changed: changedMeasurement.steady,
        corrected: correctedMeasurement.steady,
        changeDelta,
        rejectionDelta,
        correctionDelta,
      },
      visual: {
        baselineSha256,
        changedSha256,
        correctedSha256,
        correctedToBaseline,
        changedToCorrected,
        minimumCorrectedToBaselineSimilarity,
        changedChannelStandardDeviation: Number(changedCapture.content.channelStandardDeviation.toFixed(3)),
        correctedChannelStandardDeviation: Number(correctedCapture.content.channelStandardDeviation.toFixed(3)),
        surface,
      },
      render: correctedAfterFrame.inspection.measurements.render,
      mcp: { tools: requiredTools },
      reload,
      captures: {
        changed: changedCapture.capture,
        corrected: correctedCapture.capture,
      },
    };
  } catch (error) {
    verificationError = error;
  } finally {
    const cleanupStarted = performance.now();
    const cleanupErrors = [];
    if (cdp) cdp.close();
    await stopOwnedProcess(chrome).catch((error) => cleanupErrors.push(error));
    let devExit = null;
    await stopOwnedProcess(dev).then((exit) => { devExit = exit; }).catch((error) => cleanupErrors.push(error));
    if (chromeProfile) await removeChromeProfile(chromeProfile).catch((error) => cleanupErrors.push(error));
    await assertPortsAvailable('127.0.0.1', ports).catch((error) => cleanupErrors.push(error));
    const descriptorRemoved = !await exists(path.join(root, '.antiky/dev-session.json'));
    if (!descriptorRemoved) cleanupErrors.push(new Error('The development session descriptor remained after cleanup.'));
    timing.cleanup = Math.round(performance.now() - cleanupStarted);
    if (context) {
      context.cleanup = {
        devExit,
        ownedProcessesStopped: true,
        browserProfileRemoved: true,
        descriptorRemoved,
        releasedPorts: ports,
      };
    }
    if (cleanupErrors.length > 0 && !verificationError) {
      verificationError = new AggregateError(cleanupErrors, 'Slice 01 cleanup failed.');
    }
  }

  if (!verificationError) {
    try {
      assertChromeNetworkIsolation(await readFile(path.join(logDirectory, 'verification-chrome.log'), 'utf8'));
    } catch (error) {
      verificationError = error;
    }
  }
  if (verificationError) {
    await rm(staging, { recursive: true, force: true });
    throw verificationError;
  }

  const finalRevision = await commandText('git', ['rev-parse', 'HEAD']);
  const environment = await collectEnvironment();
  const configBytes = await readFile(path.join(root, 'antiky.config.json'));
  const lockBytes = await readFile(path.join(root, 'package-lock.json'));
  context.sourceRevision = baseline.runSetup.revision;
  context.finalRevision = finalRevision;
  context.alignmentRevision = await commandText('git', ['rev-parse', '8288730']);
  context.checkpoints = await checkpointCommits();
  context.environment = environment;
  context.runSetup = {
    revision: finalRevision,
    branch: await commandText('git', ['branch', '--show-current']),
    worktree: root,
    implementationPathsClean: true,
    preservedHumanOwnedChanges,
    dependencyLockSha256: hash(lockBytes),
    configSha256: hash(configBytes),
    gameUrl,
    demoSlug: 'antiky-town',
    ports: { game: 3010, inspectionAndMcp: 3011, browserControl: 9322 },
    browserProfile: 'Dedicated temporary profile removed during cleanup.',
    artifactDirectory: path.relative(root, outputDirectory),
    locale: environment.locale,
    timeZone: environment.timeZone,
    seed: 'N/A; authored power changes preserve the existing presentation flicker.',
    network: 'Loopback only; Chrome maps non-loopback names to 0.0.0.0 and routes its proxy to closed 127.0.0.1:9.',
    isolation: 'One open evidence run, one npm run antiky dev start, fixed free ports, one browser profile, and one staging directory.',
    retryRule: 'One retry only for a classified transient failure after unchanged health.',
    rollbackRevision: await commandText('git', ['rev-parse', '9c4469f']),
  };
  context.permissions = [
    { operation: 'repository writes', requiredCapability: 'workspace write', scope: 'Slice 01 verifier, tests, plan, and outputs', grantAndExpiry: 'owner goal; expires at closeout', revocation: 'corrective or revert commit', auditEvidence: 'checkpoint commits' },
    { operation: 'local services', requiredCapability: 'loopback bind', scope: '127.0.0.1 ports 3010 and 3011', grantAndExpiry: 'sandbox approval; expires at cleanup', revocation: 'owned process signals', auditEvidence: 'verification development log' },
    { operation: 'local browser', requiredCapability: 'installed Chrome and loopback CDP', scope: 'temporary profile and port 9322', grantAndExpiry: 'sandbox approval; expires at cleanup', revocation: 'browser stop and profile removal', auditEvidence: 'captures and cleanup facts' },
    { operation: 'delivery', requiredCapability: 'Git checkpoint commit', scope: 'current branch only; no push or deployment', grantAndExpiry: 'repository instructions; expires at closeout', revocation: 'corrective or revert commit', auditEvidence: 'Git history' },
  ];
  context.tests = [
    { command: 'npm run check', status: 'PASS', evidence: 'logs/verification-check.log' },
    { command: 'npm test --workspace @antiky/demos', status: 'PASS', evidence: 'included by npm run check' },
    { command: 'npm test --workspace @antiky/framework', status: 'PASS', evidence: 'included by npm run check' },
    { command: 'npm test --workspace @antiky/cli', status: 'PASS', evidence: 'included by npm run check' },
    { command: 'npm run verify:slice-01 --workspace @antiky/demos', status: 'PASS', evidence: correlationId },
  ];
  context.documentation = [
    { path: 'docs/user-facing-docs/framework/point-lights.md', status: 'PASS' },
    { path: 'docs/user-facing-docs/framework/inspection.md', status: 'PASS' },
    { path: 'docs/user-facing-docs/cli/development.md', status: 'PASS' },
    {
      path: 'docs/user-facing-docs/studio/development-connection.md',
      status: 'N/A',
      reason: 'The Studio connection workflow and typed client contract did not change in Slice 01.',
    },
  ];

  await assertImplementationTreeClean();
  const acceptance = createAcceptance(context);
  await writeJsonAtomic(path.join(staging, 'facts.json'), createFacts(context));
  await writeJsonAtomic(path.join(staging, 'measurements.json'), createMeasurements(context));
  await writeTextAtomic(
    path.join(staging, 'confirmation-checks.md'),
    createConfirmation(context, acceptance),
  );

  const existingPaths = await filesUnder(outputDirectory);
  const stagedPaths = await filesUnder(staging);
  const duplicates = stagedPaths.filter((file) => existingPaths.includes(file));
  assert.deepEqual(duplicates, [], `Verifier artifacts would overwrite baseline evidence: ${duplicates.join(', ')}.`);
  const artifacts = [
    { path: 'receipt.json', sha256: null, digestScope: 'canonical-json-with-null-self-digest' },
    ...await Promise.all(existingPaths.map((file) => artifactFor(outputDirectory, file))),
    ...await Promise.all(stagedPaths.map((file) => artifactFor(staging, file))),
  ];
  artifacts.splice(1, artifacts.length - 1, ...artifacts.slice(1).sort((left, right) => (
    left.path.localeCompare(right.path)
  )));
  const receipt = sealReceipt(createReceipt(context, artifacts, acceptance));
  const receiptErrors = validateReceipt(receipt);
  assert.deepEqual(receiptErrors, [], receiptErrors.join('\n'));

  await copyTreeExclusive(staging, outputDirectory);
  await writeReceiptAtomic(path.join(outputDirectory, 'receipt.json'), receipt);
  const artifactErrors = await validateArtifactDigests(receipt, outputDirectory);
  assert.deepEqual(artifactErrors, [], artifactErrors.join('\n'));
  await rm(staging, { recursive: true, force: true });
  process.stdout.write(`Slice 01 PASS: ${path.relative(root, path.join(outputDirectory, 'receipt.json'))}\n`);
  return { receipt, outputDirectory };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    await runSlice01Verification();
  } catch (error) {
    process.stderr.write(
      `Slice 01 FAIL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
