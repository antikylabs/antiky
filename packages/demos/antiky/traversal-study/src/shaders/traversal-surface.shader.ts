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
    iMaterial: 'vec3',
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
    vMaterial: 'vec3',
    vPulse: 'float',
  },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor, iMaterial }, { uViewProj, uTime }, v) {
    const rotatedPosition = rotate2(aPosition.xy.mul(iScale.xy), iMaterial.z);
    const rotatedNormal = rotate2(aNormal.xy, iMaterial.z);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      rotatedPosition.y + iOffset.y,
      aPosition.z * iScale.z + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, rotatedNormal.y, aNormal.z));
    v.vColor = iColor;
    v.vMaterial = iMaterial;
    v.vPulse = 0.74 + sin(uTime * 3.6 + iOffset.x * 0.28 + iOffset.y) * 0.26;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition }, { vWorld, vNormal, vColor, vMaterial, vPulse }) {
    const normal = normalize(vNormal);
    const light = normalize(vec3(-0.42, 0.82, 0.58));
    const view = normalize(uCameraPosition.sub(vWorld));
    const rawLight = max(dot(normal, light), 0);
    const litBand = smoothstep(0.18, 0.24, rawLight) * 0.28
      + smoothstep(0.58, 0.64, rawLight) * 0.48;
    const rim = pow(1 - max(dot(normal, view), 0), 2.2);
    const base = vColor.scale(0.2 + litBand)
      .add(vec3(0.08, 0.14, 0.26).scale(0.2 + normal.y * 0.12));
    const emissive = vColor.scale(vMaterial.x * (0.4 + vPulse * 0.6));
    const highlight = vec3(1.5, 1.15, 0.72).scale(clamp(vMaterial.y, 0, 1) * (0.35 + rim));
    const depth = smoothstep(8, 24, length(uCameraPosition.sub(vWorld)));
    const heightHaze = (1 - smoothstep(-5, 6, vWorld.y)) * 0.18;
    const sky = vec3(0.025, 0.055, 0.15).add(vec3(0.08, 0.035, 0.15).scale(heightHaze));
    return vec4(tonemapACES(mix(base.add(emissive).add(highlight), sky, depth * 0.72)), 1);
  },
});
