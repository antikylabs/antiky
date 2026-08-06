'use client';

import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

function copyWithTextarea(markdown: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = markdown;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

export default function CopyMarkdownButton({ markdown }: { markdown: string }) {
  const [state, setState] = useState<CopyState>('idle');

  async function copyMarkdown() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(markdown);
      else if (!copyWithTextarea(markdown)) throw new Error('Clipboard is unavailable.');
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  const label = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy Markdown';
  return <button className="docs-copy-button" type="button" onClick={copyMarkdown} aria-live="polite">{label}</button>;
}
