import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DemoStage } from '@antiky/demos/react';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';

const WORK = [
  {
    href: '/framework',
    status: 'Emerging',
    title: 'Antiky Framework',
    body: 'A 2.3D game framework taking shape on top of BroMetal—built for 2D characters and objects inside spatial 3D worlds.',
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
    body: 'Practical work on generated game assets, engine composition, rendering, and physics—shared when there is evidence worth showing.',
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
        <DemoStage slug="depth-study" variant="hero" poster="/media/depth-study-poster.png" label="Depth Study — 2D characters inside a 3D world" />
        <div className="home-hero-copy">
          <h1>Tools for making worlds.</h1>
          <p>Antiky Labs builds playable experiments, an emerging 2.3D framework, and future games.</p>
          <div className="actions">
            <Link className="button button-primary" href="/demos/depth-study">Explore Depth Study <ArrowUpRight /></Link>
            <Link className="text-link" href="/framework">Meet the framework <ArrowRight /></Link>
          </div>
        </div>
        <p className="media-caption"><span>Live browser study</span> Real-time BroMetal render · not game footage</p>
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
