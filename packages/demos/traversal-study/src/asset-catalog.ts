export const TRAVERSAL_CATALOG_ID = 'kenney:platformer-kit';
export const TRAVERSAL_PRESENTATION_CATALOG_ID = 'quaternius:ultimateplatformer';
export const TRAVERSAL_CATALOG_IDS = Object.freeze([
  TRAVERSAL_CATALOG_ID,
  TRAVERSAL_PRESENTATION_CATALOG_ID,
]);

export const TRAVERSAL_ASSETS = Object.freeze([
  { id: 'grass', catalogId: TRAVERSAL_CATALOG_ID, relativePath: 'assets/kenney/platformer-kit/block-grass-large.glb', fileName: 'block-grass-large.glb', url: new URL('../assets/kenney/platformer-kit/block-grass-large.glb?no-inline', import.meta.url).href },
  { id: 'overhang', catalogId: TRAVERSAL_CATALOG_ID, relativePath: 'assets/kenney/platformer-kit/block-grass-overhang-long.glb', fileName: 'block-grass-overhang-long.glb', url: new URL('../assets/kenney/platformer-kit/block-grass-overhang-long.glb?no-inline', import.meta.url).href },
  { id: 'moving', catalogId: TRAVERSAL_CATALOG_ID, relativePath: 'assets/kenney/platformer-kit/block-moving.glb', fileName: 'block-moving.glb', url: new URL('../assets/kenney/platformer-kit/block-moving.glb?no-inline', import.meta.url).href },
  { id: 'flag', catalogId: TRAVERSAL_CATALOG_ID, relativePath: 'assets/kenney/platformer-kit/flag.glb', fileName: 'flag.glb', url: new URL('../assets/kenney/platformer-kit/flag.glb?no-inline', import.meta.url).href },
  { id: 'coin', catalogId: TRAVERSAL_CATALOG_ID, relativePath: 'assets/kenney/platformer-kit/coin-gold.glb', fileName: 'coin-gold.glb', url: new URL('../assets/kenney/platformer-kit/coin-gold.glb?no-inline', import.meta.url).href },
  { id: 'spikes', catalogId: TRAVERSAL_CATALOG_ID, relativePath: 'assets/kenney/platformer-kit/trap-spikes.glb', fileName: 'trap-spikes.glb', url: new URL('../assets/kenney/platformer-kit/trap-spikes.glb?no-inline', import.meta.url).href },
  { id: 'tree', catalogId: TRAVERSAL_CATALOG_ID, relativePath: 'assets/kenney/platformer-kit/tree.glb', fileName: 'tree.glb', url: new URL('../assets/kenney/platformer-kit/tree.glb?no-inline', import.meta.url).href },
  { id: 'courier', catalogId: TRAVERSAL_PRESENTATION_CATALOG_ID, relativePath: 'assets/quaternius/ultimate-platformer/courier.glb', fileName: 'courier.glb', url: new URL('../assets/quaternius/ultimate-platformer/courier.glb?no-inline', import.meta.url).href },
  { id: 'cloud-small', catalogId: TRAVERSAL_PRESENTATION_CATALOG_ID, relativePath: 'assets/quaternius/ultimate-platformer/cloud-small.glb', fileName: 'cloud-small.glb', url: new URL('../assets/quaternius/ultimate-platformer/cloud-small.glb?no-inline', import.meta.url).href },
  { id: 'cloud-large', catalogId: TRAVERSAL_PRESENTATION_CATALOG_ID, relativePath: 'assets/quaternius/ultimate-platformer/cloud-large.glb', fileName: 'cloud-large.glb', url: new URL('../assets/quaternius/ultimate-platformer/cloud-large.glb?no-inline', import.meta.url).href },
  { id: 'coastal-cliff', catalogId: TRAVERSAL_PRESENTATION_CATALOG_ID, relativePath: 'assets/quaternius/ultimate-platformer/coastal-cliff.glb', fileName: 'coastal-cliff.glb', url: new URL('../assets/quaternius/ultimate-platformer/coastal-cliff.glb?no-inline', import.meta.url).href },
  { id: 'coastal-tree', catalogId: TRAVERSAL_PRESENTATION_CATALOG_ID, relativePath: 'assets/quaternius/ultimate-platformer/coastal-tree.glb', fileName: 'coastal-tree.glb', url: new URL('../assets/quaternius/ultimate-platformer/coastal-tree.glb?no-inline', import.meta.url).href },
  { id: 'relay-tower', catalogId: TRAVERSAL_PRESENTATION_CATALOG_ID, relativePath: 'assets/quaternius/ultimate-platformer/relay-tower.glb', fileName: 'relay-tower.glb', url: new URL('../assets/quaternius/ultimate-platformer/relay-tower.glb?no-inline', import.meta.url).href },
] as const);

export type TraversalAssetId = typeof TRAVERSAL_ASSETS[number]['id'];
