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

export const EXPO_LIGHT_DEFINITIONS = Object.freeze([
  Object.freeze({
    entityId: EMBER_LIGHT_ID,
    label: 'Amber Root Relay',
    transform: Object.freeze({ schemaVersion: 1 as const, position: [-5.2, 2.15, -2.7] as const }),
    pointLight: Object.freeze({
      schemaVersion: 1 as const,
      color: [1, 0.38, 0.1] as const,
      radius: 3.55,
      power: 3.4,
    }),
  }),
  Object.freeze({
    entityId: ION_LIGHT_ID,
    label: 'Rain-Glass Relay',
    transform: Object.freeze({ schemaVersion: 1 as const, position: [0.7, 2.35, -4] as const }),
    pointLight: Object.freeze({
      schemaVersion: 1 as const,
      color: [0.16, 0.58, 0.92] as const,
      radius: 3.45,
      power: 3.6,
    }),
  }),
  Object.freeze({
    entityId: VIOLET_LIGHT_ID,
    label: 'Plum Reliquary Relay',
    transform: Object.freeze({ schemaVersion: 1 as const, position: [5.15, 2.05, 2.4] as const }),
    pointLight: Object.freeze({
      schemaVersion: 1 as const,
      color: [0.63, 0.2, 0.5] as const,
      radius: 3.5,
      power: 3.2,
    }),
  }),
]);

export function createExpoLightService(runtimeInstanceId: string): PointLightAuthoringService {
  return createPointLightAuthoringService({
    worldId: EXPO_WORLD_ID,
    runtimeInstanceId,
    pointLights: EXPO_LIGHT_DEFINITIONS.map((definition) => ({
      ...definition,
      revision: 1,
    })),
    renderBindings: EXPO_LIGHT_IDS.map((entityId, renderSlot) => ({ entityId, renderSlot })),
  });
}
