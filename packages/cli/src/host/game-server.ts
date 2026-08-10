import { constants } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

import { AntikyCliError } from '../errors.ts';

export const ANTIKY_GAME_MODULE_DIRECTORY = 'dist' as const;
export const ANTIKY_GAME_MODULE_FILE = 'antiky.game.js' as const;

const BUILD_PREFIX = '/__antiky__/build/';
const HOST_SCRIPT_PATH = '/__antiky__/host.js';
const MAX_STATIC_FILE_BYTES = 64 * 1024 * 1024;

export type DevelopmentGameHostOptions = Readonly<{
  host: '127.0.0.1';
  port: number;
  gameUrl: string;
  inspectionUrl: string;
  projectName: string;
  projectDirectory: string;
}>;

export type DevelopmentGameHost = Readonly<{
  start(): Promise<void>;
  stop(): Promise<void>;
}>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hostHtml(options: DevelopmentGameHostOptions): string {
  const title = escapeHtml(options.projectName);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #09090d; }
    #antiky-game { display: block; width: 100%; height: 100%; outline: none; touch-action: none; }
    #antiky-status { position: fixed; inset: auto 12px 12px; margin: 0; color: #aaa; font-size: 12px; pointer-events: none; }
  </style>
</head>
<body>
  <canvas id="antiky-game" tabindex="0" aria-label="${title}"></canvas>
  <p id="antiky-status" role="status">Loading game…</p>
  <script type="module" src="${HOST_SCRIPT_PATH}"></script>
</body>
</html>`;
}

const HOST_SCRIPT_TEMPLATE = String.raw`
const inspectionOrigin = __ANTIKY_INSPECTION_ORIGIN__;
const canvas = document.querySelector('#antiky-game');
const status = document.querySelector('#antiky-status');
const pointer = { x: 0.5, y: 0.5, down: false, active: false, dragX: 0, dragY: 0, clicked: false };
const movement = { x: 0, z: 0, active: false };
const pressed = new Set();
const runtimeInstanceId = crypto.randomUUID();
let instance = null;
let frame = 0;
let disposed = false;
let lifecycle = 'initializing';
let frameCount = 0;
let framesPerSecond = 0;
let frameWindowStartedAt = performance.now();
let frameWindowCount = 0;
let measurements = {};
let runtimeError = null;
let inspection = null;
let inspectionTimer = 0;
let publicationTail = Promise.resolve();

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function finiteCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function hostInspectionState() {
  return Object.freeze({
    runtimeInstanceId,
    lifecycle,
    frameCount,
    framesPerSecond,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    measurements: Object.freeze({
      ...(finiteCount(measurements.instances) === undefined ? {} : { instances: measurements.instances }),
      ...(finiteCount(measurements.drawCalls) === undefined ? {} : { drawCalls: measurements.drawCalls }),
      ...(finiteCount(measurements.uploadBytesPerFrame) === undefined
        ? {}
        : { uploadBytesPerFrame: measurements.uploadBytesPerFrame }),
      ...(typeof measurements.note === 'string' ? { note: measurements.note.slice(0, 512) } : {}),
    }),
    ...(runtimeError === null ? {} : { error: runtimeError }),
  });
}

function fallbackSnapshot(state) {
  const render = { owner: 'framework' };
  if (state.canvasWidth > 0) render.canvasWidth = state.canvasWidth;
  if (state.canvasHeight > 0) render.canvasHeight = state.canvasHeight;
  if (state.measurements.drawCalls !== undefined) render.drawCalls = state.measurements.drawCalls;
  if (state.measurements.instances !== undefined) render.instances = state.measurements.instances;
  if (state.measurements.uploadBytesPerFrame !== undefined) {
    render.uploadBytesPerFrame = state.measurements.uploadBytesPerFrame;
  }
  return Object.freeze({
    schemaVersion: 1,
    runtime: Object.freeze({ instanceId: runtimeInstanceId, lifecycle: state.lifecycle }),
    diagnostics: Object.freeze(state.error === undefined ? [] : [Object.freeze({
      id: runtimeInstanceId + ':game-host',
      owner: 'framework',
      source: 'runtime',
      code: state.error.code,
      severity: 'error',
      message: state.error.message,
      relatedIds: Object.freeze([runtimeInstanceId]),
    })]),
    measurements: Object.freeze({
      runtime: Object.freeze({
        owner: 'framework',
        frameCount: state.frameCount,
        framesPerSecond: state.framesPerSecond,
      }),
      render: Object.freeze(render),
    }),
  });
}

function readSnapshot() {
  const state = hostInspectionState();
  if (instance?.inspection && typeof instance.inspection.snapshot === 'function') {
    return instance.inspection.snapshot(state);
  }
  return fallbackSnapshot(state);
}

async function publishInspection() {
  if (disposed || inspection === null) return;
  const nextSequence = inspection.publicationSequence + 1;
  const response = await fetch(inspectionOrigin + '/v1/runtime/snapshot', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      authorization: inspection.authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      developmentSessionId: inspection.developmentSessionId,
      publicationSequence: nextSequence,
      snapshot: readSnapshot(),
    }),
    signal: inspection.controller.signal,
  });
  if (!response.ok) throw new Error('Antiky inspection publication failed (' + response.status + ').');
  inspection.publicationSequence = nextSequence;
}

