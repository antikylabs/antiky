import {
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
    const rotatedPosition = rotate2(aPosition.xy.mul(iScale.xy), iRotation);
    const rotatedNormal = rotate2(aNormal.xy, iRotation);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      rotatedPosition.y + iOffset.y,
      aPosition.z * iScale.z + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, rotatedNormal.y, aNormal.z));
    v.vColor = iColor;
    v.vAlpha = iAlpha * (0.8 + sin(uTime * 4.8 + iPhase) * 0.2);
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition }, { vWorld, vNormal, vColor, vAlpha }) {
    const facing = max(dot(normalize(vNormal), normalize(uCameraPosition.sub(vWorld))), 0);
    const core = pow(facing, 2.5);
    const rim = pow(1 - facing, 1.45);
    return vec4(vColor.scale(0.45 + core * 1.2 + rim * 0.45), vAlpha * (0.4 + core * 0.5 + rim * 0.24));
  },
});
