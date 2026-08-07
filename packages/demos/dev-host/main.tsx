/// <reference types="vite/client" />

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';

import { findDemo } from '../src/catalog';
import { DemoStage } from '../src/react';
import './style.css';

function readDimension(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 16_384 ? parsed : fallback;
}

const slug = import.meta.env.VITE_ANTIKY_DEMO_SLUG || 'town-study';
const gameWidth = readDimension(import.meta.env.VITE_ANTIKY_GAME_WIDTH, 1280);
const gameHeight = readDimension(import.meta.env.VITE_ANTIKY_GAME_HEIGHT, 720);
const inspectionOrigin = import.meta.env.VITE_ANTIKY_INSPECTION_ORIGIN || undefined;

function FocusedGameHost() {
  const demo = findDemo(slug);
  const boundaryRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: gameWidth, height: gameHeight });

  useLayoutEffect(() => {
    const boundary = boundaryRef.current;
    if (!boundary) return;
    const fit = ({ width, height }: Readonly<{ width: number; height: number }>) => {
      const scale = Math.min(width / gameWidth, height / gameHeight);
      setFrame({
        width: Math.max(1, Math.floor(gameWidth * scale)),
        height: Math.max(1, Math.floor(gameHeight * scale)),
      });
    };
    const observer = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect;
      if (size) fit(size);
    });
    observer.observe(boundary);
    fit(boundary.getBoundingClientRect());
    return () => observer.disconnect();
  }, []);

  if (!demo) {
    return (
      <main className="antiky-dev-error" role="alert">
        <h1>Game project could not be loaded</h1>
        <p>No demo is registered under <code>{slug}</code>. Check the development command in your <code>.antiky</code> project manifest and restart <code>antiky dev</code>.</p>
      </main>
    );
  }

  const frameStyle = {
    '--antiky-game-width': String(gameWidth),
    '--antiky-game-height': String(gameHeight),
    width: `${frame.width}px`,
    height: `${frame.height}px`,
  } as CSSProperties;

  return (
    <main className="antiky-dev-host" aria-label={`${demo.title} development host`}>
      <div ref={boundaryRef} className="antiky-game-boundary">
        <div className="antiky-game-frame" style={frameStyle}>
          <DemoStage
            slug={demo.slug}
            label={`${demo.title} game canvas`}
            controlMode={demo.controlMode}
            autoStart
            inspectionOrigin={inspectionOrigin}
          />
        </div>
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('The focused game host root is missing.');
createRoot(root).render(<FocusedGameHost />);
