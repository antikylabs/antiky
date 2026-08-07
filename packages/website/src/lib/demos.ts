export type DemoSlug = 'antiky-town' | 'town-study' | 'shader-study';

export type DemoMeta = Readonly<{
  slug: DemoSlug;
  title: string;
  pillar: 'Framework' | 'Research';
  tagline: string;
  notes: string;
  proves: readonly string[];
  tags: readonly string[];
  controls?: string;
  controlMode?: 'move';
  poster?: string;
}>;

/** Editorial approval is deliberate. A staged artifact cannot add itself to this catalog. */
export const DEMOS: readonly DemoMeta[] = [
  {
    slug: 'antiky-town',
    title: 'Antiky Town',
    pillar: 'Framework',
    tagline: 'A living town with framework-owned light authoring.',
    notes:
      'Explore the golden-hour market while Antiky Framework owns the identity, authoring state, runtime projection, and render update for a visible lamp.',
    proves: [
      'One stable light identity from authored content through rendering',
      'Live command changes without a reload or renderer rebuild',
      'Structured runtime state through the same game module used by Studio',
    ],
    tags: ['Antiky Framework', 'WebGPU', 'live authoring'],
    controls: 'Move with WASD, arrow keys, or the on-screen direction controls',
    controlMode: 'move',
    poster: '/media/town-study-poster.png',
  },
  {
    slug: 'town-study',
    title: 'Town Study',
    pillar: 'Framework',
    tagline: 'A living pixel cast inside a golden-hour voxel town.',
    notes:
      'Cross the canal and enter a market town at sunset. Lit cardboard travelers move through dense voxel streets, cast long shadows, and disappear naturally behind bridges, stalls, and buildings.',
    proves: [
      'A handcrafted bridge, market, canal, houses, and bell tower',
      'Crisp illustrated travelers with physical depth, light, and shadow',
      'A walkable scene with grounded movement and solid architecture',
    ],
    tags: ['2.3D', 'voxel town', 'real-time lighting'],
    controls: 'Move with WASD, arrow keys, or the on-screen direction controls',
    controlMode: 'move',
    poster: '/media/town-study-poster.png',
  },
  {
    slug: 'shader-study',
    title: 'Shader Study',
    pillar: 'Research',
    tagline: 'One typed shader compiled ahead of time for WebGPU.',
    notes:
      'Shader Study isolates one useful property of BroMetal: typed shader source compiles ahead of time to WGSL. The website runs only the compiled game artifact.',
    proves: [
      'Typed TypeScript becomes browser-ready shader code at build time',
      'No shader compiler ships to the browser',
      'The same compiled game-module contract works in each delivery host',
    ],
    tags: ['WebGPU', 'WGSL', 'shaders'],
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
