'use client';

import type { RendererBackend } from 'brometal';
import { useEffect, useState } from 'react';
import { getLiveBackend, subscribeLiveBackend } from '../runtime';

export type ShaderSources = { typescript: string; glsl: string; wgsl: string };

type Pane = { key: keyof ShaderSources; label: string; backend?: RendererBackend };

const PANES: Pane[] = [
  { key: 'typescript', label: 'aurora.shader.ts' },
  { key: 'glsl', label: 'GLSL ES 3.00', backend: 'webgl2' },
  { key: 'wgsl', label: 'WGSL', backend: 'webgpu' },
];

/**
 * The authored shader and the two texts the compiler emitted from it. The tab
 * matching the running backend follows the toggle, so flipping the renderer
 * shows you which of these the GPU is actually being handed.
 */
export default function CodePanes({ sources }: { sources: ShaderSources }) {
  const [pane, setPane] = useState<keyof ShaderSources>('typescript');
  const [live, setLive] = useState<RendererBackend | null>(null);
  // True once the visitor picks a tab; after that we stop following the toggle.
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setLive(getLiveBackend());
    return subscribeLiveBackend(setLive);
  }, []);

  useEffect(() => {
    if (pinned || !live) return;
    setPane(live === 'webgpu' ? 'wgsl' : 'glsl');
  }, [live, pinned]);

  return (
    <div className="codepanes">
      <div className="codepanes-tabs">
        {PANES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={`${entry.key === pane ? 'on' : ''} ${entry.backend ?? ''}`}
            onClick={() => {
              setPane(entry.key);
              setPinned(true);
            }}
            aria-pressed={entry.key === pane}
          >
            {entry.label}
          </button>
        ))}
        <span className="running">
          {live ? `GPU is running the ${live === 'webgpu' ? 'WGSL' : 'GLSL'}` : 'starting…'}
        </span>
      </div>
      <pre>
        <code>{sources[pane]}</code>
      </pre>
    </div>
  );
}
