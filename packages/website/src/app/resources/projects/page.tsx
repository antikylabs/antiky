import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Project library — Coming soon',
  description: 'The planned Antiky project library and the runnable technical studies available today.',
  alternates: { canonical: '/resources/projects' },
};

export default function ProjectsPage() {
  return (
    <>
      <section className="page-hero wrap resource-child-hero">
        <Link className="parent-link" href="/resources">Resources</Link>
        <p className="status-line"><span className="status-dot status-planned" /> Direction · Coming soon</p>
        <h1>Project library</h1>
        <p className="page-lead">
          The Project library will hold maintained Antiky starting points for real game tasks. No
          template catalog is public yet; the three published technical studies remain the current
          runnable examples.
        </p>
      </section>
      <section className="content-section wrap split-heading">
        <div><h2>Examples have to survive reuse.</h2></div>
        <div className="prose">
          <p className="lead">A checked-in demo is not automatically a supported project template.</p>
          <p>
            A public project needs an owned purpose, current dependencies, a reproducible first run,
            tests, documentation, and a maintenance boundary that works outside this repository.
          </p>
          <Link className="text-link section-link" href="/demos">Run the current studies <ArrowRight /></Link>
          <Link className="text-link section-link" href="/docs/framework/game-modules">Build a game module <ArrowRight /></Link>
        </div>
      </section>
    </>
  );
}