function queueInspectionPublication() {
  publicationTail = publicationTail.then(publishInspection).catch(() => {});
  return publicationTail;
}

function readAction(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Antiky development action is invalid.');
  }
  const kinds = new Set([
    'reload',
    'capture',
    'set-point-light-power',
    'correct-point-light-power',
    'pause-simulation',
    'resume-simulation',
    'step-simulation',
  ]);
  if (
    value.schemaVersion !== 1
    || value.developmentSessionId !== inspection?.developmentSessionId
    || value.runtimeInstanceId !== runtimeInstanceId
    || typeof value.actionId !== 'string'
    || !Number.isSafeInteger(value.buildRevision)
    || !kinds.has(value.kind)
  ) throw new Error('Antiky development action is incompatible.');
  return value;
}

async function postActionResult(action, result) {
  if (inspection === null) return;
  const response = await fetch(inspectionOrigin + '/v1/runtime/action-result', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      authorization: inspection.authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      developmentSessionId: inspection.developmentSessionId,
      runtimeInstanceId,
      actionId: action.actionId,
      result,
    }),
    signal: inspection.controller.signal,
  });
  if (!response.ok) throw new Error('Antiky action publication failed (' + response.status + ').');
  void queueInspectionPublication();
}

function postCaptureActionResult(action, result, snapshot) {
  const publication = publicationTail.then(async () => {
    if (inspection === null) return;
    const publicationSequence = inspection.publicationSequence + 1;
    const response = await fetch(inspectionOrigin + '/v1/runtime/action-result', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        authorization: inspection.authorization,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 1,
        developmentSessionId: inspection.developmentSessionId,
        runtimeInstanceId,
        actionId: action.actionId,
        result: { ...result, publicationSequence, snapshot },
      }),
      signal: inspection.controller.signal,
    });
    if (!response.ok) {
      throw new Error('Antiky capture publication failed (' + response.status + ').');
    }
    inspection.publicationSequence = publicationSequence;
  });
  publicationTail = publication.catch(() => {});
  return publication;
}

