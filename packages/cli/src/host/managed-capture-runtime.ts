/// <reference lib="dom" />

import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, type BrowserContext, type Page, type Route } from 'playwright';

import {
  CAPTURE_BROWSER_VERSION,
  type CaptureWebGpuStatus,
} from '../development/capture-capabilities.ts';
import type { PresentationTraceEntryV1 } from '../development/capture-sequence.ts';
import { AntikyCliError } from '../errors.ts';
import { decodePng } from './capture-action.ts';

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
  captureCanvasPng?(): Promise<Buffer>;
  performPresentationAction?(action: ManagedPresentationAction): Promise<void>;
  waitForPresentationFrame?(): Promise<void>;
  encodePngSequence?(
    frames: readonly Buffer[],
    framesPerSecond: number,
  ): Promise<ManagedWebMEncoding>;
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

export type ManagedPresentationAction = Extract<
  PresentationTraceEntryV1,
  Readonly<{
    kind:
      | 'key-press'
      | 'key-release'
      | 'pointer-move'
      | 'pointer-press'
      | 'pointer-release';
  }>
>;

export type ManagedWebMEncoding = Readonly<{
  bytes: Buffer;
  encoder: Readonly<{
    name: 'chromium-media-recorder';
    version: string;
    codec: 'vp9';
    mimeType: 'video/webm';
    videoBitsPerSecond: 8_000_000;
    source: 'png-masters';
    audio: 'none';
  }>;
}>;

