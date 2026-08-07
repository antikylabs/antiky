import { createRenderer } from 'brometal';
import type { GameModuleEntry } from '@antiky/framework/game';
import { createTownGameFactory } from './town/index.ts';

const factory = createTownGameFactory();

const game: GameModuleEntry = async (context) => {
  const renderer = await createRenderer(context.canvas, { cull: 'back' });
  try {
    const instance = await factory({ ...context, renderer });
    let disposed = false;
    return Object.freeze({
      frame(platformTimeSeconds: number): void {
        if (!disposed) instance.frame(platformTimeSeconds);
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        try {
          instance.dispose();
        } finally {
          renderer.destroy();
        }
      },
    });
  } catch (cause: unknown) {
    renderer.destroy();
    throw cause;
  }
};

export default game;
