export type StudioGameEntry = (context: Readonly<{
  canvas: HTMLCanvasElement;
  pointer: Readonly<{ x: number; y: number }>;
  report(measurements: Readonly<{
    instances?: number;
    drawCalls?: number;
    uploadBytesPerFrame?: number;
    note?: string;
  }>): void;
}>) => Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}> | Promise<Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}>>;
