export type DemoSlug =
  | 'combat-arena'
  | 'traversal-study'
  | 'antiky-town'
  | 'point-light-expo'
  | 'shader-study'
  | 'solar-forge'
  | 'luminous-reef'
  | 'orbital-atlas'
  | 'glass-garden';

export type DemoPillar = 'Framework' | 'BroMetal' | 'Three.js';

/**
 * Splits the BroMetal pillar by what a study actually is.
 *
 * Town Study is roughly nine thousand lines: a voxel surface mesher, a sprite batcher, a tested
 * character motor, and twelve shader pairs including dedicated shadow passes and a post pass. The
 * other three are fullscreen quads. Billing them identically read as a claim that a fullscreen
 * quad is the ceiling of what BroMetal does, which is the opposite of the point.
 */
export type DemoTier = 'engine' | 'shader-study';

export type DemoMeta = Readonly<{
  slug: DemoSlug;
  title: string;
  pillar: DemoPillar;
  tier?: DemoTier;
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
  tier?: DemoTier;
  title: string;
  description: string;
}>[] = [
  {
    id: 'framework-demos',
    pillar: 'Framework',
    title: 'Antiky Framework',
    description: 'Framework-owned game state and live authoring, rendered through BroMetal.',
  },
  {
    id: 'brometal-demos',
    pillar: 'BroMetal',
    tier: 'engine',
    title: 'BroMetal',
    description: 'Pure WebGPU projects that use BroMetal without an Antiky Framework dependency.',
  },
  {
    id: 'brometal-shader-demos',
    pillar: 'BroMetal',
    tier: 'shader-study',
    title: 'BroMetal shader studies',
    description: 'Single-quad studies, each isolating one property of the typed shader compiler rather than a whole scene.',
  },
  {
    id: 'threejs-demos',
    pillar: 'Three.js',
    title: 'Three.js',
    description: 'Pure WebGL projects that prove the same portable game host can mount another renderer.',
  },
];

/** Editorial approval is deliberate. A staged artifact cannot add itself to this catalog. */
export const DEMOS: readonly DemoMeta[] = [
  {
    slug: 'combat-arena',
    title: 'Combat Arena',
    pillar: 'Framework',
    tagline: 'A readable combat loop with dash strikes, enemy waves, and impact bursts.',
    notes:
      'A compact action game where Antiky Framework owns fixed-step movement, targeting, projectiles, damage, entity identity, runtime stores, and a bounded combat-event history.',
    proves: [
      'Framework-owned combat state with stable player, enemy, and projectile identities',
      'Automatic firing, click-to-dash attacks, defeats, and wave pressure from the first seconds',
      'One runtime projection drives custom BroMetal arena, trail, and impact rendering',
    ],
    tags: ['Antiky Framework', 'combat', 'particles'],
    requiresWebGpu: true,
    controls: 'Move with WASD or arrows; click or tap the arena to dash',
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
    slug: 'shader-study',
    title: 'Shader Study',
    pillar: 'BroMetal',
    tier: 'shader-study',
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
    tier: 'shader-study',
    tagline: 'A black hole with a photon ring and a Doppler-beamed accretion disk, in one draw call.',
    notes:
      'A gravitationally lensed photon ring, an accretion disk with relativistic Doppler beaming, layered noise and orbiting sparks — one draw call, no textures.',
    proves: [
      'A custom pure BroMetal shader rather than a prebuilt effect',
      'Layered procedural detail with one compact draw call',
      'Pointer-responsive composition in a portable game module',
    ],
    tags: ['BroMetal', 'procedural', 'one draw call'],
    requiresWebGpu: true,
    controls: 'Move the pointer to bend the view around the black hole',
  },
  {
    slug: 'luminous-reef',
    title: 'Luminous Reef',
    pillar: 'BroMetal',
    tier: 'shader-study',
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
    tagline: 'A kinetic solar sculpture wrapped in hundreds of animated orbital shards.',
    notes:
      'Planets, moons, rings, a deterministic star field, and a dynamically updated instance field use native Three.js APIs while the same Studio host supplies timing and lifecycle.',
    proves: [
      'Hierarchical animation through native Three.js scene groups',
      'Per-frame instance transforms and colors in one dynamic instanced draw',
      'A WebGL game module with no BroMetal or Framework dependency',
    ],
    tags: ['Three.js', 'dynamic instancing', 'WebGL'],
    requiresWebGpu: false,
    controls: 'Move the pointer to orbit the camera',
  },
  {
    slug: 'glass-garden',
    title: 'Glass Garden',
    pillar: 'Three.js',
    tagline: 'A bioluminescent crystal conservatory rooted in noise-sculpted terrain.',
    notes:
      'Transmission materials, animated crystal cores, procedural terrain, moving practical lights, and bloom composition show a polished Three.js scene running through Studio’s renderer-neutral contract.',
    proves: [
      'Three.js physical transmission over procedural ImprovedNoise terrain',
      'EffectComposer bloom, moving point lights, and shadowed geometry',
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

export function demoPosterUrl(slug: DemoSlug): string {
  return `/media/demos/${slug}.webp`;
}

export function demoMobilePosterUrl(slug: DemoSlug): string | undefined {
  if (slug === 'combat-arena') return '/media/demos/combat-arena-mobile.webp';
  return undefined;
}
