export type StudioGameEntry = (context: Readonly<{
  canvas: HTMLCanvasElement;
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

