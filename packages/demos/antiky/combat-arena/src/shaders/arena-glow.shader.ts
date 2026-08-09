import {
  clamp,
  dot,
  max,
  normalize,
  pow,
  shader,
  sin,
  vec3,
  vec4,
} from 'brometal';
import { rotate2 } from 'brometal/shader-functions';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iColor: 'vec3',
    iAlpha: 'float',
    iRotation: 'float',
    iPhase: 'float',
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
    vAlpha: 'float',
  },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor, iAlpha, iRotation, iPhase }, { uViewProj, uTime }, v) {
    const angle = iRotation;
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), angle);
    const rotatedNormal = rotate2(aNormal.xz, angle);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
    v.vColor = iColor;
    v.vAlpha = iAlpha * (0.82 + sin(uTime * 5 + iPhase * 2.3) * 0.18);
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition }, { vWorld, vNormal, vColor, vAlpha }) {
    const facing = max(dot(normalize(vNormal), normalize(uCameraPosition.sub(vWorld))), 0);
    const core = pow(facing, 2.4);
    const rim = pow(1 - facing, 1.6);
    const strength = clamp(0.3 + core * 1.25 + rim * 0.55, 0, 2);
    return vec4(vColor.scale(strength), vAlpha * (0.35 + core * 0.52 + rim * 0.28));
  },
});
