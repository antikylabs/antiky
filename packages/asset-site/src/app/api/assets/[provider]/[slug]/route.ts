import { NextResponse } from 'next/server';

import { catalogAsset } from '../../../../../lib/catalog';

type Params = Promise<{ provider: string; slug: string }>;

export async function GET(_request: Request, { params }: Readonly<{ params: Params }>) {
  const { provider, slug } = await params;
  const asset = catalogAsset(provider, slug);
  if (!asset) return NextResponse.json({ error: 'ASSET_NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ schemaVersion: 1, asset });
}
