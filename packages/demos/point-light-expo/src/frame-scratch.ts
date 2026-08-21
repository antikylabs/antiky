export type RelayFrameScratch = Readonly<{
  cameraPosition: Float32Array;
}>;

export function createRelayFrameScratch(): RelayFrameScratch {
  return Object.freeze({ cameraPosition: new Float32Array(3) });
}

export function setCameraPosition(
  scratch: RelayFrameScratch,
  x: number,
  y: number,
  z: number,
): void {
  scratch.cameraPosition[0] = x;
  scratch.cameraPosition[1] = y;
  scratch.cameraPosition[2] = z;
}
