/**
 * The courier's dust trail.
 *
 * A fixed pool written round-robin, so a run never allocates. Particles are plain mutable objects
 * because the snapshot copies them once per read and nothing else retains them.
 */
import { hashUnit } from '@antiky/framework';

export type TrailParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
};

export type TrailParticles = Readonly<{
  /** The live pool. Stable identity, so a snapshot can copy it without re-reading the field. */
  particles: readonly TrailParticle[];
  /**
   * Emit `count` particles from a point, spread by `force`.
   *
   * `seed` makes the spread deterministic: the same seed and count always produce the same trail,
   * which is what lets the digest test compare two runs.
   */
  spawn(
    count: number,
    color: number,
    force: number,
    x: number,
    y: number,
    facing: number,
    seed: number,
  ): void;
  update(deltaSeconds: number): void;
}>;

const TRAIL_GRAVITY = 2.8;

/** Parked well below the course, which is how the renderer knows not to draw a spent particle. */
const PARKED_Y = -20;

export function createTrailParticles(capacity: number): TrailParticles {
  const particles: TrailParticle[] = Array.from(
    { length: capacity },
    () => ({ x: 0, y: PARKED_Y, vx: 0, vy: 0, life: 0, color: 0 }),
  );
  let cursor = 0;

  return Object.freeze({
    particles,
    spawn(
      count: number,
      color: number,
      force: number,
      x: number,
      y: number,
      facing: number,
      seed: number,
    ): void {
      for (let index = 0; index < count; index += 1) {
        const particle = particles[cursor]!;
        cursor = (cursor + 1) % particles.length;
        particle.x = x;
        particle.y = y;
        particle.vx = -facing * (0.65 + hashUnit(seed + index, 2) * force);
        particle.vy = 0.4 + hashUnit(seed + index, 3) * force;
        particle.life = 0.28 + hashUnit(seed + index, 4) * 0.34;
        particle.color = color;
      }
    },
    update(deltaSeconds: number): void {
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index]!;
        if (particle.life <= 0) continue;
        particle.life -= deltaSeconds;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.vy -= TRAIL_GRAVITY * deltaSeconds;
        if (particle.life <= 0) particle.y = PARKED_Y;
      }
    },
  });
}
