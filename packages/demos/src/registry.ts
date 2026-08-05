import type { DemoFactory } from './runtime';

/* Public names are intentionally product-facing. Each implementation owns a
 * folder and can be replaced without changing the website routes. */
const LOADERS: Record<string, () => Promise<{ default: DemoFactory }>> = {
  'antiky-town': () => import('./demos/antiky-town'),
  'town-study': () => import('./demos/brometal-town'),
  'shader-study': () => import('./demos/shader-study'),
};

export async function loadDemo(slug: string): Promise<DemoFactory | null> {
  const loader = LOADERS[slug];
  if (!loader) return null;
  const module = await loader();
  return module.default;
}
