'use client';

import { createRenderer, type Renderer } from 'brometal';
import { useEffect, useRef, useState } from 'react';
import { inspectPointLightService } from '@antiky/framework';
import {
  type DemoInstance,
  type DemoMode,
  type DemoStats,
  type MovementInput,
  type Pointer,
} from '../runtime';
import type { DemoInspectionInput, DemoRuntimePhase } from '../runtime-inspection';
import { loadDemo } from '../registry';
import {
  createPausableRenderLoop,
  type PausableRenderLoop,
} from './pausable-render-loop';

type Props = {
  slug: string;
  variant?: 'full' | 'hero' | 'thumb';
  label?: string;
  poster?: string;
  controlMode?: 'move' | 'orbit';
  autoStart?: boolean;
  inspectionOrigin?: string;
};

type Phase = Exclude<DemoRuntimePhase, 'stopped'>;

type InspectionPublisher = Readonly<{
  publish(input: DemoInspectionInput): Promise<void>;
  disconnect(input: DemoInspectionInput): Promise<void>;
  close(): void;
}>;

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

function DpadArrow({ rotation }: { rotation: number }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M9 14.25V3.75M4.75 8 9 3.75 13.25 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Poster-first host for BroMetal studies. Home loads only when visible and then
 * autoplays; the detail route holds on the real poster until the visitor starts. */
export default function LiveDemoStage({
  slug,
  variant = 'full',
  label,
  poster,
  controlMode = 'orbit',
  autoStart = false,
  inspectionOrigin,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const frameCountRef = useRef(0);
  const runtimeInstanceIdRef = useRef('runtime-pending');
  const demoInstanceRef = useRef<DemoInstance | null>(null);
  const frameLoopRef = useRef<PausableRenderLoop | null>(null);
  const inspectionPublisherRef = useRef<InspectionPublisher | null>(null);
  const inspectionInputRef = useRef<DemoInspectionInput | null>(null);
  const movementRef = useRef<MovementInput>({ x: 0, z: 0, active: false });
  const pressedRef = useRef(new Set<string>());
  const touchRef = useRef({ x: 0, z: 0 });
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DemoStats>({});
  const [fps, setFps] = useState(0);
  const [phase, setPhase] = useState<Phase>(poster ? 'poster' : 'loading');
  const [retry, setRetry] = useState(0);
  const [inspectionTick, setInspectionTick] = useState(0);

  const syncMovement = () => {
    const keys = pressedRef.current;
    let x = touchRef.current.x;
    let z = touchRef.current.z;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) z -= 1;
    if (keys.has('s') || keys.has('arrowdown')) z += 1;
    const length = Math.hypot(x, z);
    movementRef.current.x = length > 1 ? x / length : x;
    movementRef.current.z = length > 1 ? z / length : z;
    movementRef.current.active = length > 0.01;
  };

  const setTouchMove = (x: number, z: number) => {
    touchRef.current = { x, z };
    syncMovement();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;
    let visible = false;
    let started = false;
    let pausedByVisibility = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode: DemoMode = variant === 'full' ? 'interactive' : variant === 'thumb' ? 'thumbnail' : 'ambient';

    runningRef.current = false;
    frameCountRef.current = 0;
    runtimeInstanceIdRef.current = crypto.randomUUID();
    demoInstanceRef.current = null;
    movementRef.current = { x: 0, z: 0, active: false };
    pressedRef.current.clear();
    touchRef.current = { x: 0, z: 0 };
    setError(null);
    setStats({});
    setFps(0);
    setPhase(poster ? 'poster' : 'loading');

    const pointer: Pointer = {
      x: 0.5,
      y: 0.5,
      down: false,
      active: false,
      dragX: 0,
      dragY: 0,
      clicked: false,
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
      if (pointer.down && controlMode === 'orbit') {
        pointer.dragX += x - pointer.x;
        pointer.dragY += y - pointer.y;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
    };
    const onDown = (event: PointerEvent) => {
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture?.(event.pointerId);
      pointer.down = true;
      pointer.clicked = true;
    };
    const onUp = () => {
      pointer.down = false;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.down = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!runningRef.current || document.activeElement !== canvas) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (controlMode === 'move' && MOVE_KEYS.has(key)) {
        pressedRef.current.add(key);
        syncMovement();
        event.preventDefault();
        return;
      }
      if (controlMode !== 'orbit') return;
      const step = event.shiftKey ? 0.12 : 0.045;
      if (event.key === 'ArrowLeft') pointer.dragX -= step;
      else if (event.key === 'ArrowRight') pointer.dragX += step;
      else if (event.key === 'ArrowUp') pointer.dragY += step;
      else if (event.key === 'ArrowDown') pointer.dragY -= step;
      else return;
      event.preventDefault();
      pointer.active = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!MOVE_KEYS.has(key)) return;
      pressedRef.current.delete(key);
      syncMovement();
    };
    const onBlur = () => {
      pressedRef.current.clear();
      touchRef.current = { x: 0, z: 0 };
      syncMovement();
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const start = async () => {
      let renderer: Renderer | null = null;
      let demo: DemoInstance | null = null;
      setPhase('loading');
      try {
        renderer = await createRenderer(canvas, {
          clearColor: [0.05, 0.04, 0.045, 1],
          cull: 'back',
        });
        if (cancelled) {
          renderer.destroy();
          return;
        }
        const factory = await loadDemo(slug);
        if (!factory) throw new Error(`No demo is registered under "${slug}".`);
        demo = await factory({
          renderer,
          runtimeInstanceId: runtimeInstanceIdRef.current,
          pointer,
          movement: movementRef.current,
          mode,
          report: (nextStats) => {
            setStats(nextStats);
            setInspectionTick((value) => value + 1);
          },
        });
        if (cancelled) {
          demo.dispose();
          renderer.destroy();
          return;
        }
        demoInstanceRef.current = demo;
        setInspectionTick((value) => value + 1);

        let frames = 0;
        let lastReport = 0;
        let previewFrames = 2;
        const built = demo;
        const builtRenderer = renderer;
        const autoplay = autoStart || (variant === 'hero' && !reducedMotion);
        let frameLoop: PausableRenderLoop;
        frameLoop = createPausableRenderLoop((frame) => builtRenderer.loop(frame), (time) => {
          if (!visible || document.hidden) return;
          if (!runningRef.current && previewFrames > 0) {
            built.frame(0.8);
            frameCountRef.current += 1;
            previewFrames -= 1;
            if (previewFrames === 0) {
              if (autoplay) {
                runningRef.current = true;
                setPhase('running');
                if (autoStart) canvas.focus({ preventScroll: true });
              } else {
                setPhase('ready');
                frameLoop.pause();
              }
            }
            return;
          }
          if (!runningRef.current) return;
          built.frame(time);
          frames += 1;
          frameCountRef.current += 1;
          if (time - lastReport >= 0.5) {
            setFps(Math.round(frames / Math.max(time - lastReport, 0.001)));
            setInspectionTick((value) => value + 1);
            frames = 0;
            lastReport = time;
          }
        });
        frameLoopRef.current = frameLoop;
        frameLoop.start();

        teardown = () => {
          if (frameLoopRef.current === frameLoop) frameLoopRef.current = null;
          frameLoop.dispose();
          if (demoInstanceRef.current === built) demoInstanceRef.current = null;
          built.dispose();
          renderer?.destroy();
        };
      } catch (cause: unknown) {
        demoInstanceRef.current = null;
        demo?.dispose();
        renderer?.destroy();
        if (cancelled) return;
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(`WebGPU could not start — ${detail}`);
        setPhase('error');
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (visible && !started) {
          started = true;
          void start();
        } else if (!visible && runningRef.current) {
          runningRef.current = false;
          frameLoopRef.current?.pause();
          pausedByVisibility = true;
          setPhase('paused');
        } else if (
          visible
          && pausedByVisibility
          && (autoStart || (variant === 'hero' && !reducedMotion))
        ) {
          pausedByVisibility = false;
          runningRef.current = true;
          frameLoopRef.current?.start();
          setPhase('running');
        }
      },
      { rootMargin: '160px 0px', threshold: 0.01 },
    );
    observer.observe(canvas);

    return () => {
      cancelled = true;
      runningRef.current = false;
      movementRef.current = { x: 0, z: 0, active: false };
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      teardown?.();
    };
  }, [slug, variant, poster, controlMode, autoStart, retry]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !inspectionOrigin) return;
    let disposed = false;
    void import('./development-inspection').then(async ({
      connectDevelopmentInspectionPublisher,
    }) => {
      const publisher = await connectDevelopmentInspectionPublisher(inspectionOrigin, {
        reload: () => window.location.reload(),
        async captureFrame() {
          const canvas = canvasRef.current;
          if (!canvas) throw new Error('The demo canvas is unavailable.');
          const dataUrl = canvas.toDataURL('image/png');
          const prefix = 'data:image/png;base64,';
          if (!dataUrl.startsWith(prefix)) throw new Error('The demo canvas did not produce a PNG.');
          return {
            mimeType: 'image/png',
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            dataBase64: dataUrl.slice(prefix.length),
          };
        },
        setPointLightPower(command, context) {
          const service = demoInstanceRef.current?.pointLightService;
          if (!service) throw new Error('The demo point-light service is unavailable.');
          const result = service.submitPointLightPower(command, context);
          setInspectionTick((value) => value + 1);
          return result;
        },
        correctPointLightPower(request, context) {
          const service = demoInstanceRef.current?.pointLightService;
          if (!service) throw new Error('The demo point-light service is unavailable.');
          const result = service.correctPointLightPower(request, context);
          setInspectionTick((value) => value + 1);
          return result;
        },
      });
      if (disposed) {
        publisher?.close();
        return;
      }
      inspectionPublisherRef.current = publisher;
      const input = inspectionInputRef.current;
      if (publisher && input) await publisher.publish(input);
    }).catch(() => {
      // Inspection is optional for ordinary website development.
    });

    return () => {
      disposed = true;
      const publisher = inspectionPublisherRef.current;
      inspectionPublisherRef.current = null;
      const input = inspectionInputRef.current;
      if (publisher && input) {
        void publisher.disconnect(input).finally(() => publisher.close());
      } else {
        publisher?.close();
      }
    };
  }, [inspectionOrigin]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const canvas = canvasRef.current;
    const pointLightService = demoInstanceRef.current?.pointLightService;
    const input: DemoInspectionInput = Object.freeze({
      runtimeInstanceId: runtimeInstanceIdRef.current,
      phase,
      frameCount: frameCountRef.current,
      framesPerSecond: fps,
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      stats: Object.freeze({ ...stats }),
      error,
      ...(pointLightService === undefined
        ? {}
        : { pointLights: inspectPointLightService(pointLightService) }),
    });
    inspectionInputRef.current = input;
    void inspectionPublisherRef.current?.publish(input).catch(() => {
      // The development host reports connection health; the demo stays usable.
    });
  }, [error, fps, inspectionTick, phase, retry, stats]);

  const toggleRunning = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    if (next) frameLoopRef.current?.start();
    else frameLoopRef.current?.pause();
    setPhase(next ? 'running' : 'paused');
    if (next) canvasRef.current?.focus({ preventScroll: true });
  };

  const beginTouch = (x: number, z: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setTouchMove(x, z);
  };
  const endTouch = () => setTouchMove(0, 0);

  return (
    <div
      className={`stage stage-${variant}${poster ? ' stage-has-poster' : ''}`}
      data-phase={phase}
      style={poster ? { backgroundImage: `url(${poster})` } : undefined}
    >
      <canvas
        key={retry}
        ref={canvasRef}
        className="stage-canvas"
        aria-label={label ?? `${slug} interactive study`}
        role="img"
        tabIndex={variant === 'full' || variant === 'hero' ? 0 : -1}
      />

      {phase === 'loading' ? <div className="stage-status" role="status">Loading study…</div> : null}

      {error ? (
        <div className="stage-fallback" role="alert">
          <span>{error}</span>
          <button type="button" className="stage-action" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : null}

      {variant !== 'thumb' && (phase === 'ready' || phase === 'paused') ? (
        <button type="button" className="stage-activate" onClick={toggleRunning}>
          <svg className="stage-play" viewBox="0 0 18 18" aria-hidden="true"><path d="m6.5 4.5 7 4.5-7 4.5Z" fill="currentColor" /></svg>
          <span>{phase === 'ready' ? 'Enter the town' : 'Resume study'}</span>
        </button>
      ) : null}

      {variant === 'full' && phase !== 'error' && phase !== 'poster' && phase !== 'loading' ? (
        <div className="stage-hud">
          <div className="hud-readout" aria-live="polite">
            <span className="hud-chip"><b>{phase}</b></span>
            {phase === 'running' ? <span className="hud-chip"><b>{fps || '—'}</b> fps</span> : null}
            {stats.instances !== undefined ? <span className="hud-chip"><b>{stats.instances.toLocaleString()}</b> instances</span> : null}
            {stats.drawCalls !== undefined ? <span className="hud-chip"><b>{stats.drawCalls}</b> draw calls</span> : null}
          </div>
          {phase === 'running' ? <button type="button" className="stage-pause" onClick={toggleRunning}>Pause</button> : null}
        </div>
      ) : null}

      {variant === 'full' && controlMode === 'move' && phase === 'running' ? (
        <div className="stage-dpad" aria-label="Movement controls">
          <button type="button" className="dpad-up" aria-label="Move forward" onPointerDown={beginTouch(0, -1)} onPointerUp={endTouch} onPointerCancel={endTouch} onPointerLeave={endTouch}><DpadArrow rotation={0} /></button>
          <button type="button" className="dpad-left" aria-label="Move left" onPointerDown={beginTouch(-1, 0)} onPointerUp={endTouch} onPointerCancel={endTouch} onPointerLeave={endTouch}><DpadArrow rotation={-90} /></button>
          <button type="button" className="dpad-right" aria-label="Move right" onPointerDown={beginTouch(1, 0)} onPointerUp={endTouch} onPointerCancel={endTouch} onPointerLeave={endTouch}><DpadArrow rotation={90} /></button>
          <button type="button" className="dpad-down" aria-label="Move backward" onPointerDown={beginTouch(0, 1)} onPointerUp={endTouch} onPointerCancel={endTouch} onPointerLeave={endTouch}><DpadArrow rotation={180} /></button>
        </div>
      ) : null}

      {variant === 'hero' && phase === 'running' ? (
        <button type="button" className="stage-pause hero-pause" onClick={toggleRunning}>Pause</button>
      ) : null}
    </div>
  );
}
