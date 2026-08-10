import {
  EVENT_HISTORY_SCHEMA_VERSION,
  WORLD_INSPECTION_SCHEMA_VERSION,
  createEventHistory,
  createWorldInspection,
  type EventHistory,
  type WorldInspection,
} from '@antiky/framework';

import {
  TRAVERSAL_CATALOG_ID,
  TRAVERSAL_PRESENTATION_CATALOG_ID,
} from './asset-catalog.ts';

import {
  COURSE_CHECKPOINTS,
  COURSE_COLLECTIBLES,
  COURSE_HAZARDS,
  COURSE_LENGTH,
  COURSE_PLATFORMS,
  DELIVERY_X,
  hazardTop,
  platformTop,
} from './course.ts';
import {
  COYOTE_SECONDS,
  GROUND_ACCELERATION,
  JUMP_BUFFER_SECONDS,
  JUMP_RELEASE_VELOCITY_MULTIPLIER,
  MANUAL_TOP_SPEED,
  MAX_PARCEL_SEALS,
  RESET_RECOVERY_SECONDS,
  STORM_DURATION_SECONDS,
  type TraversalEvent,
  type TraversalSnapshot,
} from './simulation.ts';

export const TRAVERSAL_WORLD_ID = '01991e00-1000-7000-8000-000000000001';
export const TRAVERSAL_ROOT_ID = '01991e00-1000-7000-8000-000000000010';
export const TRAVERSAL_PLAYER_ID = '01991e00-1000-7000-8000-000000000011';
export const TRAVERSAL_COURSE_ID = '01991e00-1000-7000-8000-000000000012';
export const TRAVERSAL_HAZARDS_ID = '01991e00-1000-7000-8000-000000000013';
export const TRAVERSAL_CHECKPOINT_ID = '01991e00-1000-7000-8000-000000000014';
export const TRAVERSAL_PARCEL_ID = '01991e00-1000-7000-8000-000000000015';
export const TRAVERSAL_STORM_ID = '01991e00-1000-7000-8000-000000000016';
export const TRAVERSAL_DELIVERY_ID = '01991e00-1000-7000-8000-000000000017';
const id = (value: number): string => `01991e00-1000-7000-8000-${value.toString(16).padStart(12, '0')}`;
export const TRAVERSAL_PLATFORM_IDS = Object.freeze(COURSE_PLATFORMS.map((_, index) => id(0x101 + index)));
export const TRAVERSAL_HAZARD_IDS = Object.freeze(COURSE_HAZARDS.map((_, index) => id(0x201 + index)));
export const TRAVERSAL_CHECKPOINT_IDS = Object.freeze(COURSE_CHECKPOINTS.map((_, index) => id(0x301 + index)));
export const TRAVERSAL_COLLECTIBLE_IDS = Object.freeze(COURSE_COLLECTIBLES.map((_, index) => id(0x401 + index)));
const EVENT_CAPACITY = 64;

