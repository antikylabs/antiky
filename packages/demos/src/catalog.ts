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
};

export const DEMOS: readonly DemoMeta[] = [
  {
    slug: 'depth-study',
    title: 'Depth Study',
    pillar: 'Framework',
    tagline: 'A live study of 2D characters sharing light, fog, and depth with a 3D world.',
    notes:
      'Depth Study is a small browser scene built on BroMetal. Sprite billboards and simple 3D geometry share one camera and one depth buffer, so characters can move behind objects instead of being composited as a separate layer. It is an experiment, not footage from Emberwyrd or a finished Antiky Framework feature.',
    proves: [
      '2D characters can be placed convincingly inside spatial 3D scenes',
      'Geometry occludes characters through depth rather than manual layer order',
      'The same study runs through BroMetal on WebGPU or WebGL2',
    ],
    tags: ['2.3D', 'sprites', 'depth'],
    controls: 'Drag or use arrow keys to orbit',
  },
  {
    slug: 'shader-study',
    title: 'Shader Study',
    pillar: 'Research',
    tagline: 'One authored shader compiled for WebGPU and WebGL2.',
    notes:
      'Shader Study isolates one useful property of BroMetal: a typed TypeScript shader source can be compiled to both WGSL and GLSL ES 3.00. Switch the backend while the study is running, then inspect the source and generated output below.',
    proves: [
      'One TypeScript shader source targets both browser graphics APIs',
      'The active backend can be changed without changing the study code',
      'Generated WGSL and GLSL remain inspectable alongside the authored source',
    ],
    tags: ['WebGPU', 'WebGL2', 'shaders'],
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
