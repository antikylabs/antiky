import {
  abs,
  floor,
  fract,
  length,
  max,
  pow,
  shader,
  sin,
  smoothstep,
  vec2,
  vec3,
  vec4,
  type Vec2,
} from 'brometal';
import {
  cosinePalette,
  fbm2,
  filmGrain,
  hash11,
  hash21,
  hash22,
  tonemapACES,
  turbulence2,
} from 'brometal/shader-functions';

function auroraCurtain(p: Vec2, offset: number, phase: number, time: number): number {
  const warp = fbm2(vec2(p.x * 1.15 + phase, time * 0.055 + phase), 5);
  const center = offset
    + sin(p.x * 1.65 + phase + time * 0.16) * 0.11
    + (warp - 0.5) * 0.42;
  const distance = abs(p.y - center);
  const folds = turbulence2(vec2(p.x * 3.3 + phase, time * 0.075), 4);
  const sheet = 1 - smoothstep(0.012, 0.115 + folds * 0.045, distance);
  const core = 1 - smoothstep(0.006, 0.034, distance);
  const edge = 1 - smoothstep(0.009, 0.038, abs(distance - 0.052 - folds * 0.018));
  const striation = 0.22 + pow(max(sin(p.x * 31 + warp * 11 + phase), 0), 8) * 1.05;
  const vertical = smoothstep(-0.62, 0.04, p.y) * (1 - smoothstep(0.7, 1.15, p.y));
  return (sheet * 0.62 + core * 0.58 + edge * 0.22) * striation * vertical;
}

function pineSilhouette(p: Vec2, ridge: number): number {
  const domain = (p.x + 3.4) * 11.5;
  const cell = floor(domain);
  const localX = abs(fract(domain) - 0.5);
  const seed = hash11(cell * 7.13);
  const base = ridge - 0.035 + sin(cell * 2.7) * 0.018;
  const height = 0.11 + seed * 0.24;
  const top = base + height;
  const taper = (top - p.y) * (0.24 + seed * 0.08) + 0.005;
  return (1 - smoothstep(taper, taper + 0.012, localX))
    * smoothstep(base, base + 0.015, p.y)
    * (1 - smoothstep(top - 0.012, top, p.y));
}

