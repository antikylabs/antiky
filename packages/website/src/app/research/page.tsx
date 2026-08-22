import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { DISCORD_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Antiky Labs Research | Games, agents, and rendering',
  description: 'Public Antiky Labs experiments in rendering, agent guidance, asset pipelines, and game-development tools.',
  alternates: { canonical: '/research' },
};

const RESEARCH_URL = 'https://github.com/antikylabs/research';

const FUTURE_GYMS = [
  ['Voxel editor', 'Which editing, selection, preview, and validation tools make voxel authoring useful to both a person and an agent?'],
  ['Model viewer', 'What semantic inspection, material information, provenance, and capture tools make a 3D model understandable inside the development loop?'],
  ['Terrain generator', 'How should generation inputs, repeatability, editing, and evidence work when terrain is created for a real game rather than a showcase image?'],
  ['Sprite generator', 'Can an image-to-video-to-slicer workflow produce usable sprite animation while preserving continuity, provenance, review, and human art direction?'],
] as const;

export default function ResearchPage() {
  return (
    <>
      <section className="page-hero wrap">
        <p className="status-line"><span className="status-dot status-active" /> Completed study · active experiments · open questions</p>
        <h1>Evidence before adjectives.</h1>
        <p className="page-lead">
          Antiky Labs runs focused experiments in rendering, asset pipelines, agent guidance, and
          game-development tools. Read the reports, inspect the code, and try the runnable work.
        </p>
        <div className="actions">
          <a className="button button-primary" href={RESEARCH_URL} target="_blank" rel="noreferrer">Explore the research repository <ArrowUpRight /></a>
          <Link className="text-link" href="/demos">Run the current Framework studies <ArrowRight /></Link>
        </div>
        <p className="review-date">Research sources reviewed at <a href={`${RESEARCH_URL}/tree/cc98e0059016417ccab848457e309eae9f77ed12`}>cc98e0059016</a> on 2026-08-21</p>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Method</p><h2>Isolate the question. Keep the result connected to real work.</h2></div>
        <div className="prose">
          <p className="lead">A research gym creates enough space to investigate one idea without turning the main product into an experiment.</p>
          <p>
            It can move quickly, fail clearly, and preserve the conditions that produced the result.
            Gyms use Framework's game host and project setup when that serves the question. A
            useful result can inform the product; it does not become a Framework feature automatically.
          </p>
          <blockquote>Focused enough to answer one question. Real enough to teach the product something.</blockquote>
        </div>
      </section>

      <section className="content-section wrap research-evidence" data-evidence-status="current">
        <div className="split-heading">
          <div><p className="section-label">Completed study · public report</p><h2>Ahead-of-time shader compilation, compared.</h2></div>
          <div className="prose">
            <p className="lead">The first completed study compares ahead-of-time shader compilation across BroMetal, TypeGPU, WESL, and Three.js.</p>
            <p>
              The public report includes the setup, versions, measurements, results, and limits for
              each comparison.
            </p>
            <a className="text-link section-link" href={RESEARCH_URL} target="_blank" rel="noreferrer">Read the research index <ArrowUpRight /></a>
          </div>
        </div>
        <figure className="evidence-figure">
          <Image src="/media/research/aot-report.webp" alt="A current chart from the completed WebGPU ahead-of-time shader compilation research report." width={1800} height={1013} sizes="(max-width: 760px) 100vw, 92vw" />
          <figcaption>Completed research · see the public report for method, versions, measurements, and limits.</figcaption>
        </figure>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact"><h2>Current questions, worked in public.</h2><p>Follow the experiments as they develop.</p></header>
        <div className="editorial-list">
          <Link className="editorial-row" data-evidence-status="current" href="/resources/skills">
            <span className="row-status">Active</span>
            <span className="row-copy"><strong>Skills that give agents better guidance</strong><span>Compact instructions, references, deterministic tools, and evaluation cases for more reliable engineering and game-development work.</span></span>
            <ArrowRight className="row-arrow" />
          </Link>
          <div className="editorial-row static" data-evidence-status="current">
            <span className="row-status">Active</span>
            <span className="row-copy"><strong>An AI-native game-development pipeline</strong><span>Map the loop from human intent through implementation, runtime observation, feedback, verification, and approval.</span></span>
          </div>
          <div className="editorial-row static" data-evidence-status="current">
            <span className="row-status">Active gym</span>
            <span className="row-copy"><strong>High-quality voxel rendering for a Studio mini app</strong><span>Test voxel-rendering techniques in a standalone editor that could later fit inside Studio.</span></span>
          </div>
        </div>
        <figure className="evidence-figure research-voxel-figure">
          <Image src="/media/research/voxel-gym.webp" alt="Current Antiky Labs voxel-rendering experiment showing the Golden Hour Valley Atelier scene produced by the active gym." width={1280} height={720} sizes="(max-width: 760px) 100vw, 92vw" />
          <figcaption>Active gym · a current experiment, not a shipped Studio mini app.</figcaption>
        </figure>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <p className="section-label">Future questions</p>
          <h2>What we want to test next.</h2>
          <p>These are open research questions, not release commitments.</p>
        </header>
        <div className="editorial-list">
          {FUTURE_GYMS.map(([title, question]) => (
            <div className="editorial-row static" data-evidence-status="research-question" key={title}>
              <span className="row-status">Research question</span>
              <span className="row-copy"><strong>{title}</strong><span>{question}</span></span>
            </div>
          ))}
          <div className="editorial-row static" data-evidence-status="research-question">
            <span className="row-status">Research question</span>
            <span className="row-copy"><strong>Models trained on BroMetal shaders</strong><span>Test shader work against a published task set and baseline.</span></span>
          </div>
          <div className="editorial-row static" data-evidence-status="research-question">
            <span className="row-status">Research question</span>
            <span className="row-copy"><strong>Models trained on Antiky Framework</strong><span>Compare focused adaptation with the same model using current documentation and tools.</span></span>
          </div>
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>Read the work, try the experiments, and challenge the conclusions.</p>
        <a href={RESEARCH_URL} target="_blank" rel="noreferrer">Explore the research repository <ArrowUpRight /></a>
        <Link href="/demos">Try the current demos <ArrowRight /></Link>
        <a href={DISCORD_URL} target="_blank" rel="noreferrer">Challenge a question on Discord <ArrowUpRight /></a>
      </section>
    </>
  );
}
