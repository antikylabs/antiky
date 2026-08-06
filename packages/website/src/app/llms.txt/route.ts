import { getDocsEntries, getDocsNavigation, renderLlmsTxt } from '@/lib/docs';

export const dynamic = 'force-static';

export async function GET() {
  const [entries, navigation] = await Promise.all([getDocsEntries(), getDocsNavigation()]);
  return new Response(renderLlmsTxt(entries, navigation), {
    headers: {
      'cache-control': 'public, max-age=0, must-revalidate',
      'content-type': 'text/markdown; charset=utf-8',
    },
  });
}
