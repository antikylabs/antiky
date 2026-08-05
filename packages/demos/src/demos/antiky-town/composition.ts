import type { DemoFactory } from '../../runtime.ts';
import type { TownDemoOptions } from '../brometal-town/practical-light-input.ts';
import { createAntikyTownPointLightService } from './content/point-lights.ts';
import { createTownPointLightAdapter } from './render/point-light-adapter.ts';

export type TownFactoryBuilder = (options: TownDemoOptions) => DemoFactory;

export function createAntikyTownDemoFactory(
  buildTown: TownFactoryBuilder,
): DemoFactory {
  return async (setup) => {
    const service = createAntikyTownPointLightService(setup.runtimeInstanceId);
    try {
      const pointLightAdapter = createTownPointLightAdapter(service);
      const town = await buildTown({ slotZeroPower: pointLightAdapter })(setup);
      let disposed = false;

      return Object.freeze({
        pointLightService: service,
        frame(elapsedSeconds: number): void {
          if (!disposed) town.frame(elapsedSeconds);
        },
        dispose(): void {
          if (disposed) return;
          disposed = true;
          try {
            town.dispose();
          } finally {
            service.dispose();
          }
        },
      });
    } catch (cause: unknown) {
      service.dispose();
      throw cause;
    }
  };
}
