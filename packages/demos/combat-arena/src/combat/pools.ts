import { hashUnit } from '@antiky/framework';
import {
  type CombatParticle,
  type CombatProjectile,
  type ProjectileKind,
} from './state.ts';

export type ProjectilePool = Readonly<{
  spawn(
    x: number,
    z: number,
    vx: number,
    vz: number,
    kind: ProjectileKind,
    ownerIndex: number,
    life: number,
  ): CombatProjectile;
  cursor(): number;
  reset(): void;
}>;

export function createProjectilePool(projectiles: CombatProjectile[]): ProjectilePool {
  let cursor = 0;
  return Object.freeze({
    spawn(x, z, vx, vz, kind, ownerIndex, life): CombatProjectile {
      const projectile = projectiles[cursor]!;
      cursor = (cursor + 1) % projectiles.length;
      projectile.x = x;
      projectile.z = z;
      projectile.previousX = x;
      projectile.previousZ = z;
      projectile.vx = vx;
      projectile.vz = vz;
      projectile.life = life;
      projectile.enemy = kind === 'hostile';
      projectile.kind = kind;
      projectile.ownerIndex = ownerIndex;
      return projectile;
    },
    cursor(): number {
      return cursor;
    },
    reset(): void {
      cursor = 0;
      projectiles.forEach((projectile) => { projectile.life = 0; });
    },
  });
}

export type ParticlePool = Readonly<{
  burst(revision: number, x: number, z: number, color: number, count: number, force: number): void;
  update(deltaSeconds: number): void;
  cursor(): number;
  reset(): void;
}>;

export function createParticlePool(particles: CombatParticle[]): ParticlePool {
  let cursor = 0;
  return Object.freeze({
    burst(revision, x, z, color, count, force): void {
      for (let burstIndex = 0; burstIndex < count; burstIndex += 1) {
        const particle = particles[cursor]!;
        cursor = (cursor + 1) % particles.length;
        const angle = hashUnit(revision + burstIndex, color + 4) * Math.PI * 2;
        const speed = force * (0.4 + hashUnit(revision + burstIndex, color + 7));
        particle.x = x;
        particle.y = 0.24 + hashUnit(revision + burstIndex, color + 9) * 0.42;
        particle.z = z;
        particle.vx = Math.cos(angle) * speed;
        particle.vy = 0.9 + hashUnit(revision + burstIndex, color + 11) * force;
        particle.vz = Math.sin(angle) * speed;
        particle.life = 0.3 + hashUnit(revision + burstIndex, color + 13) * 0.48;
        // Recorded so the projection can build a curve on age rather than on remaining time. It
        // cannot derive this: lifetimes vary 0.3 to 0.78 seconds per particle by design, and a
        // curve keyed on `life` alone cannot tell a fresh short-lived spark from a dying long one.
        particle.maxLife = particle.life;
        particle.color = color;
      }
    },
    update(deltaSeconds): void {
      particles.forEach((particle) => {
        if (particle.life <= 0) return;
        particle.life -= deltaSeconds;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.z += particle.vz * deltaSeconds;
        particle.vy -= 5.5 * deltaSeconds;
        particle.vx *= Math.exp(-2.2 * deltaSeconds);
        particle.vz *= Math.exp(-2.2 * deltaSeconds);
        if (particle.life <= 0) particle.y = -20;
      });
    },
    cursor(): number {
      return cursor;
    },
    reset(): void {
      cursor = 0;
      particles.forEach((particle) => {
        particle.life = 0;
        particle.y = -20;
      });
    },
  });
}
