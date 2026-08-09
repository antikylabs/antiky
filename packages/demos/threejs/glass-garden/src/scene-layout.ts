export type GlassBloomLayout = Readonly<{
  position: readonly [number, number];
  materialIndex: number;
  heightScale: number;
  crownScale: number;
}>;

const BLOOM_POINTS = Object.freeze([
  [-5.1, -0.2],
  [-4.45, -2.15],
  [-3.65, 1.15],
  [-2.8, -3.35],
  [-1.95, -0.5],
  [-0.95, -2.45],
  [0, 0.75],
  [0.95, -2.55],
  [1.95, -0.45],
  [2.85, -3.25],
  [3.7, 1.1],
  [4.48, -2.05],
  [5.15, -0.1],
] as const);

export function createGlassBloomLayout(): readonly GlassBloomLayout[] {
  return Object.freeze(BLOOM_POINTS.map((position, index) => Object.freeze({
    position,
    materialIndex: index % 3,
    heightScale: 0.72 + ((index * 5) % 6) * 0.075,
    crownScale: 0.76 + ((index * 7) % 5) * 0.065,
  })));
}
