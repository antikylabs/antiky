import {
  EVENT_HISTORY_SCHEMA_VERSION,
  WORLD_INSPECTION_SCHEMA_VERSION,
  createEventHistory,
  createWorldInspection,
  type EventHistory,
  type WorldInspection,
} from '@antiky/framework';
import {
  COURSE_HAZARDS,
  COURSE_PLATFORMS,
  platformTop,
  type TraversalEvent,
  type TraversalSnapshot,
} from './simulation.ts';

export const TRAVERSAL_WORLD_ID = '01991e00-1000-7000-8000-000000000001';
export const TRAVERSAL_ROOT_ID = '01991e00-1000-7000-8000-000000000010';
export const TRAVERSAL_PLAYER_ID = '01991e00-1000-7000-8000-000000000011';
export const TRAVERSAL_COURSE_ID = '01991e00-1000-7000-8000-000000000012';
export const TRAVERSAL_HAZARDS_ID = '01991e00-1000-7000-8000-000000000013';
export const TRAVERSAL_CHECKPOINT_ID = '01991e00-1000-7000-8000-000000000014';
export const TRAVERSAL_PLATFORM_IDS = Object.freeze(COURSE_PLATFORMS.map(
  (_, index) => `01991e00-1000-7000-8000-${(0x101 + index).toString(16).padStart(12, '0')}`,
));
const EVENT_CAPACITY = 32;

type RetainedEvent = Readonly<{
  event: TraversalEvent;
  sequence: number;
  occurredAt: string;
}>;

export type TraversalInspectionModel = Readonly<{
  record(event: TraversalEvent): void;
  world(snapshot: TraversalSnapshot): WorldInspection;
  events(): EventHistory;
}>;

function count(value: number): { available: number; retained: number } {
  return { available: value, retained: value };
}

