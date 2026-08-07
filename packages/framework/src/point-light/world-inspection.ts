import {
  EVENT_HISTORY_SCHEMA_VERSION,
  createEventHistory,
  type EventHistory,
} from '../inspection/events.ts';
import {
  WORLD_INSPECTION_SCHEMA_VERSION,
  createWorldInspection,
  type WorldInspection,
} from '../inspection/world.ts';
import {
  MAX_POINT_LIGHT_POWER_FACTS,
} from './commands.ts';
import {
  createPointLightInspection,
  inspectPointLightService,
  type PointLightInspection,
} from './inspection.ts';
import type { PointLightAuthoringService } from './service.ts';

export const POINT_LIGHT_AUTHORING_STORE_ID = 'antiky.point-lights.authoring' as const;
export const POINT_LIGHT_RUNTIME_STORE_ID = 'antiky.point-lights.runtime' as const;
export const POINT_LIGHT_RENDER_STORE_ID = 'antiky.point-lights.render' as const;
export const POINT_LIGHT_EVENT_SOURCE_ID = 'antiky.point-light-authoring' as const;
export const TRANSFORM_COMPONENT_TYPE_ID = 'antiky.transform' as const;
export const POINT_LIGHT_COMPONENT_TYPE_ID = 'antiky.point-light' as const;

export type PointLightWorldViews = Readonly<{
  world: WorldInspection;
  events: EventHistory;
}>;

function count(value: number): { available: number; retained: number } {
  return { available: value, retained: value };
}

export function createPointLightWorldViews(input: unknown): PointLightWorldViews {
  const pointLights: PointLightInspection = createPointLightInspection(input);
  const dirtySlots = new Set(pointLights.render.dirtySlots);

  const entities = pointLights.authoring.map((pointLight) => ({
    entityId: pointLight.entityId,
    label: pointLight.label,
    revision: pointLight.revision,
    components: [
      {
        typeId: TRANSFORM_COMPONENT_TYPE_ID,
        schemaVersion: pointLight.transform.schemaVersion,
        summary: 'Transform',
        data: pointLight.transform,
      },
      {
        typeId: POINT_LIGHT_COMPONENT_TYPE_ID,
        schemaVersion: pointLight.pointLight.schemaVersion,
        summary: 'Point light',
        data: pointLight.pointLight,
      },
    ],
  }));
  const authoringEntries = pointLights.authoring.map((pointLight) => ({
    key: pointLight.entityId,
    entityId: pointLight.entityId,
    data: {
      label: pointLight.label,
      revision: pointLight.revision,
      transform: pointLight.transform,
      pointLight: pointLight.pointLight,
    },
  }));
  const runtimeEntries = pointLights.runtime.pointLights.map((pointLight) => ({
    key: pointLight.entityId,
    entityId: pointLight.entityId,
    data: {
      revision: pointLight.revision,
      power: pointLight.power,
    },
  }));
  const renderEntries = pointLights.render.pointLights.map((pointLight) => ({
    key: pointLight.entityId,
    entityId: pointLight.entityId,
    data: {
      renderSlot: pointLight.renderSlot,
      revision: pointLight.revision,
      power: pointLight.power,
      dirty: dirtySlots.has(pointLight.renderSlot),
    },
  }));

  const world = createWorldInspection({
    schemaVersion: WORLD_INSPECTION_SCHEMA_VERSION,
    owner: 'framework',
    worldId: pointLights.worldId,
    runtimeInstanceId: pointLights.runtime.instanceId,
    revision: pointLights.eventSequence,
    incomplete: false,
    counts: {
      entities: count(entities.length),
      components: count(entities.length * 2),
      relationships: count(0),
      stores: count(3),
    },
    entities,
    relationships: [],
    stores: [
      {
        storeId: POINT_LIGHT_AUTHORING_STORE_ID,
        label: 'Point-light authoring',
        kind: 'authoring',
        incomplete: false,
        counts: count(authoringEntries.length),
        entries: authoringEntries,
      },
      {
        storeId: POINT_LIGHT_RUNTIME_STORE_ID,
        label: 'Point-light runtime',
        kind: 'runtime',
        incomplete: false,
        counts: count(runtimeEntries.length),
        entries: runtimeEntries,
      },
      {
        storeId: POINT_LIGHT_RENDER_STORE_ID,
        label: 'Point-light render',
        kind: 'render',
        incomplete: false,
        counts: count(renderEntries.length),
        entries: renderEntries,
      },
    ],
  });

  const events = createEventHistory({
    schemaVersion: EVENT_HISTORY_SCHEMA_VERSION,
    owner: 'framework',
    sourceId: POINT_LIGHT_EVENT_SOURCE_ID,
    worldId: pointLights.worldId,
    runtimeInstanceId: pointLights.runtime.instanceId,
    incomplete: false,
    counts: count(pointLights.facts.length),
    retention: {
      lifetime: 'runtime-instance',
      storage: 'memory',
      overflow: 'reject-new',
      capacity: MAX_POINT_LIGHT_POWER_FACTS,
      droppedCount: 0,
    },
    events: pointLights.facts.map((fact) => ({
      eventSchemaVersion: fact.schemaVersion,
      type: fact.type,
      sequence: fact.eventSequence,
      commandId: fact.sourceCommandId,
      worldId: fact.worldId,
      entityIds: [fact.entityId],
      revision: fact.resultingRevision,
      occurredAt: fact.receivedAt,
      data: {
        oldPower: fact.oldPower,
        newPower: fact.newPower,
        ...(fact.correctionOf === undefined ? {} : { correctionOf: fact.correctionOf }),
      },
    })),
  });

  return Object.freeze({ world, events });
}

export function inspectPointLightWorld(
  service: PointLightAuthoringService,
): PointLightWorldViews {
  return createPointLightWorldViews(inspectPointLightService(service));
}
