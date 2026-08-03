'use client';

import { useState } from 'react';

export type ShaderSources = { typescript: string; wgsl: string };

type Pane = { key: keyof ShaderSources; label: string };

const PANES: Pane[] = [
  { key: 'typescript', label: 'aurora.shader.ts' },
  { key: 'wgsl', label: 'Generated WGSL' },
];

/** The authored shader and the WGSL BroMetal emits for the GPU. */
export default function CodePanes({ sources }: { sources: ShaderSources }) {
  const [pane, setPane] = useState<keyof ShaderSources>('typescript');

  return (
    <div className="codepanes">
      <div className="codepanes-tabs">
        {PANES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={entry.key === pane ? 'on' : ''}
            onClick={() => setPane(entry.key)}
            aria-pressed={entry.key === pane}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <pre>
        <code>{sources[pane]}</code>
      </pre>
    </div>
  );
}
