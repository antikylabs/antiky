import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, type BrowserContext, type Page, type Route } from 'playwright';

import {
  CAPTURE_BROWSER_VERSION,
  type CaptureWebGpuStatus,
} from '../development/capture-capabilities.ts';
import { AntikyCliError } from '../errors.ts';

const DEFAULT_LAUNCH_TIMEOUT_MILLISECONDS = 15_000;
const DEFAULT_RUNTIME_POLL_MILLISECONDS = 25;

export type ManagedRuntimeConnection = Readonly<{
  state: 'waiting' | 'connected' | 'unavailable';
  runtimeInstanceId: string | null;
  lifecycle?: 'initializing' | 'ready' | 'running' | 'paused' | 'error' | 'stopped' | null;
}>;

export type ManagedBrowserLaunchInput = Readonly<{
  profileDirectory: string;
  allowedOrigins: readonly string[];
  viewport: Readonly<{ width: number; height: number }>;
  deviceScaleFactor: number;
}>;

export type ManagedBrowserAdapter = Readonly<{
  browserVersion: string;
  navigate(url: string): Promise<void>;
  probeWebGpu(): Promise<boolean>;
  assertSafe?(): void;
  close(): Promise<void>;
}>;

export type ManagedBrowserLauncher = (
  input: ManagedBrowserLaunchInput,
) => Promise<ManagedBrowserAdapter>;

type ManagedCaptureRuntimeOptions = Readonly<{
  gameUrl: string;
  inspectionUrl: string;
  configuredWidth: number;
  configuredHeight: number;
  readRuntime(): ManagedRuntimeConnection;
  launcher?: ManagedBrowserLauncher;
  profileRoot?: string;
  timeoutMilliseconds?: number;
  pollMilliseconds?: number;
}>;

export type ManagedCaptureRuntimeResult = Readonly<{
  runtimeInstanceId: string;
  webGpu: CaptureWebGpuStatus;
}>;

export interface ManagedCaptureRuntime {
  ensureRuntime(input: Readonly<{ deviceScaleFactor: number }>): Promise<ManagedCaptureRuntimeResult>;
  owns(runtimeInstanceId: string): boolean;
  webGpuStatus(): CaptureWebGpuStatus;
  assertSafe(): void;
  releaseRuntime(): Promise<void>;
  stop(): Promise<void>;
}

function captureError(
  code:
    | 'CAPTURE_RUNTIME_UNAVAILABLE'
    | 'CAPTURE_BROWSER_LAUNCH_FAILED'
    | 'CAPTURE_BROWSER_VERSION_MISMATCH'
    | 'CAPTURE_WEBGPU_UNAVAILABLE'
    | 'CAPTURE_EXTERNAL_NETWORK_BLOCKED'
    | 'CAPTURE_RUNTIME_BUSY'
    | 'CAPTURE_RUNTIME_TIMEOUT'
    | 'CAPTURE_RUNTIME_DISCONNECTED',
  message: string,
): AntikyCliError {
  return new AntikyCliError(code, message);
}

function exactLoopbackOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw captureError('CAPTURE_RUNTIME_UNAVAILABLE', 'The managed capture origin is invalid.');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port.length === 0
    || url.username.length > 0
    || url.password.length > 0
  ) throw captureError('CAPTURE_RUNTIME_UNAVAILABLE', 'Managed capture requires exact loopback origins.');
  return url.origin;
}

