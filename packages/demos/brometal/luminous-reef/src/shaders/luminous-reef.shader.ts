import {
  abs,
  floor,
  fract,
  length,
  max,
  pow,
  sin,
  smoothstep,
  vec2,
  vec3,
  vec4,
  shader,
  type Vec2,
} from 'brometal';
import {
  fbm2,
  hash11,
  hash21,
  tonemapACES,
  turbulence2,
  voronoi2,
  worleyEdge2,
} from 'brometal/shader-functions';

function jellyGlow(p: Vec2, center: Vec2, scale: number, phase: number, time: number): number {
  const bob = sin(time * 0.62 + phase) * 0.045;
  const q = p.sub(center.add(vec2(0, bob))).scale(1 / scale);
  const bellDistance = length(vec2(q.x, q.y * 1.36));
  const dome = (1 - smoothstep(0.42, 0.49, bellDistance)) * smoothstep(-0.12, 0.06, q.y);
  const rim = 0.009 / max(abs(bellDistance - 0.455), 0.006)
    * smoothstep(-0.08, 0.12, q.y);
  const skirt = (1 - smoothstep(0.012, 0.07, abs(q.y + 0.04 + sin(q.x * 13) * 0.026)))
    * (1 - smoothstep(0.34, 0.5, abs(q.x)));
  const tentacleGate = (1 - smoothstep(-0.08, 0.02, q.y)) * smoothstep(-1.05, -0.82, q.y);
  const wave = sin(q.y * 8.5 - time * 1.25 + phase) * 0.055;
  const tentacleA = 0.006 / max(abs(q.x + 0.23 - wave), 0.009);
  const tentacleB = 0.007 / max(abs(q.x - wave * 0.7), 0.009);
  const tentacleC = 0.006 / max(abs(q.x - 0.23 - wave * 1.1), 0.009);
  const tentacles = (tentacleA + tentacleB + tentacleC) * tentacleGate * 0.24;
  return dome * 0.34 + rim * 0.72 + skirt * 0.5 + tentacles;
}

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
      (vUv.x - 0.5) * uAspect + (uPointer.x - 0.5) * 0.11,
      vUv.y - 0.5 + (uPointer.y - 0.5) * 0.055,
    ).scale(2.25);
    const depth = 1 - smoothstep(-0.85, 0.95, p.y);
    const waterNoise = fbm2(p.scale(1.8).add(vec2(uTime * 0.025, -uTime * 0.018)), 5);
    const deepTurbulence = turbulence2(
      p.scale(3.4).add(vec2(-uTime * 0.045, uTime * 0.024)),
      4,
    );
    const causticDomain = p.scale(5.8).add(vec2(uTime * 0.075, -uTime * 0.035));
    const causticCells = voronoi2(causticDomain);
    const causticEdges = worleyEdge2(causticDomain.add(vec2(2.3, uTime * 0.025)));
    const caustics = (1 - smoothstep(0.025, 0.16, causticCells)) * 0.48
      + (1 - smoothstep(0.018, 0.075, causticEdges)) * 0.35;
    const surfaceMask = smoothstep(-0.55, 0.82, p.y);
    const rayWarp = fbm2(vec2(p.x * 0.75 + uTime * 0.02, p.y * 0.25), 4);
    const godRays = pow(max(sin(p.x * 5.2 + rayWarp * 5.8), 0), 12)
      * surfaceMask * (0.25 + depth * 0.25);

    const jellyA = jellyGlow(p, vec2(-0.76, 0.14), 0.64, 0.2, uTime);
    const jellyB = jellyGlow(p, vec2(0.33, -0.02), 0.48, 2.1, uTime);
    const jellyC = jellyGlow(p, vec2(0.94, 0.35), 0.3, 4.2, uTime) * 0.72;

    const fishP = p.add(vec2(uTime * 0.23, sin(uTime * 0.2) * 0.04)).scale(4.6);
    const fishCell = vec2(floor(fishP.x), floor(fishP.y));
    const fishLocal = vec2(fract(fishP.x) - 0.5, fract(fishP.y) - 0.5);
    const fishSeed = hash21(fishCell);
    const fishBody = (1 - smoothstep(
      0.035,
      0.13,
      length(vec2(fishLocal.x, fishLocal.y * 2.8)),
    )) * smoothstep(0.78, 0.92, fishSeed) * smoothstep(-0.35, 0.72, p.y);

    const seabedHeight = -0.79 + sin(p.x * 2.6) * 0.055 + waterNoise * 0.035;
    const seabed = 1 - smoothstep(-0.025, 0.045, p.y - seabedHeight);
    const coralDomain = (p.x + 1.8) * 7.4;
    const coralCell = floor(coralDomain);
    const coralX = fract(coralDomain) - 0.5;
    const coralHeight = 0.17 + hash11(coralCell * 3.7) * 0.42;
    const coralWave = sin((p.y - seabedHeight) * 13 + coralCell + uTime * 0.28) * 0.07;
    const coralStem = (1 - smoothstep(0.018, 0.075, abs(coralX + coralWave)))
      * (1 - smoothstep(seabedHeight + coralHeight - 0.06, seabedHeight + coralHeight, p.y))
      * smoothstep(seabedHeight - 0.03, seabedHeight + 0.04, p.y);
    const coralTips = 1 - smoothstep(
      0.025,
      0.12,
      length(vec2(coralX + coralWave, p.y - seabedHeight - coralHeight)),
    );

    const particleCell = vec2(floor(p.x * 48), floor((p.y + uTime * 0.035) * 48));
    const particleSeed = hash21(particleCell);
    const plankton = smoothstep(0.987, 0.999, particleSeed)
      * (0.5 + sin(uTime * 1.2 + particleSeed * 60) * 0.35);

    const background = vec3(0.0015, 0.014, 0.045)
      .add(vec3(0.002, 0.16, 0.2).scale(depth * 0.62 + waterNoise * 0.26))
      .add(vec3(0.025, 0.08, 0.2).scale(deepTurbulence * 0.18))
      .add(vec3(0.06, 0.34, 0.43).scale(godRays * 0.42 + caustics * surfaceMask * 0.15));
    const life = vec3(0.02, 1.25, 0.94).scale(jellyA * (0.72 + sin(uTime * 1.4) * 0.08))
      .add(vec3(0.48, 0.16, 1.55).scale(jellyB * (0.78 + sin(uTime * 1.1 + 2) * 0.09)))
      .add(vec3(1.35, 0.2, 0.64).scale(jellyC))
      .add(vec3(0.22, 0.65, 0.9).scale(fishBody * 0.8))
      .add(vec3(0.15, 0.75, 1.1).scale(plankton * 0.65));
    const reef = vec3(0.03, 0.065, 0.085).scale(seabed)
      .add(vec3(0.05, 0.9, 0.52).scale(coralStem * 0.62))
      .add(vec3(1.15, 0.16, 0.48).scale(coralTips * 0.8));
    return vec4(tonemapACES(background.add(life).add(reef)), 1);
  },
});