async function handleAction(action) {
  if (action.kind === 'reload') {
    window.location.reload();
    return false;
  }
  if (action.kind === 'capture') {
    const warmUpFrames = Number.isSafeInteger(action.warmUpFrames)
      && action.warmUpFrames >= 0
      && action.warmUpFrames <= 300
      ? action.warmUpFrames
      : 0;
    for (let index = 0; index < warmUpFrames; index += 1) {
      await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
    }
    const prefix = 'data:image/png;base64,';
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith(prefix)) throw new Error('The game canvas did not produce a PNG.');
    const snapshot = readSnapshot();
    await postCaptureActionResult(action, {
      kind: 'capture',
      mimeType: 'image/png',
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      dataBase64: dataUrl.slice(prefix.length),
    }, snapshot);
    return true;
  }
  const gameInspection = instance?.inspection;
  if (!gameInspection) throw new Error('The game does not provide semantic inspection controls.');
  if (
    action.kind === 'pause-simulation'
    || action.kind === 'resume-simulation'
    || action.kind === 'step-simulation'
  ) {
    const operation = action.kind === 'pause-simulation'
      ? gameInspection.pauseSimulation
      : action.kind === 'resume-simulation'
        ? gameInspection.resumeSimulation
        : gameInspection.stepSimulation;
    if (typeof operation !== 'function') {
      throw new Error('The game does not provide this simulation control.');
    }
    const control = action.kind === 'step-simulation'
      ? await operation.call(gameInspection, action.expectedCompletedStepCount)
      : await operation.call(gameInspection);
    await postActionResult(action, {
      kind: 'session-control',
      controlResult: control.result,
      session: control.session,
    });
    return true;
  }
  const operation = action.kind === 'set-point-light-power'
    ? gameInspection.setPointLightPower
    : gameInspection.correctPointLightPower;
  if (typeof operation !== 'function') {
    throw new Error('The game does not provide this point-light control.');
  }
  const commandResult = action.kind === 'set-point-light-power'
    ? await operation.call(gameInspection, action.command, action.context)
    : await operation.call(gameInspection, action.request, action.context);
  await postActionResult(action, { kind: 'point-light-command', commandResult });
  return true;
}

async function pollInspectionActions() {
  while (!disposed && inspection !== null) {
    try {
      const response = await fetch(
        inspectionOrigin + '/v1/runtime/action?runtimeInstanceId=' + encodeURIComponent(runtimeInstanceId),
        {
          cache: 'no-store',
          headers: { authorization: inspection.authorization },
          signal: inspection.controller.signal,
        },
      );
      if (response.status === 204) {
        await delay(250);
        continue;
      }
      if (!response.ok) throw new Error('Antiky action poll failed (' + response.status + ').');
      if (!await handleAction(readAction(await response.json()))) return;
    } catch {
      if (disposed || inspection === null || inspection.controller.signal.aborted) return;
      await delay(250);
    }
  }
}

async function connectInspection() {
  const parsedOrigin = new URL(inspectionOrigin);
  if (
    parsedOrigin.origin !== inspectionOrigin
    || parsedOrigin.protocol !== 'http:'
    || parsedOrigin.hostname !== '127.0.0.1'
  ) throw new Error('Antiky inspection must use an IPv4 loopback origin.');
  const response = await fetch(inspectionOrigin + '/v1/browser/bootstrap', { cache: 'no-store' });
  if (!response.ok) throw new Error('Antiky inspection bootstrap failed (' + response.status + ').');
  const bootstrap = await response.json();
  const keys = bootstrap && typeof bootstrap === 'object' ? Object.keys(bootstrap).sort() : [];
  if (
    keys.join(',') !== 'credential,developmentSessionId,gameUrl,schemaVersion'
    || bootstrap.schemaVersion !== 1
    || typeof bootstrap.developmentSessionId !== 'string'
    || typeof bootstrap.credential !== 'string'
    || bootstrap.credential.length < 32
    || typeof bootstrap.gameUrl !== 'string'
    || new URL(bootstrap.gameUrl).origin !== window.location.origin
  ) throw new Error('Antiky inspection bootstrap is incompatible.');
  inspection = {
    developmentSessionId: bootstrap.developmentSessionId,
    authorization: 'Bearer ' + bootstrap.credential,
    publicationSequence: 0,
    controller: new AbortController(),
  };
  await queueInspectionPublication();
  inspectionTimer = window.setInterval(queueInspectionPublication, 250);
  void pollInspectionActions();
}

function disconnectInspection() {
  if (inspection === null) return;
  const activeInspection = inspection;
  inspection = null;
  window.clearInterval(inspectionTimer);
  const publicationSequence = activeInspection.publicationSequence + 1;
  void fetch(inspectionOrigin + '/v1/runtime/disconnect', {
    method: 'POST',
    cache: 'no-store',
    keepalive: true,
    headers: {
      authorization: activeInspection.authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      developmentSessionId: activeInspection.developmentSessionId,
      runtimeInstanceId,
      publicationSequence,
    }),
  }).catch(() => {});
  activeInspection.controller.abort();
}

