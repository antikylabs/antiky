import {
  EVENT_HISTORY_SCHEMA_VERSION,
  WORLD_INSPECTION_SCHEMA_VERSION,
  createEventHistory,
  createWorldInspection,
  type EventHistory,
  type WorldInspection,
} from '@antiky/framework';

import { EXPO_LIGHT_DEFINITIONS, EXPO_WORLD_ID } from './lights.ts';
import {
  CHARGE_FIELD_THRESHOLD,
  SAFE_FIELD_THRESHOLD,
  type RelayEvent,
  type RelaySnapshot,
} from './simulation.ts';

export const RELAY_CHAMBER_ID = '0197f27e-1000-7000-8000-000000000010';
export const RELAY_FORGE_ID = '0197f27e-1000-7000-8000-000000000011';
export const RELAY_PLAYER_ID = '0197f27e-1000-7000-8000-000000000012';
export const RELAY_PARTICLE_POOL_ID = '0197f27e-1000-7000-8000-000000000020';
export const RELAY_CHARGE_REGION_IDS = Object.freeze([
  '0197f27e-1000-7000-8000-000000000030',
  '0197f27e-1000-7000-8000-000000000031',
  '0197f27e-1000-7000-8000-000000000032',
]);
export const RELAY_SHADE_IDS = Object.freeze(Array.from(
  { length: 4 },
  (_, index) => `0197f27e-1000-7000-8000-${(0x101 + index).toString(16).padStart(12, '0')}`,
));
const EVENT_CAPACITY = 40;

type RetainedEvent = Readonly<{
  event: RelayEvent;
  sequence: number;
  occurredAt: string;
}>;

export type RelayInspectionModel = Readonly<{
  record(event: RelayEvent): void;
  world(snapshot: RelaySnapshot): WorldInspection;
  events(): EventHistory;
}>;

function count(value: number): { available: number; retained: number } {
  return { available: value, retained: value };
}

function eventEntityIds(event: RelayEvent): string[] {
  const ids = [RELAY_PLAYER_ID];
  if (event.relayIndex !== undefined) {
    ids.push(RELAY_CHARGE_REGION_IDS[event.relayIndex]!);
    if (
      event.type === 'relay.deposited'
      || event.type === 'relay.deposit-rejected'
      || event.type === 'relay.victory'
    ) ids.push(RELAY_FORGE_ID);
  }
  if (event.type === 'relay.deposit-rejected') ids.push(RELAY_FORGE_ID);
  if (event.shadeIndex !== undefined) ids.push(RELAY_SHADE_IDS[event.shadeIndex]!);
  if (event.type === 'relay.victory') ids.push(RELAY_FORGE_ID, ...RELAY_CHARGE_REGION_IDS);
  return [...new Set(ids)];
}

