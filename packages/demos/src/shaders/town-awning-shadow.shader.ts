import {
  shader,
  clamp,
  cos,
  floor,
  fract,
  max,
  normalize,
  sin,
  smoothstep,
  vec3,
  vec4,
} from 'brometal';

/** Shadow caster using the exact visible awning deformation. */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  instanceAttributes: {
    iCenter: 'vec3',
    iSize: 'vec2',
    iYaw: 'float',
    iSlope: 'float',
    iStyle: 'float',
    iPhase: 'float',
  },
  uniforms: { uLightViewProj: 'mat4', uTime: 'float' },
  varyings: { vWorld: 'vec3' },

  vertex(
    { aPosition, aUv, iCenter, iSize, iYaw, iSlope, iStyle, iPhase },
    { uLightViewProj, uTime },
    v,
  ) {
    const phaseA = uTime * 1.35 + iPhase * 6.28318 + aUv.x * 5.4 + aUv.y * 2.1;
    const phaseB = uTime * 0.83 + iPhase * 10.6814 - aUv.x * 3.2 + aUv.y * 4.6;
    const waveA = sin(phaseA);
    const waveB = sin(phaseB);
    const freeEdge = 0.35 + smoothstep(0.12, 1, aUv.y) * 0.65;
    const wind = (waveA * 0.7 + waveB * 0.3) * 0.026 * freeEdge;
    const sagAmplitude = 0.03 + iSize.y * 0.012;
    const sagX = sin(aUv.x * 3.14159);
    const sagZ = sin(aUv.y * 3.14159);
    const localX = aPosition.x * iSize.x;
    const localZ = aPosition.z * iSize.y;
    const localY = -aPosition.z * iSlope * iSize.y - sagX * sagZ * sagAmplitude + wind;
    const safeWidth = max(iSize.x, 0.01);
    const safeDepth = max(iSize.y, 0.01);
    const dyDx = -cos(aUv.x * 3.14159) * 3.14159 / safeWidth * sagZ * sagAmplitude +
      (cos(phaseA) * 5.4 * 0.7 - cos(phaseB) * 3.2 * 0.3) / safeWidth *
      0.026 * freeEdge;
    const dyDz = -iSlope - sagX * cos(aUv.y * 3.14159) * 3.14159 /
      safeDepth * sagAmplitude +
      (cos(phaseA) * 2.1 * 0.7 + cos(phaseB) * 4.6 * 0.3) / safeDepth *
      0.026 * freeEdge;
    const localNormal = normalize(vec3(-dyDx, 1, -dyDz));
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const styleNoop = iStyle * 0;
    const rotated = vec3(
      yawCos * localX + yawSin * localZ + styleNoop,
      localY,
      -yawSin * localX + yawCos * localZ,
    );
    const upperNormal = normalize(vec3(
      yawCos * localNormal.x + yawSin * localNormal.z,
      localNormal.y,
      -yawSin * localNormal.x + yawCos * localNormal.z,
    ));
    const world = iCenter.add(rotated).add(upperNormal.scale(aPosition.y * 0.008));
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightViewProj }, { vWorld }) {
    const clip = uLightViewProj.mul(vec4(vWorld, 1));
    const depth = clamp(clip.z / clip.w * 0.5 + 0.5, 0, 1);
    const scaled = depth * 255;
    return vec4(floor(scaled) / 255, fract(scaled), depth, 1);
  },
});