type RetainedEvent = Readonly<{ event: TraversalEvent; sequence: number; occurredAt: string }>;

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
        label: 'Gale Post / Skyline Relay',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.traversal-world',
          schemaVersion: 1,
          summary: `Act ${snapshot.act}, ${snapshot.outcome}, ${snapshot.controlMode} control`,
          data: {
            fantasy: 'Coastal courier relay',
            act: snapshot.act,
            outcome: snapshot.outcome,
            controlMode: snapshot.controlMode,
            attempt: snapshot.attempt,
            finiteCourseLength: COURSE_LENGTH,
            progress: snapshot.progress,
            damagedHazardMask: snapshot.damagedHazardMask,
          },
        }],
      },
      {
        entityId: TRAVERSAL_PLAYER_ID,
        label: 'Gale Post Courier',
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.character-controller',
            schemaVersion: 1,
            summary: snapshot.player.grounded ? 'Grounded courier' : 'Airborne courier',
            data: {
              velocity: [snapshot.player.vx, snapshot.player.vy],
              grounded: snapshot.player.grounded,
              controlMode: snapshot.controlMode,
              coyoteSeconds: COYOTE_SECONDS,
              jumpBufferSeconds: JUMP_BUFFER_SECONDS,
              jumpReleaseVelocityMultiplier: JUMP_RELEASE_VELOCITY_MULTIPLIER,
              groundAcceleration: GROUND_ACCELERATION,
              manualTopSpeed: MANUAL_TOP_SPEED,
              resetRecoverySeconds: RESET_RECOVERY_SECONDS,
              jumps: snapshot.jumps,
              falls: snapshot.falls,
            },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'Authoritative world transform',
            data: { position: [snapshot.player.x, snapshot.player.y, 0] },
          },
        ],
      },
      {
        entityId: TRAVERSAL_COURSE_ID,
        label: 'Three-act Relay Course',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.platform-course',
          schemaVersion: 1,
          summary: `Finite authored course, currently act ${snapshot.act}`,
          data: { platformCount: COURSE_PLATFORMS.length, courseLength: COURSE_LENGTH, deliveryX: DELIVERY_X, act: snapshot.act },
        }],
      },
      ...COURSE_PLATFORMS.map((platform, index) => ({
        entityId: TRAVERSAL_PLATFORM_IDS[index]!,
        label: platform.label,
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.authored-platform',
            schemaVersion: 1,
            summary: `${platform.asset} platform in act ${platform.act}`,
            data: { id: platform.id, act: platform.act, width: platform.width, amplitude: platform.amplitude, speed: platform.speed, asset: platform.asset },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'Current platform transform',
            data: { position: [platform.x, platformTop(platform, snapshot.time), 0] },
          },
        ],
      })),
      {
        entityId: TRAVERSAL_HAZARDS_ID,
        label: 'Course Hazards',
        revision: snapshot.revision,
        components: [{ typeId: 'antiky.hazard-set', schemaVersion: 1, summary: `${COURSE_HAZARDS.length} authored spike hazards`, data: { count: COURSE_HAZARDS.length, damagedHazardMask: snapshot.damagedHazardMask } }],
      },
      ...COURSE_HAZARDS.map((hazard, index) => ({
        entityId: TRAVERSAL_HAZARD_IDS[index]!,
        label: hazard.label,
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.parcel-damage-hazard',
            schemaVersion: 1,
            summary: (snapshot.damagedHazardMask & (1 << index)) === 0
              ? 'Armed; costs one parcel seal on contact'
              : 'Disarmed for this attempt after contact',
            data: {
              id: hazard.id,
              act: hazard.act,
              width: hazard.width,
              sealCost: 1,
              armed: snapshot.outcome === 'running' && (snapshot.damagedHazardMask & (1 << index)) === 0,
            },
          },
          { typeId: 'antiky.transform', schemaVersion: 1, summary: 'Current hazard transform', data: { position: [hazard.x, hazardTop(hazard, snapshot.time), 0] } },
        ],
      })),
      {
        entityId: TRAVERSAL_CHECKPOINT_ID,
        label: 'Relay Checkpoints',
        revision: snapshot.revision,
        components: [{ typeId: 'antiky.checkpoint-set', schemaVersion: 1, summary: `Checkpoint ${snapshot.checkpointIndex + 1} of ${COURSE_CHECKPOINTS.length}`, data: { activeIndex: snapshot.checkpointIndex, count: COURSE_CHECKPOINTS.length } }],
      },
      ...COURSE_CHECKPOINTS.map((checkpoint, index) => ({
        entityId: TRAVERSAL_CHECKPOINT_IDS[index]!,
        label: checkpoint.label,
        revision: snapshot.revision,
        components: [
          { typeId: 'antiky.relay-checkpoint', schemaVersion: 1, summary: index === snapshot.checkpointIndex ? 'Active respawn checkpoint' : index < snapshot.checkpointIndex ? 'Reached checkpoint' : 'Pending checkpoint', data: { id: checkpoint.id, act: checkpoint.act, index, active: index === snapshot.checkpointIndex, reached: index <= snapshot.checkpointIndex } },
          { typeId: 'antiky.transform', schemaVersion: 1, summary: 'Checkpoint transform', data: { position: [checkpoint.x, courseTop(checkpoint.x, snapshot.time), 0] } },
        ],
      })),
      ...COURSE_COLLECTIBLES.map((collectible, index) => ({
        entityId: TRAVERSAL_COLLECTIBLE_IDS[index]!,
        label: collectible.label,
        revision: snapshot.revision,
        components: [
          { typeId: 'antiky.delivery-seal-collectible', schemaVersion: 1, summary: snapshot.collectedSeal ? 'Collected' : 'Available', data: { id: collectible.id, act: collectible.act, collected: snapshot.collectedSeal, restoresParcelSeal: true } },
          { typeId: 'antiky.transform', schemaVersion: 1, summary: 'Collectible transform', data: { position: [collectible.x, collectible.y, 0] } },
        ],
      })),
      {
        entityId: TRAVERSAL_PARCEL_ID,
        label: 'Vermilion Parcel',
        revision: snapshot.revision,
        components: [{ typeId: 'antiky.parcel-seals', schemaVersion: 1, summary: `${snapshot.parcelSeals} of ${MAX_PARCEL_SEALS} seals intact`, data: { remaining: snapshot.parcelSeals, maximum: MAX_PARCEL_SEALS, collectedDeliverySeal: snapshot.collectedSeal } }],
      },
      {
        entityId: TRAVERSAL_STORM_ID,
        label: 'Incoming Coastal Storm',
        revision: snapshot.revision,
        components: [{ typeId: 'antiky.storm-timer', schemaVersion: 1, summary: `${snapshot.remainingTime.toFixed(1)} seconds remaining`, data: { durationSeconds: STORM_DURATION_SECONDS, elapsedSeconds: snapshot.attemptTime, remainingSeconds: snapshot.remainingTime, storm: snapshot.storm, expired: snapshot.failureReason === 'storm' } }],
      },
      {
        entityId: TRAVERSAL_DELIVERY_ID,
        label: 'Skyline Relay Gate',
        revision: snapshot.revision,
        components: [{ typeId: 'antiky.delivery-outcome', schemaVersion: 1, summary: snapshot.outcome, data: { outcome: snapshot.outcome, failureReason: snapshot.failureReason, deliveryX: DELIVERY_X, retryAvailable: snapshot.outcome !== 'running' } }],
      },
    ];

    const relationships = [
      TRAVERSAL_PLAYER_ID,
      TRAVERSAL_COURSE_ID,
      TRAVERSAL_HAZARDS_ID,
      TRAVERSAL_CHECKPOINT_ID,
      TRAVERSAL_PARCEL_ID,
      TRAVERSAL_STORM_ID,
      TRAVERSAL_DELIVERY_ID,
      ...TRAVERSAL_COLLECTIBLE_IDS,
    ].map((childEntityId) => ({ type: 'ChildOf' as const, childEntityId, parentEntityId: TRAVERSAL_ROOT_ID }))
      .concat(TRAVERSAL_PLATFORM_IDS.map((childEntityId) => ({ type: 'ChildOf' as const, childEntityId, parentEntityId: TRAVERSAL_COURSE_ID })))
      .concat(TRAVERSAL_HAZARD_IDS.map((childEntityId) => ({ type: 'ChildOf' as const, childEntityId, parentEntityId: TRAVERSAL_HAZARDS_ID })))
      .concat(TRAVERSAL_CHECKPOINT_IDS.map((childEntityId) => ({ type: 'ChildOf' as const, childEntityId, parentEntityId: TRAVERSAL_CHECKPOINT_ID })));

    const runtimeEntries = [
      { key: 'courier', entityId: TRAVERSAL_PLAYER_ID, data: { position: [snapshot.player.x, snapshot.player.y], velocity: [snapshot.player.vx, snapshot.player.vy], grounded: snapshot.player.grounded, act: snapshot.act, controlMode: snapshot.controlMode } },
      { key: 'parcel', entityId: TRAVERSAL_PARCEL_ID, data: { seals: snapshot.parcelSeals, collectedSeal: snapshot.collectedSeal } },
      { key: 'storm', entityId: TRAVERSAL_STORM_ID, data: { remainingSeconds: snapshot.remainingTime, level: snapshot.storm } },
      { key: 'delivery', entityId: TRAVERSAL_DELIVERY_ID, data: { progress: snapshot.progress, outcome: snapshot.outcome, failureReason: snapshot.failureReason, attempt: snapshot.attempt } },
      ...COURSE_PLATFORMS.map((platform, index) => ({ key: `platform-${platform.id}`, entityId: TRAVERSAL_PLATFORM_IDS[index]!, data: { currentTop: platformTop(platform, snapshot.time) } })),
      ...COURSE_HAZARDS.map((hazard, index) => ({
        key: `hazard-${hazard.id}`,
        entityId: TRAVERSAL_HAZARD_IDS[index]!,
        data: {
          armed: snapshot.outcome === 'running' && (snapshot.damagedHazardMask & (1 << index)) === 0,
          consumedThisAttempt: (snapshot.damagedHazardMask & (1 << index)) !== 0,
          sealCost: 1,
          currentTop: hazardTop(hazard, snapshot.time),
        },
      })),
      ...COURSE_CHECKPOINTS.map((checkpoint, index) => ({ key: `checkpoint-${checkpoint.id}`, entityId: TRAVERSAL_CHECKPOINT_IDS[index]!, data: { active: index === snapshot.checkpointIndex, reached: index <= snapshot.checkpointIndex } })),
      ...COURSE_COLLECTIBLES.map((collectible, index) => ({ key: `collectible-${collectible.id}`, entityId: TRAVERSAL_COLLECTIBLE_IDS[index]!, data: { collected: snapshot.collectedSeal } })),
    ];
    const renderEntries = [
      { key: 'courier', entityId: TRAVERSAL_PLAYER_ID, data: { layer: 5, visible: true, catalog: TRAVERSAL_PRESENTATION_CATALOG_ID, asset: 'courier.glb' } },
      {
        key: 'environment',
        entityId: TRAVERSAL_ROOT_ID,
        data: {
          layer: 1,
          visible: true,
          catalogs: [
            {
              catalogId: TRAVERSAL_PRESENTATION_CATALOG_ID,
              assets: ['cloud-small.glb', 'cloud-large.glb', 'coastal-cliff.glb', 'coastal-tree.glb', 'relay-tower.glb'],
            },
            { catalogId: TRAVERSAL_CATALOG_ID, assets: ['tree.glb'] },
          ],
        },
      },
      { key: 'course', entityId: TRAVERSAL_COURSE_ID, data: { layer: 2, visible: true, catalog: TRAVERSAL_CATALOG_ID } },
      { key: 'hazards', entityId: TRAVERSAL_HAZARDS_ID, data: { layer: 4, visible: true, asset: 'trap-spikes.glb' } },
      { key: 'checkpoints', entityId: TRAVERSAL_CHECKPOINT_ID, data: { layer: 4, visible: true, asset: 'flag.glb' } },
      { key: 'collectible', entityId: TRAVERSAL_COLLECTIBLE_IDS[0]!, data: { layer: 4, visible: !snapshot.collectedSeal, asset: 'coin-gold.glb' } },
      { key: 'gauges', entityId: TRAVERSAL_ROOT_ID, data: { layer: 6, visible: true, geometryHud: true } },
    ];
    const componentCount = entities.reduce((total, entity) => total + entity.components.length, 0);
    return createWorldInspection({
      schemaVersion: WORLD_INSPECTION_SCHEMA_VERSION,
      owner: 'framework',
      worldId: TRAVERSAL_WORLD_ID,
      runtimeInstanceId,
      revision: snapshot.revision,
      incomplete: false,
      counts: { entities: count(entities.length), components: count(componentCount), relationships: count(relationships.length), stores: count(2) },
      entities,
      relationships,
      stores: [
        { storeId: 'antiky.traversal.render', label: 'BroMetal presentation projection', kind: 'render', incomplete: false, counts: count(renderEntries.length), entries: renderEntries },
        { storeId: 'antiky.traversal.runtime', label: 'Authoritative traversal runtime', kind: 'runtime', incomplete: false, counts: count(runtimeEntries.length), entries: runtimeEntries },
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
    retention: { lifetime: 'runtime-instance', storage: 'memory', overflow: 'drop-oldest', capacity: EVENT_CAPACITY, droppedCount: available - retained.length },
    events: retained.map(({ event, sequence, occurredAt }) => ({
      eventSchemaVersion: 1,
      type: event.type,
      sequence,
      commandId: `01991e00-2000-7000-8000-${sequence.toString(16).padStart(12, '0')}`,
      worldId: TRAVERSAL_WORLD_ID,
      entityIds: eventEntityIds(event),
      revision: sequence,
      occurredAt,
      data: eventData(event),
    })),
  });

  return Object.freeze({ record, world, events });
}

