import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createCamera } from 'brometal';

import { COURSE_HAZARDS } from '../src/course.ts';
import { BACKGROUND_CATALOG_LANDMARKS } from '../src/environment.ts';
import { traversalCameraFrame } from '../src/presentation.ts';
import {
  HAZARD_SPIKE_SCALE,
  HAZARD_TELEGRAPH_DEPTH,
  HAZARD_TELEGRAPH_HALF_DEPTH,
  HAZARD_TELEGRAPH_HALF_HEIGHT,
  HUD_BAR_HALF_HEIGHT,
  HUD_BAR_HALF_WIDTH,
  HUD_DEPTH,
  HUD_LABEL_CELLS,
  HUD_LABEL_CELL_HALF_HEIGHT,
  HUD_LABEL_CELL_HALF_WIDTH,
  HUD_LABEL_CENTER_X_OFFSET,
  HUD_METER_CENTER_X_OFFSET,
  HUD_METER_HALF_WIDTH,
  hazardTelegraphHalfWidth,
  hudAnchorX,
  hudAnchorY,
} from '../src/visual-layout.ts';

type Bounds = Readonly<{ min: readonly number[]; max: readonly number[] }>;
type ProjectedBounds = Readonly<{
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

const aspect = 16 / 9;
const reviewState = {
  player: { x: 7.17, y: 0.43, vx: 6.35, vy: 0, grounded: true, facing: 1, squash: 0 },
};
const frame = traversalCameraFrame(aspect, reviewState, { x: 0.5, y: 0.5 });
const camera = createCamera({ position: frame.position, fovY: Math.PI / 3.6, near: 0.1, far: 240 });
camera.lookAt(...frame.target);
const matrix = camera.viewProjection(aspect);

function projectBox(
  bounds: Bounds,
  offset: readonly [number, number, number],
  scale: readonly [number, number, number],
): ProjectedBounds | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const sourceX of [bounds.min[0]!, bounds.max[0]!]) {
    for (const sourceY of [bounds.min[1]!, bounds.max[1]!]) {
      for (const sourceZ of [bounds.min[2]!, bounds.max[2]!]) {
        const x = offset[0] + sourceX * scale[0];
        const y = offset[1] + sourceY * scale[1];
        const z = offset[2] + sourceZ * scale[2];
        const clipX = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!;
        const clipY = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!;
        const clipW = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;
        if (clipW <= 0) return null;
        xs.push(clipX / clipW);
        ys.push(clipY / clipW);
      }
    }
  }
  return {
    width: (Math.max(...xs) - Math.min(...xs)) * 0.5,
    height: (Math.max(...ys) - Math.min(...ys)) * 0.5,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

const cubeBounds: Bounds = { min: [-1, -1, -1], max: [1, 1, 1] };

test('the game-native HUD occupies a compact corner instead of spanning forty percent of the canvas', () => {
  const hudX = hudAnchorX(frame.target[0], aspect);
  const hudY = hudAnchorY(frame.target[1], aspect);
  const progressBacking = projectBox(
    cubeBounds,
    [hudX, hudY, HUD_DEPTH],
    [HUD_BAR_HALF_WIDTH, HUD_BAR_HALF_HEIGHT, 0.06],
  )!;
  assert.ok(progressBacking.width <= 0.22, `HUD backing occupied ${progressBacking.width * 100}% of canvas width`);
  assert.ok(progressBacking.maxY <= 0.92);
});

test('projected coastal landmarks frame the route without giant cliff slabs taking over the screen', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/antiky-assets.json', import.meta.url), 'utf8'));
  const files = new Map<string, Bounds>(manifest.assets.flatMap(
    (catalog: { files: Array<{ derivedPath: string; validation: { bounds: Bounds } }> }) => catalog.files.map(
      (file) => [file.derivedPath.split('/').at(-1)!, file.validation.bounds] as const,
    ),
  ));
  const fileNames = {
    tree: 'tree.glb',
    'cloud-small': 'cloud-small.glb',
    'cloud-large': 'cloud-large.glb',
    'coastal-cliff': 'coastal-cliff.glb',
    'coastal-tree': 'coastal-tree.glb',
    'relay-tower': 'relay-tower.glb',
  } as const;
  const visible = BACKGROUND_CATALOG_LANDMARKS.flatMap((landmark) => {
    const projected = projectBox(
      files.get(fileNames[landmark.asset])!,
      [landmark.x, landmark.y, landmark.z],
      landmark.scale,
    );
    if (
      projected === null
      || projected.maxX <= -1
      || projected.minX >= 1
      || projected.maxY <= -1
      || projected.minY >= 1
    ) return [];
    return [{ asset: landmark.asset, projected }];
  });
  const cliffs = visible.filter((entry) => entry.asset === 'coastal-cliff');
  const clouds = visible.filter((entry) => entry.asset === 'cloud-small' || entry.asset === 'cloud-large');
  assert.ok(cliffs.length >= 2);
  assert.ok(cliffs.every((entry) => entry.projected.height <= 0.28), `cliff height was ${Math.max(...cliffs.map((entry) => entry.projected.height))}`);
  assert.ok(
    cliffs.every((entry) => entry.projected.minY <= -0.24),
    `floating cliff base was ${Math.max(...cliffs.map((entry) => entry.projected.minY))}`,
  );
  const orderedCliffs = [...cliffs].sort((left, right) => left.projected.minX - right.projected.minX);
  const largestHorizonGap = orderedCliffs.slice(1).reduce(
    (largest, entry, index) => Math.max(largest, entry.projected.minX - orderedCliffs[index]!.projected.maxX),
    0,
  );
  assert.ok(largestHorizonGap <= 0.12, `island horizon gap was ${largestHorizonGap}`);
  assert.ok(clouds.length >= 2);
  assert.ok(clouds.every((entry) => entry.projected.width > entry.projected.height * 1.35));
});

