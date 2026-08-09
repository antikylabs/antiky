import {
  abs,
  atan,
  clamp,
  floor,
  fract,
  length,
  max,
  mix,
  pow,
  sin,
  smoothstep,
  vec2,
  vec3,
  vec4,
  shader,
} from 'brometal';
import {
  fbm2,
  hash21,
  hash22,
  rotate2,
  tonemapACES,
  turbulence2,
} from 'brometal/shader-functions';

export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  uniforms: { uTime: 'float', uAspect: 'float', uPointer: 'vec2' },
  varyings: { vUv: 'vec2' },
  vertex({ aPosition, aUv }, _uniforms, v) {
    v.vUv = aUv;
    return vec4(aPosition, 1);
  },
  fragment({ uTime, uAspect, uPointer }, { vUv }) {
    const pointer = vec2(uPointer.x - 0.5, uPointer.y - 0.5);
    const p = rotate2(vec2(
      (vUv.x - 0.5) * uAspect - pointer.x * 0.08,
      vUv.y - 0.5 - pointer.y * 0.045,
    ).scale(2.05), -0.08);
    const center = p.sub(vec2(0.08, -0.015));
    const radius = length(center);
    const angle = atan(center.y, center.x);

    const starGrid = p.scale(92);
    const starCell = vec2(floor(starGrid.x), floor(starGrid.y));
    const starLocal = vec2(fract(starGrid.x) - 0.5, fract(starGrid.y) - 0.5);
    const starPoint = hash22(starCell).sub(vec2(0.5, 0.5)).scale(0.68);
    const starSeed = hash21(starCell);
    const starDistance = length(starLocal.sub(starPoint));
    const starCore = 1 - smoothstep(0.014, 0.062, starDistance);
    const starGlint = 0.0025 / max(starDistance, 0.018);
    const star = (starCore + starGlint * 0.08)
      * smoothstep(0.965, 0.998, starSeed)
      * (0.45 + sin(uTime * (0.8 + starSeed * 2.2) + starSeed * 80) * 0.35)
      * smoothstep(0.52, 0.72, radius);
    const nebula = fbm2(p.scale(1.45).add(vec2(uTime * 0.014, -uTime * 0.009)), 5);
    const dust = turbulence2(p.scale(3.1).add(vec2(-uTime * 0.025, uTime * 0.018)), 4);
    const background = vec3(0.0015, 0.002, 0.012)
      .add(vec3(0.024, 0.008, 0.07).scale(nebula * nebula * 0.8))
      .add(vec3(0.006, 0.025, 0.07).scale(dust * 0.32))
      .add(vec3(0.8, 0.9, 1.3).scale(star));

    const angularFlow = fbm2(
      vec2(angle * 1.7 + uTime * 0.12, radius * 5.8 - uTime * 0.09),
      5,
    );
    const flareNoise = turbulence2(
      vec2(angle * 2.8 - uTime * 0.17, radius * 7.2 + uTime * 0.06),
      5,
    );
    const photonRadius = 0.405 + (angularFlow - 0.5) * 0.035;
    const photonRing = 0.018 / max(abs(radius - photonRadius), 0.006);
    const innerRim = smoothstep(0.425, 0.398, radius)
      - smoothstep(0.385, 0.36, radius);
    const coronaRadius = 0.52 + flareNoise * 0.11 + sin(angle * 7 - uTime * 0.7) * 0.025;
    const corona = 0.025 / max(abs(radius - coronaRadius), 0.018)
      * smoothstep(0.78, 0.38, radius);
    const rays = pow(max(sin(angle * 17 + angularFlow * 7 - uTime * 0.6), 0), 10)
      * smoothstep(0.98, 0.46, radius)
      * smoothstep(0.43, 0.58, radius);

    const diskPoint = vec2(center.x, center.y * 5.4);
    const diskRadius = length(diskPoint);
    const diskNoise = fbm2(vec2(angle * 2.2 + uTime * 0.2, diskRadius * 5.2), 4);
    const disk = smoothstep(0.11, 0.015, abs(diskRadius - 0.72 - diskNoise * 0.09))
      * smoothstep(1.08, 0.48, diskRadius);
    const frontDisk = disk * smoothstep(-0.03, 0.07, center.y);
    const backDisk = disk * smoothstep(0.08, -0.03, center.y) * 0.42;
    const approachingDisk = frontDisk * smoothstep(-0.72, 0.58, center.x);
    const recedingDisk = frontDisk - approachingDisk;

    const coreMask = smoothstep(0.405, 0.365, radius);
    const lensHalo = smoothstep(0.72, 0.4, radius) * smoothstep(0.36, 0.42, radius);
    const heat = vec3(1.65, 0.16, 0.008).scale(corona * 0.18 + rays * 1.4)
      .add(vec3(2.4, 0.72, 0.08).scale(photonRing * 0.42 + innerRim * 2.5))
      .add(vec3(1.6, 0.36, 0.025).scale(backDisk * 1.2))
      .add(vec3(2.75, 1.12, 0.22).scale(recedingDisk * 2.25))
      .add(vec3(1.45, 1.72, 2.8).scale(approachingDisk * 1.65))
      .add(vec3(0.3, 0.12, 0.7).scale(lensHalo * 0.22));
    const blackCore = mix(vec3(0.001, 0.0015, 0.004), vec3(0.006, 0.001, 0.002), clamp(radius * 2, 0, 1));
    const color = background.scale(1 - coreMask).add(blackCore.scale(coreMask)).add(heat);
    return vec4(tonemapACES(color), 1);
  },
});
