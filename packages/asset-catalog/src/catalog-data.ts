import type { AssetDownload } from './index.ts';
import { GENERATED_CURATED_ASSETS } from './generated-curated-catalog.ts';
import { GENERATED_POLY_HAVEN_ASSETS } from './generated-catalog.ts';
import { createPolyHavenAsset } from './providers/poly-haven.ts';

const retrievedAt = '2026-08-09T00:00:00.000Z';

function download(
  path: string, format: string, size: number, url: string, md5: string,
): AssetDownload {
  return Object.freeze({ path, format, size, url, hash: Object.freeze({ algorithm: 'md5', value: md5 }) });
}

export const CATALOG_ASSETS = Object.freeze([
  createPolyHavenAsset({
    upstreamId: 'dead_tree_trunk', retrievedAt,
    metadata: {
      name: 'Dead Tree Trunk', type: 2,
      description: 'Free 8K dead tree trunk model, a long weathered log with cracked, decayed bark, pronounced wood grain, broken ends and subtle mossy-green patches.',
      tags: ['log', 'dead tree', 'tree', 'trunk', 'bark', 'nature', 'forest', 'woodland', 'forest floor'],
      categories: ['nature', 'plants', 'ground cover'], authors: { 'Rob Tuytel': 'All' },
      files_hash: '1e56e4393417d157e43e26bd8b7b019189d313ed',
      thumbnail_url: 'https://cdn.polyhaven.com/asset_img/thumbs/dead_tree_trunk.png?width=256&height=256',
    },
    files: [
      download('dead_tree_trunk_1k.gltf', 'gltf', 2812, 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/dead_tree_trunk/dead_tree_trunk_1k.gltf', '7bbf9fc9fdf61b50ed0495a29c03ecab'),
      download('dead_tree_trunk.bin', 'bin', 2293788, 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/dead_tree_trunk/dead_tree_trunk.bin', '2a2b05e67a5c51fba5fc7591a7857957'),
      download('textures/dead_tree_trunk_diff_1k.jpg', 'jpg', 713480, 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/dead_tree_trunk/dead_tree_trunk_diff_1k.jpg', 'fe92c64532d4684d3239f6edc7733192'),
      download('textures/dead_tree_trunk_nor_gl_1k.jpg', 'jpg', 1053075, 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/dead_tree_trunk/dead_tree_trunk_nor_gl_1k.jpg', '28992c1123371ae1899e49360953c846'),
      download('textures/dead_tree_trunk_arm_1k.jpg', 'jpg', 724384, 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/dead_tree_trunk/dead_tree_trunk_arm_1k.jpg', '548a72849ce709a9f38fa06776732a07'),
    ],
  }),
  createPolyHavenAsset({
    upstreamId: 'forest_floor', retrievedAt,
    metadata: {
      name: 'Forest Floor', type: 1,
      description: 'Free 8K texture of a dry forest floor: sandy dirt and mud with rough granular surface, scattered yellow and brown autumn leaves, twigs and debris.',
      tags: ['sand', 'leaves', 'autumn', 'forest', 'dirt', 'nature', 'debris', 'ground'],
      categories: ['outdoor', 'natural', 'terrain'], authors: { 'eye-candy.xyz': 'All' },
      files_hash: '7723fe51fafe4f43d1242eff1dd06f34560ec921',
      thumbnail_url: 'https://cdn.polyhaven.com/asset_img/thumbs/forest_floor.png?width=256&height=256',
    },
    files: [
      download('forest_floor_diff_1k.jpg', 'jpg', 1329853, 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_floor/forest_floor_diff_1k.jpg', 'd67f308e4b8be6a65989e8dc76ec40fe'),
      download('forest_floor_ao_1k.jpg', 'jpg', 785094, 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_floor/forest_floor_ao_1k.jpg', '882d6f7e0b0a1a27de4eb4ecfdc12649'),
      download('forest_floor_rough_1k.jpg', 'jpg', 736353, 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_floor/forest_floor_rough_1k.jpg', '446092b42424c7bcf15994d651949546'),
      download('forest_floor_nor_gl_1k.jpg', 'jpg', 1380104, 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_floor/forest_floor_nor_gl_1k.jpg', '7cb480d082527766acdf3b6c8cba50f4'),
    ],
  }),
  createPolyHavenAsset({
    upstreamId: 'forest_slope', retrievedAt,
    metadata: {
      name: 'Forest Slope', type: 0,
      description: 'Free, unclipped 19K HDRI with soft morning summer light: low-contrast, dappled sunlight through tall pines over mossy rocks and a shaded forest slope.',
      tags: ['tree', 'forest', 'summer', 'rock', 'hill'],
      categories: ['outdoor', 'nature', 'natural light'], authors: { 'Andreas Mischok': 'All' },
      files_hash: '853e764efb5f26b9222f7355a0a9c640863a1174',
      thumbnail_url: 'https://cdn.polyhaven.com/asset_img/thumbs/forest_slope.png?width=256&height=256',
    },
    files: [
      download('forest_slope_1k.hdr', 'hdr', 1911073, 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/forest_slope_1k.hdr', 'd7676fa11b7a6c4cc3333ac6505e08d2'),
    ],
  }),
  ...GENERATED_POLY_HAVEN_ASSETS,
  ...GENERATED_CURATED_ASSETS,
]);