function courseTop(x: number, time: number): number {
  const platform = COURSE_PLATFORMS.find((entry) => Math.abs(x - entry.x) <= entry.width * 0.5);
  return platform === undefined ? 0 : platformTop(platform, time);
}

function eventEntityIds(event: TraversalEvent): string[] {
  const ids = [TRAVERSAL_PLAYER_ID];
  if (event.platformIndex !== undefined) ids.push(TRAVERSAL_PLATFORM_IDS[event.platformIndex]!);
  if (event.hazardIndex !== undefined) ids.push(TRAVERSAL_HAZARD_IDS[event.hazardIndex]!);
  if (event.checkpointIndex !== undefined) ids.push(TRAVERSAL_CHECKPOINT_IDS[event.checkpointIndex]!);
  if (event.collectibleIndex !== undefined) ids.push(TRAVERSAL_COLLECTIBLE_IDS[event.collectibleIndex]!);
  if (event.type === 'traversal.seal-lost') ids.push(TRAVERSAL_PARCEL_ID);
  if (event.type === 'traversal.seal-collected') ids.push(TRAVERSAL_PARCEL_ID);
  if (event.type === 'traversal.storm-warning') ids.push(TRAVERSAL_STORM_ID);
  if (event.type === 'traversal.failure' && event.reason === 'parcel-seals') ids.push(TRAVERSAL_PARCEL_ID);
  if (event.type === 'traversal.failure' && event.reason === 'storm') ids.push(TRAVERSAL_STORM_ID);
  if (event.type === 'traversal.delivery' || event.type === 'traversal.failure' || event.type === 'traversal.retry') ids.push(TRAVERSAL_DELIVERY_ID);
  return ids;
}

function eventData(event: TraversalEvent): Record<string, string | number> {
  return {
    value: event.value,
    ...(event.act === undefined ? {} : { act: event.act }),
    ...(event.reason === undefined ? {} : { reason: event.reason }),
    ...(event.controlMode === undefined ? {} : { controlMode: event.controlMode }),
    ...(event.platformIndex === undefined ? {} : { platformIndex: event.platformIndex }),
    ...(event.hazardIndex === undefined ? {} : { hazardIndex: event.hazardIndex }),
    ...(event.checkpointIndex === undefined ? {} : { checkpointIndex: event.checkpointIndex }),
    ...(event.collectibleIndex === undefined ? {} : { collectibleIndex: event.collectibleIndex }),
  };
}
