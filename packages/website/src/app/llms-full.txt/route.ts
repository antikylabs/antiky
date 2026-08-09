import { getDocsEntries, renderLlmsFullTxt } from '@/lib/docs';

export const dynamic = 'force-static';

export async function GET() {
  const entries = await getDocsEntries();
  return new Response(renderLlmsFullTxt(entries), {
    headers: {
      'cache-control': 'public, max-age=0, must-revalidate',
      'content-type': 'text/markdown; charset=utf-8',
    },
  });
}
