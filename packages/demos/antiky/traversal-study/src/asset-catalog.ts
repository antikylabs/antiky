export const TRAVERSAL_CATALOG_ID = 'kenney:platformer-kit';

export const TRAVERSAL_ASSETS = Object.freeze([
  { id: 'grass', fileName: 'block-grass-large.glb', url: new URL('../assets/kenney/platformer-kit/block-grass-large.glb?no-inline', import.meta.url).href },
  { id: 'overhang', fileName: 'block-grass-overhang-long.glb', url: new URL('../assets/kenney/platformer-kit/block-grass-overhang-long.glb?no-inline', import.meta.url).href },
  { id: 'moving', fileName: 'block-moving.glb', url: new URL('../assets/kenney/platformer-kit/block-moving.glb?no-inline', import.meta.url).href },
  { id: 'flag', fileName: 'flag.glb', url: new URL('../assets/kenney/platformer-kit/flag.glb?no-inline', import.meta.url).href },
  { id: 'coin', fileName: 'coin-gold.glb', url: new URL('../assets/kenney/platformer-kit/coin-gold.glb?no-inline', import.meta.url).href },
  { id: 'spikes', fileName: 'trap-spikes.glb', url: new URL('../assets/kenney/platformer-kit/trap-spikes.glb?no-inline', import.meta.url).href },
  { id: 'tree', fileName: 'tree.glb', url: new URL('../assets/kenney/platformer-kit/tree.glb?no-inline', import.meta.url).href },
] as const);

export type TraversalAssetId = typeof TRAVERSAL_ASSETS[number]['id'];
