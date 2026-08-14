import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { DEMOS, findDemo, neighbours } from '@/lib/demos';
import DemoDeck from '@/components/DemoDeck';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return DEMOS.map((demo) => ({ slug: demo.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const demo = findDemo(slug);
  if (!demo) return { title: 'Demo not found' };
  return {
    title: demo.title,
    description: demo.tagline,
    alternates: { canonical: `/demos/${demo.slug}` },
    openGraph: { title: demo.title, description: demo.tagline, type: 'article' },
  };
}

export default async function DemoPage({ params }: Params) {
  const { slug } = await params;
  // `depth-study` was renamed to `town-study`, which has since been retired in favour of
  // `antiky-town` — the same town with sprites, a real post pass and Framework integration.
  if (slug === 'depth-study' || slug === 'town-study') redirect('/demos/antiky-town');
  const demo = findDemo(slug);
  const around = neighbours(slug);
  if (!demo || !around) notFound();
  return (
    <DemoDeck
      demo={demo}
      prev={around.prev}
      next={around.next}
      index={around.index}
    />
  );
}
