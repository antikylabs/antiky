import {
  EVENT_HISTORY_SCHEMA_VERSION,
  WORLD_INSPECTION_SCHEMA_VERSION,
  createEventHistory,
  createWorldInspection,
  type EventHistory,
  type WorldInspection,
} from '@antiky/framework';
import type { CombatEvent, CombatSnapshot } from './simulation.ts';

export const COMBAT_WORLD_ID = '01991d00-1000-7000-8000-000000000001';
export const COMBAT_ARENA_ID = '01991d00-1000-7000-8000-000000000010';
export const COMBAT_PLAYER_ID = '01991d00-1000-7000-8000-000000000011';
export const COMBAT_SQUAD_ID = '01991d00-1000-7000-8000-000000000012';
export const COMBAT_PROJECTILE_POOL_ID = '01991d00-1000-7000-8000-000000000020';
export const COMBAT_FX_POOL_ID = '01991d00-1000-7000-8000-000000000021';
export const COMBAT_ENEMY_IDS = Object.freeze(Array.from(
  { length: 9 },
  (_, index) => `01991d00-1000-7000-8000-${(0x101 + index).toString(16).padStart(12, '0')}`,
));
const EVENT_CAPACITY = 32;

type RetainedEvent = Readonly<{
  event: CombatEvent;
  sequence: number;
  occurredAt: string;
}>;

export type CombatInspectionModel = Readonly<{
  record(event: CombatEvent): void;
  world(snapshot: CombatSnapshot): WorldInspection;
  events(): EventHistory;
}>;

function count(value: number): { available: number; retained: number } {
  return { available: value, retained: value };
}

function entityIdsFor(event: CombatEvent): string[] {
  if (event.enemyIndex === undefined) return [COMBAT_PLAYER_ID];
  return [COMBAT_PLAYER_ID, COMBAT_ENEMY_IDS[event.enemyIndex]!];
}

