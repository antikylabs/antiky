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
    description: 'Framework-owned game state and live authoring, rendered through BroMetal.',
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
      'Explore the golden-hour market while Antiky Framework owns the identity, authoring state, runtime projection, and render update for a visible lamp.',
    proves: [
      'One stable light identity from authored content through rendering',
      'Live command changes without a reload or renderer rebuild',
      'Structured runtime state through the same game module used by Studio',
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
      'The side-on course runs by itself and accepts manual steering and jumps. Framework owns fixed-step traversal, moving platforms, hazards, checkpoints, particles, and the event trail Studio can inspect.',
    proves: [
      'Deterministic platform movement, collision, checkpoints, and hazard recovery',
      'An immediate attract loop that communicates motion without requiring input',
      'Published traversal entities, runtime stores, and events beside the rendered result',
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
      'A focused Antiky Framework showcase: three stable light entities drive a custom BroMetal material, and their power can be inspected or changed through the same service Studio gives agents.',
    proves: [
      'Framework-authored RGB point lights with stable world and entity identities',
      'Live renderer updates from agent-accessible light commands',
      'A custom typed shader compiled ahead of time to WGSL',
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
