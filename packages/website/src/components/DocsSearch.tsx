'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import type { DocsSearchRecord } from '@/lib/docs';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase();
}

function searchDocs(records: DocsSearchRecord[], query: string): DocsSearchRecord[] {
  const terms = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return records
    .map((record) => {
      const title = normalizeSearchText(record.title);
      const description = normalizeSearchText(record.description);
      const content = normalizeSearchText(record.content);
      if (!terms.every((term) => title.includes(term) || description.includes(term) || content.includes(term))) {
        return null;
      }

      const score = terms.reduce((total, term) => {
        if (title === term) return total + 12;
        if (title.startsWith(term)) return total + 8;
        if (title.includes(term)) return total + 5;
        if (description.includes(term)) return total + 2;
        return total + 1;
      }, 0);
      return { record, score };
    })
    .filter((result): result is { record: DocsSearchRecord; score: number } => result !== null)
    .sort((left, right) => right.score - left.score || left.record.title.localeCompare(right.record.title))
    .slice(0, 8)
    .map(({ record }) => record);
}

export default function DocsSearch({ records }: { records: DocsSearchRecord[] }) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const resultsId = useId();
  const results = useMemo(() => searchDocs(records, query), [query, records]);
  const searching = query.trim().length > 0;

  return (
    <form className="docs-search" role="search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor={inputId}>Search documentation</label>
      <div className="docs-search-field">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.25" />
          <path d="m12.5 12.5 4 4" />
        </svg>
        <input
          id={inputId}
          type="search"
          value={query}
          placeholder="Search docs"
          autoComplete="off"
          aria-controls={searching ? resultsId : undefined}
          aria-expanded={searching}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
          }}
        />
        {searching && <button type="button" onClick={() => setQuery('')} aria-label="Clear documentation search">×</button>}
      </div>
      {searching && (
        <div className="docs-search-results" id={resultsId} aria-live="polite">
          {results.length > 0 ? results.map((result) => (
            <Link href={result.href} key={result.href}>
              <span>{result.section}</span>
              <strong>{result.title}</strong>
              <small>{result.description}</small>
            </Link>
          )) : <p>No documentation found.</p>}
        </div>
      )}
    </form>
  );
}