export function createCombatInspectionModel(runtimeInstanceId: string): CombatInspectionModel {
  const retained: RetainedEvent[] = [];
  let available = 0;

  const record = (event: CombatEvent): void => {
    available += 1;
    retained.push(Object.freeze({ event, sequence: available, occurredAt: new Date().toISOString() }));
    if (retained.length > EVENT_CAPACITY) retained.shift();
  };

  const world = (snapshot: CombatSnapshot): WorldInspection => {
    const entities = [
      {
        entityId: COMBAT_ARENA_ID,
        label: 'Prism Arena',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.combat-arena',
          schemaVersion: 1,
          summary: `Wave ${snapshot.wave} arena`,
          data: { radius: 7.8, wave: snapshot.wave, score: snapshot.score },
        }],
      },
      {
        entityId: COMBAT_PLAYER_ID,
        label: 'Wayfinder',
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.combatant',
            schemaVersion: 1,
            summary: 'Player combatant',
            data: { dash: snapshot.player.dash, dashCooldown: snapshot.player.dashCooldown },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'World transform',
            data: { position: [snapshot.player.x, 0.35, snapshot.player.z] },
          },
        ],
      },
      {
        entityId: COMBAT_SQUAD_ID,
        label: 'Prism Drone Formation',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.formation',
          schemaVersion: 1,
          summary: 'Orbiting enemy formation',
          data: { active: snapshot.enemies.filter((enemy) => enemy.respawn <= 0).length },
        }],
      },
      ...snapshot.enemies.map((enemy, index) => ({
        entityId: COMBAT_ENEMY_IDS[index]!,
        label: `Prism Drone ${String(index + 1).padStart(2, '0')}`,
        revision: enemy.revision,
        components: [
          {
            typeId: 'antiky.combatant',
            schemaVersion: 1,
            summary: enemy.respawn > 0 ? 'Reconstituting drone' : 'Active enemy drone',
            data: { health: enemy.health, hitReaction: enemy.hit, respawn: enemy.respawn },
          },
          {
            typeId: 'antiky.transform',
            schemaVersion: 1,
            summary: 'World transform',
            data: { position: [enemy.x, 0.55, enemy.z] },
          },
        ],
      })),
      {
        entityId: COMBAT_PROJECTILE_POOL_ID,
        label: 'Projectile Pool',
        revision: snapshot.shotsFired,
        components: [{
          typeId: 'antiky.projectile-pool',
          schemaVersion: 1,
          summary: 'Bounded projectile pool',
          data: {
            capacity: snapshot.projectiles.length,
            active: snapshot.projectiles.filter((projectile) => projectile.life > 0).length,
          },
        }],
      },
      {
        entityId: COMBAT_FX_POOL_ID,
        label: 'Impact Particle Pool',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.particle-pool',
          schemaVersion: 1,
          summary: 'Bounded impact particle pool',
          data: {
            capacity: snapshot.particles.length,
            active: snapshot.particles.filter((particle) => particle.life > 0).length,
          },
        }],
      },
    ];
    const relationships = [
      COMBAT_PLAYER_ID,
      COMBAT_SQUAD_ID,
      COMBAT_PROJECTILE_POOL_ID,
      COMBAT_FX_POOL_ID,
    ].map((childEntityId) => ({
      type: 'ChildOf' as const,
      childEntityId,
      parentEntityId: COMBAT_ARENA_ID,
    })).concat(COMBAT_ENEMY_IDS.map((childEntityId) => ({
      type: 'ChildOf' as const,
      childEntityId,
      parentEntityId: COMBAT_SQUAD_ID,
    })));
    const runtimeEntries = [
      {
        key: 'player',
        entityId: COMBAT_PLAYER_ID,
        data: { x: snapshot.player.x, z: snapshot.player.z, dash: snapshot.player.dash },
      },
      ...snapshot.enemies.map((enemy, index) => ({
        key: `enemy-${index + 1}`,
        entityId: COMBAT_ENEMY_IDS[index]!,
        data: { x: enemy.x, z: enemy.z, health: enemy.health, respawn: enemy.respawn },
      })),
      {
        key: 'projectiles',
        entityId: COMBAT_PROJECTILE_POOL_ID,
        data: { active: snapshot.projectiles.filter((projectile) => projectile.life > 0).length },
      },
      {
        key: 'particles',
        entityId: COMBAT_FX_POOL_ID,
        data: { active: snapshot.particles.filter((particle) => particle.life > 0).length },
      },
    ];
    const renderEntries = [
      { key: 'arena', entityId: COMBAT_ARENA_ID, data: { layer: 0, visible: true } },
      { key: 'player', entityId: COMBAT_PLAYER_ID, data: { layer: 2, visible: true } },
      { key: 'enemies', entityId: COMBAT_SQUAD_ID, data: { layer: 2, visible: true } },
      { key: 'projectiles', entityId: COMBAT_PROJECTILE_POOL_ID, data: { layer: 3, visible: true } },
      { key: 'particles', entityId: COMBAT_FX_POOL_ID, data: { layer: 4, visible: true } },
    ];
    const componentCount = entities.reduce((total, entity) => total + entity.components.length, 0);
    return createWorldInspection({
      schemaVersion: WORLD_INSPECTION_SCHEMA_VERSION,
      owner: 'framework',
      worldId: COMBAT_WORLD_ID,
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
          storeId: 'antiky.combat.runtime',
          label: 'Combat runtime',
          kind: 'runtime',
          incomplete: false,
          counts: count(runtimeEntries.length),
          entries: runtimeEntries,
        },
        {
          storeId: 'antiky.combat.render',
          label: 'Combat render projection',
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
    sourceId: 'antiky.combat-simulation',
    worldId: COMBAT_WORLD_ID,
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
      commandId: `01991d00-2000-7000-8000-${sequence.toString(16).padStart(12, '0')}`,
      worldId: COMBAT_WORLD_ID,
      entityIds: entityIdsFor(event),
      revision: sequence,
      occurredAt,
      data: { value: event.value },
    })),
  });

  return Object.freeze({ record, world, events });
}
