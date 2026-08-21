export function validateExternalGltfSource(
  source: Record<string, unknown>,
  expected: Readonly<{ bufferUri: string; imageUris: readonly string[] }>,
): void;

export function packExternalGltfToGlb(options: Readonly<{
  source: Record<string, unknown>;
  sourceBin: Buffer;
  selectedMeshIndex: number;
  diffuse: Buffer;
  materialMap: Buffer;
  diffuseName: string;
  materialName: string;
  generator: string;
}>): Buffer;
