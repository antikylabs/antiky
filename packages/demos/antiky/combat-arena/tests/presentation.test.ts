import assert from 'node:assert/strict';
import test from 'node:test';

import { createCombatCameraProjector } from '../src/presentation.ts';
import { combatSignalMode } from '../src/arena-signals.ts';
import { ARENA_ROOM_PROFILE } from '../src/arena-composition.ts';
import { COMBAT_READABILITY_PROFILE } from '../src/combat-projection.ts';
import {
  ENEMY_HULL_CONTRACTS,
  PLAYER_HURT_RADIUS,
  SHIP_PRESENTATION_SPANS,
} from '../src/combat-hulls.ts';
import { combatEscalationProfile, enemyVisualProfile } from '../src/combat-visuals.ts';
import { COMBAT_RENDERER_OPTIONS, deriveCombatRendererMeasurements } from '../src/renderer.ts';
import { createCombatSimulation } from '../src/simulation.ts';

const projectOnce = (...parameters: Parameters<ReturnType<typeof createCombatCameraProjector>['project']>) => (
  createCombatCameraProjector().project(...parameters)
);

test('combat camera keeps the action framed for wide and portrait canvases', () => {
  const state = createCombatSimulation(() => {}).read();
  const wide = projectOnce(16 / 9, state, { x: 0.5, y: 0.5 });
  const portrait = projectOnce(9 / 16, state, { x: 0.5, y: 0.5 });

  assert.deepEqual(wide.position, [0, 13.4, 14.875]);
  assert.ok(Math.abs(wide.target[0]) < 0.000_001);
  assert.ok(Math.abs(wide.target[1] - 0.3) < 0.000_001);
  assert.ok(Math.abs(wide.target[2] - 1.3) < 0.000_001);
  assert.ok(portrait.position[1] > wide.position[1]);
  assert.ok(portrait.position[2] > wide.position[2]);
  assert.ok(portrait.target[2] > wide.target[2]);
});

test('combat camera pointer drift is clamped and deterministic', () => {
  const state = createCombatSimulation(() => {}).read();
  const first = projectOnce(16 / 9, state, { x: 4, y: -3 });
  const second = projectOnce(16 / 9, state, { x: 1, y: 0 });

  assert.deepEqual(first, second);
  assert.equal(first.position[0], 0.45);
  assert.ok(Math.abs(first.position[1] - 13.19) < 0.000_001);
});

test('steady camera projection reuses its frame vectors and never sorts enemy state', () => {
  const state = createCombatSimulation(() => {}).read();
  const projector = createCombatCameraProjector();
  const first = projector.project(16 / 9, state, { x: 0.5, y: 0.5 });
  const position = first.position;
  const target = first.target;
  const originalSort = Array.prototype.sort;
  Array.prototype.sort = () => {
    throw new Error('steady camera projection must scan threats without sorting');
  };
  try {
    const second = projector.project(16 / 9, state, { x: 1, y: 0 });
    assert.equal(second, first);
    assert.equal(second.position, position);
    assert.equal(second.target, target);
  } finally {
    Array.prototype.sort = originalSort;
  }
});

test('extreme velocity, aim and impact do not move the camera', () => {
  // This used to assert the opposite: that the camera led the player's velocity, swung with their
  // aim, and was pushed by impact. The owner turned all of that off after it made them motion sick,
  // so the test now guards the same inputs from the other side. The values are deliberately absurd
  // - 200 units per second, an impact of 50 - because if anything still leaks through, it will show
  // up here first.
  const state = createCombatSimulation(() => {}).read();
  const calm = projectOnce(16 / 9, state, { x: 0.5, y: 0.5 });
  const violent = projectOnce(16 / 9, {
    ...state,
    time: 0.031,
    impact: 50,
    player: { ...state.player, vx: 200, vz: -200, facingX: 1, facingZ: 0 },
  }, { x: 0.5, y: 0.5 });

  assert.deepEqual(violent.position, calm.position);
  assert.deepEqual(violent.target, calm.target);
});

test('a marked, telegraphing threat and a blade dash leave the camera where it was', () => {
  // Previously this asserted the camera lurched towards the most dangerous enemy and pushed in on a
  // dash. Measured against the real fight, the threat lurch was the single worst offender: when the
  // priority flipped, the look-at target moved 0.4046 units in one frame. Both are off now.
  const state = createCombatSimulation(() => {}).read();
  const calm = projectOnce(16 / 9, state, { x: 0.5, y: 0.5 });
  const markedThreat = {
    ...state,
    phase: 'combat' as const,
    enemies: state.enemies.map((enemy, index) => index === 0
      ? { ...enemy, active: true, x: 6, z: -4, mark: 2, state: 'telegraph' as const }
      : enemy),
  };
  const threatFrame = projectOnce(16 / 9, markedThreat, { x: 0.5, y: 0.5 });
  const dashFrame = projectOnce(16 / 9, {
    ...markedThreat,
    player: { ...state.player, dash: 0.2, facingX: 1, facingZ: 0 },
  }, { x: 0.5, y: 0.5 });

  assert.deepEqual(threatFrame.target, calm.target);
  assert.deepEqual(threatFrame.position, calm.position);
  assert.deepEqual(dashFrame.position, calm.position);
});

test('terminal camera gives the result composition priority over player drift', () => {
  const state = createCombatSimulation(() => {}).read();
  const result = projectOnce(16 / 9, {
    ...state,
    phase: 'victory',
    player: { ...state.player, x: 6, z: 5, vx: 12, vz: -10 },
  }, { x: 1, y: 0 });

  assert.ok(Math.abs(result.target[0]) < 0.25);
  assert.ok(Math.abs(result.target[2]) < 0.5);
});