export function createRelayInspectionModel(runtimeInstanceId: string): RelayInspectionModel {
  const retained: RetainedEvent[] = [];
  let available = 0;

  const record = (event: RelayEvent): void => {
    available += 1;
    retained.push(Object.freeze({ event, sequence: available, occurredAt: new Date().toISOString() }));
    if (retained.length > EVENT_CAPACITY) retained.shift();
  };

  const world = (snapshot: RelaySnapshot): WorldInspection => {
    const entities = [
      {
        entityId: RELAY_CHAMBER_ID,
        label: 'Blackout Reliquary',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.blackout-relay',
          schemaVersion: 1,
          summary: `${snapshot.status} relay run ${snapshot.run}`,
          data: {
            status: snapshot.status,
            run: snapshot.run,
            elapsedSeconds: snapshot.time,
            deposited: snapshot.deposits.filter(Boolean).length,
          },
        }],
      },
      {
        entityId: RELAY_FORGE_ID,
        label: 'Reliquary Forge',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.relay-forge',
          schemaVersion: 1,
          summary: `${snapshot.deposits.filter(Boolean).length} of 3 prisms restored`,
          data: { deposits: snapshot.deposits, pulse: snapshot.forgePulse },
        }],
      },
      {
        entityId: RELAY_PLAYER_ID,
        label: 'Prism Drone',
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.prism-drone',
            schemaVersion: 1,
            summary: snapshot.player.safe ? 'Inside stable irradiance' : 'Exposed to blackout',
            data: {
              integrity: snapshot.integrity,
              irradiance: snapshot.player.irradiance,
              safe: snapshot.player.safe,
              chargeRelayIndex: snapshot.player.charge.relayIndex,
              charge: snapshot.player.charge.value,
            },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'World transform',
            data: { position: [snapshot.player.x, 0.52, snapshot.player.z] },
          },
        ],
      },
      ...EXPO_LIGHT_DEFINITIONS.map((light, index) => ({
        entityId: RELAY_CHARGE_REGION_IDS[index]!,
        label: `${light.label} Charge Region`,
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.relay-charge-region',
          schemaVersion: 1,
          summary: snapshot.deposits[index] ? 'Restored to the forge' : 'Available charge region',
          data: {
            deposited: snapshot.deposits[index],
            pointLightEntityId: light.entityId,
            position: light.transform.position,
            radius: light.pointLight.radius,
            safeThreshold: SAFE_FIELD_THRESHOLD,
            chargeThreshold: CHARGE_FIELD_THRESHOLD,
          },
        }],
      })),
      ...snapshot.shades.map((shade, index) => ({
        entityId: RELAY_SHADE_IDS[index]!,
        label: `Reliquary Shade ${String(index + 1).padStart(2, '0')}`,
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.irradiance-threat',
            schemaVersion: 1,
            summary: shade.mode === 'retreat' ? 'Repelled by point light' : 'Hunting in darkness',
            data: { mode: shade.mode, irradiance: shade.irradiance },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'World transform',
            data: { position: [shade.x, 0.48, shade.z] },
          },
        ],
      })),
      {
        entityId: RELAY_PARTICLE_POOL_ID,
        label: 'Relay Spark Pool',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.particle-pool',
          schemaVersion: 1,
          summary: 'Bounded relay feedback particles',
          data: {
            capacity: snapshot.particles.length,
            active: snapshot.particles.filter((particle) => particle.life > 0).length,
          },
        }],
      },
    ];
    const relationships = [
      RELAY_FORGE_ID,
      RELAY_PLAYER_ID,
      RELAY_PARTICLE_POOL_ID,
      ...RELAY_CHARGE_REGION_IDS,
      ...snapshot.shades.map((_, index) => RELAY_SHADE_IDS[index]!),
    ].map((childEntityId) => ({
      type: 'ChildOf' as const,
      childEntityId,
      parentEntityId: RELAY_CHAMBER_ID,
    }));
    const runtimeEntries = [
      {
        key: 'run',
        entityId: RELAY_CHAMBER_ID,
        data: { status: snapshot.status, run: snapshot.run, integrity: snapshot.integrity },
      },
      {
        key: 'player',
        entityId: RELAY_PLAYER_ID,
        data: {
          x: snapshot.player.x,
          z: snapshot.player.z,
          charge: snapshot.player.charge.value,
          chargeRelayIndex: snapshot.player.charge.relayIndex,
          irradiance: snapshot.player.irradiance,
        },
      },
      ...snapshot.shades.map((shade, index) => ({
        key: `shade-${index + 1}`,
        entityId: RELAY_SHADE_IDS[index]!,
        data: { x: shade.x, z: shade.z, mode: shade.mode, irradiance: shade.irradiance },
      })),
    ];
    const renderEntries = [
      { key: 'chamber', entityId: RELAY_CHAMBER_ID, data: { layer: 0, visible: true } },
      {
        key: 'relay-regions',
        entityId: RELAY_CHARGE_REGION_IDS[0]!,
        data: { layer: 1, count: 3, visible: true },
      },
      { key: 'forge', entityId: RELAY_FORGE_ID, data: { layer: 2, visible: true } },
      ...(snapshot.shades.length === 0 ? [] : [{
        key: 'shades',
        entityId: RELAY_SHADE_IDS[0]!,
        data: { layer: 3, count: snapshot.shades.length, visible: true },
      }]),
      { key: 'player', entityId: RELAY_PLAYER_ID, data: { layer: 4, visible: true } },
      {
        key: 'sparks',
        entityId: RELAY_PARTICLE_POOL_ID,
        data: { layer: 5, active: snapshot.particles.filter((particle) => particle.life > 0).length },
      },
    ];
    const componentCount = entities.reduce((total, entity) => total + entity.components.length, 0);
    return createWorldInspection({
      schemaVersion: WORLD_INSPECTION_SCHEMA_VERSION,
      owner: 'framework',
      worldId: EXPO_WORLD_ID,
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
          storeId: 'antiky.blackout-relay.runtime',
          label: 'Blackout Relay runtime',
          kind: 'runtime',
          incomplete: false,
          counts: count(runtimeEntries.length),
          entries: runtimeEntries,
        },
        {
          storeId: 'antiky.blackout-relay.render',
          label: 'Blackout Relay render projection',
          kind: 'render',
          incomplete: false,
          counts: count(renderEntries.length),
          entries: renderEntries,
        },
      ],
    });
  };

  const events = (): EventHistory => createEventHistory({
    schemaVersion: EVENT_HISTORY_SCHEMA_VERSION,
    owner: 'framework',
    sourceId: 'antiky.blackout-relay-simulation',
    worldId: EXPO_WORLD_ID,
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
      commandId: `0197f27e-2000-7000-8000-${sequence.toString(16).padStart(12, '0')}`,
      worldId: EXPO_WORLD_ID,
      entityIds: eventEntityIds(event),
      revision: sequence,
      occurredAt,
      data: {
        value: event.value,
        ...(event.relayIndex === undefined ? {} : { relayIndex: event.relayIndex }),
        ...(event.shadeIndex === undefined ? {} : { shadeIndex: event.shadeIndex }),
      },
    })),
  });

  return Object.freeze({ record, world, events });
}
