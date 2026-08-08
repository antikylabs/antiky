export type StudioGameMovement = Readonly<{
  x: number;
  z: number;
  active: boolean;
}>;

export type StudioGameContext = Readonly<{
  canvas: HTMLCanvasElement;
  runtimeInstanceId: string;
  pointer: Readonly<{
    x: number;
    y: number;
    down: boolean;
    active: boolean;
    dragX: number;
    dragY: number;
    clicked: boolean;
  }>;
  movement: StudioGameMovement;
  mode: 'ambient' | 'interactive' | 'thumbnail';
  report(measurements: Readonly<{
    instances?: number;
    drawCalls?: number;
    uploadBytesPerFrame?: number;
    note?: string;
  }>): void;
}>;

export type StudioGameInstance = Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}>;

export type StudioGameEntry = (
  context: StudioGameContext,
) => StudioGameInstance | Promise<StudioGameInstance>;

