import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Project library: Coming soon',
  description: 'The planned Antiky project library and the runnable technical studies available today.',
  alternates: { canonical: '/resources/projects' },
};

export default function ProjectsPage() {
  return (
    <>
      <section className="page-hero wrap resource-child-hero">
        <Link className="parent-link" href="/resources">Resources</Link>
        <p className="status-line"><span className="status-dot status-planned" /> Coming soon</p>
        <h1>Project library</h1>
        <p className="page-lead">
          Maintained Antiky starting points for common game tasks are coming later. For now, Antiky
          Town and the published technical studies are the runnable examples. There is no public
          template catalog yet.
        </p>
        <div className="actions">
          <Link className="text-link section-link" href="/demos/antiky-town">Run Antiky Town <ArrowRight /></Link>
          <Link className="text-link section-link" href="/demos">Browse the technical studies <ArrowRight /></Link>
          <Link className="text-link section-link" href="/docs/framework/game-modules">Build a game module <ArrowRight /></Link>
        </div>
      </section>
    </>
  );
}