function resize() {
  const scale = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(canvas.clientWidth * scale));
  const height = Math.max(1, Math.round(canvas.clientHeight * scale));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function syncMovement() {
  let x = 0;
  let z = 0;
  if (pressed.has('a') || pressed.has('arrowleft')) x -= 1;
  if (pressed.has('d') || pressed.has('arrowright')) x += 1;
  if (pressed.has('w') || pressed.has('arrowup')) z -= 1;
  if (pressed.has('s') || pressed.has('arrowdown')) z += 1;
  const length = Math.hypot(x, z);
  movement.x = length > 1 ? x / length : x;
  movement.z = length > 1 ? z / length : z;
  movement.active = length > 0.01;
}

canvas.addEventListener('pointermove', (event) => {
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
  const y = 1 - (event.clientY - bounds.top) / Math.max(1, bounds.height);
  if (pointer.down) {
    pointer.dragX += x - pointer.x;
    pointer.dragY += y - pointer.y;
  }
  pointer.x = x;
  pointer.y = y;
  pointer.active = true;
});
canvas.addEventListener('pointerdown', (event) => {
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture?.(event.pointerId);
  pointer.down = true;
  pointer.clicked = true;
});
canvas.addEventListener('pointerup', () => { pointer.down = false; });
canvas.addEventListener('pointerleave', () => { pointer.active = false; pointer.down = false; });
window.addEventListener('keydown', (event) => {
  if (document.activeElement !== canvas) return;
  pressed.add(event.key.toLowerCase());
  syncMovement();
  if (movement.active) event.preventDefault();
});
window.addEventListener('keyup', (event) => { pressed.delete(event.key.toLowerCase()); syncMovement(); });
window.addEventListener('blur', () => { pressed.clear(); syncMovement(); });

function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frame);
  disconnectInspection();
  instance?.dispose();
  instance = null;
}
window.addEventListener('pagehide', dispose, { once: true });

async function start() {
  resize();
  const gameModule = await import('__ANTIKY_GAME_MODULE__');
  if (typeof gameModule.default !== 'function') throw new Error('The game module needs a default entry function.');
  instance = await gameModule.default({
    canvas,
    runtimeInstanceId,
    pointer,
    movement,
    mode: 'interactive',
    report(nextMeasurements) {
      measurements = nextMeasurements && typeof nextMeasurements === 'object'
        ? { ...nextMeasurements }
        : {};
      window.dispatchEvent(new CustomEvent('antiky:measurements', { detail: measurements }));
    },
  });
  if (!instance || typeof instance.frame !== 'function' || typeof instance.dispose !== 'function') {
    throw new Error('The game module returned an invalid game instance.');
  }
  lifecycle = 'ready';
  status.hidden = true;
  await connectInspection().catch(() => {});
  const present = (time) => {
    if (disposed) return;
    resize();
    if (!document.hidden) {
      try {
        instance.frame(time / 1000);
        lifecycle = 'running';
        frameCount += 1;
        frameWindowCount += 1;
        const elapsed = time - frameWindowStartedAt;
        if (elapsed >= 500) {
          framesPerSecond = frameWindowCount * 1000 / elapsed;
          frameWindowStartedAt = time;
          frameWindowCount = 0;
        }
      } catch (cause) {
        failRuntime(cause, 'ANTIKY_GAME_FRAME_FAILED');
        return;
      }
    }
    pointer.clicked = false;
    pointer.dragX = 0;
    pointer.dragY = 0;
    frame = requestAnimationFrame(present);
  };
  frame = requestAnimationFrame(present);
}

function failRuntime(cause, code) {
  lifecycle = 'error';
  runtimeError = Object.freeze({
    code,
    message: cause instanceof Error ? cause.message : 'The game could not start.',
  });
  status.hidden = false;
  status.textContent = runtimeError.message;
  window.dispatchEvent(new CustomEvent('antiky:error', { detail: status.textContent }));
  void queueInspectionPublication();
}

