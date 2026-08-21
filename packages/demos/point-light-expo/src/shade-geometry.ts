import type { Geometry } from 'brometal';

type Point = readonly [number, number, number];

export function createShadeGeometry(): Geometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const addFace = (a: Point, b: Point, c: Point): void => {
    const abX = b[0] - a[0];
    const abY = b[1] - a[1];
    const abZ = b[2] - a[2];
    const acX = c[0] - a[0];
    const acY = c[1] - a[1];
    const acZ = c[2] - a[2];
    const normalX = abY * acZ - abZ * acY;
    const normalY = abZ * acX - abX * acZ;
    const normalZ = abX * acY - abY * acX;
    const length = Math.max(0.0001, Math.hypot(normalX, normalY, normalZ));
    const start = positions.length / 3;
    for (const point of [a, b, c]) {
      positions.push(point[0], point[1], point[2]);
      normals.push(normalX / length, normalY / length, normalZ / length);
      uvs.push(0, 0);
    }
    indices.push(start, start + 1, start + 2);
  };
  const addDoubleFace = (a: Point, b: Point, c: Point): void => {
    addFace(a, b, c);
    addFace(c, b, a);
  };
  const addOctahedron = (
    centerX: number, centerY: number, centerZ: number,
    scaleX: number, scaleY: number, scaleZ: number,
  ): void => {
    const top: Point = [centerX, centerY + scaleY, centerZ];
    const bottom: Point = [centerX, centerY - scaleY, centerZ];
    const left: Point = [centerX - scaleX, centerY, centerZ];
    const right: Point = [centerX + scaleX, centerY, centerZ];
    const front: Point = [centerX, centerY, centerZ - scaleZ];
    const back: Point = [centerX, centerY, centerZ + scaleZ];
    for (const face of [
      [top, front, left], [top, right, front], [top, back, right], [top, left, back],
      [bottom, left, front], [bottom, front, right], [bottom, right, back], [bottom, back, left],
    ] as const) addDoubleFace(face[0], face[1], face[2]);
  };

  // A low, heavy torso and shoulder mass make the silhouette read as a stalking beast from above.
  addOctahedron(0, 0.04, 0.08, 0.7, 0.5, 0.86);
  addOctahedron(0, 0.25, -0.62, 0.58, 0.46, 0.5);
  addOctahedron(0, 0.43, -1.02, 0.4, 0.36, 0.38);

  // Four grounded limbs and offset foreclaws prevent a floating moth read.
  addOctahedron(-0.48, -0.34, -0.45, 0.24, 0.43, 0.28);
  addOctahedron(0.48, -0.34, -0.45, 0.24, 0.43, 0.28);
  addOctahedron(-0.42, -0.31, 0.5, 0.22, 0.39, 0.25);
  addOctahedron(0.42, -0.31, 0.5, 0.22, 0.39, 0.25);
  addOctahedron(-0.72, -0.58, -0.72, 0.17, 0.16, 0.32);
  addOctahedron(0.72, -0.58, -0.72, 0.17, 0.16, 0.32);

  // A segmented raised tail gives motion direction without shader wobble.
  addOctahedron(0, 0.18, 0.84, 0.32, 0.28, 0.46);
  addOctahedron(0.13, 0.42, 1.16, 0.2, 0.22, 0.36);

  const crown: Point = [0, 0.74, -1.04];
  const leftHorn: Point = [-0.3, 1.2, -1.02];
  const rightHorn: Point = [0.3, 1.2, -1.02];
  const leftTemple: Point = [-0.35, 0.55, -0.98];
  const rightTemple: Point = [0.35, 0.55, -0.98];
  const nape: Point = [0, 0.54, -0.72];
  addDoubleFace(crown, leftHorn, leftTemple);
  addDoubleFace(crown, rightTemple, rightHorn);
  addDoubleFace(leftHorn, nape, leftTemple);
  addDoubleFace(rightHorn, rightTemple, nape);

  return Object.freeze({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  });
}
