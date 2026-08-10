import type { CombatSnapshot } from './simulation.ts';

export type CombatCameraFrame = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}>;

type CameraState = Pick<CombatSnapshot, 'time' | 'impact' | 'phase' | 'player' | 'enemies'>;

export type CombatCameraProjector = Readonly<{
  project(
    aspect: number,
    state: CameraState,
    pointer: Readonly<{ x: number; y: number }>,
  ): CombatCameraFrame;
}>;

function threatPriority(state: CameraState, enemyIndex: number): number {
  const enemy = state.enemies[enemyIndex]!;
  return (enemy.mark > 0 ? 4 : 0)
    + (enemy.state === 'telegraph' ? 3 : enemy.state === 'attack' ? 2 : 0)
    - Math.hypot(enemy.x - state.player.x, enemy.z - state.player.z) * 0.02;
}

export function createCombatCameraProjector(): CombatCameraProjector {
  const position: [number, number, number] = [0, 0, 0];
  const target: [number, number, number] = [0, 0, 0];
  const frame: CombatCameraFrame = { position, target };

  return Object.freeze({
    project(aspect, state, pointer): CombatCameraFrame {
      const mobile = aspect < 0.9;
      const actionImpact = Math.max(0, Math.min(1, state.impact));
      const shakeX = Math.sin(state.time * 47) * actionImpact * 0.11;
      const shakeZ = Math.cos(state.time * 41) * actionImpact * 0.08;
      const pointerX = Number.isFinite(pointer.x) ? Math.max(0, Math.min(1, pointer.x)) : 0.5;
      const pointerY = Number.isFinite(pointer.y) ? Math.max(0, Math.min(1, pointer.y)) : 0.5;
      const terminal = state.phase === 'victory' || state.phase === 'defeat';
      const driftX = terminal ? 0 : (pointerX - 0.5) * (mobile ? 0.55 : 0.9);
      const driftY = terminal ? 0 : (pointerY - 0.5) * (mobile ? 0.28 : 0.42);
      const velocityLeadX = Math.max(-0.42, Math.min(0.42, state.player.vx * 0.035));
      const velocityLeadZ = Math.max(-0.34, Math.min(0.34, state.player.vz * 0.028));
      const aimLeadX = state.player.facingX * (mobile ? 0.18 : 0.32);
      const aimLeadZ = state.player.facingZ * (mobile ? 0.16 : 0.28);
      let threatIndex = -1;
      let bestPriority = Number.NEGATIVE_INFINITY;
      for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
        if (!state.enemies[enemyIndex]!.active) continue;
        const priority = threatPriority(state, enemyIndex);
        if (priority > bestPriority) {
          bestPriority = priority;
          threatIndex = enemyIndex;
        }
      }
      const threat = threatIndex < 0 ? undefined : state.enemies[threatIndex];
      const threatLeadX = threat === undefined || terminal ? 0 : Math.max(-0.82, Math.min(0.82, (threat.x - state.player.x) * 0.14));
      const threatLeadZ = threat === undefined || terminal ? 0 : Math.max(-0.68, Math.min(0.68, (threat.z - state.player.z) * 0.12));
      const dashPush = Math.max(0, Math.min(1, state.player.dash / 0.2));

      if (terminal) {
        position[0] = shakeX;
        position[1] = mobile ? 17.4 : 13.6;
        position[2] = (mobile ? 18.6 : 14.9) + shakeZ;
        target[0] = 0;
        target[1] = 0.28;
        target[2] = 0;
        return frame;
      }

      position[0] = state.player.x * 0.08 + driftX + velocityLeadX + threatLeadX * 0.18 + shakeX;
      position[1] = (mobile ? 17 : 13.4) + driftY - dashPush * (mobile ? 0.32 : 0.48);
      position[2] = (mobile ? 18.2 : 14.8) + state.player.z * 0.05 + velocityLeadZ + threatLeadZ * 0.12 + shakeZ;
      target[0] = state.player.x * 0.12 + velocityLeadX + aimLeadX + threatLeadX;
      target[1] = 0.3;
      target[2] = state.player.z * 0.1 + (mobile ? 1.55 : 1.15) + velocityLeadZ + aimLeadZ + threatLeadZ;
      return frame;
    },
  });
}