test('the compact HUD reserves projected geometry for distinct route and storm labels', () => {
  assert.ok(HUD_LABEL_CELLS.progress.length >= 30);
  assert.ok(HUD_LABEL_CELLS.storm.length >= 30);
  assert.notDeepEqual(HUD_LABEL_CELLS.progress, HUD_LABEL_CELLS.storm);

  const hudX = hudAnchorX(frame.target[0], aspect);
  const hudY = hudAnchorY(frame.target[1], aspect);
  const projectedLabelCells = HUD_LABEL_CELLS.progress.map((cell) => projectBox(
    cubeBounds,
    [hudX + HUD_LABEL_CENTER_X_OFFSET + cell[0], hudY + cell[1], HUD_DEPTH + 0.05],
    [HUD_LABEL_CELL_HALF_WIDTH, HUD_LABEL_CELL_HALF_HEIGHT, 0.076],
  )!);
  const labelMinX = Math.min(...projectedLabelCells.map((cell) => cell.minX));
  const labelMaxX = Math.max(...projectedLabelCells.map((cell) => cell.maxX));
  const meterRegion = projectBox(cubeBounds, [hudX + HUD_METER_CENTER_X_OFFSET, hudY, HUD_DEPTH + 0.04], [HUD_METER_HALF_WIDTH, 0.07, 0.075])!;
  assert.ok(labelMaxX < meterRegion.minX);
  assert.ok((labelMaxX - labelMinX) * 0.5 * 1280 >= 48);
  assert.ok(meterRegion.width * 1280 >= 70);
});

test('the first hazard telegraph stays close to the spike silhouette instead of becoming a black route bar', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/antiky-assets.json', import.meta.url), 'utf8'));
  const spikesFile = manifest.assets[0].files.find(
    (file: { derivedPath: string }) => file.derivedPath.endsWith('trap-spikes.glb'),
  );
  const hazard = COURSE_HAZARDS[0]!;
  const spikeBounds = projectBox(
    spikesFile.validation.bounds,
    [hazard.x, hazard.top + 0.02, 0],
    HAZARD_SPIKE_SCALE,
  )!;
  const oldBacking = projectBox(
    cubeBounds,
    [hazard.x, hazard.top + 0.055, HAZARD_TELEGRAPH_DEPTH],
    [hazardTelegraphHalfWidth(hazard.width), HAZARD_TELEGRAPH_HALF_HEIGHT, HAZARD_TELEGRAPH_HALF_DEPTH],
  )!;
  assert.ok(spikeBounds.height * 720 >= 36);
  assert.ok(oldBacking.width <= spikeBounds.width * 1.8, `telegraph/spike ratio was ${oldBacking.width / spikeBounds.width}`);
});