test('renderer reporting is derived from its capacities and catalog asset set', () => {
  const measurements = deriveCombatRendererMeasurements();
  assert.equal(measurements.catalogAssets, 10);
  assert.ok(measurements.catalogInstances >= 100);
  assert.ok(measurements.environmentLayers >= 4);
  assert.equal(measurements.drawCalls, 15);
  assert.equal(measurements.uploadBytesPerFrame, 15_780);
  assert.ok(measurements.instances <= 384);
  assert.ok(measurements.uploadBytesPerFrame <= 24 * 1_024);
  assert.ok(measurements.uploadBytesPerFrame > 0);
  assert.equal(measurements.particlePacking, 'active-prefix');
});

test('renderer honors the authored two-sided ship material policy', () => {
  assert.equal(COMBAT_RENDERER_OPTIONS.cull, 'none');
});

test('authoritative per-role collisions cover the rendered hull-edge contract', () => {
  const roles = ['rusher', 'gunner', 'shield-anchor', 'warden'] as const;
  for (const role of roles) {
    const contract = ENEMY_HULL_CONTRACTS[role];
    const span = SHIP_PRESENTATION_SPANS[role];
    const renderedEdge = Math.max(span.width, span.length) * 0.5;
    assert.ok(contract.projectileRadius >= renderedEdge, `${role} projectile radius`);
    assert.ok(contract.bladeRadius > contract.projectileRadius, `${role} blade allowance`);
    assert.ok(contract.chargeRadius >= renderedEdge + PLAYER_HURT_RADIUS, `${role} charge radius`);
  }
});

test('arena foreground, combatant scale, and mark/HUD hierarchy stay readable', () => {
  const roomTop = ARENA_ROOM_PROFILE.offsetY
    + ARENA_ROOM_PROFILE.sourceHeight * ARENA_ROOM_PROFILE.verticalScale;
  assert.ok(roomTop <= 2);
  assert.ok(SHIP_PRESENTATION_SPANS.player.width >= 1.7);
  assert.ok(SHIP_PRESENTATION_SPANS.rusher.length >= 2.1);
  assert.ok(SHIP_PRESENTATION_SPANS.warden.width >= SHIP_PRESENTATION_SPANS.rusher.width * 3.3);
  assert.ok(COMBAT_READABILITY_PROFILE.markedMinimumAlpha >= 0.7);
  assert.ok(COMBAT_READABILITY_PROFILE.markedScale >= 1.35);
  assert.ok(COMBAT_READABILITY_PROFILE.hudZ > 5);
  assert.ok(COMBAT_READABILITY_PROFILE.hullSegmentWidth >= 0.46);
  assert.ok(COMBAT_READABILITY_PROFILE.driveSegmentWidth >= 0.3);
  assert.ok(COMBAT_READABILITY_PROFILE.playerRingRadius >= 0.9);
  assert.ok(COMBAT_READABILITY_PROFILE.wardenRingRadius >= 2.5);
});

test('arena activation escalates the carrier deck across the first three rounds', () => {
  const state = createCombatSimulation(() => {}).read();
  const intro = combatEscalationProfile(state);
  const opening = combatEscalationProfile({ ...state, phase: 'combat', round: 1 });
  const combined = combatEscalationProfile({ ...state, phase: 'combat', round: 2 });
  const finale = combatEscalationProfile({ ...state, phase: 'combat', round: 3 });

  assert.ok(intro.activeBeacons < opening.activeBeacons);
  assert.ok(opening.activeBeacons < combined.activeBeacons);
  assert.ok(combined.activeBeacons < finale.activeBeacons);
  assert.ok(intro.floorEnergy < opening.floorEnergy);
  assert.ok(opening.hazardEnergy < finale.hazardEnergy);
});

test('enemy roles project materially different silhouettes and combat-state emphasis', () => {
  const state = createCombatSimulation(() => {}).read();
  const base = state.enemies[0]!;
  const rusher = enemyVisualProfile({ ...base, role: 'rusher', state: 'tracking' });
  const gunner = enemyVisualProfile({ ...base, role: 'gunner', state: 'tracking' });
  const anchor = enemyVisualProfile({ ...base, role: 'shield-anchor', state: 'tracking' });
  const warden = enemyVisualProfile({ ...base, role: 'warden', state: 'tracking' });
  const telegraph = enemyVisualProfile({ ...base, role: 'gunner', state: 'telegraph' });
  const recovery = enemyVisualProfile({ ...base, role: 'gunner', state: 'recovery' });

  assert.equal(enemyVisualProfile({ ...base, role: 'gunner', state: 'tracking' }), gunner);

  assert.ok(rusher.length > rusher.width);
  assert.ok(gunner.hardpoints > rusher.hardpoints);
  assert.ok(anchor.width > gunner.width);
  assert.ok(warden.width > anchor.width);
  assert.ok(warden.width >= SHIP_PRESENTATION_SPANS.warden.width * 0.9);
  assert.ok(anchor.width >= SHIP_PRESENTATION_SPANS['shield-anchor'].width * 0.9);
  assert.ok(telegraph.emissive > recovery.emissive * 2);
});

test('canvas signals teach mark-to-dash during onboarding and communicate terminal retry', () => {
  const state = createCombatSimulation(() => {}).read();
  assert.equal(combatSignalMode(state), 'mark-then-dash');
  assert.equal(combatSignalMode({
    ...state,
    phase: 'combat',
    score: 1,
    dashes: 1,
  }), 'none');
  assert.equal(combatSignalMode({ ...state, phase: 'victory' }), 'victory-retry');
  assert.equal(combatSignalMode({ ...state, phase: 'defeat' }), 'defeat-retry');
});