export function createTraversalInspectionModel(runtimeInstanceId: string): TraversalInspectionModel {
  const retained: RetainedEvent[] = [];
  let available = 0;

  const record = (event: TraversalEvent): void => {
    available += 1;
    retained.push(Object.freeze({ event, sequence: available, occurredAt: new Date().toISOString() }));
    if (retained.length > EVENT_CAPACITY) retained.shift();
  };

  const world = (snapshot: TraversalSnapshot): WorldInspection => {
    const entities = [
      {
        entityId: TRAVERSAL_ROOT_ID,
        label: 'Skyline Relay',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.traversal-world',
          schemaVersion: 1,
          summary: `Traversal course, lap ${snapshot.laps + 1}`,
          data: { courseLength: 36, distance: snapshot.distance, laps: snapshot.laps },
        }],
      },
      {
        entityId: TRAVERSAL_PLAYER_ID,
        label: 'Relay Runner',
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.character-controller',
            schemaVersion: 1,
            summary: snapshot.player.grounded ? 'Grounded runner' : 'Airborne runner',
            data: {
              velocity: [snapshot.player.vx, snapshot.player.vy],
              grounded: snapshot.player.grounded,
              jumps: snapshot.jumps,
              falls: snapshot.falls,
            },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'World transform',
            data: { position: [snapshot.player.x, snapshot.player.y, 0] },
          },
        ],
      },
      {
        entityId: TRAVERSAL_COURSE_ID,
        label: 'Floating Platform Course',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.platform-course',
          schemaVersion: 1,
          summary: 'Repeating authored platform sequence',
          data: { platformCount: COURSE_PLATFORMS.length, repeatLength: 36 },
        }],
      },
      ...COURSE_PLATFORMS.map((platform, index) => ({
        entityId: TRAVERSAL_PLATFORM_IDS[index]!,
        label: `Platform ${String(index + 1).padStart(2, '0')}`,
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.moving-platform',
            schemaVersion: 1,
            summary: platform.amplitude > 0 ? 'Animated platform' : 'Static platform',
            data: {
              width: platform.width,
              baseTop: platform.top,
              amplitude: platform.amplitude,
              speed: platform.speed,
              accent: platform.accent,
            },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'Course-local transform',
            data: { position: [platform.x, platformTop(platform, snapshot.time), 0] },
          },
        ],
      })),
      {
        entityId: TRAVERSAL_HAZARDS_ID,
        label: 'Prism Hazards',
        revision: 1,
        components: [{
          typeId: 'antiky.hazard-set',
          schemaVersion: 1,
          summary: 'Repeating spike hazards',
          data: { positions: COURSE_HAZARDS.map((hazard) => hazard.x) },
        }],
      },
      {
        entityId: TRAVERSAL_CHECKPOINT_ID,
        label: 'Relay Checkpoints',
        revision: snapshot.laps + 1,
        components: [{
          typeId: 'antiky.checkpoint-set',
          schemaVersion: 1,
          summary: 'Course restart and lap gates',
          data: { positions: [0, 19.6, 36] },
        }],
      },
    ];
    const relationships = [
      TRAVERSAL_PLAYER_ID,
      TRAVERSAL_COURSE_ID,
      TRAVERSAL_HAZARDS_ID,
      TRAVERSAL_CHECKPOINT_ID,
    ].map((childEntityId) => ({
      type: 'ChildOf' as const,
      childEntityId,
      parentEntityId: TRAVERSAL_ROOT_ID,
    })).concat(TRAVERSAL_PLATFORM_IDS.map((childEntityId) => ({
      type: 'ChildOf' as const,
      childEntityId,
      parentEntityId: TRAVERSAL_COURSE_ID,
    })));
    const runtimeEntries = [
      {
        key: 'runner',
        entityId: TRAVERSAL_PLAYER_ID,
        data: {
          position: [snapshot.player.x, snapshot.player.y],
          velocity: [snapshot.player.vx, snapshot.player.vy],
          grounded: snapshot.player.grounded,
        },
      },
      ...COURSE_PLATFORMS.map((platform, index) => ({
        key: `platform-${index + 1}`,
        entityId: TRAVERSAL_PLATFORM_IDS[index]!,
        data: { currentTop: platformTop(platform, snapshot.time) },
      })),
    ];
    const renderEntries = [
      { key: 'runner', entityId: TRAVERSAL_PLAYER_ID, data: { layer: 4, visible: true } },
      { key: 'course', entityId: TRAVERSAL_COURSE_ID, data: { layer: 2, visible: true } },
      { key: 'hazards', entityId: TRAVERSAL_HAZARDS_ID, data: { layer: 3, visible: true } },
      { key: 'checkpoints', entityId: TRAVERSAL_CHECKPOINT_ID, data: { layer: 3, visible: true } },
    ];
    const componentCount = entities.reduce((total, entity) => total + entity.components.length, 0);
    return createWorldInspection({
      schemaVersion: WORLD_INSPECTION_SCHEMA_VERSION,
      owner: 'framework',
      worldId: TRAVERSAL_WORLD_ID,
      runtimeInstanceId,
      revision: snapshot.revision,
      incomplete: false,
      counts: {
        entities: count(entities.length),
        components: count(componentCount),
        relationships: count(relationships.length),
        stores: count(2),
      },
      entities,
      relationships,
      stores: [
        {
          storeId: 'antiky.traversal.render',
          label: 'Traversal render projection',
          kind: 'render',
          incomplete: false,
          counts: count(renderEntries.length),
          entries: renderEntries,
        },
        {
          storeId: 'antiky.traversal.runtime',
          label: 'Traversal runtime',
          kind: 'runtime',
          incomplete: false,
          counts: count(runtimeEntries.length),
          entries: runtimeEntries,
        },
      ],
    });
  };

  const events = (): EventHistory => createEventHistory({
    schemaVersion: EVENT_HISTORY_SCHEMA_VERSION,
    owner: 'framework',
    sourceId: 'antiky.traversal-simulation',
    worldId: TRAVERSAL_WORLD_ID,
    runtimeInstanceId,
    incomplete: available > retained.length,
    counts: { available, retained: retained.length },
    retention: {
      lifetime: 'runtime-instance',
      storage: 'memory',
      overflow: 'drop-oldest',
      capacity: EVENT_CAPACITY,
      droppedCount: available - retained.length,
    },
    events: retained.map(({ event, sequence, occurredAt }) => ({
      eventSchemaVersion: 1,
      type: event.type,
      sequence,
      commandId: `01991e00-2000-7000-8000-${sequence.toString(16).padStart(12, '0')}`,
      worldId: TRAVERSAL_WORLD_ID,
      entityIds: event.platformIndex === undefined
        ? [TRAVERSAL_PLAYER_ID]
        : [TRAVERSAL_PLAYER_ID, TRAVERSAL_PLATFORM_IDS[event.platformIndex]!],
      revision: sequence,
      occurredAt,
      data: { value: event.value },
    })),
  });

  return Object.freeze({ record, world, events });
}
