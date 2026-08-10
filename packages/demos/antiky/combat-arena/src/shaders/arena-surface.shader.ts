import {
  clamp,
  dot,
  length,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  smoothstep,
  vec3,
  vec4,
} from 'brometal';
import { rotate2, tonemapACES } from 'brometal/shader-functions';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iColor: 'vec3',
    iParams: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vParams: 'vec3',
    vPulse: 'float',
  },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor, iParams }, { uViewProj, uTime }, v) {
    const angle = iParams.z;
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), angle);
    const rotatedNormal = rotate2(aNormal.xz, angle);
    const bob = sin(uTime * (2.1 + iParams.z * 0.2) + iOffset.x + iOffset.z) * iParams.x * 0.025;
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y + bob,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
    v.vColor = iColor;
    v.vParams = iParams;
    v.vPulse = 0.72 + sin(uTime * 4.2 + iOffset.x * 0.7 - iOffset.z * 0.4) * 0.28;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition }, { vWorld, vNormal, vColor, vParams, vPulse }) {
    const normal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));
    const light = normalize(vec3(0.46, 0.88, 0.3));
    const diffuse = max(dot(normal, light), 0);
    const rim = pow(1 - max(dot(normal, view), 0), 2.1);
    const heightGlow = smoothstep(-0.45, 1.2, vWorld.y);
    const base = vColor.scale(0.16 + diffuse * 0.72)
      .add(vec3(0.06, 0.11, 0.2).scale(0.22 + normal.y * 0.18));
    const energy = vColor.scale(vParams.x * (0.35 + vPulse * 0.65))
      .add(vec3(0.22, 0.6, 1.2).scale(rim * (0.32 + heightGlow * 0.24)));
    const hit = clamp(vParams.y, 0, 1);
    const flashed = mix(base.add(energy), vec3(2.6, 2.8, 3.2), hit * hit);
    const fog = smoothstep(13, 26, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(flashed, vec3(0.008, 0.012, 0.03), fog * 0.8)), 1);
  },
});
