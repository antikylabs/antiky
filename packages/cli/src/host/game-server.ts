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

const HOST_SCRIPT = String.raw`
const canvas = document.querySelector('#antiky-game');
const status = document.querySelector('#antiky-status');
const pointer = { x: 0.5, y: 0.5, down: false, active: false, dragX: 0, dragY: 0, clicked: false };
const movement = { x: 0, z: 0, active: false };
const pressed = new Set();
let instance = null;
let frame = 0;
let disposed = false;

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
  instance?.dispose();
  instance = null;
}
window.addEventListener('pagehide', dispose, { once: true });

async function start() {
  resize();
  const gameModule = await import('${BUILD_PREFIX}${ANTIKY_GAME_MODULE_FILE}');
  if (typeof gameModule.default !== 'function') throw new Error('The game module needs a default entry function.');
  instance = await gameModule.default({
    canvas,
    runtimeInstanceId: crypto.randomUUID(),
    pointer,
    movement,
    mode: 'interactive',
    report(measurements) {
      window.dispatchEvent(new CustomEvent('antiky:measurements', { detail: measurements }));
    },
  });
  if (!instance || typeof instance.frame !== 'function' || typeof instance.dispose !== 'function') {
    throw new Error('The game module returned an invalid game instance.');
  }
  status.hidden = true;
  const present = (time) => {
    if (disposed) return;
    resize();
    if (!document.hidden) instance.frame(time / 1000);
    frame = requestAnimationFrame(present);
  };
  frame = requestAnimationFrame(present);
}

start().catch((cause) => {
  status.hidden = false;
  status.textContent = cause instanceof Error ? cause.message : 'The game could not start.';
  window.dispatchEvent(new CustomEvent('antiky:error', { detail: status.textContent }));
});
`;

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
        body = HOST_SCRIPT;
      } else if (url.pathname.startsWith(BUILD_PREFIX)) {
        const file = await readBuildFile(buildRoot, url.pathname);
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
