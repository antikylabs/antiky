import type { CombatSnapshot } from './simulation.ts';

export type CombatCameraFrame = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}>;

export function combatCameraFrame(
  aspect: number,
  state: Pick<CombatSnapshot, 'time' | 'player' | 'enemies'>,
  pointer: Readonly<{ x: number; y: number }>,
): CombatCameraFrame {
  const mobile = aspect < 0.9;
  const hitEnergy = state.enemies.reduce((total, enemy) => total + enemy.hit, 0);
  const shake = Math.sin(state.time * 42) * Math.min(0.16, hitEnergy * 0.025);
  const pointerX = Number.isFinite(pointer.x) ? Math.max(0, Math.min(1, pointer.x)) : 0.5;
  const pointerY = Number.isFinite(pointer.y) ? Math.max(0, Math.min(1, pointer.y)) : 0.5;
  const driftX = (pointerX - 0.5) * (mobile ? 0.9 : 1.7);
  const driftY = (pointerY - 0.5) * (mobile ? 0.45 : 0.65);

  return Object.freeze({
    position: Object.freeze([
      state.player.x * 0.1 + driftX + shake,
      (mobile ? 17 : 13.4) + driftY,
      (mobile ? 18.2 : 14.8) + state.player.z * 0.06,
    ] as const),
    target: Object.freeze([
      state.player.x * 0.14,
      0.3,
      state.player.z * 0.12 + (mobile ? 1.7 : 1.35),
    ] as const),
  });
}
