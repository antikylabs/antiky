'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  GameHostContext,
  GameInstance,
  GameMeasurements,
  GameModuleEntry,
} from '@antiky/framework/game';
import { demoModuleUrl, type DemoSlug } from '@/lib/demos';

type StagePhase = 'poster' | 'ready' | 'loading' | 'running' | 'paused' | 'error';

type Props = Readonly<{
  slug: DemoSlug;
  label: string;
  variant?: 'hero' | 'thumb';
  controlMode?: 'move';
  poster?: string;
}>;

type MutablePointer = {
  x: number;
  y: number;
  down: boolean;
  active: boolean;
  dragX: number;
  dragY: number;
  clicked: boolean;
};

type MutableMovement = {
  x: number;
  z: number;
  active: boolean;
};

type Runtime = {
  instance: GameInstance;
  cancelFrame: () => void;
  removeListeners: () => void;
};

function validGameInstance(value: unknown): value is GameInstance {
  return typeof value === 'object' && value !== null
    && typeof (value as GameInstance).frame === 'function'
    && typeof (value as GameInstance).dispose === 'function';
}

function movementFromPressed(pressed: ReadonlySet<string>, movement: MutableMovement): void {
  const x = Number(pressed.has('ArrowRight') || pressed.has('KeyD'))
    - Number(pressed.has('ArrowLeft') || pressed.has('KeyA'));
  const z = Number(pressed.has('ArrowDown') || pressed.has('KeyS'))
    - Number(pressed.has('ArrowUp') || pressed.has('KeyW'));
  const length = Math.hypot(x, z);
  movement.x = length > 1 ? x / length : x;
  movement.z = length > 1 ? z / length : z;
  movement.active = length > 0;
}

