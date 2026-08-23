import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Shader library: Coming soon',
  description: 'The planned Antiky shader library and the current BroMetal and Framework sources to inspect meanwhile.',
  alternates: { canonical: '/resources/shaders' },
};

export default function ShadersPage() {
  return (
    <>
      <section className="page-hero wrap resource-child-hero">
        <Link className="parent-link" href="/resources">Resources</Link>
        <p className="status-line"><span className="status-dot status-planned" /> Coming soon</p>
        <h1>Shader library</h1>
        <p className="page-lead">
          A browsable collection of reusable BroMetal shaders, generated WebGPU Shading Language
          (WGSL), and working examples is coming later. There is no public catalog yet.
        </p>
        <div className="actions">
          <Link className="text-link section-link" href="/framework">Explore the rendering framework <ArrowRight /></Link>
          <Link className="text-link section-link" href="/roadmap">See where the library fits <ArrowRight /></Link>
        </div>
      </section>
    </>
  );
}
