import Link from 'next/link';
import { redirect } from 'next/navigation';
import DemoStage from '@/components/DemoStage';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';

const WORK = [
  {
    href: '/framework',
    status: 'Emerging',
    title: 'Antiky Framework',
    body: 'A 2.3D game framework taking shape on top of BroMetal—built for 2D characters and objects inside spatial 3D worlds.',
  },
  {
    href: '/studio',
    status: 'Source preview',
    title: 'Antiky Studio',
    body: 'A native development workspace for the running game, terminal, simulation controls, and structured runtime state.',
  },
  {
    href: '/demos',
    status: 'Live now',
    title: 'Browser studies',
    body: 'Small, runnable experiments for depth, sprites, shaders, and the rendering ideas beneath the framework.',
  },
  {
    href: '/research',
    status: 'Active research',
    title: 'Research',
    body: 'Research into generated game assets, 2.3D rendering, physics, and models trained to write shader DSL and game-framework code.',
  },
  {
    href: '/worlds',
    status: 'Planned',
    title: 'Antiky Worlds',
    body: 'The future game studio behind Emberwyrd, a character-first online fantasy action RPG now in development.',
  },
];

export default function HomePage() {
  const demoSlug = process.env.ANTIKY_DEMO_SLUG;
  if (demoSlug) redirect(`/demos/${demoSlug}`);

  return (
    <>
      <section className="home-hero">
        <DemoStage slug="town-study" variant="hero" poster="/media/town-study-poster.png" label="Town Study — pixel characters inside a golden-hour voxel town" />
        <div className="home-hero-copy">
          <h1>Tools for making worlds.</h1>
          <p>Antiky Labs builds playable experiments, an emerging 2.3D framework, and future games.</p>
          <div className="actions">
            <Link className="button button-primary" href="/demos/town-study">Explore Town Study <ArrowUpRight /></Link>
            <Link className="text-link" href="/framework">Meet the framework <ArrowRight /></Link>
          </div>
        </div>
        <p className="media-caption"><span>Live browser scene</span> Cross the bridge and explore the market in real time</p>
      </section>

      <section className="work-index wrap">
        <header className="section-intro">
          <h2>What we’re making</h2>
          <p>A small set of connected projects, each described by what is real today.</p>
        </header>
        <div className="editorial-list">
          {WORK.map((item) => (
            <Link key={item.href} href={item.href} className="editorial-row">
              <span className="row-status">{item.status}</span>
              <span className="row-copy"><strong>{item.title}</strong><span>{item.body}</span></span>
              <ArrowUpRight className="row-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="statement-band">
        <div className="wrap statement-grid">
          <h2>2D character.<br />3D world.</h2>
          <div>
            <p className="lead">We call it 2.3D: crisp 2D characters and objects moving through spatial, depth-aware 3D environments.</p>
            <p>The framework is early. The rendering foundation beneath these studies—BroMetal—is available now.</p>
            <Link className="text-link" href="/demos">Run both studies <ArrowRight /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