export default function DemoStage({ slug, label, variant, controlMode, poster }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const visibleRef = useRef(true);
  const userPausedRef = useRef(false);
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState<StagePhase>(poster ? 'poster' : 'ready');
  const [error, setError] = useState('');
  const [measurements, setMeasurements] = useState<GameMeasurements>({});
  const [framesPerSecond, setFramesPerSecond] = useState<number | null>(null);

  const stopRuntime = useCallback(() => {
    const runtime = runtimeRef.current;
    runtimeRef.current = null;
    if (!runtime) return;
    runtime.cancelFrame();
    runtime.removeListeners();
    runtime.instance.dispose();
  }, []);

  const activate = useCallback(async () => {
    if (runtimeRef.current || phase === 'loading' || variant === 'thumb') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!('gpu' in navigator)) {
      setError('This demo needs a browser with WebGPU support.');
      setPhase('error');
      return;
    }

    setError('');
    setPhase('loading');
    const pointer: MutablePointer = {
      x: 0.5,
      y: 0.5,
      down: false,
      active: false,
      dragX: 0,
      dragY: 0,
      clicked: false,
    };
    const movement: MutableMovement = { x: 0, z: 0, active: false };
    const pressed = new Set<string>();
    const removals: Array<() => void> = [];
    const listen = <Target extends EventTarget>(
      target: Target,
      event: string,
      listener: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(event, listener, options);
      removals.push(() => target.removeEventListener(event, listener, options));
    };
    const updatePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const nextX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const nextY = Math.min(1, Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height));
      if (pointer.down) {
        pointer.dragX += nextX - pointer.x;
        pointer.dragY += nextY - pointer.y;
      }
      pointer.x = nextX;
      pointer.y = nextY;
      pointer.active = true;
    };
    listen(canvas, 'pointerdown', ((event: PointerEvent) => {
      updatePointer(event);
      pointer.down = true;
      canvas.setPointerCapture(event.pointerId);
      canvas.focus();
    }) as EventListener);
    listen(canvas, 'pointermove', ((event: PointerEvent) => updatePointer(event)) as EventListener);
    const endPointer = ((event: PointerEvent) => {
      updatePointer(event);
      pointer.clicked = pointer.down;
      pointer.down = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }) as EventListener;
    listen(canvas, 'pointerup', endPointer);
    listen(canvas, 'pointercancel', endPointer);
    listen(window, 'keydown', ((event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) return;
      if (document.activeElement !== canvas) return;
      event.preventDefault();
      pressed.add(event.code);
      movementFromPressed(pressed, movement);
    }) as EventListener);
    listen(window, 'keyup', ((event: KeyboardEvent) => {
      pressed.delete(event.code);
      movementFromPressed(pressed, movement);
    }) as EventListener);
    listen(window, 'blur', (() => {
      pressed.clear();
      movementFromPressed(pressed, movement);
    }) as EventListener);

    let frameRequest = 0;
    let frameCount = 0;
    let fpsWindowStart = performance.now();
    let instance: GameInstance | null = null;
    const frame = (now: number) => {
      if (!instance || userPausedRef.current || !visibleRef.current || document.hidden) {
        frameRequest = requestAnimationFrame(frame);
        return;
      }
      try {
        instance.frame(now / 1000);
        pointer.clicked = false;
        frameCount += 1;
        if (now - fpsWindowStart >= 1000) {
          setFramesPerSecond(Math.round(frameCount * 1000 / (now - fpsWindowStart)));
          frameCount = 0;
          fpsWindowStart = now;
        }
        frameRequest = requestAnimationFrame(frame);
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'The game stopped after an unknown error.');
        setPhase('error');
        stopRuntime();
      }
    };

    try {
      const moduleUrl = demoModuleUrl(slug);
      const loaded = await import(/* webpackIgnore: true */ moduleUrl) as { default?: unknown };
      if (typeof loaded.default !== 'function') throw new Error('The compiled game has no default game-module entry.');
      const entry = loaded.default as GameModuleEntry;
      const context: GameHostContext = {
        canvas,
        runtimeInstanceId: `website-${slug}-${crypto.randomUUID()}`,
        pointer,
        movement,
        mode: 'interactive',
        report(nextMeasurements) {
          if (mountedRef.current) setMeasurements(nextMeasurements);
        },
      };
      instance = await entry(context);
      if (!validGameInstance(instance)) throw new Error('The compiled game returned an invalid game instance.');
      if (!mountedRef.current) {
        instance.dispose();
        return;
      }
      runtimeRef.current = {
        instance,
        cancelFrame: () => cancelAnimationFrame(frameRequest),
        removeListeners: () => removals.splice(0).forEach((remove) => remove()),
      };
      setPhase('running');
      canvas.focus();
      frameRequest = requestAnimationFrame(frame);
    } catch (cause: unknown) {
      removals.splice(0).forEach((remove) => remove());
      instance?.dispose();
      setError(cause instanceof Error ? cause.message : 'The game artifact could not start.');
      setPhase('error');
    }
  }, [phase, slug, stopRuntime, variant]);

  useEffect(() => {
    mountedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry?.isIntersecting ?? false;
    }, { threshold: 0.05 });
    observer.observe(canvas);
    return () => {
      mountedRef.current = false;
      observer.disconnect();
      stopRuntime();
    };
  }, [stopRuntime]);

  const togglePause = () => {
    userPausedRef.current = !userPausedRef.current;
    setPhase(userPausedRef.current ? 'paused' : 'running');
  };

  const setDirection = (code: string, active: boolean) => {
    const event = new KeyboardEvent(active ? 'keydown' : 'keyup', { code, bubbles: true });
    canvasRef.current?.dispatchEvent(event);
  };

  const displayPhase = phase === 'poster' ? 'ready' : phase;
  const classes = ['stage', variant ? `stage-${variant}` : '', poster ? 'stage-has-poster' : '']
    .filter(Boolean)
    .join(' ');
  const style = poster ? { backgroundImage: `url(${poster})` } : undefined;

  return (
    <div className={classes} data-phase={displayPhase} style={style}>
      <canvas ref={canvasRef} className="stage-canvas" aria-label={label} tabIndex={0} />
      {variant === 'thumb' ? (
        <div className="stage-status">Open to run</div>
      ) : phase === 'loading' ? (
        <div className="stage-status">Loading verified game artifact…</div>
      ) : phase === 'error' ? (
        <div className="stage-fallback" role="alert">
          <span>{error}</span>
          <button className="stage-action" type="button" onClick={() => { setPhase(poster ? 'poster' : 'ready'); void activate(); }}>Retry</button>
        </div>
      ) : phase === 'poster' || phase === 'ready' ? (
        <button className="stage-activate" type="button" onClick={() => void activate()}>
          <span className="stage-play" aria-hidden="true">▶</span>
          Run {slug === 'shader-study' ? 'Shader Study' : 'the live scene'}
        </button>
      ) : (
        <>
          <div className="stage-hud">
            <button className="stage-pause" type="button" onClick={togglePause}>
              {phase === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <div className="hud-readout" aria-live="polite">
              {framesPerSecond !== null && <span className="hud-chip"><b>{framesPerSecond}</b>&nbsp;fps</span>}
              {measurements.drawCalls !== undefined && <span className="hud-chip"><b>{measurements.drawCalls}</b>&nbsp;draws</span>}
              {measurements.instances !== undefined && <span className="hud-chip"><b>{measurements.instances}</b>&nbsp;instances</span>}
            </div>
          </div>
          {controlMode === 'move' && (
            <div className="stage-dpad" aria-label="Movement controls">
              {([
                ['ArrowUp', '↑', 'dpad-up'],
                ['ArrowLeft', '←', 'dpad-left'],
                ['ArrowRight', '→', 'dpad-right'],
                ['ArrowDown', '↓', 'dpad-down'],
              ] as const).map(([code, arrow, className]) => (
                <button
                  className={className}
                  key={code}
                  type="button"
                  aria-label={`Move ${code.slice(5).toLowerCase()}`}
                  onPointerDown={(event) => { event.preventDefault(); setDirection(code, true); }}
                  onPointerUp={() => setDirection(code, false)}
                  onPointerCancel={() => setDirection(code, false)}
                  onPointerLeave={() => setDirection(code, false)}
                >{arrow}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
