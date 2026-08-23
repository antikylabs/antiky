export type DemoSlug =
  | 'antiky-town'
  | 'traversal-study'
  | 'point-light-expo';

export type DemoPillar = 'Framework';

export type DemoMeta = Readonly<{
  slug: DemoSlug;
  title: string;
  pillar: DemoPillar;
  tagline: string;
  notes: string;
  proves: readonly string[];
  tags: readonly string[];
  requiresWebGpu: boolean;
  controls?: string;
  controlMode?: 'move';
}>;

export const DEMO_GROUPS: readonly Readonly<{
  id: string;
  pillar: DemoPillar;
  title: string;
  description: string;
}>[] = [
  {
    id: 'framework-demos',
    pillar: 'Framework',
    title: 'Antiky Framework',
    description: 'Three small games that show movement, authored worlds, inspection, and live lighting tools.',
  },
];

/** Editorial approval is deliberate. A staged artifact cannot add itself to this catalog. */
export const DEMOS: readonly DemoMeta[] = [
  {
    slug: 'antiky-town',
    title: 'Antiky Town',
    pillar: 'Framework',
    tagline: 'A living town with Framework-owned light authoring.',
    notes:
      'Walk through a golden-hour market, then inspect or change a visible lamp through Antiky development tools.',
    proves: [
      'An authored town that you can explore',
      'A lamp that can change while the game keeps running',
      'Live game state that Studio and agent tools can inspect',
    ],
    tags: ['Antiky Framework', 'BroMetal', 'live authoring'],
    requiresWebGpu: true,
    controls: 'Move with WASD, arrow keys, or the on-screen direction controls',
    controlMode: 'move',
  },
  {
    slug: 'traversal-study',
    title: 'Traversal Study',
    pillar: 'Framework',
    tagline: 'A kinetic floating-platform course with checkpoints, hazards, and an attract loop.',
    notes:
      'Watch the side-on course run by itself or take control. The demo includes moving platforms, hazards, checkpoints, particles, and events that Studio can inspect.',
    proves: [
      'Platform movement, collision, checkpoints, and hazard recovery',
      'A self-running preview that starts without input',
      'Traversal objects, game state, and events available to development tools',
    ],
    tags: ['Antiky Framework', 'platforming', 'attract loop'],
    requiresWebGpu: true,
    controls: 'Steer with horizontal controls; click, tap, or press up to jump',
    controlMode: 'move',
  },
  {
    slug: 'point-light-expo',
    title: 'Point Light Expo',
    pillar: 'Framework',
    tagline: 'Three inspectable practical lights inside a prismatic foundry.',
    notes:
      'Three colored lights illuminate a custom BroMetal material. Studio, the CLI, or agent tools can inspect each light and change its power.',
    proves: [
      'Three RGB point lights that Framework can identify',
      'Lighting changes that appear without restarting the game',
      'A typed shader compiled to WGSL before the game runs',
    ],
    tags: ['Antiky Framework', 'point lights', 'custom shader'],
    requiresWebGpu: true,
    controls: 'Move the pointer to shift the gallery camera',
  },
];

export function findDemo(slug: string): DemoMeta | undefined {
  return DEMOS.find((demo) => demo.slug === slug);
}

export function neighbours(slug: string): { prev: DemoMeta; next: DemoMeta; index: number } | null {
  const index = DEMOS.findIndex((demo) => demo.slug === slug);
  if (index === -1) return null;
  return {
    prev: DEMOS[(index - 1 + DEMOS.length) % DEMOS.length]!,
    next: DEMOS[(index + 1) % DEMOS.length]!,
    index,
  };
}

export function demoModuleUrl(slug: DemoSlug): string {
  return `/demo-builds/${slug}/antiky.game.js`;
}

export function demoPosterUrl(slug: DemoSlug): string {
  return `/media/demos/${slug}.webp`;
}
