/**
 * Run code in a browser that has a real WebGPU device, and get its answer back.
 *
 * Why this exists: the only other code in this repository that launches a browser is the CLI's
 * managed capture runtime, and it is reachable only through `capture_frame`, which returns a PNG of
 * a whole frame. That cannot answer "does sampling layer 1 of an array texture return layer 1's
 * colour". Without this, a test that needs real GPU behaviour has to substitute a fake `GPUDevice`
 * and assert on the calls made rather than the pixels produced — which passes even when the answer
 * is wrong, as long as the shape of the work is right.
 *
 * Three details make a real device look unavailable when it is not. All three cost time to find, so
 * they are stated rather than left in the flags:
 *
 * 1. **The profile directory must be a real path.** An empty string yields no `navigator.gpu` at
 *    all, which reads exactly like a machine without a GPU.
 * 2. **The page must be on a secure origin.** `about:blank` yields no `navigator.gpu`. Loopback
 *    counts as secure, so a throwaway HTTP server is enough and no TLS is involved.
 * 3. **The repository is served as-is**, so the page imports `/node_modules/brometal/dist/index.js`
 *    directly. BroMetal's `dist` uses relative imports, which resolve over HTTP without a bundler,
 *    and this deliberately loads the **patched installed copy** — the thing that actually ships.
 *
 * Headless is fine.
 *
 * This is a test harness, not a product surface. It must not become a second capture path and must
 * stay out of the CLI's tool list. It also must not run at the same time as a capture: the shoot
 * script warns against a second managed Chromium, and two of them will fight over the GPU.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

const CONTENT_TYPES = new Map([
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.json', 'application/json'],
  ['.html', 'text/html'],
]);

/** Serves the repository over loopback so the page can import the installed BroMetal. */
async function serveRepository() {
  const server = createServer((request, response) => {
    const requested = decodeURIComponent((request.url ?? '/').split('?')[0]);
    if (requested === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><meta charset="utf-8"><title>gpu</title>');
      return;
    }
    // Resolve inside the repository and refuse anything that climbs out of it.
    const resolved = path.resolve(repositoryRoot, `.${requested}`);
    if (!resolved.startsWith(repositoryRoot)) {
      response.writeHead(403).end();
      return;
    }
    stat(resolved).then(
      (info) => {
        if (!info.isFile()) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          'Content-Type': CONTENT_TYPES.get(path.extname(resolved)) ?? 'application/octet-stream',
        });
        createReadStream(resolved).pipe(response);
      },
      () => response.writeHead(404).end(),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

/**
 * Hand `run` a Playwright page sitting on a real WebGPU device, and clean up afterwards.
 *
 * Returns whatever `run` returns. If the machine genuinely has no device, this throws with the
 * reason rather than letting a test fail somewhere less obvious.
 */
export async function withGpuPage(run) {
  const { chromium } = await import('playwright');
  const profile = await mkdtemp(path.join(tmpdir(), 'antiky-gpu-'));
  const { server, origin } = await serveRepository();
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 256, height: 256 },
    args: [
      '--enable-unsafe-webgpu',
      ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []),
    ],
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(`${origin}/`);
    const unavailable = await page.evaluate(async () => {
      if (!('gpu' in navigator)) return 'navigator.gpu is absent';
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter === null) return 'no adapter';
      return null;
    });
    if (unavailable !== null) throw new Error(`no WebGPU device in managed Chromium: ${unavailable}`);
    return await run(page, origin);
  } finally {
    await context.close();
    server.close();
    await rm(profile, { recursive: true, force: true });
  }
}
