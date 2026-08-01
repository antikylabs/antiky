import type { Renderer, RendererBackend } from 'brometal';

/* What a demo is allowed to know about the page it runs in.
 *
 * The stage owns the renderer, the backend choice, the frame loop, pausing off
 * screen, pointer state and teardown. A demo builds programs and draws. */

export type Pointer = {
  /** 0..1 across the canvas, y up. */
  x: number;
  y: number;
  down: boolean;
  /** False until the visitor points at the canvas, so demos can idle on an
   *  automatic path instead of sitting at a dead centred pointer. */
  active: boolean;
  /** Accumulated drag in canvas widths, for orbit controls. */
  dragX: number;
  dragY: number;
  /** Set by the stage when the visitor clicks; the demo clears it. */
  clicked: boolean;
};

/** Directional input normalized to one unit. Keyboard and touch controls write
 * the same state so a demo never needs to know which device produced it. */
export type MovementInput = {
  x: number;
  z: number;
  active: boolean;
};

export type DemoMode = 'ambient' | 'interactive' | 'thumbnail';

/** Numbers a demo wants shown in the HUD. Static facts, mostly — the stage
 *  measures frame rate itself. */
export type DemoStats = {
  instances?: number;
  drawCalls?: number;
  /** CPU→GPU bytes per frame after the first. The number the engine exists to
   *  keep small. */
  bytesPerFrame?: number;
  note?: string;
};

export type DemoSetup = {
  renderer: Renderer;
  pointer: Pointer;
  movement: MovementInput;
  mode: DemoMode;
  report(stats: DemoStats): void;
};

export type DemoInstance = {
  frame(elapsedSeconds: number): void;
  dispose(): void;
};

export type DemoFactory = (setup: DemoSetup) => DemoInstance | Promise<DemoInstance>;

export type BackendChoice = 'auto' | RendererBackend;

export const BACKEND_LABEL: Record<BackendChoice, string> = {
  auto: 'Auto',
  webgpu: 'WebGPU',
  webgl2: 'WebGL2',
};

const STORAGE_KEY = 'antiky.backend';
const listeners = new Set<(choice: BackendChoice) => void>();
let current: BackendChoice = 'auto';
let loaded = false;

function isChoice(value: string | null): value is BackendChoice {
  return value === 'auto' || value === 'webgpu' || value === 'webgl2';
}

/**
 * One backend preference for the whole site. Flipping it on any demo flips it
 * everywhere and survives a reload, because the interesting comparison is
 * running the *same* set of demos on the other backend.
 */
export function getBackendChoice(): BackendChoice {
  if (!loaded && typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isChoice(stored)) current = stored;
    loaded = true;
  }
  return current;
}

export function setBackendChoice(choice: BackendChoice): void {
  current = choice;
  loaded = true;
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, choice);
  for (const listener of listeners) listener(choice);
}

export function subscribeBackend(listener: (choice: BackendChoice) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether this browser exposes a WebGPU entry point at all. Not a promise that
 *  an adapter will be granted — `createRenderer` is the real test. */
export function webgpuLikelyAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/* What the renderer actually built, which is not always what was asked for:
 * `auto` resolves to whatever the browser can give. The stage publishes it here
 * so the toggle and the source panes can both react without prop-drilling
 * through the page. */

const liveListeners = new Set<(backend: RendererBackend | null) => void>();
let liveBackend: RendererBackend | null = null;

export function setLiveBackend(backend: RendererBackend | null): void {
  liveBackend = backend;
  for (const listener of liveListeners) listener(backend);
}

export function getLiveBackend(): RendererBackend | null {
  return liveBackend;
}

export function subscribeLiveBackend(
  listener: (backend: RendererBackend | null) => void,
): () => void {
  liveListeners.add(listener);
  return () => liveListeners.delete(listener);
}
