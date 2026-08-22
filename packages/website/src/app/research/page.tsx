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
const DSL_RESEARCH_URL = `${RESEARCH_URL}/tree/main/experiments/asset-generation-contract/docs/dsl-testing`;

const FUTURE_GYMS = [
  ['Voxel editor', 'Create, select, preview, and check voxel scenes from a focused visual workspace.'],
  ['Model viewer', 'Inspect a model, its materials, its source, and a useful preview in one place.'],
  ['Terrain generator', 'Create repeatable terrain that remains editable after generation.'],
  ['Sprite generator', 'Create coherent sprite animation while keeping a person in charge of the art direction.'],
] as const;

export default function ResearchPage() {
  return (
    <>
      <section className="page-hero wrap">
        <p className="status-line"><span className="status-dot status-active" /> Completed reports and open research</p>
        <h1>Research for better game-making tools.</h1>
        <p className="page-lead">
          Explore Antiky Labs experiments in rendering, asset pipelines, agent tools, and ways to
          describe game worlds.
        </p>
        <div className="actions">
          <a className="button button-primary" href={RESEARCH_URL} target="_blank" rel="noreferrer">Explore the research repository <ArrowUpRight /></a>
          <Link className="text-link" href="/demos">Run the current Framework studies <ArrowRight /></Link>
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

      <section className="content-section wrap research-dsl" data-evidence-status="research-question">
        <div className="split-heading">
          <div>
            <p className="section-label">Research in progress</p>
            <h2>Declarative scene DSL.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              We are testing a typed TypeScript language for describing a scene in creative terms.
            </p>
            <p>
              An author describes the experience, visual direction, gameplay, important things,
              relationships, and rules. A compiler would turn that direction into engine-ready data.
            </p>
            <p>
              The goal is to make a game world easier for creators and coding agents to discuss and
              revise without asking either one to hand-write low-level entity data.
            </p>
            <a className="text-link section-link" href={DSL_RESEARCH_URL} target="_blank" rel="noreferrer">
              Read the DSL experiment <ArrowUpRight />
            </a>
          </div>
        </div>

        <pre className="research-dsl-sample" aria-label="Short declarative scene example"><code>{`scene({
  experience: { feel: ['quiet', 'cold', 'slightly mysterious'] },
  visual: { language: 'rich, dense voxel diorama' },
  gameplay: { purpose: 'quiet exploration and close observation' },
});`}</code></pre>

        <div className="research-reference-grid">
          <figure className="evidence-figure" data-media-role="illustrative" data-media-url="/media/research/blue-winter-grove-reference-01-clearing-v4.webp">
            <Image src="/media/research/blue-winter-grove-reference-01-clearing-v4.webp" alt="Generated Blue Winter Grove clearing reference with three pixel-art travelers in a snowy voxel forest." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 62vw" />
            <figcaption>Generated illustration · clearing composition reference</figcaption>
          </figure>
          <figure className="evidence-figure" data-media-role="illustrative" data-media-url="/media/research/blue-winter-grove-reference-02-frozen-creek-v4.webp">
            <Image src="/media/research/blue-winter-grove-reference-02-frozen-creek-v4.webp" alt="Generated Blue Winter Grove reference with three pixel-art travelers beside a frozen creek." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 42vw" />
            <figcaption>Generated illustration · frozen-creek reference</figcaption>
          </figure>
          <figure className="evidence-figure" data-media-role="illustrative" data-media-url="/media/research/blue-winter-grove-reference-03-frost-tree-detail-v4.webp">
            <Image src="/media/research/blue-winter-grove-reference-03-frost-tree-detail-v4.webp" alt="Generated Blue Winter Grove reference with three pixel-art travelers studying a frost-bent voxel tree." width={1536} height={1024} sizes="(max-width: 760px) 100vw, 68vw" />
            <figcaption>Generated illustration · frost-tree detail reference</figcaption>
          </figure>
        </div>
        <p className="research-illustration-note">
          These images show the intended result; they do not show a shipped Framework feature.
        </p>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact"><h2>More work in progress.</h2><p>Follow the experiments as they develop.</p></header>
        <div className="editorial-list">
          <Link className="editorial-row" data-evidence-status="current" href="/resources/skills">
            <span className="row-status">Active</span>
            <span className="row-copy"><strong>Skills for coding agents</strong><span>Reusable instructions and tools for common engineering and game-development tasks.</span></span>
            <ArrowRight className="row-arrow" />
          </Link>
          <div className="editorial-row static" data-evidence-status="current">
            <span className="row-status">Active</span>
            <span className="row-copy"><strong>A creator-and-agent development loop</strong><span>Connect creative direction, implementation, a running game, feedback, and approval.</span></span>
          </div>
          <div className="editorial-row static" data-evidence-status="current">
            <span className="row-status">Active gym</span>
            <span className="row-copy"><strong>Voxel rendering tools</strong><span>Test voxel scenes in a small editor that could later become part of Studio.</span></span>
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
          <p>These ideas are being explored and are not available as products yet.</p>
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
            <span className="row-copy"><strong>Models trained on BroMetal shaders</strong><span>Measure whether focused training helps with real shader tasks.</span></span>
          </div>
          <div className="editorial-row static" data-evidence-status="research-question">
            <span className="row-status">Research question</span>
            <span className="row-copy"><strong>Models trained on Antiky Framework</strong><span>Measure whether focused training helps with real Framework tasks.</span></span>
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
