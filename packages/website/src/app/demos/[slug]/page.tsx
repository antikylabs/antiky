import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMOS, findDemo, neighbours } from '@antiky/demos/catalog';
import type { ShaderSources } from '@antiky/demos/react';
import auroraShader from '@antiky/demos/shader-study/shaders/aurora.shader.gen';
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

/**
 * Shader Study shows its own source next to the compiler output. The
 * TypeScript is read off disk at build time rather than pasted into a string,
 * so the pane cannot drift from the file that is actually compiled.
 */
function auroraSources(): ShaderSources {
  const typescript = readFileSync(
    join(
      process.cwd(),
      '..',
      'demos',
      'src',
      'demos',
      'shader-study',
      'shaders',
      'aurora.shader.ts',
    ),
    'utf8',
  );
  return {
    typescript,
    wgsl: auroraShader.wgslSrc,
  };
}

export default async function DemoPage({ params }: Params) {
  const { slug } = await params;
  if (slug === 'depth-study') redirect('/demos/town-study');
  const demo = findDemo(slug);
  const around = neighbours(slug);
  if (!demo || !around) notFound();
  return (
    <DemoDeck
      demo={demo}
      prev={around.prev}
      next={around.next}
      index={around.index}
      sources={slug === 'shader-study' ? auroraSources() : undefined}
    />
  );
}
