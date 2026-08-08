import {
  createPointLightAuthoringService,
  parseEntityId,
  parseWorldId,
  type PointLightAuthoringService,
} from '@antiky/framework';

export const EXPO_WORLD_ID = parseWorldId('0197f27e-1000-7000-8000-000000000001');
export const EMBER_LIGHT_ID = parseEntityId('0197f27e-1000-7000-8000-000000000002');
export const ION_LIGHT_ID = parseEntityId('0197f27e-1000-7000-8000-000000000003');
export const VIOLET_LIGHT_ID = parseEntityId('0197f27e-1000-7000-8000-000000000004');

export const EXPO_LIGHT_IDS = Object.freeze([
  EMBER_LIGHT_ID,
  ION_LIGHT_ID,
  VIOLET_LIGHT_ID,
]);

export function createExpoLightService(runtimeInstanceId: string): PointLightAuthoringService {
  return createPointLightAuthoringService({
    worldId: EXPO_WORLD_ID,
    runtimeInstanceId,
    pointLights: [
      {
        entityId: EMBER_LIGHT_ID,
        label: 'Ember Crucible',
        revision: 1,
        transform: { schemaVersion: 1, position: [-3.4, 2.2, 0] },
        pointLight: { schemaVersion: 1, color: [1, 0.16, 0.04], radius: 6, power: 2.4 },
      },
      {
        entityId: ION_LIGHT_ID,
        label: 'Ion Prism',
        revision: 1,
        transform: { schemaVersion: 1, position: [0, 3.1, -0.5] },
        pointLight: { schemaVersion: 1, color: [0.06, 0.58, 1], radius: 7, power: 2.8 },
      },
      {
        entityId: VIOLET_LIGHT_ID,
        label: 'Violet Relay',
        revision: 1,
        transform: { schemaVersion: 1, position: [3.4, 2.2, 0] },
        pointLight: { schemaVersion: 1, color: [0.72, 0.12, 1], radius: 6, power: 2.2 },
      },
    ],
    renderBindings: EXPO_LIGHT_IDS.map((entityId, renderSlot) => ({ entityId, renderSlot })),
  });
}
