export type DemoSlug =
  | 'antiky-town'
  | 'point-light-expo'
  | 'town-study'
  | 'shader-study'
  | 'solar-forge'
  | 'luminous-reef'
  | 'orbital-atlas'
  | 'glass-garden';

export type DemoMeta = Readonly<{
  slug: DemoSlug;
  title: string;
  pillar: 'Framework' | 'BroMetal' | 'Three.js';
  tagline: string;
  notes: string;
  proves: readonly string[];
  tags: readonly string[];
  requiresWebGpu: boolean;
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
    poster: '/media/town-study-poster.png',
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
  {
    slug: 'town-study',
    title: 'Town Study',
    pillar: 'BroMetal',
    tagline: 'A living pixel cast inside a golden-hour voxel town.',
    notes:
      'Cross the canal and enter a market town at sunset. This edition is a pure BroMetal project: the renderer and game own the scene while Studio supplies only the portable host lifecycle.',
    proves: [
      'A handcrafted bridge, market, canal, houses, and bell tower',
      'Crisp illustrated travelers with physical depth, light, and shadow',
      'A Framework-free BroMetal project running unchanged in Studio',
    ],
    tags: ['BroMetal', 'voxel town', 'real-time lighting'],
    requiresWebGpu: true,
    controls: 'Move with WASD, arrow keys, or the on-screen direction controls',
    controlMode: 'move',
    poster: '/media/town-study-poster.png',
  },
  {
    slug: 'shader-study',
    title: 'Shader Study',
    pillar: 'BroMetal',
    tagline: 'One typed aurora shader compiled ahead of time for WebGPU.',
    notes:
      'Shader Study isolates one useful property of BroMetal: typed shader source compiles ahead of time to WGSL. The website runs only the generated game artifact.',
    proves: [
      'Typed TypeScript becomes browser-ready shader code at build time',
      'No shader compiler ships to the browser',
      'A pure BroMetal module works in the same Studio host',
    ],
    tags: ['BroMetal', 'WGSL', 'aurora'],
    requiresWebGpu: true,
  },
  {
    slug: 'solar-forge',
    title: 'Solar Forge',
    pillar: 'BroMetal',
    tagline: 'A turbulent procedural eclipse forged from typed shader code.',
    notes:
      'Layered noise, a molten corona, orbiting sparks, and a black-hot core form a cinematic stellar furnace with one draw call and no textures.',
    proves: [
      'A custom pure BroMetal shader rather than a prebuilt effect',
      'Layered procedural detail with one compact draw call',
      'Pointer-responsive composition in a portable game module',
    ],
    tags: ['BroMetal', 'procedural', 'one draw call'],
    requiresWebGpu: true,
    controls: 'Move the pointer to bend the view around the eclipse',
  },
  {
    slug: 'luminous-reef',
    title: 'Luminous Reef',
    pillar: 'BroMetal',
    tagline: 'Bioluminescent life and caustic water in one custom shader.',
    notes:
      'A procedural seascape layers drifting water, cellular caustics, jelly forms, coral silhouettes, and responsive parallax without texture assets.',
    proves: [
      'Typed noise and Voronoi helpers composed into original material',
      'Animated organic forms without model or texture downloads',
      'A Framework-free BroMetal project inspectable at the host boundary',
    ],
    tags: ['BroMetal', 'caustics', 'bioluminescence'],
    requiresWebGpu: true,
    controls: 'Move the pointer to drift through the water',
  },
  {
    slug: 'orbital-atlas',
    title: 'Orbital Atlas',
    pillar: 'Three.js',
    tagline: 'A kinetic solar sculpture built from a nested scene graph.',
    notes:
      'Planets, moons, rings, and a deterministic star field use native Three.js groups and physical materials while the same Studio host supplies timing and lifecycle.',
    proves: [
      'Hierarchical animation through native Three.js scene groups',
      'A WebGL game module with no BroMetal or Framework dependency',
      'Studio measurements and agent connection remain available',
    ],
    tags: ['Three.js', 'scene graph', 'WebGL'],
    requiresWebGpu: false,
    controls: 'Move the pointer to orbit the camera',
  },
  {
    slug: 'glass-garden',
    title: 'Glass Garden',
    pillar: 'Three.js',
    tagline: 'A luminous conservatory of crystal blooms and moving light.',
    notes:
      'Transmission materials, metallic stems, animated practical lights, and a reflective floor show a polished Three.js scene running through Studio’s renderer-neutral contract.',
    proves: [
      'Three.js physical transmission and standard materials',
      'Moving point lights and shadowed geometry',
      'The same Studio lifecycle works without WebGPU',
    ],
    tags: ['Three.js', 'physical materials', 'WebGL'],
    requiresWebGpu: false,
    controls: 'Move the pointer to circle the conservatory',
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