export function isAllowedCaptureUrl(urlText: string, allowedOrigins: readonly string[]): boolean {
  try {
    const url = new URL(urlText);
    return url.protocol === 'http:'
      && url.hostname === '127.0.0.1'
      && allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

async function defaultLauncher(input: ManagedBrowserLaunchInput): Promise<ManagedBrowserAdapter> {
  const context: BrowserContext = await chromium.launchPersistentContext(input.profileDirectory, {
    headless: true,
    viewport: input.viewport,
    deviceScaleFactor: input.deviceScaleFactor,
    acceptDownloads: false,
    serviceWorkers: 'block',
    permissions: [],
    args: [
      '--enable-unsafe-webgpu',
      ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []),
    ],
  });
  await context.clearPermissions();
  let blockedExternalRequest = false;
  const routeHandler = async (route: Route): Promise<void> => {
    if (isAllowedCaptureUrl(route.request().url(), input.allowedOrigins)) {
      await route.continue();
      return;
    }
    blockedExternalRequest = true;
    await route.abort('blockedbyclient');
  };
  await context.route('**/*', routeHandler);
  const pages = context.pages();
  const page: Page = pages[0] ?? await context.newPage();
  for (const extra of pages.slice(1)) await extra.close();
  context.on('page', (opened) => {
    if (opened !== page) void opened.close();
  });
  page.on('download', (download) => { void download.cancel(); });
  page.on('popup', (popup) => { void popup.close(); });
  return Object.freeze({
    browserVersion: context.browser()?.version() ?? 'unavailable',
    async navigate(url: string): Promise<void> {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      if (blockedExternalRequest) {
        throw captureError(
          'CAPTURE_EXTERNAL_NETWORK_BLOCKED',
          'The managed game requested content outside its two loopback origins.',
        );
      }
    },
    async probeWebGpu(): Promise<boolean> {
      return page.evaluate(() => 'gpu' in navigator);
    },
    assertSafe(): void {
      if (blockedExternalRequest) {
        throw captureError(
          'CAPTURE_EXTERNAL_NETWORK_BLOCKED',
          'The managed game requested content outside its two loopback origins.',
        );
      }
    },
    async close(): Promise<void> { await context.close(); },
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createManagedCaptureRuntime(
  options: ManagedCaptureRuntimeOptions,
): ManagedCaptureRuntime {
  const gameOrigin = exactLoopbackOrigin(options.gameUrl);
  const inspectionOrigin = exactLoopbackOrigin(options.inspectionUrl);
  const allowedOrigins = Object.freeze([gameOrigin, inspectionOrigin]);
  const launcher = options.launcher ?? defaultLauncher;
  const timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_LAUNCH_TIMEOUT_MILLISECONDS;
  const pollMilliseconds = options.pollMilliseconds ?? DEFAULT_RUNTIME_POLL_MILLISECONDS;
  let active: Readonly<{
    adapter: ManagedBrowserAdapter;
    profileDirectory: string;
    runtimeInstanceId: string;
  }> | null = null;
  let launching = false;
  let stopped = false;
  let webGpu: CaptureWebGpuStatus = Object.freeze({
    status: 'unknown-until-launch',
    unavailableReason: null,
  });

  const clean = async (
    owned: Readonly<{ adapter: ManagedBrowserAdapter; profileDirectory: string }> | null,
  ): Promise<void> => {
    if (!owned) return;
    await Promise.allSettled([
      owned.adapter.close(),
      rm(owned.profileDirectory, { recursive: true, force: true }),
    ]);
  };

  const ensureRuntime = async (
    input: Readonly<{ deviceScaleFactor: number }>,
  ): Promise<ManagedCaptureRuntimeResult> => {
    if (stopped) throw captureError('CAPTURE_RUNTIME_UNAVAILABLE', 'The capture session stopped.');
    if (
      !Number.isFinite(input.deviceScaleFactor)
      || input.deviceScaleFactor < 0.5
      || input.deviceScaleFactor > 2
    ) throw captureError('CAPTURE_RUNTIME_UNAVAILABLE', 'The capture target is unsupported.');
    if (active) {
      const runtime = options.readRuntime();
      if (
        runtime.state === 'connected'
        && runtime.runtimeInstanceId === active.runtimeInstanceId
        && runtime.lifecycle !== 'error'
        && runtime.lifecycle !== 'stopped'
      ) {
        active.adapter.assertSafe?.();
        return Object.freeze({ runtimeInstanceId: active.runtimeInstanceId, webGpu });
      }
      const stale = active;
      active = null;
      await clean(stale);
    }
    if (launching) throw captureError('CAPTURE_RUNTIME_BUSY', 'A managed capture runtime is starting.');
    if (options.readRuntime().state === 'connected') {
      throw captureError(
        'CAPTURE_RUNTIME_BUSY',
        'A person-controlled runtime is connected; managed capture did not replace it.',
      );
    }

    launching = true;
    let profileDirectory: string | null = null;
    let adapter: ManagedBrowserAdapter | null = null;
    try {
      profileDirectory = await mkdtemp(join(options.profileRoot ?? tmpdir(), 'antiky-capture-'));
      await chmod(profileDirectory, 0o700);
      adapter = await launcher({
        profileDirectory,
        allowedOrigins,
        viewport: Object.freeze({
          width: options.configuredWidth,
          height: options.configuredHeight,
        }),
        deviceScaleFactor: input.deviceScaleFactor,
      });
      if (adapter.browserVersion !== CAPTURE_BROWSER_VERSION) {
        throw captureError(
          'CAPTURE_BROWSER_VERSION_MISMATCH',
          'The installed managed browser does not match Antiky dependency state.',
        );
      }
      await adapter.navigate(options.gameUrl);
      adapter.assertSafe?.();
      if (!await adapter.probeWebGpu()) {
        webGpu = Object.freeze({ status: 'unavailable', unavailableReason: 'adapter-unavailable' });
        throw captureError('CAPTURE_WEBGPU_UNAVAILABLE', 'Managed Chromium did not expose WebGPU.');
      }
      webGpu = Object.freeze({ status: 'available', unavailableReason: null });
      const deadline = Date.now() + timeoutMilliseconds;
      while (true) {
        if (stopped) {
          throw captureError('CAPTURE_RUNTIME_DISCONNECTED', 'The capture session stopped during launch.');
        }
        adapter.assertSafe?.();
        const runtime = options.readRuntime();
        if (
          runtime.state === 'connected'
          && (runtime.lifecycle === 'error' || runtime.lifecycle === 'stopped')
        ) {
          throw captureError('CAPTURE_RUNTIME_UNAVAILABLE', 'The managed game runtime failed to initialize.');
        }
        if (
          runtime.state === 'connected'
          && runtime.runtimeInstanceId
          && ['ready', 'running', 'paused'].includes(String(runtime.lifecycle))
        ) {
          active = Object.freeze({ adapter, profileDirectory, runtimeInstanceId: runtime.runtimeInstanceId });
          return Object.freeze({ runtimeInstanceId: runtime.runtimeInstanceId, webGpu });
        }
        if (Date.now() >= deadline) {
          throw captureError('CAPTURE_RUNTIME_TIMEOUT', 'Managed runtime publication timed out.');
        }
        await delay(pollMilliseconds);
      }
    } catch (cause: unknown) {
      await clean(adapter && profileDirectory ? { adapter, profileDirectory } : null);
      if (!adapter && profileDirectory) await rm(profileDirectory, { recursive: true, force: true });
      if (cause instanceof AntikyCliError) throw cause;
      throw captureError('CAPTURE_BROWSER_LAUNCH_FAILED', 'Managed Chromium could not start safely.');
    } finally {
      launching = false;
    }
  };

  return Object.freeze({
    ensureRuntime,
    owns: (runtimeInstanceId: string) => active?.runtimeInstanceId === runtimeInstanceId,
    webGpuStatus: () => webGpu,
    assertSafe: () => active?.adapter.assertSafe?.(),
    async releaseRuntime(): Promise<void> {
      const owned = active;
      active = null;
      await clean(owned);
    },
    async stop(): Promise<void> {
      if (stopped) return;
      stopped = true;
      const owned = active;
      active = null;
      await clean(owned);
    },
  });
}
