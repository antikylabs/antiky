import { NextRequest, NextResponse } from 'next/server';

import { catalogCount, catalogSearch } from '../../../lib/catalog';

function boundedInteger(value: string | null, fallback: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
}

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const query = {
    q: search.get('q') ?? undefined,
    type: search.get('type') ?? undefined,
    provider: search.get('provider') ?? undefined,
  };
  const matches = catalogSearch(query);
  const limit = boundedInteger(search.get('limit'), 100, 250);
  const offset = boundedInteger(search.get('offset'), 0, Math.max(0, matches.length - 1));
  const assets = matches.slice(offset, offset + limit);
  return NextResponse.json({
    schemaVersion: 2,
    attribution: 'Poly Haven API records require visible Poly Haven source attribution.',
    query,
    totalCatalogAssets: catalogCount(),
    totalMatches: matches.length,
    count: assets.length,
    limit,
    offset,
    assets,
  });
}
