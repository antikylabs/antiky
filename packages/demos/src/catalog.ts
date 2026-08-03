/** Public demo metadata. Keep this list deliberately small: these are product
 * studies a visitor can run, not an inventory of every rendering experiment. */
export type DemoMeta = {
  slug: string;
  title: string;
  pillar: 'Framework' | 'Research';
  tagline: string;
  notes: string;
  proves: string[];
  tags: string[];
  controls?: string;
  controlMode?: 'move' | 'orbit';
};

export const DEMOS: readonly DemoMeta[] = [
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
  },
  {
    slug: 'shader-study',
    title: 'Shader Study',
    pillar: 'Research',
    tagline: 'One typed shader compiled ahead of time for WebGPU.',
    notes:
      'Shader Study isolates one useful property of BroMetal: a typed TypeScript shader source compiles ahead of time to WGSL. Run the study, then inspect the authored source and generated output below.',
    proves: [
      'Typed TypeScript becomes browser-ready shader code at build time',
      'No shader compiler ships to the browser',
      'Generated WGSL remains inspectable beside the authored source',
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
  const prev = DEMOS[(index - 1 + DEMOS.length) % DEMOS.length]!;
  const next = DEMOS[(index + 1) % DEMOS.length]!;
  return { prev, next, index };
}
