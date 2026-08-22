import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Shader library — Coming soon',
  description: 'The planned Antiky shader library and the current BroMetal and Framework sources to inspect meanwhile.',
  alternates: { canonical: '/resources/shaders' },
};

export default function ShadersPage() {
  return (
    <>
      <section className="page-hero wrap resource-child-hero">
        <Link className="parent-link" href="/resources">Resources</Link>
        <p className="status-line"><span className="status-dot status-planned" /> Direction · Coming soon</p>
        <h1>Shader library</h1>
        <p className="page-lead">
          The Shader library will organize reusable BroMetal shader sources, generated WebGPU
          Shading Language (WGSL), examples, and support boundaries. There is no public catalog yet.
        </p>
      </section>
      <section className="content-section wrap split-heading">
        <div><h2>What must exist before this opens</h2></div>
        <div className="prose">
          <p className="lead">A real library needs more than a folder of visually interesting shaders.</p>
          <p>
            Each entry needs a maintained source, generated output, expected inputs, licensing,
            screenshots or runnable evidence, compatibility notes, and a clear supported boundary.
          </p>
          <Link className="text-link section-link" href="/framework">See the current rendering boundary <ArrowRight /></Link>
          <Link className="text-link section-link" href="/roadmap">See where the library fits <ArrowRight /></Link>
        </div>
      </section>
    </>
  );
}