document.addEventListener('visibilitychange', () => {
  if (lifecycle === 'error') return;
  lifecycle = document.hidden ? 'paused' : frameCount === 0 ? 'ready' : 'running';
  void queueInspectionPublication();
});

start().catch((cause) => {
  failRuntime(cause, 'ANTIKY_GAME_START_FAILED');
});
`;

function browserString(value: string): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function hostScript(options: DevelopmentGameHostOptions): string {
  return HOST_SCRIPT_TEMPLATE
    .replace('__ANTIKY_INSPECTION_ORIGIN__', browserString(options.inspectionUrl))
    .replace('__ANTIKY_GAME_MODULE__', `${BUILD_PREFIX}${ANTIKY_GAME_MODULE_FILE}`);
}

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.js': return 'text/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

function isInside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function readBuildFile(root: string, requestPath: string): Promise<Readonly<{
  body: Uint8Array;
  type: string;
}> | null> {
  let relativePath: string;
  try {
    relativePath = decodeURIComponent(requestPath.slice(BUILD_PREFIX.length));
  } catch {
    return null;
  }
  if (!relativePath || relativePath.includes('\\') || relativePath.split('/').includes('..')) return null;
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, relativePath);
  if (!isInside(rootPath, candidate)) return null;
  try {
    const [canonicalRoot, canonicalCandidate, metadata] = await Promise.all([
      realpath(rootPath),
      realpath(candidate),
      stat(candidate),
    ]);
    if (
      !isInside(canonicalRoot, canonicalCandidate)
      || !metadata.isFile()
      || metadata.size > MAX_STATIC_FILE_BYTES
    ) return null;
    const handle = await open(canonicalCandidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      return Object.freeze({
        body: await handle.readFile(),
        type: contentType(canonicalCandidate),
      });
    } finally {
      await handle.close();
    }
  } catch (cause: unknown) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP') return null;
    throw cause;
  }
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolveClose, rejectClose) => {
    server.close((cause) => cause ? rejectClose(cause) : resolveClose());
  });
}

export function createDevelopmentGameHost(
  options: DevelopmentGameHostOptions,
): DevelopmentGameHost {
  const expectedUrl = new URL(options.gameUrl);
  const buildRoot = resolve(options.projectDirectory, ANTIKY_GAME_MODULE_DIRECTORY);
  const server = createServer(async (request, response) => {
    const requestId = crypto.randomUUID();
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-antiky-request-id', requestId);
    response.setHeader('x-content-type-options', 'nosniff');
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' }).end();
        return;
      }
      const url = new URL(request.url ?? '/', options.gameUrl);
      let status = 200;
      let type = 'text/plain; charset=utf-8';
      let body: string | Uint8Array = '';
      if (url.pathname === HOST_SCRIPT_PATH) {
        type = 'text/javascript; charset=utf-8';
        body = hostScript(options);
      } else if (url.pathname.startsWith(BUILD_PREFIX)) {
        const file = await readBuildFile(buildRoot, url.pathname);
        if (!file) status = 404;
        else {
          type = file.type;
          body = file.body;
        }
      } else if (url.pathname.startsWith('/assets/')) {
        const file = await readBuildFile(
          buildRoot,
          `${BUILD_PREFIX}${url.pathname.slice(1)}`,
        );
        if (!file) status = 404;
        else {
          type = file.type;
          body = file.body;
        }
      } else if (url.pathname === expectedUrl.pathname) {
        type = 'text/html; charset=utf-8';
        body = hostHtml(options);
      } else {
        status = 404;
      }
      response.writeHead(status, { 'content-type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Game host error.');
    }
  });

  return Object.freeze({
    start(): Promise<void> {
      return new Promise<void>((resolveStart, rejectStart) => {
        server.once('error', rejectStart);
        server.listen({ host: options.host, port: options.port, exclusive: true }, () => {
          server.off('error', rejectStart);
          resolveStart();
        });
      }).catch((cause: unknown) => {
        throw new AntikyCliError('ANTIKY_PORT_BUSY', `Port ${options.host}:${options.port} is unavailable.`, '$.network.gamePort');
      });
    },
    stop: () => closeServer(server),
  });
}
