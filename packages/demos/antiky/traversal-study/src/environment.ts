export type EnvironmentLayerId = 'near-shore' | 'middle-cliffs' | 'far-headlands' | 'horizon-sky';
export type EnvironmentAsset =
  | 'tree'
  | 'cloud-small'
  | 'cloud-large'
  | 'coastal-cliff'
  | 'coastal-tree'
  | 'relay-tower';

export type BackgroundLayer = Readonly<{
  id: EnvironmentLayerId;
  z: number;
}>;

export type CatalogLandmark = Readonly<{
  asset: EnvironmentAsset;
  layer: EnvironmentLayerId;
  x: number;
  y: number;
  z: number;
  scale: readonly [number, number, number];
  yaw: number;
  phase: number;
}>;

export type ProceduralLandmark = never;

export const BACKGROUND_LAYERS: readonly BackgroundLayer[] = Object.freeze([
  { id: 'near-shore', z: -4.8 },
  { id: 'middle-cliffs', z: -10 },
  { id: 'far-headlands', z: -17 },
  { id: 'horizon-sky', z: -24 },
]);

const anchors = [-5, 9, 23, 37, 51, 65, 79, 93, 107, 121, 135, 149, 163, 177, 191, 205] as const;
const landmarks: CatalogLandmark[] = [];

for (let index = 0; index < anchors.length; index += 1) {
  const x = anchors[index]!;
  const far = index % 3 === 0;
  const layer: EnvironmentLayerId = far ? 'far-headlands' : 'middle-cliffs';
  const depth = far ? -20.5 : -12.5 - index % 2 * 1.4;
  const scaleX = far ? 1.75 : 1.55;
  const scaleY = far ? 0.72 : 0.62;
  landmarks.push(Object.freeze({
    asset: 'coastal-cliff',
    layer,
    x,
    // Lowered by goal 08's composition pass: the camera rides 2 units higher now and tilts down,
    // so the cliffs drop with the horizon to keep anchoring the frame's lower third.
    y: far ? -12.3 : -7.6,
    z: depth,
    scale: [scaleX, scaleY, far ? 1.2 : 1] as const,
    yaw: index % 2 === 0 ? 0.12 : -0.16,
    phase: index * 0.37,
  }));

  // Goal 08's composition fill: a second staggered rank of mid cliffs, so the band behind the
  // course reads as a coastline rather than as empty haze. LittleBigPlanet's frames are full of
  // stage; sixty percent dead sky was this demo's diagnosed defect.
  landmarks.push(Object.freeze({
    asset: 'coastal-cliff',
    layer: 'middle-cliffs',
    x: x + 7,
    y: -8.6,
    z: -15.2 - index % 2 * 1.1,
    scale: [1.7, 0.74, 1.05] as const,
    yaw: index % 2 === 0 ? -0.1 : 0.14,
    phase: index * 0.53 + 0.21,
  }));

  if (index % 2 === 0) {
    landmarks.push(Object.freeze({
      asset: index % 4 === 0 ? 'coastal-tree' : 'tree',
      layer: 'near-shore',
      x: x + 4.8,
      y: index % 4 === 0 ? -2.35 : -1.9,
      z: -6.5 - index % 3 * 0.55,
      scale: index % 4 === 0 ? [0.31, 0.31, 0.31] as const : [1.18, 1.18, 1.18] as const,
      yaw: index % 4 === 0 ? -0.18 : 0.22,
      phase: index * 0.81,
    }));
  }
}

for (let index = 0; index < 12; index += 1) {
  const large = index % 3 === 0;
  landmarks.push(Object.freeze({
    asset: large ? 'cloud-large' : 'cloud-small',
    layer: index % 2 === 0 ? 'horizon-sky' : 'far-headlands',
    x: -3 + index * 18.2,
    y: 4.6 + index % 4 * 0.9,
    z: index % 2 === 0 ? -23 : -18.5,
    scale: large ? [2.7, 0.82, 1.15] as const : [2.25, 0.72, 1.05] as const,
    yaw: index % 2 === 0 ? 0.04 : -0.05,
    phase: index * 1.13,
  }));
}

landmarks.push(Object.freeze({
  asset: 'relay-tower',
  layer: 'middle-cliffs',
  x: 178.5,
  y: -2.7,
  z: -10.2,
  scale: [0.62, 0.62, 0.62] as const,
  yaw: -0.16,
  phase: 0,
}));

export const BACKGROUND_CATALOG_LANDMARKS: readonly CatalogLandmark[] = Object.freeze(landmarks);
const PROCEDURAL_LANDMARKS: readonly ProceduralLandmark[] = Object.freeze([]);
const BACKGROUND_COMPOSITION = Object.freeze({
  catalog: BACKGROUND_CATALOG_LANDMARKS,
  procedural: PROCEDURAL_LANDMARKS,
});

export function backgroundCompositionAt(_cameraX: number): Readonly<{
  catalog: readonly CatalogLandmark[];
  procedural: readonly ProceduralLandmark[];
}> {
  return BACKGROUND_COMPOSITION;
}
