import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
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
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  assertPortsAvailable,
  CdpClient,
  startLoggedProcess,
  stopOwnedProcess,
  waitFor,
  waitForChromeTarget,
} from '../../../scripts/slice-00-runtime.mjs';
import {
  assertCaptureHasContent,
  assertChromeNetworkIsolation,
  capturePageAtViewport,
  copyTreeExclusive,
  createChromeArguments,
  parseWorkingTreePaths,
} from '../../../scripts/slice-00-verifier-core.mjs';
import { gpuProbeSource, summarizeGpuProbe } from './slice-01-gpu-probe.mjs';

const executeFile = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../../..');
const outputRoot = path.join(root, 'docs/objectives/antiky-town/slice-01/outputs');
const gameUrl = 'http://127.0.0.1:3010/';
const mcpUrl = 'http://127.0.0.1:3011/mcp';
const chromePath = process.env.ANTIKY_CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ports = [3010, 3011, 9322];

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

export function formatSlice01RunId(date) {
  return `s01-${date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')}`;
}

export function extractReferencePointLight(source) {
  const match = source.match(
    /const PRACTICAL_LIGHTS = \[\s*\{\s*position:\s*\[([^\]]+)\],\s*radius:\s*([^,]+),\s*power:\s*([^,]+),\s*color:\s*\[([^\]]+)\]/,
  );
  if (!match) throw new Error('The first practical light could not be read from the town source.');
  const numbers = (value) => value.split(',').map((part) => Number(part.trim()));
  const pointLight = {
    renderSlot: 0,
    position: numbers(match[1]),
    radius: Number(match[2].trim()),
    power: Number(match[3].trim()),
    color: numbers(match[4]),
  };
  if (
    pointLight.position.length !== 3
    || pointLight.color.length !== 3
    || ![...pointLight.position, pointLight.radius, pointLight.power, ...pointLight.color]
      .every(Number.isFinite)
  ) {
    throw new Error('The first practical light source contains invalid numeric data.');
  }
  return pointLight;
}

export function describeProbeProgress(progress) {
  const probe = progress.probe ?? {};
  const value = (candidate) => candidate === null || candidate === undefined || candidate === ''
    ? 'none'
    : String(candidate).replaceAll(/\s+/g, ' ').trim();
  return [
    `phase=${value(progress.phase)}`,
    `stageError=${value(progress.stageError)}`,
    `probeInstallError=${value(probe.installError)}`,
    `adapterRequests=${value(probe.adapterRequests)}`,
    `deviceRequests=${value(probe.deviceRequests)}`,
    `queueSubmissions=${value(probe.queueSubmissions)}`,
  ].join('; ');
}

async function evaluateValue(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

async function requestMcp(method, params = {}, id = 1) {
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
  assert.equal(message.id, id);
  assert.equal(message.error, undefined, JSON.stringify(message.error));
  return message.result;
}

async function assertCleanSourceTree() {
  const status = await commandText('git', ['status', '--porcelain', '--untracked-files=all'], false);
  const paths = parseWorkingTreePaths(status);
  assert.deepEqual(paths, [], `Capture the baseline from a clean tree:\n${paths.join('\n')}`);
}

async function assertNoOpenRun() {
  const entries = await readdir(outputRoot, { withFileTypes: true });
  const open = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^s01-\d{8}T\d{6}Z$/.test(entry.name)) continue;
    const directory = path.join(outputRoot, entry.name);
    if (await exists(path.join(directory, 'baseline.json')) && !await exists(path.join(directory, 'receipt.json'))) {
      open.push(entry.name);
    }
  }
  assert.deepEqual(open, [], `An open Slice 01 baseline already exists: ${open.join(', ')}`);
}

async function removeOwnedDirectory(directory, prefix) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith(prefix));
  await rm(resolved, { recursive: true, force: true });
}

