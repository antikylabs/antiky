import { getDocsEntries, getDocsEntry } from '@/lib/docs';

type MarkdownRouteContext = {
  params: Promise<{ slug: string[] }>;
};

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getDocsEntries()).map((entry) => ({
    slug: entry.slug.length === 0 ? ['index.html'] : entry.slug,
  }));
}

export async function GET(_request: Request, { params }: MarkdownRouteContext) {
  const routeSlug = (await params).slug;
  const docsSlug = routeSlug.length === 1 && routeSlug[0] === 'index.html' ? [] : routeSlug;
  const entry = await getDocsEntry(docsSlug);
  if (!entry) return new Response('Documentation page not found.\n', { status: 404 });

  return new Response(entry.source, {
    headers: {
      'cache-control': 'public, max-age=0, must-revalidate',
      'content-type': 'text/markdown; charset=utf-8',
    },
  });
}
