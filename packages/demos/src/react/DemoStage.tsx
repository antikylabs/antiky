'use client';

import { createRenderer, type Renderer, type RendererBackend } from 'brometal';
import { useEffect, useRef, useState } from 'react';
import BackendToggle from './BackendToggle';
import {
  getBackendChoice,
  setLiveBackend,
  subscribeBackend,
  type BackendChoice,
  type DemoInstance,
  type DemoStats,
  type Pointer,
} from '../runtime';
import { loadDemo } from '../registry';

type Props = {
  slug: string;
  /** Thumbnails render a real first frame but never start a frame loop. */
  variant?: 'full' | 'hero' | 'thumb';
  label?: string;
  poster?: string;
};

type Phase = 'loading' | 'ready' | 'running' | 'paused' | 'error';

/** A small host around each BroMetal study. The first frame is visible as a
 * still; animation begins only after a visitor asks for it. */
export default function DemoStage({ slug, variant = 'full', label, poster }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const [choice, setChoice] = useState<BackendChoice>('auto');
  const [live, setLive] = useState<RendererBackend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DemoStats>({});
  const [fps, setFps] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setChoice(getBackendChoice());
    return subscribeBackend(setChoice);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;
    let visible = false;
    let started = false;
    runningRef.current = false;
    setError(null);
    setLive(null);
    setFps(0);
    setPhase('loading');

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
      if (pointer.down) {
        pointer.dragX += x - pointer.x;
        pointer.dragY += y - pointer.y;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
    };
    const onDown = (event: PointerEvent) => {
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
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 0.12 : 0.045;
      if (event.key === 'ArrowLeft') pointer.dragX -= step;
      else if (event.key === 'ArrowRight') pointer.dragX += step;
      else if (event.key === 'ArrowUp') pointer.dragY += step;
      else if (event.key === 'ArrowDown') pointer.dragY -= step;
      else return;
      event.preventDefault();
      pointer.active = true;
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('keydown', onKey);

    const start = async () => {
      let renderer: Renderer | null = null;
      let demo: DemoInstance | null = null;
      try {
        renderer = await createRenderer(canvas, {
          backend: choice,
          clearColor: [0.02, 0.02, 0.024, 1],
          cull: 'back',
        });
        if (cancelled) {
          renderer.destroy();
          return;
        }
        setLive(renderer.backend);
        if (variant === 'full') setLiveBackend(renderer.backend);

        const factory = await loadDemo(slug);
        if (!factory) throw new Error(`No demo is registered under "${slug}".`);
        demo = await factory({ renderer, pointer, report: setStats });
        if (cancelled) {
          demo.dispose();
          renderer.destroy();
          return;
        }

        let frames = 0;
        let lastReport = 0;
        let previewFrames = 12;
        const built = demo;
        const stop = renderer.loop((t) => {
          if (!visible || document.hidden) return;
          // BroMetal sizes the drawing buffer at the start of its own loop.
          // Draw two fixed-time frames there so the pre-activation still has
          // the correct aspect ratio and never flashes an empty canvas.
          if (!runningRef.current && previewFrames > 0) {
            built.frame(0.75);
            previewFrames -= 1;
            if (previewFrames === 0) setPhase('ready');
            return;
          }
          if (!runningRef.current) return;
          built.frame(t);
          frames += 1;
          if (t - lastReport >= 0.5) {
            setFps(Math.round(frames / Math.max(t - lastReport, 0.001)));
            frames = 0;
            lastReport = t;
          }
        });

        teardown = () => {
          stop();
          built.dispose();
          renderer?.destroy();
        };
      } catch (cause: unknown) {
        demo?.dispose();
        renderer?.destroy();
        if (cancelled) return;
        const detail = cause instanceof Error ? cause.message : String(cause);
        const message =
          choice === 'webgpu'
            ? `WebGPU is selected, but this browser could not start it (${detail}). Choose Auto or WebGL2 and try again.`
            : `The study could not start — ${detail}`;
        setError(message);
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
          setPhase('paused');
        }
      },
      { threshold: 0.01 },
    );
    observer.observe(canvas);

    return () => {
      cancelled = true;
      runningRef.current = false;
      if (variant === 'full') setLiveBackend(null);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('keydown', onKey);
      teardown?.();
    };
  }, [slug, choice, variant, retry]);

  const toggleRunning = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setPhase(next ? 'running' : 'paused');
  };

  return (
    <div
      className={`stage stage-${variant}`}
      data-phase={phase}
      style={poster ? { backgroundImage: `url(${poster})` } : undefined}
    >
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        aria-label={label ?? `${slug} interactive study`}
        role="img"
        tabIndex={variant === 'full' || variant === 'hero' ? 0 : -1}
      />

      {phase === 'loading' ? <div className="stage-status" role="status">Preparing live study…</div> : null}

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
          <span>{phase === 'ready' ? 'Run live' : 'Resume study'}</span>
        </button>
      ) : null}

      {variant === 'full' && phase !== 'error' ? (
        <div className="stage-hud">
          <BackendToggle live={live} />
          <div className="hud-readout" aria-live="polite">
            <span className="hud-chip"><b>{phase}</b></span>
            {phase === 'running' ? <span className="hud-chip"><b>{fps || '—'}</b> fps</span> : null}
            {stats.instances !== undefined ? (
              <span className="hud-chip"><b>{stats.instances.toLocaleString()}</b> instances</span>
            ) : null}
            {stats.drawCalls !== undefined ? (
              <span className="hud-chip"><b>{stats.drawCalls}</b> draw {stats.drawCalls === 1 ? 'call' : 'calls'}</span>
            ) : null}
          </div>
          {phase === 'running' ? (
            <button type="button" className="stage-pause" onClick={toggleRunning}>Pause</button>
          ) : null}
        </div>
      ) : null}

      {variant === 'hero' && phase === 'running' ? (
        <button type="button" className="stage-pause hero-pause" onClick={toggleRunning}>Pause</button>
      ) : null}
    </div>
  );
}