export interface ManagedCaptureRuntime {
  ensureRuntime(input: Readonly<{ deviceScaleFactor: number }>): Promise<ManagedCaptureRuntimeResult>;
  owns(runtimeInstanceId: string): boolean;
  webGpuStatus(): CaptureWebGpuStatus;
  assertSafe(): void;
  captureCanvasPng(runtimeInstanceId: string): Promise<Buffer>;
  performPresentationAction(
    runtimeInstanceId: string,
    action: ManagedPresentationAction,
  ): Promise<void>;
  waitForPresentationFrame(runtimeInstanceId: string): Promise<void>;
  encodePngSequence(
    runtimeInstanceId: string,
    frames: readonly Buffer[],
    framesPerSecond: number,
  ): Promise<ManagedWebMEncoding>;
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
    | 'CAPTURE_RUNTIME_DISCONNECTED'
    | 'CAPTURE_CANVAS_MISSING'
    | 'CAPTURE_TRACE_INVALID'
    | 'CAPTURE_ENCODER_UNAVAILABLE',
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
  const encoderStateKey = '__antikyManagedCanvasEncoderV1';
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
    async captureCanvasPng(): Promise<Buffer> {
      const base64 = await page.evaluate(() => {
        const target = document.querySelector('#antiky-game');
        if (!(target instanceof HTMLCanvasElement)) throw new Error('canvas unavailable');
        const prefix = 'data:image/png;base64,';
        const dataUrl = target.toDataURL('image/png');
        if (!dataUrl.startsWith(prefix)) throw new Error('png unavailable');
        return dataUrl.slice(prefix.length);
      });
      return decodePng(base64);
    },
    async performPresentationAction(action: ManagedPresentationAction): Promise<void> {
      if (action.kind === 'key-press' || action.kind === 'key-release') {
        await page.evaluate(({ kind, code }) => {
          const target = document.querySelector('#antiky-game');
          if (!(target instanceof HTMLCanvasElement)) throw new Error('canvas unavailable');
          const key = code === 'Space'
            ? ' '
            : code.startsWith('Key')
              ? code.slice(3).toLowerCase()
              : code;
          target.focus({ preventScroll: true });
          target.dispatchEvent(new KeyboardEvent(kind === 'key-press' ? 'keydown' : 'keyup', {
            bubbles: true,
            cancelable: true,
            code,
            key,
          }));
        }, action);
        return;
      }
      const box = await page.locator('#antiky-game').boundingBox();
      if (!box || box.width <= 0 || box.height <= 0) throw new Error('canvas unavailable');
      if (action.kind === 'pointer-move') {
        await page.mouse.move(box.x + box.width * action.x, box.y + box.height * action.y);
        return;
      }
      if (action.kind === 'pointer-press') {
        await page.mouse.down({ button: 'left' });
        return;
      }
      await page.mouse.up({ button: 'left' });
    },
    async waitForPresentationFrame(): Promise<void> {
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    },
    async encodePngSequence(
      frames: readonly Buffer[],
      framesPerSecond: number,
    ): Promise<ManagedWebMEncoding> {
      if (frames.length < 1) throw new Error('frames unavailable');
      const first = decodePng(frames[0]!.toString('base64'));
      const width = first.readUInt32BE(16);
      const height = first.readUInt32BE(20);
      const frameDelayMilliseconds = 1000 / framesPerSecond;
      await page.evaluate(async ({ key, width: canvasWidth, height: canvasHeight }) => {
        const ownedWindow = window as typeof window & Record<string, unknown>;
        if (typeof MediaRecorder !== 'function') throw new Error('encoder unavailable');
        const mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) throw new Error('encoder unavailable');
        const encodingCanvas = document.createElement('canvas');
        encodingCanvas.width = canvasWidth;
        encodingCanvas.height = canvasHeight;
        const context2d = encodingCanvas.getContext('2d', { alpha: true });
        if (!context2d) throw new Error('encoder unavailable');
        const stream = encodingCanvas.captureStream(0);
        const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
        if (!track || typeof track.requestFrame !== 'function') throw new Error('encoder unavailable');
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8_000_000,
        });
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        ownedWindow[key] = { encodingCanvas, context2d, stream, track, recorder, chunks };
        recorder.start();
        if (recorder.state !== 'recording') throw new Error('encoder unavailable');
      }, { key: encoderStateKey, width, height });
      try {
        for (const frame of frames) {
          const dataBase64 = frame.toString('base64');
          await page.evaluate(async ({ key, dataBase64, frameDelayMilliseconds: wait }) => {
            const ownedWindow = window as typeof window & Record<string, unknown>;
            const state = ownedWindow[key] as {
              context2d: CanvasRenderingContext2D;
              track: CanvasCaptureMediaStreamTrack;
            } | undefined;
            if (!state) throw new Error('encoder unavailable');
            const bytes = Uint8Array.from(atob(dataBase64), (character) => character.charCodeAt(0));
            const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
            state.context2d.clearRect(0, 0, bitmap.width, bitmap.height);
            state.context2d.drawImage(bitmap, 0, 0);
            bitmap.close();
            state.track.requestFrame();
            await new Promise((resolve) => setTimeout(resolve, wait));
          }, { key: encoderStateKey, dataBase64, frameDelayMilliseconds });
        }
        const dataBase64 = await page.evaluate(async (key) => {
          const ownedWindow = window as typeof window & Record<string, unknown>;
          const state = ownedWindow[key] as {
            stream: MediaStream;
            recorder: MediaRecorder;
            chunks: Blob[];
          } | undefined;
          if (!state) throw new Error('encoder unavailable');
          const stopped = new Promise<void>((resolve, reject) => {
            state.recorder.onstop = () => resolve();
            state.recorder.onerror = () => reject(new Error('encoder unavailable'));
          });
          state.recorder.stop();
          await stopped;
          state.stream.getTracks().forEach((track) => track.stop());
          delete ownedWindow[key];
          const blob = new Blob(state.chunks, { type: 'video/webm' });
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('encoder unavailable'));
            reader.onload = () => {
              const value = reader.result;
              if (typeof value !== 'string') return reject(new Error('encoder unavailable'));
              resolve(value.slice(value.indexOf(',') + 1));
            };
            reader.readAsDataURL(blob);
          });
        }, encoderStateKey);
        const bytes = Buffer.from(dataBase64, 'base64');
        if (bytes.byteLength < 4) throw new Error('encoder unavailable');
        return Object.freeze({
          bytes,
          encoder: Object.freeze({
            name: 'chromium-media-recorder' as const,
            version: CAPTURE_BROWSER_VERSION,
            codec: 'vp9' as const,
            mimeType: 'video/webm' as const,
            videoBitsPerSecond: 8_000_000 as const,
            source: 'png-masters' as const,
            audio: 'none' as const,
          }),
        });
      } catch (cause) {
        await page.evaluate((key) => {
          const ownedWindow = window as typeof window & Record<string, unknown>;
          const state = ownedWindow[key] as { stream?: MediaStream; recorder?: MediaRecorder } | undefined;
          try {
            if (state?.recorder?.state !== 'inactive') state?.recorder?.stop();
            state?.stream?.getTracks().forEach((track) => track.stop());
          } finally {
            delete ownedWindow[key];
          }
        }, encoderStateKey).catch(() => {});
        throw cause;
      }
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

  const requireOwnedAdapter = (runtimeInstanceId: string): ManagedBrowserAdapter => {
    const runtime = options.readRuntime();
    if (
      !active
      || active.runtimeInstanceId !== runtimeInstanceId
      || runtime.state !== 'connected'
      || runtime.runtimeInstanceId !== runtimeInstanceId
      || runtime.lifecycle === 'error'
      || runtime.lifecycle === 'stopped'
    ) {
      throw captureError(
        'CAPTURE_RUNTIME_DISCONNECTED',
        'The managed capture runtime changed; read status and retry.',
      );
    }
    active.adapter.assertSafe?.();
    return active.adapter;
  };

  return Object.freeze({
    ensureRuntime,
    owns: (runtimeInstanceId: string) => active?.runtimeInstanceId === runtimeInstanceId,
    webGpuStatus: () => webGpu,
    assertSafe: () => active?.adapter.assertSafe?.(),
    async captureCanvasPng(runtimeInstanceId: string): Promise<Buffer> {
      const adapter = requireOwnedAdapter(runtimeInstanceId);
      if (!adapter.captureCanvasPng) {
        throw captureError('CAPTURE_CANVAS_MISSING', 'Canvas capture is unavailable.');
      }
      try {
        const bytes = await adapter.captureCanvasPng();
        return decodePng(bytes.toString('base64'));
      } catch (cause: unknown) {
        if (cause instanceof AntikyCliError) throw cause;
        throw captureError('CAPTURE_CANVAS_MISSING', 'The registered game canvas could not be captured.');
      }
    },
    async performPresentationAction(
      runtimeInstanceId: string,
      action: ManagedPresentationAction,
    ): Promise<void> {
      const adapter = requireOwnedAdapter(runtimeInstanceId);
      if (!adapter.performPresentationAction) {
        throw captureError('CAPTURE_TRACE_INVALID', 'Managed presentation input is unavailable.');
      }
      try {
        await adapter.performPresentationAction(action);
        adapter.assertSafe?.();
      } catch (cause: unknown) {
        if (cause instanceof AntikyCliError) throw cause;
        throw captureError('CAPTURE_TRACE_INVALID', 'Managed presentation input could not be applied.');
      }
    },
    async waitForPresentationFrame(runtimeInstanceId: string): Promise<void> {
      const adapter = requireOwnedAdapter(runtimeInstanceId);
      if (!adapter.waitForPresentationFrame) {
        throw captureError('CAPTURE_RUNTIME_UNAVAILABLE', 'Presentation frame waiting is unavailable.');
      }
      try {
        await adapter.waitForPresentationFrame();
        adapter.assertSafe?.();
      } catch (cause: unknown) {
        if (cause instanceof AntikyCliError) throw cause;
        throw captureError('CAPTURE_RUNTIME_DISCONNECTED', 'The managed runtime stopped during capture.');
      }
    },
    async encodePngSequence(
      runtimeInstanceId: string,
      frames: readonly Buffer[],
      framesPerSecond: number,
    ): Promise<ManagedWebMEncoding> {
      const adapter = requireOwnedAdapter(runtimeInstanceId);
      if (!adapter.encodePngSequence) {
        throw captureError('CAPTURE_ENCODER_UNAVAILABLE', 'Managed WebM encoding is unavailable.');
      }
      try {
        const encoded = await adapter.encodePngSequence(frames, framesPerSecond);
        if (encoded.bytes.byteLength < 1) throw new Error('empty encoder output');
        adapter.assertSafe?.();
        return encoded;
      } catch (cause: unknown) {
        if (cause instanceof AntikyCliError) throw cause;
        throw captureError('CAPTURE_ENCODER_UNAVAILABLE', 'Managed WebM encoding failed.');
      }
    },
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