function createBaselineMarkdown(baseline) {
  const writes = baseline.gpu.steady.writeBufferBytesPerFrame;
  return `# Slice 01 Baseline\n\n`
    + `Run \`${baseline.runId}\` freezes the pre-feature Antiky Town renderer at revision `
    + `\`${baseline.runSetup.revision}\`.\n\n`
    + `- Practical-light slot 0 uses position \`${JSON.stringify(baseline.referencePointLight.position)}\`, `
    + `radius \`${baseline.referencePointLight.radius}\`, color `
    + `\`${JSON.stringify(baseline.referencePointLight.color)}\`, and base power `
    + `\`${baseline.referencePointLight.power}\`.\n`
    + `- One steady frame uses ${baseline.gpu.steady.drawCallsPerFrame} draws and `
    + `${baseline.gpu.steady.queueSubmissionsPerFrame} queue submissions.\n`
    + `- The four affected complete uniform blocks use `
    + `${baseline.gpu.steady.affectedUniformBytesPerFrame.toLocaleString('en-US')} bytes per frame.\n`
    + `- All uniform blocks use ${writes.uniform.median.toLocaleString('en-US')} bytes per frame. `
    + `All measured buffer writes use ${writes.total.minimum.toLocaleString('en-US')} through `
    + `${writes.total.maximum.toLocaleString('en-US')} bytes per frame.\n`
    + `- The ordinary per-frame resource creation pattern is `
    + `\`${JSON.stringify(baseline.gpu.steady.resourceCreationsPerFrame)}\`. The device-created `
    + `resource totals are in \`baseline.json\`.\n`
    + `- The fixed-camera reference is \`captures/before.png\`. The full host reference is `
    + `\`captures/before-host.png\`.\n`;
}

