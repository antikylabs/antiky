import {
  createPointLightAuthoringService,
  parseEntityId,
  parseWorldId,
  type PointLightAuthoringService,
} from '@antiky/framework';

export const ANTIKY_TOWN_WORLD_ID = parseWorldId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
);
export const MARKET_LAMP_WEST_01_ID = parseEntityId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
);
export const PROOF_POINT_LIGHT_ID = parseEntityId(
  '018f0f3a-7b2c-7a1d-8e2f-123456789abe',
);

export function createAntikyTownPointLightService(
  runtimeInstanceId: string,
): PointLightAuthoringService {
  return createPointLightAuthoringService({
    worldId: ANTIKY_TOWN_WORLD_ID,
    pointLights: [
      {
        entityId: MARKET_LAMP_WEST_01_ID,
        label: 'Market Lamp West 01',
        revision: 1,
        transform: { schemaVersion: 1, position: [-3.565, 4.237, 6.82] },
        pointLight: {
          schemaVersion: 1,
          color: [1, 0.52, 0.22],
          radius: 4,
          power: 1.05,
        },
      },
      {
        entityId: PROOF_POINT_LIGHT_ID,
        label: 'Headless Point Light Proof',
        revision: 1,
        transform: { schemaVersion: 1, position: [0, 0, 0] },
        pointLight: {
          schemaVersion: 1,
          color: [0.5, 0.75, 1],
          radius: 2,
          power: 0.5,
        },
      },
    ],
    runtimeInstanceId,
    renderBindings: [{ entityId: MARKET_LAMP_WEST_01_ID, renderSlot: 0 }],
  });
}
