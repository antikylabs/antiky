import type {
  PointLightAuthoringService,
  PointLightRenderChanges,
} from '@antiky/framework';

import type { TownSlotZeroPowerSource } from '../../brometal-town/practical-light-input.ts';
import { MARKET_LAMP_WEST_01_ID } from '../content/point-lights.ts';

type PendingReplacement = Readonly<{
  eventSequence: number;
  power: number;
}>;

export type TownPointLightAdapter = TownSlotZeroPowerSource;

function readMarketChange(changes: PointLightRenderChanges): PendingReplacement | undefined {
  if (changes.pointLights.length === 0) return undefined;
  if (
    changes.pointLights.length !== 1
    || changes.pointLights[0]?.entityId !== MARKET_LAMP_WEST_01_ID
    || changes.pointLights[0].renderSlot !== 0
  ) {
    throw new Error('Antiky Town can replace only Market Lamp West 01 at render slot 0.');
  }
  return Object.freeze({
    eventSequence: changes.eventSequence,
    power: changes.pointLights[0].power,
  });
}

export function createTownPointLightAdapter(
  service: PointLightAuthoringService,
): TownPointLightAdapter {
  const initialBindings = service.readPointLightState().render.pointLights;
  if (
    initialBindings.length !== 1
    || initialBindings[0]?.entityId !== MARKET_LAMP_WEST_01_ID
    || initialBindings[0].renderSlot !== 0
  ) {
    throw new Error('Antiky Town requires Market Lamp West 01 at render slot 0.');
  }

  let pending: PendingReplacement | undefined;
  return Object.freeze({
    readPendingBasePower(): number | undefined {
      pending = readMarketChange(service.readPointLightRenderChanges());
      return pending?.power;
    },
    commitPendingBasePower(power: number): void {
      const replacement = pending;
      if (!replacement || !Object.is(power, replacement.power)) {
        throw new Error('Antiky Town received a stale slot 0 render acknowledgement.');
      }
      service.acknowledgePointLightRenderChanges(replacement.eventSequence);
      pending = undefined;
    },
  });
}
