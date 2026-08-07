import { createRenderer } from 'brometal';
import type { GameModuleEntry } from '@antiky/framework/game';
import { createTownRuntimeFactory } from '@antiky/demo-town-support';
import { createAntikyTownDemoFactory } from './composition.ts';

export {
  ANTIKY_TOWN_WORLD_ID,
  MARKET_LAMP_WEST_01_ID,
  PROOF_POINT_LIGHT_ID,
} from './content/point-lights.ts';
export { createAntikyTownDemoFactory } from './composition.ts';

const factory = createAntikyTownDemoFactory(createTownRuntimeFactory);

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
