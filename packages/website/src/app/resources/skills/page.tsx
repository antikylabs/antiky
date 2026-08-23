import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import {
  PUBLIC_SKILLS,
  SKILLS_SNAPSHOT_URL,
  SKILLS_SOURCE_COMMIT,
  SKILLS_SOURCE_URL,
} from '@/lib/skills';

export const metadata: Metadata = {
  title: 'Skills library',
  description: 'Reviewed portable agent skills from Antiky Labs, with current install commands and a pinned source snapshot.',
  alternates: { canonical: '/resources/skills' },
};

export default function SkillsPage() {
  return (
    <>
      <section className="page-hero wrap resource-child-hero">
        <Link className="parent-link" href="/resources">Resources</Link>
        <p className="status-line"><span className="status-dot status-live" /> Current · nine skills</p>
        <h1>Portable ways of working for coding agents.</h1>
        <p className="page-lead">
          An agent skill is a small, independently installable set of task instructions and optional
          tools. Use Antiky skills to give a compatible coding agent a reviewed procedure without
          copying that procedure into every project.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/docs/skills/install">Install a skill <ArrowRight /></Link>
          <a className="text-link" href={SKILLS_SOURCE_URL} target="_blank" rel="noreferrer">Open the source <ArrowUpRight /></a>
        </div>
      </section>

      <section className="content-section wrap split-heading skills-install-preview">
        <div>
          <p className="section-label">Verified command</p>
          <h2>Inspect the current set before installing.</h2>
        </div>
        <div className="prose">
          <pre><code>npx skills add antikylabs/skills --list</code></pre>
          <p>
            The reviewed snapshot is commit <a href={SKILLS_SNAPSHOT_URL}><code>{SKILLS_SOURCE_COMMIT.slice(0, 12)}</code></a>.
            The current <code>skills</code> CLI found the same nine public skills on 2026-08-21.
          </p>
          <Link className="text-link section-link" href="/docs/skills/install">See install, update, and removal commands <ArrowRight /></Link>
        </div>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <h2>Available skills</h2>
          <p>These are the nine public skills in the pinned repository snapshot.</p>
        </header>
        <div className="editorial-list">
          {PUBLIC_SKILLS.map((skill) => (
            <article className="editorial-row static skill-row" key={skill.name}>
              <span className="row-status">Current</span>
              <span className="row-copy">
                <strong><code>{skill.name}</code></strong>
                <span>{skill.purpose}</span>
                <small>
                  {skill.invocation ?? (skill.commands.length > 0 ? `Commands: ${skill.commands.join(', ')}` : 'Bare invocation')}
                </small>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="statement-band">
        <div className="wrap statement-grid">
          <h2>Start with one skill.</h2>
          <div>
            <p className="lead">Choose the procedure that matches the work in front of you.</p>
            <p>
              Each skill brings its instructions and supporting files into your project. You can
              inspect every file in the pinned source snapshot before you install it.
            </p>
            <div className="thesis-links">
              <Link className="text-link" href="/docs/skills/overview">Understand agent skills <ArrowRight /></Link>
              <Link className="text-link" href="/docs/skills/reference">Read the skills reference <ArrowRight /></Link>
              <Link className="text-link" href="/research">See the active skills research <ArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
