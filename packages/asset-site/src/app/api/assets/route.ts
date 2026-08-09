import { NextRequest, NextResponse } from 'next/server';

import { catalogSearch } from '../../../lib/catalog';

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const query = {
    q: search.get('q') ?? undefined,
    type: search.get('type') ?? undefined,
    provider: search.get('provider') ?? undefined,
  };
  const assets = catalogSearch(query);
  return NextResponse.json({
    schemaVersion: 1,
    attribution: 'Poly Haven API records require visible Poly Haven source attribution.',
    query,
    count: assets.length,
    assets,
  });
}
