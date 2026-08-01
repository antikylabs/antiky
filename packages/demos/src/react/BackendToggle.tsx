'use client';

import type { RendererBackend } from 'brometal';
import { useEffect, useState } from 'react';
import {
  BACKEND_LABEL,
  getBackendChoice,
  setBackendChoice,
  subscribeBackend,
  webgpuLikelyAvailable,
  type BackendChoice,
} from '../runtime';

const CHOICES: BackendChoice[] = ['auto', 'webgpu', 'webgl2'];

/**
 * The whole point of building on BroMetal, made pressable: one shader source,
 * two graphics APIs, switchable while the page is open. `live` is what the
 * renderer actually built, which is not always what was asked for — `Auto`
 * resolves to whichever the browser can give.
 */
export default function BackendToggle({ live }: { live: RendererBackend | null }) {
  const [choice, setChoice] = useState<BackendChoice>('auto');
  const [webgpu, setWebgpu] = useState(true);

  useEffect(() => {
    setChoice(getBackendChoice());
    setWebgpu(webgpuLikelyAvailable());
    return subscribeBackend(setChoice);
  }, []);

  return (
    <div className="backend-toggle" role="group" aria-label="Graphics backend">
      <span className="backend-label">Backend</span>
      {CHOICES.map((option) => (
        <button
          key={option}
          type="button"
          className={option === choice ? 'on' : ''}
          disabled={option === 'webgpu' && !webgpu}
          title={
            option === 'webgpu' && !webgpu
              ? 'This browser exposes no WebGPU entry point'
              : `Run every demo on ${BACKEND_LABEL[option]}`
          }
          onClick={() => setBackendChoice(option)}
          aria-pressed={option === choice}
        >
          {BACKEND_LABEL[option]}
        </button>
      ))}
      <span className={`backend-live ${live ?? 'pending'}`}>
        {live ? `running ${BACKEND_LABEL[live]}` : 'starting…'}
      </span>
    </div>
  );
}
