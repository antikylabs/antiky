import type { CombatSnapshot } from './simulation.ts';

export type CombatCameraFrame = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}>;

export function combatCameraFrame(
  aspect: number,
  state: Pick<CombatSnapshot, 'time' | 'impact' | 'player' | 'enemies'>,
  pointer: Readonly<{ x: number; y: number }>,
): CombatCameraFrame {
  const mobile = aspect < 0.9;
  const actionImpact = Math.max(0, Math.min(1, state.impact));
  const shakeX = Math.sin(state.time * 47) * actionImpact * 0.11;
  const shakeZ = Math.cos(state.time * 41) * actionImpact * 0.08;
  const pointerX = Number.isFinite(pointer.x) ? Math.max(0, Math.min(1, pointer.x)) : 0.5;
  const pointerY = Number.isFinite(pointer.y) ? Math.max(0, Math.min(1, pointer.y)) : 0.5;
  const driftX = (pointerX - 0.5) * (mobile ? 0.9 : 1.7);
  const driftY = (pointerY - 0.5) * (mobile ? 0.45 : 0.65);
  const velocityLeadX = Math.max(-0.42, Math.min(0.42, state.player.vx * 0.035));
  const velocityLeadZ = Math.max(-0.34, Math.min(0.34, state.player.vz * 0.028));
  const aimLeadX = state.player.facingX * (mobile ? 0.18 : 0.32);
  const aimLeadZ = state.player.facingZ * (mobile ? 0.16 : 0.28);

  return Object.freeze({
    position: Object.freeze([
      state.player.x * 0.1 + driftX + velocityLeadX + shakeX,
      (mobile ? 17 : 13.4) + driftY,
      (mobile ? 18.2 : 14.8) + state.player.z * 0.06 + velocityLeadZ + shakeZ,
    ] as const),
    target: Object.freeze([
      state.player.x * 0.14 + velocityLeadX + aimLeadX,
      0.3,
      state.player.z * 0.12 + (mobile ? 1.7 : 1.35) + velocityLeadZ + aimLeadZ,
    ] as const),
  });
}