/**
 * Deliberately short: this shader exists to be read next to the WGSL the
 * compiler emits from it.
 */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  uniforms: { uTime: 'float', uAspect: 'float', uPointer: 'vec2' },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition, aUv }, _uniforms, v) {
    v.vUv = aUv;
    return vec4(aPosition, 1);
  },

  fragment({ uTime, uAspect, uPointer }, { vUv }) {
    const p = vec2(
      (vUv.x - 0.5) * uAspect + (uPointer.x - 0.5) * 0.08,
      vUv.y - 0.5 + (uPointer.y - 0.5) * 0.035,
    ).scale(2.35);
    const horizon = smoothstep(-0.72, 0.85, p.y);
    const sky = vec3(0.002, 0.006, 0.03)
      .add(vec3(0.015, 0.035, 0.14).scale(horizon))
      .add(vec3(0.12, 0.025, 0.16).scale(pow(horizon, 4) * 0.16));

    const starGrid = p.scale(86);
    const starCell = vec2(floor(starGrid.x), floor(starGrid.y));
    const starLocal = vec2(fract(starGrid.x) - 0.5, fract(starGrid.y) - 0.5);
    const starPoint = hash22(starCell).sub(vec2(0.5, 0.5)).scale(0.68);
    const starSeed = hash21(starCell);
    const starDistance = length(starLocal.sub(starPoint));
    const stars = (1 - smoothstep(0.018, 0.075, starDistance))
      * smoothstep(0.955, 0.998, starSeed)
      * (0.58 + sin(uTime * (0.7 + starSeed * 2.6) + starSeed * 90) * 0.4)
      * smoothstep(-0.45, 0.1, p.y);
    const milky = turbulence2(
      vec2(p.x * 0.72 + p.y * 0.38 + 2.4, p.y * 1.4 - p.x * 0.12),
      5,
    ) * smoothstep(-0.1, 0.62, p.y);

    const moonPoint = p.sub(vec2(0.96, 0.63));
    const moonDistance = length(moonPoint);
    const moonDisc = 1 - smoothstep(0.135, 0.148, moonDistance);
    const moonHalo = 0.018 / max(moonDistance, 0.045)
      * (1 - smoothstep(0.14, 0.58, moonDistance));
    const craterCell = vec2(floor(moonPoint.x * 32), floor(moonPoint.y * 32));
    const craterSeed = hash21(craterCell);
    const crater = smoothstep(0.72, 0.94, craterSeed) * moonDisc * 0.16;

    const curtainA = auroraCurtain(p, 0.22, 0.3, uTime);
    const curtainB = auroraCurtain(p, 0.4, 2.1, uTime) * 0.78;
    const curtainC = auroraCurtain(p, 0.58, 4.4, uTime) * 0.52;
    const palette = cosinePalette(
      p.x * 0.09 + uTime * 0.012,
      vec3(0.18, 0.34, 0.38),
      vec3(0.2, 0.34, 0.3),
      vec3(1, 1, 1),
      vec3(0.08, 0.18, 0.52),
    );
    const aurora = palette.scale(curtainA * 1.55)
      .add(vec3(0.04, 1.2, 0.78).scale(curtainB))
      .add(vec3(0.62, 0.12, 1.15).scale(curtainC));

    const farHeight = -0.39 + fbm2(vec2(p.x * 0.62 + 7.1, 1.3), 5) * 0.34;
    const nearHeight = -0.67 + fbm2(vec2(p.x * 1.12 + 2.4, 3.7), 5) * 0.5;
    const farMountain = 1 - smoothstep(farHeight, farHeight + 0.025, p.y);
    const nearMountain = 1 - smoothstep(nearHeight, nearHeight + 0.03, p.y);
    const snowLine = (1 - smoothstep(nearHeight - 0.055, nearHeight + 0.018, p.y))
      * smoothstep(nearHeight - 0.13, nearHeight - 0.035, p.y);
    const pines = pineSilhouette(p, nearHeight + 0.015);

    const ripple = sin(p.y * 82 + p.x * 5 - uTime * 1.2) * 0.012;
    const reflectedPoint = vec2(p.x + ripple, -p.y - 0.5);
    const reflection = auroraCurtain(reflectedPoint, 0.22, 0.3, uTime)
      + auroraCurtain(reflectedPoint, 0.4, 2.1, uTime) * 0.55;
    const waterMask = 1 - smoothstep(-0.73, -0.67, p.y);
    const water = vec3(0.004, 0.018, 0.055)
      .add(palette.scale(reflection * 0.22 * (0.55 + sin(p.y * 110) * 0.18)))
      .add(vec3(0.06, 0.17, 0.27).scale(abs(ripple) * 4));

    const skyColor = sky
      .add(vec3(0.74, 0.86, 1.2).scale(stars))
      .add(vec3(0.08, 0.055, 0.2).scale(milky * 0.22))
      .add(vec3(0.24, 0.34, 0.72).scale(moonHalo * 0.14))
      .add(vec3(1.35, 1.2, 0.78).scale(moonDisc * (0.9 - crater)))
      .add(aurora);
    const mountains = skyColor.scale(1 - farMountain)
      .add(vec3(0.025, 0.055, 0.11).scale(farMountain))
      .scale(1 - nearMountain)
      .add(vec3(0.008, 0.016, 0.035).scale(nearMountain))
      .add(vec3(0.26, 0.36, 0.52).scale(snowLine * 0.38))
      .scale(1 - pines)
      .add(vec3(0.002, 0.008, 0.018).scale(pines));
    const composed = mountains.scale(1 - waterMask).add(water.scale(waterMask));
    const grain = filmGrain(vUv, uTime) * 0.012;
    return vec4(tonemapACES(composed.add(vec3(grain, grain, grain))), 1);
  },
});
