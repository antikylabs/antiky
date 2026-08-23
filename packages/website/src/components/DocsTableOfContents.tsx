'use client';

import { useEffect, useState } from 'react';
import type { DocsHeading } from '@/lib/docs';

export default function DocsTableOfContents({ headings }: { headings: DocsHeading[] }) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? '');

  useEffect(() => {
    if (headings.length === 0) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      let current = headings[0]!.id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (!element || element.getBoundingClientRect().top > 140) break;
        current = heading.id;
      }
      setActiveId(current);
    };
    const requestUpdate = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('hashchange', requestUpdate);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      window.removeEventListener('hashchange', requestUpdate);
    };
  }, [headings]);

  return (
    <nav>
      {headings.map((heading) => {
        const active = activeId === heading.id;
        const className = [heading.depth === 3 ? 'nested' : '', active ? 'active' : '']
          .filter(Boolean)
          .join(' ') || undefined;
        return (
          <a className={className} href={`#${heading.id}`} aria-current={active ? 'location' : undefined} key={heading.id}>
            {heading.title}
          </a>
        );
      })}
    </nav>
  );
}
