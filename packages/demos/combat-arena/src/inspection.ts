import {
  WORLD_INSPECTION_SCHEMA_VERSION,
  completeCounts,
  createBoundedEventRecorder,
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
  { length: 6 },
  (_, index) => `01991d00-1000-7000-8000-${(0x101 + index).toString(16).padStart(12, '0')}`,
));
const EVENT_CAPACITY = 32;

export type CombatInspectionModel = Readonly<{
  record(event: CombatEvent): void;
  world(snapshot: CombatSnapshot): WorldInspection;
  events(): EventHistory;
}>;

function entityIdsFor(event: CombatEvent): string[] {
  if (event.enemyIndex === undefined) return [COMBAT_PLAYER_ID];
  return [COMBAT_PLAYER_ID, COMBAT_ENEMY_IDS[event.enemyIndex]!];
}

export function createCombatInspectionModel(runtimeInstanceId: string): CombatInspectionModel {
  const recorder = createBoundedEventRecorder<CombatEvent>(EVENT_CAPACITY);

  const record = (event: CombatEvent): void => {
    // Simulation seconds encoded from the Unix epoch, not wall-clock time — the same mapping the
    // envelope's `occurredAtMapping` note describes, now applied where the event is retained.
    recorder.record(event, new Date(Math.max(0, Math.round(event.simulationTime * 1_000))).toISOString());
  };

  const world = (snapshot: CombatSnapshot): WorldInspection => {
    const activeEnemies = snapshot.enemies.filter((enemy) => enemy.active);
    const boss = snapshot.enemies.find((enemy) => enemy.active && enemy.role === 'warden');
    const entities = [
      {
        entityId: COMBAT_ARENA_ID,
        label: 'Starbreaker Circuit',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.combat-arena',
          schemaVersion: 1,
          summary: `${snapshot.phase} · round ${snapshot.round}/${snapshot.maxRounds}`,
          data: {
            radius: 7.8,
            phase: snapshot.phase,
            phaseTime: snapshot.phaseTime,
            round: snapshot.round,
            maxRounds: snapshot.maxRounds,
            score: snapshot.score,
            combo: snapshot.combo,
            bossHull: boss?.hull ?? null,
            bossMaxHull: boss?.maxHull ?? null,
          },
        }],
      },
      {
        entityId: COMBAT_PLAYER_ID,
        label: 'Starbreaker',
        revision: snapshot.revision,
        components: [
          {
            typeId: 'antiky.combatant',
            schemaVersion: 1,
            summary: 'Player combatant',
            data: {
              hull: snapshot.player.hull,
              maxHull: snapshot.player.maxHull,
              drive: snapshot.player.drive,
              maxDrive: snapshot.player.maxDrive,
              dash: snapshot.player.dash,
              dashCooldown: snapshot.player.dashCooldown,
              invulnerable: snapshot.player.invulnerable,
              damageTaken: snapshot.damageTaken,
            },
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
        label: 'Circuit Hostiles',
        revision: snapshot.revision,
        components: [{
          typeId: 'antiky.formation',
          schemaVersion: 1,
          summary: `${activeEnemies.length} active hostile${activeEnemies.length === 1 ? '' : 's'}`,
          data: {
            active: activeEnemies.length,
            roles: activeEnemies.map((enemy) => enemy.role),
            states: activeEnemies.map((enemy) => enemy.state),
          },
        }],
      },
      ...snapshot.enemies.map((enemy, index) => ({
        entityId: COMBAT_ENEMY_IDS[index]!,
        label: enemy.role === 'warden'
          ? 'Circuit Warden'
          : `${enemy.role.replace('-', ' ')} ${String(index + 1).padStart(2, '0')}`,
        revision: enemy.revision,
        components: [
          {
            typeId: 'antiky.combatant',
            schemaVersion: 1,
            summary: `${enemy.role} · ${enemy.state}`,
            data: {
              active: enemy.active,
              role: enemy.role,
              state: enemy.state,
              hull: enemy.hull,
              maxHull: enemy.maxHull,
              shield: enemy.shield,
              mark: enemy.mark,
              stagger: enemy.stagger,
              hitReaction: enemy.hit,
            },
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
            hostile: snapshot.projectiles.filter((projectile) => projectile.life > 0 && projectile.enemy).length,
            deflected: snapshot.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === 'deflected').length,
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
        data: {
          x: snapshot.player.x,
          z: snapshot.player.z,
          hull: snapshot.player.hull,
          drive: snapshot.player.drive,
          dash: snapshot.player.dash,
          invulnerable: snapshot.player.invulnerable,
          phase: snapshot.phase,
          round: snapshot.round,
          combo: snapshot.combo,
        },
      },
      ...snapshot.enemies.map((enemy, index) => ({
        key: `enemy-${index + 1}`,
        entityId: COMBAT_ENEMY_IDS[index]!,
        data: {
          active: enemy.active,
          x: enemy.x,
          z: enemy.z,
          role: enemy.role,
          state: enemy.state,
          hull: enemy.hull,
          shield: enemy.shield,
          mark: enemy.mark,
          stagger: enemy.stagger,
        },
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
      { key: 'arena', entityId: COMBAT_ARENA_ID, data: { layer: 0, visible: true, catalogAssets: 5 } },
      { key: 'player', entityId: COMBAT_PLAYER_ID, data: { layer: 2, visible: true, catalogAssets: 1 } },
      { key: 'enemies', entityId: COMBAT_SQUAD_ID, data: { layer: 2, visible: activeEnemies.length > 0, catalogAssets: 4 } },
      { key: 'projectiles', entityId: COMBAT_PROJECTILE_POOL_ID, data: { layer: 3, visible: true, deflections: snapshot.deflections } },
      { key: 'particles', entityId: COMBAT_FX_POOL_ID, data: { layer: 4, visible: true, impact: snapshot.impact } },
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
        entities: completeCounts(entities.length),
        components: completeCounts(componentCount),
        relationships: completeCounts(relationships.length),
        stores: completeCounts(2),
      },
      entities,
      relationships,
      stores: [
        {
          storeId: 'antiky.combat.runtime',
          label: 'Combat runtime',
          kind: 'runtime',
          incomplete: false,
          counts: completeCounts(runtimeEntries.length),
          entries: runtimeEntries,
        },
        {
          storeId: 'antiky.combat.render',
          label: 'Combat render projection',
          kind: 'render',
          incomplete: false,
          counts: completeCounts(renderEntries.length),
          entries: renderEntries,
        },
      ],
    });
  };

  const events = (): EventHistory => recorder.history({
    owner: 'framework',
    sourceId: 'antiky.combat-simulation-facts',
    worldId: COMBAT_WORLD_ID,
    runtimeInstanceId,
    describe: ({ event, sequence, occurredAt }) => ({
      eventSchemaVersion: 2,
      type: event.type,
      sequence,
      commandId: `01991d00-2000-7000-8000-${sequence.toString(16).padStart(12, '0')}`,
      worldId: COMBAT_WORLD_ID,
      entityIds: entityIdsFor(event),
      revision: event.simulationRevision,
      occurredAt,
      data: {
        factKind: 'deterministic-simulation',
        simulationTimeSeconds: event.simulationTime,
        simulationRevision: event.simulationRevision,
        commandIdMapping: 'schema-required deterministic fact identity; no command occurred',
        occurredAtMapping: 'simulation seconds encoded from Unix epoch; not wall-clock time',
        value: event.value,
        ...(event.round === undefined ? {} : { round: event.round }),
        ...(event.phase === undefined ? {} : { phase: event.phase }),
        ...(event.role === undefined ? {} : { role: event.role }),
        ...(event.source === undefined ? {} : { source: event.source }),
        ...(event.enemyIndex === undefined ? {} : { enemyIndex: event.enemyIndex }),
      },
    }),
  });

  return Object.freeze({ record, world, events });
}