export async function captureSlice01Baseline() {
  await assertCleanSourceTree();
  await assertNoOpenRun();
  await assertPortsAvailable('127.0.0.1', ports);
  assert.equal(await exists(path.join(root, '.antiky/dev-session.json')), false, 'A stale dev session exists.');

  const capturedAt = new Date();
  const runId = formatSlice01RunId(capturedAt);
  const outputDirectory = path.join(outputRoot, runId);
  const staging = await mkdtemp(path.join(os.tmpdir(), 'antiky-s01-baseline-'));
  const chromeProfile = await mkdtemp(path.join(os.tmpdir(), 'antiky-s01-chrome-'));
  const logDirectory = path.join(staging, 'logs');
  const captureDirectory = path.join(staging, 'captures');
  await mkdir(captureDirectory, { recursive: true, mode: 0o700 });

  let dev;
  let chrome;
  let cdp;
  let failure;
  let facts;
  try {
    dev = await startLoggedProcess({
      command: process.execPath,
      args: [
        '--experimental-strip-types',
        '--experimental-transform-types',
        'packages/cli/src/bin.ts',
        'dev',
      ],
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0' },
      logFile: path.join(logDirectory, 'development.log'),
    });
    await waitFor(async () => {
      const response = await fetch(gameUrl, { signal: AbortSignal.timeout(1_000) });
      return response.ok;
    }, { timeoutMilliseconds: 30_000, intervalMilliseconds: 200, label: 'the focused town host' });

    chrome = await startLoggedProcess({
      command: chromePath,
      args: createChromeArguments({ profile: chromeProfile, gameUrl: 'about:blank' }),
      cwd: root,
      logFile: path.join(logDirectory, 'chrome.log'),
    });
    const target = await waitForChromeTarget(9322, 'about:blank');
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: gpuProbeSource });
    await cdp.send('Page.navigate', { url: gameUrl });

    try {
      await waitFor(async () => evaluateValue(cdp, `(
        document.querySelector('.stage')?.getAttribute('data-phase') === 'running'
        && globalThis.__antikyGpuProbe?.queueSubmissions >= 210
      )`), {
        timeoutMilliseconds: 45_000,
        intervalMilliseconds: 100,
        label: '210 instrumented town submissions',
      });
    } catch (error) {
      const progress = JSON.parse(await evaluateValue(cdp, `JSON.stringify({
        phase: document.querySelector('.stage')?.getAttribute('data-phase') ?? null,
        stageError: document.querySelector('.stage-error, [role="alert"]')?.textContent ?? null,
        probe: globalThis.__antikyGpuProbe ? {
          installError: globalThis.__antikyGpuProbe.installError,
          adapterRequests: globalThis.__antikyGpuProbe.adapterRequests,
          deviceRequests: globalThis.__antikyGpuProbe.deviceRequests,
          queueSubmissions: globalThis.__antikyGpuProbe.queueSubmissions,
        } : null,
      })`));
      throw new Error(`${error.message} ${describeProbeProgress(progress)}`, { cause: error });
    }

    const { connectDevelopmentClient } = await import('../../cli/src/development/client.ts');
    const client = await waitFor(() => connectDevelopmentClient(), {
      timeoutMilliseconds: 10_000,
      intervalMilliseconds: 100,
      label: 'the development client',
    });
    const development = await client.readDevelopmentSnapshot();
    assert.equal(development.inspection?.runtime.lifecycle, 'running');
    assert.equal(development.inspection.measurements.render.drawCalls, 16);
    assert.equal(development.inspection.measurements.render.instances, 1_247);

    const rawProbe = JSON.parse(await evaluateValue(
      cdp,
      'JSON.stringify(globalThis.__antikyGpuProbe)',
    ));
    const steady = summarizeGpuProbe(rawProbe, 20);
    assert.equal(steady.drawCallsPerFrame, 16);
    assert.equal(steady.affectedUniformBytesPerFrame, 2_112);

    const surface = JSON.parse(await evaluateValue(cdp, `JSON.stringify({
      title: document.title,
      phase: document.querySelector('.stage')?.getAttribute('data-phase'),
      mainLabel: document.querySelector('main')?.getAttribute('aria-label'),
      websiteChrome: Boolean(document.querySelector('header, footer, nav')),
      canvas: {
        width: document.querySelector('canvas')?.width,
        height: document.querySelector('canvas')?.height,
      },
    })`));
    assert.deepEqual(
      { title: surface.title, phase: surface.phase, websiteChrome: surface.websiteChrome },
      { title: 'Antiky game development', phase: 'running', websiteChrome: false },
    );

    const initialized = await requestMcp('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'antiky-slice-01-baseline', version: '1' },
    }, 1);
    assert.deepEqual(initialized.capabilities, { tools: {} });
    const tools = await requestMcp('tools/list', {}, 2);
    const captureResult = await requestMcp('tools/call', {
      name: 'capture_frame',
      arguments: {},
    }, 3);
    assert.notEqual(captureResult.isError, true, 'The MCP canvas capture failed.');
    const capture = captureResult.structuredContent;
    const canvasCapture = path.join(captureDirectory, 'before.png');
    await copyFile(capture.path, canvasCapture);
    const canvasBytes = await readFile(canvasCapture);
    assert.equal(hash(canvasBytes), capture.sha256);
    const canvasMetadata = await assertCaptureHasContent(canvasCapture);

    const hostCapture = path.join(captureDirectory, 'before-host.png');
    const screenshot = await capturePageAtViewport(cdp, 756, 469);
    await writeFile(hostCapture, Buffer.from(screenshot, 'base64'), { flag: 'wx', mode: 0o600 });
    const hostMetadata = await assertCaptureHasContent(hostCapture);

    const townSource = await readFile(
      path.join(root, 'packages/demos/src/demos/brometal-town/index.ts'),
      'utf8',
    );
    const config = await readFile(path.join(root, 'antiky.config.json'));
    const lock = await readFile(path.join(root, 'package-lock.json'));
    facts = {
      schemaVersion: 1,
      sliceId: 'slice-01',
      checkpoint: 'CP-00',
      runId,
      runState: 'OPEN',
      capturedAt: capturedAt.toISOString(),
      runSetup: {
        revision: await commandText('git', ['rev-parse', 'HEAD']),
        branch: await commandText('git', ['branch', '--show-current']),
        worktree: root,
        configSha256: hash(config),
        dependencyLockSha256: hash(lock),
        gameUrl,
        demoSlug: 'town-study',
        ports: { game: 3010, inspectionAndMcp: 3011, browserControl: 9322 },
        browserProfile: 'Dedicated temporary profile removed during cleanup.',
        network: 'Loopback only. Chrome used the closed loopback proxy and non-loopback name mapping.',
        seed: 'N/A. Slice 01 changes authored light power and preserves presentation flicker.',
      },
      referencePointLight: extractReferencePointLight(townSource),
      runtime: {
        developmentSessionId: development.developmentSessionId,
        runtimeInstanceId: development.inspection.runtime.instanceId,
        render: development.inspection.measurements.render,
      },
      gpu: {
        probeVersion: rawProbe.version,
        measurementScope: 'Device creation methods, queue buffer writes, render-pass draws, and queue submissions.',
        adapterRequests: rawProbe.adapterRequests,
        deviceRequests: rawProbe.deviceRequests,
        deviceCreatedResources: rawProbe.resources,
        allocatedBufferBytes: rawProbe.resourceBytes.buffers ?? 0,
        steady,
      },
      mcp: {
        transport: 'streamable-http',
        capabilities: initialized.capabilities,
        tools: tools.tools.map((tool) => tool.name),
        resourcesUsed: false,
      },
      visual: {
        surface,
        canvasCapture: {
          path: 'captures/before.png',
          width: canvasMetadata.width,
          height: canvasMetadata.height,
          sha256: capture.sha256,
        },
        hostCapture: {
          path: 'captures/before-host.png',
          width: hostMetadata.width,
          height: hostMetadata.height,
          sha256: hash(await readFile(hostCapture)),
        },
      },
    };
    await writeFile(
      path.join(staging, 'logs/gpu-probe.json'),
      `${JSON.stringify(rawProbe, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
  } catch (error) {
    failure = error;
  } finally {
    if (cdp) cdp.close();
    await stopOwnedProcess(chrome).catch((error) => { failure ??= error; });
    await stopOwnedProcess(dev).catch((error) => { failure ??= error; });
    await removeOwnedDirectory(chromeProfile, 'antiky-s01-chrome-')
      .catch((error) => { failure ??= error; });
    await assertPortsAvailable('127.0.0.1', ports).catch((error) => { failure ??= error; });
    if (await exists(path.join(root, '.antiky/dev-session.json'))) {
      failure ??= new Error('The development session descriptor remained after cleanup.');
    }
  }

  if (!failure) {
    try {
      assertChromeNetworkIsolation(await readFile(path.join(logDirectory, 'chrome.log'), 'utf8'));
      facts.cleanup = {
        ownedProcessesStopped: true,
        browserProfileRemoved: true,
        sessionDescriptorRemoved: true,
        releasedPorts: ports,
      };
      await writeFile(
        path.join(staging, 'baseline.json'),
        `${JSON.stringify(facts, null, 2)}\n`,
        { flag: 'wx', mode: 0o600 },
      );
      await writeFile(
        path.join(staging, 'baseline.md'),
        createBaselineMarkdown(facts),
        { flag: 'wx', mode: 0o600 },
      );
      await mkdir(outputDirectory, { mode: 0o700 });
      await copyTreeExclusive(staging, outputDirectory);
    } catch (error) {
      failure = error;
    }
  }

  await removeOwnedDirectory(staging, 'antiky-s01-baseline-');
  if (failure) throw failure;
  process.stdout.write(`Slice 01 baseline PASS: ${path.relative(root, outputDirectory)}\n`);
  return { facts, outputDirectory };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    await captureSlice01Baseline();
  } catch (error) {
    process.stderr.write(
      `Slice 01 baseline FAIL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
