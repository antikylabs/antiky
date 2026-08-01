import type { DemoFactory } from './runtime';

/* Public names are intentionally product-facing. The renderers remain small,
 * reusable studies and can be replaced without changing the website routes. */
const LOADERS: Record<string, () => Promise<{ default: DemoFactory }>> = {
  'depth-study': () => import('./render/sprite-depth'),
  'shader-study': () => import('./render/one-source'),
};

export async function loadDemo(slug: string): Promise<DemoFactory | null> {
  const loader = LOADERS[slug];
  if (!loader) return null;
  const module = await loader();
  return module.default;
}
